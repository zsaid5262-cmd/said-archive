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

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // نطاق حروف العربية المستخدم لتحديد حدود الكلمة (بديل \b الذي لا يدعم العربية)
  const ARABIC_LETTERS = "\\u0621-\\u064A\\u0660-\\u0669\\u066E-\\u06D3\\u06D5\\uFB50-\\uFDFF\\uFE70-\\uFEFF";

  function buildSearchRegex(query) {
    const trimmed = query.trim();
    if (!trimmed) return null;
    // إزالة التشكيل من كلمة البحث، ومعاملة كل صور الألف (ا أ إ آ) كحرف واحد
    const cleaned = trimmed.replace(/[\u064B-\u0652]/g, "");
    const escaped = escapeRegex(cleaned).replace(/[اأإآ]/g, "[اأإآ]");
    try {
      return new RegExp(`(?<![${ARABIC_LETTERS}])${escaped}(?![${ARABIC_LETTERS}])`, "gi");
    } catch (e) {
      // بعض المتصفحات القديمة لا تدعم lookbehind — نعود لمطابقة بسيطة عندها
      return new RegExp(escaped, "gi");
    }
  }

  function postType(post) {
    return post.title ? "story" : "khatera";
  }

  function matchesFilter(post, searchRegex) {
    if (currentFilter !== "all" && postType(post) !== currentFilter) return false;
    if (searchRegex) {
      searchRegex.lastIndex = 0;
      const hay = (post.title || "") + " " + post.body;
      if (!searchRegex.test(hay)) return false;
    }
    return true;
  }

  const REACTIONS = ["❤️", "😢", "😊", "👏"];
  const REACTION_LABELS = { "❤️": "قلب", "😢": "حزن", "😊": "ابتسامة", "👏": "تصفيق" };

  function slugify(post) {
    return post.date_iso.replace(/[^0-9]/g, "");
  }

  function reactionCounterKey(post, emoji) {
    return `said-abuzeinah-reaction-${slugify(post)}-${REACTION_LABELS[emoji]}`;
  }

  function votedKey(post) {
    return "voted:" + post.date_iso;
  }

  function getVotedEmoji(post) {
    try { return localStorage.getItem(votedKey(post)); } catch (e) { return null; }
  }

  function markVoted(post, emoji) {
    try { localStorage.setItem(votedKey(post), emoji); } catch (e) { /* ignore */ }
  }

  function highlight(escapedHtml, searchRegex) {
    if (!searchRegex) return escapedHtml;
    searchRegex.lastIndex = 0;
    return escapedHtml.replace(searchRegex, (m) => `<mark class="hl">${m}</mark>`);
  }

  function buildEntry(post, searchRegex) {
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
      ? `<h2 class="entry-title">${highlight(escapeHtml(post.title), searchRegex)}</h2>`
      : "";

    const votedEmoji = getVotedEmoji(post);
    const reactionsHtml = `
      <div class="entry-reactions" role="group" aria-label="تفاعل">
        ${REACTIONS.map((emoji) => `
          <button type="button" class="reaction-btn${emoji === votedEmoji ? " is-selected" : ""}" data-emoji="${emoji}" ${votedEmoji ? "disabled" : ""}>
            <span class="reaction-emoji">${emoji}</span>
            <span class="reaction-total" data-emoji-total="${emoji}">—</span>
          </button>
        `).join("")}
      </div>
    `;

    article.innerHTML = `
      <p class="entry-date">${formatDate(post.date_iso)}</p>
      <div class="page">
        <span class="entry-badge ${type}">${badgeLabel}</span>
        ${titleHtml}
        <div class="entry-body">${highlight(linkify(post.body), searchRegex)}</div>
        ${mediaHtml}
        ${reactionsHtml}
      </div>
    `;
    article._post = post;
    return article;
  }

  function loadReactionCounts(article) {
    const post = article._post;
    REACTIONS.forEach((emoji) => {
      const key = reactionCounterKey(post, emoji);
      fetch(`https://countapi.mileshilliard.com/api/v1/get/${key}`)
        .then((r) => (r.ok ? r.json() : { value: 0 }))
        .then((data) => {
          const el = article.querySelector(`[data-emoji-total="${emoji}"]`);
          if (el) el.textContent = Number(data.value || 0).toLocaleString("ar-EG");
        })
        .catch(() => {
          const el = article.querySelector(`[data-emoji-total="${emoji}"]`);
          if (el) el.textContent = "0";
        });
    });
  }

  const reactionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        loadReactionCounts(entry.target);
        reactionObserver.unobserve(entry.target);
      }
    });
  }, { rootMargin: "200px" });

  function renderNextPage() {
    const slice = filtered.slice(renderedCount, renderedCount + PAGE_SIZE);
    const searchRegex = buildSearchRegex(currentQuery);
    const frag = document.createDocumentFragment();
    const newArticles = [];
    slice.forEach((post) => {
      const article = buildEntry(post, searchRegex);
      frag.appendChild(article);
      newArticles.push(article);
    });
    timelineEl.appendChild(frag);
    newArticles.forEach((a) => reactionObserver.observe(a));
    renderedCount += slice.length;
    loadMoreBtn.hidden = renderedCount >= filtered.length;
  }

  function resetAndRender() {
    timelineEl.innerHTML = "";
    renderedCount = 0;
    const searchRegex = buildSearchRegex(currentQuery);
    filtered = ALL_POSTS.filter((post) => matchesFilter(post, searchRegex));
    emptyMsg.hidden = filtered.length > 0;
    if (filtered.length > 0) {
      renderNextPage();
      if (currentQuery) {
        setTimeout(() => {
          const firstMark = timelineEl.querySelector("mark.hl");
          if (firstMark) firstMark.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 50);
      }
    } else {
      loadMoreBtn.hidden = true;
    }
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
      currentQuery = e.target.value.trim();
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
    if (media) {
      lightboxImg.src = media.dataset.full;
      lightbox.hidden = false;
      return;
    }
    const reactionBtn = e.target.closest(".reaction-btn");
    if (reactionBtn && !reactionBtn.disabled) {
      const article = reactionBtn.closest(".entry");
      const post = article && article._post;
      if (!post || getVotedEmoji(post)) return;
      const emoji = reactionBtn.dataset.emoji;
      const key = reactionCounterKey(post, emoji);
      article.querySelectorAll(".reaction-btn").forEach((b) => (b.disabled = true));
      fetch(`https://countapi.mileshilliard.com/api/v1/hit/${key}`)
        .then((r) => r.json())
        .then((data) => {
          const el = article.querySelector(`[data-emoji-total="${emoji}"]`);
          if (el) el.textContent = Number(data.value || 0).toLocaleString("ar-EG");
          reactionBtn.classList.add("is-selected");
          markVoted(post, emoji);
        })
        .catch(() => {
          article.querySelectorAll(".reaction-btn").forEach((b) => (b.disabled = false));
        });
    }
  });
  lightboxClose.addEventListener("click", () => { lightbox.hidden = true; lightboxImg.src = ""; });
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) { lightbox.hidden = true; lightboxImg.src = ""; }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !lightbox.hidden) { lightbox.hidden = true; lightboxImg.src = ""; }
  });

  document.getElementById("year").textContent = new Date().getFullYear();

  // تحميل أداة الترجمة فقط عند الطلب، لتفادي تعارضها مع تحديث الصفحة الديناميكي (البحث والتصفية)
  const translateToggle = document.getElementById("translate-toggle");
  const translateWidget = document.getElementById("google_translate_element");
  let translateLoaded = false;
  if (translateToggle) {
    translateToggle.addEventListener("click", () => {
      translateWidget.hidden = false;
      if (translateLoaded) return;
      translateLoaded = true;
      window.googleTranslateElementInit = function () {
        new google.translate.TranslateElement(
          { pageLanguage: "ar", autoDisplay: false },
          "google_translate_element"
        );
      };
      const s = document.createElement("script");
      s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
      document.body.appendChild(s);
    });
  }

  // عداد الزوار — خدمة مجانية بدون تسجيل
  const visitorCountEl = document.getElementById("visitor-count");
  fetch("https://countapi.mileshilliard.com/api/v1/hit/said-abuzeinah-archive-visits")
    .then((r) => r.json())
    .then((data) => { if (visitorCountEl) visitorCountEl.textContent = Number(data.value).toLocaleString("ar-EG"); })
    .catch(() => { if (visitorCountEl) visitorCountEl.textContent = "—"; });

  // نموذج الاشتراك بالنشرة البريدية (Netlify Forms)
  const newsletterForm = document.getElementById("newsletter-form");
  const newsletterMsg = document.getElementById("newsletter-msg");
  if (newsletterForm) {
    newsletterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const body = new URLSearchParams(new FormData(newsletterForm)).toString();
      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      })
        .then(() => {
          newsletterMsg.textContent = "تم الاشتراك بنجاح، شكرًا لك!";
          newsletterMsg.hidden = false;
          newsletterForm.reset();
        })
        .catch(() => {
          newsletterMsg.textContent = "حدث خطأ، حاول مرة أخرى لاحقًا.";
          newsletterMsg.hidden = false;
        });
    });
  }

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
