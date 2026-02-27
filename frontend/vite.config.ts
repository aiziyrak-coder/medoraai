import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Root va frontend papkalaridan env o'qish
  const envFromParent  = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const envFromCurrent = loadEnv(mode, __dirname, '');
  const env = { ...envFromParent, ...envFromCurrent };

  // Production uchun medora.ziyrak.org, dev uchun localhost
  const apiUrl = env.VITE_API_BASE_URL || (
    mode === 'production'
      ? 'https://medora.ziyrak.org/api'
      : 'http://localhost:8000/api'
  );

  // Azure AI Foundry kalitlari
  const azureEndpoint   = env.VITE_AZURE_OPENAI_ENDPOINT   || '';
  const azureApiKey     = env.VITE_AZURE_OPENAI_API_KEY     || '';
  const azureApiVersion = env.VITE_AZURE_API_VERSION        || '2024-12-01-preview';
  const deployGpt4o     = env.VITE_AZURE_DEPLOY_GPT4O       || 'medora-gpt4o';
  const deployMini      = env.VITE_AZURE_DEPLOY_MINI        || 'medora-mini';

  console.log(`[Vite][${mode}] API: ${apiUrl}`);
  console.log(`[Vite][${mode}] Azure: ${azureEndpoint ? 'CONFIGURED' : 'NOT SET'}`);

  return {
    root:      './',
    publicDir: './public',

    server: {
      port: 3000,
      host: '0.0.0.0',
      // Production build uchun HTTPS proxy
      proxy: mode === 'development' ? {
        '/api': {
          target:      'http://localhost:8000',
          changeOrigin: true,
        },
      } : undefined,
    },

    plugins: [react()],

    define: {
      // Azure env vars (build vaqtida inline qilinadi)
      'import.meta.env.VITE_API_BASE_URL':            JSON.stringify(apiUrl),
      'import.meta.env.VITE_AZURE_OPENAI_ENDPOINT':   JSON.stringify(azureEndpoint),
      'import.meta.env.VITE_AZURE_OPENAI_API_KEY':    JSON.stringify(azureApiKey),
      'import.meta.env.VITE_AZURE_API_VERSION':        JSON.stringify(azureApiVersion),
      'import.meta.env.VITE_AZURE_DEPLOY_GPT4O':       JSON.stringify(deployGpt4o),
      'import.meta.env.VITE_AZURE_DEPLOY_MINI':        JSON.stringify(deployMini),
    },

    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },

    build: {
      outDir:     '../dist',
      emptyOutDir: true,
      // Source maps faqat dev uchun
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'ai-vendor':    ['openai'],
            'doc-vendor':   ['jspdf', 'docx'],
          },
        },
      },
      chunkSizeWarningLimit: 1500,
    },
  };
});
