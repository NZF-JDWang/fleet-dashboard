// BlacksiteLab Fleet Command — Agent Detail Panel v2
// Per-agent page: session history, direct message, AgentMail inbox, SOUL, tasks, jobs

const AgentDetail = {
  agentId: null,
  inboxThreads: [],
  _pollTimer: null,

  init(agentId) {
    this.agentId = agentId;
    const agent = AGENTS_BY_ID[agentId];
    if (!agent) { this.renderNotFound(); return; }
    this.render(agent);
    this.loadSoul(agentId);
    this.loadSessions(agentId);
    this.loadJobs(agentId);
    this.bindChat(agentId);
    this.loadInbox(agentId);
    // Poll inbox every 30s
    this._pollTimer = setInterval(() => this.loadInbox(agentId), 30000);
  },

  destroy() {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
  },

  render(agent) {
    const container = document.getElementById('agentDetailContent');
    const state = State.agents[agent.id] || { status: 'unknown', latency: 0 };
    const statusLabel = state.status === 'online' ? 'Online' : state.status === 'busy' ? 'Busy' : state.status === 'offline' ? 'Offline' : 'Unknown';
    const statusClass = state.status || 'unknown';

    // AgentMail email address
    const email = `${agent.id}.blacksitelab@agentmail.to`;

    container.innerHTML = `
      <div class="agent-detail">
        <!-- Header -->
        <div class="ad-header">
          <div class="ad-avatar" style="background:${agent.color}">${agent.avatar}</div>
          <div class="ad-meta">
            <div class="ad-name" style="color:${agent.color}">${agent.name}</div>
            <div class="ad-role">${agent.role}</div>
            <div class="ad-status">
              <span class="card-status-dot ${statusClass}"></span>
              ${statusLabel} ${state.latency ? `· ${state.latency}ms` : ''}
            </div>
          </div>
          <div class="ad-signals">
            <div class="ad-signal-count">${this._signalCount(agent.id)}</div>
            <div class="ad-signal-label">signals today</div>
          </div>
        </div>

        <!-- SOUL.md preview -->
        <div class="panel ad-section">
          <div class="panel-header"><span class="panel-title">SOUL</span></div>
          <div class="ad-soul" id="adSoul">Loading SOUL.md...</div>
        </div>

        <!-- Active Tasks -->
        <div class="panel ad-section">
          <div class="panel-header"><span class="panel-title">Active Tasks</span></div>
          <div class="ad-tasks" id="adTasks">${this._renderTasks(agent.id)}</div>
        </div>

        <!-- Inbox (AgentMail) -->
        <div class="panel ad-section">
          <div class="panel-header">
            <span class="panel-title">📬 Inbox</span>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="ad-inbox-address" title="AgentMail address">${email}</span>
              <button class="btn btn-outline btn-sm" id="adInboxRefresh" onclick="AgentDetail.loadInbox('${agent.id}')">↻ Refresh</button>
              <button class="btn btn-outline btn-sm" id="adInboxCompose" onclick="AgentDetail.showCompose()">✉ Compose</button>
            </div>
          </div>
          <div class="ad-inbox" id="adInbox">
            <div class="ad-placeholder">Loading inbox...</div>
          </div>
        </div>

        <!-- Sessions -->
        <div class="panel ad-section">
          <div class="panel-header"><span class="panel-title">Recent Sessions</span></div>
          <div class="ad-sessions" id="adSessions">
            <div class="ad-placeholder">Loading sessions...</div>
          </div>
        </div>

        <!-- Cron Jobs -->
        <div class="panel ad-section">
          <div class="panel-header"><span class="panel-title">Scheduled Jobs</span></div>
          <div class="ad-jobs" id="adJobs">
            <div class="ad-placeholder">Loading jobs...</div>
          </div>
        </div>

        <!-- Direct Message -->
        <div class="panel ad-section">
          <div class="panel-header"><span class="panel-title">Direct Message</span></div>
          <div class="ad-chat" id="adChat">
            <div class="ad-chat-log" id="adChatLog">
              <div class="ad-chat-msg system">Send a message to ${agent.name}. Responses will appear here.</div>
            </div>
            <div class="ad-chat-input-row">
              <textarea id="adChatInput" placeholder="Message ${agent.name}..." rows="2"></textarea>
              <button class="btn btn-primary" id="adChatSendBtn" onclick="AgentDetail.sendMessage()">Send</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Compose Modal -->
      <div class="modal" id="adComposeModal">
        <div class="modal-backdrop" id="adComposeBackdrop"></div>
        <div class="modal-panel">
          <h3>Compose Email</h3>
          <div class="form-group"><label>From</label><input type="text" value="${email}" disabled></div>
          <div class="form-group"><label>To</label><input type="text" id="adComposeTo" placeholder="recipient@example.com"></div>
          <div class="form-group"><label>Subject</label><input type="text" id="adComposeSubject" placeholder="Subject..."></div>
          <div class="form-group"><label>Body</label><textarea id="adComposeBody" rows="5" placeholder="Message..."></textarea></div>
          <div class="modal-actions">
            <button class="btn btn-primary" id="adComposeSend" onclick="AgentDetail.sendEmail()">Send</button>
            <button class="btn btn-outline" id="adComposeCancel" onclick="AgentDetail.closeCompose()">Cancel</button>
          </div>
        </div>
      </div>
    `;

    this.loadSoul(agent.id);
  },

  renderNotFound() {
    document.getElementById('agentDetailContent').innerHTML = `
      <div class="ad-not-found">
        <h2>Agent Not Found</h2>
        <p>No agent with ID "${this.agentId}" in the fleet.</p>
      </div>`;
  },

  // ===== SOUL =====
  async loadSoul(agentId) {
    try {
      const res = await ApiClient._fetch(agentId, '/soul');
      const el = document.getElementById('adSoul');
      if (el && res.ok) {
        el.textContent = typeof res.data === 'string' ? res.data.slice(0, 1200) : JSON.stringify(res.data).slice(0, 1200);
      } else if (el) {
        el.innerHTML = `<span class="ad-placeholder">SOUL unavailable</span>`;
      }
    } catch {
      const el = document.getElementById('adSoul');
      if (el) el.innerHTML = `<span class="ad-placeholder">SOUL unavailable</span>`;
    }
  },

  // ===== AGENTMAIL INBOX =====
  async loadInbox(agentId) {
    const inboxEl = document.getElementById('adInbox');
    if (!inboxEl) return;
    inboxEl.innerHTML = '<div class="ad-inbox-loading"><div class="spinner"></div> Checking inbox...</div>';

    try {
      // Try the agent's inbox endpoint
      const res = await ApiClient._fetch(agentId, '/inbox');
      if (res.ok && res.data) {
        this.inboxThreads = res.data.threads || res.data || [];
        this.renderInbox();
        this.updateInboxBadge();
        return;
      }
    } catch {
      // AgentMail bridge not available
    }

    // Demo fallback
    this.inboxThreads = [
      { id: 'thr_001', subject: 'Re: Fleet dashboard proposal', from: 'kris@blacksitelab.dev', snippet: 'Great work on the dashboard. A few thoughts...', time: '10 min ago', unread: true },
      { id: 'thr_002', subject: 'Build system update needed', from: 'ci@blacksitelab.dev', snippet: 'The CI pipeline needs a config update for the new container...', time: '1 hour ago', unread: false },
      { id: 'thr_003', subject: 'Weekly fleet status', from: 'claire@blacksitelab.dev', snippet: 'Summary of this week\'s fleet activity and upcoming priorities...', time: '3 hours ago', unread: false },
    ];
    this.renderInbox();
    this.updateInboxBadge();
  },

  renderInbox() {
    const inboxEl = document.getElementById('adInbox');
    if (!inboxEl) return;

    if (this.inboxThreads.length === 0) {
      inboxEl.innerHTML = '<div class="ad-placeholder">Inbox empty</div>';
      return;
    }

    inboxEl.innerHTML = this.inboxThreads.map(t => `
      <div class="ad-inbox-thread ${t.unread ? 'unread' : ''}" onclick="AgentDetail.openThread('${t.id}')">
        <div class="ad-inbox-thread-header">
          <span class="ad-inbox-from">${escHtml(t.from)}</span>
          <span class="ad-inbox-time">${t.time}</span>
        </div>
        <div class="ad-inbox-subject">${t.unread ? '<span class="ad-inbox-dot"></span>' : ''}${escHtml(t.subject)}</div>
        <div class="ad-inbox-snippet">${escHtml(t.snippet)}</div>
      </div>
    `).join('');
  },

  updateInboxBadge() {
    const badge = document.getElementById('adInboxBadge');
    if (!badge) return;
    const unread = this.inboxThreads.filter(t => t.unread).length;
    badge.textContent = unread > 0 ? `${unread} unread` : 'no unread';
    badge.style.background = unread > 0 ? 'var(--accent)' : 'transparent';
  },

  openThread(threadId) {
    this.showToast(`Thread ${threadId}: full view requires AgentMail API bridge`);
  },

  // ===== COMPOSE =====
  showCompose() {
    document.getElementById('adComposeModal').classList.add('open');
    document.getElementById('adComposeBackdrop').addEventListener('click', () => this.closeCompose());
  },

  closeCompose() {
    document.getElementById('adComposeModal').classList.remove('open');
  },

  async sendEmail() {
    const to = document.getElementById('adComposeTo').value.trim();
    const subject = document.getElementById('adComposeSubject').value.trim();
    const body = document.getElementById('adComposeBody').value.trim();
    if (!to || !subject) { this.showToast('To and Subject are required'); return; }

    try {
      const res = await ApiClient._fetch(this.agentId, '/inbox/send', {
        method: 'POST',
        body: JSON.stringify({ to, subject, text: body }),
      });
      if (res.ok) {
        this.closeCompose();
        this.showToast('Email sent ✓');
        this.loadInbox(this.agentId);
        return;
      }
    } catch {
      // Bridge unavailable
    }

    this.closeCompose();
    this.showToast('Email queued (AgentMail bridge unavailable)');
    this.inboxThreads.unshift({
      id: 'sent-' + Date.now(),
      subject: `Re: ${subject}`,
      from: 'sent',
      snippet: body.slice(0, 80) + '...',
      time: 'just now',
      unread: false,
    });
    this.renderInbox();
  },

  // ===== SESSIONS =====
  async loadSessions(agentId) {
    try {
      const data = await ApiClient.listRuns(agentId, 10);
      const el = document.getElementById('adSessions');
      if (!el) return;
      const runs = data?.data || data?.runs || [];
      if (runs.length === 0) {
        el.innerHTML = `<div class="ad-placeholder">No recent sessions</div>`;
        return;
      }
      el.innerHTML = runs.slice(0, 10).map(r => `
        <div class="ad-session-row">
          <span class="ad-session-id">${(r.id || r.run_id || '--').slice(0, 8)}</span>
          <span class="ad-session-status ${r.status || 'unknown'}">${r.status || '--'}</span>
          <span class="ad-session-time">${r.created_at ? new Date(r.created_at).toLocaleString() : '--'}</span>
          ${r.model ? `<span class="ad-session-model">${r.model}</span>` : ''}
        </div>
      `).join('');
    } catch {
      const el = document.getElementById('adSessions');
      if (el) el.innerHTML = `<div class="ad-placeholder">Could not load sessions</div>`;
    }
  },

  // ===== JOBS =====
  async loadJobs(agentId) {
    try {
      const data = await ApiClient.listJobs(agentId);
      const el = document.getElementById('adJobs');
      if (!el) return;
      const jobs = data?.data || data?.jobs || [];
      if (jobs.length === 0) {
        el.innerHTML = `<div class="ad-placeholder">No scheduled jobs</div>`;
        return;
      }
      el.innerHTML = jobs.map(j => `
        <div class="ad-job-row">
          <span class="ad-job-name">${escHtml(j.name || j.job_id || 'job')}</span>
          <span class="ad-job-schedule">${j.schedule || '--'}</span>
          <span class="ad-job-status ${j.status || 'active'}">${j.status || 'active'}</span>
        </div>
      `).join('');
    } catch {
      const el = document.getElementById('adJobs');
      if (el) el.innerHTML = `<div class="ad-placeholder">Could not load jobs</div>`;
    }
  },

  // ===== CHAT =====
  bindChat(agentId) {
    const input = document.getElementById('adChatInput');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }
  },

  async sendMessage() {
    const input = document.getElementById('adChatInput');
    const log = document.getElementById('adChatLog');
    if (!input || !log) return;
    const text = input.value.trim();
    if (!text) return;

    const agent = AGENTS_BY_ID[this.agentId];
    if (!agent) return;

    // User message
    log.innerHTML += `<div class="ad-chat-msg user"><span class="ad-chat-sender">You</span> ${escHtml(text)}</div>`;
    input.value = '';
    log.scrollTop = log.scrollHeight;

    // Loading placeholder
    const loadId = 'load-' + Date.now();
    log.innerHTML += `<div class="ad-chat-msg loading" id="${loadId}"><span class="ad-chat-sender" style="color:${agent.color}">${agent.name}</span> <div class="spinner" style="width:12px;height:12px;display:inline-block"></div></div>`;
    log.scrollTop = log.scrollHeight;

    const result = await ApiClient.sendChat(this.agentId, [
      { role: 'user', content: text }
    ]);

    const loadEl = document.getElementById(loadId);
    if (loadEl) loadEl.remove();

    if (result.status === 'ok') {
      log.innerHTML += `<div class="ad-chat-msg agent"><span class="ad-chat-sender" style="color:${agent.color}">${agent.name}</span> ${escHtml(result.content)} · <span class="ad-chat-latency">${result.latency}ms</span></div>`;
    } else {
      log.innerHTML += `<div class="ad-chat-msg error"><span class="ad-chat-sender" style="color:${agent.color}">${agent.name}</span> Error: ${escHtml(result.error || 'No response')}</div>`;
    }
    log.scrollTop = log.scrollHeight;
  },

  // ===== HELPERS =====
  _signalCount(agentId) {
    return State.signals.filter(s => s.agent === agentId).length;
  },

  _renderTasks(agentId) {
    const tasks = State.tasks.filter(t => t.assignee === agentId && t.column !== 'done');
    if (tasks.length === 0) return `<div class="ad-placeholder">No active tasks</div>`;
    return tasks.map(t => `
      <div class="ad-task-row">
        <span class="kanban-col-header" style="--accent:${t.column === 'in-progress' ? '#f59e0b' : t.column === 'review' ? '#06b6d4' : '#8a8f98'}">${t.column}</span>
        <span class="ad-task-title">${escHtml(t.title)}</span>
        <span class="kc-priority ${t.priority}">${t.priority}</span>
      </div>
    `).join('');
  },

  showToast(msg) {
    let toast = document.getElementById('adToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'adToast';
      toast.style.cssText = 'position:fixed;bottom:60px;right:20px;background:var(--bg-elevated);color:var(--text-primary);padding:10px 18px;border-radius:8px;font-size:13px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.5);transition:opacity 0.3s;pointer-events:none;';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
  },
};
