import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    // Keep enough room for the locally bundled factory artwork and packing sprites.
    chunkSizeWarningLimit: 900,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['assets/burger-works/burger.png'],
      manifest: {
        name: 'Burger Works',
        short_name: 'Burger Works',
        description: 'Compare estimated AI and lifestyle carbon through a responsive miniature burger factory.',
        theme_color: '#030b12',
        background_color: '#030b12',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          {
            src: '/assets/burger-works/burger.png',
            sizes: '640x640',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png}'],
        maximumFileSizeToCacheInBytes: 10 * 1_024 * 1_024,
        navigateFallback: 'index.html',
      },
    }),
  ],
});
