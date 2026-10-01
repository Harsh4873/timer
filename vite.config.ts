import { defineConfig } from 'vite';

export default defineConfig({
  base: '/timer/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
