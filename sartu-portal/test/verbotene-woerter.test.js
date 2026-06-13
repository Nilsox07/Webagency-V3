'use strict';
// Abnahme #12: keine verbotenen Marketing-Wörter (rechtssicher/abmahnsicher/geprüft als Claim).
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

function walk(dir, acc) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (f !== 'node_modules') walk(p, acc); }
    else if (/\.(ejs|js|css|md)$/.test(f)) acc.push(p);
  }
  return acc;
}

test('Keine verbotenen Marketing-Wörter in Views/Code', () => {
  const root = path.join(__dirname, '..');
  const files = ['src', 'public'].flatMap((d) => walk(path.join(root, d), []));
  const forbidden = /(rechtssicher|abmahnsicher|gepr(ü|ue)fte?\s+(sicherheit|qualit))/i;
  const treffer = [];
  for (const f of files) { if (forbidden.test(fs.readFileSync(f, 'utf8'))) treffer.push(path.relative(root, f)); }
  assert.deepStrictEqual(treffer, [], 'Verbotene Wörter in: ' + treffer.join(', '));
});
