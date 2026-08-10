import { defineConfig } from 'vite'

/**
 * Build do motor como biblioteca.
 *
 * O importador de chips e o servidor MCP rodam no Node e precisam do mesmo
 * código que o site usa. Empacotar o motor uma vez evita manter duas cópias do
 * Quine-McCluskey vivas — que foi exatamente o que aconteceu antes.
 */
export default defineConfig({
  // Sem os assets do site: aqui só sai o motor.
  publicDir: false,
  build: {
    outDir: 'dist-lib',
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: 'src/engine/index.ts',
      formats: ['es'],
      fileName: () => 'veritas-engine.js',
    },
  },
})
