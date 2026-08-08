import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt" em vez de atualizar sozinho: recarregar a página no meio de
      // uma expressão longa seria uma surpresa desagradável.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Veritas — Tabelas Verdade e Circuitos Lógicos',
        short_name: 'Veritas',
        description:
          'Calculadora de tabelas verdade e simulador de circuitos lógicos que roda inteiramente no navegador.',
        lang: 'pt-BR',
        dir: 'ltr',
        theme_color: '#176cf5',
        background_color: '#0b1120',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['education', 'utilities', 'productivity'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // O catálogo de chips entra no cache junto: a biblioteca inteira fica
        // disponível offline, não só a calculadora.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
