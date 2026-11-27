import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serialize, parseBackup, backupFilename, SCHEMA_VERSION } from '../src/core/backup.js';

const sample = {
  groups: [{ id: 'g1', name: 'ญี่ปุ่น', kind: 'trip', members: [{ id: 'm1', name: 'A' }], rates: { JPY: 0.23 } }],
  expenses: [{ id: 'e1', groupId: 'g1', title: 'ราเมน' }],
  settlements: [{ id: 's1', groupId: 'g1' }],
};

test('serialize -> parseBackup round-trips data', () => {
  const text = serialize(sample);
  const meta = JSON.parse(text);
  assert.equal(meta.app, 'TripSplit');
  assert.equal(meta.schemaVersion, SCHEMA_VERSION);
  assert.ok(meta.exportedAt);
  const r = parseBackup(text);
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, sample);
});

test('broken JSON -> ok:false with Thai error', () => {
  const r = parseBackup('{not json');
  assert.equal(r.ok, false);
  assert.equal(typeof r.error, 'string');
  assert.match(r.error, /[฀-๿]/);
});

test("app 'Other' -> ok:false", () => {
  const o = JSON.parse(serialize(sample));
  o.app = 'Other';
  assert.equal(parseBackup(JSON.stringify(o)).ok, false);
});

test('schemaVersion 2 -> ok:false, newer-version message', () => {
  const o = JSON.parse(serialize(sample));
  o.schemaVersion = 2;
  const r = parseBackup(JSON.stringify(o));
  assert.equal(r.ok, false);
  assert.ok(r.error.includes('ไฟล์มาจากเวอร์ชันใหม่กว่า'));
});

test('missing groups -> ok:false', () => {
  const o = JSON.parse(serialize(sample));
  delete o.groups;
  assert.equal(parseBackup(JSON.stringify(o)).ok, false);
});

test('non-object / null JSON never throws', () => {
  assert.equal(parseBackup('null').ok, false);
  assert.equal(parseBackup('42').ok, false);
});

test('backupFilename uses local date', () => {
  assert.equal(backupFilename(new Date(2026, 10, 27)), 'tripsplit-backup-2026-11-27.json');
});

test('parseBackup rejects null records, missing ids and orphan groupIds', async () => {
  const { parseBackup } = await import('../src/core/backup.js');
  const wrap = (o) => JSON.stringify({ app: 'TripSplit', schemaVersion: 1, groups: [], expenses: [], settlements: [], ...o });
  assert.equal(parseBackup(wrap({ groups: [null] })).ok, false);
  assert.equal(parseBackup(wrap({ groups: [{ name: 'x', members: [] }] })).ok, false);
  assert.equal(parseBackup(wrap({ groups: [{ id: 'g', name: 'x' }] })).ok, false);
  assert.equal(parseBackup(wrap({ groups: [{ id: 'g', members: [] }], expenses: [{ id: 'e', groupId: 'nope' }] })).ok, false);
  assert.equal(parseBackup(wrap({ groups: [{ id: 'g', members: [] }], settlements: [{ id: 's', groupId: 'nope' }] })).ok, false);
  assert.equal(parseBackup(wrap({ schemaVersion: -1 })).ok, false);
  assert.equal(parseBackup(wrap({ groups: [{ id: 'g', members: [] }], expenses: [{ id: 'e', groupId: 'g' }] })).ok, true);
});
