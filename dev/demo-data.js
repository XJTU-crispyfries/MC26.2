/* ============================================================
 *  演示数据（可选，可以直接删掉）
 *
 *  在网址后面加上  ?demo=1  就会加载这里的假数据，
 *  用来在没有配置 Supabase 的情况下先看排版和交互。
 *  演示模式下所有改动都只存在于浏览器内存里，
 *  刷新即还原，不会写进数据库，也删不掉真数据。
 * ============================================================ */
(function () {
  var APP = window.APP;

  APP.initDb = function () { return Promise.resolve({ ok: true }); };
  APP.db.ready = function () { return true; };
  APP.db.problem = function () { return null; };

  // 这个脚本是被动态插进来的，加载完成的时机可能晚于
  // DOMContentLoaded，所以不能只依赖那个事件，直接插入就行。
  function showBanner() {
    var anchor = document.getElementById('fatal-banner');
    if (!anchor || !anchor.parentNode) return;

    var bar = document.createElement('div');
    bar.className = 'fatal-banner';
    bar.style.cssText = 'background:#2a2410;border-color:#8a7320;';

    var t = document.createElement('div');
    t.className = 'fatal-banner__title';
    t.textContent = '🧪 演示模式';

    var b = document.createElement('div');
    b.className = 'fatal-banner__body';
    b.textContent = '下面显示的是示例卡片，改动不会保存。'
                  + '去掉网址后面的 ?demo=1 就回到真实数据。';

    bar.appendChild(t);
    bar.appendChild(b);
    anchor.parentNode.insertBefore(bar, anchor);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showBanner);
  } else {
    showBanner();
  }

  var rows = [
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000001',
      era: 'past', sort_order: 0, title: '小黑塔（末影人农场）',
      summary: '末地主岛旁边，挂机产末影珍珠', function_desc: '挂机刷末影珍珠和经验',
      dimension: 'end', coord_x: 320, coord_y: 64, coord_z: -180,
      author: '阿伟', category: '末地工程', progress: 100,
    },
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000002',
      era: 'past', sort_order: 1, title: '村民繁殖机',
      summary: '刷村民用的', function_desc: '批量生产村民',
      dimension: 'overworld', coord_x: -412, coord_y: 70, coord_z: 96,
      author: '小李', category: '村民工程', progress: 100,
    },
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000003',
      era: 'present', sort_order: 0, title: '僵尸猪灵经验农场',
      summary: '下界顶部，正在调试收集系统', function_desc: '挂机产经验，附带金粒和腐肉',
      dimension: 'nether', coord_x: 128, coord_y: 128, coord_z: -64,
      author: '阿伟 / 老王', category: '下界工程', progress: 65,
    },
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000004',
      era: 'present', sort_order: 1,
      title: '<img src=x onerror="window.__xss=1">',
      summary: '用来测 XSS 的标题', function_desc: '不应该执行',
      dimension: 'overworld', coord_x: 0, coord_y: 64, coord_z: 0,
      author: '<script>window.__xss=2<\/script>', category: '其他', progress: 30,
    },
    {
      id: 'aaaaaaaa-0000-0000-0000-000000000005',
      era: 'future', sort_order: 0, title: '末地折跃门交通网',
      summary: '还没开始', function_desc: '连接主岛和外岛',
      dimension: 'end', coord_x: null, coord_y: null, coord_z: null,
      author: '', category: '交通 / 地狱门', progress: 0,
    },
  ];

  APP.api.list = function () { return Promise.resolve(rows.slice()); };
  APP.api.move = function () { return Promise.resolve(); };
  APP.api.save = function () { return Promise.resolve(rows[0]); };
  APP.api.remove = function () { return Promise.resolve(); };
})();
