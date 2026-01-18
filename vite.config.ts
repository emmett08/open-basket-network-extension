import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'popup.html'),
        options: path.resolve(__dirname, 'options.html'),
        basket: path.resolve(__dirname, 'basket.html'),
        background: path.resolve(__dirname, 'src/background.ts'),
        content: path.resolve(__dirname, 'src/content.ts')
      },
      output: {
        entryFileNames: chunk => {
          if (chunk.name === 'background' || chunk.name === 'content') return '[name].js';
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/chunks/[name]-[hash].js',
        assetFileNames: 'assets/static/[name]-[hash][extname]'
      }
    }
  }
});

