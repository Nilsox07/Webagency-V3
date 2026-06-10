/* ============================================================
   Sartu · ZENTRALE ZAHLUNGSSTAFFELUNG (entspricht später /lib/payment-terms)
   ------------------------------------------------------------
   >>> EINZIGE Stelle zum Pflegen der Zahlungs-Meilensteine. <<<
   Wird auf dem Ergebnis-Screen NUR ANGEZEIGT (kein Zahlungsvorgang).
   ============================================================ */
(function (root, factory) {
  var api = factory();
  root.SARTU_PAYMENT_TERMS = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var PRO_PLATIN = [
    { pct: 40, when: 'bei Auftrag' },
    { pct: 30, when: 'wenn du das Design freigibst' },
    { pct: 30, when: 'wenn deine Website online geht' },
  ];

  return {
    // Zufriedenheitsgarantie (gilt nur für die erste Design-Vorschau)
    guarantee: 'Geld zurück, wenn die erste Design-Vorschau nicht überzeugt.',

    // Staffelung je Paket
    terms: {
      basis: [
        { pct: 50, when: 'bei Auftrag' },
        { pct: 50, when: 'wenn deine Website online geht' },
      ],
      pro: PRO_PLATIN,
      platin: PRO_PLATIN,
      enterprise: [
        { pct: 30, when: 'bei Auftrag' },
        { pct: 30, when: 'wenn du das Design freigibst' },
        { pct: 20, when: 'wenn alles fertig ist' },
        { pct: 20, when: 'wenn deine Website online geht' },
      ],
    },

    // Hilfsfunktion: Staffelung für eine Paket-ID holen (Fallback pro)
    forPackage: function (id) {
      return this.terms[id] || this.terms.pro;
    },
  };
});
