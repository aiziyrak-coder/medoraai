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
    // Development: direct to backend on 8000
    const apiUrl = mode === 'development' ? 'http://localhost:8000/api' : (env.VITE_API_BASE_URL || 'https://medoraapi.cdcgroup.uz/api');
    // Only use WebSocket when gateway is running; in dev leave empty to avoid "connection failed" if gateway not started
    const monitoringWsUrl = env.VITE_MONITORING_WS_URL || '';
    
    console.log('Build with Gemini key:', geminiKey ? 'SET (length: ' + geminiKey.length + ')' : 'NOT SET');
    console.log('[DEV] API base URL:', apiUrl, '(backend: run_backend.ps1 on port 8000)');
    
    return {
      root: './',
      publicDir: './public',
      server: {
        port: 3000,
        host: true,
        strictPort: false,
        hmr: { clientPort: 3000 },
        proxy: {
          '/api': {
            target: 'http://localhost:8000',
            changeOrigin: true,
          },
          '/health': {
            target: 'http://localhost:8000',
            changeOrigin: true,
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(geminiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiKey),
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiKey),
        'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiUrl),
        'import.meta.env.VITE_MONITORING_WS_URL': JSON.stringify(monitoringWsUrl),
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
