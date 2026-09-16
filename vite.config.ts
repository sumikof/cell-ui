import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'node:path';

export default defineConfig(({ command }) => ({
  plugins: command === 'build' ? [dts({ include: ['src'], rollupTypes: false })] : [],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'CellUI',
      fileName: 'cell-ui',
      formats: ['es'],
    },
    cssFileName: 'cell-ui',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/**/*.test.ts'],
  },
}));
