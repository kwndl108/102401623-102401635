/* ============================================================
   utils.js · 工具函数（纯逻辑，可单元测试）
   职责：格式化时间、状态文案、ID 生成、校验、复制、图片压缩
   暴露：window.Utils
   ============================================================ */
(function () {
  'use strict';

  var Utils = {
    /* ---------- 状态相关 ---------- */
    // 返回 { type: 'lost'|'found', status: 'open'|'closed' } 对应的展示文案
    statusText: function (item) {
      if (item.status === 'closed') {
        return item.type === 'lost' ? '已找到' : '已归还';
      }
      return item.type === 'lost' ? '寻找中' : '待认领';
    },

    // 状态标签的 css class：open.lost / open.found / closed
    statusClass: function (item) {
      return item.status === 'closed' ? 'closed' : 'open ' + item.type;
    },

    typeText: function (item) {
      return item.type === 'lost' ? '失物' : '招领';
    },

    /* ---------- 时间格式化 ---------- */
    // 输入 "2026/09/25 10:20"（seed 格式）或 Date，输出 "今天 10:20 / 昨天 16:30 / 09-23 09:15"
    formatTime: function (input, now) {
      var base = now || new Date();
      var d;
      if (input instanceof Date) {
        d = input;
      } else if (typeof input === 'number') {
        d = new Date(input);
      } else if (typeof input === 'string') {
        d = new Date(input.replace(/\//g, '-'));
      } else {
        return '';
      }
      if (isNaN(d.getTime())) return String(input || '');

      function pad(n) { return n < 10 ? '0' + n : '' + n; }
      var hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
      var md = pad(d.getMonth() + 1) + '-' + pad(d.getDate());

      var startToday = new Date(base.getFullYear(), base.getMonth(), base.getDate());
      var dayMs = 24 * 3600 * 1000;
      var diff = Math.floor((startToday.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / dayMs);
      if (diff === 0) return '今天 ' + hm;
      if (diff === 1) return '昨天 ' + hm;
      if (diff === 2) return '前天 ' + hm;
      return md + ' ' + hm;
    },

    /* ---------- ID 生成 ---------- */
    generateId: function () {
      return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },

    /* ---------- 关键词规范化 ---------- */
    normalizeKeyword: function (kw) {
      return String(kw || '').trim().toLowerCase();
    },

    /* ---------- 表单校验 ---------- */
    // 返回 { ok:true } 或 { ok:false, errors: { field: '请填写…' } }
    validatePublish: function (form) {
      var errors = {};
      if (!form.name || !String(form.name).trim()) errors.name = '请填写物品名称';
      if (!form.category) errors.category = '请选择物品类别';
      if (!form.place) errors.place = '请选择丢失/拾取地点';
      if (!form.time || !String(form.time).trim()) errors.time = '请填写丢失/拾取时间';
      if (!form.contact || !String(form.contact).trim()) errors.contact = '请填写联系方式';
      if (String(form.contact || '').trim() && String(form.contact).trim().length < 5) {
        errors.contact = '联系方式过短，请填写完整的微信号或手机号';
      }
      if (form.images && form.images.length > 3) errors.images = '最多上传 3 张图片';
      return Object.keys(errors).length ? { ok: false, errors: errors } : { ok: true, errors: {} };
    },

    /* ---------- 搜索过滤（纯函数，核心可测逻辑） ----------
       条件：keyword（匹配名称/描述/地点）、type、category、place、status
       返回新数组（不修改原数组） */
    filterItems: function (items, cond) {
      cond = cond || {};
      var kw = Utils.normalizeKeyword(cond.keyword);
      return items.filter(function (it) {
        if (cond.type && it.type !== cond.type) return false;
        if (cond.category && it.category !== cond.category) return false;
        if (cond.place && it.place !== cond.place) return false;
        if (cond.status) {
          if (cond.status === 'open' && it.status !== 'open') return false;
          if (cond.status === 'closed' && it.status !== 'closed') return false;
        }
        if (kw) {
          var hay = Utils.normalizeKeyword(
            [it.name, it.desc, it.place, it.placeDetail, it.category].join(' ')
          );
          if (hay.indexOf(kw) === -1) return false;
        }
        return true;
      });
    },

    // 按创建时间倒序排序（不改原数组）
    sortByTimeDesc: function (items) {
      return items.slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
    },

    /* ---------- 统计 ---------- */
    stats: function (mineItems) {
      return {
        total: mineItems.length,
        closed: mineItems.filter(function (it) { return it.status === 'closed'; }).length,
        helped: mineItems.reduce(function (sum, it) { return sum + (it.contacts || 0); }, 0)
      };
    },

    /* ---------- 复制联系方式 ---------- */
    copyText: function (text) {
      return new Promise(function (resolve) {
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(function () { resolve(true); }, function () {
            legacyCopy(text, resolve);
          });
        } else {
          legacyCopy(text, resolve);
        }
      });
    },

    /* ---------- 图片压缩（file -> base64，限宽限质，控制在 300KB 内） ---------- */
    fileToCompressedDataUrl: function (file, maxSize) {
      maxSize = maxSize || 300 * 1024;
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
          var img = new Image();
          img.onload = function () {
            var MAX_W = 600;
            var scale = Math.min(1, MAX_W / img.width);
            var canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            var out = canvas.toDataURL('image/jpeg', 0.8);
            if (out.length > maxSize * 1.37) {
              out = canvas.toDataURL('image/jpeg', 0.6);
            }
            resolve(out);
          };
          img.onerror = function () { reject(new Error('图片解析失败')); };
          img.src = reader.result;
        };
        reader.onerror = function () { reject(new Error('文件读取失败')); };
        reader.readAsDataURL(file);
      });
    }
  };

  function legacyCopy(text, done) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      done(ok);
    } catch (e) {
      done(false);
    }
  }

  window.Utils = Utils;
})();
