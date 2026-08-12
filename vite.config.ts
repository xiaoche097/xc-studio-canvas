import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { executeVirseRequest } from './api/virse-core.js';

const ALLOWED_IMAGE_HOST_SUFFIXES = ['aiproxy.vip', 'apilio.ai'];

const isVirseStorageUrl = (parsed: URL) => (
  parsed.hostname.toLowerCase() === 'storage.googleapis.com'
  && parsed.pathname.startsWith('/virse-images/')
);

const isAllowedImageUrl = (value: string | null): value is string => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    return isVirseStorageUrl(parsed)
      || ALLOWED_IMAGE_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
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

const localVirsePlugin = () => ({
  name: 'local-virse-mcp-proxy',
  configureServer(server: any) {
    server.middlewares.use('/api/virse', (req: any, res: any) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }
      let raw = '';
      req.on('data', (chunk: Buffer) => { raw += chunk.toString('utf8'); });
      req.on('end', async () => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        try {
          const result = await executeVirseRequest(JSON.parse(raw || '{}'));
          res.statusCode = 200;
          res.end(JSON.stringify(result));
        } catch (error) {
          res.statusCode = Number((error as any)?.status) || 502;
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Virse request failed' }));
        }
      });
    });
  },
});

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // Server-only: make the local Vite middleware behave like the Vercel
    // Function without exposing the ImgBB key to browser bundles.
    if (env.IMGBB_API_KEY) {
      process.env.IMGBB_API_KEY = env.IMGBB_API_KEY;
    }
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), localImageDownloadPlugin(), localVirsePlugin()],
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
