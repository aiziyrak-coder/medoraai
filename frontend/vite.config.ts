import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load env from parent directory (root) where .env.local is located
    const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
    const isProduction = mode === 'production';
    const defaultApiUrl = isProduction ? 'https://medoraapi.cdcgroup.uz/api' : 'http://localhost:8000/api';
    const apiBaseUrl = env.VITE_API_BASE_URL || defaultApiUrl;
    return {
      root: './',
      publicDir: './public',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || ''),
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || ''),
        'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      },
      build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
          output: {
            manualChunks: {
              'react-vendor': ['react', 'react-dom'],
              'ai-vendor': ['@google/genai'],
            },
          },
        },
        chunkSizeWarningLimit: 1000, // 1MB
      }
    };
});
