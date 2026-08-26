import Papa from 'papaparse';
import type { ModelUsageAggregate, UsageAggregate, UsageRow } from '../types';

export const MAX_CSV_BYTES = 50 * 1024 * 1024;

const aliases = {
  timestamp: ['timestamp', 'date', 'usage_date', 'start_time', 'bucket_start_time', 'created_at'],
  model: ['model', 'model_name', 'line_item', 'product'],
  inputTokens: ['input_tokens', 'input_token_count', 'prompt_tokens', 'input'],
  outputTokens: ['output_tokens', 'output_token_count', 'completion_tokens', 'output'],
  requests: ['requests', 'num_requests', 'request_count', 'num_model_requests'],
};

function canonicalHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function matchingColumn(headers: string[], candidates: string[]): string | undefined {
  return candidates.find((candidate) => headers.includes(candidate));
}

function numeric(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const parsed = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
}

function aggregateRows(
  rows: UsageRow[],
  sourceName: string,
  synthetic: boolean,
  warnings: string[],
): UsageAggregate {
  if (rows.length === 0) throw new Error('No usable usage rows were found in this CSV.');

  const byModel = new Map<string, ModelUsageAggregate>();
  for (const row of rows) {
    const current = byModel.get(row.model) ?? {
      model: row.model,
      inputTokens: 0,
      outputTokens: 0,
      requests: 0,
    };
    current.inputTokens += row.inputTokens;
    current.outputTokens += row.outputTokens;
    current.requests += row.requests;
    byModel.set(row.model, current);
  }

  const timestamps = rows.map((row) => row.timestamp.getTime());
  return {
    sourceName,
    synthetic,
    rowCount: rows.length,
    start: new Date(Math.min(...timestamps)),
    end: new Date(Math.max(...timestamps)),
    inputTokens: rows.reduce((total, row) => total + row.inputTokens, 0),
    outputTokens: rows.reduce((total, row) => total + row.outputTokens, 0),
    requests: rows.reduce((total, row) => total + row.requests, 0),
    models: [...byModel.values()].sort((a, b) => b.outputTokens - a.outputTokens),
    warnings,
  };
}

export function parseUsageCsvText(
  csv: string,
  options: { sourceName?: string; synthetic?: boolean } = {},
): UsageAggregate {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: canonicalHeader,
  });

  const headers = (parsed.meta.fields ?? []).map(canonicalHeader);
  const columns = {
    timestamp: matchingColumn(headers, aliases.timestamp),
    model: matchingColumn(headers, aliases.model),
    inputTokens: matchingColumn(headers, aliases.inputTokens),
    outputTokens: matchingColumn(headers, aliases.outputTokens),
    requests: matchingColumn(headers, aliases.requests),
  };

  if (!columns.timestamp || !columns.model || (!columns.inputTokens && !columns.outputTokens)) {
    throw new Error(
      'CSV needs a date, model, and at least one token column. Column-name variations are supported.',
    );
  }

  const warnings = parsed.errors.slice(0, 5).map((error) => `Row ${error.row ?? '?'}: ${error.message}`);
  const rows: UsageRow[] = [];

  parsed.data.forEach((raw, index) => {
    const timestamp = new Date(raw[columns.timestamp!] ?? '');
    const model = String(raw[columns.model!] ?? '').trim();
    const inputTokens = Math.max(0, numeric(columns.inputTokens ? raw[columns.inputTokens] : 0));
    const outputTokens = Math.max(0, numeric(columns.outputTokens ? raw[columns.outputTokens] : 0));
    const requests = Math.max(1, Math.round(numeric(columns.requests ? raw[columns.requests] : 1, 1)));

    if (Number.isNaN(timestamp.getTime()) || !model || inputTokens + outputTokens === 0) {
      if (warnings.length < 8) warnings.push(`Skipped unusable data row ${index + 2}.`);
      return;
    }

    rows.push({ timestamp, model, inputTokens, outputTokens, requests });
  });

  return aggregateRows(
    rows,
    options.sourceName ?? 'usage.csv',
    options.synthetic ?? false,
    warnings,
  );
}

export async function parseUsageFile(file: File): Promise<UsageAggregate> {
  if (file.size > MAX_CSV_BYTES) {
    throw new Error(`That file is larger than the ${(MAX_CSV_BYTES / 1024 / 1024).toFixed(0)} MB limit.`);
  }
  return parseUsageCsvText(await file.text(), { sourceName: file.name });
}
