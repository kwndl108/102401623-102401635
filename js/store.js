/* ============================================================
   store.js · 数据层
   职责：种子数据、localStorage 读写、物品 CRUD、状态切换
   暴露：window.Store
   ============================================================ */
(function () {
  'use strict';

  var KEY_ITEMS = 'clf_items_v1';
  var KEY_MINE = 'clf_mine_v1';     // 我发布的 id 列表
  var KEY_RECENT = 'clf_recent_v1'; // 最近搜索词

  /* 种子数据：对应第一次作业原型的 6 条示例信息 */
  var SEED = [
    {
      id: 'seed1', type: 'lost', name: '校园卡（姓名首字"林"）', category: '证件卡片',
      place: '图书馆', placeDetail: '二楼自习区 A-12 座位附近', time: '2026/09/25 10:20',
      desc: '深蓝色校园卡，卡套上贴有姓名首字"林"的贴纸。丢失时放在自习桌上，离开一小会儿就不见了。',
      images: ['images/01-校园卡.png'], contact: 'lin_2024_card', publisher: '林同学',
      status: 'open', isMine: true, views: 36, contacts: 0,
      createdAt: 1758700000000 + 0
    },
    {
      id: 'seed2', type: 'found', name: '一串钥匙（带小熊挂件）', category: '钥匙门禁',
      place: '第一教学楼', placeDetail: '302 教室第一排课桌', time: '2026/09/26 08:05',
      desc: '一串钥匙，挂着一个棕色小熊挂件，还有一张门禁卡。捡到时放在讲台上。',
      images: ['images/02-钥匙串.png'], contact: 'wxy_2024_key', publisher: '王同学',
      status: 'open', isMine: false, views: 12, contacts: 1,
      createdAt: 1758700000000 - 2 * 3600000
    },
    {
      id: 'seed3', type: 'lost', name: '白色无线耳机（右耳）', category: '数码电子',
      place: '运动场', placeDetail: '看台区第三排', time: '2026/09/24 16:30',
      desc: '白色 AirPods 风格无线耳机，只有右耳丢失，左耳和充电仓还在。',
      images: ['images/03-无线耳机.png'], contact: 'chen_earphone', publisher: '陈同学',
      status: 'open', isMine: false, views: 8, contacts: 0,
      createdAt: 1758700000000 - 20 * 3600000
    },
    {
      id: 'seed4', type: 'found', name: '蓝色保温杯（贴纸款）', category: '杯具水壶',
      place: '第二食堂', placeDetail: '一楼靠窗座位', time: '2026/09/24 12:40',
      desc: '蓝色保温杯，杯身贴了几张卡通贴纸，杯盖有轻微划痕。',
      images: ['images/04-保温杯.png'], contact: 'zhao_cup', publisher: '赵同学',
      status: 'open', isMine: false, views: 15, contacts: 0,
      createdAt: 1758700000000 - 26 * 3600000
    },
    {
      id: 'seed5', type: 'lost', name: '黑色折叠雨伞', category: '服饰箱包',
      place: '图书馆', placeDetail: '正门雨伞架', time: '2026/09/23 14:10',
      desc: '黑色自动折叠伞，伞柄处有一个小的磨损痕迹，伞套是深灰色的。',
      images: ['images/05-折叠雨伞.png'], contact: 'sun_umbrella', publisher: '孙同学',
      status: 'open', isMine: true, views: 5, contacts: 0,
      createdAt: 1758700000000 - 48 * 3600000
    },
    {
      id: 'seed6', type: 'found', name: '高数课本（封面贴姓名贴）', category: '书籍文具',
      place: '第一教学楼', placeDetail: '302 教室后排', time: '2026/09/23 09:15',
      desc: '《高等数学（上）》课本，封面贴了姓名贴，内有少量笔记，请失主描述特征认领。',
      images: ['images/06-高数课本.png'], contact: 'li_math', publisher: '李同学',
      status: 'open', isMine: false, views: 9, contacts: 0,
      createdAt: 1758700000000 - 52 * 3600000
    }
  ];

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 容量满时静默 */ }
  }

  function ensureSeed() {
    if (read(KEY_ITEMS, null) === null) {
      write(KEY_ITEMS, SEED);
      var mine = SEED.filter(function (it) { return it.isMine; }).map(function (it) { return it.id; });
      write(KEY_MINE, mine);
    }
  }

  var Store = {
    /* ---------- 初始化 ---------- */
    init: function () { ensureSeed(); },

    /* ---------- 物品读取 ---------- */
    getAll: function () { return read(KEY_ITEMS, []); },
    getById: function (id) {
      var list = Store.getAll();
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) return list[i];
      }
      return null;
    },

    /* ---------- 发布 / 更新 / 删除 ---------- */
    add: function (item) {
      var list = Store.getAll();
      list.unshift(item);
      write(KEY_ITEMS, list);
      var mine = read(KEY_MINE, []);
      mine.push(item.id);
      write(KEY_MINE, mine);
      return item;
    },

    update: function (id, patch) {
      var list = Store.getAll();
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === id) {
          for (var k in patch) {
            if (Object.prototype.hasOwnProperty.call(patch, k)) list[i][k] = patch[k];
          }
          break;
        }
      }
      write(KEY_ITEMS, list);
    },

    remove: function (id) {
      var list = Store.getAll().filter(function (it) { return it.id !== id; });
      write(KEY_ITEMS, list);
      var mine = read(KEY_MINE, []).filter(function (x) { return x !== id; });
      write(KEY_MINE, mine);
    },

    /* ---------- 我的发布 ---------- */
    getMine: function () {
      var mineIds = read(KEY_MINE, []);
      return Store.getAll().filter(function (it) { return mineIds.indexOf(it.id) !== -1; });
    },
    isMine: function (id) {
      return read(KEY_MINE, []).indexOf(id) !== -1;
    },

    /* ---------- 计数 ---------- */
    bumpView: function (id) {
      var it = Store.getById(id);
      if (it) Store.update(id, { views: (it.views || 0) + 1 });
    },
    bumpContact: function (id) {
      var it = Store.getById(id);
      if (it) Store.update(id, { contacts: (it.contacts || 0) + 1 });
    },

    /* ---------- 最近搜索 ---------- */
    getRecent: function () { return read(KEY_RECENT, []); },
    pushRecent: function (kw) {
      var list = Store.getRecent().filter(function (x) { return x !== kw; });
      list.unshift(kw);
      write(KEY_RECENT, list.slice(0, 5));
    },

    /* ---------- 重置为种子数据（演示用） ---------- */
    reset: function () {
      localStorage.removeItem(KEY_ITEMS);
      localStorage.removeItem(KEY_MINE);
      ensureSeed();
    }
  };

  window.Store = Store;
})();
