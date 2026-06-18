const RANDOM_WIKI = "https://en.wikipedia.org/wiki/Special:Random";

// Configurations (in milliseconds)
const PASS_DURATION = 20 * 60 * 1000;             // 20 Minutes active pass
const LOCKOUT_DURATION = 7 * 24 * 60 * 60 * 1000;   // 1 Week cooldown before next pass

// Initialize storage cleanly on install
browser.runtime.onInstalled.addListener(() => {
  browser.storage.local.set({
    passExpiry: 0,
    lockoutExpiry: 0
  });
});

// Listen for the activation command from the popup script
browser.runtime.onMessage.addListener(async (message) => {
  if (message.action === "START_PASS") {
    const data = await browser.storage.local.get(['lockoutExpiry']);
    const now = Date.now();

    // Check if user is currently on a active 1-week lockout cooldown
    if (data.lockoutExpiry && now < data.lockoutExpiry) {
      return { success: false, reason: "Locked out" };
    }

    // Set pass expiration and start the 1-week lockout timer immediately
    await browser.storage.local.set({
      passExpiry: now + PASS_DURATION,
      lockoutExpiry: now + LOCKOUT_DURATION
    });

    return { success: true };
  }
});

function isReddit(host) {
  host = host.toLowerCase();
  return host === "reddit.com" || host.endsWith(".reddit.com");
}

function isYouTube(host) {
  host = host.toLowerCase();
  return host === "youtube.com" || host.endsWith(".youtube.com");
}

// Main logic updated to evaluate if a temporary bypass pass is running
async function shouldBlock(url) {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const host = url.hostname;
  const path = url.pathname;

  if (isReddit(host)) {
    const allowed =
      /^\/comments\/[^/]+\/?/i.test(path) ||
      /^\/r\/[^/]+\/comments\/[^/]+\/?/i.test(path);

    if (allowed) return false;

    return (
      path === "/" ||
      /^\/(best|hot|new|top|rising|controversial)\/?$/i.test(path) ||
      /^\/r\/(all|popular)(\/|$)/i.test(path) ||
      /^\/r\/[^/]+\/?$/i.test(path) ||
      /^\/r\/[^/]+\/(hot|new|top|rising|controversial)\/?/i.test(path)
    );
  }

  if (isYouTube(host)) {
    // Check if user has an active pass right now
    const data = await browser.storage.local.get(['passExpiry']);
    const now = Date.now();
    
    if (data.passExpiry && now < data.passExpiry) {
      return false; // Dynamic Exception: Allow them onto the homepage!
    }

    if (path === "/watch") return false;
    return path === "/" || path.startsWith("/feed/");
  }

  return false;
}

async function bounce(tabId) {
  try {
    await browser.tabs.update(tabId, { url: RANDOM_WIKI });
  } catch (e1) {
    try {
      await browser.tabs.update(tabId, { url: "https://www.wikipedia.org/" });
    } catch (e2) { }
  }
}

async function handle(details) {
  if (details.frameId !== 0) return;

  let url;
  try {
    url = new URL(details.url);
  } catch {
    return;
  }

  if (url.protocol === "about:" || url.protocol === "moz-extension:") return;

  // shouldBlock is an async function, we must await its verification
  const blockMe = await shouldBlock(url);
  if (blockMe) {
    await bounce(details.tabId);
  }
}

browser.webNavigation.onCommitted.addListener(handle);
browser.webNavigation.onHistoryStateUpdated.addListener(handle);
browser.webNavigation.onReferenceFragmentUpdated.addListener(handle);