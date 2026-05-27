// BlacksiteLab Fleet Command — Calendar
// Month/week/day views, event CRUD, cron overlay, kanban deadline overlay

const Calendar = {
  currentDate: new Date(),
  view: 'month', // month | week | day
  events: [],
  showCron: false,
  showKanban: false,
  cronJobs: [],

  // Days of week (start Sunday)
  DAYS: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  MONTHS: ['January', 'February', 'March', 'April', 'May', 'June',
           'July', 'August', 'September', 'October', 'November', 'December'],

  init() {
    this.loadEvents();
    this.showCron = localStorage.getItem('fleet-calendar-show-cron') === 'true';
    this.showKanban = localStorage.getItem('fleet-kanban-show-on-calendar') === 'true';

    document.getElementById('calPrevBtn').addEventListener('click', () => this.navigate(-1));
    document.getElementById('calNextBtn').addEventListener('click', () => this.navigate(1));
    document.getElementById('calTodayBtn').addEventListener('click', () => this.goToday());
    document.getElementById('calToggleCron').addEventListener('click', () => this.toggleCron());
    document.getElementById('calToggleKanban').addEventListener('click', () => this.toggleKanban());

    document.querySelectorAll('.cal-view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchView(e.target.dataset.view));
    });

    // Modal
    document.getElementById('calSaveBtn').addEventListener('click', () => this.saveEvent());
    document.getElementById('calCancelBtn').addEventListener('click', () => this.closeModal());
    document.getElementById('calDeleteBtn').addEventListener('click', () => this.deleteEvent());
    document.getElementById('calModalBackdrop').addEventListener('click', () => this.closeModal());

    // Agent assignment toggle
    document.getElementById('calHasAgentTask').addEventListener('change', (e) => {
      document.getElementById('calAgentTaskFields').style.display = e.target.checked ? 'block' : 'none';
    });

    this.updateToggleStates();
    this.render();
  },

  render() {
    this.updateHeader();
    document.getElementById('calToggleCron').checked = this.showCron;
    document.getElementById('calToggleKanban').checked = this.showKanban;
    if (this.view === 'month') this.renderMonth();
    else if (this.view === 'week') this.renderWeek();
    else this.renderDay();
  },

  // ===== NAVIGATION =====
  navigate(dir) {
    if (this.view === 'month') {
      this.currentDate.setMonth(this.currentDate.getMonth() + dir);
    } else if (this.view === 'week') {
      this.currentDate.setDate(this.currentDate.getDate() + (dir * 7));
    } else {
      this.currentDate.setDate(this.currentDate.getDate() + dir);
    }
    this.render();
  },

  goToday() {
    this.currentDate = new Date();
    this.render();
  },

  switchView(view) {
    this.view = view;
    document.querySelectorAll('.cal-view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    this.render();
  },

  updateHeader() {
    let label;
    const d = this.currentDate;
    if (this.view === 'month') {
      label = `${this.MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    } else if (this.view === 'week') {
      // Show week range
      const start = this._weekStart(d);
      const end = new Date(start); end.setDate(end.getDate() + 6);
      label = `${this.MONTHS[start.getMonth()]} ${start.getDate()} — ${this.MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
    } else {
      label = `${this.MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    }
    document.getElementById('calLabel').textContent = label;
  },

  updateToggleStates() {
    document.getElementById('calToggleCron').checked = this.showCron;
    document.getElementById('calToggleKanban').checked = this.showKanban;
  },

  // ===== MONTH VIEW =====
  renderMonth() {
    const grid = document.getElementById('calMonthGrid');
    const body = document.getElementById('calMonthBody');
    const header = document.getElementById('calMonthHeader');

    // Header row
    header.innerHTML = this.DAYS.map(d => `<div class="cal-day-header">${d}</div>`).join('');

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayStr = this._dateKey(today);

    const cells = [];
    // Leading blanks
    for (let i = 0; i < firstDay; i++) {
      cells.push(`<div class="cal-cell cal-cell-other"></div>`);
    }
    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const key = this._dateKey(d);
      const isToday = key === todayStr;
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const dayEvents = this._eventsForDate(key);

      let cellClass = 'cal-cell';
      if (isToday) cellClass += ' cal-today';
      if (isWeekend) cellClass += ' cal-weekend';

      let html = `<div class="${cellClass}">`;
      html += `<div class="cal-day-num">${day}</div>`;
      html += `<div class="cal-day-content">`;

      // Calendar events
      dayEvents.forEach(ev => {
        html += `<div class="cal-event" style="--ev-color:${ev.color || '#7170ff'}" data-id="${ev.id}" onclick="event.stopPropagation();Calendar.openModal('${ev.id}')" title="${esc(ev.title)}">${esc(ev.title)}</div>`;
      });

      // Cron overlay
      if (this.showCron) {
        this._cronForDate(key).forEach(cj => {
          html += `<div class="cal-event cal-event-cron" title="cron: ${esc(cj.name || 'job')}">⟳ ${esc(cj.name || cj.job_id?.slice(0,8) || 'cron')}</div>`;
        });
      }

      // Kanban overlay
      if (this.showKanban) {
        this._kanbanForDate(key).forEach(card => {
          const agent = AGENTS_BY_ID[card.assignee] || { color: '#62666d' };
          html += `<div class="cal-event cal-event-kanban" style="--ev-color:${agent.color}" title="kanban: ${esc(card.title)}">▸ ${esc(card.title)}</div>`;
        });
      }

      html += `</div></div>`;
      cells.push(html);
    }
    body.innerHTML = cells.join('');
    grid.style.display = 'grid';
  },

  // ===== WEEK VIEW =====
  renderWeek() {
    const grid = document.getElementById('calMonthGrid');
    const body = document.getElementById('calMonthBody');
    const header = document.getElementById('calMonthHeader');
    const start = this._weekStart(this.currentDate);

    header.innerHTML = this.DAYS.map((d, i) => {
      const date = new Date(start); date.setDate(date.getDate() + i);
      return `<div class="cal-day-header">${d} ${date.getDate()}</div>`;
    }).join('');

    const today = new Date();
    const todayStr = this._dateKey(today);
    const cells = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const key = this._dateKey(d);
      const isToday = key === todayStr;
      const events = this._eventsForDate(key);

      let cellClass = 'cal-cell cal-cell-week';
      if (isToday) cellClass += ' cal-today';

      let html = `<div class="${cellClass}">`;
      html += `<div class="cal-day-num">${d.getDate()}</div>`;
      html += `<div class="cal-day-content">`;
      events.forEach(ev => {
        html += `<div class="cal-event" style="--ev-color:${ev.color || '#7170ff'}" data-id="${ev.id}" onclick="event.stopPropagation();Calendar.openModal('${ev.id}')">${ev.start ? new Date(ev.start).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) + ' ' : ''}${esc(ev.title)}</div>`;
      });
      if (this.showCron) {
        this._cronForDate(key).forEach(cj => {
          html += `<div class="cal-event cal-event-cron" title="cron">⟳ ${esc(cj.name || 'cron')}</div>`;
        });
      }
      if (this.showKanban) {
        this._kanbanForDate(key).forEach(card => {
          const agent = AGENTS_BY_ID[card.assignee] || { color: '#62666d' };
          html += `<div class="cal-event cal-event-kanban" style="--ev-color:${agent.color}" title="kanban">▸ ${esc(card.title)}</div>`;
        });
      }
      html += `</div></div>`;
      cells.push(html);
    }
    body.innerHTML = cells.join('');
    grid.style.display = 'grid';
  },

  // ===== DAY VIEW =====
  renderDay() {
    const grid = document.getElementById('calMonthGrid');
    const body = document.getElementById('calMonthBody');
    const header = document.getElementById('calMonthHeader');
    header.innerHTML = '';

    const d = this.currentDate;
    const key = this._dateKey(d);
    const events = this._eventsForDate(key);

    let html = '';
    if (events.length === 0 && !this.showCron && !this.showKanban) {
      html = `<div class="cal-day-empty">No events for ${d.toLocaleDateString()}</div>`;
    } else {
      events.forEach(ev => {
        const time = ev.start ? new Date(ev.start).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '';
        html += `<div class="cal-day-event" style="--ev-color:${ev.color || '#7170ff'}">
          <span class="cal-day-time">${time}</span>
          <span class="cal-day-title" onclick="event.stopPropagation();Calendar.openModal('${ev.id}')">${esc(ev.title)}</span>
          <span class="cal-day-desc">${ev.description || ''}</span>
        </div>`;
      });
      if (this.showCron) {
        this._cronForDate(key).forEach(cj => {
          html += `<div class="cal-day-event cal-event-cron"><span class="cal-day-title">⟳ cron: ${esc(cj.name || 'job')}</span></div>`;
        });
      }
      if (this.showKanban) {
        this._kanbanForDate(key).forEach(card => {
          const agent = AGENTS_BY_ID[card.assignee] || { color: '#62666d' };
          html += `<div class="cal-day-event cal-event-kanban" style="--ev-color:${agent.color}"><span class="cal-day-title">▸ ${esc(card.title)}</span><span class="cal-day-desc">${card.column} · ${card.priority}</span></div>`;
        });
      }
    }
    body.innerHTML = `<div class="cal-day-list">${html}</div>`;
    grid.style.display = 'block';
  },

  // ===== TOGGLES =====
  toggleCron() {
    this.showCron = !this.showCron;
    localStorage.setItem('fleet-calendar-show-cron', this.showCron);
    this.render();
  },

  toggleKanban() {
    this.showKanban = !this.showKanban;
    localStorage.setItem('fleet-kanban-show-on-calendar', this.showKanban);
    this.render();
  },

  // ===== EVENT MODAL =====
  openModal(eventId) {
    const ev = eventId ? this.events.find(e => e.id === eventId) : null;
    document.getElementById('calModalTitle').textContent = ev ? 'Edit Event' : 'Add Event';

    document.getElementById('calEventTitle').value = ev?.title || '';
    document.getElementById('calEventDesc').value = ev?.description || '';
    document.getElementById('calEventStart').value = ev?.start ? ev.start.slice(0, 16) : this._defaultStart();
    document.getElementById('calEventEnd').value = ev?.end ? ev.end.slice(0, 16) : '';
    document.getElementById('calEventAllDay').checked = ev?.allDay || false;
    document.getElementById('calEventColor').value = ev?.color || '#7170ff';

    // Agent task fields
    document.getElementById('calHasAgentTask').checked = !!ev?.agentTask;
    document.getElementById('calAgentTaskFields').style.display = ev?.agentTask ? 'block' : 'none';
    document.getElementById('calAgentSelect').value = ev?.agentTask?.agentId || '';
    document.getElementById('calAgentPrompt').value = ev?.agentTask?.prompt || '';
    document.getElementById('calAgentDeliver').value = ev?.agentTask?.deliver || 'origin';

    document.getElementById('calDeleteBtn').style.display = ev ? 'inline-flex' : 'none';
    document.getElementById('calModalBackdrop').dataset.editId = ev?.id || '';
    document.getElementById('calModal').classList.add('open');
  },

  closeModal() {
    document.getElementById('calModal').classList.remove('open');
  },

  saveEvent() {
    const title = document.getElementById('calEventTitle').value.trim();
    if (!title) return;

    const hasAgent = document.getElementById('calHasAgentTask').checked;
    const agentId = hasAgent ? document.getElementById('calAgentSelect').value : null;
    const editId = document.getElementById('calModalBackdrop').dataset.editId;

    const ev = {
      id: editId || 'ev' + Date.now(),
      title,
      description: document.getElementById('calEventDesc').value.trim(),
      start: document.getElementById('calEventStart').value,
      end: document.getElementById('calEventEnd').value || null,
      allDay: document.getElementById('calEventAllDay').checked,
      color: document.getElementById('calEventColor').value,
      agentTask: hasAgent && agentId ? {
        agentId,
        prompt: document.getElementById('calAgentPrompt').value.trim(),
        deliver: document.getElementById('calAgentDeliver').value,
      } : null,
      // Keep existing cronJobId if editing
      cronJobId: editId ? (this.events.find(e => e.id === editId)?.cronJobId || null) : null,
    };

    if (editId) {
      const idx = this.events.findIndex(e => e.id === editId);
      if (idx !== -1) this.events[idx] = ev;
    } else {
      this.events.push(ev);
    }

    this.saveEvents();
    this.closeModal();
    this.render();
  },

  deleteEvent() {
    const editId = document.getElementById('calModalBackdrop').dataset.editId;
    if (!editId) return;
    this.events = this.events.filter(e => e.id !== editId);
    this.saveEvents();
    this.closeModal();
    this.render();
  },

  // ===== PERSISTENCE =====
  loadEvents() {
    try {
      this.events = JSON.parse(localStorage.getItem('fleet-calendar-events') || '[]');
    } catch { this.events = []; }
  },

  saveEvents() {
    localStorage.setItem('fleet-calendar-events', JSON.stringify(this.events));
  },

  // ===== HELPERS =====
  _dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  _weekStart(d) {
    const start = new Date(d);
    start.setDate(start.getDate() - start.getDay());
    return start;
  },

  _defaultStart() {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    return d.toISOString().slice(0, 16);
  },

  _eventsForDate(key) {
    return this.events.filter(ev => {
      if (!ev.start) return false;
      // For all-day events, compare date only
      const evDate = ev.allDay ? ev.start.slice(0, 10) : ev.start.slice(0, 10);
      // Also check if event spans this date
      if (!ev.end || ev.allDay) return evDate === key;
      const evEndDate = ev.end.slice(0, 10);
      return key >= evDate && key <= evEndDate;
    });
  },

  // Cron jobs — in a real implementation, these arrive via MCP bridge
  // For now, stub returns empty; cron data would be fetched by the parent app
  setCronJobs(jobs) {
    this.cronJobs = jobs;
  },

  _cronForDate(key) {
    if (!this.cronJobs.length) return [];
    // Match cron jobs to dates based on schedule — simplified for now
    // Real implementation would parse cron expressions
    return [];
  },

  // Kanban deadline overlay — read from localStorage shared with Kanban module
  _kanbanForDate(key) {
    try {
      const tasks = JSON.parse(localStorage.getItem('fleet-tasks') || '[]');
      return tasks.filter(t => {
        if (!t.dueDate) return false;
        return t.dueDate.slice(0, 10) === key;
      });
    } catch { return []; }
  },
};
