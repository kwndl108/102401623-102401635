/* ============================================================
   app.js · 视图层与交互
   职责：hash 路由、页面渲染、事件绑定、弹窗/toast
   依赖：Store（store.js）、Utils（utils.js）
   ============================================================ */
(function () {
  'use strict';

  var CATEGORIES = ['证件卡片', '钥匙门禁', '数码电子', '杯具水壶', '书籍文具', '服饰箱包'];
  var PLACES = ['图书馆', '第二食堂', '第一教学楼', '体育馆', '宿舍区', '运动场'];

  /* ---------------- 小工具 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var App = { state: {} };

  /* ---------------- 路由 ---------------- */
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('?');
    var segs = parts[0].split('/').filter(Boolean);
    var query = {};
    if (parts[1]) {
      parts[1].split('&').forEach(function (kv) {
        var i = kv.indexOf('=');
        if (i > -1) query[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
      });
    }
    return { segs: segs, query: query };
  }

  function route() {
    var r = parseHash();
    var page = r.segs[0] || 'home';
    var main = $('#view');
    if (page === 'home') renderHome(main);
    else if (page === 'search') renderSearch(main);
    else if (page === 'detail' && r.segs[1]) renderDetail(main, r.segs[1]);
    else if (page === 'publish') renderPublish(main, r.query.type || 'lost');
    else if (page === 'mine') renderMine(main);
    else { location.hash = '#/home'; return; }
    renderTab(page);
    window.scrollTo(0, 0);
  }

  function renderTab(page) {
    $all('.tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.page === page || (page === 'detail' && t.dataset.page === 'home'));
    });
  }

  /* ---------------- 卡片模板 ---------------- */
  function itemCard(it) {
    var img = it.images && it.images[0]
      ? '<img class="item-thumb" src="' + esc(it.images[0]) + '" alt="">'
      : '<div class="item-thumb ph">📦</div>';
    return '<div class="item-card" data-id="' + esc(it.id) + '">' +
      img +
      '<div class="item-main">' +
      '<div class="item-name">' + esc(it.name) +
      '<span class="chip ' + esc(it.type) + '">' + Utils.typeText(it) + '</span></div>' +
      '<div class="item-meta">' + esc(it.place) + (it.placeDetail ? ' · ' + esc(it.placeDetail) : '') + '</div>' +
      '<div class="item-status">' +
      '<span class="chip ' + Utils.statusClass(it) + '">' + Utils.statusText(it) + '</span> ' +
      '<span>' + Utils.formatTime(it.createdAt) + '</span>' +
      '</div></div></div>';
  }

  function chipHTML(text, value, active, dataKey) {
    return '<div class="option-pill' + (active ? ' active' : '') + '" data-' + dataKey + '="' + esc(value) + '">' + esc(text) + '</div>';
  }

  /* ================= 首页 ================= */
  function renderHome(main) {
    var cond = App.state.homeCond || { type: '' };
    App.state.homeCond = cond;
    var items = Utils.sortByTimeDesc(Utils.filterItems(Store.getAll(), cond));
    var chips = ['', 'lost', 'found'].map(function (t) {
      var label = t === '' ? '全部' : (t === 'lost' ? '寻物' : '招领');
      return '<div class="filter-pill' + (cond.type === t ? ' active' : '') + '" data-type="' + t + '">' + label + '</div>';
    }).join('');

    main.innerHTML =
      '<div class="topbar"><h1>🏫 校园失物招领</h1><div class="sub">让丢的东西更快回家</div></div>' +
      '<div class="search-bar"><input id="homeKw" placeholder="搜索物品名称或地点" value=""><button class="btn btn-primary btn-sm" id="homeSearch">搜索</button></div>' +
      '<div class="filter-row">' + chips + '</div>' +
      '<div class="double-actions">' +
      '<button class="btn btn-orange" data-goto="publish-lost">🙋 我丢东西了</button>' +
      '<button class="btn btn-blue" data-goto="publish-found">🤝 我捡到东西了</button>' +
      '</div>' +
      '<div class="section-title">近期信息</div>' +
      '<div class="item-list">' + (items.length ? items.map(itemCard).join('') : emptyHTML('暂时没有信息', '去发布第一条吧')) + '</div>';

    bindCardClick(main);
    $('#homeSearch', main).addEventListener('click', function () {
      var kw = $('#homeKw', main).value.trim();
      location.hash = '#/search' + (kw ? '?kw=' + encodeURIComponent(kw) : '');
    });
    $('#homeKw', main).addEventListener('keydown', function (e) {
      if (e.key === 'Enter') $('#homeSearch', main).click();
    });
    $all('.filter-pill', main).forEach(function (p) {
      p.addEventListener('click', function () {
        cond.type = p.dataset.type;
        renderHome(main);
      });
    });
    $all('[data-goto]', main).forEach(function (b) {
      b.addEventListener('click', function () { location.hash = '#/publish?type=' + b.dataset.goto.split('-')[1]; });
    });
  }

  /* ================= 搜索页 ================= */
  function renderSearch(main) {
    var r = parseHash();
    var kw = r.query.kw || '';
    var cond = App.state.searchCond || { keyword: kw };
    if (r.query.kw !== undefined) cond.keyword = r.query.kw;
    App.state.searchCond = cond;

    if (kw) Store.pushRecent(kw);

    var results = Utils.filterItems(Store.getAll(), cond);
    var recent = Store.getRecent();

    var catPills = ['', '证件卡片', '钥匙门禁', '数码电子', '杯具水壶', '书籍文具', '服饰箱包']
      .map(function (c) { return chipHTML(c || '全部分类', c, cond.category === c, 'category'); }).join('');
    var placePills = ['', '图书馆', '第二食堂', '第一教学楼', '体育馆', '宿舍区', '运动场']
      .map(function (p) { return chipHTML(p || '全部地点', p, cond.place === p, 'place'); }).join('');
    var statusPills = ['', 'open', 'closed'].map(function (s) {
      var label = s === '' ? '全部状态' : (s === 'open' ? '进行中' : '已结束');
      return chipHTML(label, s, cond.status === s, 'status');
    }).join('');

    main.innerHTML =
      '<div class="topbar"><h1>🔍 搜索</h1></div>' +
      '<div class="search-bar"><input id="searchKw" placeholder="输入物品名称或地点" value="' + esc(cond.keyword) + '"><button class="btn btn-primary btn-sm" id="searchGo">搜索</button></div>' +
      '<div class="filter-row"><span class="chip lost">类别</span>' + catPills + '</div>' +
      '<div class="filter-row"><span class="chip found">地点</span>' + placePills + '</div>' +
      '<div class="filter-row"><span class="chip closed">状态</span>' + statusPills + '</div>' +
      (results.length ? '<div class="section-title">共 ' + results.length + ' 条结果</div>' : '') +
      '<div class="item-list">' +
      (results.length ? results.map(itemCard).join('') : searchEmptyHTML(cond)) +
      '</div>' +
      (recent.length && !cond.keyword ? recentHTML(recent) : '');

    bindCardClick(main);
    var go = function () {
      var kwv = $('#searchKw', main).value.trim();
      cond.keyword = kwv;
      location.hash = '#/search' + (kwv ? '?kw=' + encodeURIComponent(kwv) : '');
    };
    $('#searchGo', main).addEventListener('click', go);
    $('#searchKw', main).addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    $all('.option-pill', main).forEach(function (p) {
      p.addEventListener('click', function () {
        var key = p.dataset.category !== undefined ? 'category' : (p.dataset.place !== undefined ? 'place' : 'status');
        cond[key] = p.dataset[key];
        renderSearch(main);
      });
    });
    $all('[data-recent]', main).forEach(function (p) {
      p.addEventListener('click', function () {
        cond.keyword = p.dataset.recent;
        location.hash = '#/search?kw=' + encodeURIComponent(p.dataset.recent);
      });
    });
  }

  function recentHTML(recent) {
    return '<div class="section-title">最近搜索</div><div class="filter-row">' +
      recent.map(function (k) {
        return '<div class="filter-pill" data-recent="' + esc(k) + '">' + esc(k) + '</div>';
      }).join('') + '</div>';
  }

  function searchEmptyHTML(cond) {
    return '<div class="empty"><div class="big">🔍</div><p>暂时没有找到相关物品</p>' +
      '<p class="sub">试试更换关键词，或调整筛选条件</p></div>';
  }

  function emptyHTML(title, sub) {
    return '<div class="empty"><div class="big">📦</div><p>' + esc(title) + '</p><p class="sub">' + esc(sub) + '</p></div>';
  }

  /* ================= 详情页 ================= */
  function renderDetail(main, id) {
    Store.bumpView(id);
    var it = Store.getById(id);
    if (!it) { location.hash = '#/home'; return; }
    var isMine = Store.isMine(id);
    var img = it.images && it.images[0]
      ? '<img class="detail-img" src="' + esc(it.images[0]) + '" alt="">'
      : '<div class="detail-img" style="display:flex;align-items:center;justify-content:center;font-size:56px;">📦</div>';

    main.innerHTML =
      '<div class="topbar"><div style="display:flex;align-items:center;gap:10px;">' +
      '<span id="backBtn" style="font-size:22px;cursor:pointer;">‹</span><h1>信息详情</h1></div></div>' +
      '<div class="card" style="padding:0;overflow:hidden;">' + img +
      '<div style="padding:14px;">' +
      '<div class="detail-tags">' +
      '<span class="chip ' + esc(it.type) + '">' + Utils.typeText(it) + '</span>' +
      '<span class="chip ' + Utils.statusClass(it) + '">' + Utils.statusText(it) + '</span>' +
      '<span class="chip ' + esc(it.category) + '" style="background:#F4F5F7;color:#6B7280;">' + esc(it.category) + '</span>' +
      '<span class="detail-view">' + (it.views || 0) + ' 次浏览</span></div>' +
      '<h2 style="font-size:18px;margin:10px 0 4px;">' + esc(it.name) + '</h2>' +
      '<div style="font-size:12px;color:#8A919F;">发布者：' + esc(it.publisher) + (isMine ? '（我）' : '') + '</div></div></div>' +

      '<div class="card">' +
      '<div class="info-row"><span class="k">' + (it.type === 'lost' ? '丢失地点' : '拾取地点') + '</span><span class="v">' + esc(it.place) + (it.placeDetail ? ' · ' + esc(it.placeDetail) : '') + '</span></div>' +
      '<div class="info-row"><span class="k">' + (it.type === 'lost' ? '丢失时间' : '拾取时间') + '</span><span class="v">' + esc(it.time) + '</span></div>' +
      '<div class="info-row"><span class="k">联系方式</span><span class="v" id="contactCell">点击下方按钮后可见</span></div>' +
      '</div>' +

      (it.desc ? '<div class="card"><div class="section-title" style="margin:0 0 8px;">物品描述</div><p style="font-size:14px;">' + esc(it.desc) + '</p></div>' : '') +

      '<div class="card"><div style="display:flex;gap:10px;">' +
      '<button class="btn btn-ghost" id="showContact" style="flex:1;">📞 联系发布者</button>' +
      (isMine ? '<button class="btn btn-primary" id="toggleStatus" style="flex:1;">' + (it.status === 'open' ? '✅ 标记' + (it.type === 'lost' ? '已找到' : '已归还') : '↩ 重新开放') + '</button>' : '') +
      '</div></div>';

    $('#backBtn', main).addEventListener('click', function () { history.back(); });

    $('#showContact', main).addEventListener('click', function () {
      var cell = $('#contactCell', main);
      if (cell.dataset.shown) { toast('联系方式已显示在下方'); return; }
      Store.bumpContact(id);
      cell.dataset.shown = '1';
      cell.innerHTML = '<div class="contact-box">' +
        '<div class="line"><span>微信 / 手机</span><span style="font-weight:700;">' + esc(it.contact) + '</span></div>' +
        '<div class="line"><button class="btn btn-primary btn-sm" id="copyContact">📋 一键复制</button></div>' +
        '<div style="font-size:11px;color:#8A919F;margin-top:6px;">请核对物品特征后联系，勿向陌生人转账</div></div>';
      $('#copyContact', main).addEventListener('click', function () {
        Utils.copyText(it.contact).then(function (ok) {
          toast(ok ? '已复制联系方式' : '复制失败，请手动长按复制');
        });
      });
    });

    if ($('#toggleStatus', main)) {
      $('#toggleStatus', main).addEventListener('click', function () {
        var next = it.status === 'open' ? 'closed' : 'open';
        Store.update(id, { status: next });
        toast(next === 'closed' ? '已标记为' + (it.type === 'lost' ? '已找到' : '已归还') : '已重新开放');
        renderDetail(main, id);
      });
    }
  }

  /* ================= 发布页 ================= */
  function renderPublish(main, defType) {
    var type = defType === 'found' ? 'found' : 'lost';
    App.publishState = { type: type, images: [], category: '证件卡片', place: '图书馆', errors: {} };

    main.innerHTML =
      '<div class="topbar"><div style="display:flex;align-items:center;gap:10px;">' +
      '<span id="backBtn" style="font-size:22px;cursor:pointer;">‹</span><h1>发布信息</h1>' +
      '<span style="margin-left:auto;font-size:12px;opacity:.85;">带 * 为必填</span></div></div>' +

      '<div class="double-actions">' +
      '<button class="btn ' + (type === 'lost' ? 'btn-orange' : 'btn-ghost') + '" id="typeLost">🙋 发布寻物</button>' +
      '<button class="btn ' + (type === 'found' ? 'btn-blue' : 'btn-ghost') + '" id="typeFound">🤝 发布招领</button>' +
      '</div>' +

      '<div class="card">' +
      '<div class="form-group"><label class="form-label">物品名称<span class="req">*</span></label>' +
      '<input class="form-input" id="fName" placeholder="如：校园卡 / 钥匙 / 蓝色保温杯"><div class="error-msg" id="eName"></div></div>' +

      '<div class="form-group"><label class="form-label">物品类别<span class="req">*</span></label>' +
      '<div class="option-pills" id="catPills">' + CATEGORIES.map(function (c, i) {
        return chipHTML(c, c, i === 0, 'category');
      }).join('') + '</div><div class="error-msg" id="eCategory"></div></div>' +

      '<div class="form-group"><label class="form-label">' + (type === 'lost' ? '丢失地点' : '拾取地点') + '<span class="req">*</span></label>' +
      '<div class="option-pills" id="placePills">' + PLACES.map(function (p, i) {
        return chipHTML(p, p, i === 0, 'place');
      }).join('') + '</div>' +
      '<input class="form-input" id="fPlace" style="margin-top:8px;" placeholder="补充具体位置，如：二楼自习区 A-12"><div class="error-msg" id="ePlace"></div></div>' +

      '<div class="form-group"><label class="form-label">' + (type === 'lost' ? '丢失时间' : '拾取时间') + '<span class="req">*</span></label>' +
      '<input class="form-input" id="fTime" type="datetime-local" value=""><div class="form-hint">不确定具体时间可填大致时段</div><div class="error-msg" id="eTime"></div></div>' +

      '<div class="form-group"><label class="form-label">物品描述（选填）</label>' +
      '<textarea class="form-textarea" id="fDesc" placeholder="建议 20-100 字，描述越细致越容易被认出"></textarea></div>' +

      '<div class="form-group"><label class="form-label">物品图片（选填·最多 3 张）</label>' +
      '<div class="img-uploader" id="imgUploader">' +
      '<div class="img-add" id="imgAdd">＋</div></div>' +
      '<input type="file" id="imgFile" accept="image/*" multiple style="display:none;">' +
      '<div class="error-msg" id="eImages"></div></div>' +

      '<div class="form-group"><label class="form-label">联系方式<span class="req">*</span></label>' +
      '<input class="form-input" id="fContact" placeholder="微信号或手机号，仅联系时可见"><div class="form-hint">仅联系时可见</div><div class="error-msg" id="eContact"></div></div>' +

      '<div style="display:flex;gap:10px;">' +
      '<button class="btn btn-ghost" id="btnReset" style="flex:1;">清空重填</button>' +
      '<button class="btn btn-primary" id="btnPublish" style="flex:1;">立即发布</button></div></div>';

    $('#backBtn', main).addEventListener('click', function () { history.back(); });

    var st = App.publishState;
    $('#typeLost', main).addEventListener('click', function () { location.hash = '#/publish?type=lost'; });
    $('#typeFound', main).addEventListener('click', function () { location.hash = '#/publish?type=found'; });

    $all('#catPills .option-pill', main).forEach(function (p) {
      p.addEventListener('click', function () {
        st.category = p.dataset.category;
        $all('#catPills .option-pill', main).forEach(function (x) { x.classList.toggle('active', x === p); });
      });
    });
    $all('#placePills .option-pill', main).forEach(function (p) {
      p.addEventListener('click', function () {
        st.place = p.dataset.place;
        $all('#placePills .option-pill', main).forEach(function (x) { x.classList.toggle('active', x === p); });
      });
    });

    // 图片上传
    $('#imgAdd', main).addEventListener('click', function () { $('#imgFile', main).click(); });
    $('#imgFile', main).addEventListener('change', function () {
      var files = Array.prototype.slice.call(this.files);
      var remain = 3 - st.images.length;
      files.slice(0, remain).forEach(function (f) {
        Utils.fileToCompressedDataUrl(f).then(function (dataUrl) {
          st.images.push(dataUrl);
          renderUploader(main);
        }, function () { toast('图片解析失败'); });
      });
      this.value = '';
    });

    // 重置
    $('#btnReset', main).addEventListener('click', function () { location.hash = '#/publish?type=' + st.type; });

    // 发布
    $('#btnPublish', main).addEventListener('click', function () {
      var form = {
        name: $('#fName', main).value.trim(),
        category: st.category,
        place: st.place,
        placeDetail: $('#fPlace', main).value.trim(),
        time: $('#fTime', main).value || '',
        desc: $('#fDesc', main).value.trim(),
        images: st.images,
        contact: $('#fContact', main).value.trim(),
        type: st.type
      };
      var res = Utils.validatePublish(form);
      if (!res.ok) {
        showErrors(main, res.errors);
        toast('请补全必填项');
        return;
      }
      hideErrors(main);
      var item = {
        id: Utils.generateId(), type: st.type, name: form.name, category: form.category,
        place: form.place, placeDetail: form.placeDetail,
        time: form.time, desc: form.desc, images: st.images, contact: form.contact,
        publisher: '我', status: 'open', isMine: true, views: 0, contacts: 0,
        createdAt: Date.now()
      };
      Store.add(item);
      showModal('<h3>🎉 发布成功！</h3><p>你的信息已发布，同校同学可以在首页和搜索中看到。</p>',
        [{ text: '查看我的发布', cls: 'btn-primary', act: function () { location.hash = '#/mine'; } },
         { text: '返回首页', cls: 'btn-ghost', act: function () { location.hash = '#/home'; } }]);
    });
  }

  function renderUploader(main) {
    var box = $('#imgUploader', main);
    if (!box) return;
    var st = App.publishState;
    var html = st.images.map(function (url, i) {
      return '<div class="img-box"><img src="' + url + '" alt=""><span class="del" data-i="' + i + '">✕</span></div>';
    }).join('');
    if (st.images.length < 3) html += '<div class="img-add" id="imgAdd">＋</div>';
    box.innerHTML = html;
    var add = $('#imgAdd', main);
    if (add) add.addEventListener('click', function () { $('#imgFile', main).click(); });
    $all('.del', main).forEach(function (d) {
      d.addEventListener('click', function () {
        st.images.splice(Number(d.dataset.i), 1);
        renderUploader(main);
      });
    });
  }

  function showErrors(main, errors) {
    ['name', 'category', 'place', 'time', 'contact'].forEach(function (f) {
      var el = $('#e' + f.charAt(0).toUpperCase() + f.slice(1), main);
      var inp = $('#f' + f.charAt(0).toUpperCase() + f.slice(1), main);
      if (el) el.textContent = errors[f] || '';
      el && el.classList.toggle('show', !!errors[f]);
      inp && inp.classList.toggle('error', !!errors[f]);
    });
  }

  function hideErrors(main) {
    $all('.error-msg', main).forEach(function (el) { el.classList.remove('show'); });
    $all('.form-input', main).forEach(function (el) { el.classList.remove('error'); });
  }

  /* ================= 我的发布 ================= */
  function renderMine(main) {
    var mine = Utils.sortByTimeDesc(Store.getMine());
    var st = Utils.stats(mine);

    main.innerHTML =
      '<div class="topbar"><h1>👤 我的</h1></div>' +
      '<div class="card profile-card"><div class="avatar">我</div><div>' +
      '<div style="font-weight:700;">我的发布' + '<span class="badge-verify">已实名</span></div>' +
      '<div style="font-size:12px;color:#8A919F;">计算机学院 2024 级 · 本地演示账号</div></div>' +
      '<button class="btn btn-sm btn-ghost" id="btnResetData" style="margin-left:auto;">重置数据</button></div>' +

      '<div class="card"><div class="stats-row">' +
      '<div class="stat"><div class="num">' + st.total + '</div><div class="lbl">我的发布</div></div>' +
      '<div class="stat"><div class="num">' + st.closed + '</div><div class="lbl">成功找回/归还</div></div>' +
      '<div class="stat"><div class="num">' + st.helped + '</div><div class="lbl">帮助他人</div></div>' +
      '</div></div>' +

      '<div class="section-title">我的发布列表</div>' +
      '<div class="item-list">' +
      (mine.length ? mine.map(function (it) {
        return '<div class="item-card" data-id="' + esc(it.id) + '" style="flex-wrap:wrap;">' +
          (it.images && it.images[0] ? '<img class="item-thumb" src="' + esc(it.images[0]) + '" alt="">' : '<div class="item-thumb ph">📦</div>') +
          '<div class="item-main"><div class="item-name">' + esc(it.name) +
          '<span class="chip ' + esc(it.type) + '">' + Utils.typeText(it) + '</span>' +
          '<span class="chip ' + Utils.statusClass(it) + '">' + Utils.statusText(it) + '</span></div>' +
          '<div class="item-meta">' + esc(it.place) + ' · ' + Utils.formatTime(it.createdAt) + '</div>' +
          '<div class="item-status">' + (it.views || 0) + ' 次浏览 · ' + (it.contacts || 0) + ' 人联系</div></div>' +
          '<div class="my-ops" style="width:100%;">' +
          '<button class="btn btn-sm btn-ghost" data-op="edit" data-id="' + esc(it.id) + '">编辑</button>' +
          '<button class="btn btn-sm ' + (it.status === 'open' ? 'btn-primary' : 'btn-ghost') + '" data-op="toggle" data-id="' + esc(it.id) + '">' +
          (it.status === 'open' ? '标记' + (it.type === 'lost' ? '已找到' : '已归还') : '重新开放') + '</button>' +
          '<button class="btn btn-sm btn-ghost" data-op="del" data-id="' + esc(it.id) + '">删除</button>' +
          '</div></div>';
      }).join('') : '<div class="card empty" style="box-shadow:none;"><p>你还没有发布过信息</p><p class="sub">去发布第一条吧</p></div>') +
      '</div>';

    $('#btnResetData', main).addEventListener('click', function () {
      showModal('<h3>重置为示例数据？</h3><p>将清空你发布的内容，恢复 6 条初始示例。</p>',
        [{ text: '取消', cls: 'btn-ghost' },
         { text: '确认重置', cls: 'btn-primary', act: function () { Store.reset(); renderMine(main); toast('已重置'); } }]);
    });

    $all('[data-op]', main).forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var op = b.dataset.op, id = b.dataset.id;
        if (op === 'toggle') confirmToggle(id, main);
        else if (op === 'del') confirmDel(id, main);
        else if (op === 'edit') openEdit(id, main);
      });
    });
    bindCardClick(main);
  }

  function confirmToggle(id, main) {
    var it = Store.getById(id);
    if (!it) return;
    showModal('<h3>标记为' + (it.type === 'lost' ? '已找到？' : '已归还？') + '</h3>' +
      '<p>确认后这条信息将不再对外展示为「进行中」，可在「我的发布」中重新开放。</p>',
      [{ text: '暂不修改', cls: 'btn-ghost' },
       { text: '确认标记', cls: 'btn-primary', act: function () {
          Store.update(id, { status: 'closed' });
          toast('已标记为' + (it.type === 'lost' ? '已找到' : '已归还'));
          renderMine(main);
        } }]);
  }

  function confirmDel(id, main) {
    showModal('<h3>删除这条信息？</h3><p>删除后不可恢复。</p>',
      [{ text: '取消', cls: 'btn-ghost' },
       { text: '删除', cls: 'btn-primary', act: function () { Store.remove(id); toast('已删除'); renderMine(main); } }]);
  }

  function openEdit(id, main) {
    var it = Store.getById(id);
    if (!it) return;
    showModal(
      '<h3>编辑信息</h3>' +
      '<div style="text-align:left;">' +
      '<div class="form-group"><label class="form-label">物品名称</label><input class="form-input" id="edName" value="' + esc(it.name) + '"></div>' +
      '<div class="form-group"><label class="form-label">' + (it.type === 'lost' ? '丢失' : '拾取') + '地点</label><input class="form-input" id="edPlace" value="' + esc(it.place + (it.placeDetail ? ' ' + it.placeDetail : '')) + '"></div>' +
      '<div class="form-group"><label class="form-label">物品描述</label><textarea class="form-textarea" id="edDesc">' + esc(it.desc || '') + '</textarea></div>' +
      '<div class="form-group"><label class="form-label">联系方式<span class="req">*</span></label><input class="form-input" id="edContact" value="' + esc(it.contact || '') + '"></div>' +
      '</div>' +
      '<div class="btn-row"><button class="btn btn-ghost" id="edCancel">取消</button><button class="btn btn-primary" id="edSave">保存修改</button></div>',
      [], true);
    $('#edCancel', document).addEventListener('click', closeModal);
    $('#edSave', document).addEventListener('click', function () {
      var name = $('#edName', document).value.trim();
      var contact = $('#edContact', document).value.trim();
      if (!name || !contact) { toast('名称和联系方式不能为空'); return; }
      Store.update(id, { name: name, desc: $('#edDesc', document).value.trim(), contact: contact });
      closeModal();
      toast('修改已保存');
      renderMine(main);
    });
  }

  /* ================= 弹窗 / toast ================= */
  var modalRoot = null;
  function showModal(html, btns, noBtns) {
    if (!modalRoot) {
      modalRoot = document.createElement('div');
      modalRoot.className = 'modal-mask';
      modalRoot.addEventListener('click', function (e) { if (e.target === modalRoot) closeModal(); });
      document.body.appendChild(modalRoot);
    }
    var btnHTML = noBtns ? '' : '<div class="btn-row">' + (btns || []).map(function (b) {
      return '<button class="btn ' + b.cls + '" data-mb="' + esc(b.text) + '">' + b.text + '</button>';
    }).join('') + '</div>';
    modalRoot.innerHTML = '<div class="modal">' + html + btnHTML + '</div>';
    modalRoot.classList.add('show');
    if (!noBtns) {
      $all('[data-mb]', modalRoot).forEach(function (b, i) {
        b.addEventListener('click', function () {
          closeModal();
          var fn = (btns || [])[i] && (btns || [])[i].act;
          if (fn) fn();
        });
      });
    }
  }

  function closeModal() {
    if (modalRoot) modalRoot.classList.remove('show');
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1800);
  }

  /* ---------------- 卡片点击（列表 → 详情） ---------------- */
  function bindCardClick(root) {
    $all('.item-card', root).forEach(function (card) {
      card.addEventListener('click', function () {
        location.hash = '#/detail/' + encodeURIComponent(card.dataset.id);
      });
    });
  }

  /* ---------------- 底部导航 ---------------- */
  function buildTabbar() {
    var bar = document.createElement('div');
    bar.className = 'tabbar';
    bar.innerHTML =
      '<div class="tab" data-page="home"><span class="ico">🏠</span>首页</div>' +
      '<div class="tab" data-page="search"><span class="ico">🔍</span>搜索</div>' +
      '<div class="tab" data-page="publish"><span class="ico">➕</span>发布</div>' +
      '<div class="tab" data-page="mine"><span class="ico">👤</span>我的</div>';
    $all('.tab', bar).forEach(function (t) {
      t.addEventListener('click', function () { location.hash = '#/' + t.dataset.page; });
    });
    document.body.appendChild(bar);
  }

  /* ---------------- 启动 ---------------- */
  window.App = App;
  document.addEventListener('DOMContentLoaded', function () {
    Store.init();
    buildTabbar();
    window.addEventListener('hashchange', route);
    route();
  });
})();
