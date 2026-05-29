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

// Fallback simulated responses when agent APIs are unreachable
const SIMULATED_RESPONSES = {
  claire: (p) => `Claire (Chief of Staff): The proposal "${p.slice(0, 50)}..." requires fleet coordination. I recommend Sven handle implementation, with Yuki on infrastructure review and Klaus on background research. Margot should document the decision in the vault.`,
  sven: (p) => `Sven (Dev): I can build this. The architecture should be modular with clean API boundaries. Estimate: 4-8 hours for a prototype. Need Yuki to confirm the deployment target and Klaus to validate any research assumptions.`,
  yuki: (p) => `Yuki (Infra): From an infrastructure standpoint, we need to consider: 1) resource allocation per container, 2) network latency between the dashboard and agent hosts, 3) whether this adds new services that need monitoring. Docker compose changes would be minimal.`,
  margot: (p) => `Margot (Vault): I'll create the documentation trail. Need a project folder under 04_PROJECTS/ with a plan, implementation log, and post-mortem. All council decisions should be preserved as callout-annotated markdown.`,
  klaus: (p) => `Klaus (Research): Let me search for relevant precedents. Multi-agent topologies are well-studied in the literature — see AutoGen, CrewAI, and the Hermes agent orchestration patterns. I'll compile a briefing with key findings.`,
};
