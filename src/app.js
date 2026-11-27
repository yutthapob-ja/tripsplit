import { route, start } from './router.js';
import { groupsView } from './ui/groups.js';
import { groupView } from './ui/group.js';
import { groupSettingsView } from './ui/group-settings.js';
import { expenseFormView } from './ui/expense-form.js';
import { requestPersist } from './store.js';
import './ui/items-editor.js';
import { backupView, initBackupReminder } from './ui/backup-ui.js';
import { h } from './ui/dom.js';

route('/', groupsView);
route('/new', (root) => groupSettingsView(root, {}));
route('/g/:id', groupView);
route('/g/:id/settings', groupSettingsView);
route('/g/:id/new', expenseFormView);
route('/g/:id/e/:eid', expenseFormView);
route('/backup', backupView);

initBackupReminder();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || document.getElementById('update-bar')) return;
    document.body.append(h('button.update-bar', { id: 'update-bar', type: 'button', on: { click: () => location.reload() } },
      '✨ มีเวอร์ชันใหม่ — แตะเพื่อโหลดใหม่'));
  });
}
requestPersist().catch(() => {});
start();
