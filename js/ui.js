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
    const clockEl = document.getElementById('nztClock');
    clockEl.textContent =
      nzt.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' NZT';

    // Day/night indicator: NZT 06:00-18:00 = day, otherwise night
    const nztHour = nzt.getUTCHours();
    const isDay = nztHour >= 6 && nztHour < 18;
    clockEl.classList.toggle('night', !isDay);
    clockEl.classList.toggle('day', isDay);
  },

  // ===== SIGNALS =====
  renderSignals() {
    const list = document.getElementById('signalsList');
    list.innerHTML = State.signals.slice(0, 15).map(s => {
      // Determine which agent this signal belongs to
      // Real signals have role+content; assign based on session context
      let agentId = 'sven'; // default: most signals are Sven's
      if (s.content && s.content.toLowerCase().includes('claire')) agentId = 'claire';
      const agent = AGENTS_BY_ID[agentId];
      const color = agent ? agent.color : '#7170ff';
      const name = agent ? agent.name : agentId;
      const sessionTag = s.session ? ` • ${s.session}` : '';
      const signalType = s.type === 'tool' ? (s.tool ? `[${s.tool}]` : '[tool]') : '';
      return `
        <div class="signal-item">
          <span class="signal-time">${s.time || ''}</span>
          <span class="signal-badge" style="background:${color}">${name}</span>
          <span class="signal-text">${escHtml((s.content || '').slice(0, 120))}
            ${signalType ? `<span class="signal-file">${escHtml(signalType)}</span>` : ''}
            ${sessionTag ? `<span class="signal-file">${sessionTag}</span>` : ''}
          </span>
        </div>`;
    }).join('');
  },

  // ===== REFRESH ALL =====
  refreshAll() {
    this.updateClock();
    this.updateStatusBar();
    this.renderSignals();
  },
};
