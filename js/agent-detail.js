// BlacksiteLab Fleet Command — Agent Detail Panel
// Per-agent page: session history, direct message, inbox preview

const AgentDetail = {
  agentId: null,

  init(agentId) {
    this.agentId = agentId;
    const agent = AGENTS_BY_ID[agentId];
    if (!agent) { this.renderNotFound(); return; }
    this.render(agent);
    this.loadSessions(agentId);
    this.loadJobs(agentId);
    this.bindChat(agentId);
  },

  render(agent) {
    const container = document.getElementById('agentDetailContent');
    const state = State.agents[agent.id] || { status: 'unknown', latency: 0 };
    const statusLabel = state.status === 'online' ? 'Online' : state.status === 'busy' ? 'Busy' : state.status === 'offline' ? 'Offline' : 'Unknown';
    const statusClass = state.status || 'unknown';

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

        <!-- Inbox (AgentMail widget) -->
        <div class="panel ad-section">
          <div class="panel-header">
            <span class="panel-title">Inbox</span>
            <span class="ad-inbox-badge" id="adInboxBadge">--</span>
          </div>
          <div class="ad-inbox" id="adInbox">
            <div class="ad-placeholder">Inbox requires AgentMail MCP bridge</div>
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
              <textarea id="adChatInput" placeholder="Message ${agent.name}..." rows="2" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();AgentDetail.sendMessage()}"></textarea>
              <button class="btn btn-primary" id="adChatSendBtn" onclick="AgentDetail.sendMessage()">Send</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Load SOUL
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
          <span class="ad-job-name">${esc(j.name || j.job_id || 'job')}</span>
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
    // Enter to send (non-shift)
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
    log.innerHTML += `<div class="ad-chat-msg user"><span class="ad-chat-sender">You</span> ${esc(text)}</div>`;
    input.value = '';
    log.scrollTop = log.scrollHeight;

    // Loading placeholder
    const loadId = 'load-' + Date.now();
    log.innerHTML += `<div class="ad-chat-msg loading" id="${loadId}"><span class="ad-chat-sender" style="color:${agent.color}">${agent.name}</span> <div class="spinner" style="width:12px;height:12px;display:inline-block"></div></div>`;
    log.scrollTop = log.scrollHeight;

    // Send via API
    const result = await ApiClient.sendChat(this.agentId, [
      { role: 'user', content: text }
    ]);

    // Remove loading
    const loadEl = document.getElementById(loadId);
    if (loadEl) loadEl.remove();

    if (result.status === 'ok') {
      log.innerHTML += `<div class="ad-chat-msg agent"><span class="ad-chat-sender" style="color:${agent.color}">${agent.name}</span> ${esc(result.content)} · <span class="ad-chat-latency">${result.latency}ms</span></div>`;
    } else {
      log.innerHTML += `<div class="ad-chat-msg error"><span class="ad-chat-sender" style="color:${agent.color}">${agent.name}</span> Error: ${esc(result.error || 'No response')}</div>`;
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
        <span class="ad-task-title">${esc(t.title)}</span>
        <span class="kc-priority ${t.priority}">${t.priority}</span>
      </div>
    `).join('');
  },
};
