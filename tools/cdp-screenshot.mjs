// node tools/cdp-screenshot.mjs <port> <outfile>
import { writeFileSync } from 'fs';
const port = process.argv[2];
const outfile = process.argv[3];

async function main() {
  const listRes = await fetch(`http://localhost:${port}/json/list`);
  const targets = await listRes.json();
  const page = targets.find(t => t.type === 'page') || targets[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

  const result = await new Promise((resolve, reject) => {
    const id = 1;
    const timer = setTimeout(() => reject(new Error('timeout')), 20000);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) { clearTimeout(timer); resolve(msg.result); }
    };
    ws.send(JSON.stringify({ id, method: 'Page.captureScreenshot', params: { format: 'png' } }));
  });
  ws.close();
  writeFileSync(outfile, Buffer.from(result.data, 'base64'));
  console.log('saved to', outfile);
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
