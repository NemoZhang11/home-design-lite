import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  base: '/home-design-lite/',
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    port: 3000,
    open: true,
  },
});
