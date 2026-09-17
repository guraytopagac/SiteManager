// Guide renderer. This window has no preload, so everything it needs comes in the query string.
const params = new URLSearchParams(window.location.search);

// Set before the first paint, so the guide never shows the wrong theme for a moment.
document.documentElement.dataset.theme = params.get("theme") === "dark" ? "dark" : "light";

function initHeader() {
  const appVersion = params.get("v");
  const versionBadge = document.getElementById("guide-version");
  if (versionBadge && appVersion) {
    versionBadge.textContent = `Sürüm ${appVersion}`;
    versionBadge.hidden = false;
  }

  const supportEmail = params.get("mail");
  const supportWrapper = document.getElementById("guide-support");
  const supportLink = document.getElementById("guide-support-email");
  if (supportWrapper && supportLink && supportEmail) {
    supportLink.textContent = supportEmail;
    supportLink.href = `mailto:${supportEmail}`;
    supportWrapper.hidden = false;
  }
}

function initScrollSpy(sidebarLinks) {
  const sectionHeadings = Array.from(document.querySelectorAll("h2[id]"));

  const setActiveSection = (id) => {
    const activeHash = `#${id}`;
    sidebarLinks.forEach((link) => {
      link.classList.toggle("guide-active", link.hash === activeHash);
    });
  };

  const visibleHeadings = new Set();
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          visibleHeadings.add(entry.target);
        } else {
          visibleHeadings.delete(entry.target);
        }
      }

      if (visibleHeadings.size === 0) return;

      // More than one heading can be on screen, so the highest one wins.
      const topmost = [...visibleHeadings].reduce((a, b) =>
        a.getBoundingClientRect().top <= b.getBoundingClientRect().top ? a : b,
      );
      setActiveSection(topmost.id);
    },
    { rootMargin: "-20% 0px -70% 0px" },
  );

  sectionHeadings.forEach((heading) => sectionObserver.observe(heading));

  if (sectionHeadings.length > 0) {
    setActiveSection(sectionHeadings[0].id);
  }

  sidebarLinks.forEach((link) => {
    link.addEventListener("click", () => setActiveSection(link.hash.slice(1)));
  });
}

// Turns Turkish letters into plain ones, so searching gorunum also finds görünüm.
function normalize(str) {
  return str
    .toLocaleLowerCase("tr")
    .replace(/[ıİ]/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

// Everything between one h2 and the next. This is what the search looks in.
function collectSectionText(id) {
  const heading = document.getElementById(id);
  if (!heading) return "";
  const parts = [heading.textContent];
  let node = heading.nextElementSibling;
  while (node && node.tagName !== "H2") {
    parts.push(node.textContent);
    node = node.nextElementSibling;
  }
  return parts.join(" ");
}

function buildSearchIndex(navItems) {
  const haystacks = new Map();
  let groupLabel = "";
  navItems.forEach((item) => {
    if (item.classList.contains("guide-section-label")) {
      groupLabel = item.textContent;
      return;
    }
    if (item.tagName !== "A") return;
    haystacks.set(item, normalize(`${groupLabel} ${item.textContent} ${collectSectionText(item.hash.slice(1))}`));
  });
  return haystacks;
}

function initSearch(navItems) {
  const searchInput = document.getElementById("guide-search-input");
  const searchEmpty = document.getElementById("guide-search-empty");
  if (!searchInput) return;

  const haystacks = buildSearchIndex(navItems);

  const applyFilter = () => {
    const query = normalize(searchInput.value.trim());
    let anyVisible = false;
    let currentLabel = null;
    let labelHasMatch = false;

    const settleLabel = () => {
      if (currentLabel) {
        currentLabel.classList.toggle("guide-hidden", query !== "" && !labelHasMatch);
      }
    };

    navItems.forEach((item) => {
      if (item.classList.contains("guide-section-label")) {
        settleLabel();
        currentLabel = item;
        labelHasMatch = false;
        return;
      }
      if (item.tagName !== "A") return;
      const match = query === "" || haystacks.get(item).includes(query);
      item.classList.toggle("guide-hidden", !match);
      if (match) {
        anyVisible = true;
        labelHasMatch = true;
      }
    });
    settleLabel();

    if (searchEmpty) searchEmpty.hidden = anyVisible || query === "";
  };

  searchInput.addEventListener("input", applyFilter);

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      searchInput.value = "";
      applyFilter();
    }
  });
}

function initToTop() {
  const toTopButton = document.getElementById("guide-to-top");
  if (!toTopButton) return;

  const toggleToTop = () => {
    toTopButton.classList.toggle("guide-to-top-visible", window.scrollY > 400);
  };
  window.addEventListener("scroll", toggleToTop, { passive: true });
  toTopButton.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  toggleToTop();
}

document.addEventListener("DOMContentLoaded", () => {
  const nav = document.querySelector(".guide-sidebar nav");

  initHeader();
  initScrollSpy(Array.from(nav.querySelectorAll("a")));
  initSearch(Array.from(nav.children));
  initToTop();
});
