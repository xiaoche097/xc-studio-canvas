// XC AI Clipper Content Script
(function () {
  console.log('[XC AI Clipper] Extension loaded');

  // 心跳广播：告诉 Web 页面“XC AI Clipper 已连接”
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

  // 1000ms 轮询心跳
  setInterval(announceExtension, 1000);
  announceExtension();

  // 监听来自 Web 页面的操控指令
  window.addEventListener('message', function (event) {
    if (!event.data || typeof event.data !== 'object') return;
    const data = event.data;

    // 探测请求
    if (data.type === 'XC_CLIPPER_PING') {
      announceExtension();
    }

    // 远程滚轮指令
    if (data.type === 'XC_CLIPPER_SCROLL') {
      const topDelta = data.topDelta || 400;
      window.scrollBy({
        top: topDelta,
        behavior: 'smooth',
      });
      setTimeout(announceExtension, 300);
    }

    // 远程点击指令
    if (data.type === 'XC_CLIPPER_CLICK' && typeof data.x === 'number' && typeof data.y === 'number') {
      const target = document.elementFromPoint(data.x, data.y);
      if (target) {
        target.click();
        setTimeout(announceExtension, 300);
      }
    }
  });
})();
