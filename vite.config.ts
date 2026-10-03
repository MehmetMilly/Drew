import { defineConfig, Plugin } from 'vite';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

// Dev only: the capture page POSTs human stroke fixtures here.
function fixtureSink(): Plugin {
  return {
    name: 'fixture-sink',
    configureServer(server) {
      server.middlewares.use('/__fixtures', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return res.end();
        }
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          try {
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
  server: { host: true, port: 5173 },
  plugins: [fixtureSink()],
  build: {
    target: 'es2022',
    rollupOptions: { input: { main: resolve(__dirname, 'index.html') } },
  },
});
