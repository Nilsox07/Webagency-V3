/* ============================================================
   Sartu · Cookie-Consent  (DSGVO/TTDSG-konform, ohne Fremd-Tool)
   ------------------------------------------------------------
   • Zeigt beim ersten Besuch einen Banner; speichert die Wahl lokal.
   • Optionale Cookies (Statistik/Marketing) werden NUR nach aktiver
     Einwilligung aktiviert — „Nur notwendige" ist gleichwertig sichtbar.
   • Keine vorausgewählten optionalen Kategorien (Opt-in).
   • Granulare Einstellungen + jederzeit erneut aufrufbar
     (Footer-Link „Cookie-Einstellungen" oder window.SartuConsent.open()).

   >>> SPÄTER Skripte (z. B. Analytics) einbinden:
       <script type="text/plain" data-consent="analytics" src="..."></script>
       Sie werden automatisch aktiviert, sobald die Kategorie zugestimmt ist.

   API:
     window.SartuConsent.has('analytics')   → true/false
     window.SartuConsent.open()             → Einstellungen öffnen
     window.SartuConsent.onChange(fn)        → Callback bei Änderung
   ============================================================ */
(function () {
  'use strict';
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var STORAGE_KEY = 'sartu_consent';
  var VERSION = 1; // bei inhaltlichen Änderungen erhöhen → erneute Abfrage
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Kategorien (necessary ist immer aktiv und nicht abwählbar)
  var CATEGORIES = [
    { id: 'necessary', name: 'Notwendig', required: true,
      desc: 'Für den Betrieb der Website erforderlich (z. B. Sicherheit und das Speichern deiner Cookie-Auswahl). Immer aktiv.' },
    { id: 'analytics', name: 'Statistik', required: false,
      desc: 'Hilft uns anonymisiert zu verstehen, wie die Website genutzt wird. Aktuell nicht im Einsatz – nur als Vorbereitung.' },
    { id: 'marketing', name: 'Marketing', required: false,
      desc: 'Für personalisierte Inhalte oder Werbung. Aktuell nicht im Einsatz – nur als Vorbereitung.' },
  ];

  var listeners = [];

  /* ---------- Speicherung ---------- */
  function getConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.v !== VERSION) return null; // Version geändert → erneut fragen
      return data;
    } catch (e) { return null; }
  }
  function saveConsent(categories) {
    var data = { v: VERSION, ts: new Date().toISOString(), categories: categories };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
    activateScripts();
    listeners.forEach(function (fn) { try { fn(data); } catch (e) {} });
    return data;
  }
  function allCategories(value) {
    var out = {};
    CATEGORIES.forEach(function (c) { out[c.id] = c.required ? true : !!value; });
    return out;
  }

  /* ---------- Consent-gebundene Skripte aktivieren ---------- */
  function activateScripts() {
    var consent = getConsent();
    if (!consent) return;
    var scripts = document.querySelectorAll('script[type="text/plain"][data-consent]');
    Array.prototype.forEach.call(scripts, function (s) {
      var cat = s.getAttribute('data-consent');
      if (!consent.categories[cat]) return;
      var n = document.createElement('script');
      if (s.src) n.src = s.src; else n.textContent = s.textContent;
      Array.prototype.forEach.call(s.attributes, function (a) {
        if (a.name !== 'type' && a.name !== 'data-consent') n.setAttribute(a.name, a.value);
      });
      s.parentNode.replaceChild(n, s);
    });
  }

  /* ---------- DOM-Helfer ---------- */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* ---------- Banner ---------- */
  var banner = null;
  function buildBanner() {
    banner = el('div', 'cookie-banner');
    banner.id = 'cookieBanner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie-Hinweis');
    if (REDUCE) banner.classList.add('cookie-reduce');
    banner.innerHTML =
      '<div class="cookie-inner container">' +
        '<div class="cookie-text">' +
          '<strong>Wir respektieren deine Privatsphäre</strong>' +
          '<p>Wir nutzen nur technisch notwendige Cookies. Optionale Cookies (z. B. Statistik) setzen wir ausschließlich mit deiner Einwilligung. Mehr in der <a href="datenschutz.html">Datenschutzerklärung</a>.</p>' +
        '</div>' +
        '<div class="cookie-actions">' +
          '<button type="button" class="btn btn-outline cookie-btn" data-act="settings">Einstellungen</button>' +
          '<button type="button" class="btn btn-outline cookie-btn" data-act="reject">Nur notwendige</button>' +
          '<button type="button" class="btn btn-primary cookie-btn" data-act="accept">Alle akzeptieren</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(banner);
    banner.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (act === 'accept') { saveConsent(allCategories(true)); hideBanner(); }
      else if (act === 'reject') { saveConsent(allCategories(false)); hideBanner(); }
      else if (act === 'settings') { openModal(); }
    });
    // Einblenden (nach Layout, für Transition)
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () { banner.classList.add('is-visible'); });
    });
  }
  function showBanner() { if (!banner) buildBanner(); else { banner.hidden = false; banner.classList.add('is-visible'); } }
  function hideBanner() { if (banner) { banner.classList.remove('is-visible'); setTimeout(function () { if (banner) banner.hidden = true; }, REDUCE ? 0 : 320); } }

  /* ---------- Einstellungen (Modal) ---------- */
  var modal = null, lastFocus = null;
  function buildModal() {
    modal = el('div', 'cookie-modal');
    modal.id = 'cookieModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'cookieModalTitle');
    modal.hidden = true;

    var cats = CATEGORIES.map(function (c) {
      var checked = c.required ? 'checked disabled' : '';
      return '<li class="cookie-cat">' +
        '<div class="cookie-cat-head">' +
          '<span class="cookie-cat-name">' + c.name + (c.required ? ' <em>(immer aktiv)</em>' : '') + '</span>' +
          '<label class="cookie-switch"><input type="checkbox" data-cat="' + c.id + '" ' + checked + ' />' +
          '<span class="cookie-track" aria-hidden="true"></span></label>' +
        '</div>' +
        '<p class="cookie-cat-desc">' + c.desc + '</p>' +
      '</li>';
    }).join('');

    modal.innerHTML =
      '<div class="cookie-modal-backdrop" data-act="close"></div>' +
      '<div class="cookie-modal-card" role="document">' +
        '<h2 id="cookieModalTitle">Cookie-Einstellungen</h2>' +
        '<p>Entscheide selbst, welche optionalen Cookies du zulässt. Notwendige Cookies sind für den Betrieb erforderlich und immer aktiv.</p>' +
        '<ul class="cookie-cats">' + cats + '</ul>' +
        '<div class="cookie-modal-actions">' +
          '<button type="button" class="btn btn-outline" data-act="reject">Nur notwendige</button>' +
          '<button type="button" class="btn btn-outline" data-act="save">Auswahl speichern</button>' +
          '<button type="button" class="btn btn-primary" data-act="accept">Alle akzeptieren</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    modal.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (act === 'close') { closeModal(); }
      else if (act === 'accept') { setToggles(true); saveConsent(allCategories(true)); closeModal(); hideBanner(); }
      else if (act === 'reject') { setToggles(false); saveConsent(allCategories(false)); closeModal(); hideBanner(); }
      else if (act === 'save') {
        var sel = {};
        CATEGORIES.forEach(function (c) {
          var inp = modal.querySelector('input[data-cat="' + c.id + '"]');
          sel[c.id] = c.required ? true : !!(inp && inp.checked);
        });
        saveConsent(sel); closeModal(); hideBanner();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (!modal.hidden && (e.key === 'Escape' || e.keyCode === 27)) closeModal();
    });
  }
  function setToggles(value) {
    if (!modal) return;
    CATEGORIES.forEach(function (c) {
      if (c.required) return;
      var inp = modal.querySelector('input[data-cat="' + c.id + '"]');
      if (inp) inp.checked = !!value;
    });
  }
  function openModal() {
    if (!modal) buildModal();
    // aktuelle Auswahl vorbelegen
    var consent = getConsent();
    CATEGORIES.forEach(function (c) {
      if (c.required) return;
      var inp = modal.querySelector('input[data-cat="' + c.id + '"]');
      if (inp) inp.checked = consent ? !!consent.categories[c.id] : false;
    });
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('cookie-modal-open');
    var first = modal.querySelector('.cookie-modal-card button, .cookie-modal-card input:not([disabled])');
    if (first) try { first.focus(); } catch (e) {}
  }
  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('cookie-modal-open');
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
  }

  /* ---------- Footer-Reopener „Cookie-Einstellungen" ---------- */
  function injectReopeners() {
    // Delegierter Klick für alle [data-cookie-settings]
    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-cookie-settings]') : null;
      if (t) { e.preventDefault(); openModal(); }
    });
    // Automatisch in vorhandene Footer einsetzen
    var navs = document.querySelectorAll('.footer-nav');
    Array.prototype.forEach.call(navs, function (nav) {
      if (nav.querySelector('[data-cookie-settings]')) return;
      var a = el('a', null, 'Cookie-Einstellungen');
      a.href = '#'; a.setAttribute('data-cookie-settings', '');
      nav.appendChild(a);
    });
    // Footer-rich (Startseite): Spalte „Rechtliches"
    var cols = document.querySelectorAll('.footer-col');
    Array.prototype.forEach.call(cols, function (col) {
      var h = col.querySelector('h4, .footer-h');
      if (h && /rechtliches/i.test(h.textContent) && !col.querySelector('[data-cookie-settings]')) {
        var a = el('a', null, 'Cookie-Einstellungen');
        a.href = '#'; a.setAttribute('data-cookie-settings', '');
        col.appendChild(a);
      }
    });
  }

  /* ---------- Öffentliche API ---------- */
  window.SartuConsent = {
    has: function (cat) { var c = getConsent(); return !!(c && c.categories[cat]); },
    get: function () { return getConsent(); },
    open: function () { openModal(); },
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); },
  };

  /* ---------- Start ---------- */
  function init() {
    injectReopeners();
    var consent = getConsent();
    if (consent) { activateScripts(); }   // Wahl liegt vor → ggf. Skripte aktivieren
    else { showBanner(); }                 // sonst Banner zeigen
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
