(function () {
  "use strict";

  const PAGE_SIZE = 18;
  let ALL_POSTS = [];
  let filtered = [];
  let renderedCount = 0;
  let currentFilter = "all";
  let currentQuery = "";

  const timelineEl = document.getElementById("timeline");
  const emptyMsg = document.getElementById("empty-msg");
  const loadMoreBtn = document.getElementById("load-more");
  const sentinel = document.getElementById("sentinel");
  const postCountEl = document.getElementById("post-count");
  const searchInput = document.getElementById("search-input");
  const filterBtns = document.querySelectorAll(".filter-btn");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxClose = document.getElementById("lightbox-close");

  const ARABIC_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];

  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return `${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function linkify(text) {
    const escaped = escapeHtml(text);
    return escaped.replace(/(https?:\/\/[^\s]+)/g, (url) => {
      const clean = url.replace(/[.,)]+$/, "");
      return `<a href="${clean}" target="_blank" rel="noopener noreferrer">${clean}</a>`;
    });
  }

  function postType(post) {
    return post.title ? "story" : "khatera";
  }

  function matchesFilter(post) {
    if (currentFilter !== "all" && postType(post) !== currentFilter) return false;
    if (currentQuery) {
      const hay = ((post.title || "") + " " + post.body).toLowerCase();
      if (!hay.includes(currentQuery)) return false;
    }
    return true;
  }

  function buildEntry(post) {
    const article = document.createElement("article");
    article.className = "entry";

    const type = postType(post);
    const badgeLabel = type === "story" ? "قصة" : "خاطرة";

    const mediaHtml = post.image
      ? `<span class="entry-media" data-full="${post.image}">
           <img src="${post.image}" alt="صورة مرافقة للنص" loading="lazy">
         </span>`
      : "";

    const titleHtml = post.title
      ? `<h2 class="entry-title">${escapeHtml(post.title)}</h2>`
      : "";

    article.innerHTML = `
      <p class="entry-date">${formatDate(post.date_iso)}</p>
      <div class="page">
        <span class="entry-badge ${type}">${badgeLabel}</span>
        ${titleHtml}
        <div class="entry-body">${linkify(post.body)}</div>
        ${mediaHtml}
      </div>
    `;
    return article;
  }

  function renderNextPage() {
    const slice = filtered.slice(renderedCount, renderedCount + PAGE_SIZE);
    const frag = document.createDocumentFragment();
    slice.forEach((post) => frag.appendChild(buildEntry(post)));
    timelineEl.appendChild(frag);
    renderedCount += slice.length;
    loadMoreBtn.hidden = renderedCount >= filtered.length;
  }

  function resetAndRender() {
    timelineEl.innerHTML = "";
    renderedCount = 0;
    filtered = ALL_POSTS.filter(matchesFilter);
    emptyMsg.hidden = filtered.length > 0;
    if (filtered.length > 0) renderNextPage();
    else loadMoreBtn.hidden = true;
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterBtns.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      currentFilter = btn.dataset.filter;
      resetAndRender();
    });
  });

  let searchTimer;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentQuery = e.target.value.trim().toLowerCase();
      resetAndRender();
    }, 200);
  });

  loadMoreBtn.addEventListener("click", renderNextPage);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && renderedCount < filtered.length) {
        renderNextPage();
      }
    });
  }, { rootMargin: "600px" });
  observer.observe(sentinel);

  timelineEl.addEventListener("click", (e) => {
    const media = e.target.closest(".entry-media");
    if (!media) return;
    lightboxImg.src = media.dataset.full;
    lightbox.hidden = false;
  });
  lightboxClose.addEventListener("click", () => { lightbox.hidden = true; lightboxImg.src = ""; });
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) { lightbox.hidden = true; lightboxImg.src = ""; }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !lightbox.hidden) { lightbox.hidden = true; lightboxImg.src = ""; }
  });

  document.getElementById("year").textContent = new Date().getFullYear();

  fetch("data/posts.json", { cache: "no-store" })
    .then((r) => r.json())
    .then((data) => {
      const list = Array.isArray(data) ? data : (data.posts || []);
      ALL_POSTS = list
        .slice()
        .sort((a, b) => new Date(b.date_iso) - new Date(a.date_iso));
      postCountEl.textContent = ALL_POSTS.length.toLocaleString("ar-EG");
      resetAndRender();
    })
    .catch((err) => {
      timelineEl.innerHTML = `<p class="empty-msg">تعذّر تحميل الأرشيف. تأكد من أن ملف data/posts.json موجود.</p>`;
      console.error(err);
    });
})();
