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

    // Load initial signals
    State.signals.forEach(s => this.addEvent(s));

    // Refresh ticker periodically
    setInterval(() => this.refreshTicker(), 8000);
  },

  addEvent(signal) {
    // Real signals have {content, role, session, time, type, tool}
    // Normalize to {text, agent, time, file} for existing render code
    const agentId = 'sven';
    const agent = AGENTS_BY_ID[agentId];
    const color = agent ? agent.color : '#7170ff';
    const time = signal.time || '';
    const text = (signal.content || '').slice(0, 100);
    const toolTag = signal.tool ? `[${signal.tool}]` : '';

    this.events.unshift({
      agent: agentId,
      name: agent ? agent.name : agentId,
      color,
      time,
      text,
      file: toolTag,
    });
    if (this.events.length > 100) this.events.length = 100;
    this.refreshTicker();
  },

  refreshTicker() {
    if (!this.marqueeEl || !this.feedEl) return;

    // Top marquee: scrolling ticker
    const items = this.events.slice(0, 20);
    this.marqueeEl.innerHTML = items.map(e =>
      `<span class="ticker-item"><b style="color:${e.color}">${e.name}</b> ${escHtml(e.text)} ${e.file ? `• ${escHtml(e.file)}` : ''}</span>`
    ).join('<span class="ticker-sep"> ◆ </span>');

    // Dropdown feed: last 10
    this.feedEl.innerHTML = items.slice(0, 10).map(e => `
      <div class="ticker-feed-item">
        <span class="ticker-feed-time">${e.time}</span>
        <span class="ticker-feed-agent" style="color:${e.color}">${e.name}</span>
        <span class="ticker-feed-text">${escHtml(e.text)}</span>
        ${e.file ? `<span class="ticker-feed-file">📄 ${escHtml(e.file)}</span>` : ''}
      </div>
    `).join('');

    // Update count badge
    const badge = document.getElementById('tickerCount');
    if (badge) badge.textContent = this.events.length;
  },
};
