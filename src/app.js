import { route, start } from './router.js';
import { groupsView } from './ui/groups.js';
import { groupView } from './ui/group.js';
import { groupSettingsView } from './ui/group-settings.js';
import { expenseFormView } from './ui/expense-form.js';
import { requestPersist } from './store.js';

route('/', groupsView);
route('/new', (root) => groupSettingsView(root, {}));
route('/g/:id', groupView);
route('/g/:id/settings', groupSettingsView);
route('/g/:id/new', expenseFormView);
route('/g/:id/e/:eid', expenseFormView);
route('/backup', async (root, p) => (await import('./ui/backup-ui.js')).backupView(root, p));

// Optional modules (built in later tasks) — app still runs if missing.
import('./ui/items-editor.js').catch(() => {});
import('./ui/backup-ui.js').then((m) => m.initBackupReminder?.()).catch(() => {});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
}
requestPersist().catch(() => {});
start();
