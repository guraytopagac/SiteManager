const sectionHeadings = document.querySelectorAll("h2[id]");
const sidebarLinks = document.querySelectorAll(".guide-sidebar nav a");

function setActiveSidebarLink(sectionId) {
  sidebarLinks.forEach((link) => link.classList.remove("guide-active"));
  const matchingLink = document.querySelector(`.guide-sidebar nav a[href="#${sectionId}"]`);
  if (matchingLink) matchingLink.classList.add("guide-active");
}

function handleSectionVisibilityChange(entries) {
  const visibleEntry = entries.find((entry) => entry.isIntersecting);
  if (visibleEntry) setActiveSidebarLink(visibleEntry.target.id);
}

const sectionObserver = new IntersectionObserver(handleSectionVisibilityChange, {
  rootMargin: "-20% 0px -70% 0px",
});

sectionHeadings.forEach((heading) => sectionObserver.observe(heading));
