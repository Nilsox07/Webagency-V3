/* ============================================================
   Sartu · Farb-Vorschau-Mockup  (OPTIONAL, LEICHT ENTFERNBAR)
   ------------------------------------------------------------
   Abstrakte, live eingefärbte Andeutung einer Startseite für
   Schritt 5 des Lumi-Briefings ("So wirken deine Farben").
   BEWUSST nur Andeutung – keine echte Seite, kein Baukasten-Look.

   >>> ENTFERNEN: einfach die Zeile
         <script src="color-mockup.js?v=1"></script>
       aus briefing.html löschen. briefing.js prüft auf
       window.SARTU_COLOR_MOCKUP und überspringt sich dann selbst.
       (Die zugehörigen .cmock-* Styles in briefing.css sind dann
        ungenutzt und können bei Bedarf ebenfalls entfernt werden.)

   API:
     var el = window.SARTU_COLOR_MOCKUP.build();
     el.update(hauptHex, nebenHex, stilValue);  // live einfärben
   Einfärbung rein über CSS-Variablen --haupt / --neben.
   ============================================================ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Sehr helle Farbe erkennen → dann dezenten 1px-Rahmen geben (sonst unsichtbar auf heller Seite)
  function isLight(hex) {
    if (!hex || hex.charAt(0) !== '#') return false;
    var c = hex.replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    if (c.length !== 6) return false;
    var r = parseInt(c.substr(0, 2), 16), g = parseInt(c.substr(2, 2), 16), b = parseInt(c.substr(4, 2), 16);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.8;
  }

  var STIL_FLAVORS = ['minimal', 'elegant', 'verspielt', 'bold', 'warm', 'corporate'];

  function build() {
    var root = document.createElement('div');
    root.className = 'cmock';
    root.setAttribute('aria-hidden', 'true'); // rein dekorativ (echter Hinweistext steht separat)
    if (REDUCE) root.classList.add('cmock-reduce');

    root.innerHTML =
      '<p class="cmock-cap">So wirken deine Farben <span>– als Andeutung</span></p>' +
      '<div class="cmock-browser">' +
        '<div class="cmock-bar">' +
          '<span class="cmock-dot"></span><span class="cmock-dot"></span><span class="cmock-dot"></span>' +
          '<span class="cmock-url"></span>' +
        '</div>' +
        '<div class="cmock-page">' +
          // Kopf: Logo (Hauptfarbe) + 3 Navi-Striche (neutral)
          '<div class="cmock-nav">' +
            '<span class="cmock-logo"></span>' +
            '<span class="cmock-navlinks"><i></i><i></i><i></i></span>' +
          '</div>' +
          // Hero: Titel (Hauptfarbe), 2 Textlinien, Button (Nebenfarbe), Media (Verlauf)
          '<div class="cmock-hero">' +
            '<div class="cmock-copy">' +
              '<span class="cmock-title"></span>' +
              '<span class="cmock-line"></span>' +
              '<span class="cmock-line cmock-short"></span>' +
              '<span class="cmock-btn"></span>' +
            '</div>' +
            '<div class="cmock-media"></div>' +
          '</div>' +
          // 3 angedeutete Karten mit Icon-Quadrat (Hauptfarbe)
          '<div class="cmock-cards">' +
            cardHTML() + cardHTML() + cardHTML() +
          '</div>' +
        '</div>' +
      '</div>';

    // Live-Einfärbung + Stil-Layout
    root.update = function (hauptHex, nebenHex, stilValue) {
      root.style.setProperty('--haupt', hauptHex || '#94A3B8'); // ohne Auswahl: neutralgrau
      root.style.setProperty('--neben', nebenHex || '#94A3B8');
      root.classList.toggle('is-haupt-light', isLight(hauptHex));
      root.classList.toggle('is-neben-light', isLight(nebenHex));
      var flavor = STIL_FLAVORS.indexOf(stilValue) > -1 ? stilValue : 'default';
      root.setAttribute('data-stil', flavor);
    };

    return root;
  }

  function cardHTML() {
    return '<div class="cmock-card"><span class="cmock-ico"></span>' +
      '<span class="cmock-cl"></span><span class="cmock-cl cmock-short"></span></div>';
  }

  window.SARTU_COLOR_MOCKUP = { build: build };
})();
