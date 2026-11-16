// Skyline Proxy server: static UI + Ultraviolet assets + Wisp websocket endpoint.
import express from 'express';
import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import { server as wisp, logging } from '@mercuryworkshop/wisp-js/server';
import Unblocker from 'unblocker';
import { tunnel, startTunnel } from './tunnel.js';
const unblocker = new Unblocker({ prefix: '/unblocker/' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const PASSWORD = process.env.ACCESS_PASSWORD || '';
const TOKEN = PASSWORD ? createHash('sha256').update('skyline:' + PASSWORD).digest('hex') : '';
logging.set_level(logging.WARN);
// Block LAN / cloud-metadata targets. ALLOW_PRIVATE_IPS=1 only for sandboxes whose DNS returns fake private IPs.
wisp.options.allow_private_ips = process.env.ALLOW_PRIVATE_IPS === '1';
wisp.options.allow_loopback_ips = false;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(rateLimit({ windowMs: 60_000, limit: Number(process.env.RATE_LIMIT || 600), standardHeaders: 'draft-7', legacyHeaders: false }));

const authed = req => !PASSWORD || (req.cookies?.skyline_auth && req.cookies.skyline_auth.length === TOKEN.length &&
  timingSafeEqual(Buffer.from(req.cookies.skyline_auth), Buffer.from(TOKEN)));

app.get('/healthz', (_q, r) => r.send('ok'));
// Current https URL (from the Cloudflare tunnel) so it can be found from the plain-http address.
app.get('/tunnel-url', (_q, r) => r.json({ url: tunnel.url, status: tunnel.status }));
// Plain-http visitors (direct IP:port) can't run service workers -> send them to the https tunnel.
// Requests that came through Cloudflare carry cf-ray, so they are never redirected (no loop).
app.use((req, res, next) => {
  if (process.env.TUNNEL_REDIRECT !== '0' && tunnel.url && !req.headers['cf-ray'] && req.method === 'GET' &&
      req.protocol === 'http' && !/^\/(healthz|tunnel-url|wisp\/)/.test(req.path))
    return res.redirect(302, tunnel.url + req.originalUrl);
  next();
});
app.get('/login', (_q, r) => r.sendFile(path.join(__dirname, 'public/login.html')));
app.post('/login', rateLimit({ windowMs: 15 * 60_000, limit: 20 }), (req, res) => {
  if (PASSWORD && req.body.password === PASSWORD) {
    res.cookie('skyline_auth', TOKEN, { httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: 30 * 864e5 });
    return res.redirect('/');
  }
  res.redirect('/login?bad=1');
});
app.use((req, res, next) => {
  if (authed(req) || /^\/(login|style\.css|manifest\.json|icon\.svg)/.test(req.path)) return next();
  res.redirect('/login');
});
app.use('/uv/', express.static(path.join(__dirname, 'public/uv')));
app.use('/uv/', express.static(uvPath));
app.use('/baremux/', express.static(path.join(__dirname, 'node_modules/@mercuryworkshop/bare-mux/dist')));
app.use('/epoxy/', express.static(path.join(__dirname, 'node_modules/@mercuryworkshop/epoxy-transport/dist')));
app.use('/sj/', express.static(path.join(__dirname, 'public/sj')));
app.use('/sj/', express.static(path.join(__dirname, 'node_modules/@mercuryworkshop/scramjet/dist')));
app.use(unblocker);                                   // node-unblocker fallback engine (server-side rewriting)
app.use('/gust/', express.static(path.join(__dirname, 'engines/gust')));  // GUST (AGPL-3.0, Nautilus Labs), static single file
app.get('/config.json', (_q, r) => r.json({ daydreamxUrl: process.env.DAYDREAMX_URL || '' }));
app.use('/LICENSES/', express.static(path.join(__dirname, 'LICENSES')));
app.use(express.static(path.join(__dirname, 'public')));

const server = createServer(app);
server.on('upgrade', (req, socket, head) => {
  const c = Object.fromEntries((req.headers.cookie || '').split(';').map(s => s.trim().split('=')));
  if (PASSWORD && c.skyline_auth !== TOKEN) return socket.destroy();
  if (req.url.startsWith('/wisp/')) return wisp.routeRequest(req, socket, head);
  if (req.url.startsWith('/unblocker/')) return unblocker.onUpgrade(req, socket, head);
  socket.destroy();
});
server.listen(PORT, () => {
  console.log(`Skyline Proxy on :${PORT}${PASSWORD ? ' (password on)' : ''}`);
  startTunnel(PORT, path.join(__dirname, '.cloudflared'));
});
