/* ============================================================
 *  新建 / 编辑 / 删除 里程碑
 *    新建时第一步先问：在过去、现在，还是将来
 * ============================================================ */
(function () {
  'use strict';

  var APP = window.APP;
  var util = APP.util;

  var ERAS = [
    { key: 'past',    label: '过去', desc: '已经建好了' },
    { key: 'present', label: '现在', desc: '正在做' },
    { key: 'future',  label: '将来', desc: '计划要做' },
  ];

  var DIMENSIONS = [
    { key: 'overworld', label: '主世界' },
    { key: 'nether',    label: '下界' },
    { key: 'end',       label: '末地' },
  ];

  var CATEGORIES = [
    '村民工程', '刷怪塔', '交通 / 地狱门', '仓储系统', '红石机械',
    '下界工程', '末地工程', '农业', '装饰 / 建筑', '基础设施', '其他',
  ];

  var busy = false;   // 防双击重复提交

  function eraLabel(key) {
    var e = ERAS.filter(function (x) { return x.key === key; })[0];
    return e ? e.label : key;
  }

  /* ---------------- 表单小工具 ---------------- */

  function field(labelText, control, hint) {
    var wrap = util.el('label', 'field');
    wrap.appendChild(util.el('span', 'field__label', labelText));
    wrap.appendChild(control);
    if (hint) wrap.appendChild(util.el('span', 'field__hint', hint));
    return wrap;
  }

  function input(type, name, value, placeholder) {
    var i = document.createElement('input');
    i.type = type;
    i.className = 'input';
    i.name = name;
    i.value = value == null ? '' : String(value);
    if (placeholder) i.placeholder = placeholder;
    return i;
  }

  function closeModal(overlay) {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    document.removeEventListener('keydown', onEsc);
  }

  var currentOverlay = null;
  function onEsc(ev) {
    if (ev.key === 'Escape' && currentOverlay) closeModal(currentOverlay);
  }

  function makeOverlay(modal) {
    var overlay = util.el('div', 'modal-overlay');
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    currentOverlay = overlay;
    document.addEventListener('keydown', onEsc);
    return overlay;
  }

  /* ---------------- 第一步：选时间 ---------------- */

  function askEra() {
    return new Promise(function (resolve, reject) {
      var modal = util.el('div', 'modal modal--era');

      modal.appendChild(util.el('h2', 'modal__title', '这件事在什么时候？'));
      modal.appendChild(util.el('p', 'modal__hint', '选完之后再填具体内容，之后也可以拖动卡片改。'));

      var grid = util.el('div', 'era-grid');

      ERAS.forEach(function (e) {
        var b = util.el('button', 'era-choice era-choice--' + e.key);
        b.type = 'button';
        b.appendChild(util.el('span', 'era-choice__label', e.label));
        b.appendChild(util.el('span', 'era-choice__desc', e.desc));
        b.addEventListener('click', function () {
          closeModal(overlay);
          resolve(e.key);
        });
        grid.appendChild(b);
      });

      modal.appendChild(grid);

      var actions = util.el('div', 'modal__actions');
      var cancel = util.el('button', 'btn btn--ghost', '取消');
      cancel.type = 'button';
      cancel.addEventListener('click', function () {
        closeModal(overlay);
        var err = new Error('已取消');
        err.__cancelled = true;
        reject(err);
      });
      actions.appendChild(cancel);
      modal.appendChild(actions);

      var overlay = makeOverlay(modal);
      var first = grid.querySelector('button');
      if (first) setTimeout(function () { first.focus(); }, 30);
    });
  }

  /* ---------------- 第二步：填内容 ---------------- */

  function openForm(data) {
    var isEdit = !!data.id;

    return new Promise(function (resolve, reject) {
      var modal = util.el('div', 'modal modal--form');
      modal.appendChild(util.el('h2', 'modal__title', isEdit ? '编辑里程碑' : '新建里程碑'));

      var form = document.createElement('form');
      form.className = 'form';
      form.noValidate = true;

      var titleIn = input('text', 'title', data.title, '例如：僵尸猪灵经验农场');
      titleIn.maxLength = 80;
      titleIn.required = true;
      form.appendChild(field('名称 *', titleIn));

      var catIn = input('text', 'category', data.category, '选一个或自己填');
      catIn.setAttribute('list', 'category-options');
      form.appendChild(field('分类', catIn));

      var summaryIn = input('text', 'summary', data.summary, '一句话说明这是什么');
      form.appendChild(field('简介', summaryIn));

      var fnIn = document.createElement('textarea');
      fnIn.className = 'input input--area';
      fnIn.rows = 2;
      fnIn.name = 'function_desc';
      fnIn.value = data.function_desc || '';
      fnIn.placeholder = '例如：挂机产经验，附带金粒和腐肉';
      form.appendChild(field('功能', fnIn));

      // 维度 + 坐标
      var dimSel = document.createElement('select');
      dimSel.className = 'input';
      dimSel.name = 'dimension';
      DIMENSIONS.forEach(function (d) {
        var o = document.createElement('option');
        o.value = d.key;
        o.textContent = d.label;
        if ((data.dimension || 'overworld') === d.key) o.selected = true;
        dimSel.appendChild(o);
      });

      var coordRow = util.el('div', 'coord-row');
      var xIn = input('number', 'coord_x', data.coord_x, 'X');
      var yIn = input('number', 'coord_y', data.coord_y, 'Y');
      var zIn = input('number', 'coord_z', data.coord_z, 'Z');
      coordRow.appendChild(xIn);
      coordRow.appendChild(yIn);
      coordRow.appendChild(zIn);

      var coordWrap = util.el('div', 'field');
      coordWrap.appendChild(util.el('span', 'field__label', '坐标'));
      coordWrap.appendChild(dimSel);
      coordWrap.appendChild(coordRow);
      coordWrap.appendChild(util.el('span', 'field__hint', '可以填负数，也可以留空。'));
      form.appendChild(coordWrap);

      var authorIn = input('text', 'author', data.author, '谁设计或建造的');
      form.appendChild(field('创作来源 / 作者', authorIn));

      // 进度
      var prog = util.el('div', 'progress-field');
      var progRange = document.createElement('input');
      progRange.type = 'range';
      progRange.min = '0';
      progRange.max = '100';
      progRange.step = '5';
      progRange.value = data.progress == null ? 0 : data.progress;
      progRange.className = 'progress-range';
      var progNum = input('number', 'progress', data.progress == null ? 0 : data.progress);
      progNum.min = '0';
      progNum.max = '100';
      progNum.className = 'input input--num';
      var pct = util.el('span', 'progress-pct', progRange.value + '%');

      progRange.addEventListener('input', function () {
        progNum.value = progRange.value;
        pct.textContent = progRange.value + '%';
      });
      progNum.addEventListener('input', function () {
        var v = Math.max(0, Math.min(100, Number(progNum.value) || 0));
        progRange.value = v;
        pct.textContent = v + '%';
      });

      prog.appendChild(progRange);
      prog.appendChild(progNum);
      prog.appendChild(pct);

      var progWrap = util.el('div', 'field');
      progWrap.appendChild(util.el('span', 'field__label', '进度'));
      progWrap.appendChild(prog);
      form.appendChild(progWrap);

      // 区段（拖拽之外的另一条路，也方便手机上精确改）
      var eraSel = document.createElement('select');
      eraSel.className = 'input';
      eraSel.name = 'era';
      ERAS.forEach(function (e) {
        var o = document.createElement('option');
        o.value = e.key;
        o.textContent = e.label + '（' + e.desc + '）';
        if (data.era === e.key) o.selected = true;
        eraSel.appendChild(o);
      });
      form.appendChild(field('时间区段', eraSel, '不改也行，直接拖卡片更快。'));

      // 分类候选
      var datalist = document.createElement('datalist');
      datalist.id = 'category-options';
      CATEGORIES.forEach(function (c) {
        var o = document.createElement('option');
        o.value = c;
        datalist.appendChild(o);
      });
      form.appendChild(datalist);

      var errBox = util.el('p', 'form-error');
      errBox.style.display = 'none';
      form.appendChild(errBox);

      modal.appendChild(form);

      // 按钮区
      var actions = util.el('div', 'modal__actions');

      if (isEdit) {
        var del = util.el('button', 'btn btn--danger', '删除');
        del.type = 'button';
        del.addEventListener('click', function () {
          if (del.disabled) return;
          if (!confirm('确定要删掉「' + (data.title || '这张卡片') + '」吗？删了就找不回来了。')) return;
          del.disabled = true;
          del.textContent = '删除中…';
          APP.api.remove(data.id)
            .then(function () {
              toast.ok('已删除');
              closeModal(overlay);
              APP.timeline.reload();
              resolve();
            })
            .catch(function (err) {
              del.disabled = false;
              del.textContent = '删除';
              if (err && err.__cancelled) return;
              showError(errBox, util.friendlyError(err));
            });
        });
        actions.appendChild(del);
      }

      var spacer = util.el('div', 'modal__spacer');
      actions.appendChild(spacer);

      var cancel = util.el('button', 'btn btn--ghost', '取消');
      cancel.type = 'button';
      cancel.addEventListener('click', function () {
        closeModal(overlay);
        var err = new Error('已取消');
        err.__cancelled = true;
        reject(err);
      });
      actions.appendChild(cancel);

      var save = util.el('button', 'btn btn--primary', isEdit ? '保存' : '创建');
      save.type = 'submit';
      actions.appendChild(save);

      // 必须挂进 form 里，不能挂在 modal 上：
      // type="submit" 的按钮只有作为表单后代（或用 form 属性关联）才会真的提交，
      // 挂在 modal 上就成了兄弟节点，点了没有任何反应，submit 事件永不触发。
      form.appendChild(actions);

      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        if (busy) return;

        var title = titleIn.value.trim();
        if (!title) {
          showError(errBox, '名称不能为空。');
          titleIn.focus();
          return;
        }

        busy = true;
        save.disabled = true;
        save.textContent = '保存中…';
        hideError(errBox);

        var payload = {
          title: title,
          summary: summaryIn.value.trim(),
          function_desc: fnIn.value.trim(),
          dimension: dimSel.value,
          coord_x: xIn.value.trim(),
          coord_y: yIn.value.trim(),
          coord_z: zIn.value.trim(),
          author: authorIn.value.trim(),
          category: catIn.value.trim(),
          progress: String(Math.max(0, Math.min(100, Number(progNum.value) || 0))),
          era: eraSel.value,
        };
        if (isEdit) payload.id = data.id;

        APP.api.save(payload)
          .then(function () {
            toast.ok(isEdit ? '已保存' : '已添加');
            closeModal(overlay);
            APP.timeline.reload();
            resolve();
          })
          .catch(function (err) {
            busy = false;
            save.disabled = false;
            save.textContent = isEdit ? '保存' : '创建';
            if (err && err.__cancelled) return;
            showError(errBox, util.friendlyError(err));
          });
      });

      var overlay = makeOverlay(modal);
      setTimeout(function () { titleIn.focus(); }, 30);
    });
  }

  function showError(box, text) {
    box.textContent = text;
    box.style.display = '';
  }

  function hideError(box) {
    box.textContent = '';
    box.style.display = 'none';
  }

  /* ---------------- 对外接口 ---------------- */

  /** 新建：先问时间，再填表 */
  function openNew(era) {
    var start = era ? Promise.resolve(era) : askEra();
    return start
      .then(function (chosen) {
        return openForm({ era: chosen, dimension: 'overworld', progress: 0 });
      })
      .catch(function (err) {
        if (!err || !err.__cancelled) {
          toast.error(util.friendlyError(err));
        }
      });
  }

  /** 编辑：直接进表单 */
  function openEdit(milestone) {
    return openForm(Object.assign({}, milestone)).catch(function (err) {
      if (!err || !err.__cancelled) {
        toast.error(util.friendlyError(err));
      }
    });
  }

  APP.editor = {
    openNew: openNew,
    openEdit: openEdit,
    eraLabel: eraLabel,
  };
})();
