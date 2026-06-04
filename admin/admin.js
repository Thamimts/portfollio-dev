/*
  Admin Dashboard JS
  - Fetches messages from GET /api/messages
  - Renders statistics, table, filters, search, sorting
  - Shows loading, error, and empty states
  - Opens a modal for full message details
  - Deletes single messages via DELETE /api/messages/:id

  This file intentionally uses only vanilla JS (no frameworks).
*/

document.addEventListener('DOMContentLoaded', () => {
  const apiBaseUrl = window.location.origin;

  // ---------------------- State & Elements ----------------------
  const state = {
    messages: [],
    loading: false,
    error: '',
    search: '',
    filter: 'all',
    sort: 'newest',
    active: null,
  };

  const el = (id) => document.getElementById(id);

  const elements = {
    loadingState: el('loadingState'),
    errorState: el('errorState'),
    errorMessage: el('errorMessage'),
    emptyState: el('emptyState'),
    tableBody: el('messagesTableBody'),
    resultsCount: el('resultsCount'),
    totalMessages: el('totalMessages'),
    messagesThisWeek: el('messagesThisWeek'),
    messagesThisMonth: el('messagesThisMonth'),
    latestMessageDate: el('latestMessageDate'),
    analyticsTotalContacts: el('analyticsTotalContacts'),
    analyticsContactsPerMonth: el('analyticsContactsPerMonth'),
    analyticsRecentActivity: el('analyticsRecentActivity'),
    analyticsMostActiveMonth: el('analyticsMostActiveMonth'),
    searchInput: el('searchInput'),
    timeFilter: el('timeFilter'),
    sortOrder: el('sortOrder'),
    refreshBtn: el('refreshBtn'),
    retryBtn: el('retryBtn'),
    messageModal: el('messageModal'),
    closeModalBtn: el('closeModalBtn'),
    closeModalSecondaryBtn: el('closeModalSecondaryBtn'),
    deleteFromModalBtn: el('deleteFromModalBtn'),
    detailName: el('detailName'),
    detailEmail: el('detailEmail'),
    detailDate: el('detailDate'),
    detailId: el('detailId'),
    detailMessage: el('detailMessage'),
  };

  // Date helpers
  const parseDate = (value) => {
    if (!value) return new Date(0);
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? new Date(0) : d;
  };

  const startOfDay = (d) => { const c = new Date(d); c.setHours(0,0,0,0); return c; };
  const startOfWeek = (d) => { const c = startOfDay(d); const day = c.getDay(); const offset = (day + 6) % 7; c.setDate(c.getDate() - offset); return c; };
  const startOfMonth = (d) => { const c = new Date(d); c.setDate(1); c.setHours(0,0,0,0); return c; };

  const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

  // ---------------------- UI Helpers ----------------------
  const setLoading = (v) => {
    state.loading = v;
    if (elements.loadingState) elements.loadingState.hidden = !v;
  };

  const setError = (msg) => {
    state.error = msg || '';
    if (elements.errorMessage) elements.errorMessage.textContent = state.error;
    if (elements.errorState) elements.errorState.hidden = !state.error;
  };

  const setEmpty = (isEmpty) => { if (elements.emptyState) elements.emptyState.hidden = !isEmpty; };
  const setResultsCount = (n) => { if (elements.resultsCount) elements.resultsCount.textContent = `${n} result${n===1?'':'s'}`; };

  // ---------------------- Data & Rendering ----------------------
  const computeStats = (messages) => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);
    const total = messages.length;
    const thisWeek = messages.filter(m => parseDate(m.createdAt) >= weekStart).length;
    const thisMonth = messages.filter(m => parseDate(m.createdAt) >= monthStart).length;
    const latest = messages[0] ? parseDate(messages[0].createdAt) : null;

    // monthly counts for analytics
    const monthlyCounts = new Map();
    messages.forEach((m) => {
      const d = parseDate(m.createdAt);
      if (!d.getTime()) return;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const cur = monthlyCounts.get(key) || { label: monthFormatter.format(d), count: 0 };
      cur.count += 1;
      monthlyCounts.set(key, cur);
    });

    let mostActive = '—'; let highest = 0;
    monthlyCounts.forEach((v) => { if (v.count > highest) { highest = v.count; mostActive = `${v.label} (${v.count})`; } });

    return {
      total,
      thisWeek,
      thisMonth,
      latest,
      analytics: { total, perMonth: thisMonth, recent: latest, mostActive }
    };
  };

  const getMessageId = (m) => String(m?._id || m?.id || m?.createdAt || Math.random());

  const renderStats = (messages) => {
    const s = computeStats(messages);
    if (elements.totalMessages) elements.totalMessages.textContent = String(s.total);
    if (elements.messagesThisWeek) elements.messagesThisWeek.textContent = String(s.thisWeek);
    if (elements.messagesThisMonth) elements.messagesThisMonth.textContent = String(s.thisMonth);
    if (elements.latestMessageDate) elements.latestMessageDate.textContent = s.latest ? dateFormatter.format(s.latest) : '—';

    if (elements.analyticsTotalContacts) elements.analyticsTotalContacts.textContent = String(s.analytics.total);
    if (elements.analyticsContactsPerMonth) elements.analyticsContactsPerMonth.textContent = String(s.analytics.perMonth);
    if (elements.analyticsRecentActivity) elements.analyticsRecentActivity.textContent = s.analytics.recent ? dayFormatter.format(s.analytics.recent) : '—';
    if (elements.analyticsMostActiveMonth) elements.analyticsMostActiveMonth.textContent = s.analytics.mostActive;
  };

  const escapeHtml = (str) => String(str || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'", '&#39;');

  const getStatusFor = (m) => {
    const created = parseDate(m.createdAt);
    const diffHours = Math.abs(new Date() - created) / (1000*60*60);
    if (diffHours <= 24) return { label: 'New', className: 'status-new' };
    if (diffHours <= 168) return { label: 'Recent', className: 'status-recent' };
    return { label: 'Older', className: 'status-older' };
  };

  const sortMessages = (arr, order) => arr.slice().sort((a,b)=>{
    const ta = parseDate(a.createdAt).getTime();
    const tb = parseDate(b.createdAt).getTime();
    return order === 'oldest' ? ta - tb : tb - ta;
  });

  const filterAndSearch = () => {
    const term = state.search.trim().toLowerCase();
    const now = new Date();
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);

    let out = state.messages.filter(m => {
      if (term) {
        const hay = [m.name, m.email, m.message].join(' ').toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (state.filter === 'today') return parseDate(m.createdAt) >= startOfDay(now);
      if (state.filter === 'week') return parseDate(m.createdAt) >= weekStart;
      if (state.filter === 'month') return parseDate(m.createdAt) >= monthStart;
      return true;
    });

    return sortMessages(out, state.sort);
  };

  const renderTable = () => {
    const rows = filterAndSearch();
    setResultsCount(rows.length);
    renderStats(state.messages);
    setEmpty(rows.length === 0 && !state.loading && !state.error);

    if (!elements.tableBody) return;
    if (state.loading || state.error) { elements.tableBody.innerHTML = ''; return; }

    elements.tableBody.innerHTML = rows.map((m, i) => {
      const id = escapeHtml(getMessageId(m));
      const status = getStatusFor(m);
      const date = dateFormatter.format(parseDate(m.createdAt));
      return `
        <tr data-message-id="${id}">
          <td>${i+1}</td>
          <td><div class="message-meta"><strong>${escapeHtml(m.name||'Unnamed')}</strong><span>${id}</span></div></td>
          <td>${escapeHtml(m.email||'—')}</td>
          <td class="message-snippet">${escapeHtml((m.message||'').slice(0,110))}${String(m.message||'').length>110?'…':''}</td>
          <td>${date}</td>
          <td><span class="status-pill ${status.className}">${status.label}</span></td>
          <td>
            <div class="row-actions">
              <button class="action-chip view-btn" data-action="view" data-message-id="${id}">View</button>
              <button class="action-chip delete" data-action="delete" data-message-id="${id}">Delete</button>
            </div>
          </td>
        </tr>`;
    }).join('');
  };

  // ---------------------- Fetching ----------------------
  const fetchMessages = async () => {
    setError('');
    setLoading(true);
    try {
      const url = new URL('/api/messages', apiBaseUrl);
      url.searchParams.set('_', Date.now().toString());

      const resp = await fetch(url.toString(), {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
        },
      });

      if (resp.status === 304) {
        throw new Error('The API returned 304 Not Modified. Refresh the page after the cache fix or clear the browser cache.');
      }

      const text = await resp.text();
      const data = text ? JSON.parse(text) : [];
      if (!resp.ok) throw new Error(data?.error || 'Failed to load messages');
      state.messages = Array.isArray(data) ? sortMessages(data, 'newest') : [];
    } catch (err) {
      console.error('Fetch messages error:', err && err.message ? err.message : err);
      setError(err.message || 'Failed to fetch messages');
    } finally {
      setLoading(false);
      renderTable();
    }
  };

  // ---------------------- Actions: modal & delete ----------------------
  const openModal = (m) => {
    state.active = m;
    if (!elements.messageModal) return;
    elements.detailName.textContent = m.name || '—';
    elements.detailEmail.textContent = m.email || '—';
    elements.detailDate.textContent = dateFormatter.format(parseDate(m.createdAt));
    elements.detailId.textContent = getMessageId(m);
    elements.detailMessage.textContent = m.message || '—';
    if (typeof elements.messageModal.showModal === 'function') elements.messageModal.showModal(); else elements.messageModal.setAttribute('open','');
  };

  const closeModal = () => {
    state.active = null;
    if (!elements.messageModal) return;
    if (typeof elements.messageModal.close === 'function') elements.messageModal.close(); else elements.messageModal.removeAttribute('open');
  };

  const deleteMessage = async (id) => {
    if (!confirm('Delete this message? This cannot be undone.')) return;
    try {
      const resp = await fetch(`${apiBaseUrl}/api/messages/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const body = await resp.json();
      if (!resp.ok) throw new Error(body.error || 'Delete failed');
      // remove from local state and re-render
      state.messages = state.messages.filter(m => getMessageId(m) !== id);
      renderTable();
      closeModal();
    } catch (err) {
      console.error('Delete failed:', err && err.message ? err.message : err);
      setError(err.message || 'Failed to delete message');
    }
  };

  // ---------------------- Event wiring ----------------------
  elements.searchInput && elements.searchInput.addEventListener('input', (e) => { state.search = e.target.value; renderTable(); });
  elements.timeFilter && elements.timeFilter.addEventListener('change', (e) => { state.filter = e.target.value; renderTable(); });
  elements.sortOrder && elements.sortOrder.addEventListener('change', (e) => { state.sort = e.target.value; renderTable(); });
  elements.refreshBtn && elements.refreshBtn.addEventListener('click', fetchMessages);
  elements.retryBtn && elements.retryBtn.addEventListener('click', fetchMessages);

  // table actions via delegation
  elements.tableBody && elements.tableBody.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.messageId;
    const msg = state.messages.find(m => getMessageId(m) === id);
    if (!msg) return;
    if (btn.dataset.action === 'view') openModal(msg);
    if (btn.dataset.action === 'delete') deleteMessage(id);
  });

  elements.closeModalBtn && elements.closeModalBtn.addEventListener('click', closeModal);
  elements.closeModalSecondaryBtn && elements.closeModalSecondaryBtn.addEventListener('click', closeModal);
  elements.deleteFromModalBtn && elements.deleteFromModalBtn.addEventListener('click', () => { if (state.active) deleteMessage(getMessageId(state.active)); });

  elements.messageModal && elements.messageModal.addEventListener('click', (ev) => { if (ev.target === elements.messageModal) closeModal(); });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && elements.messageModal && elements.messageModal.open) closeModal(); });

  // Initial load
  setLoading(true);
  fetchMessages();
});
