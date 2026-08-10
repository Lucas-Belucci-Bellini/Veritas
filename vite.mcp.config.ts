import { copyFileSync, mkdirSync } from 'node:fs'
import { defineConfig } from 'vite'

/**
 * Build do servidor MCP.
 *
 * O motor entra empacotado (é código deste repositório), mas o SDK do MCP fica
 * de fora — ele é dependência declarada do pacote, e embutir uma cópia só
 * criaria divergência de versão com o cliente.
 */
export default defineConfig({
  publicDir: false,
  plugins: [
    {
      name: 'veritas-copy-catalog',
      closeBundle() {
        // O catálogo é lido do disco em tempo de execução, não empacotado.
        mkdirSync('mcp/dist', { recursive: true })
        copyFileSync('src/chips/catalog.json', 'mcp/dist/catalog.json')
      },
    },
  ],
  build: {
    outDir: 'mcp/dist',
    emptyOutDir: true,
    minify: false,
    ssr: 'mcp/src/server.ts',
    target: 'node22',
    rollupOptions: {
      external: [/^@modelcontextprotocol\//, 'zod', /^node:/],
      output: { entryFileNames: 'server.js' },
    },
  },
})
