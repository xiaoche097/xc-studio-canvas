// XC AI Clipper background service worker (Manifest V3)

const WORKBENCH_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'xcwork-tool.online',
  'www.xcwork-tool.online',
]);
const MAX_CLIPPED_IMAGE_BYTES = 20 * 1024 * 1024;

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isTrustedWorkbenchUrl(value) {
  try {
    const url = new URL(value);
    return isHttpUrl(value) && WORKBENCH_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

async function fetchImageAsDataUrl(imageUrl) {
  const response = await fetch(imageUrl, {
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`Image returned ${response.status}`);

  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!contentType.startsWith('image/')) throw new Error('Remote response is not an image');

  const declaredSize = Number(response.headers.get('content-length') || 0);
  if (declaredSize > MAX_CLIPPED_IMAGE_BYTES) throw new Error('Image is larger than 20 MB');

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_CLIPPED_IMAGE_BYTES) throw new Error('Image is larger than 20 MB');

  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

function storeAndBroadcastItem(item, sendResponse) {
  chrome.storage.local.get(['clipped_images'], (result) => {
    const list = Array.isArray(result.clipped_images) ? result.clipped_images : [];
    const updated = [
      item,
      ...list.filter((entry) => entry.id !== item.id && entry.originalUrl !== item.originalUrl),
    ];

    chrome.storage.local.set({ clipped_images: updated }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }

      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id && isTrustedWorkbenchUrl(tab.url)) {
            chrome.tabs.sendMessage(tab.id, { action: 'CLIP_IMAGE', item }).catch((error) => {
              console.debug('[XC AI Clipper] Workbench tab was not ready:', error?.message || error);
            });
          }
        });
      });

      sendResponse({ success: true, item });
    });
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({
      url: 'https://www.xcwork-tool.online/?view=creative&tab=clipper&installed=1',
    });
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !isHttpUrl(tab.url)) {
    console.warn('[XC AI Clipper] Cannot run on this page:', tab?.url);
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_WIDGET' });
    return;
  } catch (error) {
    console.debug('[XC AI Clipper] Content script was not ready:', error?.message || error);
  }

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_WIDGET' });
  } catch (error) {
    console.warn('[XC AI Clipper] Cannot run on this page:', tab.url, error?.message || error);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'CLIP_IMAGE') {
    const sourceUrl = request.sourceUrl || sender.tab?.url || '';
    if (!isHttpUrl(sourceUrl) || !isHttpUrl(request.url)) {
      sendResponse({ success: false, error: 'Only HTTP(S) image URLs are supported.' });
      return false;
    }

    (async () => {
      let stableUrl = request.url;
      let persistence = 'remote-url';
      try {
        stableUrl = await fetchImageAsDataUrl(request.url);
        persistence = 'extension-data';
      } catch (error) {
        console.warn('[XC AI Clipper] Could not cache image bytes; preserving the original URL.', error);
      }

      const item = {
        id: `clip-${Date.now()}`,
        title: request.title || '网页剪藏灵感图',
        url: stableUrl,
        originalUrl: request.url,
        sourceUrl,
        platform: request.platform || 'other',
        category: 'inspiration',
        timestamp: Date.now(),
        persistence,
      };
      storeAndBroadcastItem(item, sendResponse);
    })().catch((error) => {
      sendResponse({ success: false, error: error?.message || String(error) });
    });

    return true;
  }

  if (request.action === 'GET_CLIPPED_IMAGES') {
    chrome.storage.local.get(['clipped_images'], (result) => {
      sendResponse({ items: result.clipped_images || [] });
    });
    return true;
  }

  return false;
});
