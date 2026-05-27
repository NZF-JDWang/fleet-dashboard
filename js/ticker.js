// BlacksiteLab Fleet Command — Live Activity Ticker
// Animated scrolling event feed with real-time updates

const Ticker = {
  events: [],
  marqueeEl: null,
  feedEl: null,
  _init: false,

  init() {
    if (this._init) return;
    this._init = true;

    this.marqueeEl = document.getElementById('tickerMarquee');
    this.feedEl = document.getElementById('tickerFeed');

    // Pulse the ticker on new signals
    State.onSignalAdded = (signal) => {
      this.addEvent(signal);
    };

    // Load initial demo events
    DEMO_SIGNALS.forEach(s => this.addEvent(s));

    // Refresh ticker periodically
    setInterval(() => this.refreshTicker(), 8000);
  },

  addEvent(signal) {
    const agent = AGENTS_BY_ID[signal.agent];
    const color = agent ? agent.color : '#7170ff';
    const time = signal.time || new Date().toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    this.events.unshift({ ...signal, color, time });
    if (this.events.length > 100) this.events.length = 100;
    this.refreshTicker();
  },

  refreshTicker() {
    if (!this.marqueeEl || !this.feedEl) return;

    // Top marquee: scrolling ticker
    const items = this.events.slice(0, 20);
    this.marqueeEl.innerHTML = items.map(e => {
      const agent = AGENTS_BY_ID[e.agent];
      const name = agent ? agent.name : e.agent;
      return `<span class="ticker-item"><b style="color:${e.color}">${name}</b> ${escHtml(e.text || '')} ${e.file ? `• ${escHtml(e.file)}` : ''}</span>`;
    }).join('<span class="ticker-sep"> ◆ </span>');

    // Dropdown feed: last 10
    this.feedEl.innerHTML = items.slice(0, 10).map(e => `
      <div class="ticker-feed-item">
        <span class="ticker-feed-time">${e.time}</span>
        <span class="ticker-feed-agent" style="color:${e.color}">${e.agent}</span>
        <span class="ticker-feed-text">${escHtml(e.text || '')}</span>
        ${e.file ? `<span class="ticker-feed-file">📄 ${escHtml(e.file)}</span>` : ''}
      </div>
    `).join('');

    // Update count badge
    const badge = document.getElementById('tickerCount');
    if (badge) badge.textContent = this.events.length;
  },
};
