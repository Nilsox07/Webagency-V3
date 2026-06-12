import io
f = 'briefing.js'
s = open(f, encoding='utf-8').read()
pairs = []
def add(old, new, label):
    pairs.append((old, new, label))

add(
"""      var b = el('button', 'lb-path-card'); b.type = 'button';
      b.innerHTML = '<span class="lb-path-icon" aria-hidden="true">\U0001F3A8</span>' +
        '<span class="lb-path-title">Nur ein Design — ich setze selbst um</span>' +
        '<span class="lb-path-sub">Du bekommst den fertigen Look als HTML/CSS-Code.</span>';
      b.addEventListener('click', function () { A.produkt_typ = 'design'; A.pfad = 'B'; goTo('d_branche'); });""",
"""      var b = el('button', 'lb-path-card'); b.type = 'button';
      b.innerHTML = '<span class="lb-path-icon" aria-hidden="true">\U0001F504</span>' +
        '<span class="lb-path-title">Website-Redesign — meine bestehende Seite neu machen</span>' +
        '<span class="lb-path-sub">Wir übernehmen deine Inhalte — du musst fast nichts liefern.</span>';
      b.addEventListener('click', function () { A.produkt_typ = 'redesign'; A.pfad = 'B'; if (A.material.indexOf('website') < 0) A.material.push('website'); goTo('branche'); });""",
"intentB")

add(
"""
    /* ---------- Design-Pfad · 1 · Branche ---------- */
    d_branche: { step: null, render: function () {
      var h = lumiSays('Aus welcher Branche kommst du?',
        'Hilft uns, den passenden Stil vorzuschlagen.');
      buildCards('branche', OPT.branche, { cls: 'lb-tiles', onPick: function () {} });
      actions({ onBack: back, onNext: function () { goTo('design'); }, skip: function () { goTo('design'); } });
      return h;
    }},

    /* ---------- Design-Pfad · 3 · Umfang ---------- */
    d_umfang: { step: null, render: function () {
      var h = lumiSays('Wie groß soll dein Design sein?',
        'Den Preis siehst du unten — es entsteht kein Vertrag.');
      buildCards('design_umfang', [
        { value: 'onepager', label: 'Onepager-Design', sub: '1 Seite · ' + fmtEUR(designPriceFor('onepager')) },
        { value: 'mehrseiten', label: 'Mehrseiten-Design', sub: 'bis 8 Seitentypen · ' + fmtEUR(designPriceFor('mehrseiten')) },
      ], { onPick: function () { showPriceBar(true); renderPriceBar(); } });
      showPriceBar(true); renderPriceBar();
      actions({ onBack: back, onNext: function () { goTo('contact'); } });
      return h;
    }},
""", "\n", "d_screens")

add(
"""  /* ---- „Nur Design"-Pfad ---- */
  function isDesign() { return A.produkt_typ === 'design'; }
  function designProductFor(umfang) {
    var list = PRICING.designProducts || [];
    var id = umfang === 'mehrseiten' ? 'design-mehrseiten' : 'design-onepager';
    return list.filter(function (d) { return d.id === id; })[0] || list[0] || null;
  }
  function designPriceFor(umfang) { var d = designProductFor(umfang); return d ? d.price : 0; }
  function currentDesign() { return designProductFor(A.design_umfang || 'onepager'); }
  // Upsell: Differenz zum passenden Paket (Onepager→Start, Mehrseiten→Wachstum), dynamisch aus pricing.js
  function designUpsell() {
    var d = currentDesign();
    var p = pkgById(A.design_umfang === 'mehrseiten' ? 'pro' : 'basis');
    if (!d || !p || typeof p.price !== 'number') return null;
    return { diff: Math.max(0, p.price - d.price), paketName: p.name };
  }
""", "", "designfuncs")

add("    if (A.pfad === 'B' && !isDesign() && step && step >= 2) {",
    "    if (A.pfad === 'B' && step && step >= 2) {", "guard217")

add(
"""    // Design-Pfad: nur Einmalbetrag, keine Monatszeile
    if (isDesign()) {
      priceBar.classList.remove('is-enterprise');
      var dp = currentDesign();
      sums.innerHTML = '<div class="lb-sum"><span>Einmalig</span><strong>' + fmtEUR(dp ? dp.price : 0) + '</strong></div>';
      if (toggle) toggle.style.visibility = 'hidden';
      return;
    }
""", "", "pricebar")

add(
"""      } else if (isDesign()) {
        var dp = currentDesign();
        recap.innerHTML =
          '<span><strong>' + (dp ? dp.name : 'Design') + '</strong></span>' +
          '<span class="lb-recap-sums">Einmalig <strong>' + fmtEUR(dp ? dp.price : 0) + '</strong> · 50 % bei Auftrag, 50 % bei Lieferung</span>';
      } else {""",
"""      } else {""", "recap")

