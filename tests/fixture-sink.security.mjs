// Run with Node 22.13+: node --test tests/fixture-sink.security.mjs.
// Load the actual Vite config without installing or executing Vite. Only its
// defineConfig identity wrapper is replaced; the endpoint and filesystem run normally.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const configFile = fileURLToPath(new URL('../vite.config.ts', import.meta.url));
const source = await readFile(configFile, 'utf8');
const viteImport = /import \{[^}]+\} from 'vite';/;
assert.match(source, viteImport);
const isolatedSource = source.replace(viteImport, 'const defineConfig = config => config;')
  .replaceAll('import.meta.dirname', JSON.stringify(dirname(configFile)));
const { default: config, MAX_FIXTURE_BODY_BYTES } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(isolatedSource, { mode: 'strip' })).toString('base64')}`);
let handle;
config.plugins[0].configureServer({ middlewares: { use(route, middleware) { assert.equal(route, '/__fixtures'); handle = middleware; } } });

function request({ remoteAddress = '127.0.0.1', method = 'POST', headers = {}, chunks = ['{}'], error = false } = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.socket = { remoteAddress };
  req.headers = { host: '127.0.0.1:5173', 'content-type': 'application/json', ...headers };
  req.resume = () => {};
  const response = { statusCode: 200, headers: {}, ends: 0, setHeader(name, value) { this.headers[name] = value; }, end(body) { this.ends++; this.body = body; } };
  handle(req, response);
  for (const chunk of chunks) req.emit('data', Buffer.from(chunk));
  if (error) req.emit('error', new Error('connection interrupted'));
  req.emit('end');
  return response;
}

await test('fixture capture security boundaries preserve valid local writes', async t => {
  const previous = process.cwd();
  const directory = await mkdtemp(join(tmpdir(), 'drew-fixture-security-'));
  process.chdir(directory);
  try {
    await t.test('development binds loopback by default', () => {
      assert.equal(config.server.host, '127.0.0.1');
    });
    await t.test('rejects a LAN client even with a forged local origin', () => {
      assert.equal(request({ remoteAddress: '192.168.1.10', headers: { origin: 'http://127.0.0.1:5173' } }).statusCode, 403);
    });
    await t.test('rejects foreign/null origins and rebinding hostnames', () => {
      for (const origin of ['https://evil.invalid', 'null', 'http://127.0.0.1:5174']) assert.equal(request({ headers: { origin } }).statusCode, 403);
      assert.equal(request({ headers: { host: 'evil.invalid:5173', origin: 'http://evil.invalid:5173' } }).statusCode, 403);
    });
    await t.test('rejects non-JSON and non-POST requests', () => {
      for (const type of ['', 'text/plain', 'application/jsonp']) assert.equal(request({ headers: { 'content-type': type } }).statusCode, 415);
      const response = request({ method: 'GET' });
      assert.equal(response.statusCode, 405);
      assert.equal(response.headers.Allow, 'POST');
    });
    await t.test('rejects oversized declared and chunked bodies once, including multibyte data', () => {
      assert.equal(request({ headers: { 'content-length': String(MAX_FIXTURE_BODY_BYTES + 1) } }).statusCode, 413);
      for (const chunks of [['x'.repeat(MAX_FIXTURE_BODY_BYTES), 'x', 'x'], ['é'.repeat(MAX_FIXTURE_BODY_BYTES / 2), 'é']]) {
        const response = request({ chunks });
        assert.equal(response.statusCode, 413);
        assert.equal(response.ends, 1);
      }
    });
    await t.test('rejects malformed and interrupted JSON without writing files', async () => {
      assert.equal(request({ chunks: ['{broken'] }).statusCode, 400);
      const response = request({ error: true });
      assert.equal(response.statusCode, 400);
      assert.equal(response.ends, 1);
      assert.deepEqual(await readdir(directory), []);
    });
    await t.test('keeps same-origin JSON capture and supported loopback address forms working', async () => {
      const body = JSON.stringify({ device: 'audit-test', date: '2026-10-25T00:00:00Z', strokes: [], joins: [] });
      for (const remoteAddress of ['127.0.0.1', '127.0.0.2', '::1', '::ffff:127.0.0.1']) {
        const response = request({ remoteAddress, headers: { origin: 'http://127.0.0.1:5173', 'content-type': 'application/json; charset=utf-8' }, chunks: [body.slice(0, 12), body.slice(12)] });
        assert.equal(response.statusCode, 200);
        assert.equal(await readFile(response.body, 'utf8'), body);
      }
      const response = request({ chunks: [' '.repeat(MAX_FIXTURE_BODY_BYTES - 2), '{}'] });
      assert.equal(response.statusCode, 200);
      assert.equal(Buffer.byteLength(await readFile(response.body, 'utf8')), MAX_FIXTURE_BODY_BYTES);
    });
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true });
  }
});
