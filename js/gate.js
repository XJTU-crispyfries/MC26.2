/* ============================================================
 *  群口令输入框
 *    只在第一次写入（或口令被换过之后）弹一次，
 *    之后存在浏览器本地，日常使用无感。
 * ============================================================ */
(function () {
  'use strict';

  var APP = window.APP;
  var pending = null;   // 同一时间只允许一个输入框

  function ask() {
    if (pending) return pending;

    pending = new Promise(function (resolve, reject) {
      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay';

      var modal = document.createElement('div');
      modal.className = 'modal modal--gate';

      var h = document.createElement('h2');
      h.className = 'modal__title';
      h.textContent = '输入群口令';

      var p = document.createElement('p');
      p.className = 'modal__hint';
      p.textContent = '写入里程碑需要群口令，问群主要一个。'
                    + '输入一次之后会记在这台设备上，以后不用再输。';

      var input = document.createElement('input');
      input.type = 'password';
      input.className = 'input';
      input.placeholder = '群口令';
      input.autocomplete = 'current-password';

      var errBox = document.createElement('p');
      errBox.className = 'form-error';
      errBox.style.display = 'none';

      var actions = document.createElement('div');
      actions.className = 'modal__actions';

      var cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'btn btn--ghost';
      cancel.textContent = '取消';

      var ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'btn btn--primary';
      ok.textContent = '确定';

      actions.appendChild(cancel);
      actions.appendChild(ok);

      modal.appendChild(h);
      modal.appendChild(p);
      modal.appendChild(input);
      modal.appendChild(errBox);
      modal.appendChild(actions);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      setTimeout(function () { input.focus(); }, 30);

      function close() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        document.removeEventListener('keydown', onKey);
        pending = null;
      }

      function submit() {
        var v = input.value.trim();
        if (!v) {
          errBox.textContent = '口令不能为空。';
          errBox.style.display = '';
          input.focus();
          return;
        }
        close();
        resolve(v);
      }

      function cancelAsk() {
        close();
        var e = new Error('已取消，没有保存。');
        e.__cancelled = true;
        reject(e);
      }

      function onKey(ev) {
        if (ev.key === 'Escape') cancelAsk();
        if (ev.key === 'Enter') submit();
      }

      ok.addEventListener('click', submit);
      cancel.addEventListener('click', cancelAsk);
      overlay.addEventListener('mousedown', function (ev) {
        if (ev.target === overlay) cancelAsk();
      });
      document.addEventListener('keydown', onKey);
    });

    return pending;
  }

  APP.gate = { ask: ask };
})();
