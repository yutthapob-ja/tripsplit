const routes = [];

export function route(pattern, view) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
  routes.push({ re, keys, view });
}

let renderSeq = 0;

export async function render() {
  const token = ++renderSeq;
  const path = location.hash.replace(/^#/, '') || '/';
  const root = document.getElementById('app');
  for (const r of routes) {
    const m = path.match(r.re);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    root.replaceChildren();
    window.scrollTo(0, 0);
    // build off-document so a slow, superseded view can never touch #app
    const host = document.createElement('div');
    try {
      const result = await r.view(host, params);
      if (token !== renderSeq) return;
      root.replaceChildren(...host.childNodes);
      if (result && 'hasData' in result) {
        window.dispatchEvent(new CustomEvent('tripsplit:view', { detail: { root, hasData: result.hasData } }));
      }
      result?.afterMount?.();
    } catch (err) {
      console.error(err);
      if (token !== renderSeq) return;
      root.replaceChildren(Object.assign(document.createElement('p'), { className: 'empty', textContent: 'เกิดข้อผิดพลาด: ' + err.message }));
    }
    return;
  }
  location.hash = '#/';
}

export function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

export function start() {
  window.addEventListener('hashchange', render);
  render();
}
