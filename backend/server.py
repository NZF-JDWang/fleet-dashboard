#!/usr/bin/env python3
"""Fleet Dashboard Backend — Aggregation server for BlacksiteLab agent fleet.

Serves static frontend files and exposes REST API endpoints:
  GET  /api/agents       — Health-poll all 5 agents
  GET  /api/signals      — Recent messages from Sven's session DB
  GET  /api/kanban       — Read kanban tasks from vault persistence
  POST /api/kanban       — Create kanban task
  PUT  /api/kanban/<id>  — Update kanban task
  DELETE /api/kanban/<id> — Delete kanban task
  POST /api/council/chat — Proxy chat to Claire (other agents when APIs enabled)

Run:
  cd /home/intern/dev/fleet-dashboard && python3 backend/server.py

Listens on localhost:8899.
"""

import http.server
import json
import os
import re
import sqlite3
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse, parse_qs

# ── Config ──────────────────────────────────────────────────────────────
PORT = 8899
STATIC_DIR = Path(__file__).resolve().parent.parent  # fleet-dashboard/
STATE_DB = Path(os.environ.get("STATE_DB", "/home/intern/.hermes/state.db"))
KANBAN_FILE = Path(os.environ.get("KANBAN_FILE", "/vault/94_SVENS_WORKSPACE/fleet-kanban.json"))
HEALTH_TIMEOUT = 5  # seconds per agent

AGENTS = [
    {"id": "claire",  "port": 8644, "host": "host.docker.internal"},
    {"id": "margot",  "port": 8645, "host": "host.docker.internal"},
    {"id": "klaus",   "port": 8646, "host": "host.docker.internal"},
    {"id": "yuki",    "port": 8647, "host": "host.docker.internal"},
    {"id": "sven",    "port": 8648, "host": "host.docker.internal"},
]

# ── Agent Health Polling (thread-safe cache) ────────────────────────────
_health_cache = {}
_health_cache_lock = threading.Lock()


def _check_agent(agent):
    """Poll a single agent's /health endpoint."""
    url = f"http://{agent['host']}:{agent['port']}/health"
    start = time.monotonic()
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=HEALTH_TIMEOUT) as resp:
            latency = round((time.monotonic() - start) * 1000)
            data = json.loads(resp.read())
            # Claire's /health returns {"status": "ok"}, normalize to "online"
            raw_status = data.get("status", "offline")
            status = "online" if raw_status in ("ok", "online") else raw_status
            return {"status": status, "latency": latency, "platform": data.get("platform", "")}
    except Exception as e:
        return {"status": "offline", "latency": 0}


def get_agent_health():
    """Return health status for all agents using cached results."""
    with _health_cache_lock:
        return dict(_health_cache)


def refresh_health():
    """Poll all agents in parallel, update cache."""
    results = {}
    threads = []
    def worker(agent):
        results[agent["id"]] = _check_agent(agent)
    for agent in AGENTS:
        t = threading.Thread(target=worker, args=(agent,))
        t.start()
        threads.append(t)
    for t in threads:
        t.join(timeout=HEALTH_TIMEOUT + 2)
    with _health_cache_lock:
        _health_cache.clear()
        _health_cache.update(results)
    return results


# ── Session DB Signals ──────────────────────────────────────────────────
def get_signals(limit=50):
    """Read recent user+assistant messages from Sven's session DB."""
    try:
        conn = sqlite3.connect(str(STATE_DB))
        conn.row_factory = sqlite3.Row
        rows = conn.execute("""
            SELECT m.id, m.role, substr(m.content, 1, 200) as content,
                   m.tool_name, m.session_id, s.title as session_title,
                   datetime(m.timestamp, 'unixepoch') as timestamp,
                   m.tool_calls, m.finish_reason
            FROM messages m
            JOIN sessions s ON m.session_id = s.id
            WHERE m.role IN ('user', 'assistant')
            ORDER BY m.timestamp DESC
            LIMIT ?
        """, (limit,)).fetchall()
        conn.close()

        signals = []
        for row in rows:
            d = dict(row)
            # Classify signal type
            signal_type = "message"
            if d["tool_name"]:
                signal_type = "tool"
            elif d["role"] == "assistant" and d.get("tool_calls"):
                signal_type = "tool_call"

            signals.append({
                "id": d["id"],
                "role": d["role"],
                "content": d["content"] or "",
                "type": signal_type,
                "tool": d["tool_name"],
                "session": d["session_title"] or d["session_id"][:12],
                "time": d["timestamp"],
                "finish_reason": d.get("finish_reason"),
            })
        return signals
    except Exception:
        return []


