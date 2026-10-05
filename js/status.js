/* ============================================================
 *  服务器状态卡
 *    主接口 api.mcstatus.io → 失败自动降级到 api.mcsrvstat.us
 *    两个都拿不到时，显示上一次成功的结果并标注时间
 * ============================================================ */
(function () {
  'use strict';

  var APP = window.APP;
  var CONFIG = window.CONFIG || {};
  var util = APP.util;

  var LAST_GOOD_KEY = 'mc.lastStatus';
  var FETCH_TIMEOUT_MS = 12000;

  var timer = null;
  var inFlight = false;
  var state = { kind: 'loading' };   // loading | ok | stale | error

  /* ---------------- 数据获取 ---------------- */

  function address() {
    var s = CONFIG.server || {};
    return { host: s.host, port: s.port, label: s.label || s.host || '服务器' };
  }

  function fetchJson(url) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, FETCH_TIMEOUT_MS);

    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .finally(function () { clearTimeout(t); });
  }

  /** 主接口：mcstatus.io */
  function viaMcStatusIo(host, port) {
    return fetchJson('https://api.mcstatus.io/v2/status/java/'
                     + encodeURIComponent(host) + ':' + port)
      .then(function (d) {
        if (!d || typeof d.online !== 'boolean') throw new Error('返回格式不对');
        return {
          online: d.online,
          playersOnline: d.players ? d.players.online : null,
          playersMax:    d.players ? d.players.max    : null,
          version: d.version ? (d.version.name_clean || d.version.name_raw) : '',
          motd: d.motd ? (d.motd.clean || '') : '',
          icon: '',
          checkedAt: Date.now(),
        };
      });
  }

  /** 备用接口：mcsrvstat.us */
  function viaMcSrvStat(host, port) {
    return fetchJson('https://api.mcsrvstat.us/3/'
                     + encodeURIComponent(host) + ':' + port)
      .then(function (d) {
        if (!d || typeof d.online !== 'boolean') throw new Error('返回格式不对');
        var motd = d.motd && d.motd.clean
          ? (Array.isArray(d.motd.clean) ? d.motd.clean.join('\n') : d.motd.clean)
          : '';
        return {
          online: d.online,
          playersOnline: d.players ? d.players.online : null,
          playersMax:    d.players ? d.players.max    : null,
          version: d.version || '',
          motd: motd,
          icon: d.icon || '',
          checkedAt: Date.now(),
        };
      });
  }

  function fetchStatus() {
    var a = address();
    return viaMcStatusIo(a.host, a.port)
      .catch(function (e1) {
        console.warn('mcstatus.io 查询失败，改用备用接口：', e1 && e1.message);
        return viaMcSrvStat(a.host, a.port);
      });
  }

  /* ---------------- 缓存上一次成功结果 ---------------- */

  function saveLastGood(data) {
    try { localStorage.setItem(LAST_GOOD_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function loadLastGood() {
    try {
      var raw = localStorage.getItem(LAST_GOOD_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /* ---------------- 渲染 ---------------- */

  function fmtTime(ts) {
    if (!ts) return '—';
    var d = new Date(ts);
    var p = function (n) { return n < 10 ? '0' + n : String(n); };
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function render() {
    var card = document.getElementById('status-card');
    if (!card) return;

    card.classList.remove('is-loading', 'is-online', 'is-offline', 'is-stale', 'is-error');

    var a = address();
    var d = state.data;

    if (state.kind === 'loading') {
      card.classList.add('is-loading');
      setText('status-headline', '查询中…');
      setText('status-address', a.host + ':' + a.port);
      setText('status-players', '—');
      setText('status-version', '—');
      setText('status-motd', '');
      setText('status-checked', '—');
      setHtml('status-players-label', '在线人数');
      return;
    }

    if (state.kind === 'error') {
      card.classList.add('is-error');
      setText('status-headline', '状态查询失败');
      setText('status-address', a.host + ':' + a.port);
      setText('status-players', '—');
      setText('status-version', '—');
      setText('status-checked', state.checkedAt ? fmtTime(state.checkedAt) : '—');
      showMotd(state.message || '两个查询接口都没能返回结果，可能是网络问题，点「刷新」重试。');
      setHtml('status-players-label', '在线人数');
      return;
    }

    // ok 或 stale
    card.classList.add(d.online ? 'is-online' : 'is-offline');
    if (state.kind === 'stale') card.classList.add('is-stale');

    setText('status-headline', d.online ? '在线' : '离线');
    setText('status-address', a.host + ':' + a.port);

    if (d.online && d.playersOnline != null) {
      setText('status-players', d.playersOnline + (d.playersMax ? ' / ' + d.playersMax : ''));
      setHtml('status-players-label', '在线人数');
    } else {
      setText('status-players', '—');
      setHtml('status-players-label', '在线人数');
    }

    setText('status-version', d.version || '—');
    setText('status-checked', fmtTime(d.checkedAt));

    if (state.kind === 'stale') {
      showMotd('数据可能不是最新（这是 ' + fmtTime(d.checkedAt) + ' 的结果）：'
               + (state.message || ''));
    } else if (d.online) {
      showMotd(d.motd || '');
    } else {
      showMotd('服务器当前未开启，或暂时无法从公网探测到。');
    }
  }

  function showMotd(text) {
    var box = document.getElementById('status-motd');
    if (!box) return;
    box.textContent = text || '';
    box.style.display = text ? '' : 'none';
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setHtml(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  /* ---------------- 查询循环 ---------------- */

  function refresh(manual) {
    if (inFlight) return Promise.resolve();
    inFlight = true;

    var btn = document.getElementById('status-refresh');
    if (btn) { btn.disabled = true; btn.classList.add('is-busy'); }

    if (state.kind !== 'ok' && state.kind !== 'stale') {
      state = { kind: 'loading' };
      render();
    }

    return fetchStatus()
      .then(function (data) {
        state = { kind: 'ok', data: data };
        saveLastGood(data);
        if (manual) toast.ok('已更新');
      })
      .catch(function (err) {
        var last = loadLastGood();
        if (last) {
          state = { kind: 'stale', data: last, message: util.friendlyError(err) };
        } else {
          state = { kind: 'error', message: util.friendlyError(err), checkedAt: Date.now() };
        }
        if (manual) toast.error('刷新失败：' + util.friendlyError(err));
      })
      .finally(function () {
        inFlight = false;
        if (btn) { btn.disabled = false; btn.classList.remove('is-busy'); }
        render();
      });
  }

  function schedule() {
    if (timer) clearInterval(timer);
    var secs = Number(CONFIG.statusRefreshSeconds) || 60;
    timer = setInterval(function () {
      if (document.hidden) return;   // 页面在后台就别查了
      refresh(false);
    }, secs * 1000);
  }

  function start() {
    if (!CONFIG.server || !CONFIG.server.host) {
      state = { kind: 'error', message: '还没在 js/config.js 里填服务器地址。', checkedAt: Date.now() };
      render();
      return;
    }

    var btn = document.getElementById('status-refresh');
    if (btn) btn.addEventListener('click', function () { refresh(true); });

    refresh(false);
    schedule();

    // 切回页面时立刻刷新一次，别让用户看着过期数据
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) refresh(false);
    });
    window.addEventListener('focus', function () { refresh(false); });
  }

  APP.status = { start: start, refresh: refresh };
})();
