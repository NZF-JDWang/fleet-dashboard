// BlacksiteLab Fleet Command — API Client
// All calls route through the aggregation backend

const ApiClient = {
  _prefix() { return BACKEND_URL; },

  async _fetch(path, options = {}) {
    const url = `${this._prefix()}${path}`;
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: AbortSignal.timeout(options.timeout || 8000),
      });
      const data = await res.json().catch(() => null);
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { ok: false, status: 0, error: e.message };
    }
  },

  // Health/agent status — GET /api/agents
  async checkAll() {
    const res = await this._fetch('/api/agents');
    if (res.ok) return res.data;
    return {};
  },

  // Recent signals — GET /api/signals?limit=N
  async getSignals(limit = 15) {
    const res = await this._fetch(`/api/signals?limit=${limit}`);
    if (res.ok) return res.data;
    return [];
  },

  // Kanban CRUD
  async getTasks() {
    const res = await this._fetch('/api/kanban');
    if (res.ok) return res.data;
    return [];
  },

  async createTask(task) {
    const res = await this._fetch('/api/kanban', {
      method: 'POST',
      body: JSON.stringify(task),
    });
    if (res.ok) return res.data;
    return null;
  },

  async updateTask(taskId, updates) {
    const res = await this._fetch(`/api/kanban/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    if (res.ok) return res.data;
    return null;
  },

  async deleteTask(taskId) {
    const res = await this._fetch(`/api/kanban/${taskId}`, {
      method: 'DELETE',
    });
    return res.ok;
  },

  // Council chat proxy — POST /api/council/chat
  async sendChat(agentId, messages) {
    const res = await this._fetch('/api/council/chat', {
      method: 'POST',
      body: JSON.stringify({ agent: agentId, messages }),
      timeout: 30000,
    });
    if (res.ok && res.data?.content) {
      return { status: 'ok', content: res.data.content, latency: 0 };
    }
    return { status: 'error', error: res.data?.error || 'No response', latency: 0 };
  },
};
