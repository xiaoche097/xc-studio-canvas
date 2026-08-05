import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const ALLOWED_IMAGE_HOST_SUFFIXES = ['aiproxy.vip', 'apilio.ai'];

const isAllowedImageUrl = (value: string | null): value is string => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_IMAGE_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
};

const localImageDownloadPlugin = () => ({
  name: 'local-image-download-proxy',
  configureServer(server: any) {
    server.middlewares.use('/api/image-download', async (req: any, res: any) => {
      const requestUrl = new URL(req.url || '/', 'http://localhost');
      const remoteUrl = requestUrl.searchParams.get('url');
      if (!isAllowedImageUrl(remoteUrl)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Invalid or unsupported image URL' }));
        return;
      }

      try {
        const upstream = await fetch(remoteUrl, { signal: AbortSignal.timeout(30000) });
        const contentType = upstream.headers.get('content-type') || '';
        if (!upstream.ok || !contentType.toLowerCase().startsWith('image/')) {
          res.statusCode = upstream.ok ? 415 : upstream.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `Upstream image request failed: ${upstream.status}` }));
          return;
        }

        const data = new Uint8Array(await upstream.arrayBuffer());
        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', String(data.byteLength));
        res.setHeader('Content-Disposition', 'attachment; filename="generated-image.png"');
        res.end(data);
      } catch (error) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Image proxy failed' }));
      }
    });
  },
});

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), localImageDownloadPlugin()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY)
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
