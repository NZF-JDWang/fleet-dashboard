// BlacksiteLab Fleet Command — App Controller
// Routing, polling, initialization

const App = {
  graph: null,
  currentPage: 'dashboard',
  pollTimer: null,

  async init() {
    State.init();
    UI.refreshAll();
    Kanban.init();
    Council.init();
    Ticker.init();
    Feed.init();

    // Hash routing
    this.routeFromHash();
    window.addEventListener('hashchange', () => this.routeFromHash());

    // Nav clicks (for hash links)
    document.querySelectorAll('.nav-item[href^="#"]').forEach(item => {
      item.addEventListener('click', (e) => {
        if (item.getAttribute('href').startsWith('#agent/')) {
          e.preventDefault();
          const agentId = item.getAttribute('href').replace('#agent/', '');
          window.location.hash = '#agent/' + agentId;
          return;
        }
      });
    });

    // Refresh button
    document.getElementById('btnRefresh').addEventListener('click', () => this.pollNow());

    // Settings — Save
    document.getElementById('btnSaveSettings').addEventListener('click', () => this.saveSettings());

    // Settings — Reset to Defaults
    document.getElementById('btnResetSettings').addEventListener('click', () => {
      this.resetSettingsToDefaults();
      this.saveSettings();
    });

    // Load saved settings into globals + form
    this.loadSettings();

    // Start polling
    this.startPolling();
    await this.pollNow();

    // NZT clock tick
    setInterval(() => UI.updateClock(), 1000);
  },

  routeFromHash() {
    const hash = window.location.hash || '#dashboard';
    let page = 'dashboard';

    if (hash.startsWith('#kanban')) page = 'kanban';
    else if (hash.startsWith('#calendar')) page = 'calendar';
    else if (hash.startsWith('#council')) page = 'council';
    else if (hash.startsWith('#settings')) page = 'settings';
    else if (hash.startsWith('#vault')) page = 'vault';
    else if (hash.startsWith('#feed')) page = 'feed';
    else if (hash.startsWith('#agent/')) {
      const agentId = hash.replace('#agent/', '');
      page = 'agent-detail';
      this._pendingAgent = agentId;
    }

    this.navigateTo(page);
  },

  navigateTo(page) {
    this.currentPage = page;
    // Update page visibility
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');

    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
      const href = item.getAttribute('href');
      if (href === `#${page}` || (page === 'dashboard' && href === '#dashboard')) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Page title
    const titles = { dashboard: 'Fleet Overview', kanban: 'Kanban Board', calendar: 'Fleet Calendar', council: 'Council Chamber', vault: 'Obsidian Vault', feed: 'Live Feed', 'agent-detail': 'Agent Detail', settings: 'Settings' };
    document.getElementById('pageTitle').textContent = titles[page] || 'Fleet Overview';

    // Render kanban if navigating there
    if (page === 'kanban') Kanban.render();
    // Init calendar if navigating there
    if (page === 'calendar') {
      if (!this._calendarInit) { Calendar.init(); this._calendarInit = true; }
      else Calendar.render();
    }
    // Refresh dashboard widgets on return to dashboard
    if (page === 'dashboard') UI.renderDashboardWidgets();
    // Init vault if navigating there
    if (page === 'vault') {
      if (!this._vaultInit) { VaultBrowser.init(); this._vaultInit = true; }
    }
    // Init feed if navigating there
    if (page === 'feed') {
      Feed.render();
    }
    // Init agent detail if navigating there
    if (page === 'agent-detail' && this._pendingAgent) {
      AgentDetail.init(this._pendingAgent);
      const agent = AGENTS_BY_ID[this._pendingAgent];
      if (agent) document.getElementById('pageTitle').textContent = agent.name + ' — ' + agent.role;
      this._pendingAgent = null;
    }
  },

  selectAgent(agentId) {
    State.selectedAgent = agentId;
    // Update nav
    document.querySelectorAll('.nav-agent').forEach(item => {
      item.classList.toggle('active', item.dataset.agent === agentId);
    });
    // Reset after 5s
    clearTimeout(this._agentHighlightTimeout);
    this._agentHighlightTimeout = setTimeout(() => {
      document.querySelectorAll('.nav-agent.active').forEach(el => el.classList.remove('active'));
    }, 5000);
  },

  startPolling() {
    this.pollTimer = setInterval(() => this.pollNow(), POLL_INTERVAL);
  },

  restartPolling() {
    clearInterval(this.pollTimer);
    this.startPolling();
  },

  async pollNow() {
    const results = await ApiClient.checkAll();
    State.updateAgentStatus(results);
    UI.refreshAll();

    // Update avg latency
    const onlineAgents = Object.values(results).filter(r => r.status === 'online');
    if (onlineAgents.length > 0) {
      const avgLat = Math.round(onlineAgents.reduce((s, r) => s + r.latency, 0) / onlineAgents.length);
      document.getElementById('avgLatency').textContent = avgLat + 'ms';
      document.getElementById('statusLatency').textContent = `API: ${avgLat}ms`;
    }

    // Push a signal occasionally (for demo when API is down)
    if (State.signals.length <= DEMO_SIGNALS.length) {
      // API-driven signals would go here
    }
  },
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
