// BlacksiteLab Fleet Command — API Client
// Hermes Agent API (OpenAI-compatible) integration

const ApiClient = {
  async _fetch(agentId, path, options = {}) {
    const agent = AGENTS_BY_ID[agentId];
    if (!agent) throw new Error(`Unknown agent: ${agentId}`);
    const base = options.skipV1Prefix
      ? `${API_BASE_URL}:${agent.port}`
      : getApiBase(agent.port);
    const url = `${base}${path}`;
    const { skipV1Prefix, ...fetchOpts } = options;
    const start = performance.now();
    try {
      const res = await fetch(url, {
        ...fetchOpts,
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: AbortSignal.timeout(8000),
      });
      const latency = Math.round(performance.now() - start);
      return { ok: res.ok, status: res.status, latency, data: await res.json().catch(() => null) };
    } catch (e) {
      return { ok: false, status: 0, latency: 0, error: e.message };
    }
  },

  // Health check — returns agent status (not under /v1 prefix)
  async getHealth(agentId) {
    const res = await this._fetch(agentId, '/health', { skipV1Prefix: true });
    if (res.ok) {
      return { status: 'online', latency: res.latency, ...res.data };
    }
    return { status: 'offline', latency: res.latency };
  },

  // Check all agents — returns {claire: {status, latency}, sven: {...}, ...}
  async checkAll() {
    const results = {};
    const checks = AGENTS.map(async agent => {
      const h = await this.getHealth(agent.id);
      results[agent.id] = h.status === 'online' ? { status: 'online', latency: h.latency } : { status: 'offline', latency: 0 };
    });
    await Promise.allSettled(checks);
    return results;
  },

  // Send chat to an agent — used by council
  async sendChat(agentId, messages) {
    const res = await this._fetch(agentId, '/chat/completions', {
      method: 'POST',
      body: JSON.stringify({
        model: 'default',
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });
    if (res.ok && res.data?.choices?.[0]?.message?.content) {
      return { status: 'ok', content: res.data.choices[0].message.content, latency: res.latency };
    }
    return { status: 'error', error: res.error || 'No response', latency: res.latency };
  },

  // Send responses API call (newer Hermes endpoint)
  async sendResponse(agentId, input, instructions = '') {
    const res = await this._fetch(agentId, '/responses', {
      method: 'POST',
      body: JSON.stringify({ input: [{ role: 'user', content: input }], instructions }),
    });
    if (res.ok && res.data?.output) {
      return { status: 'ok', content: res.data.output.map(o => o.content || '').join('\n'), latency: res.latency };
    }
    return { status: 'error', error: res.error || 'No response', latency: res.latency };
  },

  // List recent runs for an agent
  async listRuns(agentId, limit = 5) {
    const res = await this._fetch(agentId, `/runs?limit=${limit}`);
    if (res.ok) return res.data;
    return { data: [] };
  },

  // List jobs for an agent
  async listJobs(agentId) {
    const res = await this._fetch(agentId, '/jobs');
    if (res.ok) return res.data;
    return { data: [] };
  },
};
