// Filter the reviews by type and search them by word. Without JavaScript every review is still shown.
(function () {
  const reviews = Array.from(document.querySelectorAll('.review'));
  const buttons = Array.from(document.querySelectorAll('[data-filter]'));
  const search = document.getElementById('search');
  const none = document.getElementById('no-results');
  const controls = document.querySelector('.controls');
  let type = 'all';

  function update() {
    const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const review of reviews) {
      const text = review.textContent.toLowerCase();
      const visible = (type === 'all' || review.dataset.type === type) && words.every((w) => text.includes(w));
      review.hidden = !visible;
      if (visible) shown += 1;
    }
    none.hidden = shown > 0 || reviews.length === 0;
  }

  for (const button of buttons) {
    button.addEventListener('click', () => {
      type = button.dataset.filter;
      for (const other of buttons) other.setAttribute('aria-pressed', String(other === button));
      update();
    });
  }
  search.addEventListener('input', update);
  if (reviews.length) controls.hidden = false;
})();
