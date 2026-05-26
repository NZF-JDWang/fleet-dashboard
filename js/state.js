// BlacksiteLab Fleet Command — State Management

const State = {
  agents: {},       // {claire: {status:'online', latency:12}, sven: {...}}
  signals: [],      // Recent activity signals
  fleetStatus: 'All Systems Online',
  onlineCount: 0,
  selectedAgent: null,
  lastUpdated: null,
  tasks: [],        // Kanban tasks

  init() {
    // Initialize agent state
    AGENTS.forEach(a => {
      this.agents[a.id] = { status: 'unknown', latency: 0, task: '', sessions: 0 };
    });
    // Load tasks from localStorage
    const saved = localStorage.getItem('fleet-tasks');
    this.tasks = saved ? JSON.parse(saved) : [...DEMO_TASKS];
    this.signals = [...DEMO_SIGNALS];
  },

  updateAgentStatus(results) {
    let online = 0, total = 0;
    for (const [id, data] of Object.entries(results)) {
      this.agents[id] = { ...this.agents[id], ...data };
      if (data.status === 'online') online++;
      total++;
    }
    this.onlineCount = online;
    this.lastUpdated = new Date();
    if (online === total) this.fleetStatus = 'All Systems Online';
    else if (online === 0) this.fleetStatus = 'Fleet Offline';
    else this.fleetStatus = `${online}/${total} Agents Online`;
  },

  addSignal(signal) {
    this.signals.unshift(signal);
    if (this.signals.length > 50) this.signals.length = 50; // cap
  },

  // Kanban task CRUD
  addTask(task) {
    task.id = 't' + Date.now();
    task.column = task.column || 'backlog';
    this.tasks.push(task);
    this.saveTasks();
    return task;
  },

  moveTask(taskId, toColumn) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.column = toColumn;
      this.saveTasks();
    }
  },

  deleteTask(taskId) {
    this.tasks = this.tasks.filter(t => t.id !== taskId);
    this.saveTasks();
  },

  saveTasks() {
    localStorage.setItem('fleet-tasks', JSON.stringify(this.tasks));
  },

  getColumnTasks(col) {
    return this.tasks.filter(t => t.column === col);
  },
};
