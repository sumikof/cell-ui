import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'node:path';

export default defineConfig(({ command }) => ({
  plugins: command === 'build' ? [dts({ include: ['src'], rollupTypes: false })] : [],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'CellUI',
      fileName: (format) => (format === 'es' ? 'cell-ui.js' : 'cell-ui.iife.js'),
      formats: ['es', 'iife'],
    },
    cssFileName: 'cell-ui',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
  },
}));
