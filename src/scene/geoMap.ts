import * as THREE from 'three';
import { mesh } from 'topojson-client';
import type { GeometryObject, Topology } from 'topojson-specification';
import worldAtlasJson from 'world-atlas/countries-110m.json';
import usAtlasJson from 'us-atlas/states-10m.json';

export type GeoMapMode = 'none' | 'us' | 'world';

export interface GeoMapLayer {
  group: THREE.Group;
  materials: Array<THREE.Material & { opacity: number }>;
}

const ORIGIN = { latitude: 30.2672, longitude: -97.7431 } as const;
const PATH_ORIGIN_X = 1.45;
const US_SCALE = 0.5;
const WORLD_SCALE = 0.115;
const LONGITUDE_COSINE = Math.cos(THREE.MathUtils.degToRad(ORIGIN.latitude));

interface City {
  label: string;
  latitude: number;
  longitude: number;
  origin?: boolean;
}

const US_CITIES: City[] = [
  { label: 'Austin', latitude: ORIGIN.latitude, longitude: ORIGIN.longitude, origin: true },
  { label: 'Los Angeles', latitude: 34.0522, longitude: -118.2437 },
  { label: 'Denver', latitude: 39.7392, longitude: -104.9903 },
  { label: 'Chicago', latitude: 41.8781, longitude: -87.6298 },
  { label: 'Atlanta', latitude: 33.749, longitude: -84.388 },
  { label: 'New York', latitude: 40.7128, longitude: -74.006 },
  { label: 'Miami', latitude: 25.7617, longitude: -80.1918 },
];

const WORLD_CITIES: City[] = [
  { label: 'Austin', latitude: ORIGIN.latitude, longitude: ORIGIN.longitude, origin: true },
  { label: 'São Paulo', latitude: -23.5505, longitude: -46.6333 },
  { label: 'London', latitude: 51.5074, longitude: -0.1278 },
  { label: 'Cairo', latitude: 30.0444, longitude: 31.2357 },
  { label: 'Mumbai', latitude: 19.076, longitude: 72.8777 },
  { label: 'Tokyo', latitude: 35.6762, longitude: 139.6503 },
  { label: 'Sydney', latitude: -33.8688, longitude: 151.2093 },
];

function wrapLongitude(longitude: number): number {
  return ((longitude - ORIGIN.longitude + 540) % 360) - 180;
}

function projectUs(coordinate: number[]): THREE.Vector2 | null {
  const [longitude, latitude] = coordinate;
  if (longitude === undefined || latitude === undefined) return null;
  if (longitude < -130 || longitude > -60 || latitude < 22 || latitude > 52) return null;
  return new THREE.Vector2(
    PATH_ORIGIN_X + (longitude - ORIGIN.longitude) * US_SCALE * LONGITUDE_COSINE,
    -(latitude - ORIGIN.latitude) * US_SCALE,
  );
}

function projectWorld(coordinate: number[]): THREE.Vector2 | null {
  const [longitude, latitude] = coordinate;
  if (longitude === undefined || latitude === undefined) return null;
  return new THREE.Vector2(
    PATH_ORIGIN_X + wrapLongitude(longitude) * WORLD_SCALE,
    -(latitude - ORIGIN.latitude) * WORLD_SCALE,
  );
}

