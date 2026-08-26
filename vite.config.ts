import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    // Three.js, the GLTF loader, and environment lighting stay isolated in one lazily loaded 3D chunk.
    chunkSizeWarningLimit: 675,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['promptmiles-icon.svg'],
      manifest: {
        name: 'PromptMiles',
        short_name: 'PromptMiles',
        description: 'See how far a Model 3 could travel on the estimated energy behind your AI use.',
        theme_color: '#07131d',
        background_color: '#07131d',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          {
            src: '/promptmiles-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,glb}'],
        maximumFileSizeToCacheInBytes: 10 * 1_024 * 1_024,
        navigateFallback: 'index.html',
      },
    }),
  ],
});
