// BlacksiteLab Fleet Command — Config
// Agent definitions, API endpoints, defaults

const AGENTS = [
  { id: 'claire',  name: 'Claire',  role: 'Chief of Staff', color: '#7c3aed', port: 8642, avatar: 'C' },
  { id: 'sven',    name: 'Sven',    role: 'Dev Agent',      color: '#06b6d4', port: 8643, avatar: 'S' },
  { id: 'yuki',    name: 'Yuki',    role: 'Infra Engineer', color: '#39FF14', port: 8644, avatar: 'Y' },
  { id: 'margot',  name: 'Margot',  role: 'Vault Keeper',   color: '#f59e0b', port: 8645, avatar: 'M' },
  { id: 'klaus',   name: 'Klaus',   role: 'Research Lead',  color: '#c2710f', port: 8646, avatar: 'K' },
];

const AGENTS_BY_ID = Object.fromEntries(AGENTS.map(a => [a.id, a]));

let API_KEY = 'change-me-local-dev';
let POLL_INTERVAL = 5000;

function getApiBase(port) {
  return `http://localhost:${port}/v1`;
}

// Demo signals for when APIs are unreachable
const DEMO_SIGNALS = [
  { time: '22:14:01', agent: 'sven',    text: 'git push origin main — fleet-dashboard v0.1', file: 'index.html' },
  { time: '22:13:45', agent: 'claire',  text: 'PR #42 merged: add gravity-well physics', file: 'physics/gravity_well.gd' },
  { time: '22:13:18', agent: 'margot',  text: 'Vault entry updated: Fleet Dashboard Proposal', file: 'fleet-dashboard-plan.md' },
  { time: '22:12:52', agent: 'yuki',    text: 'Deploy gravity-game v0.3.1 to prod', file: 'docker-compose.yml' },
  { time: '22:12:30', agent: 'klaus',   text: 'arXiv:2312.12345 — MoE routing paper analysis', file: 'notes/moe-routing.md' },
  { time: '22:11:55', agent: 'sven',    text: 'npm run build succeeded — 14.3KB gzip', file: 'dist/bundle.js' },
  { time: '22:11:20', agent: 'claire',  text: 'Staff meeting notes committed', file: 'meetings/2026-05-26.md' },
  { time: '22:10:45', agent: 'yuki',    text: 'SSL cert renewed for blacksitelab.dev', file: null },
  { time: '22:10:02', agent: 'margot',  text: 'Tagged vault snapshot v2026.05.26', file: null },
  { time: '22:09:33', agent: 'klaus',   text: 'Web search: hermes-agent multi-agent topologies', file: null },
];

// Demo kanban tasks
const DEMO_TASKS = [
  { id: 't1', title: 'Add fleet topology graph', desc: 'Canvas-based graph showing 5 agents with glow halos', column: 'done', assignee: 'sven', priority: 'high' },
  { id: 't2', title: 'Build council chamber modal', desc: 'Full debate + quick poll with Hermes API integration', column: 'review', assignee: 'sven', priority: 'high' },
  { id: 't3', title: 'Wire up real-time status polling', desc: 'Poll /health/detailed every 5s for each agent', column: 'in-progress', assignee: 'sven', priority: 'medium' },
  { id: 't4', title: 'Add drag-and-drop to kanban', desc: 'Implement HTML5 drag API for task cards between columns', column: 'in-progress', assignee: 'sven', priority: 'medium' },
  { id: 't5', title: 'Design agent settings page', desc: 'Per-agent API key, port, and endpoint config', column: 'backlog', assignee: 'claire', priority: 'low' },
  { id: 't6', title: 'Add WebSocket support', desc: 'Replace polling with WS for real-time signals', column: 'backlog', assignee: 'yuki', priority: 'low' },
  { id: 't7', title: 'Implement Obsidian vault bridge', desc: 'Read/write notes to Obsidian vault from dashboard', column: 'backlog', assignee: 'margot', priority: 'medium' },
];
