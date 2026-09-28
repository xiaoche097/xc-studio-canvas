// XC AI Clipper Content Script (Manifest V3 - 免弹窗框 网页原生悬浮)
(function () {
  if (window.__XC_AI_CLIPPER_CONTENT_LOADED__) return;
  window.__XC_AI_CLIPPER_CONTENT_LOADED__ = true;

  console.log('[XC AI Clipper] In-page overlay active');

  const WORKBENCH_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'xcwork-tool.online', 'www.xcwork-tool.online']);
  const CLIPPER_LIBRARY_URL = 'https://www.xcwork-tool.online/?view=creative&tab=clipper';
  const SITE_SETTINGS_STORAGE_KEY = 'site_settings';
  const SITE_SETTING_KEYS = Object.freeze({
    instagram: 'site-ig',
    rednote: 'site-red',
    amazon: 'site-amz',
    taobao: 'site-tb',
    tmall: 'site-tb',
    pinterest: 'site-pin',
  });
  let siteSettings = {};

  function isHttpPage() {
    return window.location.protocol === 'http:' || window.location.protocol === 'https:';
  }

  function isTrustedWorkbench() {
    return isHttpPage() && WORKBENCH_HOSTS.has(window.location.hostname.toLowerCase());
  }

  function isSaveSurfaceEnabled() {
    return isHttpPage() && !isTrustedWorkbench();
  }

  function normalizeHttpImageUrl(raw) {
    if (!raw || typeof raw !== 'string') return '';
    try {
      const url = new URL(raw.trim(), document.baseURI);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  }

  function getLargestSrcsetUrl(srcset) {
    if (!srcset) return '';
    const candidates = srcset.split(',').map((entry) => {
      const parts = entry.trim().split(/\s+/);
      const descriptor = parts[1] || '';
      const score = Number.parseFloat(descriptor) || 0;
      return { url: normalizeHttpImageUrl(parts[0]), score };
    }).filter((entry) => entry.url);
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.url || '';
  }

  function getAmazonDynamicImageUrl(img) {
    const raw = img?.getAttribute?.('data-a-dynamic-image');
    if (!raw) return '';
    try {
      const entries = Object.entries(JSON.parse(raw)).map(([url, dimensions]) => ({
        url: normalizeHttpImageUrl(url),
        area: Array.isArray(dimensions) ? Number(dimensions[0] || 0) * Number(dimensions[1] || 0) : 0,
      })).filter((entry) => entry.url);
      entries.sort((a, b) => b.area - a.area);
      return entries[0]?.url || '';
    } catch {
      return '';
    }
  }

  function getSafeImageUrl(img) {
    if (!img) return '';
    const candidates = [
      getAmazonDynamicImageUrl(img),
      getLargestSrcsetUrl(img.getAttribute?.('srcset') || img.getAttribute?.('data-srcset')),
      img.getAttribute?.('data-old-hires'),
      img.getAttribute?.('data-zoom-image'),
      img.getAttribute?.('data-origin'),
      img.getAttribute?.('data-original'),
      img.getAttribute?.('data-ks-lazyload'),
      img.getAttribute?.('data-lazy-src'),
      img.getAttribute?.('data-src'),
      img.currentSrc,
      img.src,
      img.getAttribute?.('src'),
    ];
    for (const candidate of candidates) {
      const url = normalizeHttpImageUrl(candidate);
      if (url) return url;
    }
    return '';
  }

  function getImageUrlKey(rawUrl) {
    const imageUrl = normalizeHttpImageUrl(rawUrl);
    if (!imageUrl) return '';
    try {
      const url = new URL(imageUrl);
      url.hash = '';
      if (/pinimg\.com$|xhscdn\.com$|alicdn\.com$|tbcdn\.cn$|media-amazon\.com$/i.test(url.hostname)) {
        url.search = '';
      }
      return `${url.hostname.toLowerCase()}${url.pathname}`;
    } catch {
      return imageUrl;
    }
  }

  function createImageSnapshot(url) {
    const snapshot = document.createElement('img');
    snapshot.src = url;
    return snapshot;
  }

  // 心跳与初始化广播
  function announceExtension() {
    if (!isTrustedWorkbench()) return;
    window.postMessage(
      {
        type: 'XC_CLIPPER_PONG',
        version: '1.1.5',
        isPinterest: window.location.hostname.includes('pinterest.com'),
        url: window.location.href,
      },
      '*'
    );
  }

  setInterval(announceExtension, 1000);
  announceExtension();

  // 普通 HTTP(S) 页面支持保存，可信工作台只保留工作台同步，不显示图片保存按钮。
  function canClipPageImages() {
    const settingKey = SITE_SETTING_KEYS[getPlatformName()];
    return isSaveSurfaceEnabled() && Boolean(settingKey) && siteSettings[settingKey] !== false;
  }

  function renderSiteSwitch(button, enabled) {
    const knob = button.querySelector('[data-xc-switch-knob]');
    button.setAttribute('aria-checked', String(enabled));
    button.style.background = enabled ? '#ffffff' : '#4a4a4e';
    if (!knob) return;
    knob.style.background = enabled ? '#1c1c1e' : '#ffffff';
    knob.style.left = enabled ? 'auto' : '2px';
    knob.style.right = enabled ? '2px' : 'auto';
  }

  function renderAllSiteSwitches() {
    if (!overlayContainer) return;
    overlayContainer.querySelectorAll('[data-xc-site-setting]').forEach((button) => {
      const settingKey = button.dataset.xcSiteSetting;
      renderSiteSwitch(button, siteSettings[settingKey] !== false);
    });
  }

  function hideClipActionsWhenDisabled() {
    if (canClipPageImages()) return;
    if (hoverButtonsWrapper) {
      hoverButtonsWrapper.remove();
      hoverButtonsWrapper = null;
    }
    currentTargetImg = null;
    document.getElementById('xc-batch-select-modal')?.remove();
  }

  function bindSiteSwitches() {
    if (!overlayContainer) return;
    const buttons = overlayContainer.querySelectorAll('[data-xc-site-setting]');

    buttons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const settingKey = button.dataset.xcSiteSetting;
        if (!settingKey) return;

        const enabled = siteSettings[settingKey] === false;
        siteSettings = { ...siteSettings, [settingKey]: enabled };
        renderAllSiteSwitches();
        hideClipActionsWhenDisabled();

        chrome.storage.local.get([SITE_SETTINGS_STORAGE_KEY], (result) => {
          const storedSettings = result[SITE_SETTINGS_STORAGE_KEY] || {};
          chrome.storage.local.set({
            [SITE_SETTINGS_STORAGE_KEY]: { ...storedSettings, [settingKey]: enabled },
          });
        });
      });
    });

    chrome.storage.local.get([SITE_SETTINGS_STORAGE_KEY], (result) => {
      siteSettings = { ...(result[SITE_SETTINGS_STORAGE_KEY] || {}) };
      renderAllSiteSwitches();
      hideClipActionsWhenDisabled();
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[SITE_SETTINGS_STORAGE_KEY]) return;
    siteSettings = { ...(changes[SITE_SETTINGS_STORAGE_KEY].newValue || {}) };
    renderAllSiteSwitches();
    hideClipActionsWhenDisabled();
  });

  // 1. 全网网页右上角常驻/点击展开与关闭的极简无框胶囊组件
  let overlayContainer = null;
  let isPanelOpen = false;

  function initInPageWidget() {
    if (!isHttpPage()) return false;
    const existingOverlay = document.getElementById('xc-ai-clipper-inpage-overlay');
    if (existingOverlay) {
      overlayContainer = existingOverlay;
      overlayContainer.style.display = 'block';
      return false;
    }

    overlayContainer = document.createElement('div');
    overlayContainer.id = 'xc-ai-clipper-inpage-overlay';
    overlayContainer.dataset.xcAiClipperUi = 'true';
    overlayContainer.style.cssText = `
      position: fixed !important;
      top: 14px !important;
      right: 18px !important;
      z-index: 2147483647 !important;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif !important;
      user-select: none !important;
      pointer-events: auto !important;
      line-height: 1.2 !important;
      width: 235px !important;
    `;

    overlayContainer.innerHTML = `
      <div>
        <!-- 顶部极简独立胶囊 Header (100% 极简对齐图 1) -->
        <div id="xc-header-pill" style="
          background-color: #232325;
          border-radius: 999px;
          padding: 4px 5px 4px 6px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45);
        ">
          <div style="display: flex; align-items: center; gap: 7px;">
            <div style="
              width: 26px;
              height: 26px;
              border-radius: 50%;
              background-color: #050505;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 700;
              font-size: 12.5px;
              color: #ffffff;
            ">XC</div>
            <span style="font-size: 12.5px; font-weight: 600; color: #ffffff;">XC AI Clipper</span>
          </div>

          <div style="display: flex; align-items: center; gap: 4px;">
            <button id="xc-btn-settings" title="Works on supported websites" style="
              width: 26px;
              height: 26px;
              border-radius: 50%;
              background-color: #38383a;
              border: none;
              color: #d1d5db;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: background 0.15s;
            ">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
            </button>
            <button id="xc-btn-view" style="
              background-color: #ffffff;
              color: #000000;
              font-weight: 700;
              font-size: 12px;
              padding: 4px 13px;
              border-radius: 999px;
              border: none;
              cursor: pointer;
            ">View</button>
          </div>
        </div>

        <!-- 点击设置按钮展示支持的网站面板 -->
        <div id="xc-dropdown-panel" style="
          display: none;
          margin-top: 6px;
          background-color: #232325;
          border-radius: 20px;
          padding: 14px 16px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 14px 40px rgba(0, 0, 0, 0.5);
        ">
          <div style="font-size: 11px; font-weight: 500; color: #8e8e93; margin-bottom: 12px;">Works on supported websites</div>

          <div style="display: flex; flex-direction: column; gap: 13px;">
            <!-- Instagram -->
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 20px; height: 20px; border-radius: 6px; background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); display: flex; align-items: center; justify-content: center;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                </div>
                <span style="font-size: 13px; font-weight: 500; color: #ffffff;">Instagram</span>
              </div>
              <button type="button" role="switch" aria-checked="true" aria-label="启用 Instagram 图片采集" data-xc-site-setting="site-ig" style="width: 36px; height: 20px; padding: 0; border: 0; border-radius: 999px; background: #ffffff; position: relative; cursor: pointer; transition: background 0.2s;">
                <span data-xc-switch-knob style="width: 16px; height: 16px; border-radius: 50%; background: #1c1c1e; position: absolute; top: 2px; right: 2px; transition: left 0.2s, right 0.2s, background 0.2s;"></span>
              </button>
            </div>

            <!-- Rednote -->
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 20px; height: 20px; border-radius: 6px; background: #ff2442; color: #fff; font-size: 9px; font-weight: 900; display: flex; align-items: center; justify-content: center;">xhs</div>
                <span style="font-size: 13px; font-weight: 500; color: #ffffff;">Rednote</span>
              </div>
              <button type="button" role="switch" aria-checked="true" aria-label="启用 Rednote 图片采集" data-xc-site-setting="site-red" style="width: 36px; height: 20px; padding: 0; border: 0; border-radius: 999px; background: #ffffff; position: relative; cursor: pointer; transition: background 0.2s;">
                <span data-xc-switch-knob style="width: 16px; height: 16px; border-radius: 50%; background: #1c1c1e; position: absolute; top: 2px; right: 2px; transition: left 0.2s, right 0.2s, background 0.2s;"></span>
              </button>
            </div>

            <!-- Amazon -->
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 20px; height: 20px; border-radius: 6px; background: #232f3e; color: #ff9900; font-size: 10px; font-weight: 900; display: flex; align-items: center; justify-content: center;">a</div>
                <span style="font-size: 13px; font-weight: 500; color: #ffffff;">Amazon</span>
              </div>
              <button type="button" role="switch" aria-checked="true" aria-label="启用 Amazon 图片采集" data-xc-site-setting="site-amz" style="width: 36px; height: 20px; padding: 0; border: 0; border-radius: 999px; background: #ffffff; position: relative; cursor: pointer; transition: background 0.2s;">
                <span data-xc-switch-knob style="width: 16px; height: 16px; border-radius: 50%; background: #1c1c1e; position: absolute; top: 2px; right: 2px; transition: left 0.2s, right 0.2s, background 0.2s;"></span>
              </button>
            </div>

            <!-- Taobao -->
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 20px; height: 20px; border-radius: 6px; background: #ff5000; color: #fff; font-size: 9px; font-weight: 900; display: flex; align-items: center; justify-content: center;">tb</div>
                <span style="font-size: 13px; font-weight: 500; color: #ffffff;">Taobao</span>
              </div>
              <button type="button" role="switch" aria-checked="true" aria-label="启用 Taobao 图片采集" data-xc-site-setting="site-tb" style="width: 36px; height: 20px; padding: 0; border: 0; border-radius: 999px; background: #ffffff; position: relative; cursor: pointer; transition: background 0.2s;">
                <span data-xc-switch-knob style="width: 16px; height: 16px; border-radius: 50%; background: #1c1c1e; position: absolute; top: 2px; right: 2px; transition: left 0.2s, right 0.2s, background 0.2s;"></span>
              </button>
            </div>

            <!-- Pinterest -->
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 20px; height: 20px; border-radius: 6px; background: #e60023; color: #fff; font-size: 10px; font-weight: 900; display: flex; align-items: center; justify-content: center;">P</div>
                <span style="font-size: 13px; font-weight: 500; color: #ffffff;">Pinterest</span>
              </div>
              <button type="button" role="switch" aria-checked="true" aria-label="启用 Pinterest 图片采集" data-xc-site-setting="site-pin" style="width: 36px; height: 20px; padding: 0; border: 0; border-radius: 999px; background: #ffffff; position: relative; cursor: pointer; transition: background 0.2s;">
                <span data-xc-switch-knob style="width: 16px; height: 16px; border-radius: 50%; background: #1c1c1e; position: absolute; top: 2px; right: 2px; transition: left 0.2s, right 0.2s, background 0.2s;"></span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlayContainer);
    bindSiteSwitches();

    // 事件绑定
    const btnView = document.getElementById('xc-btn-view');
    const btnSettings = document.getElementById('xc-btn-settings');
    const btnCloseWidget = document.getElementById('xc-btn-close-widget');
    const dropdownPanel = document.getElementById('xc-dropdown-panel');
    const btnBatch = document.getElementById('xc-btn-batch');

    if (btnView) {
      btnView.addEventListener('click', () => {
        window.open(CLIPPER_LIBRARY_URL, '_blank');
      });
    }

    if (btnCloseWidget) {
      btnCloseWidget.addEventListener('click', () => {
        if (overlayContainer) overlayContainer.style.display = 'none';
      });
    }

    if (btnSettings && dropdownPanel) {
      btnSettings.addEventListener('click', (e) => {
        e.stopPropagation();
        isPanelOpen = !isPanelOpen;
        dropdownPanel.style.display = isPanelOpen ? 'block' : 'none';
        btnSettings.style.backgroundColor = isPanelOpen ? '#505054' : '#38383a';
      });
    }

    if (btnBatch) {
      btnBatch.addEventListener('click', () => {
        openBatchModal();
      });
    }

    return true;
  }

  // 点击扩展图标开关与接收图片剪藏广播（在通用网页及 Localhost WebApp 中均生效）
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'TOGGLE_WIDGET') {
      if (!overlayContainer || !document.body.contains(overlayContainer)) {
        const created = initInPageWidget();
        sendResponse({ success: created, visible: created });
      } else {
        const visible = overlayContainer.style.display === 'none';
        overlayContainer.style.display = visible ? 'block' : 'none';
        sendResponse({ success: true, visible });
      }
      return true;
    }

    if (request.action === 'CLIP_IMAGE' && request.item) {
      if (!isTrustedWorkbench()) {
        sendResponse({ success: false, error: 'Clip image messages are only accepted by the trusted workbench.' });
        return false;
      }
      // 1. 同步保存到 本地 WebApp localStorage 存储
      try {
        const stored = localStorage.getItem('xc_ai_clipped_items');
        const list = stored ? JSON.parse(stored) : [];
        const metadataItem = request.item.url.startsWith('data:image/')
          ? { ...request.item, url: request.item.originalUrl || '' }
          : request.item;
        const filtered = list.filter((i) => i.id !== metadataItem.id && i.url !== metadataItem.url);
        const updated = metadataItem.url ? [metadataItem, ...filtered] : filtered;
        localStorage.setItem('xc_ai_clipped_items', JSON.stringify(updated));
      } catch (e) {}

      // 2. 触发 DOM 原生 postMessage 与 BroadcastChannel
      window.postMessage({ type: 'XC_CLIPPER_SAVE_IMAGE', item: request.item }, '*');

      try {
        const bc = new BroadcastChannel('xc_ai_clipper_channel');
        bc.postMessage({ type: 'XC_CLIPPER_SAVE_IMAGE', item: request.item });
        bc.close();
      } catch (e) {}

      sendResponse({ success: true });
      return true;
    }
  });

  // 2. Hover 悬浮“Save to XcStudio” & “Save all images”按钮组件
  // 采用 flex-direction: column-reverse + bottom 锁定，确保单图按钮永不下坠溢出，Save all 100% 向上展开
  let hoverButtonsWrapper = null;
  let currentTargetImg = null;

  function createHoverButtons() {
    if (hoverButtonsWrapper) return;

    hoverButtonsWrapper = document.createElement('div');
    hoverButtonsWrapper.id = 'xc-ai-hover-actions';
    hoverButtonsWrapper.dataset.xcAiClipperUi = 'true';

    hoverButtonsWrapper.innerHTML = `
      <!-- 单图保存按钮 (固定置底，带右侧 ∨ 展开箭头) -->
      <button id="xc-btn-save-single" style="
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(120, 120, 125, 0.55);
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12.5px;
        font-weight: 500;
        padding: 5.5px 11px 5.5px 8px;
        border-radius: 999px;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.22);
        cursor: pointer;
        border: 1px solid rgba(255, 255, 255, 0.32);
        outline: none;
        transition: background 0.2s, transform 0.15s;
        text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        white-space: nowrap;
      ">
        <div style="
          width: 17px;
          height: 17px;
          border-radius: 50%;
          background: #050505;
          border: 1px solid rgba(255, 255, 255, 0.32);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: -0.5px;
        ">XC</div>
        <span>Save to XcStudio</span>
        <svg id="xc-btn-arrow-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 2px; transition: transform 0.2s ease;"><polyline points="6 9 12 15 18 9"/></svg>
      </button>

      <!-- Save all images 批量保存按钮 (在反向布局中排在上方，100% 向上平滑展开) -->
      <button id="xc-btn-save-all" style="
        display: none;
        align-items: center;
        gap: 6px;
        background: rgba(90, 90, 95, 0.7);
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        font-weight: 500;
        padding: 5.5px 12.5px;
        border-radius: 999px;
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
        cursor: pointer;
        border: 1px solid rgba(255, 255, 255, 0.32);
        outline: none;
        transition: all 0.2s ease;
        text-shadow: 0 1px 2px rgba(0,0,0,0.2);
        opacity: 0;
        transform: translateY(-4px);
        white-space: nowrap;
      ">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1"/><rect x="8" y="2" width="13" height="13" rx="2"/></svg>
        <span>Save all images</span>
      </button>
    `;

    document.body.appendChild(hoverButtonsWrapper);

    const btnSaveAll = document.getElementById('xc-btn-save-all');
    const arrowIcon = document.getElementById('xc-btn-arrow-icon');
    let isUnfolded = false;

    function unfoldSaveAll() {
      if (!btnSaveAll) return;
      btnSaveAll.style.display = 'flex';
      requestAnimationFrame(() => {
        btnSaveAll.style.opacity = '1';
        btnSaveAll.style.transform = 'translateY(0)';
      });
      if (arrowIcon) arrowIcon.style.transform = 'rotate(180deg)';
      isUnfolded = true;
    }

    function foldSaveAll() {
      if (!btnSaveAll) return;
      btnSaveAll.style.opacity = '0';
      btnSaveAll.style.transform = 'translateY(-4px)';
      if (arrowIcon) arrowIcon.style.transform = 'rotate(0deg)';
      setTimeout(() => {
        if (!isUnfolded && btnSaveAll) btnSaveAll.style.display = 'none';
      }, 200);
      isUnfolded = false;
    }

    hoverButtonsWrapper.addEventListener('mouseenter', () => {
      hoverButtonsWrapper.style.opacity = '1.0';
      unfoldSaveAll();
    });

    hoverButtonsWrapper.addEventListener('mouseleave', () => {
      hoverButtonsWrapper.style.opacity = '0.65';
      foldSaveAll();
    });

    document.getElementById('xc-btn-save-single').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const imageUrl = getSafeImageUrl(currentTargetImg);
      if (imageUrl) {
        saveImageToClipper(imageUrl, document.title);
        showSuccessToast(imageUrl);
      }
    });

    document.getElementById('xc-btn-save-all').addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      await openBatchModal();
    });
  }

  // 把按钮固定在图片右下角内侧，并直接挂载在图片容器内部，绝对不会溢出图片外框
  function positionHoverButtons(img) {
    if (!hoverButtonsWrapper) return;
    if (!img) return;

    // 寻找图片的直接包裹容器 (如 Instagram 的 div._aagw 或图片父级 div)
    let container = img.parentElement;
    if (container && container.tagName === 'A' && container.parentElement) {
      container = container;
    }

    if (container && container !== document.body) {
      const computedStyle = window.getComputedStyle(container);
      if (computedStyle.position === 'static') {
        container.style.position = 'relative';
      }

      hoverButtonsWrapper.style.cssText = `
        position: absolute !important;
        bottom: 12px !important;
        right: 12px !important;
        top: auto !important;
        left: auto !important;
        z-index: 2147483645 !important;
        display: flex !important;
        flex-direction: column-reverse !important;
        align-items: flex-end !important;
        gap: 6px !important;
        pointer-events: auto !important;
        opacity: 0.65 !important;
        transition: opacity 0.25s ease-in-out, transform 0.18s ease !important;
        user-select: none !important;
      `;

      if (hoverButtonsWrapper.parentElement !== container) {
        container.appendChild(hoverButtonsWrapper);
      }
    } else {
      // 备用方案：计算绝对坐标
      const rect = img.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

      const w = 155;
      const rightMargin = scrollLeft + rect.right - w - 12;
      const bottomMargin = scrollTop + rect.bottom - 44;

      hoverButtonsWrapper.style.cssText = `
        position: absolute !important;
        top: ${bottomMargin}px !important;
        left: ${rightMargin}px !important;
        bottom: auto !important;
        right: auto !important;
        z-index: 2147483645 !important;
        display: flex !important;
        flex-direction: column-reverse !important;
        align-items: flex-end !important;
        gap: 6px !important;
        pointer-events: auto !important;
        opacity: 0.65 !important;
        transition: opacity 0.25s ease-in-out, transform 0.18s ease !important;
        user-select: none !important;
      `;

      if (hoverButtonsWrapper.parentElement !== document.body) {
        document.body.appendChild(hoverButtonsWrapper);
      }
    }
  }

  const CAROUSEL_SCAN_LIMIT = 20;
  const CAROUSEL_CHANGE_TIMEOUT_MS = 1400;
  let isBatchScanning = false;

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getBatchScope(img) {
    if (!img) return document.body;

    const platform = getPlatformName();
    if (platform === 'instagram' || platform === 'rednote' || platform === 'pinterest') {
      let current = img.parentElement;
      let controlScope = null;
      for (let depth = 0; current && current !== document.body && depth < 12; depth += 1) {
        const expectedCount = getExpectedCarouselCount(current);
        const hasCarouselControl = Boolean(
          getPlatformCarouselButton(current, 'next')
          || getPlatformCarouselButton(current, 'previous'),
        );
        if (hasCarouselControl && !controlScope) controlScope = current;
        if (expectedCount > 1 && hasCarouselControl) return current;
        current = current.parentElement;
      }
      if (controlScope) return controlScope;
    }

    const platformSelectors = {
      rednote: '[class*="swiper-container"], [class*="slider-container"], [class*="carousel-container"], [class*="note-content"], [class*="note-container"], [role="dialog"]',
      pinterest: '[data-test-id="closeup-body"], [data-test-id="pin"], [class*="carousel"], [role="dialog"]',
      amazon: '#imageBlock, #altImages, #dp-container, #ppd, [data-feature-name="imageBlock"]',
      taobao: '#detail, #J_DetailMeta, #J_UlThumb, [class*="ItemDetail"], [class*="PicGallery"]',
      tmall: '#detail, #J_DetailMeta, #J_UlThumb, [class*="ItemDetail"], [class*="PicGallery"]',
    };
    const platformScope = platformSelectors[platform]
      ? img.closest(platformSelectors[platform])
      : null;
    if (platformScope) return platformScope;

    // Prefer the complete post/product container over the immediate image wrapper.
    return img.closest('article, [role="article"]')
      || img.closest('main, section')
      || img.parentElement?.parentElement
      || document.body;
  }

  function getElementLabel(element) {
    if (!element) return '';
    const labelledChild = element.querySelector?.('[aria-label], [title]');
    return [
      element.getAttribute?.('aria-label'),
      element.getAttribute?.('title'),
      element.getAttribute?.('data-testid'),
      labelledChild?.getAttribute?.('aria-label'),
      labelledChild?.getAttribute?.('title'),
      element.textContent,
    ].filter(Boolean).join(' ').trim();
  }

  function isVisibleElement(element) {
    if (!element || element.closest?.('[data-xc-ai-clipper-ui]')) return false;
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0
      && rect.height > 0
      && style.display !== 'none'
      && style.visibility !== 'hidden'
      && Number(style.opacity || 1) > 0;
  }

  function findInstagramCarouselButton(root, direction) {
    const nextPattern = /(?:^|\b)(?:next|forward)(?:\b|$)|下一|下一个|다음|次へ|suivant|siguiente|weiter|avanti|pr[oó]ximo/i;
    const previousPattern = /(?:^|\b)(?:previous|prev|back)(?:\b|$)|上一|上一个|이전|前へ|pr[eé]c[eé]dent|anterior|zur[uü]ck|indietro/i;
    const expectedPattern = direction === 'next' ? nextPattern : previousPattern;
    const controls = Array.from(root.querySelectorAll('button, [role="button"]'));

    return controls.find((control) => (
      isVisibleElement(control) && expectedPattern.test(getElementLabel(control))
    )) || null;
  }

  function getVisibleInstagramImageUrls(root) {
    return Array.from(root.querySelectorAll('img'))
      .filter((img) => {
        if (!getSafeImageUrl(img)) return false;
        const rect = img.getBoundingClientRect();
        return rect.width >= 140 && rect.height >= 140 && isVisibleElement(img);
      })
      .map((img) => getSafeImageUrl(img));
  }

  function getExpectedCarouselCount(root) {
    const labels = Array.from(root.querySelectorAll('[aria-label], [title], span, div'))
      .slice(0, 1200)
      .map((element) => `${element.getAttribute?.('aria-label') || ''} ${element.getAttribute?.('title') || ''} ${element.children.length === 0 ? element.textContent || '' : ''}`)
      .filter(Boolean);
    let expected = 0;
    labels.forEach((label) => {
      const match = label.match(/(?:^|\s)(\d{1,2})\s*\/\s*(\d{1,2})(?:\s|$)/);
      if (match) expected = Math.max(expected, Number(match[2]));
    });
    const dotCount = root.querySelectorAll(
      '[class*="pagination"] > *, [class*="indicator"] > *, [class*="dots"] > *, [role="tablist"] [role="tab"]',
    ).length;
    if (dotCount >= 2 && dotCount <= CAROUSEL_SCAN_LIMIT) {
      expected = Math.max(expected, dotCount);
    }
    return Math.min(CAROUSEL_SCAN_LIMIT, expected);
  }

  function getPlatformCarouselButton(root, direction) {
    const explicit = findInstagramCarouselButton(root, direction);
    if (explicit) return explicit;

    const selectorMap = {
      rednote: direction === 'next'
        ? '[class*="next"], [class*="right"][class*="arrow"], .swiper-button-next'
        : '[class*="prev"], [class*="left"][class*="arrow"], .swiper-button-prev',
      pinterest: direction === 'next'
        ? '[data-test-id*="next"], [aria-label*="Next" i]'
        : '[data-test-id*="previous"], [aria-label*="Previous" i]',
    };
    const platformSelector = selectorMap[getPlatformName()];
    if (platformSelector) {
      const candidate = Array.from(root.querySelectorAll(platformSelector))
        .find((element) => isVisibleElement(element));
      if (candidate) return candidate;
    }

    // Geometry fallback is only enabled when a carousel count exists, so it
    // cannot accidentally click unrelated product or social actions.
    if (getExpectedCarouselCount(root) < 2) return null;
    const rootRect = root.getBoundingClientRect();
    const controls = Array.from(root.querySelectorAll('button, [role="button"]'))
      .filter((element) => {
        if (!isVisibleElement(element) || element.closest('[data-xc-ai-clipper-ui]')) return false;
        const rect = element.getBoundingClientRect();
        const isCompact = rect.width <= 80 && rect.height <= 80;
        const inVerticalCenter = rect.top < rootRect.top + rootRect.height * 0.75
          && rect.bottom > rootRect.top + rootRect.height * 0.25;
        return isCompact && inVerticalCenter;
      });
    controls.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    return direction === 'next' ? controls[controls.length - 1] || null : controls[0] || null;
  }

  function collectStaticPlatformImages(root) {
    const platform = getPlatformName();
    const imageMap = new Map();
    const addUrl = (url, img) => {
      const safeUrl = normalizeHttpImageUrl(url);
      const key = getImageUrlKey(safeUrl);
      if (!safeUrl || !key || imageMap.has(key)) return;
      imageMap.set(key, img || createImageSnapshot(safeUrl));
    };

    Array.from(root.querySelectorAll('img')).forEach((img) => {
      const url = getSafeImageUrl(img);
      if (!url) return;
      const width = img.naturalWidth || img.clientWidth || 0;
      const height = img.naturalHeight || img.clientHeight || 0;
      const displayWidth = img.clientWidth || 0;
      const displayHeight = img.clientHeight || 0;
      const isGalleryThumbnail = Boolean(img.closest(
        '#altImages, #J_UlThumb, [class*="thumb" i], [class*="gallery" i], [class*="swiper" i], [class*="slider" i], [class*="carousel" i]',
      ));
      const isSocialGalleryCandidate = platform !== 'rednote' && platform !== 'pinterest'
        ? true
        : isGalleryThumbnail
          || img === currentTargetImg
          || (
            displayWidth >= Math.max(180, (currentTargetImg?.clientWidth || 0) * 0.4)
            && displayHeight >= Math.max(180, (currentTargetImg?.clientHeight || 0) * 0.4)
          );
      if (((width >= 100 && height >= 100) || isGalleryThumbnail || img === currentTargetImg) && isSocialGalleryCandidate) {
        addUrl(url, img);
      }
    });

    if (platform === 'amazon') {
      Array.from(root.querySelectorAll('[data-a-dynamic-image]')).forEach((element) => {
        const raw = element.getAttribute('data-a-dynamic-image');
        try {
          Object.keys(JSON.parse(raw || '{}')).forEach((url) => addUrl(url));
        } catch {}
      });
    }

    if (platform === 'taobao' || platform === 'tmall') {
      Array.from(root.querySelectorAll('[data-src], [data-ks-lazyload], [data-origin], [data-zoom-image]')).forEach((element) => {
        ['data-zoom-image', 'data-origin', 'data-ks-lazyload', 'data-src'].forEach((attribute) => {
          addUrl(element.getAttribute(attribute));
        });
      });
    }

    if (currentTargetImg) addUrl(getSafeImageUrl(currentTargetImg), currentTargetImg);
    return imageMap;
  }

  function getCarouselSignature(root) {
    return getVisibleInstagramImageUrls(root).sort().join('|');
  }

  async function clickCarouselAndWait(root, button) {
    const before = getCarouselSignature(root);
    button.click();
    const startedAt = Date.now();

    while (Date.now() - startedAt < CAROUSEL_CHANGE_TIMEOUT_MS) {
      await wait(80);
      const after = getCarouselSignature(root);
      if (after && after !== before) {
        await wait(80);
        return true;
      }
    }

    return false;
  }

  function addInstagramImages(root, imageMap) {
    getVisibleInstagramImageUrls(root).forEach((url) => {
      if (imageMap.has(url)) return;
      const snapshot = document.createElement('img');
      snapshot.src = url;
      imageMap.set(url, snapshot);
    });
  }

  async function collectInstagramCarouselImages(root) {
    const imageMap = new Map();
    addInstagramImages(root, imageMap);

    let backwardClicks = 0;
    let forwardClicks = 0;

    // 从用户当前页回到第一张，同时收集前面的轮播图片。
    for (let index = 0; index < CAROUSEL_SCAN_LIMIT; index += 1) {
      const previousButton = findInstagramCarouselButton(root, 'previous');
      if (!previousButton) break;
      const changed = await clickCarouselAndWait(root, previousButton);
      if (!changed) break;
      backwardClicks += 1;
      addInstagramImages(root, imageMap);
    }

    // 从第一张遍历到最后一张。Instagram 每次只渲染当前项及少量相邻项，
    // 因此必须逐页触发，不能只读取点击时已经存在的 DOM。
    for (let index = 0; index < CAROUSEL_SCAN_LIMIT; index += 1) {
      const nextButton = findInstagramCarouselButton(root, 'next');
      if (!nextButton) break;
      const changed = await clickCarouselAndWait(root, nextButton);
      if (!changed) break;
      forwardClicks += 1;
      addInstagramImages(root, imageMap);
    }

    // 扫描结束后恢复用户点击 Save all 时所在的轮播位置。
    const restoreClicks = Math.max(0, forwardClicks - backwardClicks);
    for (let index = 0; index < restoreClicks; index += 1) {
      const previousButton = findInstagramCarouselButton(root, 'previous');
      if (!previousButton) break;
      const changed = await clickCarouselAndWait(root, previousButton);
      if (!changed) break;
    }

    return Array.from(imageMap.values());
  }

  async function collectPlatformCarouselImages(root) {
    const imageMap = collectStaticPlatformImages(root);
    const expectedCount = getExpectedCarouselCount(root);
    let backwardClicks = 0;
    let forwardClicks = 0;

    const mergeCurrentImages = () => {
      collectStaticPlatformImages(root).forEach((img, key) => {
        if (!imageMap.has(key)) imageMap.set(key, img);
      });
    };

    for (let index = 0; index < CAROUSEL_SCAN_LIMIT; index += 1) {
      const previousButton = getPlatformCarouselButton(root, 'previous');
      if (!previousButton) break;
      const changed = await clickCarouselAndWait(root, previousButton);
      if (!changed) break;
      backwardClicks += 1;
      mergeCurrentImages();
    }

    for (let index = 0; index < CAROUSEL_SCAN_LIMIT; index += 1) {
      if (expectedCount > 0 && imageMap.size >= expectedCount) break;
      const nextButton = getPlatformCarouselButton(root, 'next');
      if (!nextButton) break;
      const changed = await clickCarouselAndWait(root, nextButton);
      if (!changed) break;
      forwardClicks += 1;
      mergeCurrentImages();
    }

    // Restore the slide that was visible when the user clicked Save all.
    const restoreClicks = Math.max(0, forwardClicks - backwardClicks);
    for (let index = 0; index < restoreClicks; index += 1) {
      const previousButton = getPlatformCarouselButton(root, 'previous');
      if (!previousButton) break;
      const changed = await clickCarouselAndWait(root, previousButton);
      if (!changed) break;
    }

    return Array.from(imageMap.values());
  }

  function setBatchScanningState(scanning) {
    const button = document.getElementById('xc-btn-save-all');
    if (!button) return;
    button.disabled = scanning;
    button.style.cursor = scanning ? 'wait' : 'pointer';
    const label = button.querySelector('span');
    if (label) label.textContent = scanning ? 'Scanning carousel…' : 'Save all images';
  }

  // 3. 一键所有图片 Save 选择弹窗。Instagram 会先遍历完整轮播，再按真实数量展示 All。
  async function openBatchModal() {
    if (!canClipPageImages()) return;
    if (document.getElementById('xc-batch-select-modal') || isBatchScanning) return;
    isBatchScanning = true;
    setBatchScanningState(true);

    let scopedContainer = null;
    if (currentTargetImg) {
      scopedContainer = getBatchScope(currentTargetImg);
    }

    const searchRoot = scopedContainer || document.body;

    let scannedImgs;
    try {
      const platform = getPlatformName();
      if (platform === 'instagram') {
        scannedImgs = await collectInstagramCarouselImages(searchRoot);
      } else if (platform === 'rednote' || platform === 'pinterest') {
        scannedImgs = await collectPlatformCarouselImages(searchRoot);
      } else {
        scannedImgs = Array.from(collectStaticPlatformImages(searchRoot).values());
      }
    } catch (error) {
      console.warn('[XC AI Clipper] Carousel scan failed; using currently loaded images.', error);
      scannedImgs = Array.from(collectStaticPlatformImages(searchRoot).values());
    } finally {
      isBatchScanning = false;
      setBatchScanningState(false);
    }

    // 如果局部容器没有抓取到足够图，确保把 currentTargetImg 本身包含进来
    if (currentTargetImg && !scannedImgs.includes(currentTargetImg)) {
      scannedImgs.unshift(currentTargetImg);
    }

    // 去重相同 URL
    const uniqueMap = new Map();
    scannedImgs.forEach((img) => {
      const imageUrl = getSafeImageUrl(img);
      const imageKey = getImageUrlKey(imageUrl);
      if (imageUrl && imageKey && !uniqueMap.has(imageKey)) {
        uniqueMap.set(imageKey, img);
      }
    });
    scannedImgs = Array.from(uniqueMap.values());

    const selectedSet = new Set(scannedImgs.map((_, i) => i));

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'xc-batch-select-modal';
    modalOverlay.dataset.xcAiClipperUi = 'true';
    modalOverlay.style.cssText = `
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483647 !important;
      background: rgba(0, 0, 0, 0.65) !important;
      backdrop-filter: blur(6px) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      user-select: none !important;
    `;

    const firstImgUrl = getSafeImageUrl(scannedImgs[0]) || getSafeImageUrl(currentTargetImg);

    modalOverlay.innerHTML = `
      <div style="
        position: relative;
        width: 380px;
        max-height: 85vh;
        background-color: #232325;
        border-radius: 24px;
        padding: 20px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        color: #ffffff;
        display: flex;
        flex-direction: column;
      ">
        <!-- 右上角取消关闭按钮 ✕ -->
        <button id="xc-modal-close-x" title="取消关闭" style="
          position: absolute;
          top: 16px;
          right: 16px;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: #9ca3af;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          transition: background 0.15s, color 0.15s;
        ">✕</button>

        <!-- 头部 Header (图 3 效果: 缩略图 + Select images to save + Unclassified 下拉) -->
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding-right: 28px;">
          <img src="${firstImgUrl}" style="width: 42px; height: 42px; border-radius: 10px; object-fit: cover; background: #333;" />
          <div>
            <h3 style="font-size: 15px; font-weight: 700; color: #fff; margin: 0;">Select images to save</h3>
            <div style="font-size: 12px; color: #9ca3af; font-weight: 500; margin-top: 2px;">Unclassified ∨</div>
          </div>
        </div>

        <!-- 选择与全选行 (图 3 效果: Select (X/X) 与 Deselect all) -->
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 600; color: #d1d5db; margin-bottom: 12px;">
          <span id="xc-modal-count-text">Select (${selectedSet.size}/${scannedImgs.length})</span>
          <button id="xc-modal-toggle-all" style="background: none; border: none; color: #9ca3af; font-weight: 600; cursor: pointer; font-size: 12px;">Deselect all</button>
        </div>

        <!-- 图片网格 (图 3 效果: 3 列平铺 + 右上角黑框 ✓ 勾选框) -->
        <div id="xc-modal-grid" style="
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          overflow-y: auto;
          max-height: 320px;
          padding-right: 4px;
          margin-bottom: 20px;
        ">
          ${scannedImgs.map((img, idx) => `
            <div class="xc-modal-item" data-idx="${idx}" style="
              position: relative;
              aspect-ratio: 1;
              border-radius: 12px;
              overflow: hidden;
              background: #111;
              cursor: pointer;
              border: 2px solid ${selectedSet.has(idx) ? '#ffffff' : 'transparent'};
            ">
              <img src="${img.src}" style="width: 100%; height: 100%; object-fit: cover;" />
              <div style="
                position: absolute;
                top: 6px;
                right: 6px;
                width: 22px;
                height: 22px;
                border-radius: 6px;
                background: ${selectedSet.has(idx) ? '#222224' : 'rgba(0,0,0,0.4)'};
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: 900;
                border: 1px solid rgba(255,255,255,0.2);
              ">${selectedSet.has(idx) ? '✓' : ''}</div>
            </div>
          `).join('')}
        </div>

        <!-- 底部 Done 胶囊按钮 (图 3 效果) -->
        <button id="xc-modal-done-btn" style="
          width: 100%;
          padding: 12px;
          background-color: #ffffff;
          color: #0f172a;
          border-radius: 16px;
          border: none;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: background-color 0.15s;
        ">Done</button>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    // 取消 / 关闭处理
    const closeModal = () => modalOverlay.remove();
    document.getElementById('xc-modal-close-x')?.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        window.removeEventListener('keydown', handleEsc);
      }
    };
    window.addEventListener('keydown', handleEsc);

    // 网格点击事件
    const gridItems = modalOverlay.querySelectorAll('.xc-modal-item');
    gridItems.forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-idx') || '0', 10);
        if (selectedSet.has(idx)) {
          selectedSet.delete(idx);
        } else {
          selectedSet.add(idx);
        }
        updateModalGrid();
      });
    });

    const toggleAllBtn = document.getElementById('xc-modal-toggle-all');
    if (toggleAllBtn) {
      toggleAllBtn.addEventListener('click', () => {
        if (selectedSet.size === scannedImgs.length) {
          selectedSet.clear();
        } else {
          scannedImgs.forEach((_, i) => selectedSet.add(i));
        }
        updateModalGrid();
      });
    }

    function updateModalGrid() {
      const countText = document.getElementById('xc-modal-count-text');
      if (countText) countText.innerText = `Select (${selectedSet.size}/${scannedImgs.length})`;
      if (toggleAllBtn) toggleAllBtn.innerText = selectedSet.size === scannedImgs.length ? 'Deselect all' : 'Select all';

      gridItems.forEach((el) => {
        const idx = parseInt(el.getAttribute('data-idx') || '0', 10);
        const checkBadge = el.querySelector('div');
        if (selectedSet.has(idx)) {
          el.style.borderColor = '#ffffff';
          if (checkBadge) {
            checkBadge.innerText = '✓';
            checkBadge.style.background = '#222224';
          }
        } else {
          el.style.borderColor = 'transparent';
          if (checkBadge) {
            checkBadge.innerText = '';
            checkBadge.style.background = 'rgba(0,0,0,0.4)';
          }
        }
      });
    }

    // 点击 Done 批量保存
    const doneBtn = document.getElementById('xc-modal-done-btn');
    if (doneBtn) {
      doneBtn.addEventListener('click', () => {
        let firstImg = '';
        selectedSet.forEach((idx) => {
          const img = scannedImgs[idx];
          const imageUrl = getSafeImageUrl(img);
          if (imageUrl) {
            if (!firstImg) firstImg = imageUrl;
            saveImageToClipper(imageUrl, document.title);
          }
        });
        modalOverlay.remove();
        showSuccessToast(firstImg || scannedImgs[0]?.src || '');
      });
    }
  }

  function saveImageToClipper(imgSrc, title) {
    const platform = getPlatformName();
    const itemData = {
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      type: 'XC_CLIPPER_SAVE_IMAGE',
      url: imgSrc,
      title: title || document.title,
      sourceUrl: window.location.href,
      platform: platform,
      category: 'uncategorized',
      timestamp: Date.now(),
    };

    if (isTrustedWorkbench()) {
      window.postMessage(itemData, '*');

      try {
        const bc = new BroadcastChannel('xc_ai_clipper_channel');
        bc.postMessage({ type: 'XC_CLIPPER_SAVE_IMAGE', item: itemData });
        bc.close();
      } catch {}
    } else {
      try {
        chrome.runtime.sendMessage({
          action: 'CLIP_IMAGE',
          id: itemData.id,
          url: imgSrc,
          title: title || document.title,
          sourceUrl: window.location.href,
          platform: platform,
          timestamp: itemData.timestamp,
        });
      } catch {}
    }
  }

  function getPlatformName() {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('pinterest')) return 'pinterest';
    if (host.includes('xiaohongshu') || host.includes('rednote')) return 'rednote';
    if (host.includes('instagram')) return 'instagram';
    if (host.includes('amazon')) return 'amazon';
    if (host.includes('taobao')) return 'taobao';
    if (host.includes('tmall')) return 'tmall';
    return 'other';
  }

  // 100% 精确复刻截图 4 保存成功右上角提示胶囊 (Saved to XcStudio Clipper, Unclassified v, View)
  function showSuccessToast(imgUrl) {
    let toast = document.getElementById('xc-ai-save-success-toast');
    if (toast) toast.remove();

    toast = document.createElement('div');
    toast.id = 'xc-ai-save-success-toast';
    toast.dataset.xcAiClipperUi = 'true';
    toast.style.cssText = `
      position: fixed !important;
      top: 16px !important;
      right: 20px !important;
      z-index: 2147483647 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      background: #232325 !important;
      color: #ffffff !important;
      padding: 8px 12px 8px 10px !important;
      border-radius: 18px !important;
      border: 1px solid rgba(255, 255, 255, 0.15) !important;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45) !important;
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      user-select: none !important;
    `;

    toast.innerHTML = `
      <div style="position: relative; width: 34px; height: 34px; shrink-0;">
        <img src="${imgUrl}" style="width: 34px; height: 34px; border-radius: 8px; object-fit: cover; border: 1px solid rgba(255,255,255,0.2);" />
      </div>
      <div>
        <div style="font-size: 13px; font-weight: 700; color: #ffffff; line-height: 1.2;">Saved to XcStudio Clipper</div>
        <div style="font-size: 11px; font-weight: 500; color: #9ca3af; margin-top: 1px;">Unclassified ∨</div>
      </div>
      <button id="xc-toast-view-btn" style="
        background: #ffffff;
        color: #0066cc;
        font-weight: 700;
        font-size: 12px;
        padding: 5px 12px;
        border-radius: 12px;
        border: none;
        cursor: pointer;
        margin-left: 6px;
      ">View</button>
    `;

    document.body.appendChild(toast);

    document.getElementById('xc-toast-view-btn').addEventListener('click', () => {
      window.open(CLIPPER_LIBRARY_URL, '_blank');
    });

    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
      }
    }, 3500);
  }

  // 监听网页元素 Hover 悬浮 (兼容 Instagram / 小红书 / Pinterest / 亚马逊 / 淘宝等网页遮罩层 Div)
  document.addEventListener('mouseover', (e) => {
    if (!canClipPageImages()) return;
    const target = e.target;
    if (!target) return;
    if (target.closest && target.closest('#xc-ai-clipper-inpage-overlay, #xc-ai-hover-actions, #xc-batch-select-modal, [data-xc-ai-clipper-ui]')) return;

    let targetImg = null;

    if (target.tagName === 'IMG') {
      targetImg = target;
    } else {
      // 深度检查 overlay div 包裹的 img，或前后的 img 兄弟节点与父级容器
      const childImg = target.querySelector('img');
      if (childImg) {
        targetImg = childImg;
      } else if (target.parentElement) {
        const siblingImg = target.parentElement.querySelector('img');
        if (siblingImg) {
          targetImg = siblingImg;
        }
      }
    }

    if (!targetImg && target.closest) {
      const cardContainer = target.closest('article, [role="button"], a, div._aagw, div');
      if (cardContainer) {
        const found = cardContainer.querySelector('img');
        if (found) targetImg = found;
      }
    }

    if (targetImg && getSafeImageUrl(targetImg)) {
      const rect = targetImg.getBoundingClientRect();
      if (rect.width >= 100 && rect.height >= 100) {
        createHoverButtons();
        currentTargetImg = targetImg;
        positionHoverButtons(targetImg);
      }
    }
  });

  // Re-deliver extension-owned clips whenever the workbench opens. This restores
  // cached image bytes even when the original CDN URL has expired.
  if (isTrustedWorkbench()) {
    window.addEventListener('message', (event) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.type !== 'XC_CLIPPER_DELETE_IMAGES' || !Array.isArray(event.data.items)) return;

      chrome.runtime.sendMessage({
        action: 'DELETE_CLIPPED_IMAGES',
        items: event.data.items,
      }).catch((error) => {
        console.warn('[XC AI Clipper] Failed to synchronize deleted images.', error);
      });
    });

    setTimeout(() => {
      chrome.runtime.sendMessage({ action: 'GET_CLIPPED_IMAGES' }, (response) => {
        if (chrome.runtime.lastError || !Array.isArray(response?.items)) return;
        response.items.forEach((item) => {
          window.postMessage({ type: 'XC_CLIPPER_SAVE_IMAGE', item }, '*');
        });
      });
    }, 1500);
  }
})();
