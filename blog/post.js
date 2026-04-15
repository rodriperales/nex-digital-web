(function () {
  "use strict";

  const SUPABASE_URL = "https://uksihlimqyjuavmeskth.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrc2lobGltcXlqdWF2bWVza3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5OTc5MjcsImV4cCI6MjA5MTU3MzkyN30.m7JurWW5LQog4jRehQRPWxZl8FksV3-v55mDpVhasi4";

  const nodes = {
    crumbCurrent: document.getElementById("crumbCurrent"),
    postMeta: document.getElementById("postMeta"),
    postTitle: document.getElementById("postTitle"),
    postIntro: document.getElementById("postIntro"),
    postContent: document.getElementById("postContent"),
    postTocWrap: document.getElementById("postTocWrap"),
    postToc: document.getElementById("postToc"),
    postSocialPack: document.getElementById("postSocialPack"),
    postSocialHook: document.getElementById("postSocialHook"),
    postTakeaways: document.getElementById("postTakeaways"),
    postRating: document.getElementById("postRating"),
    postRelatedWrap: document.getElementById("postRelatedWrap"),
    postRelated: document.getElementById("postRelated")
  };

  const escapeHtml = (text = "") =>
    String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const formatDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric"
    }).format(date);
  };

  const slugify = (value = "") =>
    String(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .trim();

  const readSlug = () => {
    const qsSlug = new URLSearchParams(window.location.search).get("slug");
    return (qsSlug || "").trim();
  };

  function sanitizeHtml(html = "") {
    const template = document.createElement("template");
    template.innerHTML = html;

    template.content
      .querySelectorAll("script,iframe,object,embed,form,button,input,textarea,select")
      .forEach((node) => node.remove());

    template.content.querySelectorAll("*").forEach((node) => {
      [...node.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = attr.value || "";
        if (name.startsWith("on")) {
          node.removeAttribute(attr.name);
          return;
        }
        if ((name === "href" || name === "src") && /^\s*javascript:/i.test(value)) {
          node.removeAttribute(attr.name);
        }
      });
    });

    return template.innerHTML;
  }

  async function fetchLocalPosts() {
    try {
      const response = await fetch("/data/posts.json");
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async function fetchSupabasePost(slug) {
    const query = `${SUPABASE_URL}/rest/v1/posts?published=eq.true&slug=eq.${encodeURIComponent(
      slug
    )}&select=slug,title,excerpt,description,category,category_id,published_at,reading_time,content_html,social_hook,key_takeaways,related&limit=1`;

    const response = await fetch(query, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (!response.ok) return null;
    const rows = await response.json();
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  }

  function buildPostUrl(slug, localSlugSet) {
    if (!slug) return "/blog/";
    return localSlugSet.has(slug)
      ? `/blog/${encodeURIComponent(slug)}/`
      : `/blog/post/?slug=${encodeURIComponent(slug)}`;
  }

  function renderMeta(post) {
    const date = formatDate(post.published_at);
    nodes.postMeta.innerHTML = `
      <span>${escapeHtml(post.category || "Blog")}</span>
      ${date ? `<span>${escapeHtml(date)}</span>` : ""}
      ${post.reading_time ? `<span>${escapeHtml(post.reading_time)}</span>` : ""}
    `;
  }

  function setSeo(post, slug) {
    const title = post.title || "Articulo | Nex Digital";
    const description = post.description || post.excerpt || "Contenido editorial de Nex Digital.";
    const canonical = `https://nex-digital-web.pages.dev/blog/post/?slug=${encodeURIComponent(slug)}`;

    document.title = `${title} | Nex Digital`;
    const descriptionMeta = document.querySelector('meta[name="description"]');
    if (descriptionMeta) descriptionMeta.setAttribute("content", description);
    const canonicalEl = document.querySelector('link[rel="canonical"]');
    if (canonicalEl) canonicalEl.setAttribute("href", canonical);
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", title);
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) ogDescription.setAttribute("content", description);
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute("content", canonical);
    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute("content", title);
    const twDescription = document.querySelector('meta[name="twitter:description"]');
    if (twDescription) twDescription.setAttribute("content", description);
  }

  function renderContent(post) {
    const safeHtml = sanitizeHtml(post.content_html || "");

    if (safeHtml.trim()) {
      nodes.postContent.innerHTML = safeHtml;
      return;
    }

    nodes.postContent.innerHTML = `
      <h2>Contenido en preparacion</h2>
      <p>Este articulo ya existe en el sistema editorial, pero aun no tiene bloque de contenido renderizado.</p>
      <p>Puedes volver al indice y revisar otras piezas publicadas mientras se completa esta entrada.</p>
    `;
  }

  function renderToc() {
    const headings = nodes.postContent.querySelectorAll("h2, h3");
    if (!headings.length) {
      nodes.postTocWrap.hidden = true;
      return;
    }

    const items = [];
    headings.forEach((heading, idx) => {
      if (!heading.id) {
        heading.id = `${slugify(heading.textContent)}-${idx + 1}`;
      }
      items.push(
        `<li><a href="#${escapeHtml(heading.id)}">${escapeHtml(heading.textContent || "")}</a></li>`
      );
    });

    nodes.postToc.innerHTML = items.join("");
    nodes.postTocWrap.hidden = false;
  }

  function renderSocialPack(post) {
    const takeaways = Array.isArray(post.key_takeaways) ? post.key_takeaways.filter(Boolean) : [];
    const hook = (post.social_hook || "").trim();

    if (!hook && !takeaways.length) {
      nodes.postSocialPack.hidden = true;
      return;
    }

    nodes.postSocialHook.textContent = hook || "Lectura util para decisiones de negocio.";
    nodes.postTakeaways.innerHTML = (takeaways.length ? takeaways : ["Enfoque practico y aplicable en negocio real."])
      .map((item) => `<li>${escapeHtml(item)}</li>`)
      .join("");
    nodes.postSocialPack.hidden = false;
  }

  function renderRelated(post, catalog, localSlugSet) {
    const related = Array.isArray(post.related) ? post.related.filter(Boolean).slice(0, 3) : [];
    if (!related.length) {
      nodes.postRelatedWrap.hidden = true;
      return;
    }

    const bySlug = new Map(catalog.map((item) => [item.slug, item]));
    nodes.postRelated.innerHTML = related
      .map((slug) => {
        const item = bySlug.get(slug);
        const label = item?.title || slug.replace(/-/g, " ");
        const href = buildPostUrl(slug, localSlugSet);
        return `<li><a href="${href}">${escapeHtml(label)}</a></li>`;
      })
      .join("");
    nodes.postRelatedWrap.hidden = false;
  }

  function renderNotFound(slug) {
    nodes.crumbCurrent.textContent = "No encontrado";
    nodes.postMeta.innerHTML = "<span>Blog</span>";
    nodes.postTitle.textContent = "No hemos encontrado este articulo";
    nodes.postIntro.textContent = "Es posible que el slug no exista o aun no este publicado.";
    nodes.postContent.innerHTML = `
      <p>Slug recibido: <strong>${escapeHtml(slug || "(vacio)")}</strong></p>
      <p>Vuelve al indice del blog para ver los articulos disponibles.</p>
      <p><a class="btn btn-primary" href="/blog/">Ir al blog</a></p>
    `;
    nodes.postTocWrap.hidden = true;
    nodes.postSocialPack.hidden = true;
    nodes.postRelatedWrap.hidden = true;
    nodes.postRating.setAttribute("hidden", "hidden");
  }

  async function init() {
    const slug = readSlug();
    if (slug) {
      nodes.postRating.setAttribute("data-rating-slug", slug);
    }
    if (!slug) {
      renderNotFound("");
      return;
    }

    const localPosts = await fetchLocalPosts();
    const localSlugSet = new Set((localPosts || []).map((post) => post.slug).filter(Boolean));

    if (localSlugSet.has(slug)) {
      window.location.replace(`/blog/${encodeURIComponent(slug)}/`);
      return;
    }

    const post = await fetchSupabasePost(slug);
    if (!post) {
      renderNotFound(slug);
      return;
    }

    nodes.crumbCurrent.textContent = post.title || slug;
    nodes.postTitle.textContent = post.title || "Articulo";
    nodes.postIntro.textContent = post.excerpt || post.description || "Lectura editorial de Nex Digital.";

    setSeo(post, slug);
    renderMeta(post);
    renderContent(post);
    renderToc();
    renderSocialPack(post);
    renderRelated(post, localPosts, localSlugSet);
  }

  init().catch(() => {
    renderNotFound(readSlug());
  });
})();
