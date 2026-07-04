// Minimal CDP client: node tools/cdp.mjs <port> <expression>
// Uses native WebSocket (Node 22+) - no deps.
const port = process.argv[2];
const expr = process.argv[3];

async function main() {
  const listRes = await fetch(`http://localhost:${port}/json/list`);
  const targets = await listRes.json();
  const page = targets.find(t => t.type === 'page') || targets[0];
  if (!page) throw new Error('No page target found on port ' + port);
  const ws = new WebSocket(page.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const result = await new Promise((resolve, reject) => {
    const id = 1;
    const timer = setTimeout(() => reject(new Error('timeout')), 20000);
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) {
        clearTimeout(timer);
        resolve(msg.result);
      }
    };
    ws.send(JSON.stringify({
      id,
      method: 'Runtime.evaluate',
      params: { expression: expr, awaitPromise: true, returnByValue: true }
    }));
  });

  ws.close();

  if (result.exceptionDetails) {
    console.error('EXCEPTION:', JSON.stringify(result.exceptionDetails, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(result.result?.value, null, 2));
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
