function isWatchPage() {
  return location.pathname === "/watch";
}

function ensureStyle() {
  let style = document.getElementById("de-algorithm-hide-youtube-secondary");

  if (!isWatchPage()) {
    if (style) style.remove();
    return;
  }

  if (style) return;

  style = document.createElement("style");
  style.id = "de-algorithm-hide-youtube-secondary";
  style.textContent = `
    ytd-watch-flexy #secondary,
    ytd-watch-flexy #secondary-inner {
      display: none !important;
    }

    ytd-watch-flexy #primary {
      width: 100% !important;
      max-width: none !important;
    }
  `;
  document.documentElement.appendChild(style);
}

ensureStyle();

new MutationObserver(() => ensureStyle()).observe(document.documentElement, {
  childList: true,
  subtree: true
});

window.addEventListener("yt-navigate-finish", ensureStyle);
window.addEventListener("popstate", ensureStyle);