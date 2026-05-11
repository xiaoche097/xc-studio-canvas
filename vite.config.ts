import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (!id.includes('node_modules')) {
                return;
              }

              if (
                id.includes('\\node_modules\\react\\') ||
                id.includes('/node_modules/react/') ||
                id.includes('\\node_modules\\react-dom\\') ||
                id.includes('/node_modules/react-dom/') ||
                id.includes('\\node_modules\\scheduler\\') ||
                id.includes('/node_modules/scheduler/')
              ) {
                return 'react-vendor';
              }

              if (id.includes('framer-motion')) {
                return 'motion-vendor';
              }

              if (
                id.includes('@google') ||
                id.includes('\\node_modules\\ai\\') ||
                id.includes('/node_modules/ai/') ||
                id.includes('\\node_modules\\@ai-sdk\\') ||
                id.includes('/node_modules/@ai-sdk/')
              ) {
                return 'ai-vendor';
              }
            }
          }
        }
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
