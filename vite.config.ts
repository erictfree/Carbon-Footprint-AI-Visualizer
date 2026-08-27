import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Keep enough room for the locally bundled factory artwork and packing sprites.
    chunkSizeWarningLimit: 900,
  },
});
