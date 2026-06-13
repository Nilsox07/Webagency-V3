/* Pin-Overlay für die Sartu-Vorschau. NIE Teil der späteren Live-Site — nur über die
   Portal-Auslieferung injiziert. Anmerkungs-Modus: Klick auf Element → Pin + Text → POST. */
(function () {
  'use strict';
  var s = document.currentScript;
  var projektId = s && s.getAttribute('data-projekt');
  var status = s && s.getAttribute('data-status');
  if (!projektId) return;

  // Kürzester eindeutiger CSS-Selektor für ein Element.
  function selectorFor(el) {
    if (el.id) return '#' + el.id;
    var parts = [];
    while (el && el.nodeType === 1 && parts.length < 5) {
      var sel = el.nodeName.toLowerCase();
      if (el.className && typeof el.className === 'string') {
        var c = el.className.trim().split(/\s+/)[0];
        if (c) sel += '.' + c;
      }
      var parent = el.parentNode;
      if (parent) {
        var sib = Array.prototype.filter.call(parent.children, function (n) { return n.nodeName === el.nodeName; });
        if (sib.length > 1) sel += ':nth-of-type(' + (sib.indexOf(el) + 1) + ')';
      }
      parts.unshift(sel);
      if (document.querySelectorAll(parts.join(' > ')).length === 1) break;
      el = parent;
    }
    return parts.join(' > ');
  }

  var active = false;
  var bar = document.createElement('div');
  bar.style.cssText = 'position:fixed;z-index:999999;left:50%;bottom:16px;transform:translateX(-50%);background:#0B1220;color:#aef000;border:1px solid #2a3a4d;border-radius:999px;padding:10px 16px;font:600 14px system-ui;box-shadow:0 6px 20px rgba(0,0,0,.4);cursor:pointer';
  bar.textContent = (status === 'design') ? 'Anmerkungs-Modus: aus' : 'Anmerkungen sind in dieser Phase gesperrt';
  document.body.appendChild(bar);
  if (status !== 'design') { bar.style.opacity = '.6'; return; }

  bar.addEventListener('click', function () { active = !active; bar.textContent = 'Anmerkungs-Modus: ' + (active ? 'AN — klick aufs Element' : 'aus'); document.body.style.cursor = active ? 'crosshair' : ''; });

  document.addEventListener('click', function (e) {
    if (!active) return;
    if (e.target === bar) return;
    e.preventDefault(); e.stopPropagation();
    var el = e.target;
    var text = window.prompt('Was sollen wir hier ändern?');
    if (!text) return;
    var r = el.getBoundingClientRect();
    var body = new URLSearchParams({
      seite_pfad: location.pathname,
      css_selektor: selectorFor(el),
      offset_x: Math.round(e.clientX - r.left),
      offset_y: Math.round(e.clientY - r.top),
      viewport_breite: window.innerWidth,
      dom_snippet: (el.outerHTML || '').slice(0, 4000),
      text: text,
    });
    fetch('/portal/projekt/' + projektId + '/pins', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'csrf-token': window.__CSRF__ || '' }, credentials: 'same-origin', body: body.toString() })
      .then(function (res) { return res.json(); })
      .then(function (j) { if (j.ok) { var dot = document.createElement('div'); dot.textContent = '📌'; dot.style.cssText = 'position:absolute;z-index:999998;left:' + (r.left + window.scrollX) + 'px;top:' + (r.top + window.scrollY) + 'px'; document.body.appendChild(dot); } });
  }, true);
})();
