const CATEGORY_CATALOG = [
  {
    id: "webs-y-captacion",
    label: "Webs y captacion",
    summary: "Estructura web, propuesta de valor y decisiones de conversion."
  },
  {
    id: "automatizacion-util",
    label: "Automatizacion util",
    summary: "Automatizaciones realistas para ahorrar tiempo sin complejidad innecesaria."
  },
  {
    id: "atencion-al-cliente-y-leads",
    label: "Atencion al cliente y leads",
    summary: "Canales de contacto, calidad de oportunidad y continuidad comercial."
  },
  {
    id: "procesos-internos",
    label: "Procesos internos",
    summary: "Orden operativo para escalar captacion y seguimiento de forma estable."
  },
  {
    id: "comparativas-y-decisiones",
    label: "Comparativas y decisiones",
    summary: "Que opcion conviene segun fase, recursos y objetivo del negocio."
  },
  {
    id: "redes-sociales",
    label: "Redes sociales para negocio",
    summary: "Contenido aplicable para Instagram y TikTok con enfoque comercial."
  }
];

const state = {
  posts: [],
  activeCategory: "all",
  query: ""
};

const elements = {
  categories: document.getElementById("blogCategories"),
  featured: document.getElementById("featuredPost"),
  filterRow: document.getElementById("blogFilterRow"),
  total: document.getElementById("blogTotalLabel"),
  grid: document.getElementById("blogGrid"),
  topics: document.getElementById("blogTopicsGrid"),
  empty: document.getElementById("blogEmptyState"),
  searchInput: document.getElementById("blogSearchInput"),
  searchClear: document.getElementById("blogSearchClear"),
  relevantGrid: document.getElementById("blogRelevantGrid"),
  recentGrid: document.getElementById("blogRecentGrid")
};

const formatDate = (value) =>
  new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "long", year: "numeric" }).format(
    new Date(value)
  );

const escapeHtml = (text = "") =>
  String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalize = (value = "") =>
  String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

function buildCategoryMap(posts) {
  const map = new Map();
  posts.forEach((post) => {
    const current = map.get(post.category_id) || 0;
    map.set(post.category_id, current + 1);
  });
  return map;
}

function getFeaturedPost(posts) {
  return (
    posts
      .filter((post) => post.featured)
      .sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))[0] ||
    posts[0]
  );
}

function sortByRelevance(posts) {
  return [...posts].sort((a, b) => {
    const aScore =
      (a.relevance_score || 0) +
      (a.utility_score || 0) +
      (a.evergreen_score || 0) * 0.35 +
      (a.priority || 0) * 2;
    const bScore =
      (b.relevance_score || 0) +
      (b.utility_score || 0) +
      (b.evergreen_score || 0) * 0.35 +
      (b.priority || 0) * 2;
    return bScore - aScore;
  });
}

