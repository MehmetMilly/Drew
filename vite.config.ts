import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { isIP } from 'node:net';

export const MAX_FIXTURE_BODY_BYTES = 256 * 1024;

const isLoopback = (address: string | undefined) => {
  if (address === '::1') return true;
  const ipv4 = address?.replace(/^::ffff:/i, '');
  return Boolean(ipv4 && isIP(ipv4) === 4 && ipv4.startsWith('127.'));
};

// Dev only: the capture page POSTs human stroke fixtures here.
export function fixtureSink(): Plugin {
  return {
    name: 'fixture-sink',
    configureServer(server) {
      server.middlewares.use('/__fixtures', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Allow', 'POST');
          return res.end();
        }
        const reject = (status: number, message: string) => {
          res.statusCode = status;
          req.resume();
          res.end(message);
        };
        // LAN play can be opted into with --host; writing the checkout stays local.
        if (!isLoopback(req.socket.remoteAddress)) return reject(403, 'local capture only');
        if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/.test(req.headers.host ?? '')) return reject(403, 'local host required');
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return reject(403, 'bad origin');
        if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? '')) return reject(415, 'use application/json');
        if (Number(req.headers['content-length']) > MAX_FIXTURE_BODY_BYTES) return reject(413, 'fixture too large');
        const chunks: Buffer[] = [];
        let bytes = 0;
        let finished = false;
        req.on('data', (chunk: Buffer) => {
          if (finished) return;
          bytes += chunk.length;
          if (bytes > MAX_FIXTURE_BODY_BYTES) {
            finished = true;
            chunks.length = 0;
            reject(413, 'fixture too large');
          } else chunks.push(chunk);
        });
        req.on('error', () => {
          if (!finished) {
            finished = true;
            chunks.length = 0;
            res.statusCode = 400;
            res.end('incomplete fixture');
          }
        });
        req.on('end', () => {
          if (finished) return;
          finished = true;
          try {
            const body = Buffer.concat(chunks).toString('utf8');
            JSON.parse(body);
            mkdirSync('tests/fixtures/human', { recursive: true });
            const name = `tests/fixtures/human/capture-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            writeFileSync(name, body);
            res.end(name);
          } catch {
            res.statusCode = 400;
            res.end('bad json');
          }
        });
      });
    },
  };
}

export default defineConfig({
  server: { host: '127.0.0.1', port: 5173 },
  plugins: [fixtureSink()],
  build: {
    target: 'es2022',
    rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html') } },
  },
});
