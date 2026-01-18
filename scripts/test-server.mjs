import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..', 'cypress', 'site');
const port = Number(process.env.PORT || 4173);

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.svg') return 'image/svg+xml; charset=utf-8';
  return 'application/octet-stream';
}

function sendJson(res, statusCode, obj) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(JSON.stringify(obj));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(text);
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) return sendText(res, 400, 'bad request');

    if (req.method === 'OPTIONS') return sendText(res, 204, '');

    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    if (req.method === 'POST' && url.pathname === '/publish') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString('utf8');
      let parsed = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = null;
      }
      return sendJson(res, 200, { ok: true, received: parsed });
    }

    if (req.method !== 'GET') return sendText(res, 405, 'method not allowed');

    const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const safePath = path.normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const filePath = path.join(rootDir, safePath);

    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return sendText(res, 404, 'not found');

    const body = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': contentTypeFor(filePath),
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    });
    res.end(body);
  } catch (err) {
    sendText(res, 500, String(err));
  }
});

server.listen(port, () => {
  process.stdout.write(`Test server listening on http://127.0.0.1:${port}\n`);
});

