// BlacksiteLab Fleet Command — State Management

const State = {
  agents: {},       // {claire: {status:'online', latency:12}, sven: {...}}
  signals: [],      // Recent activity from session DB
  fleetStatus: 'All Systems Online',
  onlineCount: 0,
  selectedAgent: null,
  lastUpdated: null,
  tasks: [],        // Kanban tasks

  async init() {
    // Initialize agent state
    AGENTS.forEach(a => {
      this.agents[a.id] = { status: 'unknown', latency: 0, task: '', sessions: 0 };
    });
    // Load tasks + signals from backend
    try {
      this.tasks = await ApiClient.getTasks();
    } catch {
      this.tasks = [];
    }
    try {
      this.signals = await ApiClient.getSignals(15);
    } catch {
      this.signals = [];
    }
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
    if (this.signals.length > 50) this.signals.length = 50;
  },

  // Kanban — backed by backend API
  async addTask(task) {
    const created = await ApiClient.createTask({
      title: task.title,
      desc: task.desc || '',
      assignee: task.assignee || '',
      priority: task.priority || 'medium',
      column: task.column || 'backlog',
    });
    if (created) {
      this.tasks.push(created);
    }
    return created;
  },

  async moveTask(taskId, toColumn) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.column = toColumn;
      await ApiClient.updateTask(taskId, { column: toColumn });
    }
  },

  async deleteTask(taskId) {
    this.tasks = this.tasks.filter(t => t.id !== taskId);
    await ApiClient.deleteTask(taskId);
  },

  async updateTaskFields(taskId, fields) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      Object.assign(task, fields);
      await ApiClient.updateTask(taskId, fields);
    }
  },

  getColumnTasks(col) {
    return this.tasks.filter(t => t.column === col);
  },
};