# ── Kanban Persistence ──────────────────────────────────────────────────
def _ensure_kanban_file():
    """Create kanban file with defaults if it doesn't exist."""
    if not KANBAN_FILE.exists():
        KANBAN_FILE.parent.mkdir(parents=True, exist_ok=True)
        default_tasks = [
            {"id": "t1", "title": "Add fleet topology graph", "desc": "Canvas-based graph showing 5 agents with glow halos", "column": "done", "assignee": "sven", "priority": "high"},
            {"id": "t2", "title": "Build council chamber modal", "desc": "Full debate + quick poll with Hermes API integration", "column": "review", "assignee": "sven", "priority": "high"},
            {"id": "t3", "title": "Wire up real-time status polling", "desc": "Poll /health every 5s for each agent", "column": "in-progress", "assignee": "sven", "priority": "medium"},
            {"id": "t4", "title": "Add drag-and-drop to kanban", "desc": "Implement HTML5 drag API for task cards between columns", "column": "in-progress", "assignee": "sven", "priority": "medium"},
            {"id": "t5", "title": "Design agent settings page", "desc": "Per-agent API key, port, and endpoint config", "column": "backlog", "assignee": "claire", "priority": "low"},
            {"id": "t6", "title": "Add WebSocket support", "desc": "Replace polling with WS for real-time signals", "column": "backlog", "assignee": "yuki", "priority": "low"},
            {"id": "t7", "title": "Implement Obsidian vault bridge", "desc": "Read/write notes to Obsidian vault from dashboard", "column": "backlog", "assignee": "margot", "priority": "medium"},
        ]
        _write_kanban(default_tasks)


def _read_kanban():
    """Read kanban tasks from vault file."""
    _ensure_kanban_file()
    try:
        return json.loads(KANBAN_FILE.read_text())
    except (json.JSONDecodeError, FileNotFoundError):
        return []


def _write_kanban(tasks):
    """Write kanban tasks to vault file."""
    KANBAN_FILE.parent.mkdir(parents=True, exist_ok=True)
    KANBAN_FILE.write_text(json.dumps(tasks, indent=2))


# ── Council Proxy ───────────────────────────────────────────────────────
OLLAMA_CHAT = "http://172.17.0.1:11434/v1/chat/completions"

AGENT_MODELS = {
    "claire": "glm-5.1:cloud",
    "sven":   "deepseek-v4-pro:cloud",
    "yuki":   "deepseek-v4-flash:cloud",
    "margot": "glm-5.1:cloud",
    "klaus":  "kimi-k2.6:cloud",
}

AGENT_PERSONAS = {
    "claire": (
        "You are Claire, Chief of Staff at BlacksiteLab. You coordinate the fleet of AI agents, "
        "route work, and synthesize decisions. You are precise, decisive, and keep the lab running. "
        "Respond in character — direct, competent, no fluff."
    ),
    "sven": (
        "You are Sven, a Swedish expert coding agent at BlacksiteLab. You build, debug, review, "
        "and ship code with precision. You are calm, exact, literal, and methodical. "
        "You value compact correct code. Respond as Sven — direct, technical, no jokes."
    ),
    "yuki": (
        "You are Yuki, Infra Engineer at BlacksiteLab. You manage servers, containers, networking, "
        "and keep the infrastructure reliable. You think in terms of ports, latency, resource usage, "
        "and security. Respond as Yuki — practical, ops-focused, no hand-waving."
    ),
    "margot": (
        "You are Margot, Vault Keeper at BlacksiteLab. You maintain the Obsidian knowledge base, "
        "enforce schema rules, and ensure information is findable and correct. You care about "
        "structure, tags, frontmatter, and long-term knowledge preservation. Respond as Margot."
    ),
    "klaus": (
        "You are Klaus, Research Lead at BlacksiteLab. You search for evidence, precedents, "
        "and best practices. You ground decisions in data and literature. You cite sources "
        "when possible and flag assumptions. Respond as Klaus — inquisitive, evidence-driven."
    ),
}


