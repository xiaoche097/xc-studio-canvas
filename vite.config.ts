import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const allowedGeminiProxyHosts = new Set([
  'yunwu.ai',
  'api.apiplus.org',
  'api3.wlai.vip',
  'api.zhongzhuan.chat',
  'api.bltcy.ai',
  'api.rcouyi.com',
  'us.rcouyi.com',
  'us-1.rcouyi.com',
  'us-2.rcouyi.com',
  'us-3.rcouyi.com',
  'hk-2.rcouyi.com',
  'sgp.rcouyi.com',
  'jp.rcouyi.com',
]);

const readDevRequestBody = (req: import('http').IncomingMessage): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const normalizeGeminiProxyTarget = (target?: string | string[]): string => {
  const targetValue = Array.isArray(target) ? target[0] : target;
  if (!targetValue) {
    throw new Error('Missing X-Gemini-Proxy-Target header.');
  }

  const url = new URL(targetValue);
  if (url.protocol !== 'https:' || !allowedGeminiProxyHosts.has(url.hostname)) {
    throw new Error(`Proxy target is not allowed: ${url.hostname}`);
  }

  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        {
          name: 'gemini-dev-proxy',
          configureServer(server) {
            server.middlewares.use('/api/gemini', async (req, res) => {
              try {
                const targetBaseUrl = normalizeGeminiProxyTarget(req.headers['x-gemini-proxy-target']);
                const requestUrl = new URL(req.url || '/', 'http://localhost');
                const upstreamUrl = `${targetBaseUrl}${requestUrl.pathname}${requestUrl.search}`;
                const headers = new Headers();

                for (const [key, value] of Object.entries(req.headers)) {
                  const lowerKey = key.toLowerCase();
                  if (
                    lowerKey === 'host' ||
                    lowerKey === 'content-length' ||
                    lowerKey === 'x-gemini-proxy-target' ||
                    lowerKey.startsWith('x-forwarded-')
                  ) {
                    continue;
                  }

                  if (Array.isArray(value)) {
                    headers.set(key, value.join(','));
                  } else if (value) {
                    headers.set(key, value);
                  }
                }

                const body = req.method === 'GET' || req.method === 'HEAD'
                  ? undefined
                  : await readDevRequestBody(req);
                const upstreamResponse = await fetch(upstreamUrl, {
                  method: req.method,
                  headers,
                  body,
                });

                res.statusCode = upstreamResponse.status;
                upstreamResponse.headers.forEach((value, key) => {
                  if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(key.toLowerCase())) {
                    res.setHeader(key, value);
                  }
                });
                res.end(Buffer.from(await upstreamResponse.arrayBuffer()));
              } catch (error: any) {
                res.statusCode = 502;
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify({ error: { message: error?.message || 'Gemini proxy request failed.' } }));
              }
            });
          },
        },
      ],
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
