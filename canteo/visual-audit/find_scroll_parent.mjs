const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
import('node:child_process').then(({ spawn }) => {
  const edge = spawn(edgePath, ['--headless', '--remote-debugging-port=9333', '--disable-gpu', 'http://127.0.0.1:5173/app?tab=synclab']);
  setTimeout(async () => {
    try {
      const targets = await (await fetch('http://127.0.0.1:9333/json/list')).json();
      const target = targets.find(t => t.type === 'page' && t.url.includes('synclab'));
      const ws = new WebSocket(target.webSocketDebuggerUrl);
      ws.onopen = () => {
        ws.send(JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: {
            expression: `(() => {
              let el = document.querySelector('.sl-step-explanation-card');
              const parents = [];
              while (el) {
                const style = window.getComputedStyle(el);
                if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                  parents.push({ tag: el.tagName, className: el.className, overflowY: style.overflowY });
                }
                el = el.parentElement;
              }
              return parents;
            })()`,
            returnByValue: true
          }
        }));
      };
      ws.onmessage = ({ data }) => {
        console.log(JSON.stringify(JSON.parse(data).result.result.value, null, 2));
        edge.kill();
        process.exit(0);
      };
    } catch (e) {
      console.error(e);
      edge.kill();
    }
  }, 1200);
});

