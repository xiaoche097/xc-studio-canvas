import path from 'path';
import fs from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { executeVirseRequest } from './api/virse-core.js';

const ALLOWED_IMAGE_HOST_SUFFIXES = [
  'aiproxy.vip',
  'apilio.ai',
  'pinimg.com',
  'pinterest.com',
  'images.unsplash.com',
  'unsplash.com',
  'xhscdn.com',
  'xiaohongshu.com',
  'cdninstagram.com',
  'fbcdn.net',
  'media-amazon.com',
  'ssl-images-amazon.com',
  'alicdn.com',
  'i.ibb.co',
  'ibb.co',
  'imgur.com',
  'googleusercontent.com',
  'gstatic.com',
  'storage.googleapis.com',
  'cloudfront.net',
];

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

const deepSeekDevProxy = () => ({
  name: 'deepseek-dev-proxy',
  configureServer(server: any) {
    server.middlewares.use('/api/deepseek/chat', async (req: any, res: any) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end(JSON.stringify({ error: { message: 'Method not allowed.' } }));
        return;
      }

      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
        const apiKey = String(
          process.env.DEEPSEEK_API_KEY
          || (typeof payload.apiKey === 'string' ? payload.apiKey : ''),
        ).trim();
        const request = payload.request;
        const rawBaseUrl = String(
          process.env.DEEPSEEK_BASE_URL
          || (typeof payload.baseUrl === 'string' ? payload.baseUrl : '')
          || 'https://api.deepseek.com',
        )
          .trim()
          .replace(/\/+$/, '');
        const parsedBaseUrl = new URL(rawBaseUrl);
        const localHttp = parsedBaseUrl.protocol === 'http:'
          && ['localhost', '127.0.0.1', '::1'].includes(parsedBaseUrl.hostname);

        if (
          !apiKey
          || !request
          || typeof request !== 'object'
          || Array.isArray(request)
          || parsedBaseUrl.username
          || parsedBaseUrl.password
          || (parsedBaseUrl.protocol !== 'https:' && !localHttp)
        ) {
          throw new Error('Invalid DeepSeek API Key, Base URL, or request body.');
        }

        const upstream = await fetch(`${rawBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: request.stream ? 'text/event-stream' : 'application/json',
          },
          body: JSON.stringify(request),
        });

        res.statusCode = upstream.status;
        res.setHeader('Cache-Control', 'no-store');
        const contentType = upstream.headers.get('content-type');
        if (contentType) res.setHeader('Content-Type', contentType);
        if (request.stream && upstream.ok) {
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
          res.setHeader('X-Accel-Buffering', 'no');
          const reader = upstream.body?.getReader();
          if (reader) {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              res.write(Buffer.from(value));
            }
          }
          res.end();
          return;
        }

        res.end(Buffer.from(await upstream.arrayBuffer()));
      } catch (error) {
        res.statusCode = 502;
        res.end(JSON.stringify({
          error: { message: error instanceof Error ? error.message : 'DeepSeek proxy failed.' },
        }));
      }
    });
  },
});

const CLIPPER_EXTENSION_FILENAME = 'xc-ai-clipper-extension.zip';
const CLIPPER_EXTENSION_PATH = path.resolve(
  __dirname,
  'src/modules/Cyzx4/public',
  CLIPPER_EXTENSION_FILENAME,
);

const clipperExtensionAssetPlugin = () => ({
  name: 'xc-ai-clipper-extension-asset',
  configureServer(server: any) {
    server.middlewares.use(`/${CLIPPER_EXTENSION_FILENAME}`, (_req: any, res: any, next: () => void) => {
      if (!fs.existsSync(CLIPPER_EXTENSION_PATH)) {
        next();
        return;
      }

      const stat = fs.statSync(CLIPPER_EXTENSION_PATH);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Length', String(stat.size));
      res.setHeader('Content-Disposition', `attachment; filename="${CLIPPER_EXTENSION_FILENAME}"`);
      fs.createReadStream(CLIPPER_EXTENSION_PATH).pipe(res);
    });
  },
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: CLIPPER_EXTENSION_FILENAME,
      source: fs.readFileSync(CLIPPER_EXTENSION_PATH),
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
    if (env.FREEIMAGE_API_KEY) {
      process.env.FREEIMAGE_API_KEY = env.FREEIMAGE_API_KEY;
    }
    if (env.DEEPSEEK_API_KEY) {
      process.env.DEEPSEEK_API_KEY = env.DEEPSEEK_API_KEY;
    }
    if (env.DEEPSEEK_BASE_URL) {
      process.env.DEEPSEEK_BASE_URL = env.DEEPSEEK_BASE_URL;
    }
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: process.env.BACKEND_PROXY_URL || 'http://127.0.0.1:8081',
            changeOrigin: true,
            secure: false,
          },
        },
      },
      plugins: [react(), deepSeekDevProxy(), clipperExtensionAssetPlugin(), localImageDownloadPlugin(), localVirsePlugin()],
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
          '@': path.resolve(__dirname, 'src'),
          'react': path.resolve(__dirname, 'node_modules/react'),
          'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
        },
        dedupe: ['react', 'react-dom'],
      }
    };
});
