import { copyFileSync, mkdirSync } from 'node:fs'
import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: false,
  plugins: [
    {
      name: 'veritas-copy-catalog-http',
      closeBundle() {
        mkdirSync('mcp/dist', { recursive: true })
        copyFileSync('src/chips/catalog.json', 'mcp/dist/catalog.json')
      },
    },
  ],
  build: {
    outDir: 'mcp/dist',
    emptyOutDir: false,
    minify: false,
    ssr: 'mcp/src/http-entry.ts',
    target: 'node22',
    rollupOptions: {
      external: [/^@modelcontextprotocol\//, 'zod', /^node:/],
      output: { entryFileNames: 'http-server.js' },
    },
  },
})
