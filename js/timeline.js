/* ============================================================
 *  里程碑时间轴
 *    三列：过去 / 现在 / 将来
 *    卡片可拖动 —— 跨列改时间归属，同列内改顺序
 * ============================================================ */
(function () {
  'use strict';

  var APP = window.APP;
  var util = APP.util;

  var ERA_ORDER = ['past', 'present', 'future'];
  var DIM_LABEL = { overworld: '主世界', nether: '下界', end: '末地' };

  var rows = [];              // 数据库里的全部卡片
  var activeCategory = '';    // 分类筛选，空表示全部
  var isDragging = false;
  var timer = null;
  var inFlight = false;
  var loadFailed = null;      // 上一次加载失败的信息

  /* ---------------- 卡片渲染 ---------------- */

  function buildCard(m) {
    var card = util.el('article', 'card');
    card.dataset.id = m.id;

    // 拖拽手柄：只有按住这里才能拖，点卡片其他地方是打开编辑
    var handle = util.el('button', 'drag-handle');
    handle.type = 'button';
    handle.setAttribute('aria-label', '按住拖动排序');
    handle.textContent = '⠿';
    card.appendChild(handle);

    var body = util.el('div', 'card__body');
    body.tabIndex = 0;
    body.setAttribute('role', 'button');
    body.setAttribute('aria-label', '编辑 ' + (m.title || ''));

    // 标题
    body.appendChild(util.el('h3', 'card__title', m.title || '(未命名)'));

    // 标签行：维度 + 分类
    var tags = util.el('div', 'card__tags');
    var dim = util.el('span', 'badge badge--' + (m.dimension || 'overworld'),
                      DIM_LABEL[m.dimension] || m.dimension || '主世界');
    tags.appendChild(dim);
    if (m.category) tags.appendChild(util.el('span', 'chip', m.category));
    body.appendChild(tags);

    // 坐标
    var c = util.coordsText(m);
    if (c) body.appendChild(util.el('div', 'card__coords', c));

    // 简介
    if (m.summary) body.appendChild(util.el('p', 'card__summary', m.summary));

    // 功能
    if (m.function_desc) {
      var f = util.el('p', 'card__function');
      f.appendChild(util.el('span', 'card__function-key', '功能 '));
      f.appendChild(document.createTextNode(m.function_desc));
      body.appendChild(f);
    }

    // 作者
    if (m.author) {
      var a = util.el('p', 'card__author');
      a.appendChild(util.el('span', 'card__author-key', '作者 '));
      a.appendChild(document.createTextNode(m.author));
      body.appendChild(a);
    }

    // 进度
    var pct = Math.max(0, Math.min(100, Number(m.progress) || 0));
    var progWrap = util.el('div', 'progress');
    var bar = util.el('i', 'progress__bar');
    bar.style.width = pct + '%';
    progWrap.appendChild(bar);
    var progLine = util.el('div', 'card__progress');
    progLine.appendChild(progWrap);
    progLine.appendChild(util.el('span', 'card__pct', pct + '%'));
    body.appendChild(progLine);

    body.addEventListener('click', function () { APP.editor.openEdit(m); });
    body.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        APP.editor.openEdit(m);
      }
    });

    card.appendChild(body);
    return card;
  }

  /* ---------------- 渲染 ---------------- */

  function visibleRows() {
    if (!activeCategory) return rows;
    return rows.filter(function (m) { return (m.category || '') === activeCategory; });
  }

  function sortRows(list) {
    return list.slice().sort(function (a, b) {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
    });
  }

  function render() {
    ERA_ORDER.forEach(function (era) {
      var list = document.querySelector('.zone__list[data-era="' + era + '"]');
      if (!list) return;

      list.textContent = '';

      var items = sortRows(visibleRows().filter(function (m) { return m.era === era; }));

      if (items.length === 0) {
        var empty = util.el('div', 'zone__empty');
        if (loadFailed) {
          empty.textContent = '—';
        } else if (activeCategory) {
          empty.textContent = '这个分类下暂无';
        } else {
          empty.textContent = '暂无 · 点右上角「＋ 新建」';
        }
        list.appendChild(empty);
        return;
      }

      items.forEach(function (m) { list.appendChild(buildCard(m)); });
    });

    updateCounts();
  }

  function updateCounts() {
    ERA_ORDER.forEach(function (era) {
      var zone = document.querySelector('.zone[data-era="' + era + '"]');
      if (!zone) return;
      var n = visibleRows().filter(function (m) { return m.era === era; }).length;
      var badge = zone.querySelector('.zone__count');
      if (badge) badge.textContent = n > 0 ? String(n) : '';
    });
  }

  /* ---------------- 分类筛选 ---------------- */

  function renderFilter() {
    var box = document.getElementById('category-filter');
    if (!box) return;

    var counts = {};
    rows.forEach(function (m) {
      var c = (m.category || '').trim();
      if (!c) return;
      counts[c] = (counts[c] || 0) + 1;
    });

    var cats = Object.keys(counts).sort();

    box.textContent = '';
    box.appendChild(makeFilterChip('全部', '', rows.length));

    cats.forEach(function (c) {
      box.appendChild(makeFilterChip(c, c, counts[c]));
    });
  }

  function makeFilterChip(label, value, count) {
    var b = util.el('button', 'filter-chip');
    b.type = 'button';
    b.textContent = label + (count ? ' ' + count : '');
    if (activeCategory === value) b.classList.add('is-active');
    b.addEventListener('click', function () {
      activeCategory = value;
      renderFilter();
      render();
    });
    return b;
  }

  /* ---------------- 加载 ---------------- */

  function showLoadError(problem) {
    var box = document.getElementById('timeline-error');
    if (!box) return;
    box.textContent = '';
    box.style.display = '';

    box.appendChild(util.el('strong', 'timeline-error__title', problem.title));

    var detail = util.el('div', 'timeline-error__detail');
    detail.textContent = problem.detail || '';
    detail.style.whiteSpace = 'pre-wrap';
    box.appendChild(detail);

    if (problem.raw) {
      var d = document.createElement('details');
      d.className = 'timeline-error__raw';
      var s = document.createElement('summary');
      s.textContent = '技术细节（排查时给开发者看）';
      var pre = util.el('pre', null, JSON.stringify(problem.raw, null, 2));
      d.appendChild(s);
      d.appendChild(pre);
      box.appendChild(d);
    }

    var retry = util.el('button', 'btn btn--ghost', '重试');
    retry.type = 'button';
    retry.addEventListener('click', function () { reload(true); });
    box.appendChild(retry);
  }

  function hideLoadError() {
    var box = document.getElementById('timeline-error');
    if (box) { box.style.display = 'none'; box.textContent = ''; }
  }

  function reload(manual) {
    if (inFlight) return Promise.resolve();

    if (!APP.db.ready()) {
      var p = APP.db.problem() || {
        title: '数据服务未配置',
        detail: '打开 js/config.js 填上 Supabase 网址和密钥。',
      };
      loadFailed = p;
      showLoadError(p);
      render();          // 区段照常画出来，别让页面看起来是坏的
      return Promise.resolve();
    }

    inFlight = true;
    var btn = document.getElementById('timeline-refresh');
    if (btn) btn.classList.add('is-busy');

    return APP.api.list()
      .then(function (data) {
        rows = data;
        loadFailed = null;
        hideLoadError();
        renderFilter();
        render();
        if (manual) toast.ok('已更新');
      })
      .catch(function (err) {
        // 加载失败时保留原有画面，绝不渲染成"空的"——
        // 那看起来像是所有人的记录都被删了。
        loadFailed = {
          title: '读不到里程碑数据',
          detail: util.friendlyError(err),
          raw: err,
        };
        showLoadError(loadFailed);
        render();
        if (manual) toast.error('刷新失败：' + util.friendlyError(err));
      })
      .finally(function () {
        inFlight = false;
        if (btn) btn.classList.remove('is-busy');
      });
  }

  /* ---------------- 拖拽 ---------------- */

  function neighboursOf(cardEl, listEl) {
    var kids = Array.prototype.filter.call(listEl.children, function (el) {
      return el.classList && el.classList.contains('card');
    });
    var i = kids.indexOf(cardEl);
    return {
      prev: i > 0 ? kids[i - 1].dataset.id : null,
      next: i >= 0 && i < kids.length - 1 ? kids[i + 1].dataset.id : null,
    };
  }

  function onDrop(evt) {
    var cardEl = evt.item;
    var id = cardEl.dataset.id;
    var era = evt.to.dataset.era;
    var nb = neighboursOf(cardEl, evt.to);

    // 位置没变就别写库
    if (evt.from === evt.to && evt.oldIndex === evt.newIndex) {
      isDragging = false;
      return;
    }

    // 乐观更新本地模型，避免紧接着的 reload 把它弹回去
    var row = rows.filter(function (m) { return m.id === id; })[0];
    if (row) row.era = era;

    APP.api.move(id, era, nb.prev, nb.next)
      .then(function () {
        return reload(false);
      })
      .catch(function (err) {
        if (err && err.__cancelled) {
          // 用户取消了输入口令，回到服务端的真实状态
          return reload(false);
        }
        toast.error(util.friendlyError(err));
        return reload(false);
      })
      .finally(function () {
        isDragging = false;
      });
  }

  function initSortable() {
    if (typeof window.Sortable === 'undefined') {
      console.error('SortableJS 没加载出来，拖拽功能不可用。');
      return;
    }

    document.querySelectorAll('.zone__list').forEach(function (list) {
      window.Sortable.create(list, {
        group: 'milestones',
        handle: '.drag-handle',
        draggable: '.card',
        animation: 150,
        ghostClass: 'card--ghost',
        dragClass: 'card--dragging',
        emptyInsertThreshold: 40,
        onStart: function () { isDragging = true; },
        onEnd: onDrop,
      });
    });
  }

  /* ---------------- 启动 ---------------- */

  function start() {
    // 每个区段右上角的「＋ 新建」直接带好时间
    document.querySelectorAll('.btn-add').forEach(function (b) {
      b.addEventListener('click', function () {
        APP.editor.openNew(b.dataset.era || '');
      });
    });

    var globalAdd = document.getElementById('global-add');
    if (globalAdd) {
      globalAdd.addEventListener('click', function () { APP.editor.openNew(); });
    }

    var refreshBtn = document.getElementById('timeline-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () { reload(true); });
    }

    initSortable();
    reload(false);

    var secs = Number(window.CONFIG.milestonesRefreshSeconds) || 30;
    timer = setInterval(function () {
      if (document.hidden || isDragging) return;
      reload(false);
    }, secs * 1000);

    // 切回页面时同步一次，别人刚加的卡片马上能看到
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !isDragging) reload(false);
    });
    window.addEventListener('focus', function () {
      if (!isDragging) reload(false);
    });
  }

  APP.timeline = { start: start, reload: reload };
})();
