const sectionHeadings = document.querySelectorAll("h2[id]");
const sidebarLinks = document.querySelectorAll(".guide-sidebar nav a");

const sectionObserver = new IntersectionObserver(
  (entries) => {
    const visibleEntry = entries.find((entry) => entry.isIntersecting);
    if (!visibleEntry) return;

    sidebarLinks.forEach((link) => {
      link.classList.toggle("guide-active", link.hash === `#${visibleEntry.target.id}`);
    });
  },
  { rootMargin: "-20% 0px -70% 0px" }
);

sectionHeadings.forEach((heading) => sectionObserver.observe(heading));
