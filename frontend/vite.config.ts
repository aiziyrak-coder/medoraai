import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Load env from both current and parent directory
    const envFromParent = loadEnv(mode, path.resolve(__dirname, '..'), '');
    const envFromCurrent = loadEnv(mode, __dirname, '');
    const env = { ...envFromParent, ...envFromCurrent };
    
    // Direct environment variable fallback
    const geminiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
    const apiUrl = env.VITE_API_BASE_URL || (mode === 'production' ? 'https://medoraapi.cdcgroup.uz/api' : 'http://localhost:8000/api');
    
    console.log('Build with Gemini key:', geminiKey ? 'SET (length: ' + geminiKey.length + ')' : 'NOT SET');
    
    return {
      root: './',
      publicDir: './public',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(geminiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiKey),
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiKey),
        'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiUrl),
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
