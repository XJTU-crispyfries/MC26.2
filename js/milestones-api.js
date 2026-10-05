/* ============================================================
 *  里程碑读写
 *    读：直接查表（匿名有 SELECT 权限）
 *    写：只能走带群口令校验的数据库函数，前端改不动这个规则
 * ============================================================ */
(function () {
  'use strict';

  var APP = window.APP;

  var PASS_KEY = 'mc.passcode';

  /* ---------------- 群口令 ---------------- */

  function getPasscode() {
    try { return localStorage.getItem(PASS_KEY) || ''; } catch (e) { return ''; }
  }

  function setPasscode(p) {
    try { localStorage.setItem(PASS_KEY, p); } catch (e) {}
  }

  function clearPasscode() {
    try { localStorage.removeItem(PASS_KEY); } catch (e) {}
  }

  function isPasscodeError(err) {
    var s = String((err && (err.message || err.msg)) || '');
    return (err && err.code === '28000') || s.indexOf('群口令') >= 0;
  }

  /**
   * 所有写入都从这里走：
   *   本地存过口令就直接用；没存过或被服务端拒了，就弹框问。
   *   口令不对最多重问 2 次，之后放弃并报错。
   */
  function write(fn, attemptsLeft) {
    if (attemptsLeft == null) attemptsLeft = 2;

    // 数据库都没连上时别去问口令 —— 用户输完也是白输，
    // 而且会撞出 "Cannot read properties of null" 这种看不懂的原生报错。
    // 直接把 boot.js 里已经诊断好的原因抛出去。
    if (!APP.db.client) {
      var e = new Error('数据库未就绪');
      e.code = 'DB_NOT_READY';
      e.problem = APP.db.problem();
      return Promise.reject(e);
    }

    var cached = getPasscode();

    return (cached ? Promise.resolve(cached) : APP.gate.ask())
      .then(function (pass) { return fn(pass); })
      .catch(function (err) {
        if (!isPasscodeError(err)) throw err;

        // 存着的口令失效了（群主可能换过），清掉重问
        clearPasscode();

        if (attemptsLeft <= 0) {
          var e = new Error('群口令不正确，请向群主确认。');
          e.code = '28000';
          throw e;
        }
        return write(fn, attemptsLeft - 1);
      });
  }

  /* ---------------- 读 ---------------- */

  function list() {
    if (!APP.db.ready()) return Promise.reject(new Error('数据库未就绪'));
    return APP.db.client
      .from('milestones')
      .select('*')
      .order('era', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true })
      .then(function (res) {
        if (res.error) throw res.error;
        return res.data || [];
      });
  }

  /* ---------------- 写 ---------------- */

  function save(data) {
    return write(function (pass) {
      return APP.db.client
        .rpc('upsert_milestone', { p_passcode: pass, p_data: data })
        .then(function (res) {
          if (res.error) throw res.error;
          var row = Array.isArray(res.data) ? res.data[0] : res.data;
          if (!row) throw new Error('保存失败：数据库没有返回结果');
          return row;
        });
    });
  }

  function move(id, era, prevId, nextId) {
    return write(function (pass) {
      return APP.db.client
        .rpc('move_milestone', {
          p_passcode: pass,
          p_id: id,
          p_era: era,
          p_prev: prevId || null,
          p_next: nextId || null,
        })
        .then(function (res) {
          if (res.error) throw res.error;
        });
    });
  }

  function remove(id) {
    return write(function (pass) {
      return APP.db.client
        .rpc('delete_milestone', { p_passcode: pass, p_id: id })
        .then(function (res) {
          if (res.error) throw res.error;
        });
    });
  }

  APP.api = {
    list: list,
    save: save,
    move: move,
    remove: remove,
    getPasscode: getPasscode,
    clearPasscode: clearPasscode,
    isPasscodeError: isPasscodeError,
  };
})();
