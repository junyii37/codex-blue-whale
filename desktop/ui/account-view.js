(() => {
  'use strict';
  const validMode = value => value === 'api' || value === 'subscription';
  const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  function remainingPercent(value) { const used = number(value); return used === null ? null : Math.max(0, Math.min(100, 100 - used)); }
  function dialogueText(lines) { return Array.isArray(lines) ? lines.filter(Boolean).map(line => typeof line.t === 'string' ? line.t : '').filter(Boolean).join('\n') : ''; }
  function windowText(item) {
    const used = number(item.usedPercent);
    return used === null ? '额度比例未知' : `剩余 ${remainingPercent(used).toFixed(1)}% · 已用 ${used.toFixed(1)}%${item.stale ? '（快照已过期）' : ''}`;
  }
  function tokenText(value) { const n = number(value); return n === null ? '暂无记录' : n.toLocaleString() + ' token'; }
  function quotaLabel(item) { return item.windowDurationMins === 300 ? '5 小时额度' : item.windowDurationMins === 10080 ? '每周额度' : item.label || '额度窗口'; }
  function noticeText(value) {
    if (!value || value.notify === false) return '';
    if (value.failureKind === 'high-demand') return '挤不进去...';
    return number(value.tokens) === null ? '本轮 token 暂无记录' : '本轮本机已观测：' + tokenText(value.tokens);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { validMode, windowText, tokenText, noticeText, quotaLabel, remainingPercent, dialogueText };
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const key = 'dshw-account-view';
  let mode = 'api', generation = 0, switching = false;
  let modeButtons = [], status = null, modeRevision = 0;
  let driver = null, quotaSnapshot = null;
  function setBubbleDriver(value) { driver = value; }
  function invalidate() { generation++; }
  try { const saved = localStorage.getItem(key); if (validMode(saved)) mode = saved; } catch {}
  function text(parent, tag, value) { const el = document.createElement(tag); el.textContent = value; parent.append(el); return el; }
  function close() { invalidate(); driver?.close(); }
  function updateButtons() { for (const button of modeButtons) { button.disabled = switching; button.setAttribute('aria-pressed', String(button.dataset.mode === mode)); } for(const el of document.querySelectorAll('[data-account-api]'))el.hidden=mode==='subscription';
    document.documentElement.dataset.accountMode = mode;
    for (const el of document.querySelectorAll('.whale-mode-description')) el.textContent = mode === 'subscription' ? '查看 5 小时 / 周额度与本机 token 用量' : '查看当前 API 余额与消费记录';
    for (const el of document.querySelectorAll('.whale-mode-open')) el.textContent = mode === 'subscription' ? '查看订阅额度 →' : '配置 API 余额 →';
  }
  function commit(next) {
    mode = next; try { localStorage.setItem(key, mode); } catch {}
    close(); quotaSnapshot = null; updateButtons();
    window.dispatchEvent(new CustomEvent('whale-account-view', { detail: { mode } }));
  }
  async function setMode(next) {
    if (!validMode(next) || switching) return false;
    modeRevision++; switching = true; updateButtons(); if (status) status.textContent = '正在保存…';
    try {
      const response = await fetch('/api/display-mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: next }) });
      if (!response.ok) throw Error('切换失败，请重试');
      const result = await response.json();
      if (result.ok === false || (result.mode || result.displayMode) !== next) throw Error('模式未保存，请重试');
      commit(next); if (status) status.textContent = next === 'subscription' ? '已切换。点击下方按钮查看额度。' : '已切换为 API 余额模式。'; return true;
    } catch (e) { if (status) status.textContent = e.message || '切换失败，请重试'; return false; }
    finally { switching = false; updateButtons(); }
  }
  async function refresh() {
    if (mode !== 'subscription') return;
    const own = ++generation;
    try {
      const response = await fetch('/api/insights', { cache: 'no-store' }); if (!response.ok) throw Error('暂时无法读取订阅快照');
      const data = await response.json(); if (own !== generation || mode !== 'subscription') return;
      quotaSnapshot = data.subscription || {}; driver?.updateQuota();
    } catch (e) {
      if (own !== generation || mode !== 'subscription') return;
      quotaSnapshot = { available: false, reason: e.message || '读取失败，请稍后重试' }; driver?.updateQuota();
    }
  }
  // Called only while the original renderer is building its hidden buffer.
  // No separate card, timer, dialogue renderer or live DOM repaint is needed.
  function renderQuota(parts) {
    for (const kind of ['label', 'amount', 'hint', 'gif']) parts[kind].style.display = 'none';
    const view = text(parts.root, 'section', ''); view.className = 'whale-sub-quotas';
    view.setAttribute('aria-label', 'Codex 订阅剩余额度');
    const heading = text(view, 'div', '剩余额度'); heading.className = 'dshwv-label whale-sub-heading';
    const sub = quotaSnapshot;
    for (const [duration, label] of [[300, '5 小时'], [10080, '本周']]) {
      const item = sub?.available ? (sub.windows || []).find(w => w.windowDurationMins === duration) : null;
      const left = remainingPercent(item?.usedPercent);
      const section = text(view, 'section', ''); section.className = 'whale-sub-quota';
      section.dataset.stale = String(!!item?.stale);
      section.title = item ? windowText(item) : sub?.reason || (sub ? '暂无官方额度快照' : '额度读取中…');
      const line = text(section, 'div', ''); line.className = 'whale-sub-quota-label';
      text(line, 'span', label); text(line, 'strong', left === null ? '—' : left.toFixed(1).replace(/\.0$/, '') + '%' + (item?.stale ? '*' : ''));
      if (left !== null) {
        const meter = text(section, 'progress', ''); meter.max = 100; meter.value = left;
        meter.setAttribute('aria-label', label + '剩余额度');
      } else { const unknown = text(section, 'span', ''); unknown.className = 'whale-sub-unknown'; }
    }
  }
  function notice(value) {
    if (mode !== 'subscription') return;
    const message = noticeText(value);
    if (!message) return;
    if (driver) driver.notice(value);
    else window.whaleToast?.(message);
  }
  function init() {
    const style = document.createElement('style'); style.textContent = `
      /* Only the quota page differs from DSH; dialogue uses its original modules. */
      /* Lift the whole quota stack toward the oval's visual center. A percentage
         follows its rendered size without changing the frame's fitting/layout. */
      .whale-sub-quotas{width:86%;max-width:calc(var(--dshw-u)*500);display:flex;flex-direction:column;gap:calc(var(--dshw-u)*18);color:#536ba9;transform:translateY(-12%)}
      .whale-sub-heading{font-size:calc(var(--dshw-u)*56)}
      .whale-sub-quota-label{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:calc(var(--dshw-u)*6);font-size:calc(var(--dshw-u)*56);font-weight:600;letter-spacing:.02em}
      .whale-sub-quota-label strong{font-size:calc(var(--dshw-u)*72);font-weight:800;line-height:1.05}
      .whale-sub-quota progress{display:block;appearance:none;-webkit-appearance:none;width:100%;height:calc(var(--dshw-u)*20);border:0;border-radius:999px;overflow:hidden;background:#e9edf8}
      .whale-sub-quota progress::-webkit-progress-bar{background:#e9edf8;border-radius:999px}
      .whale-sub-quota progress::-webkit-progress-value{background:linear-gradient(90deg,#9caee7,#819bd6);border-radius:999px}
      .whale-sub-quota progress::-moz-progress-bar{background:#819bd6;border-radius:999px}
      .whale-sub-quota[data-stale=true]{opacity:.6}
      .whale-sub-unknown{display:block;height:calc(var(--dshw-u)*20);box-sizing:border-box;border:1px dashed #bec9e5;border-radius:999px}
      .whale-account-menu button{cursor:pointer;border:1px solid #9fcbd5;border-radius:8px;padding:5px 9px;background:#fff;color:#173d48}
      .whale-account-menu{font:12px/1.5 system-ui;padding:5px}.whale-account-menu summary{cursor:pointer}.whale-account-menu button[aria-pressed=true]{background:#237f91;color:white}.whale-account-menu small{display:block;max-width:230px;margin-top:5px}
    `; document.head.append(style);
    const menu = document.querySelector('.dshwv-menu');
    if (menu) {
      const details = text(menu, 'section', ''); details.className = 'whale-account-menu'; text(details, 'strong', '小鲸鱼 · 控制面板'); menu.prepend(details);
      const row = text(details, 'div', ''); row.setAttribute('role', 'group'); row.setAttribute('aria-label', '额度展示模式');
      for (const [value, label] of [['api', 'API 余额'], ['subscription', 'Codex 订阅']]) { const button = text(row, 'button', label); button.dataset.mode = value; button.onclick = () => setMode(value); modeButtons.push(button); }
      text(details, 'p', '').className = 'whale-mode-description';
      const open = text(details, 'button', ''); open.className = 'whale-mode-open'; open.onclick = () => window.dispatchEvent(new Event(mode === 'subscription' ? 'whale-open-insights' : 'whale-open-settings'));
      status = text(details, 'small', '切换展示模式，不修改登录账号。'); status.setAttribute('role', 'status'); updateButtons();
      const view = menu.querySelector('.dshwv-menuview');
      if (view) {
        const rows = [...view.children];
        const groups = ['外观与位置', '声音与气泡', '用量与资源'].map(label => {
          const group = document.createElement('details'); group.className = 'whale-menu-group';
          text(group, 'summary', label); view.append(group); return group;
        });
        groups[0].open = true;
        for (const child of rows) {
          if (child.classList.contains('dshwv-menu-sep')) { child.remove(); continue; }
          const label = child.textContent;
          const index = /音效|音量|气泡|消耗提示|声音/.test(label) ? 1 : /币种|汇率|资源|工坊|API|额度|峰谷/.test(label) ? 2 : 0;
          groups[index].append(child);
        }
      }
    }
    const initialRevision = modeRevision;
    fetch('/api/display-mode', { cache: 'no-store' }).then(async response => { if (!response.ok) return; const data = await response.json(); const next = data.mode || data.displayMode; if (validMode(next) && !switching && modeRevision === initialRevision) commit(next); }).catch(() => {});
    window.addEventListener('whale-mode-changing', close);
  }
  window.WhaleAccountView = { get mode() { return mode; }, refresh, notice, close, invalidate, renderQuota, setBubbleDriver, setMode, quotaLabel, remainingPercent };
  // Deferred scripts run at readyState=interactive before the widget creates its menu.
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
