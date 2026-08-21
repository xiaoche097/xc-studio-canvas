// XC AI Clipper Popup Script

document.addEventListener('DOMContentLoaded', () => {
  const btnView = document.getElementById('btnView');
  const btnSettings = document.getElementById('btnSettings');
  const dropdownPanel = document.getElementById('dropdownPanel');
  const btnBatchClip = document.getElementById('btnBatchClip');
  const siteSwitches = ['site-ig', 'site-red', 'site-amz', 'site-tb', 'site-pin'];

  // 点击 ⚙️ 设置按钮平滑展开/收起下方的 Enabled Sites 列表
  if (btnSettings && dropdownPanel) {
    btnSettings.addEventListener('click', () => {
      btnSettings.classList.toggle('active');
      dropdownPanel.classList.toggle('open');
    });
  }

  // 恢复保存的开关状态
  chrome.storage.local.get(['site_settings'], (result) => {
    const settings = result.site_settings || {};
    siteSwitches.forEach((id) => {
      const el = document.getElementById(id);
      if (el && typeof settings[id] !== 'undefined') {
        el.checked = settings[id];
      }
    });
  });

  // 监听开关切换
  siteSwitches.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        chrome.storage.local.get(['site_settings'], (result) => {
          const settings = result.site_settings || {};
          settings[id] = el.checked;
          chrome.storage.local.set({ site_settings: settings });
        });
      });
    }
  });

  // 点击 View 按钮自动打开或切换至 XC AI Web 应用
  if (btnView) {
    btnView.addEventListener('click', () => {
      chrome.tabs.query({ url: 'http://localhost:3000/*' }, (tabs) => {
        if (tabs.length > 0) {
          chrome.tabs.update(tabs[0].id, { active: true });
        } else {
          chrome.tabs.create({ url: 'http://localhost:3000/#clipper' });
        }
      });
    });
  }

  // 批量抓取当前页面图片
  if (btnBatchClip) {
    btnBatchClip.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'BATCH_CLIP' }, (response) => {
            if (response && response.count) {
              btnBatchClip.innerText = `✅ 已抓取 ${response.count} 张图片至 XC AI`;
              setTimeout(() => {
                btnBatchClip.innerText = '✨ 批量抓取当前网页图片至 XC AI';
              }, 3000);
            }
          });
        }
      });
    });
  }
});