def proxy_chat(agent_id, messages):
    """Route council chat through Ollama with per-agent persona + model."""
    model = AGENT_MODELS.get(agent_id)
    persona = AGENT_PERSONAS.get(agent_id)
    if not model:
        return {"status": "error", "message": f"Unknown agent: {agent_id}"}

    # Prepend persona system prompt — frontend may also send its own system prompt,
    # so we inject as the first message to anchor the identity
    full_messages = [{"role": "system", "content": persona}] + messages

    body = json.dumps({
        "model": model,
        "messages": full_messages,
        "max_tokens": 2048,
        "temperature": 0.7,
    }).encode()

    try:
        req = urllib.request.Request(OLLAMA_CHAT, data=body)
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            return {"status": "ok", "content": content}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode(errors="replace")
        return {"status": "error", "http_status": e.code, "body": err_body}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ── HTTP Server ─────────────────────────────────────────────────────────
class FleetDashboardHandler(http.server.SimpleHTTPRequestHandler):
    """Handles static file serving + API endpoint routing."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def log_message(self, format, *args):
        """Suppress default logging noise — use our own format."""
        pass

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # API routes
        if path == "/api/agents":
            self._json_response(get_agent_health())
            return
        if path == "/api/signals":
            limit = int(parse_qs(parsed.query).get("limit", [50])[0])
            self._json_response(get_signals(limit))
            return
        if path == "/api/kanban":
            self._json_response(_read_kanban())
            return
        if path == "/api/health":
            self._json_response({"status": "ok", "backend": "fleet-dashboard"})
            return

        # Static file serving
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/kanban":
            body = self._read_body()
            try:
                task = json.loads(body)
            except json.JSONDecodeError:
                self._json_response({"error": "Invalid JSON"}, 400)
                return
            tasks = _read_kanban()
            task["id"] = "t" + str(int(time.time() * 1000))
            task["column"] = task.get("column", "backlog")
            tasks.append(task)
            _write_kanban(tasks)
            self._json_response(task, 201)
            return

        if path == "/api/council/chat":
            body = self._read_body()
            try:
                payload = json.loads(body)
            except json.JSONDecodeError:
                self._json_response({"error": "Invalid JSON"}, 400)
                return
            agent_id = payload.get("agent")
            messages = payload.get("messages", [])
            result = proxy_chat(agent_id, messages)
            self._json_response(result)
            return

        # Fallback: 404
        self._json_response({"error": "Not found"}, 404)

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path

        match = re.match(r"^/api/kanban/(.+)$", path)
        if match:
            task_id = match.group(1)
            body = self._read_body()
            try:
                updates = json.loads(body)
            except json.JSONDecodeError:
                self._json_response({"error": "Invalid JSON"}, 400)
                return
            tasks = _read_kanban()
            for task in tasks:
                if task["id"] == task_id:
                    task.update(updates)
                    task["id"] = task_id  # never change id
                    _write_kanban(tasks)
                    self._json_response(task)
                    return
            self._json_response({"error": "Task not found"}, 404)
            return

        self._json_response({"error": "Not found"}, 404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path

        match = re.match(r"^/api/kanban/(.+)$", path)
        if match:
            task_id = match.group(1)
            tasks = _read_kanban()
            tasks = [t for t in tasks if t["id"] != task_id]
            _write_kanban(tasks)
            self._json_response({"ok": True})
            return

        self._json_response({"error": "Not found"}, 404)

    def do_OPTIONS(self):
        """CORS preflight."""
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    # ── Helpers ──────────────────────────────────────────────────────

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(length).decode() if length else ""

    def _json_response(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self._cors_headers()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")


def start_health_poller(interval=5):
    """Background thread that periodically polls all agents."""
    def loop():
        while True:
            try:
                refresh_health()
            except Exception:
                pass
            time.sleep(interval)
    t = threading.Thread(target=loop, daemon=True)
    t.start()


def main():
    # Seed initial health cache
    print(f"Starting Fleet Dashboard backend on :{PORT} ...")
    print(f"  Static dir: {STATIC_DIR}")
    print(f"  State DB:   {STATE_DB}")
    print(f"  Kanban:     {KANBAN_FILE}")

    refresh_health()
    start_health_poller()

    server = http.server.HTTPServer(("0.0.0.0", PORT), FleetDashboardHandler)
    print(f"  Listening on http://0.0.0.0:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.shutdown()


if __name__ == "__main__":
    main()
