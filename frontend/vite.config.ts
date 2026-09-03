import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Faqat VITE_ prefiksli o'zgaruvchilar. Prefiksiz o'qish server tomon
  // kalitlarini (ANTHROPIC_API_KEY va h.k.) brauzer bundle'iga tortib kelardi.
  const envFromParent  = loadEnv(mode, path.resolve(__dirname, '..'), 'VITE_');
  const envFromCurrent = loadEnv(mode, __dirname, 'VITE_');
  const env = { ...envFromParent, ...envFromCurrent };

  const apiUrl = env.VITE_API_BASE_URL || (
    mode === 'production' ? 'https://api.aidoktor.uz/api' : 'http://localhost:8000/api'
  );

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
            'doc-vendor': ['jspdf', 'docx'],
          },
        },
      },
      chunkSizeWarningLimit: 1500,
    },
  };
});