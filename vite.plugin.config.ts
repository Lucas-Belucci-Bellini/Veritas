import { copyFileSync, mkdirSync } from 'node:fs'
import { defineConfig } from 'vite'

/**
 * Build do plugin do Claude Code.
 *
 * Diferente do build do `mcp/`, aqui **nada** fica externo: quem instala um
 * plugin recebe uma cópia da pasta, sem `npm install`, então o SDK do MCP e o
 * zod precisam vir dentro do pacote.
 */
export default defineConfig({
  publicDir: false,
  // Sem isto o Vite deixaria as dependências de node_modules como imports
  // externos, e o plugin instalado não tem node_modules para resolvê-los.
  ssr: { noExternal: true },
  plugins: [
    {
      name: 'veritas-copy-catalog',
      closeBundle() {
        mkdirSync('plugins/veritas-logic', { recursive: true })
        copyFileSync('src/chips/catalog.json', 'plugins/veritas-logic/catalog.json')
      },
    },
  ],
  build: {
    outDir: 'plugins/veritas-logic',
    emptyOutDir: false,
    minify: false,
    ssr: 'mcp/src/stdio.ts',
    target: 'node22',
    rollupOptions: {
      external: [/^node:/],
      output: { entryFileNames: 'server.mjs', inlineDynamicImports: true },
    },
  },
})
