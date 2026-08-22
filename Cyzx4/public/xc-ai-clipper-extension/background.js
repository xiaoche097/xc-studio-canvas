// XC AI Clipper Background Service Worker (Manifest V3)

const WORKBENCH_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'xcwork-tool.online', 'www.xcwork-tool.online']);

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

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[XC AI Clipper] Extension installed successfully');
    // 安装完成后自动打开 Web 应用页面，并带上 #clipper-installed 标识自动调起灵感随手收指南
    chrome.tabs.create({
      url: 'https://www.xcwork-tool.online/#clipper-installed',
    });
  }
});

// 点击工具栏扩展图标时，在当前网页 DOM 中展开/收起浮动组件（完全像 Lovart 扩展一样免弹窗框）
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !isHttpUrl(tab.url)) {
    console.warn('[XC AI Clipper] Cannot run on this page:', tab?.url, 'Restricted or unsupported URL');
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

// 监听来自 Content Script 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'CLIP_IMAGE') {
    const sourceUrl = request.sourceUrl || sender.tab?.url || '';
    if (!isHttpUrl(sourceUrl) || !isHttpUrl(request.url)) {
      sendResponse({ success: false, error: 'Only HTTP(S) image URLs are supported.' });
      return false;
    }

    const item = {
      id: `clip-${Date.now()}`,
      title: request.title || '网页剪藏灵感图',
      url: request.url,
      sourceUrl,
      platform: request.platform || 'other',
      category: 'inspiration',
      timestamp: Date.now(),
    };

    // 保存到 chrome.storage.local 并实时向所有打开的 XC AI Web 应用标签页广播推送
    chrome.storage.local.get(['clipped_images'], (result) => {
      const list = result.clipped_images || [];
      const updated = [item, ...list];
      chrome.storage.local.set({ clipped_images: updated }, () => {
        console.log('[XC AI Clipper] Image saved to storage:', item);

        // 广播通知所有 Web 应用 Tab 页 (包含线上生产域名 www.xcwork-tool.online 及 本地地址)
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((t) => {
            if (t.id && isTrustedWorkbenchUrl(t.url)) {
              chrome.tabs.sendMessage(t.id, { action: 'CLIP_IMAGE', item }).catch((error) => {
                console.debug('[XC AI Clipper] Workbench tab was not ready:', error?.message || error);
              });
            }
          });
        });

        sendResponse({ success: true, item });
      });
    });

    return true; // 保持异步响应管道
  }

  if (request.action === 'GET_CLIPPED_IMAGES') {
    chrome.storage.local.get(['clipped_images'], (result) => {
      sendResponse({ items: result.clipped_images || [] });
    });
    return true;
  }
});
