# Fleet Dashboard

BlacksiteLab Fleet Command — a Precision Cockpit dashboard for monitoring and coordinating 5 Hermes Agent instances.

## Features

- **Fleet Topology Graph** — Canvas 2D visualization with 5 agent nodes in pentagonal layout, glow halos, pulsing status rings, particle effects, and hover tooltips
- **Agent Cards** — At-a-glance status for all 5 agents with color-coded avatars, online/busy/offline indicators, and current task snippets
- **Live Signals Feed** — Real-time activity stream with agent-colored badges and timestamps
- **Fleet Pulse** — Aggregated metrics: agents online, avg latency, signal count, active tasks
- **Kanban Board** — 4-column board with drag-and-drop, agent-color-coded task cards, priority badges, and add/edit/delete
- **Council Chamber** — "Full Debate" (staggered agent responses) and "Quick Poll" (agree/disagree consensus) modes
- **Hash Routing** — `#dashboard`, `#kanban`, `#council`, `#settings`
- **NZT Clock** — New Zealand Time display in status bar
- **API Integration** — Connects to Hermes Agent REST API (OpenAI-compatible, default ports 8642-8646) with configurable polling

## Architecture

Pure vanilla HTML/CSS/JS — no frameworks, no build step. Single `index.html` loads 8 JS modules and 1 CSS file.

## Agent Configuration

| Agent | Role | Color | Host Port |
|-------|------|-------|-----------|
| Claire | Chief of Staff | `#7c3aed` | 8644 |
| Sven | Dev Agent | `#06b6d4` | 8648 |
| Yuki | Infra Engineer | `#39FF14` | 8647 |
| Margot | Vault Keeper | `#f59e0b` | 8645 |
| Klaus | Research Lead | `#c2710f` | 8646 |

## Setup

```bash
# Serve locally
python3 -m http.server 8001

# Open in browser
open http://localhost:8001
```

The dashboard will attempt to connect to each agent's Hermes API at `http://localhost:PORT/v1/health/detailed`. Set the API key in Settings (`#settings`). When agents are unreachable, demo data is displayed.

## File Structure

```
fleet-dashboard/
├── index.html          # Main page — all HTML structure
├── css/
│   └── main.css        # Complete Precision Cockpit dark theme
└── js/
    ├── config.js       # Agent definitions, demo data, defaults
    ├── api.js          # Hermes API client (health, chat, responses, runs, jobs)
    ├── state.js        # Reactive state management + localStorage persistence
    ├── graph.js        # Canvas 2D fleet topology graph with particles
    ├── ui.js           # DOM rendering: status bar, agent cards, signals, metrics
    ├── kanban.js       # Kanban board with drag-and-drop + task CRUD
    ├── council.js      # Council chamber: Full Debate + Quick Poll
    └── app.js          # App controller: routing, polling, init
```

## License

MIT
