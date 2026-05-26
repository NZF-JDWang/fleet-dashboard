// BlacksiteLab Fleet Command — UI Rendering

const UI = {
  // ===== STATUS BAR =====
  updateStatusBar() {
    const online = State.onlineCount, total = AGENTS.length;
    document.getElementById('statusUpdated').textContent = State.lastUpdated
      ? `Last updated: ${State.lastUpdated.toLocaleTimeString()}`
      : 'Last updated: --';
    document.getElementById('statusSessions').textContent = `Sessions: ${online}/${total}`;
    document.getElementById('statusLatency').textContent = 'API: --ms';

    // Agent mini-dots in status bar
    const row = document.getElementById('statusAgentRow');
    row.innerHTML = AGENTS.map(a => {
      const s = State.agents[a.id];
      const statusClass = s?.status || 'unknown';
      return `<span class="agent-mini"><span class="mini-dot ${statusClass}"></span>${a.name}</span>`;
    }).join('');

    // Fleet pulse
    const dot = document.querySelector('.pulse-dot');
    dot.className = 'pulse-dot ' + (online === total ? 'online' : online > 0 ? 'partial' : 'offline');
    document.getElementById('fleetStatus').textContent = State.fleetStatus;

    // Sidebar status dots
    AGENTS.forEach(a => {
      const dot = document.getElementById(`nav-status-${a.id}`);
      if (dot) {
        const s = State.agents[a.id];
        dot.className = 'nav-agent-status ' + (s?.status || 'unknown');
      }
    });
  },

  // ===== NZT CLOCK =====
  updateClock() {
    const now = new Date();
    // NZT = UTC+12
    const nzt = new Date(now.getTime() + (12 * 60 * 60 * 1000));
    document.getElementById('nztClock').textContent =
      nzt.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' NZT';
  },

  // ===== AGENT CARDS =====
  renderAgentCards() {
    const container = document.getElementById('agentCards');
    container.innerHTML = AGENTS.map(agent => {
      const s = State.agents[agent.id];
      const statusClass = s?.status || 'unknown';
      const statusLabel = statusClass === 'online' ? 'Online' : statusClass === 'busy' ? 'Busy' : statusClass === 'offline' ? 'Offline' : 'Unknown';
      return `
        <div class="agent-card" data-agent="${agent.id}" onclick="App.selectAgent('${agent.id}')">
          <div class="card-top">
            <div class="card-avatar" style="background:${agent.color}">${agent.avatar}</div>
            <div class="card-info">
              <div class="card-name">${agent.name}</div>
              <div class="card-role">${agent.role}</div>
            </div>
          </div>
          <div class="card-status">
            <span class="card-status-dot ${statusClass}"></span>${statusLabel}
          </div>
          <div class="card-task" style="border-left-color:${agent.color}">
            ${s?.task || 'Idle'}
          </div>
        </div>`;
    }).join('');
  },

  // ===== SIGNALS =====
  renderSignals() {
    const list = document.getElementById('signalsList');
    list.innerHTML = State.signals.slice(0, 15).map(s => {
      const agent = AGENTS_BY_ID[s.agent];
      const color = agent ? agent.color : '#7170ff';
      return `
        <div class="signal-item">
          <span class="signal-time">${s.time}</span>
          <span class="signal-badge" style="background:${color}">${s.agent}</span>
          <span class="signal-text">${s.text}
            ${s.file ? `<span class="signal-file"> • ${s.file}</span>` : ''}
          </span>
        </div>`;
    }).join('');
  },

  // ===== PULSE METRICS =====
  renderPulseMetrics() {
    const container = document.getElementById('pulseMetrics');
    const online = State.onlineCount, total = AGENTS.length;
    container.innerHTML = `
      <div class="metric">
        <div class="metric-label">Agents Online</div>
        <div class="metric-value">${online}/${total}</div>
        <div class="metric-sub">${online === total ? 'Full fleet' : 'Partial deployment'}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Avg Latency</div>
        <div class="metric-value" id="avgLatency">--ms</div>
        <div class="metric-sub">API round-trip</div>
      </div>
      <div class="metric">
        <div class="metric-label">Signals (24h)</div>
        <div class="metric-value">${State.signals.length}</div>
        <div class="metric-sub">Activity events</div>
      </div>
      <div class="metric">
        <div class="metric-label">Active Tasks</div>
        <div class="metric-value">${State.tasks.filter(t => t.column === 'in-progress').length}</div>
        <div class="metric-sub">Across all agents</div>
      </div>
    `;
  },

  // ===== REFRESH ALL =====
  refreshAll() {
    this.updateClock();
    this.updateStatusBar();
    this.renderAgentCards();
    this.renderSignals();
    this.renderPulseMetrics();
  },
};
