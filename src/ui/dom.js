/** h('div.class', {attrs, on:{click}}, ...children) */
export function h(tag, props, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
    children.unshift(props);
    props = null;
  }
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

export function header(title, { back, actions = [] } = {}) {
  return h('header.bar',
    back ? h('a.icon-btn', { href: back, 'aria-label': 'กลับ' }, '‹') : h('span.icon-btn.ghost'),
    h('h1', title),
    h('div.bar-actions', actions));
}

export function confirmBox(msg) {
  return Promise.resolve(window.confirm(msg));
}

const AVATAR_COLORS = ['#FF8A65', '#4FC3F7', '#9575CD', '#4DB6AC', '#F06292', '#FFB74D', '#7986CB', '#81C784', '#BA68C8', '#4DD0E1'];
/** Colored initial bubble; color is stable per member id. */
export function avatar(member, size = 36) {
  const key = String(member.id || member.name || '?');
  let hsh = 0;
  for (const ch of key) hsh = (hsh * 31 + ch.codePointAt(0)) >>> 0;
  const name = (member.name || '?').trim();
  return h('span.avatar', {
    style: `--av:${AVATAR_COLORS[hsh % AVATAR_COLORS.length]};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.42)}px`,
    'aria-hidden': 'true',
  }, Array.from(name.replace(/^[เแโใไ]+/, ''))[0] || Array.from(name)[0] || '?');
}

export function avatarStack(members, max = 4) {
  return h('span.avatar-stack', members.slice(0, max).map((m) => avatar(m, 26)),
    members.length > max ? h('span.avatar.more', { style: 'width:26px;height:26px;font-size:11px' }, `+${members.length - max}`) : null);
}
