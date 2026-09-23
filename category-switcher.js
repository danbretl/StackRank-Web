// Shared by the Movies and Dogs headers. The links remain ordinary navigation.
document.querySelectorAll("[data-category-switcher]").forEach((switcher) => {
  const trigger = switcher.querySelector(".category-switcher__trigger");
  const menu = switcher.querySelector(".category-switcher__menu");
  if (!trigger || !menu) return;

  const close = ({ restoreFocus = false } = {}) => {
    if (menu.hidden) return;
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger.focus();
  };

  trigger.addEventListener("click", () => {
    const opening = menu.hidden;
    menu.hidden = !opening;
    trigger.setAttribute("aria-expanded", String(opening));
  });

  menu.querySelectorAll('a[aria-current="page"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      close({ restoreFocus: true });
    });
  });

  document.addEventListener("pointerdown", (event) => {
    if (!switcher.contains(event.target)) close();
  });

  document.addEventListener("focusin", (event) => {
    if (!switcher.contains(event.target)) close();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || menu.hidden) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    close({ restoreFocus: true });
  }, true);
});
