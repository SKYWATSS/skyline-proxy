// Starts a free Cloudflare tunnel so Skyline gets an https:// URL (service workers need a secure origin).
// - Default: "quick tunnel" -> random https://*.trycloudflare.com URL (changes on every restart).
// - If CF_TUNNEL_TOKEN is set: runs a named tunnel (stable hostname you configured in Cloudflare Zero Trust).
// - TUNNEL=0 disables it entirely.
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, chmodSync, statSync, renameSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';

const state = { url: process.env.PUBLIC_URL || '', status: 'off' };
export const tunnel = state;

function binName() {
  const arch = { x64: 'amd64', arm64: 'arm64', arm: 'arm', ia32: '386' }[process.arch] || 'amd64';
  return `cloudflared-linux-${arch}`;
}

async function ensureBinary(dir) {
  if (process.env.CLOUDFLARED_BIN) return process.env.CLOUDFLARED_BIN;
  const bin = path.join(dir, 'cloudflared');
  if (existsSync(bin) && statSync(bin).size > 1e6) return bin;
  mkdirSync(dir, { recursive: true });
  const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/${binName()}`;
  console.log('[tunnel] downloading cloudflared...');
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(bin + '.tmp'));
  renameSync(bin + '.tmp', bin);
  chmodSync(bin, 0o755);
  return bin;
}

export async function startTunnel(port, dir) {
  if (process.env.TUNNEL === '0') return;
  let bin;
  try { bin = await ensureBinary(dir); }
  catch (e) { state.status = 'error: ' + e.message; return console.error('[tunnel]', e.message); }
  const token = process.env.CF_TUNNEL_TOKEN;
  const args = token
    ? ['tunnel', '--no-autoupdate', 'run', '--token', token]
    : ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`];
  let delay = 5000, errs = 0;
  const run = () => {
    state.status = 'starting';
    const p = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, HOME: process.env.HOME || dir } });
    const onData = buf => {
      const s = buf.toString();
      const m = s.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m && !token && state.url !== m[0]) {
        state.url = m[0];
        console.log(`\n[tunnel] ===== HTTPS URL: ${state.url} =====\n`);
      }
      if (/Registered tunnel connection/.test(s)) { if (state.status !== 'up') console.log('[tunnel] connected'); state.status = 'up'; delay = 5000; }
      if (/ERR /.test(s) && errs++ < 20) console.error('[tunnel]', s.trim().split('\n').filter(l => / ERR /.test(l)).join('\n'));
    };
    p.stdout.on('data', onData);
    p.stderr.on('data', onData);
    p.on('exit', code => {
      state.status = `exited (${code}), retrying`;
      if (!token && !process.env.PUBLIC_URL) state.url = '';
      console.error(`[tunnel] cloudflared exited (${code}); restarting in ${delay / 1000}s`);
      setTimeout(run, delay);
      delay = Math.min(delay * 2, 300000);
    });
    p.on('error', e => console.error('[tunnel]', e.message));
  };
  run();
}
