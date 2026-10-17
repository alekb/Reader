import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// Set VITE_BASE=/repo-name/ when hosting under a sub-path (e.g. GitHub Pages).
const base = process.env.VITE_BASE || '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered in main.tsx, on the web only.
      injectRegister: null,
      // Android builds (NATIVE_BUILD=1) need no service worker; theirs removes the one older
      // APKs registered and reloads the app, so an update shows on its first launch.
      selfDestroying: process.env.NATIVE_BUILD === '1',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        name: 'Reader Quest',
        short_name: 'Reader Quest',
        description: 'A fun phonics adventure that teaches kids to read.',
        theme_color: '#2563eb',
        background_color: '#fef3c7',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,ttf}'],
        navigateFallback: 'index.html',
        // Audio clips are fetched on demand and cached for offline use.
        runtimeCaching: [
          // Manifests change when clips are added or regenerated, so check the network first.
          // Same cache as the clips, so a manifest cached by an older version still works offline.
          {
            urlPattern: ({ url }) => url.pathname.includes('/audio/') && url.pathname.endsWith('/manifest.json'),
            handler: 'NetworkFirst',
            options: { cacheName: 'audio', networkTimeoutSeconds: 3 },
          },
          // Clip URLs carry a content version (?v=...), so a cached clip never goes stale.
          {
            urlPattern: ({ url }) => url.pathname.includes('/audio/'),
            handler: 'CacheFirst',
            options: { cacheName: 'audio', expiration: { maxEntries: 6000, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  build: { outDir: 'dist' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
