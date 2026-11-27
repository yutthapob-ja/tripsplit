const routes = [];

export function route(pattern, view) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
  routes.push({ re, keys, view });
}

export async function render() {
  const path = location.hash.replace(/^#/, '') || '/';
  const root = document.getElementById('app');
  for (const r of routes) {
    const m = path.match(r.re);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    root.replaceChildren();
    window.scrollTo(0, 0);
    try {
      await r.view(root, params);
    } catch (err) {
      console.error(err);
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
