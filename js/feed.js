// BlacksiteLab Fleet Command — Live Feed Page
// Chronological event stream with filtering

const Feed = {
  _init: false,

  init() {
    if (this._init) return;
    this._init = true;

    // Listen for signal events
    State.onSignalAdded = (signal) => {
      this.addEvent(signal);
    };

    // Load demo signals initially
    DEMO_SIGNALS.forEach(s => this.addEvent(s));

    // Refresh periodically
    setInterval(() => this.render(), 5000);
  },

  addEvent(signal) {
    // Rendered by ticker; feed page uses the same source
    // Ensure events show up immediately
    this.render();
  },

  render() {
    const el = document.getElementById('feedStream');
    if (!el || !document.getElementById('page-feed').classList.contains('active')) return;

    const events = State.signals.slice(0, 50);
    const countEl = document.getElementById('feedEventCount');
    if (countEl) countEl.textContent = `${events.length} events`;

    if (events.length === 0) {
      el.innerHTML = '<div class="feed-empty">No events yet. Activity will appear as agents report in.</div>';
      return;
    }

    el.innerHTML = events.map((s, i) => {
      const agent = AGENTS_BY_ID[s.agent];
      const color = agent ? agent.color : '#7170ff';
      const name = agent ? agent.name : s.agent;
      const time = s.time || '';
      return `
        <div class="feed-event" style="--feed-color:${color}; animation-delay:${i * 0.03}s">
          <div class="feed-event-time">${escHtml(time)}</div>
          <div class="feed-event-dot" style="background:${color}"></div>
          <div class="feed-event-body">
            <span class="feed-event-agent" style="color:${color}">${escHtml(name)}</span>
            <span class="feed-event-text">${escHtml(s.text || '')}</span>
            ${s.file ? `<span class="feed-event-file">📄 ${escHtml(s.file)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  },
};
