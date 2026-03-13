import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const envFromParent  = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const envFromCurrent = loadEnv(mode, __dirname, '');
  const env = { ...envFromParent, ...envFromCurrent };

  const apiUrl = env.VITE_API_BASE_URL || (
    mode === 'production' ? 'https://medora.cdcgroup.uz/api' : 'http://localhost:8000/api'
  );
  const geminiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || '';

  console.log(`[Vite][${mode}] API: ${apiUrl}`);

  return {
    root: './',
    publicDir: './public',
    server: {
      port: 3000,
      host: true,
      proxy: mode === 'development' ? {
        '/api': { target: 'http://localhost:8000', changeOrigin: true },
        '/health': { target: 'http://localhost:8000', changeOrigin: true },
      } : undefined,
    },
    plugins: [react()],
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiUrl),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiKey),
    },
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'ai-vendor': ['@google/genai'],
            'doc-vendor': ['jspdf', 'docx'],
          },
        },
      },
      chunkSizeWarningLimit: 1500,
    },
  };
});