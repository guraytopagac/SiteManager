const headings = document.querySelectorAll("h2[id]");
const links = document.querySelectorAll(".sidebar nav a");

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        links.forEach((l) => l.classList.remove("active"));
        const active = document.querySelector(`.sidebar nav a[href="#${entry.target.id}"]`);
        if (active) active.classList.add("active");
      }
    });
  },
  { rootMargin: "-20% 0px -70% 0px" },
);

headings.forEach((h) => observer.observe(h));
