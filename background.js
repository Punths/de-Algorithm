const RANDOM_WIKI = "https://en.wikipedia.org/wiki/Special:Random";

// Configurations (in milliseconds)
const PASS_DURATION = 20 * 60 * 1000;       // 20 Minutes
const LOCKOUT_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 Days
const HEARTBEAT_INTERVAL = 60 * 1000;       // 1 Minute check

// Initialize storage and the anti-tamper heartbeat tracker
browser.runtime.onInstalled.addListener(() => {
  browser.storage.local.set({
    passExpiry: 0,
    lockoutExpiry: 0,
    lastKnownTime: Date.now(),
    tamperLocked: false
  });
});

// Heartbeat system to detect system clock manipulation
setInterval(async () => {
  const data = await browser.storage.local.get(['lastKnownTime', 'passExpiry', 'lockoutExpiry', 'tamperLocked']);
  if (data.tamperLocked) return;

  const now = Date.now();
  const timeDelta = now - data.lastKnownTime;

  // Anti-Cheat Rules:
  // 1. Time moved backwards (Delta is negative)
  // 2. Time jumped forward aggressively (Delta is significantly greater than our 1-minute interval)
  if (timeDelta < 0 || timeDelta > (HEARTBEAT_INTERVAL + 15000)) {
    // If a pass was active or they are bypassing lockout, trigger penalty
    if ((data.passExpiry && now < data.passExpiry) || (data.lockoutExpiry && now < data.lockoutExpiry)) {
      await browser.storage.local.set({ 
        tamperLocked: true,
        lockoutExpiry: Date.now() + LOCKOUT_DURATION // Hard reset 7 days penalty
      });
    }
  }

  // Always update the checkpoint to current time if things are normal
  await browser.storage.local.set({ lastKnownTime: Date.now() });
}, HEARTBEAT_INTERVAL);


// Listen for the activation command from the popup dropdown
browser.runtime.onMessage.addListener(async (message) => {
  if (message.action === "startPass") {
    const data = await browser.storage.local.get(['passExpiry', 'lockoutExpiry', 'tamperLocked']);
    const now = Date.now();

    if (data.tamperLocked || (data.lockoutExpiry && now < data.lockoutExpiry)) {
      return { success: false, reason: "Locked out" };
    }

    const newPassExpiry = now + PASS_DURATION;
    const newLockoutExpiry = newPassExpiry + LOCKOUT_DURATION;

    await browser.storage.local.set({
      passExpiry: newPassExpiry,
      lockoutExpiry: newLockoutExpiry,
      lastKnownTime: now
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
    const data = await browser.storage.local.get(['passExpiry', 'tamperLocked']);
    const now = Date.now();
    
    if (!data.tamperLocked && data.passExpiry && now < data.passExpiry) {
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

  // shouldBlock is now an async function, we must await its verification
  const blockMe = await shouldBlock(url);
  if (blockMe) {
    await bounce(details.tabId);
  }
}

browser.webNavigation.onCommitted.addListener(handle);
browser.webNavigation.onHistoryStateUpdated.addListener(handle);
browser.webNavigation.onReferenceFragmentUpdated.addListener(handle);