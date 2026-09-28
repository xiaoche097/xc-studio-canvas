import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const deepSeekDevProxy = () => ({
  name: 'deepseek-dev-proxy',
  configureServer(server: any) {
    server.middlewares.use('/api/deepseek/chat', async (req: any, res: any) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
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
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          error: { message: error instanceof Error ? error.message : 'DeepSeek proxy failed.' },
        }));
      }
    });
  },
});

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    if (env.DEEPSEEK_API_KEY) {
      process.env.DEEPSEEK_API_KEY = env.DEEPSEEK_API_KEY;
    }
    if (env.DEEPSEEK_BASE_URL) {
      process.env.DEEPSEEK_BASE_URL = env.DEEPSEEK_BASE_URL;
    }
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [deepSeekDevProxy(), react()],
      optimizeDeps: {
        include: ['immer', 'zustand', 'zustand/middleware/immer', 'framer-motion', 'lucide-react']
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        },
        dedupe: ['react', 'react-dom', 'react-router-dom', 'framer-motion', 'lucide-react']
      }
    };
});
