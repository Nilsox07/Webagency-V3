'use strict';
// Abnahme #8: prices.js (Portal) == Website-Preise (Webagency-V3/pricing.js). Quelle der Wahrheit.
const { test } = require('node:test');
const assert = require('node:assert');
const W = require('../../pricing.js');   // Website-Preisdatei (liegt zwei Ebenen höher)
const P = require('../src/prices');

const pkg = (id) => W.packages.find((p) => p.id === id);
const addon = (id) => W.addons.find((a) => a.id === id);
const care = (id) => W.maintenance.find((m) => m.id === id);

test('Pakete + Extraseite identisch zur Website', () => {
  assert.strictEqual(P.packages.basis.price, pkg('basis').price);
  assert.strictEqual(P.packages.pro.price, pkg('pro').price);
  assert.strictEqual(P.packages.platin.price, pkg('platin').price);
  assert.strictEqual(P.extraPage, W.extraPage.price);
});
test('Care-Preise identisch', () => {
  assert.strictEqual(P.care['care-s'].price, care('care-s').price);
  assert.strictEqual(P.care['care-m'].price, care('care-m').price);
  assert.strictEqual(P.care['care-l'].price, care('care-l').price);
});
test('Extras + SEO identisch (inkl. KI-Assistent + monatlich)', () => {
  assert.strictEqual(P.extras['logo-lite'].price, addon('logo-lite').price);
  assert.strictEqual(P.extras['terminbuchung'].price, addon('terminbuchung').price);
  assert.strictEqual(P.extras['newsletter'].price, addon('newsletter').price);
  assert.strictEqual(P.extras['mehrsprachig'].pct, addon('mehrsprachig').pct);
  assert.strictEqual(P.extras['ki-assistent'].price, addon('ki-assistent').price);
  assert.strictEqual(P.extras['ki-assistent'].monthly, addon('ki-assistent').monthly);
  assert.strictEqual(P.seo['seo-lite'].price, addon('seo-lite').price);
  assert.strictEqual(P.seo['seo-pro'].price, addon('seo-pro').price);
  assert.strictEqual(P.seo['seo-premium'].price, addon('seo-premium').price);
});