function sortByRecent(posts) {
  return [...posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function getSearchText(post) {
  return normalize(
    [
      post.title,
      post.excerpt,
      post.category,
      post.description,
      ...(post.keywords || []),
      ...(post.concepts || []),
      ...(post.key_takeaways || []),
      ...(post.social_formats || []),
      post.social_hook,
      post.intent,
      post.audience_level,
      post.content_type
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function renderCategoryChips(posts) {
  const counts = buildCategoryMap(posts);
  elements.categories.innerHTML = CATEGORY_CATALOG.map((category) => {
    const count = counts.get(category.id) || 0;
    return `<span class="blog-chip">${escapeHtml(category.label)} (${count})</span>`;
  }).join("");
}

function renderFeatured(posts) {
  const featured = getFeaturedPost(posts);
  if (!featured) {
    elements.featured.innerHTML = "";
    return;
  }

  elements.featured.innerHTML = `
    <article class="blog-featured-card">
      <div class="blog-featured-main">
        <div class="blog-meta">
          <span>${escapeHtml(featured.category)}</span>
          <span>${formatDate(featured.date)}</span>
          <span>${escapeHtml(featured.reading_time || "")}</span>
          <span>Utilidad ${Number(featured.utility_score || 0)}/100</span>
        </div>
        <h3>${escapeHtml(featured.title)}</h3>
        <p>${escapeHtml(featured.excerpt)}</p>
        <div class="blog-hero-cta">
          <a class="btn btn-primary" href="/blog/${encodeURIComponent(featured.slug)}/">Leer articulo destacado</a>
        </div>
      </div>
      <div class="blog-featured-side">
        <p><strong>Hook editorial:</strong> ${escapeHtml(featured.social_hook || "Lectura recomendada para tomar decisiones con criterio.")}</p>
        <p><strong>Tipo de contenido:</strong> ${escapeHtml(featured.content_type || "articulo")} · <strong>Nivel:</strong> ${escapeHtml(featured.audience_level || "general")}</p>
        <p><strong>Takeaway:</strong> ${escapeHtml((featured.key_takeaways || [])[0] || "Primero claridad de enfoque, despues ejecucion.")}</p>
      </div>
    </article>
  `;
}

function renderFilterRow(posts) {
  const counts = buildCategoryMap(posts);
  const items = [
    { id: "all", label: "Todos", count: posts.length },
    ...CATEGORY_CATALOG.map((category) => ({
      id: category.id,
      label: category.label,
      count: counts.get(category.id) || 0
    }))
  ];

  elements.filterRow.innerHTML = items
    .map(
      (item) => `
        <button type="button" class="blog-filter-btn${item.id === state.activeCategory ? " is-active" : ""}" data-category="${item.id}">
          ${escapeHtml(item.label)} (${item.count})
        </button>
      `
    )
    .join("");

  elements.filterRow.querySelectorAll(".blog-filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeCategory = button.dataset.category || "all";
      renderPosts();
      renderFilterRow(state.posts);
    });
  });
}

function postCard(post) {
  return `
    <article class="blog-card">
      <div class="blog-meta">
        <span>${escapeHtml(post.category)}</span>
        <span>${formatDate(post.date)}</span>
        <span>${escapeHtml(post.reading_time || "")}</span>
      </div>
      <h3>${escapeHtml(post.title)}</h3>
      <p>${escapeHtml(post.excerpt)}</p>
      <div class="blog-card-bars">
        <div class="blog-score-row"><span>Relevancia</span><strong>${Number(post.relevance_score || 0)}/100</strong></div>
        <div class="blog-score-row"><span>Utilidad</span><strong>${Number(post.utility_score || 0)}/100</strong></div>
      </div>
      <a class="blog-card-link" href="/blog/${encodeURIComponent(post.slug)}/">Leer articulo →</a>
    </article>
  `;
}

function getFilteredPosts() {
  const query = normalize(state.query);
  return state.posts.filter((post) => {
    const categoryMatch = state.activeCategory === "all" || post.category_id === state.activeCategory;
    if (!categoryMatch) return false;
    if (!query) return true;
    return getSearchText(post).includes(query);
  });
}

function renderPosts() {
  const filtered = getFilteredPosts();

  elements.total.textContent =
    filtered.length === state.posts.length
      ? `${state.posts.length} articulos publicados`
      : `${filtered.length} resultado(s) para categoria/filtro actual`;

  if (!filtered.length) {
    elements.grid.innerHTML = "";
    elements.empty.hidden = false;
    return;
  }

  elements.empty.hidden = true;

  const ordered = sortByRelevance(filtered);
  elements.grid.innerHTML = ordered.map(postCard).join("");
}

function renderRelevant(posts) {
  const ranked = sortByRelevance(posts).filter((post) => post.recommended).slice(0, 3);
  elements.relevantGrid.innerHTML = ranked.map(postCard).join("");
}

function renderRecent(posts) {
  const recent = sortByRecent(posts).slice(0, 3);
  elements.recentGrid.innerHTML = recent.map(postCard).join("");
}

function renderTopics(posts) {
  const counts = buildCategoryMap(posts);
  elements.topics.innerHTML = CATEGORY_CATALOG.map((category) => {
    const count = counts.get(category.id) || 0;
    return `
      <article class="blog-topic-card">
        <h3>${escapeHtml(category.label)}</h3>
        <p>${escapeHtml(category.summary)}</p>
        <span>${count} articulo(s) disponible(s)</span>
      </article>
    `;
  }).join("");
}

function bindSearch() {
  if (!elements.searchInput || !elements.searchClear) return;

  elements.searchInput.addEventListener("input", () => {
    state.query = elements.searchInput.value || "";
    renderPosts();
  });

  elements.searchClear.addEventListener("click", () => {
    state.query = "";
    elements.searchInput.value = "";
    renderPosts();
    elements.searchInput.focus();
  });
}

async function initBlogIndex() {
  try {
    const response = await fetch("/data/posts.json");
    if (!response.ok) {
      throw new Error(`No se pudo cargar data/posts.json (${response.status})`);
    }

    const data = await response.json();
    const posts = Array.isArray(data) ? data : [];

    state.posts = posts.filter((post) => post && post.published);

    renderCategoryChips(state.posts);
    renderFeatured(state.posts);
    renderFilterRow(state.posts);
    renderPosts();
    renderRelevant(state.posts);
    renderRecent(state.posts);
    renderTopics(state.posts);
    bindSearch();
  } catch (error) {
    console.error("Blog index error:", error);
    elements.total.textContent = "No se han podido cargar los articulos.";
    elements.grid.innerHTML = "";
    elements.empty.hidden = false;
  }
}

initBlogIndex();
