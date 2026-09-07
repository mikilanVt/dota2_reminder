import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/dota2_reminder/',
  plugins: [react()],
  build: {
    target: 'es2022',
    cssMinify: 'lightningcss',
    reportCompressedSize: true,
    sourcemap: false
  }
});
