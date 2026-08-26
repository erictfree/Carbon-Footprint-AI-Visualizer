import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    // Three.js is isolated behind a dynamic import; its 3D chunk is ~570 kB minified / ~143 kB gzip.
    chunkSizeWarningLimit: 600,
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
        globPatterns: ['**/*.{js,css,html,svg}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
});
