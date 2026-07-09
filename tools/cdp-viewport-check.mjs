// node tools/cdp-viewport-check.mjs <port> <width> <height> <expression>
const port = process.argv[2];
const width = parseInt(process.argv[3], 10);
const height = parseInt(process.argv[4], 10);
const expr = process.argv[5];

async function main() {
  const listRes = await fetch(`http://localhost:${port}/json/list`);
  const targets = await listRes.json();
  const page = targets.find(t => t.type === 'page') || targets[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

  let id = 1;
  function send(method, params) {
    return new Promise((resolve, reject) => {
      const myId = id++;
      const timer = setTimeout(() => reject(new Error('timeout: ' + method)), 20000);
      const handler = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id === myId) {
          clearTimeout(timer);
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: myId, method, params }));
    });
  }

  await send('Emulation.setDeviceMetricsOverride', {
    width, height, screenWidth: width, screenHeight: height,
    deviceScaleFactor: 1, mobile: false,
  });
  await new Promise(r => setTimeout(r, 400));

  const result = await send('Runtime.evaluate', {
    expression: expr, awaitPromise: true, returnByValue: true,
  });

  if (result.exceptionDetails) {
    console.error('EXCEPTION:', JSON.stringify(result.exceptionDetails, null, 2));
  } else {
    console.log(JSON.stringify(result.result?.value, null, 2));
  }

  await send('Emulation.clearDeviceMetricsOverride', {}).catch(() => {});
  ws.close();
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
