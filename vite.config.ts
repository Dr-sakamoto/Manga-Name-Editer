import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [
    react(),
    ...(mode === 'single'
      ? [viteSingleFile()]
      : [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['apple-touch-icon.png'],
            manifest: {
              id: '.',
              name: 'ネームエディタ — ページ占有率とフリ・オチ',
              short_name: 'ネームエディタ',
              description: '漫画のネーム（構成）をページ占有率とフリ・オチのネットワークで管理するツール',
              lang: 'ja',
              start_url: '.',
              scope: '.',
              display: 'standalone',
              orientation: 'any',
              background_color: '#14161c',
              theme_color: '#14161c',
              icons: [
                { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
            },
          }),
        ]),
  ],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    emptyOutDir: true,
  },
}));
