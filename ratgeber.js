// Ratgeber / Glossar — Live-Suche und Kategorie-Filter
(function () {
  const search = document.getElementById('glossarySearch');
  const cats = document.querySelectorAll('.gcat');
  const cards = Array.from(document.querySelectorAll('.term-card'));
  const count = document.getElementById('glossaryCount');
  const empty = document.getElementById('glossaryEmpty');
  if (!cards.length) return;

  let activeCat = 'all';

  function normalize(s) { return (s || '').toLowerCase().trim(); }

  function apply() {
    const q = normalize(search ? search.value : '');
    let visible = 0;
    cards.forEach(function (card) {
      const matchCat = activeCat === 'all' || card.dataset.cat === activeCat;
      const matchText = !q || normalize(card.textContent).includes(q);
      const show = matchCat && matchText;
      card.classList.toggle('is-hidden', !show);
      if (show) visible++;
    });
    if (count) {
      count.textContent = visible === cards.length
        ? cards.length + ' Begriffe'
        : visible + ' von ' + cards.length + ' Begriffen';
    }
    if (empty) empty.classList.toggle('show', visible === 0);
  }

  if (search) search.addEventListener('input', apply);

  cats.forEach(function (btn) {
    btn.addEventListener('click', function () {
      cats.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      activeCat = btn.dataset.cat || 'all';
      apply();
    });
  });

  apply();
})();