add(
"""      // Design-Pfad: Upsell-Zeile (dynamische Differenz zum passenden Paket)
      if (isDesign()) {
        var up = designUpsell();
        if (up) {
          var ups = el('p', 'lb-design-upsell');
          ups.innerHTML = 'Übrigens: Für <strong>' + fmtEUR(up.diff) + '</strong> mehr bekommst du beim ' +
            up.paketName + '-Paket die fertige Website — inklusive aller Texte, online gebracht und rundum betreut.';
          stage.appendChild(ups);
        }
      }

      var form""", """      var form""", "upsell")

add(
"""      var terms = isDesign()
        ? [{ pct: 50, when: 'bei Auftrag' }, { pct: 50, when: 'bei Lieferung' }]
        : PAY.forPackage(A.paket_gewaehlt);""",
"""      var terms = PAY.forPackage(A.paket_gewaehlt);""", "payterms")

add(
"""    // Design-Pfad: schlanke Zusammenfassung (kein Paket/Care)
    if (isDesign()) {
      var dbr = labelFor('branche', A.branche);
      if (A.branche === 'sonstiges' && A.branche_sonstiges) dbr += ' (' + A.branche_sonstiges + ')';
      rows.push({ k: 'Branche', v: dbr || '—', screen: 'd_branche' });
      var dstil = labelFor('stil', A.stil);
      var dfarben = [colorLabel(A.hauptfarbe), colorLabel(A.nebenfarbe)].filter(Boolean).join(' + ');
      if (dfarben) dstil += (dstil ? ' · ' : '') + dfarben;
      rows.push({ k: 'Design', v: dstil || '—', screen: 'design' });
      var dp = currentDesign();
      rows.push({ k: 'Produkt', v: dp ? dp.name + ' · ' + fmtEUR(dp.price) : '—', screen: 'd_umfang' });
      rows.push({ k: 'Einmalig', v: fmtEUR(dp ? dp.price : 0) + ' netto', screen: null });
      return rows;
    }
""", "", "summary")

add(
"""      // Design-Pfad endet nach Stil/Farben beim Umfang; Website-Pfad läuft normal weiter
      var designNext = function () { isDesign() ? goTo('d_umfang') : advance(); };
      actions({ onBack: back, onNext: designNext, skip: designNext });""",
"""      actions({ onBack: back, onNext: advance, skip: advance });""", "designNext")

add("    var dProd = isDesign() ? currentDesign() : null;\n", "", "dprod")
add("      produkt_typ: A.produkt_typ, // 'website' | 'design' (additiv, bestehende Keys unverändert)",
    "      produkt_typ: A.produkt_typ, // 'website' | 'redesign' (additiv, bestehende Keys unverändert)", "kommentar")

add(
"""      konfiguration: isDesign() ? {
        modus: 'design',
        produkt: dProd ? dProd.id : null,
        produkt_name: dProd ? dProd.name : null,
        produkt_preis: dProd ? dProd.price : null,
        design_umfang: A.design_umfang,
        paket: null,
        wartung: null,
        summe_einmalig: dProd ? dProd.price : 0,
        summe_monatlich: 0,
        zahlungsstaffelung: [{ pct: 50, when: 'bei Auftrag' }, { pct: 50, when: 'bei Lieferung' }],
      } : isEnterprise() ? {""",
"""      konfiguration: isEnterprise() ? {""", "konfig")

add(
"""      stage.appendChild(el('p', 'lb-hint', 'Keine Texte? Kein Problem — die schreiben wir sowieso für dich. Bestehende Website? Dein Umzug ist im Paket drin.'));""",
"""      stage.appendChild(el('p', 'lb-hint', 'Keine Texte? Kein Problem — die schreiben wir sowieso für dich. Bestehende Website? Dein Umzug ist im Paket drin.'));
      if (A.produkt_typ === 'redesign') stage.appendChild(el('p', 'lb-hint', 'Deine Texte und Bilder übernehmen wir von deiner alten Seite — Umzug inklusive.'));""",
"matnote")

for old, new, label in pairs:
    c = s.count(old)
    assert c == 1, f"ANKER {label}: {c}x gefunden (erwartet 1)"
    s = s.replace(old, new, 1)

# Asserts
assert 'isDesign' not in s, "isDesign noch referenziert"
assert 'design-onepager' not in s and 'design-mehrseiten' not in s, "design-id noch in briefing.js"
assert 'd_branche' not in s and 'd_umfang' not in s, "design-screen noch referenziert"
assert "produkt_typ = 'design'" not in s, "produkt_typ design noch gesetzt"
assert "produkt_typ = 'redesign'" in s
open(f, 'w', encoding='utf-8').write(s)
print(f"briefing.js ✓ {len(pairs)} Blöcke ersetzt; isDesign/d_screens/design-ids entfernt")
