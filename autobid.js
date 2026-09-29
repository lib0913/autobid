/**
 * 검색광고 자동입찰 — 관리자 화면 v2 (admin_extend 메뉴용)
 * 화면은 GitHub Pages, 데이터는 퍼스트몰 중계(/cus_autobid_api, 토큰은 서버에만) → 구글 Apps Script 웹 앱. 사람별 접속 키로 확인합니다.
 * 화면: 홈 / 키워드 / 확인 필요 / 그룹 설정 / 실행 기록  (키워드를 누르면 오른쪽에 상세 창)
 */
(function () {
  'use strict';
  var API = window.AUTOBID_API || '';
  var root = document.getElementById('autobid-app');
  if (!root) return;

  /* ───────── 도우미 ───────── */
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v) { return v === '' || v == null || isNaN(Number(v)) ? null : Number(v); }
  function won(v) { var n = num(v); return n == null ? '-' : Math.round(n).toLocaleString('ko-KR') + '원'; }
  function cnt(v) { var n = num(v); return n == null ? '-' : Math.round(n).toLocaleString('ko-KR'); }
  function rank(v) { var n = num(v); return n == null ? '-' : n + '위'; }
  /** 시트가 "75.6%"를 0.756 숫자로 바꿔 두는 경우가 있어 다시 %로 */
  function pct(v) { var n = num(v); return (n != null && n <= 1.5 && String(v).indexOf('%') < 0) ? (Math.round(n * 1000) / 10) + '%' : String(v == null ? '' : v); }
  function short(n) { n = Math.round(n || 0); if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '억'; if (n >= 10000) return (n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '') + '만'; return n.toLocaleString('ko-KR'); }
  function chg(a, b, label) {
    if (!b) return '<span class="chip gray">' + esc(label ? label + ' 자료 없음' : '비교 자료 없음') + '</span>';
    var p = Math.round((a - b) / b * 100);
    return '<span class="chip ' + (p > 0 ? 'up' : p < 0 ? 'down' : 'gray') + '">' + (label ? esc(label) + ' ' : '') + (p > 0 ? '▲' : p < 0 ? '▼' : '') + Math.abs(p) + '%</span>';
  }
  function badge(manage) {
    var m = { '실시간': 'blue', '정기': 'gray', '고정': 'orange', '제외': 'red' }[manage] || 'gray';
    var t = { '실시간': '실시간', '정기': '정기', '고정': '고정 금액', '제외': '건드리지 않음' }[manage] || (manage || '-');
    return '<span class="chip ' + m + '">' + esc(t) + '</span>';
  }
  var DOW = ['일', '월', '화', '수', '목', '금', '토'];
  function dayLabel(ymd) { var d = new Date(ymd + 'T12:00:00'); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일(' + DOW[d.getDay()] + ')'; }
  function todayYmd() { var t = new Date(); return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2); }
  function note(kind, text) { return '<div class="note ' + kind + '">' + esc(text) + '</div>'; }
  function sk(h, w) { return '<div class="sk" style="height:' + h + 'px;width:' + (w || '100%') + '"></div>'; }
  function skCard(lines) { var s = '<div class="card">' + sk(18, '30%') + '<div style="height:14px"></div>'; for (var i = 0; i < (lines || 3); i++) s += sk(14, (90 - i * 12) + '%') + '<div style="height:10px"></div>'; return s + '</div>'; }
  function remember(k, v) { try { if (v === undefined) return sessionStorage.getItem('ab-' + k); sessionStorage.setItem('ab-' + k, v); } catch (e) { return null; } }

  /* 입장 코드: 구글 쪽이 확인(설정 탭 "관리 화면 입장 코드"). 브라우저 탭을 닫으면 다시 입력 */
  function pinGet() { try { return sessionStorage.getItem('ab-pin') || ''; } catch (e) { return ''; } }
  function pinSet(v) { try { if (v) sessionStorage.setItem('ab-pin', v); else sessionStorage.removeItem('ab-pin'); } catch (e) {} }
  function keyGet() { try { return sessionStorage.getItem('ab-key') || ''; } catch (e) { return ''; } }
  function keySet(v) { try { if (v) sessionStorage.setItem('ab-key', v); else sessionStorage.removeItem('ab-key'); } catch (e) {} }
  var pinOpen = false;
  function showPin(message, isKey) {
    if (pinOpen) { var m = document.getElementById('ab-pin-msg'); if (m) m.textContent = message || ''; return; }
    pinOpen = true;
    var w = document.createElement('div');
    w.className = 'pin-ov';
    w.innerHTML = (isKey ? '<div class="pin-card"><div class="pin-ic">🔑</div><h2>접속 키</h2><p class="sub">담당자에게 받은 본인 접속 키를 입력하세요</p>' +
      '<input id="ab-pin" type="password" autocomplete="off" maxlength="100" placeholder="접속 키">'
      : '<div class="pin-card"><div class="pin-ic">🔒</div><h2>입장 코드</h2><p class="sub">관리 화면을 보려면 코드를 입력하세요</p>' +
      '<input id="ab-pin" type="password" inputmode="numeric" autocomplete="off" maxlength="12" placeholder="••••">') +
      '<div class="pin-msg" id="ab-pin-msg">' + esc(message && !/넣어 주세요/.test(message) ? message : '') + '</div><button class="btn pri wide" id="ab-pin-ok">들어가기</button></div>';
    root.appendChild(w);
    var inp = document.getElementById('ab-pin');
    function go() { var v = inp.value.trim(); if (!v) return; if (isKey) keySet(v); else pinSet(v); pinOpen = false; w.remove(); show(state.tab); }
    document.getElementById('ab-pin-ok').onclick = go;
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    setTimeout(function () { inp.focus(); }, 50);
  }

  function get(action, params) {
    var q = ['action=' + encodeURIComponent(action)];
    if (pinGet()) q.push('pin=' + encodeURIComponent(pinGet()));
    Object.keys(params || {}).forEach(function (k) { q.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k])); });
    if (!keyGet()) return needKey('');
    return fetch(API + '?' + q.join('&'), { credentials: 'omit', headers: { 'X-Autobid-Key': keyGet() } }).then(parse);
  }
  function post(action, body) {
    if (!keyGet()) return needKey('');
    return fetch(API + '?action=' + encodeURIComponent(action), {
      method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json', 'X-Autobid-Key': keyGet() }, body: JSON.stringify(Object.assign({}, body || {}, pinGet() ? { pin: pinGet() } : {}))
    }).then(parse);
  }
  function needKey(msg) { showPin(msg, true); var e = new Error(msg || '접속 키가 필요합니다'); e.pin = true; return Promise.reject(e); }
  function parse(r) {
    return r.json().catch(function () { throw new Error('서버 응답을 읽지 못했습니다 (' + r.status + ')'); })
      .then(function (j) {
        if (j.needKey) { keySet(''); showPin(j.error, true); var ek = new Error(j.error || '접속 키가 필요합니다'); ek.pin = true; throw ek; }
        if (j.needPin) { pinSet(''); showPin(j.error); var e = new Error(j.error || '입장 코드가 필요합니다'); e.pin = true; throw e; }
        if (!j.ok) throw new Error(j.error || '알 수 없는 오류'); return j;
      });
  }

  /* ───────── 뼈대 ───────── */
  var TABS = [['home', '홈'], ['perf', '성과'], ['search', '키워드'], ['attention', '확인 필요'], ['groups', '그룹 설정'], ['runs', '실행 기록']];
  var state = { tab: 'home', mode: '' };
  root.innerHTML =
    '<div class="hd"><div class="hd-in"><h1>검색광고 자동입찰</h1><span id="ab-mode"></span><span class="sp"></span>' +
    '<span class="sub">바꾼 설정은 다음 실행부터 반영 · 시험/실제 모드 전환은 시트에서만</span></div>' +
    '<div class="tabs"><div class="seg" role="tablist">' + TABS.map(function (t) { return '<button data-tab="' + t[0] + '" role="tab">' + t[1] + '<span class="cnt" data-cnt="' + t[0] + '" hidden></span></button>'; }).join('') + '</div></div></div>' +
    '<div class="main" id="ab-main"></div>' +
    '<div class="ov" id="ab-ov"></div><aside class="dr" id="ab-dr" aria-hidden="true"></aside>' +
    '<div class="toast" id="ab-toast"></div>';
  var main = document.getElementById('ab-main'), ov = document.getElementById('ab-ov'), dr = document.getElementById('ab-dr');
  root.querySelectorAll('.seg button').forEach(function (b) { b.addEventListener('click', function () { show(b.dataset.tab); }); });
  ov.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

  function show(tab, arg) {
    state.tab = tab; remember('tab', tab);
    root.querySelectorAll('.seg button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === tab); });
    ({ home: viewHome, perf: viewPerf, search: viewSearch, attention: viewAttention, groups: viewGroups, runs: viewRuns }[tab])(arg);
  }
  function fail(e) { if (e && e.pin) { main.innerHTML = ''; return; } main.innerHTML = '<div class="card">' + note('err', e.message) + '<button class="btn" id="ab-retry">다시 시도</button></div>'; document.getElementById('ab-retry').onclick = function () { show(state.tab); }; }
  /** 모드 표시. per = 계정별 모드 {신성, 포에이테크} (없으면 공통 모드 하나) */
  function setMode(m, per) {
    var ss = per ? per.신성 : m, ft = per ? per.포에이테크 : m;
    state.mode = ss === '실제' || ft === '실제' ? '실제' : '시험'; state.per = { 신성: ss, 포에이테크: ft };
    document.getElementById('ab-mode').innerHTML = ss === ft
      ? (ss === '실제' ? '<span class="chip mode-live">● 실제 모드 · 네이버 입찰가를 바꾸는 중</span>' : '<span class="chip mode-test">● 시험 모드 · 계산만 기록</span>')
      : modeChips();
  }
  function modeChips() { return ['신성', '포에이테크'].map(function (a) { var v = state.per[a]; return '<span class="chip ' + (v === '실제' ? 'mode-live' : 'mode-test') + '">● ' + a + ' ' + esc(v) + '</span>'; }).join(' '); }
  function modeText() { return state.per && state.per.신성 !== state.per.포에이테크 ? '신성 ' + state.per.신성 + ' · 포에이테크 ' + state.per.포에이테크 : state.mode + ' 모드'; }
  function setCount(tab, n) { var el = root.querySelector('[data-cnt="' + tab + '"]'); if (!el) return; el.hidden = !n; el.textContent = n || ''; }

  var toastT;
  function toast(text, err) {
    var t = document.getElementById('ab-toast');
    t.textContent = text; t.className = 'toast on' + (err ? ' err' : '');
    clearTimeout(toastT); toastT = setTimeout(function () { t.className = 'toast'; }, err ? 4000 : 2400);
  }
  /** 토스 느낌 확인 창 → Promise(true/false) */
  function ask(title, text, okLabel) {
    return new Promise(function (resolve) {
      var w = document.createElement('div');
      w.className = 'modal-ov';
      w.innerHTML = '<div class="modal" role="dialog"><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p><div class="row"><button class="btn" data-a="0">취소</button><button class="btn pri" data-a="1">' + esc(okLabel || '확인') + '</button></div></div>';
      root.appendChild(w);
      function done(v) { w.remove(); document.removeEventListener('keydown', key); resolve(v); }
      function key(e) { if (e.key === 'Escape') done(false); if (e.key === 'Enter') done(true); }
      w.addEventListener('click', function (e) { var b = e.target.closest('[data-a]'); if (b) done(b.dataset.a === '1'); else if (e.target === w) done(false); });
      document.addEventListener('keydown', key);
      w.querySelector('.btn.pri').focus();
    });
  }

  /* ───────── 홈 ───────── */
  var SERIES = [['신성', '네이버 신성', 'var(--c-ss)'], ['포에이테크', '네이버 포에이테크', 'var(--c-ft)'], ['구글', '구글', 'var(--c-gg)']];
  var DOTS = { '신성': 'var(--c-ss)', '포에이테크': 'var(--c-ft)', '구글': 'var(--c-gg)' };
  function viewHome(fresh) {
    main.innerHTML = '<div class="card">' + sk(16, '24%') + '<div style="height:14px"></div>' + sk(44, '38%') + '<div style="height:14px"></div>' + sk(16, '50%') + '</div>' +
      '<div class="grid g3">' + skCard(2) + skCard(2) + skCard(2) + '</div>' + skCard(4);
    get('home', fresh === true ? { fresh: 1 } : {}).then(renderHome).catch(function (e) {
      if (/알 수 없는 요청/.test(e.message)) return get('status').then(renderHomeLite).catch(fail);   // 웹 앱이 아직 옛 버전
      fail(e);
    });
  }
  function renderHome(d) {
    var R = d.보고, S = d.상태, all = R.전체;
    setMode(S.모드, S.계정별모드);
    var nCheck = R.특이점.filter(function (a) { return a.급 !== '참고'; }).length;
    setCount('home', nCheck);
    var wk = R.요약[0] && R.요약[0].bl;
    var html = '<div class="card"><div class="hero"><div><div class="lbl">' + esc(R.라벨) + ' 광고비 · 네이버와 구글 합계</div>' +
      '<div class="big">' + won(all.광고비) + '</div><div class="kpis">' +
      kpi('클릭', cnt(all.클릭)) + kpi('클릭당', won(all.클릭 ? all.광고비 / all.클릭 : 0)) + kpi('노출', cnt(all.노출)) + '</div></div>' +
      '<div>' + chg(all.광고비, R.비교광고비, wk ? wk + ' 대비' : '') + '</div></div></div>';
    html += '<div class="grid g3">' + R.요약.map(function (l) {
      return '<div class="card tight"><div class="row between"><span class="lbl"><span class="dot" style="background:' + DOTS[l.계정] + '"></span>' + esc(l.이름) + '</span>' + chg(l.a.광고비, l.b && l.b.광고비) + '</div>' +
        '<div class="mid">' + won(l.a.광고비) + '</div><div class="sub">클릭 ' + cnt(l.a.클릭) + ' · 클릭당 ' + won(l.a.CPC) + (l.a.순위 ? ' · 평균 ' + l.a.순위 + '위' : '') + (l.a.전환 ? ' · 전환 ' + cnt(l.a.전환) : '') + '</div>' +
        (l.none ? '<div class="note warn" style="margin-bottom:0">구글 자료는 매일 새벽 5시에 들어옵니다</div>' : '') + '</div>';
    }).join('') + '</div>';
    html += '<div class="card"><div class="ttl">검토 요청 <span class="n">' + nCheck + '</span><span class="sp"></span><span class="sub">' + esc(R.라벨) + ' 성과 + 최근 7일 키워드</span></div>' +
      '<p class="desc">살펴볼 점과 제안입니다. 버튼으로 제안대로 바로 실행할 수 있고(확인 창이 한 번 뜸), 키워드 줄을 누르면 상세가 열립니다.</p>' + alerts(R.특이점) + '</div>';
    html += '<div class="grid g2"><div class="card"><div class="ttl">최근 14 광고일 광고비</div><p class="desc">막대에 마우스를 올리면 매체별 금액이 보입니다.</p>' + chart(R.추이) + '</div>' +
      '<div class="card">' + bidCard(S) + '</div></div>';
    html += '<div class="card"><div class="ttl">광고비 많이 쓴 키워드</div><p class="desc">최근 7일, 네이버와 구글을 합쳐 광고비 순서. 네이버 키워드는 누르면 상세가 열립니다.</p>' + topTable(R.상위키워드) + '</div>';
    html += '<div class="foot">계산 ' + esc(d.계산시각 || '') + (d.캐시 ? ' (미리 계산된 결과 · 매일 8시·정기 1·3회차 뒤 새로 계산)' : '') + ' · <button class="btn ghost sm" id="ab-fresh">지금 새로 계산</button></div>';
    main.innerHTML = html;
    bindChart(main);
    bindGo(main);
    bindMore(main);
    bindActs(main, R.특이점);
    document.getElementById('ab-fresh').onclick = function () { viewHome(true); };
    var go = main.querySelector('[data-goto]'); if (go) go.onclick = function () { show(go.dataset.goto); };
  }
  /** 웹 앱이 새 버전으로 배포되기 전: 현황만으로 간단히 */
  function renderHomeLite(S) {
    setMode(S.모드, S.계정별모드);
    var tr = (S.일별 || []).map(function (x) { var o = { 날짜: x.날짜 }; ['신성', '포에이테크'].forEach(function (a) { var v = x.계정별[a] || {}; o[a] = { 광고비: v.광고비 || 0, 클릭: v.클릭 || 0, 노출: v.노출 || 0 }; }); o.구글 = { 광고비: 0, 클릭: 0 }; return o; });
    main.innerHTML = '<div class="card">' + note('warn', '홈 요약은 구글 웹 앱을 새 버전으로 배포하면 보입니다 (Apps Script → 배포 관리 → 연필 → 새 버전). 지금은 자동입찰 현황만 표시합니다.') + '</div>' +
      '<div class="grid g2"><div class="card"><div class="ttl">최근 14일 네이버 광고비</div>' + chart(tr) + '</div><div class="card">' + bidCard(S) + '</div></div>';
    bindChart(main);
    var go = main.querySelector('[data-goto]'); if (go) go.onclick = function () { show(go.dataset.goto); };
  }
  function kpi(k, v) { return '<div class="kpi"><div class="k">' + esc(k) + '</div><div class="v">' + v + '</div></div>'; }

  function alerts(list) {
    if (!list || !list.length) return '<div class="empty">특별히 살펴볼 점이 없습니다 👍</div>';
    var col = { '확인': 'red', '검토': 'orange', '참고': 'gray' };
    return '<div class="alerts">' + list.map(function (a, i) {
      var t = '';
      if (a.표 && a.표.length) {
        var done = doneGet(), rows = a.표.map(function (r, j) {
          var k = a.행키 && a.행키[j], acts = (a.행조치 && k && a.행조치[j]) || [];
          var cell = !a.행조치 ? '' : '<td class="acts" data-ai="' + i + '" data-ri="' + j + '">' + (acts.some(function (x) { return done[doneKey(k, x)]; }) ? '<span class="chip green">처리함</span>' :
            acts.map(function (x, c) { return '<button class="btn sm" data-ai="' + i + '" data-ri="' + j + '" data-ci="' + c + '">' + esc(x.라벨) + '</button>'; }).join(' ')) + '</td>';
          return '<tr' + (k ? ' class="go" data-acc="' + esc(k[0]) + '" data-grp="' + esc(k[1]) + '" data-kw="' + esc(k[2]) + '"' : '') + (j >= 3 ? ' data-extra="' + i + '" hidden' : '') + '>' +
            r.map(function (v, c) { return c === 0 ? '<td><b>' + esc(v) + '</b></td>' : '<td>' + esc(v) + '</td>'; }).join('') + cell + '</tr>';
        }).join('');
        t = '<div class="tbl-wrap"><table><thead><tr>' + a.머리.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + (a.행조치 ? '<th></th>' : '') + '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
          (a.표.length > 3 ? '<button class="btn ghost sm more" data-more="' + i + '">' + (a.표.length - 3) + '개 더 보기</button>' : '');
      }
      return '<div class="al"><div class="al-h"><span class="chip ' + (col[a.급] || 'gray') + '">' + esc(a.급) + '</span>' + esc(a.제목) + '</div>' +
        (a.근거 ? '<div class="al-e">' + esc(a.근거) + '</div>' : '') + t + '<div class="al-s">' + esc(a.제안) + '</div>' +
        ((a.모두 && a.행조치 && a.행조치.some(function (x) { return x.length; })) || a.버튼 ? '<div class="al-a">' +
          (a.모두 || []).map(function (m, b) { return '<button class="btn sm pri" data-ai="' + i + '" data-bi="' + b + '">' + esc(m.라벨) + '</button>'; }).join('') +
          (a.버튼 || []).map(function (x, b) { return '<button class="btn sm" data-ai="' + i + '" data-xi="' + b + '">' + esc(x.라벨) + (x.act === 'link' ? ' ↗' : '') + '</button>'; }).join('') + '</div>' : '') + '</div>';
    }).join('') + '</div>';
  }

  /* ───────── 제안 실행 버튼 (홈 검토 요청) ─────────
   * 행조치 act: off(네이버에서 끄기) / fixed(고정 입찰가) / rtmax(실시간 최대입찰가) / rt(실시간으로 옮기기). 모두 = 각 줄의 같은 조치를 차례로.
   * 처리한 줄은 이 브라우저에 7일 기억(보고서는 하루 세 번 새로 계산되므로 그 사이 다시 누르지 않게) */
  var ACTNAME = { off: '네이버에서 키워드 끄기', fixed: '입찰가 고정', rtmax: '실시간 최대입찰가 바꾸기', rt: '실시간 입찰로 옮기기' };
  function doneGet() { try { return JSON.parse(localStorage.getItem('ab-done') || '{}'); } catch (e) { return {}; } }
  function doneKey(k, x) { return x.act + '|' + k.join('|'); }
  function markDone(k, x) {
    try { var d = doneGet(), cut = Date.now() - 7 * 864e5; Object.keys(d).forEach(function (q) { if (d[q] < cut) delete d[q]; }); d[doneKey(k, x)] = Date.now(); localStorage.setItem('ab-done', JSON.stringify(d)); } catch (e) {}
  }
  function actDesc(k, x) {
    return k[2] + ' (' + k[0] + ' · ' + k[1] + ') → ' + (x.act === 'off' ? '끄기' : x.act === 'fixed' ? won(x.fixed) + ' 고정' : x.act === 'rtmax' ? '최대입찰가 ' + won(x.max) :
      '실시간 ' + x.grade + '등급 · 목표 ' + x.target + '위 · 최대 ' + won(x.max));
  }
  function actNote(jobs) {
    var off = jobs.some(function (j) { return j.x.act === 'off'; }), bid = jobs.some(function (j) { return j.x.act !== 'off'; });
    var ssTest = bid && state.per && state.per.신성 !== '실제' && jobs.some(function (j) { return j.k[0] === '신성' && j.x.act !== 'off'; });
    return '\n\n' + [off ? '끄기는 네이버에 바로 반영됩니다(삭제 아님, 다시 켤 수 있음).' : '', bid ? '입찰가 변경은 다음 자동입찰 실행부터 반영됩니다.' : '',
      ssTest ? '신성은 지금 시험 모드라 입찰가 변경은 계산에만 쓰이고, 실제 입찰은 보라웨어가 합니다.' : ''].filter(Boolean).join('\n');
  }
  function runAct(k, x) {
    var b = { account: k[0], group: k[1], keyword: k[2] };
    if (x.act === 'off') return post('setKeywordOn', Object.assign(b, { on: false }));
    if (x.act === 'fixed') return post('setManage', Object.assign(b, { manage: '고정', fixed: x.fixed }));
    if (x.act === 'rtmax') return post('setManage', Object.assign(b, { manage: '실시간', max: x.max }));
    if (x.act === 'rt') return post('setManage', Object.assign(b, { manage: '실시간', grade: x.grade, target: x.target, max: x.max }));
    return Promise.reject(new Error('알 수 없는 조치'));
  }
  function bindActs(box, list) {
    function rowDone(ai, ri) { var td = box.querySelector('td.acts[data-ai="' + ai + '"][data-ri="' + ri + '"]'); if (td) td.innerHTML = '<span class="chip green">처리함</span>'; }
    box.querySelectorAll('[data-ci]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var ai = +btn.dataset.ai, ri = +btn.dataset.ri, a = list[ai], j = { k: a.행키[ri], x: a.행조치[ri][+btn.dataset.ci] };
        ask(ACTNAME[j.x.act], actDesc(j.k, j.x) + actNote([j]), '실행').then(function (ok) {
          if (!ok) return;
          btn.disabled = true; btn.textContent = '처리 중…';
          runAct(j.k, j.x).then(function (d) { markDone(j.k, j.x); rowDone(ai, ri); toast(j.k[2] + ' · ' + ((d.반영 || []).join(' / ') || '처리했습니다')); })
            .catch(function (e2) { toast(j.k[2] + ': ' + e2.message, true); btn.disabled = false; btn.textContent = j.x.라벨; });
        });
      });
    });
    box.querySelectorAll('[data-bi]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ai = +btn.dataset.ai, a = list[ai], m = a.모두[+btn.dataset.bi], done = doneGet(), jobs = [];
        a.행조치.forEach(function (acts, ri) { var x = acts[m.i]; if (x && !acts.some(function (y) { return done[doneKey(a.행키[ri], y)]; })) jobs.push({ ri: ri, k: a.행키[ri], x: x }); });
        if (!jobs.length) { toast('남은 항목이 없습니다'); return; }
        ask(m.라벨 + ' (' + jobs.length + '개)', jobs.map(function (j) { return '· ' + actDesc(j.k, j.x); }).join('\n') + actNote(jobs), '모두 실행').then(function (ok) {
          if (!ok) return;
          var n = 0, fail = [], label = btn.textContent;
          box.querySelectorAll('[data-ai="' + ai + '"][data-bi]').forEach(function (b) { b.disabled = true; });
          (function next(i) {
            if (i >= jobs.length) {
              btn.textContent = label; box.querySelectorAll('[data-ai="' + ai + '"][data-bi]').forEach(function (b) { b.disabled = false; });
              toast(jobs.length + '개 중 ' + n + '개 처리' + (fail.length ? ' · 실패 ' + fail.length + '개: ' + fail.join(', ') : ''), !!fail.length); return;
            }
            btn.textContent = (i + 1) + '/' + jobs.length + ' 처리 중…';
            var j = jobs[i];
            runAct(j.k, j.x).then(function () { n++; markDone(j.k, j.x); rowDone(ai, j.ri); }, function (e) { fail.push(j.k[2] + '(' + e.message + ')'); }).then(function () { next(i + 1); });
          })(0);
        });
      });
    });
    box.querySelectorAll('[data-xi]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var x = list[+btn.dataset.ai].버튼[+btn.dataset.xi];
        if (x.act === 'goto') show(x.tab); else if (x.act === 'link') window.open(x.url, '_blank', 'noopener');
      });
    });
  }
  function bindMore(box) {
    box.querySelectorAll('[data-more]').forEach(function (b) {
      var rows = box.querySelectorAll('[data-extra="' + b.dataset.more + '"]');
      b.addEventListener('click', function () {
        var open = b.dataset.open === '1';
        rows.forEach(function (tr) { tr.hidden = open; });
        b.dataset.open = open ? '0' : '1';
        b.textContent = open ? rows.length + '개 더 보기' : '접기';
      });
    });
  }
  function bidCard(S) {
    var ymd = todayYmd(), logs = (S.실행로그 || []).filter(function (l) { return String(l.시각).slice(0, 10) === ymd; });
    var reg = logs.filter(function (l) { return num(l.회차) && l.계정 === '신성'; }), rt = logs.filter(function (l) { return l.회차 === '실시간'; });
    var errs = logs.filter(function (l) { return l.오류 && l.모드 !== '연결확인' && l.회차 !== '보고서'; }).length;
    var res = (S.실시간 && S.실시간.결과별) || {};
    var resTxt = Object.keys(res).sort(function (a, b) { return res[b] - res[a]; }).slice(0, 3).map(function (k) { return esc(k) + ' ' + res[k]; }).join(' · ');
    var lastReg = reg[0], lastRt = rt[0];   // 실행로그는 최신이 앞
    return '<div class="ttl">오늘 자동입찰<span class="sp"></span><button class="btn ghost sm" data-goto="runs">실행 기록 ›</button></div>' +
      '<div class="kv">' +
      '<div><span>모드</span><span>' + modeChips() + '</span></div>' +
      '<div><span>정기 입찰</span><span>' + reg.length + '회 · 변경(예정) ' + cnt(reg.reduce(function (s, l) { return s + (num(l.변경수) || 0); }, 0)) + '건</span></div>' +
      '<div><span>보라웨어와 같은 비율</span><span>' + (lastReg ? esc(pct(lastReg.비율)) : '<span class="sub">아직 실행 전</span>') + '</span></div>' +
      '<div><span>실시간 입찰</span><span>' + rt.length + '회' + (lastRt ? ' · ' + esc(String(pct(lastRt.비율)).replace(/\(.*\)/, '')) : '') + '</span></div>' +
      '<div><span>실시간 키워드</span><span>' + cnt(S.실시간 && S.실시간.사용) + '개' + (resTxt ? '<span class="s" style="display:block;color:var(--t4);font-weight:400;font-size:12px">' + resTxt + '</span>' : '') + '</span></div>' +
      '<div><span>오늘 오류</span><span>' + (errs ? '<span class="chip red">' + errs + '건</span>' : '<span class="chip green">없음</span>') + '</span></div></div>';
  }

  /** 쌓은 막대그래프: 네이버 신성 / 네이버 포에이테크 / 구글 */
  function chart(days, keys) {
    if (!days || !days.length) return '<div class="empty">아직 쌓인 성과가 없습니다</div>';
    var SER = keys ? SERIES.filter(function (s) { return keys.indexOf(s[0]) >= 0; }) : SERIES; chart.ser = SER;
    var W = 640, H = 220, L = 40, B = 26, T = 8, n = days.length, bw = (W - L) / n, w = Math.min(26, bw * .58);
    var tot = days.map(function (d) { return SER.reduce(function (s, x) { return s + ((d[x[0]] || {}).광고비 || 0); }, 0); });
    if (!Math.max.apply(null, tot)) return '<div class="empty">이 기간에는 광고비가 없습니다 (광고가 꺼져 있었거나 자료가 아직 없음)</div>';
    var mx = nice(Math.max.apply(null, tot)), ih = H - B - T;
    var g = '';
    for (var i = 0; i <= 4; i++) { var y = T + ih * i / 4; g += '<line x1="' + L + '" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="#f2f4f6"/><text x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + short(mx * (4 - i) / 4) + '</text>'; }
    days.forEach(function (d, i) {
      var x = L + i * bw + (bw - w) / 2, y = T + ih, segs = SER.map(function (s) { return [(d[s[0]] || {}).광고비 || 0, s[2]]; }).filter(function (s) { return s[0] > 0; });
      g += '<g class="bar" data-i="' + i + '"><rect class="hit" x="' + (L + i * bw) + '" y="' + T + '" width="' + bw + '" height="' + ih + '" fill="transparent" rx="8"/>';
      segs.forEach(function (s, j) {
        var h = ih * s[0] / mx; y -= h;
        g += j === segs.length - 1 ? '<path d="' + topRound(x, y, w, h, Math.min(6, h, w / 2)) + '" style="fill:' + s[1] + '"/>' : '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" style="fill:' + s[1] + '"/>';
      });
      var md = d.날짜.slice(5).split('-');
      g += (n <= 16 || i % Math.ceil(n / 12) === 0 ? '<text x="' + (x + w / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + Number(md[0]) + '/' + Number(md[1]) + '</text>' : '') + '</g>';
    });
    chart.data = days;
    return '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' + g + '</svg><div class="tip"></div></div>' +
      '<div class="legend">' + SER.map(function (s) { return '<span><span class="dot" style="background:' + s[2] + '"></span>' + s[1] + '</span>'; }).join('') + '</div>';
  }
  function nice(v) { var p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
  function topRound(x, y, w, h, r) { return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z'; }
  function bindChart(box) {
    box.querySelectorAll('.chart').forEach(function (c) {
      var tip = c.querySelector('.tip'), days = chart.data, SER = chart.ser || SERIES;
      c.querySelectorAll('.bar').forEach(function (b) {
        b.addEventListener('mouseenter', function () {
          var d = days[Number(b.dataset.i)], sum = 0, cl = 0;
          var lines = SER.map(function (s) { var v = d[s[0]] || {}; sum += v.광고비 || 0; cl += v.클릭 || 0; return '<span class="dot" style="background:' + s[2] + '"></span>' + s[1] + ' ' + won(v.광고비 || 0) + ' · 클릭 ' + cnt(v.클릭 || 0); });
          tip.innerHTML = '<b>' + esc(dayLabel(d.날짜)) + ' · ' + won(sum) + '</b><br>' + lines.join('<br>') + '<br>클릭 합계 ' + cnt(cl);
          var cr = c.getBoundingClientRect(), br = b.querySelector('.hit').getBoundingClientRect();
          var left = br.left - cr.left + br.width / 2; left = Math.max(120, Math.min(cr.width - 120, left));
          tip.style.left = left + 'px'; tip.style.top = (br.top - cr.top + 4) + 'px'; tip.style.opacity = 1;
        });
        b.addEventListener('mouseleave', function () { tip.style.opacity = 0; });
      });
    });
  }
  function topTable(list) {
    if (!list || !list.length) return '<div class="empty">아직 키워드 성과가 없습니다 (매일 오전 8시 보고서 때 모읍니다)</div>';
    return '<div class="tbl-wrap"><table><thead><tr><th>키워드</th><th>매체</th><th class="num">광고비</th><th class="num">클릭</th><th class="num">클릭당</th><th class="num">노출</th><th class="num">평균 순위</th><th class="num">전환</th></tr></thead><tbody>' +
      list.map(function (o) {
        var nv = o.매체 === '네이버';
        return '<tr' + (nv ? ' class="go" data-acc="' + esc(o.계정) + '" data-grp="' + esc(o.그룹) + '" data-kw="' + esc(o.키워드) + '"' : '') + '><td><b>' + esc(o.키워드) + '</b><span class="s">' + esc(o.그룹) + '</span></td>' +
          '<td><span class="dot" style="background:' + (nv ? DOTS[o.계정] : DOTS['구글']) + '"></span>' + esc(nv ? '네이버 ' + o.계정 : '구글') + '</td><td class="num"><b>' + won(o.광고비) + '</b></td><td class="num">' + cnt(o.클릭) +
          '</td><td class="num">' + won(o.CPC) + '</td><td class="num">' + cnt(o.노출) + '</td><td class="num">' + (o.순위 ? o.순위 + '위' : '-') + '</td><td class="num">' + (o.전환 ? cnt(o.전환) : '-') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  /** data-acc/grp/kw 줄을 누르면 상세 창 */
  function bindGo(box) {
    box.querySelectorAll('tr.go').forEach(function (tr) {
      tr.addEventListener('click', function (e) { if (e.target.closest('button')) return; openKeyword(tr.dataset.acc, tr.dataset.grp, tr.dataset.kw); });
    });
  }

  /* ───────── 성과 (광고별) ───────── */
  var PF = { ch: remember('pch') || 'all', acc: remember('pacc') || '', days: Number(remember('pdays') || 7) };
  var ACCNAME = { '신성': '신성씨앤에스', '포에이테크': '포에이테크', '구글': '구글' };
  function segBtns(key, opts, cur) { return '<div class="seg sm">' + opts.map(function (o) { return '<button data-pf="' + key + '" data-v="' + esc(o[0]) + '" class="' + (String(cur) === String(o[0]) ? 'on' : '') + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>'; }
  function viewPerf() {
    main.innerHTML = '<div class="card tight"><div class="row between"><div class="row">' +
      segBtns('ch', [['all', '전체'], ['naver', '네이버'], ['google', '구글']], PF.ch) +
      (PF.ch === 'naver' ? segBtns('acc', [['', '신성+포에이테크'], ['신성', '신성씨앤에스'], ['포에이테크', '포에이테크']], PF.acc) : '') +
      '</div>' + segBtns('days', [[1, '어제'], [7, '최근 7일'], [30, '최근 30일']], PF.days) + '</div></div><div id="ab-perf">' +
      '<div class="card">' + sk(16, '30%') + '<div style="height:12px"></div>' + sk(40, '40%') + '</div>' + skCard(5) + '</div>';
    main.querySelectorAll('[data-pf]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.pf, v = b.dataset.v;
        if (k === 'ch') { PF.ch = v; if (v !== 'naver') PF.acc = ''; }
        if (k === 'acc') PF.acc = v;
        if (k === 'days') PF.days = Number(v);
        remember('pch', PF.ch); remember('pacc', PF.acc); remember('pdays', String(PF.days));
        viewPerf();
      });
    });
    get('perf', { channel: PF.ch, account: PF.acc, days: PF.days }).then(renderPerf).catch(function (e) {
      var box = document.getElementById('ab-perf');
      box.innerHTML = '<div class="card">' + note(/알 수 없는 요청/.test(e.message) ? 'warn' : 'err', /알 수 없는 요청/.test(e.message) ? '성과 화면은 구글 웹 앱을 새 버전으로 배포하면 보입니다 (배포 관리 → 연필 → 새 버전)' : e.message) + '</div>';
    });
  }
  function periodLabel(a) { if (!a) return ''; return a[0] === a[1] ? dayLabel(a[0]) : dayLabel(a[0]) + ' ~ ' + dayLabel(a[1]); }
  function renderPerf(d) {
    var box = document.getElementById('ab-perf'); if (!box) return;
    var T = d.합계, P = d.비교, who = PF.ch === 'google' ? '구글' : PF.ch === 'naver' ? '네이버 · ' + (PF.acc ? ACCNAME[PF.acc] : '신성+포에이테크') : '네이버 + 구글';
    var html = '<div class="card"><div class="hero"><div><div class="lbl">' + esc(who) + ' · ' + esc(periodLabel(d.기간)) + (PF.days > 1 ? ' (최근 ' + PF.days + '일)' : ' (전 광고일)') + '</div>' +
      '<div class="big">' + won(T.광고비) + '</div><div class="kpis">' +
      kpi('클릭', cnt(T.클릭) + ' ' + chg(T.클릭, P.클릭)) + kpi('클릭당', won(T.CPC)) + kpi('노출', cnt(T.노출)) + kpi('클릭률', T.CTR + '%') +
      (T.전환 || P.전환 ? kpi('전환', cnt(T.전환)) : '') + (T.순위 ? kpi('평균 순위', T.순위 + '위') : '') + '</div></div>' +
      '<div>' + chg(T.광고비, P.광고비, d.비교기간 ? '이전 ' + PF.days + '일 대비' : '') + '</div></div></div>';
    html += '<div class="grid g2"><div class="card"><div class="ttl">일별 광고비</div><p class="desc">최근 ' + d.추이.length + ' 광고일 · 막대에 마우스를 올리면 금액이 보입니다.</p>' + chart(d.추이, d.시리즈) + '</div>' +
      '<div class="card">' + (d.기기 ? devCard(d.기기) : shareCard(d.분류)) + '</div></div>';
    html += '<div class="card"><div class="ttl">' + (PF.ch === 'google' ? '캠페인별' : PF.ch === 'naver' ? '광고그룹별' : '광고그룹·캠페인별') + ' <span class="n">' + d.분류.length + '</span></div>' +
      '<p class="desc">광고비 순서 · 비교는 바로 앞 같은 길이 기간</p>' + itemTable(d.분류) + '</div>';
    html += '<div class="card"><div class="ttl">키워드별</div><p class="desc">광고비 순서 30개 · 네이버 키워드는 누르면 상세가 열립니다.</p>' + topTable(d.상위키워드) + '</div>';
    html += '<div class="foot">자료 시작: 네이버 ' + esc(d.자료.네이버 || '-') + ' · 구글 ' + esc(d.자료.구글 || '-') + ' · 계산 ' + esc(d.계산시각 || '') + (d.캐시 ? ' (저장된 결과)' : '') + '</div>';
    box.innerHTML = html;
    bindChart(box); bindGo(box); pager(box);
  }
  function devCard(v) {
    var tc = v.PC.클릭 + v.모바일.클릭, ta = v.PC.광고비 + v.모바일.광고비;
    function bar(label, a, b, fmt) {
      var t = a + b, pa = t ? Math.round(a / t * 100) : 0;
      return '<div style="margin:14px 0 6px" class="row between"><span class="lbl">' + label + '</span><span class="sub">PC ' + fmt(a) + ' · 모바일 ' + fmt(b) + '</span></div>' +
        '<div class="bar2"><span style="width:' + pa + '%"></span></div><div class="row between sub" style="margin-top:4px"><span>PC ' + pa + '%</span><span>모바일 ' + (t ? 100 - pa : 0) + '%</span></div>';
    }
    return '<div class="ttl">PC · 모바일</div><p class="desc">네이버만 (구글은 기기 구분 자료 없음)</p>' + (tc || ta ? bar('클릭', v.PC.클릭, v.모바일.클릭, cnt) + bar('광고비', v.PC.광고비, v.모바일.광고비, won) : '<div class="empty">이 기간 자료가 없습니다</div>');
  }
  function shareCard(items) {
    var by = {}; (items || []).forEach(function (o) { var k = o.매체 === '구글' ? '구글' : o.계정; by[k] = (by[k] || 0) + o.현재.광고비; });
    var t = Object.keys(by).reduce(function (s, k) { return s + by[k]; }, 0);
    return '<div class="ttl">매체별 비중</div><p class="desc">이 기간 광고비</p>' + (t ? ['신성', '포에이테크', '구글'].filter(function (k) { return by[k]; }).map(function (k) {
      var p = Math.round(by[k] / t * 100);
      return '<div style="margin:12px 0 4px" class="row between"><span class="lbl"><span class="dot" style="background:' + DOTS[k] + '"></span>' + (k === '구글' ? '구글' : '네이버 · ' + ACCNAME[k]) + '</span><span class="sub">' + won(by[k]) + ' · ' + p + '%</span></div>' +
        '<div class="bar2"><span style="width:' + p + '%;background:' + DOTS[k] + '"></span></div>';
    }).join('') : '<div class="empty">이 기간 자료가 없습니다</div>');
  }
  function itemTable(list) {
    if (!list || !list.length) return '<div class="empty">이 기간 자료가 없습니다</div>';
    return '<div class="tbl-wrap"><table><thead><tr><th>' + (PF.ch === 'google' ? '캠페인' : '광고그룹 / 캠페인') + '</th><th class="num">광고비</th><th>비교</th><th class="num">클릭</th><th class="num">클릭당</th><th class="num">노출</th><th class="num">클릭률</th><th class="num">평균 순위</th><th class="num">전환</th></tr></thead><tbody>' +
      list.map(function (o) {
        var c = o.현재, nm = o.매체 === '구글' ? '구글' : '네이버 · ' + ACCNAME[o.계정];
        return '<tr><td><b>' + esc(o.이름) + '</b><span class="s"><span class="dot" style="background:' + (o.매체 === '구글' ? DOTS['구글'] : DOTS[o.계정]) + '"></span>' + esc(nm) + (o.상태 === 'OFF' ? ' · 꺼짐' : '') + '</span></td>' +
          '<td class="num"><b>' + won(c.광고비) + '</b></td><td>' + (o.비교광고비 || c.광고비 ? chg(c.광고비, o.비교광고비) : '') + '</td><td class="num">' + cnt(c.클릭) + '</td><td class="num">' + won(c.CPC) +
          '</td><td class="num">' + cnt(c.노출) + '</td><td class="num">' + c.CTR + '%</td><td class="num">' + (c.순위 ? c.순위 + '위' : '-') + '</td><td class="num">' + (c.전환 ? cnt(c.전환) : '-') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ───────── 키워드 ───────── */
  var ICON_SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
  function viewSearch() {
    var last = remember('q') || '';
    main.innerHTML = '<div class="card"><div class="ttl">키워드 찾기</div><p class="desc">키워드나 광고그룹 이름 일부를 넣으세요. 띄어쓰기·대소문자는 상관없습니다.</p>' +
      '<div class="search">' + ICON_SEARCH + '<input type="search" id="ab-q" placeholder="예: 화상회의, DL380, 간접_서버" value="' + esc(last) + '"></div><div id="ab-results"></div></div>';
    var q = document.getElementById('ab-q');
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter' && q.value.trim()) search(q.value.trim()); });
    q.focus();
    if (last) search(last);
  }
  function search(text) {
    remember('q', text);
    var box = document.getElementById('ab-results');
    box.innerHTML = sk(14, '40%') + '<div style="height:12px"></div>' + sk(220);
    get('search', { q: text, limit: PAGE }).then(function (d) {
      if (!d.목록.length) { box.innerHTML = '<div class="empty">찾은 키워드가 없습니다. 꺼 둔 키워드나 관리하지 않는 그룹의 키워드는 나오지 않습니다.</div>'; return; }
      box.innerHTML = '<p class="desc" id="ab-shown"></p>' + kwTable(d.목록) + '<div class="more-wrap"><button class="btn wide" id="ab-next" hidden></button></div>';
      bindGo(box);
      var shown = d.목록.length, next = d.다음, btn = document.getElementById('ab-next'), tb = box.querySelector('tbody');
      function paint() {
        document.getElementById('ab-shown').textContent = cnt(d.전체) + '개 중 ' + cnt(shown) + '개 · 줄을 누르면 오른쪽에 상세가 열립니다';
        btn.hidden = next == null; btn.disabled = false; btn.textContent = '더 보기 (' + cnt(d.전체 - shown) + '개 남음)';
      }
      paint();
      btn.onclick = function () {
        btn.disabled = true; btn.textContent = '불러오는 중…';
        get('search', { q: text, limit: PAGE, offset: next }).then(function (d2) {
          var tmp = document.createElement('tbody'); tmp.innerHTML = kwRows(d2.목록); bindGo(tmp);
          while (tmp.firstChild) tb.appendChild(tmp.firstChild);
          shown += d2.목록.length; next = d2.다음; paint();
        }).catch(function (e) { toast(e.message, true); paint(); });
      };
    }).catch(function (e) { box.innerHTML = note('err', e.message); });
  }
  function kwTable(list, extraCol) {
    return '<div class="tbl-wrap"><table><thead><tr><th>키워드</th><th>관리</th><th class="num">현재 입찰가</th><th class="num">최근 순위</th><th class="num">목표</th><th class="num">최대 입찰가</th><th>최근 결과</th>' +
      (extraCol ? '<th></th>' : '') + '</tr></thead><tbody>' + kwRows(list, extraCol) + '</tbody></table></div>';
  }
  function kwRows(list, extraCol) {
    return list.map(function (o) {
        var nb = o.새입찰가 && num(o.새입찰가) !== num(o.현재입찰가) ? ' → ' + won(o.새입찰가) : '';
        return '<tr class="go" data-acc="' + esc(o.계정) + '" data-grp="' + esc(o.광고그룹) + '" data-kw="' + esc(o.키워드) + '"><td><b>' + esc(o.키워드) + '</b><span class="s">' + esc(o.계정 + ' · ' + o.광고그룹) + '</span></td>' +
          '<td>' + badge(o.관리) + '</td><td class="num"><b>' + won(o.관리 === '고정' ? o.고정입찰가 : o.현재입찰가) + '</b></td><td class="num">' + (o.관리 === '실시간' ? rank(o.순위) : '-') +
          '</td><td class="num">' + rank(o.목표순위) + '</td><td class="num">' + won(o.최대입찰가) + '</td><td>' + esc(o.결과 || '') + nb + '</td>' + (extraCol ? '<td>' + extraCol(o) + '</td>' : '') + '</tr>';
      }).join('');
  }
  /** 긴 표는 50줄만 보이고 "더 보기"로 50줄씩 (이미 받은 자료를 나눠 보여 줌) */
  var PAGE = 50;
  function pager(box) {
    box.querySelectorAll('.tbl-wrap > table > tbody').forEach(function (tb) {
      var rows = [].slice.call(tb.children); if (rows.length <= PAGE) return;
      var shown = PAGE; rows.slice(PAGE).forEach(function (tr) { tr.hidden = true; });
      var w = document.createElement('div'); w.className = 'more-wrap';
      w.innerHTML = '<button class="btn wide"></button>'; tb.closest('.tbl-wrap').after(w);
      var b = w.firstChild;
      function paint() { b.textContent = '더 보기 (' + cnt(rows.length - shown) + '개 남음)'; }
      paint();
      b.addEventListener('click', function () {
        rows.slice(shown, shown + PAGE).forEach(function (tr) { tr.hidden = false; }); shown += PAGE;
        if (shown >= rows.length) w.remove(); else paint();
      });
    });
  }

  /* ───────── 키워드 상세 창 ───────── */
  function openDrawer(html) { dr.innerHTML = html; dr.classList.add('on'); ov.classList.add('on'); dr.setAttribute('aria-hidden', 'false'); }
  function closeDrawer() { dr.classList.remove('on'); ov.classList.remove('on'); dr.setAttribute('aria-hidden', 'true'); }
  function drawerHead(kw, sub, extra) { return '<div class="dr-h"><div><h2>' + esc(kw) + ' ' + (extra || '') + '</h2><div class="sub">' + esc(sub) + '</div></div><button class="x" aria-label="닫기">×</button></div>'; }
  function openKeyword(acc, grp, kw) {
    openDrawer(drawerHead(kw, acc + ' · ' + grp) + '<div class="dr-b"><div class="stats">' + [1, 2, 3, 4].map(function () { return '<div class="stat">' + sk(12, '40%') + '<div style="height:8px"></div>' + sk(22, '60%') + '</div>'; }).join('') + '</div><div style="height:12px"></div>' + skCard(5) + '</div>');
    dr.querySelector('.x').onclick = closeDrawer;
    get('keyword', { account: acc, group: grp, keyword: kw }).then(function (d) {
      var s = d.상태 || { 계정: acc, 광고그룹: grp, 키워드: kw, 관리: '정기' };
      var rt = s.관리 === '실시간';
      var nb = s.새입찰가 && num(s.새입찰가) !== num(s.현재입찰가) ? '다음 ' + won(s.새입찰가) : (s.결과 || '');
      var st = [
        ['현재 입찰가', won(s.관리 === '고정' ? s.고정입찰가 : s.현재입찰가), nb],
        rt ? ['최근 순위', rank(s.순위), '노출 ' + cnt(s.노출) + (s.통계시간대 ? ' · ' + s.통계시간대 : '')] : ['PC 권장가', won(s.PC권장가), '28일 평균 · 목표 순위 기준'],
        ['목표 순위', rank(s.목표순위), rt ? (s.등급 ? s.등급 + '등급' : '') : '그룹 설정'],
        ['최대 입찰가', won(s.최대입찰가), rt ? '실시간 키워드별' : '그룹·회차 설정']
      ];
      openDrawer(drawerHead(kw, acc + ' · ' + grp, badge(s.관리)) + '<div class="dr-b"><div class="stats">' + st.map(function (x) {
        return '<div class="stat"><div class="k">' + x[0] + '</div><div class="v">' + x[1] + '</div><div class="s">' + esc(x[2] || '') + '</div></div>'; }).join('') + '</div>' +
        '<div class="card" style="margin-top:12px">' + editForm(s) + '</div>' +
        historyBox(d) +
        '<div class="card"><div class="ttl" style="font-size:16px">계산 정보</div><div class="kv">' +
        '<div><span>최근 결과</span><span>' + esc(s.결과 || '-') + '</span></div>' +
        (s.사유 ? '<div><span>계산 사유</span><span>' + esc(s.사유) + '</span></div>' : '') +
        (s.모바일권장가 ? '<div><span>모바일 권장가</span><span>' + won(s.모바일권장가) + '</span></div>' : '') +
        '<div><span>마지막 확인</span><span>' + esc(s.확인시각 || '-') + '</span></div></div></div></div>');
      dr.querySelector('.x').onclick = closeDrawer;
      bindForm(s);
      bindChart(dr);
    }).catch(function (e) { dr.querySelector('.dr-b').innerHTML = note('err', e.message); });
  }
  function editForm(s) {
    var opts = [['정기', '정기 입찰', '그룹 설정대로 하루 3번'], ['실시간', '실시간 입찰', '1시간마다 실제 순위를 보고 조절'],
      ['고정', '고정 금액', '정한 금액으로 계속 유지'], ['제외', '건드리지 않음', '네이버 광고 화면에서 직접 관리']];
    return '<div class="ttl" style="font-size:16px">관리 방식</div><div class="opts">' + opts.map(function (o) {
      return '<label class="opt' + (s.관리 === o[0] ? ' on' : '') + '" data-m="' + o[0] + '"><input type="radio" name="ab-m" value="' + o[0] + '"' + (s.관리 === o[0] ? ' checked' : '') + ' hidden><b>' + o[1] + '</b><small>' + o[2] + '</small></label>'; }).join('') + '</div>' +
      '<div data-for="실시간"><div class="fld"><span>등급</span><div class="in"><select id="ab-grade">' + [1, 2, 3].map(function (g) {
        return '<option value="' + g + '"' + (Number(s.등급 || 3) === g ? ' selected' : '') + '>' + g + '등급' + (g === 1 ? ' · 크게 조절' : g === 3 ? ' · 작게 조절' : '') + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="fld"><span>목표 순위</span><div class="in"><input type="number" id="ab-target" min="1" max="15" value="' + esc(s.목표순위 || 1) + '"> 위</div></div>' +
      '<div class="fld"><span>최대 입찰가</span><div class="in"><input type="number" id="ab-max" min="70" step="10" value="' + esc(s.최대입찰가 || '') + '"> 원</div></div></div>' +
      '<div data-for="고정"><div class="fld"><span>고정 금액</span><div class="in"><input type="number" id="ab-fixed" min="70" step="10" value="' + esc(s.고정입찰가 || s.현재입찰가 || '') + '"> 원</div></div></div>' +
      '<div data-for="정기"><p class="desc">목표 순위·최대 입찰가는 "그룹 설정"에서 그룹 단위로 정합니다.</p></div>' +
      '<div data-for="제외"><p class="desc">프로그램이 이 키워드의 입찰가를 바꾸지 않습니다. 네이버 광고 화면에서 직접 바꾸세요.</p></div>' +
      '<button class="btn pri wide" id="ab-save">저장</button><div class="sub" style="text-align:center;margin-top:8px">다음 실행부터 반영됩니다</div>';
  }
  function bindForm(s) {
    function sync() {
      var m = (dr.querySelector('input[name=ab-m]:checked') || {}).value || s.관리;
      dr.querySelectorAll('.opt').forEach(function (l) { l.classList.toggle('on', l.dataset.m === m); });
      dr.querySelectorAll('[data-for]').forEach(function (d) { d.style.display = d.dataset.for === m ? '' : 'none'; });
      return m;
    }
    dr.querySelectorAll('.opt').forEach(function (l) { l.addEventListener('click', function () { l.querySelector('input').checked = true; sync(); }); });
    sync();
    document.getElementById('ab-save').addEventListener('click', function () {
      var m = sync(), payload = { account: s.계정, group: s.광고그룹, keyword: s.키워드, manage: m };
      if (m === '실시간') { payload.grade = document.getElementById('ab-grade').value; payload.target = document.getElementById('ab-target').value; payload.max = document.getElementById('ab-max').value; }
      if (m === '고정') payload.fixed = document.getElementById('ab-fixed').value;
      var btn = document.getElementById('ab-save');
      btn.disabled = true; btn.textContent = '저장 중…';
      post('setManage', payload).then(function (d) {
        toast('저장했습니다 · ' + (d.반영.join(' / ') || '바뀐 내용 없음'));
        openKeyword(s.계정, s.광고그룹, s.키워드);
      }).catch(function (e) { toast(e.message, true); btn.disabled = false; btn.textContent = '저장'; });
    });
  }
  function historyBox(d) {
    var rt = d.실시간기록 || [], ch = d.변경이력 || [], html = '';
    if (rt.length) {
      html += '<div class="card"><div class="ttl" style="font-size:16px">실시간 기록 <span class="sub">최근 ' + rt.length + '회</span></div>' + lineChart(rt) +
        '<div class="tbl-wrap" style="max-height:280px"><table><thead><tr><th>확인 시각</th><th class="num">노출</th><th class="num">순위</th><th class="num">입찰가</th><th>사유</th></tr></thead><tbody>' +
        rt.slice().reverse().map(function (r) { return '<tr><td>' + esc(String(r.시각).slice(5)) + '<span class="s">' + esc(r.통계시간대) + '</span></td><td class="num">' + cnt(r.노출) + '</td><td class="num">' + rank(r.순위) +
          '</td><td class="num">' + won(r.현재입찰가) + (num(r.새입찰가) !== num(r.현재입찰가) ? ' → <b>' + won(r.새입찰가) + '</b>' : '') + '</td><td>' + esc(r.사유) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    }
    if (ch.length) {
      html += '<div class="card"><div class="ttl" style="font-size:16px">실제로 바꾼 기록 <span class="sub">정기</span></div><div class="tbl-wrap" style="max-height:240px"><table><thead><tr><th>시각</th><th>회차</th><th class="num">이전</th><th class="num">새 입찰가</th><th>사유</th></tr></thead><tbody>' +
        ch.slice().reverse().map(function (r) { return '<tr><td>' + esc(r.시각) + '</td><td>' + esc(r.회차) + '</td><td class="num">' + won(r.이전입찰가) + '</td><td class="num"><b>' + won(r.새입찰가) + '</b></td><td>' + esc(r.사유) + '</td></tr>'; }).join('') +
        '</tbody></table></div></div>';
    }
    return html || '<div class="card"><div class="empty">아직 기록이 없습니다. 실시간 키워드는 1시간마다, 정기 키워드는 실제 모드에서 바꿀 때 기록됩니다.</div></div>';
  }
  /** 순위(파란 선, 위쪽이 1위)와 입찰가(회색 선) */
  function lineChart(rt) {
    var pts = rt.filter(function (r) { return num(r.순위) != null || num(r.새입찰가) != null; });
    if (pts.length < 2) return '';
    var W = 520, H = 150, P = 24, n = pts.length;
    var ranks = pts.map(function (r) { return num(r.순위); }), bids = pts.map(function (r) { return num(r.새입찰가) || num(r.현재입찰가) || 0; });
    var rMax = Math.max.apply(null, ranks.filter(function (v) { return v != null; }).concat([3])), bMax = Math.max.apply(null, bids) || 1;
    function x(i) { return P + (W - P * 2) * i / (n - 1); }
    var rLine = ranks.map(function (v, i) { return v == null ? null : x(i) + ',' + (P + (H - P * 2) * (v - 1) / Math.max(rMax - 1, 1)); }).filter(Boolean).join(' ');
    var bLine = bids.map(function (v, i) { return x(i) + ',' + (H - P - (H - P * 2) * v / bMax); }).join(' ');
    return '<div class="chart"><svg viewBox="0 0 ' + W + ' ' + H + '">' +
      '<text x="' + P + '" y="12" style="fill:var(--blue)">● 순위 (위쪽이 1위)</text><text x="' + (W - P) + '" y="12" text-anchor="end">● 입찰가 최대 ' + esc(won(bMax)) + '</text>' +
      '<polyline points="' + bLine + '" fill="none" stroke="#b0b8c1" stroke-width="2" stroke-linejoin="round"/>' +
      (rLine ? '<polyline points="' + rLine + '" fill="none" stroke="#3182f6" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' : '') + '</svg></div>';
  }

  /* ───────── 확인 필요 ───────── */
  function viewAttention() {
    main.innerHTML = skCard(5) + skCard(4);
    get('attention').then(function (d) {
      var bump = function (o) { return '<button class="btn sm pri" data-bump="1" data-acc="' + esc(o.계정) + '" data-grp="' + esc(o.광고그룹) + '" data-kw="' + esc(o.키워드) + '" data-max="' + esc(o.최대입찰가) + '">최대 +2,000원</button>'; };
      setCount('attention', (d.최대입찰가에막힘 || []).length);
      main.innerHTML =
        sec('최대 입찰가에 막힌 실시간 키워드', '목표 순위에 못 미치는데 최대 입찰가까지 올라가 있습니다. 최대 입찰가를 올리거나 목표 순위를 낮출지 정하세요.', d.최대입찰가에막힘, bump) +
        sec('목표보다 낮아 올리는 중인 실시간 키워드', '프로그램이 1시간마다 조금씩 올리고 있습니다. 지켜보면 됩니다.', d.목표미달올리는중) +
        sec('최대 입찰가 제한에 걸린 정기 키워드', '권장가가 높은 순 100개 (전체 ' + cnt(d.정기최대가제한전체) + '개). 노출이 많고 중요한 키워드면 실시간 입찰로 옮기는 것을 검토하세요.', d.정기최대가제한) +
        sec('입찰가가 높은 키워드 30개', '비용이 큰 키워드입니다. 성과(견적 문의)와 함께 가끔 점검하세요.', d.입찰가높은순);
      bindGo(main); pager(main);
      main.querySelectorAll('[data-bump]').forEach(function (b) {
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          var nm = (num(b.dataset.max) || 0) + 2000;
          ask('최대 입찰가 올리기', b.dataset.kw + '\n' + won(b.dataset.max) + ' → ' + won(nm), '올리기').then(function (ok) {
            if (!ok) return;
            b.disabled = true; b.textContent = '저장 중…';
            post('setManage', { account: b.dataset.acc, group: b.dataset.grp, keyword: b.dataset.kw, manage: '실시간', max: nm })
              .then(function () { b.textContent = '올림 ' + won(nm); toast(b.dataset.kw + ' 최대 입찰가 ' + won(nm)); })
              .catch(function (e2) { toast(e2.message, true); b.disabled = false; b.textContent = '최대 +2,000원'; });
          });
        });
      });
    }).catch(fail);
  }
  function sec(title, desc, list, extra) {
    return '<div class="card"><div class="ttl">' + esc(title) + ' <span class="n">' + (list || []).length + '</span></div><p class="desc">' + esc(desc) + '</p>' +
      ((list && list.length) ? kwTable(list, extra) : '<div class="empty">해당 없음</div>') + '</div>';
  }

  /* ───────── 그룹 설정 ───────── */
  var GF = [['등급', 'sel', ['1순위', '2순위', '3순위']], ['관리', 'sel', ['예', '아니오']], ['목표순위', 'num'], ['최대입찰가_10시', 'num'], ['가중치_10시(%)', 'num'],
    ['최대입찰가_13시', 'num'], ['가중치_13시(%)', 'num'], ['최대입찰가_15시', 'num'], ['가중치_15시(%)', 'num']];
  function viewGroups() {
    main.innerHTML = skCard(8);
    get('groups').then(function (d) {
      var tiers = {}; (d.등급설정 || []).forEach(function (t) { tiers[t.계정 + '|' + t.등급] = t; });
      main.innerHTML = '<div class="card"><div class="ttl">그룹 설정 <span class="sub">정기 입찰</span></div><p class="desc">빈 칸은 등급 기본값을 따릅니다(흐린 숫자). 바꾼 줄은 "저장"이 파랗게 바뀝니다. 실시간 키워드는 이 설정과 상관없이 따로 관리됩니다.</p>' +
        '<div class="tbl-wrap"><table><thead><tr><th>광고그룹</th>' + GF.map(function (f) { return '<th>' + esc(f[0].replace('최대입찰가_', '최대 ').replace('가중치_', '가중치 ').replace('목표순위', '목표 순위')) + '</th>'; }).join('') +
        '<th></th></tr></thead><tbody>' + (d.그룹설정 || []).map(function (g, i) {
          var t = tiers[g.계정 + '|' + g.등급] || {};
          return '<tr data-i="' + i + '"><td><b>' + esc(g.광고그룹) + '</b><span class="s">' + esc(g.계정) + '</span></td>' + GF.map(function (f) {
            var v = g[f[0]] == null ? '' : g[f[0]];
            if (f[1] === 'sel') return '<td><select class="sm" data-f="' + esc(f[0]) + '">' + f[2].map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></td>';
            var dflt = t[f[0]] != null ? t[f[0]] : '';
            return '<td><input class="sm" type="number" data-f="' + esc(f[0]) + '" value="' + esc(v) + '" placeholder="' + esc(dflt) + '"></td>';
          }).join('') + '<td><button class="btn sm" data-save="' + i + '" disabled>저장</button></td></tr>';
        }).join('') + '</tbody></table></div></div>' +
        '<div class="card"><div class="ttl">등급 기본값</div><p class="desc">등급 기본값은 시트의 "등급설정" 탭에서 바꿉니다.</p>' + tierTable(d.등급설정) + '</div>';
      pager(main);
      main.querySelectorAll('tr[data-i]').forEach(function (tr) {
        var g = d.그룹설정[Number(tr.dataset.i)], btn = tr.querySelector('[data-save]');
        function dirty() { btn.disabled = false; btn.classList.add('pri'); }
        tr.querySelectorAll('[data-f]').forEach(function (inp) { inp.addEventListener('input', dirty); inp.addEventListener('change', dirty); });
        btn.addEventListener('click', function () {
          var fields = {};
          tr.querySelectorAll('[data-f]').forEach(function (inp) { var f = inp.dataset.f, v = inp.value, old = g[f] == null ? '' : String(g[f]); if (String(v) !== old) fields[f] = inp.type === 'number' && v !== '' ? Number(v) : v; });
          if (!Object.keys(fields).length) { btn.disabled = true; btn.classList.remove('pri'); return; }
          btn.disabled = true; btn.textContent = '저장 중';
          post('setGroup', { account: g.계정, group: g.광고그룹, fields: fields }).then(function (r) {
            Object.keys(r.반영).forEach(function (k) { g[k] = r.반영[k]; }); btn.textContent = '저장됨'; btn.classList.remove('pri'); toast(g.광고그룹 + ' 저장했습니다');
          }).catch(function (e) { toast(g.광고그룹 + ': ' + e.message, true); btn.textContent = '저장'; btn.disabled = false; });
        });
      });
    }).catch(fail);
  }
  function tierTable(list) {
    if (!list || !list.length) return '<div class="empty">등급 설정이 없습니다</div>';
    var cols = ['계정', '등급', '순위기준', '목표순위', '최대입찰가_10시', '가중치_10시(%)', '최대입찰가_13시', '가중치_13시(%)', '최대입찰가_15시', '가중치_15시(%)'];
    return '<div class="tbl-wrap"><table><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c.replace('최대입찰가_', '최대 ').replace('가중치_', '가중치 ')) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      list.map(function (t) { return '<tr>' + cols.map(function (c) { return '<td>' + esc(t[c]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }

  /* ───────── 실행 기록 ───────── */
  var RUNS = [['round1', '정기 1회차', '10시 설정으로'], ['round2', '정기 2회차', '13시 설정으로'], ['round3', '정기 3회차', '15시 설정으로'], ['realtime', '실시간', '새 통계로 순위 확인']];
  function viewRuns() {
    main.innerHTML = skCard(2) + skCard(8);
    get('status').then(function (d) {
      setMode(d.모드, d.계정별모드);
      var html = '<div class="card"><div class="ttl">지금 실행</div><p class="desc">예약 시각을 기다리지 않고 바로 돌립니다. ' + (state.mode === '실제' ? '<b style="color:var(--red-t)">실제 모드인 계정(' + esc(modeText()) + ')은 입찰가가 바로 바뀝니다.</b>' : '지금은 시험 모드라 계산만 기록합니다.') + ' 1분쯤 걸릴 수 있습니다.</p>' +
        '<div class="tiles">' + RUNS.map(function (r) { return '<button class="tile" data-run="' + r[0] + '"><b>' + r[1] + '</b><span>' + r[2] + '</span></button>'; }).join('') + '</div><div id="ab-runmsg"></div></div>';
      html += '<div class="card"><div class="ttl">최근 실행 기록 <span class="sub">최근 ' + d.실행로그.length + '건</span></div><div class="tbl-wrap"><table><thead><tr><th>시각</th><th>구분</th><th>모드</th><th>계정</th>' +
        '<th class="num">키워드</th><th class="num">변경(예정)</th><th class="num">최대가 제한</th><th>일치율 · 결과</th><th>오류</th></tr></thead><tbody>' +
        d.실행로그.map(function (l) {
          var conn = l.모드 === '연결확인', rep = l.회차 === '보고서';
          var kind = l.회차 === '실시간' ? '<span class="chip blue">실시간</span>' : num(l.회차) ? '<span class="chip gray">정기 ' + l.회차 + '회차</span>' : rep ? '<span class="chip green">보고서</span>' : conn ? '<span class="chip gray">연결 확인</span>' : esc(l.회차);
          return '<tr><td>' + esc(String(l.시각).slice(5)) + '</td><td>' + kind + '</td><td>' + esc(conn ? '-' : l.모드) + '</td><td>' + esc(l.계정) + '</td><td class="num">' + (rep ? '-' : cnt(l.키워드수)) +
            '</td><td class="num">' + (rep ? '-' : cnt(l.변경수)) + '</td><td class="num">' + (rep ? '-' : cnt(l.최대가제한수)) + '</td><td>' + esc(conn ? l.오류 : pct(l.비율)) + '</td><td style="color:var(--red-t)">' + esc(conn ? '' : l.오류) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
      main.innerHTML = html;
      main.querySelectorAll('[data-run]').forEach(function (b) { b.addEventListener('click', function () { runNow(b.dataset.run, b.querySelector('b').textContent); }); });
    }).catch(fail);
  }
  function runNow(kind, label) {
    var warn = state.mode === '실제' ? '실제 모드인 계정(' + modeText() + ')은 네이버 입찰가가 바로 바뀝니다.' : '지금은 시험 모드라 계산만 기록합니다.';
    ask(label + ' 지금 실행', warn + '\n1분쯤 걸릴 수 있습니다.', '실행').then(function (ok) {
      if (!ok) return;
      var box = document.getElementById('ab-runmsg');
      box.innerHTML = note('info', label + ' 실행 중… 창을 닫지 마세요.');
      main.querySelectorAll('[data-run]').forEach(function (b) { b.disabled = true; });
      post('runNow', { kind: kind }).then(function () { toast(label + ' 실행을 마쳤습니다'); viewRuns(); }).catch(function (e) {
        box.innerHTML = note('err', e.message); main.querySelectorAll('[data-run]').forEach(function (b) { b.disabled = false; });
      });
    });
  }

  var first = remember('tab');
  show(TABS.some(function (t) { return t[0] === first; }) ? first : 'home');
})();
