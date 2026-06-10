/* ============================================================
   Sartu · Live-Designvorschau  (OPTIONAL, LEICHT ENTFERNBAR)
   ------------------------------------------------------------
   Mitwachsende Mini-Website für das Lumi-Briefing: reagiert auf
   Branche (Headline), Ziel (CTA-Text), Stil (Layout-Charakter) und
   Farben (Haupt-/Akzentfarbe). BEWUSST nur Andeutung – kein Baukasten.

   >>> ENTFERNEN: die Zeile
         <script src="color-mockup.js?v=2"></script>
       aus briefing.html löschen. briefing.js prüft auf
       window.SARTU_COLOR_MOCKUP und überspringt sich dann selbst.

   API:
     var el = window.SARTU_COLOR_MOCKUP.build();
     el.update({ haupt, neben, stil, headline, cta });  // live aktualisieren
   Einfärbung über CSS-Variablen --haupt / --neben.
   ============================================================ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Relative Luminanz 0..1 — > 0.6 = "hell" → dunkler Text statt weiß (Kontrast-Automatik)
  function luminance(hex) {
    if (!hex || hex.charAt(0) !== '#') return 0.5;
    var c = hex.replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    if (c.length !== 6) return 0.5;
    var r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  }

  var STIL = ['minimal', 'elegant', 'verspielt', 'bold', 'warm', 'corporate'];

  function cardHTML() {
    return '<div class="cmock-card"><span class="cmock-ico"></span>' +
      '<span class="cmock-cl"></span><span class="cmock-cl cmock-short"></span></div>';
  }

  function build() {
    var root = document.createElement('div');
    root.className = 'cmock';
    root.setAttribute('aria-hidden', 'true'); // dekorativ (echter Hinweistext steht separat)
    if (REDUCE) root.classList.add('cmock-reduce');

    root.innerHTML =
      '<p class="cmock-cap">Deine Live-Vorschau <span>– grobe Richtung</span></p>' +
      '<div class="cmock-browser">' +
        '<div class="cmock-bar">' +
          '<span class="cmock-dot"></span><span class="cmock-dot"></span><span class="cmock-dot"></span>' +
          '<span class="cmock-url"></span>' +
        '</div>' +
        '<div class="cmock-page">' +
          '<div class="cmock-nav"><span class="cmock-logo"></span>' +
            '<span class="cmock-navlinks"><i></i><i></i><i></i></span></div>' +
          '<div class="cmock-hero">' +
            '<div class="cmock-copy">' +
              '<span class="cmock-title"></span>' +
              '<span class="cmock-line"></span><span class="cmock-line cmock-short"></span>' +
              '<span class="cmock-btn"></span>' +
            '</div>' +
            '<div class="cmock-media"></div>' +
          '</div>' +
          '<div class="cmock-cards">' + cardHTML() + cardHTML() + cardHTML() + '</div>' +
          '<div class="cmock-foot"></div>' +
        '</div>' +
      '</div>';

    var titleEl = root.querySelector('.cmock-title');
    var btnEl = root.querySelector('.cmock-btn');

    // update({haupt, neben, stil, headline, cta})
    root.update = function (cfg) {
      cfg = cfg || {};
      var haupt = cfg.haupt || '#94A3B8'; // ohne Auswahl: neutralgrau
      var neben = cfg.neben || '#94A3B8';
      root.style.setProperty('--haupt', haupt);
      root.style.setProperty('--neben', neben);
      root.classList.toggle('is-haupt-light', luminance(haupt) > 0.6);
      root.classList.toggle('is-neben-light', luminance(neben) > 0.6);
      root.setAttribute('data-stil', STIL.indexOf(cfg.stil) > -1 ? cfg.stil : 'default');
      if (titleEl) titleEl.textContent = cfg.headline || 'Deine Website. Dein Auftritt.';
      if (btnEl) btnEl.textContent = cfg.cta || 'Jetzt anfragen';
    };

    return root;
  }

  window.SARTU_COLOR_MOCKUP = { build: build };
})();
