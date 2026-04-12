(function () {
  "use strict";

  const sections = document.querySelectorAll("[data-rating-slug]");
  if (!sections.length) return;

  const keyFor = (slug) => `blog-rating::${slug}`;

  const paint = (container, value) => {
    container.querySelectorAll(".blog-star").forEach((star) => {
      const starValue = Number(star.dataset.value || 0);
      star.classList.toggle("is-active", starValue <= value);
      star.setAttribute("aria-checked", starValue === value ? "true" : "false");
    });
  };

  sections.forEach((section) => {
    const slug = section.dataset.ratingSlug;
    if (!slug) return;

    const starsWrap = section.querySelector(".blog-rating-stars");
    const note = section.querySelector("[data-rating-note]");
    if (!starsWrap || !note) return;

    const stored = Number(localStorage.getItem(keyFor(slug)) || 0);
    if (stored > 0) {
      paint(starsWrap, stored);
      note.textContent = `Tu valoracion guardada: ${stored}/5 estrellas (en este navegador).`;
    }

    starsWrap.querySelectorAll(".blog-star").forEach((button) => {
      button.addEventListener("click", () => {
        const value = Number(button.dataset.value || 0);
        if (!value) return;
        localStorage.setItem(keyFor(slug), String(value));
        paint(starsWrap, value);
        note.textContent = `Gracias. Tu valoracion: ${value}/5 estrellas.`;
      });
    });
  });
})();
