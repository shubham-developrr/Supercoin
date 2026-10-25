/* =========================================================================
   SuperCoin Vault — Application controller
   Offline-first, IndexedDB-backed, Apple Cupertino Dark Bento UI.
   ========================================================================= */

import {
  loadAccounts,
  saveAccount,
  saveAll,
  getMeta,
  setMeta,
  exportBundle,
  importBundle,
} from './db.js';
import { parseCommand } from './parser.js';

const state = {
  accounts: [],
  sort: 'id', // id | balance | coming | shopsy | expiring
  hideNames: false,
  editingId: null,
};

const gosatsLabels = { Active: 'GoSats', Inactive: 'GoSats' };

/* ------------------------------------------------------------------ */
/* DOM elements                                                       */
/* ------------------------------------------------------------------ */
const els = {};
function cacheEls() {
  const ids = [
    'grid', 'topPill', 'goActive',
    'mActive', 'mGained', 'mUsed', 'mComing', 'mProjected',
    'mExpiring', 'mNearest',
    'cmdInput', 'cmdUndo',
    'backdropAcct', 'modalAcct', 'acctTitle',
    'tabVault', 'tabCoins', 'tabHistory',
    'panelVault', 'panelCoins', 'panelHistory',
    'swGosats', 'inAlias', 'inPhoneDevice', 'inPhoneNumber',
    'inPanHolder', 'inNotes', 'inBalance', 'inPending',
    'inExpiring', 'inExpiry', 'chipsShopsy', 'btnMovePending',
    'histList', 'inHistAmount', 'inHistReason', 'btnHistType',
    'btnAddAcct', 'btnDelAcct', 'btnSaveAcct',
    'backdropDir', 'modalDir', 'dirTable',
    'backdropBackup', 'modalBackup', 'taJson', 'btnCopyJson',
    'btnExportJson', 'fileImport', 'btnPasteRestore', 'backupStatus',
    'inGemini', 'btnGeminiSave',
    'backdropLog', 'modalLog', 'logList',
    'backdropQuick', 'modalQuick', 'quickTitle', 'quickType',
    'quickAmount', 'quickReason', 'btnQuickSave',
    'toast',
  ];
  ids.forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

/* ------------------------------------------------------------------ */
/* Init                                                               */
/* ------------------------------------------------------------------ */
function init() {
  cacheEls();
  loadAccounts().then((accs) => {
    state.accounts = accs;
    renderAll();
    bindAll();
  });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function sum(key) {
  return state.accounts.reduce((t, a) => t + (Number(a[key]) || 0), 0);
}

function historySum(type) {
  return state.accounts.reduce(
    (t, a) => t + a.history.reduce((s, h) => s + (h.type === type ? Number(h.amount || 0) : 0), 0),
    0
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function daysBetween(d1, d2) {
  const ms = d2 - d1;
  return Math.round(ms / 86400000);
}

function cloneDeep(v) {
  return JSON.parse(JSON.stringify(v));
}

function findAccount(id) {
  return state.accounts.find((a) => a.id === id);
}

function nextId() {
  return Math.max(0, ...state.accounts.map((a) => a.id)) + 1;
}

function entry(type, amount, reason) {
  return { id: Date.now() + Math.random(), date: new Date().toISOString(), type, amount, reason };
}

/* ------------------------------------------------------------------ */
/* Persistence + undo                                                 */
/* ------------------------------------------------------------------ */
async function persist() {
  await saveAll(state.accounts);
}

async function mutate(accountId, updates, historyEntry) {
  const acc = findAccount(accountId);
  if (!acc) return;
  // snapshot for undo
  const snap = { accounts: cloneDeep(state.accounts), sort: state.sort };
  await setMeta('undo', snap);
  showUndoChip();
  Object.assign(acc, updates);
  if (historyEntry && historyEntry.amount > 0) acc.history.push(historyEntry);
  await saveAccount(acc);
  renderAll();
  // keep an open account modal in sync
  if (state.editingId && els.backdropAcct.classList.contains('open')) {
    const acc = findAccount(state.editingId);
    if (acc) renderAcctPanels(acc);
  }
}

function showUndoChip() {
  els.cmdUndo.classList.remove('hidden');
}

async function doUndo() {
  const snap = await getMeta('undo');
  if (!snap || !snap.accounts) return;
  state.accounts = snap.accounts;
  if (snap.sort != null) state.sort = snap.sort;
  await setMeta('undo', null);
  els.cmdUndo.classList.add('hidden');
  renderAll();
  toast('Undone');
}

/* ------------------------------------------------------------------ */
/* Rendering                                                          */
/* ------------------------------------------------------------------ */
function renderAll() {
  renderTopBar();
  renderMetrics();
  renderGrid();
  document.title = `SuperCoin Vault • ${sum('balance')} coins`;
}

function renderTopBar() {
  const activeCount = state.accounts.filter((a) => a.gosatsStatus === 'Active').length;
  els.goActive.textContent = activeCount;
}

function renderMetrics() {
  const active = sum('balance');
  const gained = historySum('gained');
  const used = historySum('used');
  const coming = sum('pending');
  const expiring = sum('expiringAmount');

  els.mActive.innerHTML = `<div class="metric-row"><span class="metric-label">Active Coins</span><span class="metric-val tabular">${active}</span></div><div class="metric-sub"><span class="metric-pos">+${gained}</span> <span style="color:var(--text-secondary)">gained</span> · <span class="metric-neg">−${used}</span> <span style="color:var(--text-secondary)">used</span></div>`;

  els.mComing.innerHTML = `<div class="metric-row"><span class="metric-label">Coming Soon</span><span class="metric-val tabular">${coming}</span></div><div class="metric-sub"><span class="metric-pos">+${coming}</span> pending · Projected <span class="metric-gold tabular">${active + coming}</span></div>`;

  const exps = state.accounts.filter((a) => a.expiringAmount > 0 && a.expiryDate);
  let nearestHtml = 'None at risk';
  let nearestColor = 'var(--text-secondary)';
  if (exps.length) {
    const nearest = exps.reduce(
      (b, a) => (!b || new Date(a.expiryDate) < new Date(b.expiryDate)) ? a : b
    );
    const d = daysBetween(new Date(), new Date(nearest.expiryDate));
    nearestHtml = `#${nearest.id} in ${Math.max(0, d)}d`;
    nearestColor = d <= 7 ? 'var(--red)' : 'var(--text-secondary)';
  }
  els.mExpiring.innerHTML = `<div class="metric-row"><span class="metric-label">Expiring</span><span class="metric-val tabular">${expiring}</span></div><div class="metric-sub" style="color:${nearestColor}">${expiring > 0 ? '<span class="metric-neg">⚠</span>' : ''}${nearestHtml}</div>`;
}

function sortAccounts() {
  const arr = state.accounts.slice();
  const s = state.sort;
  if (s === 'balance') arr.sort((a, b) => b.balance - a.balance || a.id - b.id);
  else if (s === 'coming') arr.sort((a, b) => b.pending - a.pending || a.id - b.id);
  else if (s === 'shopsy') arr.sort((a, b) => b.shopsyDays - a.shopsyDays || a.id - b.id);
  else if (s === 'expiring')
    arr.sort(
      (a, b) =>
        (b.expiringAmount || 0) - (a.expiringAmount || 0) ||
        (a.expiryDate || '').localeCompare(b.expiryDate || '') ||
        a.id - b.id
    );
  else arr.sort((a, b) => a.id - b.id);
  return arr;
}

function renderGrid() {
  const ordered = sortAccounts();
  const hide = state.hideNames ? ' hide-names' : '';
  els.grid.className = `grid${hide}`;
  els.grid.innerHTML = ordered.map((a) => cardHtml(a)).join('');
}

function segDayHtml(i, a) {
  const on = i <= a.shopsyDays;
  const complete = on && a.shopsyDays === 7;
  return `<div class="seg-day ${on ? 'on' : ''}${complete ? ' complete' : ''}" data-day="${i}">${i}</div>`;
}

function cardHtml(a) {
  const aliasDisp = state.hideNames ? '' : esc(a.alias || '#' + a.id);
  const active = a.gosatsStatus === 'Active';
  const segs = Array.from({ length: 7 }, (_, i) => segDayHtml(i + 1, a)).join('');
  const coming = a.pending || 0;
  const expiring = a.expiringAmount || 0;
  const expText = expiring > 0 ? `${expiring} ${a.expiryDate ? '· ' + fmtDate(a.expiryDate) : ''}` : 'None';
  const expClass = expiring > 0 ? 'exp' : 'zero';
  return `
    <article class="card" data-id="${a.id}">
      <div class="card-header">
        <div class="id-badge">#${a.id}</div>
        <div class="card-alias">${aliasDisp}</div>
        <div class="gosats-pill tappable ${active ? 'active' : 'inactive'}" data-id="${a.id}" data-action="toggle-gosats">
          <span class="dot" style="background:${active ? 'var(--green)' : 'var(--red)'}"></span>
          ${gosatsLabels[a.gosatsStatus]}
        </div>
      </div>
      <div class="card-body">
        <div class="balance-row">
          <div class="bal-left">
            <span class="bal-label">SUPERCOINS</span>
            <span class="bal-val tabular">${a.balance}</span>
          </div>
          <div class="quick-btns">
            <button class="qb" data-id="${a.id}" data-action="qb-plus" title="Log gained coins">+</button>
            <button class="qb" data-id="${a.id}" data-action="qb-minus" title="Log used coins">−</button>
          </div>
        </div>
        <div class="shopsy">
          <div class="shopsy-head">
            <div class="shopsy-title"><span class="dot" style="background:var(--gold)"></span>Shopsy 7D</div>
            <div class="shopsy-ctr">${a.shopsyDays}/7 <span>${a.shopsyDays === 7 ? 'Complete' : ''}</span></div>
            <button class="btn-step" data-id="${a.id}" data-action="shopsy-step">${a.shopsyDays === 7 ? 'Reset' : '+1d'}</button>
          </div>
          <div class="segs">${segs}</div>
        </div>
      </div>
      <div class="card-footer">
        <div class="foot-box">
          <div class="k">Coming</div>
          <div class="v ${coming > 0 ? 'pos' : 'zero'} tabular">+${coming}</div>
        </div>
        <div class="foot-box">
          <div class="k">Expiring</div>
          <div class="v ${expClass} tabular">${expText}</div>
        </div>
      </div>
    </article>
  `;
}

/* ------------------------------------------------------------------ */
/* Grid interactions                                                  */
/* ------------------------------------------------------------------ */
function onGridClick(e) {
  const card = e.target.closest('.card');
  const id = card ? Number(card.dataset.id) : null;
  const action = e.target.dataset.action;

  // Pill toggle (direct toggle, persists immediately)
  if (action === 'toggle-gosats' && id) {
    e.stopPropagation();
    const acc = findAccount(id);
    const next = acc.gosatsStatus === 'Active' ? 'Inactive' : 'Active';
    mutate(id, { gosatsStatus: next }, entry('gained', 0, `GoSats ${next}`));
    return;
  }

  // Quick + / − → open quick log modal preset
  if (action === 'qb-plus' || action === 'qb-minus') {
    e.stopPropagation();
    state.editingId = id;
    const acc = findAccount(id);
    openQuickModal(acc, action === 'qb-plus' ? 'gained' : 'used');
    return;
  }

  // Shopsy step +1 / Reset
  if (action === 'shopsy-step' && id) {
    e.stopPropagation();
    const acc = findAccount(id);
    const next = acc.shopsyDays === 7 ? 0 : Math.min(7, acc.shopsyDays + 1);
    mutate(id, { shopsyDays: next }, entry('gained', 0, `Shopsy ${next === 0 ? 'reset' : next + '/7'}`));
    return;
  }

  // Shopsy segment tap
  const seg = e.target.closest('.seg-day');
  if (seg && id) {
    e.stopPropagation();
    const acc = findAccount(id);
    const n = Number(seg.dataset.day);
    const next = n === acc.shopsyDays && acc.shopsyDays > 0 ? acc.shopsyDays - 1 : n;
    mutate(id, { shopsyDays: next }, entry('gained', 0, `Shopsy day ${next}`));
    return;
  }

  // Card tap → account detail modal
  if (card) {
    e.stopPropagation();
    openAccountModal(Number(card.dataset.id));
  }
}

/* ------------------------------------------------------------------ */
/* Modals: open/close                                                 */
/* ------------------------------------------------------------------ */
function openBackdrop(el) {
  document.querySelectorAll('.backdrop').forEach((b) => { if (b !== el) closeBackdrop(b); });
  el.classList.add('open');
}
function closeBackdrop(el) {
  el.classList.remove('open');
}

function closeAllModals() {
  document.querySelectorAll('.backdrop').forEach((b) => closeBackdrop(b));
}

/* ===== Account detail modal (3 tabs) ===== */
function openAccountModal(id) {
  state.editingId = id;
  const acc = findAccount(id);
  if (!acc) return;
  els.acctTitle.textContent = `Vault • ${esc(acc.alias || '#' + id)}`;

  renderAcctPanels(acc);
  els.modalAcct.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  els.tabVault.classList.add('active');
  els.panelVault.classList.remove('hidden');
  els.panelCoins.classList.add('hidden');
  els.panelHistory.classList.add('hidden');

  openBackdrop(els.backdropAcct);
}

function renderAcctPanels(acc) {
  // Tab 1 — Vault Details
  els.panelVault.innerHTML = `
    <div class="switch">
      <span style="font-size:13px;font-weight:700">GoSats Status</span>
      <div class="sw-track ${acc.gosatsStatus === 'Active' ? 'on' : ''}" id="swGosats">
        <div class="sw-thumb"></div>
      </div>
    </div>
    <div class="form-row col1">
      <label class="f-lbl">Account Label / Name</label>
      <input class="input" id="inAlias" value="${esc(acc.alias)}">
    </div>
    <div class="form-row">
      <div>
        <label class="f-lbl">Phone / Device &amp; SIM</label>
        <input class="input" id="inPhoneDevice" value="${esc(acc.phoneDevice)}">
      </div>
      <div>
        <label class="f-lbl">Registered Mobile Number</label>
        <input class="input" id="inPhoneNumber" value="${esc(acc.phoneNumber)}">
      </div>
    </div>
    <div class="form-row col1">
      <label class="f-lbl">Linked PAN Card Holder</label>
      <input class="input" id="inPanHolder" value="${esc(acc.panHolder)}">
    </div>
    <div class="form-row col1">
      <label class="f-lbl">Notes</label>
      <textarea class="input" id="inNotes" rows="3">${esc(acc.notes)}</textarea>
    </div>
  `;

  // Tab 2 — Coins & Expiry
  const pending = acc.pending || 0;
  els.panelCoins.innerHTML = `
    <div class="form-row">
      <div>
        <label class="f-lbl">Active SuperCoins Balance</label>
        <input class="input" id="inBalance" type="number" value="${acc.balance}">
      </div>
      <div>
        <label class="f-lbl">Potentially Coming (Pending)</label>
        <input class="input" id="inPending" type="number" value="${pending}">
      </div>
    </div>
    <div class="form-row">
      <div>
        <label class="f-lbl">Coins Expiring Soon</label>
        <input class="input" id="inExpiring" type="number" value="${acc.expiringAmount || 0}">
      </div>
      <div>
        <label class="f-lbl">Expiration Date</label>
        <input class="input" id="inExpiry" type="date" value="${acc.expiryDate || ''}">
      </div>
    </div>
    <div style="margin:10px 0"><label class="f-lbl">Shopsy 7-Day Game Streak</label></div>
    <div class="chips" id="chipsShopsy">${Array.from({ length: 8 }, (_, i) => {
      const on = i === acc.shopsyDays;
      return `<button class="chip ${on ? 'on' : ''}" data-day="${i}">${i === 0 ? '0' : i + 'd'}</button>`;
    }).join('')}</div>
    ${pending > 0 ? `<div style="margin:10px 0 6px"><button class="btn-sm primary" id="btnMovePending">Move +${pending} Coming Coins into Active Balance</button></div>` : ''}
  `;

  // Tab 3 — History
  renderHistoryList(acc.history);

  // wire tab 2 inputs
  setTimeout(() => {
    const inBalance = document.getElementById('inBalance');
    const inPending = document.getElementById('inPending');
    const inExpiring = document.getElementById('inExpiring');
    const inExpiry = document.getElementById('inExpiry');
    if (inBalance) inBalance.onchange = () => saveField(acc.id, 'balance', inBalance.value);
    if (inPending) inPending.onchange = () => saveField(acc.id, 'pending', inPending.value);
    if (inExpiring) inExpiring.onchange = () => saveField(acc.id, 'expiringAmount', inExpiring.value);
    if (inExpiry) inExpiry.onchange = () => saveField(acc.id, 'expiryDate', inExpiry.value);
    document.getElementById('chipsShopsy').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      const day = Number(chip.dataset.day);
      mutate(acc.id, { shopsyDays: day }, entry('gained', 0, `Shopsy day ${day}`));
    });
    const btnMove = document.getElementById('btnMovePending');
    if (btnMove) {
      btnMove.onclick = () => {
        mutate(
          acc.id,
          { balance: (acc.balance || 0) + pending, pending: 0 },
          entry('gained', pending, 'Pending → Active balance')
        );
      };
    }
  }, 0);
}

function renderHistoryList(history) {
  if (!history || history.length === 0) {
    els.histList.innerHTML = '<div class="h-empty">No transactions yet</div>';
    return;
  }
  const items = [...history]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map(
      (h) => `
      <div class="h-item">
        <div class="h-left">
          <span class="h-date">${fmtDate(h.date)}</span>
          <span>${esc(h.reason || 'Transaction')}</span>
        </div>
        <span class="h-badge ${h.type === 'gained' ? 'gained' : 'used'}">
          ${h.type === 'gained' ? '+' : '−'}${h.amount}
        </span>
      </div>
    `
    )
    .join('');
  els.histList.innerHTML = items;
}

function saveField(accountId, field, raw) {
  const acc = findAccount(accountId);
  if (!acc) return;
  let val = raw;
  if (field === 'balance' || field === 'pending' || field === 'expiringAmount') {
    val = Math.max(0, parseInt(raw, 10) || 0);
  }
  if (acc[field] === val) return;
  mutate(accountId, { [field]: val }, entry('gained', 0, `${field} updated`));
}

/* ===== Quick log modal (+ / −) ===== */
function openQuickModal(acc, presetType) {
  els.quickTitle.textContent = `Log Coins • ${esc(acc.alias || '#' + acc.id)}`;
  els.quickType.textContent = presetType === 'gained' ? 'Gained' : 'Used';
  els.quickType.classList.toggle('used', presetType === 'used');
  els.quickAmount.value = '';
  els.quickReason.value = '';
  openBackdrop(els.backdropQuick);
}

function doQuickSave() {
  const id = state.editingId;
  const acc = findAccount(id);
  const type = els.quickType.textContent.trim() === 'Gained' ? 'gained' : 'used';
  if (!acc) return;
  const amt = Math.max(0, parseInt(els.quickAmount.value, 10) || 0);
  if (amt === 0) {
    toast('Enter an amount');
    return;
  }
  const reason = esc(els.quickReason.value.trim()) || (type === 'gained' ? 'Coins gained' : 'Coins used');
  const updates = type === 'gained' ? { balance: (acc.balance || 0) + amt } : { balance: Math.max(0, (acc.balance || 0) - amt) };
  mutate(id, updates, entry(type, amt, reason));
  closeBackdrop(els.backdropQuick);
}

/* ===== Vault Directory modal ===== */
function openVaultDir() {
  const rows = state.accounts
    .map(
      (a) => `
      <tr>
        <td class="row-id">#${a.id}</td>
        <td class="row-name">${esc(a.alias || '—')}</td>
        <td class="row-val tabular">${a.balance}</td>
        <td class="row-val tabular">+${a.pending}</td>
        <td>
          <span class="gosats-pill tappable ${a.gosatsStatus === 'Active' ? 'active' : 'inactive'}" style="font-size:11px;padding:3px 8px" data-id="${a.id}" data-action="toggle-gosats">
            <span class="dot" style="background:${a.gosatsStatus === 'Active' ? 'var(--green)' : 'var(--red)'}"></span>
            ${a.gosatsStatus === 'Active' ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td class="row-mono">${esc(a.phoneDevice || '—')}</td>
        <td class="row-mono">${esc(a.phoneNumber || '—')}</td>
        <td class="row-mono">${esc(a.panHolder || '—')}</td>
        <td class="row-mono">${esc(a.notes || '—')}</td>
      </tr>
    `
    )
    .join('');
  els.dirTable.innerHTML = `
    <table class="directory">
      <thead>
        <tr>
          <th>#</th><th>Account</th><th>Active</th><th>Coming</th><th>GoSats</th><th>Phone / Device</th><th>Mobile Number</th><th>PAN Holder</th><th>Notes</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  els.dirTable.querySelectorAll('tr').forEach((tr) => {
    tr.dataset.id = tr.children[0].textContent.replace('#', '');
    tr.onclick = () => openAccountModal(Number(tr.dataset.id));
  });
  // wire toggles in table
  els.dirTable.querySelectorAll('[data-action="toggle-gosats"]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = Number(b.dataset.id);
      const acc = findAccount(id);
      const next = acc.gosatsStatus === 'Active' ? 'Inactive' : 'Active';
      mutate(id, { gosatsStatus: next }, entry('gained', 0, `GoSats ${next}`));
      openVaultDir(); // refresh
    };
  });
  openBackdrop(els.backdropDir);
}

/* ===== Activity Log modal ===== */
function openActivityLog() {
  const all = state.accounts.flatMap((a) =>
    (a.history || []).map((h) => ({ ...h, alias: a.alias, id: a.id }))
  );
  all.sort((x, y) => new Date(y.date) - new Date(x.date));
  if (all.length === 0) {
    els.logList.innerHTML = '<div class="h-empty">No activity yet</div>';
  } else {
    els.logList.innerHTML = all
      .map(
        (h) => `
        <div class="h-item">
          <div class="h-left">
            <span class="h-date">${fmtDate(h.date)}</span>
            <span style="font-weight:700">${esc(h.alias || '#' + h.id)}</span>
            <span>${esc(h.reason || 'Transaction')}</span>
          </div>
          <span class="h-badge ${h.type === 'gained' ? 'gained' : 'used'}">
            ${h.type === 'gained' ? '+' : '−'}${h.amount}
          </span>
        </div>
      `
      )
      .join('');
  }
  openBackdrop(els.backdropLog);
}

/* ===== Backup / Restore modal ===== */
function renderBackup() {
  const bundle = { accounts: cloneDeep(state.accounts), settings: {} };
  els.taJson.value = JSON.stringify(bundle, null, 2);
  els.backupStatus.textContent = '';
  getMeta('settings').then((s) => {
    if (s && s.geminiKey) els.inGemini.value = s.geminiKey;
  });
}

function toast(msg, ms = 2400) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  setTimeout(() => els.toast.classList.remove('show'), ms);
}

/* ------------------------------------------------------------------ */
/* Bindings                                                           */
/* ------------------------------------------------------------------ */
function bindAll() {
  /* Top bar */
  document.getElementById('btnHideNames').onclick = () => {
    state.hideNames = !state.hideNames;
    document.getElementById('btnHideNames').classList.toggle('active', state.hideNames);
    renderGrid();
  };
  document.getElementById('btnActivity').onclick = openActivityLog;
  document.getElementById('btnVault').onclick = openVaultDir;
  document.getElementById('btnBackup').onclick = () => {
    renderBackup();
    openBackdrop(els.backdropBackup);
  };

  /* Command bar */
  document.getElementById('cmdSend').onclick = runCommand;
  els.cmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runCommand();
  });
  els.cmdUndo.onclick = doUndo;

  /* Account modal */
  document.getElementById('btnCloseAcct').onclick = () => closeBackdrop(els.backdropAcct);
  document.getElementById('btnCloseDir').onclick = () => closeBackdrop(els.backdropDir);
  document.getElementById('btnCloseBackup').onclick = () => closeBackdrop(els.backdropBackup);
  document.getElementById('btnCloseLog').onclick = () => closeBackdrop(els.backdropLog);
  document.getElementById('btnCloseQuick').onclick = () => closeBackdrop(els.backdropQuick);

  els.backdropAcct.onclick = (e) => {
    if (e.target === els.backdropAcct) closeBackdrop(els.backdropAcct);
    if (e.target.id === 'swGosats' || e.target.closest('#swGosats')) {
      const acc = findAccount(state.editingId);
      if (!acc) return;
      const next = acc.gosatsStatus === 'Active' ? 'Inactive' : 'Active';
      mutate(state.editingId, { gosatsStatus: next }, entry('gained', 0, `GoSats ${next}`));
      renderAcctPanels(findAccount(state.editingId));
      renderAll();
    }
  };
  els.backdropDir.onclick = (e) => { if (e.target === els.backdropDir) closeBackdrop(els.backdropDir); };
  els.backdropBackup.onclick = (e) => { if (e.target === els.backdropBackup) closeBackdrop(els.backdropBackup); };
  els.backdropLog.onclick = (e) => { if (e.target === els.backdropLog) closeBackdrop(els.backdropLog); };
  els.backdropQuick.onclick = (e) => { if (e.target === els.backdropQuick) closeBackdrop(els.backdropQuick); };

  /* Footer "Done" buttons close their modals */
  document.getElementById('btnSaveAcct').onclick = () => closeBackdrop(els.backdropAcct);
  document.getElementById('btnCloseDirB').onclick = () => closeBackdrop(els.backdropDir);
  document.getElementById('btnCloseBackupB').onclick = () => closeBackdrop(els.backdropBackup);
  document.getElementById('btnCloseLogB').onclick = () => closeBackdrop(els.backdropLog);

  /* Tabs */
  els.tabVault.onclick = () => switchAcctTab('vault');
  els.tabCoins.onclick = () => switchAcctTab('coins');
  els.tabHistory.onclick = () => switchAcctTab('history');

  function switchAcctTab(name) {
    els.tabVault.classList.toggle('active', name === 'vault');
    els.tabCoins.classList.toggle('active', name === 'coins');
    els.tabHistory.classList.toggle('active', name === 'history');
    els.panelVault.classList.toggle('hidden', name !== 'vault');
    els.panelCoins.classList.toggle('hidden', name !== 'coins');
    els.panelHistory.classList.toggle('hidden', name !== 'history');
  }

  /* Tab 1 fields */
  document.getElementById('inAlias').onchange = () =>
    saveField(state.editingId, 'alias', document.getElementById('inAlias').value);
  document.getElementById('inPhoneDevice').onchange = () =>
    saveField(state.editingId, 'phoneDevice', document.getElementById('inPhoneDevice').value);
  document.getElementById('inPhoneNumber').onchange = () =>
    saveField(state.editingId, 'phoneNumber', document.getElementById('inPhoneNumber').value);
  document.getElementById('inPanHolder').onchange = () =>
    saveField(state.editingId, 'panHolder', document.getElementById('inPanHolder').value);
  document.getElementById('inNotes').onchange = () =>
    saveField(state.editingId, 'notes', document.getElementById('inNotes').value);

  // GoSats switch in modal
  els.backdropAcct.onclick = (e) => {
    if (e.target.id === 'swGosats' || e.target.closest('#swGosats')) {
      const acc = findAccount(state.editingId);
      if (!acc) return;
      const next = acc.gosatsStatus === 'Active' ? 'Inactive' : 'Active';
      mutate(state.editingId, { gosatsStatus: next }, entry('gained', 0, `GoSats ${next}`));
      renderAcctPanels(findAccount(state.editingId));
      renderAll();
    }
  };

  /* Add / delete account */
  document.getElementById('btnAddAcct').onclick = () => {
    const id = nextId();
    const newAcc = {
      id,
      alias: 'New Account',
      balance: 0,
      pending: 0,
      expiringAmount: 0,
      expiryDate: '',
      shopsyDays: 0,
      phoneDevice: '',
      phoneNumber: '',
      gosatsStatus: 'Inactive',
      panHolder: '',
      notes: '',
      history: [],
    };
    state.accounts.push(newAcc);
    persist().then(() => {
      renderAll();
      openAccountModal(id);
    });
  };
  document.getElementById('btnDelAcct').onclick = () => {
    if (!confirm('Delete this account and its history?')) return;
    state.accounts = state.accounts.filter((a) => a.id !== state.editingId);
    persist().then(() => {
      closeBackdrop(els.backdropAcct);
      renderAll();
      toast('Account deleted');
    });
  };

  /* Quick save */
  document.getElementById('btnQuickSave').onclick = doQuickSave;

  /* Quick type toggle */
  document.getElementById('btnToggleQuickType').onclick = () => {
    const b = els.quickType;
    b.textContent = b.textContent === 'Gained' ? 'Used' : 'Gained';
    b.classList.toggle('used', b.textContent === 'Used');
  };

  /* History add (tab 3) */
  document.getElementById('btnAddHist').onclick = () => {
    const id = state.editingId;
    const acc = findAccount(id);
    if (!acc) return;
    const amt = Math.max(0, parseInt(els.inHistAmount.value, 10) || 0);
    if (amt === 0) return toast('Enter an amount');
    const type = els.btnHistType.textContent.trim() === 'Gained' ? 'gained' : 'used';
    const updates =
      type === 'gained' ? { balance: (acc.balance || 0) + amt } : { balance: Math.max(0, (acc.balance || 0) - amt) };
    mutate(id, updates, entry(type, amt, esc(els.inHistReason.value.trim()) || 'Manual entry'));
    els.inHistAmount.value = '';
    els.inHistReason.value = '';
  };
  document.getElementById('btnToggleHistType').onclick = () => {
    const b = els.btnHistType;
    b.textContent = b.textContent.trim() === 'Gained' ? 'Used' : 'Gained';
    b.classList.toggle('used', b.textContent.trim() === 'Used');
  };

  /* Backup / Restore */
  document.getElementById('btnCopyJson').onclick = () => {
    navigator.clipboard
      .writeText(els.taJson.value)
      .then(() => toast('JSON copied to clipboard'))
      .catch(() => toast('Copy failed'));
  };
  document.getElementById('btnExportJson').onclick = () => {
    const blob = new Blob([els.taJson.value], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supercoin-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup exported');
  };
  els.fileImport.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const bundle = JSON.parse(ev.target.result);
        importBundle(bundle).then((accounts) => {
          state.accounts = accounts;
          renderAll();
          closeBackdrop(els.backdropBackup);
          toast('Backup restored');
        });
      } catch (err) {
        els.backupStatus.textContent = 'Invalid backup file';
        els.backupStatus.className = 'status err';
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  document.getElementById('btnPasteRestore').onclick = () => {
    try {
      const bundle = JSON.parse(els.taJson.value);
      importBundle(bundle).then((accounts) => {
        state.accounts = accounts;
        renderAll();
        closeBackdrop(els.backdropBackup);
        toast('Paste restore complete');
      });
    } catch (err) {
      els.backupStatus.textContent = 'Invalid JSON in editor';
      els.backupStatus.className = 'status err';
    }
  };

  /* Gemini API key (optional, stored locally; parser stays offline) */
  document.getElementById('btnGeminiSave').onclick = () => {
    setMeta('settings', { geminiKey: els.inGemini.value.trim() }).then(() =>
      toast('Gemini key saved locally')
    );
  };

  /* Grid clicks (delegated, attached once) */
  els.grid.addEventListener('click', onGridClick);

  /* Sort segments */
  document.querySelectorAll('.seg').forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll('.seg').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      state.sort = b.dataset.sort;
      renderGrid();
    };
  });
}

/* ------------------------------------------------------------------ */
/* Natural language command                                           */
/* ------------------------------------------------------------------ */
function runCommand() {
  const text = els.cmdInput.value.trim();
  if (!text) return;
  const result = parseCommand(text, state.accounts);
  els.cmdInput.value = '';

  if (result.error) {
    toast(result.error);
    return;
  }

  const acc = findAccount(result.accountId);
  if (!acc) {
    toast('Account not found');
    return;
  }

  const updates = {};
  if (result.updates.balance != null) updates.balance = result.updates.balance;
  if (result.updates.pending != null) updates.pending = result.updates.pending;
  if (result.updates.shopsyDays != null) updates.shopsyDays = result.updates.shopsyDays;
  if (result.updates.gosatsStatus != null) updates.gosatsStatus = result.updates.gosatsStatus;
  if (result.updates.notes != null) updates.notes = result.updates.notes;

  let historyEntry = null;
  if (result.history) {
    const h = { ...result.history };
    if (h.amount) h.reason = `${h.reason} — "${text}"`;
    historyEntry = h;
  }

  mutate(result.accountId, updates, historyEntry);
  toast(`Updated ${esc(acc.alias || '#' + acc.id)}`);
}

/* ------------------------------------------------------------------ */
/* Start                                                              */
/* ------------------------------------------------------------------ */
init();
