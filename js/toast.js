/* 右下角提示条 */
(function () {
  'use strict';

  var box = null;

  function root() {
    if (!box) {
      box = document.getElementById('toast-root');
    }
    return box;
  }

  /**
   * @param {string} message 提示内容
   * @param {'info'|'ok'|'error'} kind
   * @param {number} ms 停留毫秒
   */
  function toast(message, kind, ms) {
    var el = document.createElement('div');
    el.className = 'toast toast--' + (kind || 'info');
    el.textContent = message;
    root().appendChild(el);

    // 下一帧加 class 触发进入动画
    requestAnimationFrame(function () { el.classList.add('toast--in'); });

    setTimeout(function () {
      el.classList.remove('toast--in');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 200);
    }, ms || (kind === 'error' ? 6000 : 3000));
  }

  window.toast = {
    info:  function (m, ms) { toast(m, 'info', ms); },
    ok:    function (m, ms) { toast(m, 'ok', ms); },
    error: function (m, ms) { toast(m, 'error', ms); },
  };
})();