function createLineGeometry(
  coordinates: number[][][],
  project: (coordinate: number[]) => THREE.Vector2 | null,
  maximumSegmentLength: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  coordinates.forEach((line) => {
    for (let index = 1; index < line.length; index += 1) {
      const start = project(line[index - 1]!);
      const end = project(line[index]!);
      if (!start || !end || start.distanceTo(end) > maximumSegmentLength) continue;
      positions.push(start.x, 0.045, start.y, end.x, 0.045, end.y);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

function lineMaterial(color: number, baseOpacity: number): THREE.LineBasicMaterial {
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  material.userData.baseOpacity = baseOpacity;
  return material;
}

function createLabelMaterial(label: string, origin: boolean): THREE.SpriteMaterial {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = origin ? 'rgba(8, 36, 44, 0.92)' : 'rgba(5, 18, 26, 0.78)';
    context.beginPath();
    context.roundRect(2, 8, 252, 48, 16);
    context.fill();
    context.strokeStyle = origin ? 'rgba(66, 232, 223, 0.85)' : 'rgba(151, 199, 202, 0.34)';
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = origin ? '#dffffd' : '#aac2c5';
    context.font = `600 ${origin ? 24 : 21}px Inter, system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, 128, 32);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  });
  material.userData.baseOpacity = origin ? 0.96 : 0.72;
  return material;
}

function addCities(
  layer: GeoMapLayer,
  cities: City[],
  project: (coordinate: number[]) => THREE.Vector2 | null,
): void {
  cities.forEach((city) => {
    const point = project([city.longitude, city.latitude]);
    if (!point) return;
    const dotMaterial = new THREE.MeshBasicMaterial({
      color: city.origin ? 0x42e8df : 0x739ca1,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    dotMaterial.userData.baseOpacity = city.origin ? 1 : 0.7;
    const dot = new THREE.Mesh(new THREE.CircleGeometry(city.origin ? 0.12 : 0.07, 24), dotMaterial);
    dot.rotation.x = -Math.PI / 2;
    dot.position.set(point.x, 0.07, point.y);
    layer.group.add(dot);
    layer.materials.push(dotMaterial);

    const labelMaterial = createLabelMaterial(city.label, city.origin === true);
    const label = new THREE.Sprite(labelMaterial);
    label.position.set(point.x, city.origin ? 0.72 : 0.48, point.y - 0.12);
    label.scale.set(city.origin ? 2.25 : 1.75, city.origin ? 0.56 : 0.44, 1);
    layer.group.add(label);
    layer.materials.push(labelMaterial);
  });
}

function addLine(
  layer: GeoMapLayer,
  geometry: THREE.BufferGeometry,
  color: number,
  baseOpacity: number,
): void {
  const material = lineMaterial(color, baseOpacity);
  layer.group.add(new THREE.LineSegments(geometry, material));
  layer.materials.push(material);
}

function blankLayer(name: string): GeoMapLayer {
  const group = new THREE.Group();
  group.name = name;
  group.visible = false;
  return { group, materials: [] };
}

export function createGeoMapLayers(): { us: GeoMapLayer; world: GeoMapLayer } {
  const us = blankLayer('Continental US map');
  const world = blankLayer('World map');
  const usTopology = usAtlasJson as unknown as Topology;
  const worldTopology = worldAtlasJson as unknown as Topology;

  const states = mesh(
    usTopology,
    usTopology.objects.states as GeometryObject,
    (left, right) => left !== right,
  );
  const nation = mesh(usTopology, usTopology.objects.nation as GeometryObject);
  addLine(us, createLineGeometry(states.coordinates, projectUs, 1.5), 0x508c96, 0.34);
  addLine(us, createLineGeometry(nation.coordinates, projectUs, 1.5), 0x8de6e1, 0.82);
  addCities(us, US_CITIES, projectUs);

  const countries = mesh(
    worldTopology,
    worldTopology.objects.countries as GeometryObject,
    (left, right) => left !== right,
  );
  const land = mesh(worldTopology, worldTopology.objects.land as GeometryObject);
  addLine(world, createLineGeometry(countries.coordinates, projectWorld, 5), 0x477c86, 0.27);
  addLine(world, createLineGeometry(land.coordinates, projectWorld, 5), 0x7fd8d4, 0.7);
  addCities(world, WORLD_CITIES, projectWorld);

  return { us, world };
}

export function mapRadiusForMiles(miles: number, mode: GeoMapMode): number {
  if (mode === 'us') return miles * (US_SCALE / 69);
  if (mode === 'world') return miles * (WORLD_SCALE / 69);
  return 0;
}

export function updateGeoMapLayer(layer: GeoMapLayer, visibility: number): void {
  const shown = THREE.MathUtils.clamp(visibility, 0, 1);
  layer.group.visible = shown > 0.005;
  layer.materials.forEach((material) => {
    material.opacity = Number(material.userData.baseOpacity ?? 1) * shown;
  });
}
