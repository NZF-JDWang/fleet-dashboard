// BlacksiteLab Fleet Command — Config
// Agent definitions, API endpoints, defaults

const AGENTS = [
  { id: 'claire',  name: 'Claire',  role: 'Chief of Staff', color: '#7c3aed', port: 8644, avatar: 'C' },
  { id: 'sven',    name: 'Sven',    role: 'Dev Agent',      color: '#06b6d4', port: 8648, avatar: 'S' },
  { id: 'yuki',    name: 'Yuki',    role: 'Infra Engineer', color: '#39FF14', port: 8647, avatar: 'Y' },
  { id: 'margot',  name: 'Margot',  role: 'Vault Keeper',   color: '#f59e0b', port: 8645, avatar: 'M' },
  { id: 'klaus',   name: 'Klaus',   role: 'Research Lead',  color: '#c2710f', port: 8646, avatar: 'K' },
];

const AGENTS_BY_ID = Object.fromEntries(AGENTS.map(a => [a.id, a]));

// Backend aggregation server — all API calls go through this
const BACKEND_URL = 'http://localhost:8899';
const POLL_INTERVAL = 5000;
let PAUSE_POLLING = false;

// Council config
let AUTO_SAVE_TRANSCRIPTS = true;
let COUNCIL_TRANSCRIPT_PATH = '04_PROJECTS/fleet-council/';
