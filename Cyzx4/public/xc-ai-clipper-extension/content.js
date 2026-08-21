// XC AI Clipper Content Script (Manifest V3 - 免弹窗框 网页原生悬浮)
(function () {
  console.log('[XC AI Clipper] In-page overlay active');

  // 心跳与初始化广播
  function announceExtension() {
    window.postMessage(
      {
        type: 'XC_CLIPPER_PONG',
        version: '1.0.0',
        isPinterest: window.location.hostname.includes('pinterest.com'),
        url: window.location.href,
      },
      '*'
    );
  }

  setInterval(announceExtension, 1000);
  announceExtension();

  // 仅在指定 5 大目标平台上开启 UI 悬浮（严格排除 XC AI 网页本身及无关网页）
  function isSupportedSite() {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('localhost') || host.includes('127.0.0.1') || host.includes('xc-ai') || host.includes('xcwork-tool.online')) {
      return false;
    }
    return (
      host.includes('instagram.com') ||
      host.includes('xiaohongshu.com') ||
      host.includes('rednote.com') ||
      host.includes('amazon.') ||
      host.includes('taobao.com') ||
      host.includes('tmall.com') ||
      host.includes('pinterest.com')
    );
  }

  // 1. 全网网页右上角常驻/点击展开与关闭的极简无框胶囊组件
  let overlayContainer = null;
  let isPanelOpen = false;

  function initInPageWidget() {
    if (!isSupportedSite()) return;
    if (document.getElementById('xc-ai-clipper-inpage-overlay')) return;

    overlayContainer = document.createElement('div');
    overlayContainer.id = 'xc-ai-clipper-inpage-overlay';
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
              background-color: #38383a;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 700;
              font-size: 12.5px;
              color: #ffffff;
            ">B</div>
            <span style="font-size: 12.5px; font-weight: 600; color: #ffffff;">bruce Tien</span>
          </div>

          <div style="display: flex; align-items: center; gap: 4px;">
            <button id="xc-btn-settings" title="Enabled sites" style="
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

        <!-- 点击 🎛️ 展出的 Enabled sites 面板 (100% 精确复刻图 1) -->
        <div id="xc-dropdown-panel" style="
          display: none;
          margin-top: 6px;
          background-color: #232325;
          border-radius: 20px;
          padding: 14px 16px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 14px 40px rgba(0, 0, 0, 0.5);
        ">
          <div style="font-size: 11px; font-weight: 500; color: #8e8e93; margin-bottom: 12px;">Enabled sites</div>

          <div style="display: flex; flex-direction: column; gap: 13px;">
            <!-- Instagram -->
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 20px; height: 20px; border-radius: 6px; background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); display: flex; align-items: center; justify-content: center;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                </div>
                <span style="font-size: 13px; font-weight: 500; color: #ffffff;">Instagram</span>
              </div>
              <div style="width: 36px; height: 20px; border-radius: 999px; background: #ffffff; position: relative; cursor: pointer; transition: background 0.2s;">
                <div style="width: 16px; height: 16px; border-radius: 50%; background: #1c1c1e; position: absolute; top: 2px; right: 2px; transition: transform 0.2s;"></div>
              </div>
            </div>

            <!-- Rednote -->
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 20px; height: 20px; border-radius: 6px; background: #ff2442; color: #fff; font-size: 9px; font-weight: 900; display: flex; align-items: center; justify-content: center;">xhs</div>
                <span style="font-size: 13px; font-weight: 500; color: #ffffff;">Rednote</span>
              </div>
              <div style="width: 36px; height: 20px; border-radius: 999px; background: #ffffff; position: relative; cursor: pointer; transition: background 0.2s;">
                <div style="width: 16px; height: 16px; border-radius: 50%; background: #1c1c1e; position: absolute; top: 2px; right: 2px; transition: transform 0.2s;"></div>
              </div>
            </div>

            <!-- Amazon -->
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 20px; height: 20px; border-radius: 6px; background: #232f3e; color: #ff9900; font-size: 10px; font-weight: 900; display: flex; align-items: center; justify-content: center;">a</div>
                <span style="font-size: 13px; font-weight: 500; color: #ffffff;">Amazon</span>
              </div>
              <div style="width: 36px; height: 20px; border-radius: 999px; background: #ffffff; position: relative; cursor: pointer; transition: background 0.2s;">
                <div style="width: 16px; height: 16px; border-radius: 50%; background: #1c1c1e; position: absolute; top: 2px; right: 2px; transition: transform 0.2s;"></div>
              </div>
            </div>

            <!-- Taobao -->
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 20px; height: 20px; border-radius: 6px; background: #ff5000; color: #fff; font-size: 9px; font-weight: 900; display: flex; align-items: center; justify-content: center;">tb</div>
                <span style="font-size: 13px; font-weight: 500; color: #ffffff;">Taobao</span>
              </div>
              <div style="width: 36px; height: 20px; border-radius: 999px; background: #ffffff; position: relative; cursor: pointer; transition: background 0.2s;">
                <div style="width: 16px; height: 16px; border-radius: 50%; background: #1c1c1e; position: absolute; top: 2px; right: 2px; transition: transform 0.2s;"></div>
              </div>
            </div>

            <!-- Pinterest -->
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 20px; height: 20px; border-radius: 6px; background: #e60023; color: #fff; font-size: 10px; font-weight: 900; display: flex; align-items: center; justify-content: center;">P</div>
                <span style="font-size: 13px; font-weight: 500; color: #ffffff;">Pinterest</span>
              </div>
              <div style="width: 36px; height: 20px; border-radius: 999px; background: #ffffff; position: relative; cursor: pointer; transition: background 0.2s;">
                <div style="width: 16px; height: 16px; border-radius: 50%; background: #1c1c1e; position: absolute; top: 2px; right: 2px; transition: transform 0.2s;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlayContainer);

    // 事件绑定
    const btnView = document.getElementById('xc-btn-view');
    const btnSettings = document.getElementById('xc-btn-settings');
    const btnCloseWidget = document.getElementById('xc-btn-close-widget');
    const dropdownPanel = document.getElementById('xc-dropdown-panel');
    const btnBatch = document.getElementById('xc-btn-batch');

    if (btnView) {
      btnView.addEventListener('click', () => {
        window.open('https://www.xcwork-tool.online/#clipper', '_blank');
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
  }

  // 点击扩展图标开关与接收图片剪藏广播（在通用网页及 Localhost WebApp 中均生效）
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'TOGGLE_WIDGET') {
      if (!overlayContainer) {
        initInPageWidget();
      } else {
        overlayContainer.style.display = overlayContainer.style.display === 'none' ? 'block' : 'none';
      }
      sendResponse({ success: true });
    }

    if (request.action === 'CLIP_IMAGE' && request.item) {
      // 1. 同步保存到 本地 WebApp localStorage 存储
      try {
        const stored = localStorage.getItem('xc_ai_clipped_items');
        const list = stored ? JSON.parse(stored) : [];
        const filtered = list.filter((i) => i.id !== request.item.id && i.url !== request.item.url);
        const updated = [request.item, ...filtered];
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
    }
  });

  if (document.readyState === 'complete') {
    initInPageWidget();
  } else {
    window.addEventListener('DOMContentLoaded', initInPageWidget);
  }

  // 2. Hover 悬浮“Save to XcStudio” & “Save all images”按钮组件
  // 采用 flex-direction: column-reverse + bottom 锁定，确保单图按钮永不下坠溢出，Save all 100% 向上展开
  let hoverButtonsWrapper = null;
  let currentTargetImg = null;

  function createHoverButtons() {
    if (hoverButtonsWrapper) return;

    hoverButtonsWrapper = document.createElement('div');
    hoverButtonsWrapper.id = 'xc-ai-hover-buttons-wrapper';

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
          border: 1.5px solid rgba(255, 255, 255, 0.95);
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
      if (currentTargetImg && currentTargetImg.src) {
        saveImageToClipper(currentTargetImg.src, document.title);
        showSuccessToast(currentTargetImg.src);
      }
    });

    document.getElementById('xc-btn-save-all').addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      openBatchModal();
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

  // 3. 一键所有图片 Save 选择弹窗 (只抓取当前悬浮图片所属的帖子/卡片内部的图，并支持取消关闭)
  function openBatchModal() {
    if (document.getElementById('xc-batch-select-modal')) return;

    let scopedContainer = null;
    if (currentTargetImg) {
      // 寻找当前图片所属的帖子容器 (如 Instagram 帖子 article, 小红书卡片, 淘宝商品详情区, 亚马逊商品图片区等)
      scopedContainer = currentTargetImg.closest('article, [role="article"], div._aagw, div._aamf, div.x1n2onr6, main, section') || currentTargetImg.parentElement?.parentElement;
    }

    const searchRoot = scopedContainer || document.body;

    let scannedImgs = Array.from(searchRoot.querySelectorAll('img'))
      .filter((img) => {
        if (!img.src) return false;
        // 过滤掉页面导航小图标或微型头像 (分辨率过滤)
        const width = img.naturalWidth || img.clientWidth || 0;
        const height = img.naturalHeight || img.clientHeight || 0;
        return width >= 100 && height >= 100;
      });

    // 如果局部容器没有抓取到足够图，确保把 currentTargetImg 本身包含进来
    if (currentTargetImg && !scannedImgs.includes(currentTargetImg)) {
      scannedImgs.unshift(currentTargetImg);
    }

    // 去重相同 URL
    const uniqueMap = new Map();
    scannedImgs.forEach((img) => {
      if (img.src && !uniqueMap.has(img.src)) {
        uniqueMap.set(img.src, img);
      }
    });
    scannedImgs = Array.from(uniqueMap.values()).slice(0, 16);

    const selectedSet = new Set(scannedImgs.map((_, i) => i));

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'xc-batch-select-modal';
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

    const firstImgUrl = scannedImgs[0]?.src || currentTargetImg?.src || '';

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
          if (img && img.src) {
            if (!firstImg) firstImg = img.src;
            saveImageToClipper(img.src, document.title);
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

    window.postMessage(itemData, '*');

    try {
      const bc = new BroadcastChannel('xc_ai_clipper_channel');
      bc.postMessage({ type: 'XC_CLIPPER_SAVE_IMAGE', item: itemData });
      bc.close();
    } catch {}

    try {
      chrome.runtime.sendMessage({
        action: 'CLIP_IMAGE',
        url: imgSrc,
        title: title || document.title,
        sourceUrl: window.location.href,
        platform: platform,
      });
    } catch {}
  }

  function getPlatformName() {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('pinterest')) return 'pinterest';
    if (host.includes('xiaohongshu')) return 'xiaohongshu';
    if (host.includes('instagram')) return 'instagram';
    if (host.includes('amazon')) return 'amazon';
    if (host.includes('taobao')) return 'taobao';
    return 'other';
  }

  // 100% 精确复刻截图 4 保存成功右上角提示胶囊 (Saved to XcStudio Clipper, Unclassified v, View)
  function showSuccessToast(imgUrl) {
    let toast = document.getElementById('xc-ai-save-success-toast');
    if (toast) toast.remove();

    toast = document.createElement('div');
    toast.id = 'xc-ai-save-success-toast';
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
      window.open('https://www.xcwork-tool.online/#clipper', '_blank');
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
    if (!isSupportedSite()) return;
    const target = e.target;
    if (!target) return;

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

    if (targetImg && targetImg.src) {
      const rect = targetImg.getBoundingClientRect();
      if (rect.width >= 100 && rect.height >= 100) {
        createHoverButtons();
        currentTargetImg = targetImg;
        positionHoverButtons(targetImg);
      }
    }
  });
})();
