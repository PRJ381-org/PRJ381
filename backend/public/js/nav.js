/**
 * Sidebar page navigation (Home / Feedback / ...).
 * Pure UI state — swaps which .page section is visible, no data logic here.
 */
const links = document.querySelectorAll('.sidebar-link');
const pages = document.querySelectorAll('.page');

links.forEach((link) => {
  link.addEventListener('click', () => {
    const target = link.dataset.page;

    links.forEach((l) => l.classList.remove('active'));
    link.classList.add('active');

    pages.forEach((page) => {
      page.classList.toggle('active', page.id === `page-${target}`);
    });
  });
});
