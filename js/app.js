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

    // Canvas graph
    const canvas = document.getElementById('graphCanvas');
    this.graph = new FleetGraph(canvas);
    this.graph.onNodeClick = (node) => this.selectAgent(node.id);
    this.graph.onNodeHover = (node) => {
      // Could render tooltip here
    };
    this.graph.start();

    // Hash routing
    this.routeFromHash();
    window.addEventListener('hashchange', () => this.routeFromHash());

    // Nav clicks (for hash links)
    document.querySelectorAll('.nav-item[href^="#"]').forEach(item => {
      item.addEventListener('click', (e) => {
        if (item.getAttribute('href').startsWith('#agent/')) {
          e.preventDefault();
          const agentId = item.getAttribute('href').replace('#agent/', '');
          this.selectAgent(agentId);
          return;
        }
      });
    });

    // Refresh button
    document.getElementById('btnRefresh').addEventListener('click', () => this.pollNow());

    // Settings
    document.getElementById('btnSaveSettings').addEventListener('click', () => {
      API_KEY = document.getElementById('settingsApiKey').value.trim();
      POLL_INTERVAL = parseInt(document.getElementById('settingsPollInterval').value) * 1000;
      localStorage.setItem('fleet-api-key', API_KEY);
      localStorage.setItem('fleet-poll-interval', POLL_INTERVAL);
      this.restartPolling();
    });

    // Load saved settings
    const savedKey = localStorage.getItem('fleet-api-key');
    if (savedKey) { API_KEY = savedKey; document.getElementById('settingsApiKey').value = savedKey; }
    const savedPoll = localStorage.getItem('fleet-poll-interval');
    if (savedPoll) { POLL_INTERVAL = parseInt(savedPoll); document.getElementById('settingsPollInterval').value = POLL_INTERVAL / 1000; }

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
    else if (hash.startsWith('#council')) page = 'council';
    else if (hash.startsWith('#settings')) page = 'settings';
    else if (hash.startsWith('#agent/')) {
      page = 'dashboard';
      const agentId = hash.replace('#agent/', '');
      setTimeout(() => this.selectAgent(agentId), 100);
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
    const titles = { dashboard: 'Fleet Overview', kanban: 'Kanban Board', council: 'Council Chamber', settings: 'Settings' };
    document.getElementById('pageTitle').textContent = titles[page] || 'Fleet Overview';

    // Render kanban if navigating there
    if (page === 'kanban') Kanban.render();
  },

  selectAgent(agentId) {
    State.selectedAgent = agentId;
    // Highlight agent card
    document.querySelectorAll('.agent-card').forEach(card => {
      card.classList.toggle('highlighted', card.dataset.agent === agentId);
    });
    // Update nav
    document.querySelectorAll('.nav-agent').forEach(item => {
      item.classList.toggle('active', item.dataset.agent === agentId);
    });
    // Reset after 5s
    clearTimeout(this._agentHighlightTimeout);
    this._agentHighlightTimeout = setTimeout(() => {
      document.querySelectorAll('.agent-card.highlighted, .nav-agent.active').forEach(el => el.classList.remove('highlighted', 'active'));
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
