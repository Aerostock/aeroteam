import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/aeroteam/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'AeroTeam',
        short_name: 'AeroTeam',
        description: 'Application web de gestion des équipes de maintenance aéronautique',
        theme_color: '#0f172a',
        background_color: '#f1f5f9',
        display: 'standalone',
        start_url: '/aeroteam/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        navigateFallback: '/aeroteam/index.html',
        navigateFallbackDenylist: [/\/aeroteam\/assets\/.*/, /\/aeroteam\/docs\/.*/],
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})