const appVersion = new URLSearchParams(window.location.search).get("v");
const versionBadge = document.getElementById("guide-version");
if (versionBadge && appVersion) {
  versionBadge.textContent = `Sürüm ${appVersion}`;
}

const sectionHeadings = Array.from(document.querySelectorAll("h2[id]"));
const sidebarLinks = Array.from(document.querySelectorAll(".guide-sidebar nav a"));

function setActiveSection(id) {
  const activeHash = `#${id}`;
  sidebarLinks.forEach((link) => {
    link.classList.toggle("guide-active", link.hash === activeHash);
  });
}

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

const searchInput = document.getElementById("guide-search-input");
const searchEmpty = document.getElementById("guide-search-empty");
if (searchInput) {
  const nav = document.querySelector(".guide-sidebar nav");
  const navItems = Array.from(nav.children);

  const normalize = (str) =>
    str
      .toLocaleLowerCase("tr")
      .replace(/[ıİ]/g, "i")
      .replace(/ş/g, "s")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c");

  searchInput.addEventListener("input", () => {
    const query = normalize(searchInput.value.trim());
    let anyVisible = false;
    navItems.forEach((item) => {
      if (item.tagName !== "A") return;
      const match = query === "" || normalize(item.textContent).includes(query);
      item.classList.toggle("guide-hidden", !match);
      if (match) anyVisible = true;
    });
    navItems.forEach((item, index) => {
      if (!item.classList.contains("guide-section-label")) return;
      let hasVisibleLink = false;
      for (let i = index + 1; i < navItems.length; i++) {
        if (navItems[i].classList.contains("guide-section-label")) break;
        if (navItems[i].tagName === "A" && !navItems[i].classList.contains("guide-hidden")) {
          hasVisibleLink = true;
          break;
        }
      }
      item.classList.toggle("guide-hidden", query !== "" && !hasVisibleLink);
    });
    if (searchEmpty) searchEmpty.hidden = anyVisible || query === "";
  });

  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      searchInput.value = "";
      searchInput.dispatchEvent(new Event("input"));
    }
  });
}

const toTopButton = document.getElementById("guide-to-top");
if (toTopButton) {
  const toggleToTop = () => {
    toTopButton.classList.toggle("guide-to-top-visible", window.scrollY > 400);
  };
  window.addEventListener("scroll", toggleToTop, { passive: true });
  toTopButton.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  toggleToTop();
}
