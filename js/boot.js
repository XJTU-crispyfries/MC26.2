/* ============================================================
 *  启动自检
 *    1. 校验 config.js 填得对不对
 *    2. 确认填的是公开密钥而不是数据库管理密钥
 *    3. 连一次数据库，确认表建好了
 *  任何一步失败都给出明确的中文提示，而不是白屏。
 * ============================================================ */
(function () {
  'use strict';

  var APP = window.APP = window.APP || {};
  var CONFIG = window.CONFIG || {};

  APP.util = {

    /** 把任意输入变成安全的文本节点内容，杜绝 XSS */
    text: function (s) {
      return s == null ? '' : String(s);
    },

    /** 建元素的小助手：el('div', 'card', 'hello') */
    el: function (tag, className, textContent) {
      var node = document.createElement(tag);
      if (className) node.className = className;
      if (textContent != null) node.textContent = textContent;
      return node;
    },

    /** '123 64 -45'，坐标全空时返回空串 */
    coordsText: function (m) {
      var parts = [m.coord_x, m.coord_y, m.coord_z].filter(function (v) {
        return v !== null && v !== undefined && v !== '';
      });
      if (parts.length === 0) return '';
      return parts.join(' ');
    },

    /** 把 Postgres / 网络的原始报错翻译成人话 */
    friendlyError: function (err) {
      var msg = (err && (err.message || err.error_description || err.msg)) || String(err || '');
      var code = (err && (err.code || err.status)) || '';
      var s = String(msg);
      var lower = s.toLowerCase();

      // 数据库没就绪时，直接转述 boot.js 已经诊断出的原因
      if (code === 'DB_NOT_READY') {
        var p = err && err.problem;
        if (p && p.detail) return p.title + '。' + p.detail;
        return '数据服务还没就绪，请刷新页面重试。';
      }
      if (code === '28000' || s.indexOf('群口令') >= 0) {
        return '群口令不正确。';
      }
      if (code === 'P0002') {
        return '这张卡片已经不存在了，可能被其他人删掉了。';
      }
      if (code === '42501' || lower.indexOf('permission denied') >= 0
          || lower.indexOf('row-level security') >= 0) {
        return '保存被数据库拒绝：权限配置有问题，请检查 schema.sql 是否完整执行。';
      }
      if (code === '42P01' || lower.indexOf('does not exist') >= 0
          && lower.indexOf('relation') >= 0) {
        return '数据库里还没建表，请先在 Supabase 的 SQL Editor 里执行 schema.sql。';
      }
      if (code === '23514' || lower.indexOf('violates check constraint') >= 0) {
        return '有字段填得不合法（例如进度超出 0–100，或区段/维度值不对）。';
      }
      if (lower.indexOf('invalid api key') >= 0 || code === '401') {
        return 'Supabase 密钥不正确或已失效。请回 config.js 重新复制一遍 '
             + 'Publishable key（sb_publishable_ 开头的那串）。';
      }
      if (code === '404' || lower.indexOf('not found') >= 0) {
        return 'Supabase URL 不正确，或者数据库里还没建表。';
      }
      if (lower.indexOf('failed to fetch') >= 0 || lower.indexOf('networkerror') >= 0
          || lower.indexOf('timeout') >= 0 || lower.indexOf('load failed') >= 0) {
        return '连不上数据服务。\n\n'
             + '最常见的原因是当前网络把 supabase.co 的连接直接掐断了'
             + '（国内手机流量尤其容易这样）。判断方法：如果电脑上正常、'
             + '手机上不行，基本就是这个原因，而不是服务器出了问题。\n'
             + '解决办法是让 js/config.js 里的 supabaseProxyPath 走同源转发'
             + '（已经配好就不用管）。\n\n'
             + '另一种可能：Supabase 免费项目 7 天没有访问会被暂停，'
             + '去后台点 Restore 唤醒即可，数据不会丢。';
      }
      if (code === '23505') {
        return '已经有同名的记录冲突。';
      }
      return '出错了：' + s;
    },
  };


  /* ---------- 密钥类型判定 ---------- */

  /** 解出 Supabase 密钥的用途。返回 anon / service / publishable / secret / unknown */
  function classifyKey(key) {
    var k = String(key || '').trim();
    if (!k) return 'empty';

    // Supabase 新版密钥格式（2025 年 11 月之后新建的项目只有这种）
    if (k.indexOf('sb_publishable_') === 0) return 'publishable';
    if (k.indexOf('sb_secret_') === 0)      return 'secret';

    // 20 位纯小写字母 = 项目 ID，经常被误当成密钥复制过来
    if (/^[a-z]{20}$/.test(k)) return 'projectref';

    // 老版是 JWT，取中段解出 role
    var parts = k.split('.');
    if (parts.length === 3) {
      try {
        var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';
        var payload = JSON.parse(decodeURIComponent(
          atob(b64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join('')
        ));
        if (payload.role === 'anon')         return 'anon';
        if (payload.role === 'service_role') return 'service';
      } catch (e) { /* 落到 unknown */ }
    }
    return 'unknown';
  }


  /* ---------- 配置校验 ---------- */

  APP.checkConfig = function () {
    var key = String(CONFIG.supabaseKey || '').trim();
    var rawUrl = String(CONFIG.supabaseUrl || '').trim();
    var proxyPath = String(CONFIG.supabaseProxyPath || '').trim();

    /* ---- 地址 --------------------------------------------------
     * 优先走本页上的同源转发：国内不少网络（尤其手机流量）会重置到
     * supabase.co 的连接，而本站域名（Cloudflare Pages）是通的。
     * 双击打开的 file:// 没有同源后端可用，只能退回直连。
     * ---------------------------------------------------------- */
    var url = '';
    var via = 'direct';

    if (proxyPath && location.protocol !== 'file:') {
      if (proxyPath.indexOf('//') === 0 || proxyPath.indexOf(':') >= 0) {
        return {
          ok: false, fatal: false,
          title: 'supabaseProxyPath 填错了',
          detail: '它只能填本页上的路径，比如 /sb。\n\n'
                + '填成完整网址会把本页变成给所有人白用的公共代理，'
                + '所以这里拦下了。要改回直连，把它留空即可。',
        };
      }
      if (proxyPath.charAt(0) !== '/') proxyPath = '/' + proxyPath;
      url = location.origin + proxyPath.replace(/\/+$/, '');
      via = 'proxy';
    } else {
      url = rawUrl;
    }

    if (!url || !key) {
      return {
        ok: false,
        fatal: false,
        title: '数据服务还没配置',
        detail: '打开 js/config.js，把 supabaseUrl（或 supabaseProxyPath）'
              + '和 supabaseKey 填上，然后刷新本页。'
              + '服务器状态卡不受影响，照常可用。',
      };
    }

    // 只填了项目 ID（形如 lldognoxfhapyawffust）也认得，自动补成完整网址
    if (/^[a-z]{20}$/.test(url)) {
      url = 'https://' + url + '.supabase.co';
    }

    // URL 格式：常见错法是连 /rest/v1/ 一起复制了。
    // 走转发时地址是本页自己的，这些检查不适用。
    var urlProblem = null;
    if (via === 'direct') {
      if (url.indexOf('https://') !== 0) {
        urlProblem = 'supabaseUrl 必须以 https:// 开头。';
      } else if (url.indexOf('.supabase.co') < 0) {
        urlProblem = 'supabaseUrl 里没看到 .supabase.co，可能复制错了。';
      } else if (url.replace(/\/+$/, '') !== url.replace(/^(https:\/\/[^/]+).*$/, '$1')) {
        urlProblem = 'supabaseUrl 只要域名部分，不要带 /rest/v1/ 之类的路径。';
      }
    }
    if (urlProblem) {
      return { ok: false, fatal: false, title: 'Supabase 网址填错了', detail: urlProblem };
    }

    // 密钥类型：填错成管理密钥是最危险的情况，直接拦死
    var kind = classifyKey(key);
    if (kind === 'service' || kind === 'secret') {
      return {
        ok: false,
        fatal: true,
        title: '配置错误：填的是数据库管理密钥',
        detail: '你填的这把密钥拥有数据库的全部权限。它一旦放进网页，'
              + '任何打开本页的人都能拿走它并删光或篡改所有数据。\n\n'
              + '请回到 js/config.js，把 supabaseKey 换成后台 '
              + 'Project Settings → API 里标着 anon / public 的那把，'
              + '然后刷新本页。',
      };
    }
    if (kind === 'projectref') {
      return {
        ok: false,
        fatal: false,
        title: '这填的是项目 ID，不是密钥',
        detail: '这串 20 位小写字母是你的项目 ID，它应该填在 supabaseUrl 那一行。\n\n'
              + 'supabaseKey 那一行要填的是 Publishable key，'
              + '一长串、以 sb_publishable_ 开头。\n'
              + '位置：Supabase 后台 → Project Settings → API Keys → '
              + 'Publishable and secret API keys。',
      };
    }
    if (kind === 'unknown') {
      return {
        ok: false,
        fatal: false,
        title: 'Supabase 密钥看起来不对',
        detail: '它既不是 sb_publishable_ 开头的 Publishable key，也不是老式的 JWT，'
              + '可能复制时缺了一段，或者复制成了别的东西。\n\n'
              + '请回 Supabase 后台 → Project Settings → API Keys → '
              + 'Publishable and secret API keys，完整复制 Publishable key。',
      };
    }

    return { ok: true, url: url.replace(/\/+$/, ''), key: key, via: via };
  };


  /* ---------- 数据库连通性自检 ---------- */

  var dbReady = false;
  var dbProblem = null;

  APP.db = {
    client: null,
    ready: function () { return dbReady; },
    problem: function () { return dbProblem; },
  };

  APP.initDb = function () {
    var cfg = APP.checkConfig();
    if (!cfg.ok) {
      dbProblem = cfg;
      return Promise.resolve(cfg);
    }

    if (typeof window.supabase === 'undefined'
        || typeof window.supabase.createClient !== 'function') {
      dbProblem = {
        ok: false, fatal: false,
        title: '依赖库没加载出来',
        detail: 'vendor/supabase.js 没加载成功。请确认这个文件还在，'
              + '并且是从项目根目录打开 index.html。',
      };
      return Promise.resolve(dbProblem);
    }

    var client = window.supabase.createClient(cfg.url, cfg.key);
    APP.db.client = client;

    console.info('[数据连接] ' + (cfg.via === 'proxy'
      ? '走同源转发 ' + cfg.url + '（浏览器不需要直连 supabase.co）'
      : '直连 ' + cfg.url + '（file:// 本地打开时只能这样）'));

    // 探一次表，把各种失败提前暴露出来
    return client.from('milestones').select('id').limit(1).then(function (res) {
      if (res.error) {
        dbProblem = describe(res.error);
        return dbProblem;
      }
      dbReady = true;
      dbProblem = null;
      return { ok: true };
    }).catch(function (err) {
      dbProblem = describe(err);
      return dbProblem;
    });
  };

  /** 按错误类型挑一个准确的标题，别把网络问题说成权限问题 */
  function describe(err) {
    var s = String((err && (err.message || err.details || err.msg)) || '').toLowerCase();
    var network =
      s.indexOf('failed to fetch') >= 0 ||
      s.indexOf('networkerror') >= 0 ||
      s.indexOf('load failed') >= 0 ||
      s.indexOf('timeout') >= 0 ||
      s.indexOf('aborted') >= 0;

    return {
      ok: false,
      fatal: false,
      title: network ? '连不上数据服务' : '读不到里程碑数据',
      detail: APP.util.friendlyError(err),
      raw: err,
    };
  }


  /* ---------- 启动时提醒 ---------- */

  APP.reportStartup = function () {
    if (location.protocol === 'file:') {
      // 本地双击打开时，状态卡仍可用，只是给个提示
      console.info('[本地预览] 你正在用 file:// 打开本页，'
                 + '状态卡可以正常查询；像素字体在 file:// 下会被浏览器拦掉，'
                 + '要看到字体请用本地服务器打开（VS Code 的 Live Server 插件即可）。');
    }
  };


  /**
   * 致命配置错误（把数据库管理密钥填进了网页）
   * 这种必须显眼地拦在最上面，不能只丢在里程碑区域里。
   */
  APP.showFatal = function (problem) {
    var box = document.getElementById('fatal-banner');
    if (!box) return;

    box.textContent = '';

    box.appendChild(APP.util.el('div', 'fatal-banner__title', '⛔ ' + problem.title));

    var body = APP.util.el('div', 'fatal-banner__body');
    body.textContent = problem.detail || '';
    body.style.whiteSpace = 'pre-wrap';
    box.appendChild(body);

    box.style.display = '';

    var section = document.querySelector('.section-head');
    if (section) section.style.display = 'none';
    var timeline = document.querySelector('.timeline');
    if (timeline) timeline.style.display = 'none';
  };
})();
