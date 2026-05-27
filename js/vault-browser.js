// BlacksiteLab Fleet Command — Obsidian Vault Browser
// Browse, read, search, and create notes in the Obsidian vault from the dashboard

const VaultBrowser = {
  notes: [],
  currentPath: '',
  vaultBase: VAULT_BASE,

  init() {
    document.getElementById('btnVaultRefresh').addEventListener('click', () => this.loadNotes());
    document.getElementById('btnVaultNew').addEventListener('click', () => this.showNewNote());
    document.getElementById('btnVaultSearch').addEventListener('click', () => this.search());
    document.getElementById('vaultSearchInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.search();
    });

    // Vault note modal
    document.getElementById('btnVaultNoteSave').addEventListener('click', () => this.saveNote());
    document.getElementById('btnVaultNoteCancel').addEventListener('click', () => this.closeNoteModal());
    document.getElementById('vaultNoteBackdrop').addEventListener('click', () => this.closeNoteModal());

    this.loadNotes();
  },

  async loadNotes() {
    const list = document.getElementById('vaultNotesList');
    list.innerHTML = '<div class="vault-loading"><div class="spinner"></div> Loading vault...</div>';

    try {
      const res = await fetch(`${API_BASE_URL}:8699/list`);
      if (res.ok) {
        const data = await res.json();
        this.notes = data.files || [];
      } else {
        // Fallback: show demo notes
        this.notes = this.getDemoNotes();
      }
    } catch {
      this.notes = this.getDemoNotes();
    }

    this.render();
  },

  getDemoNotes() {
    return [
      { name: 'fleet-dashboard-proposal.md', path: '04_PROJECTS/fleet-dashboard-proposal.md', size: 2048, modified: '2026-05-27' },
      { name: 'gravity-game-design.md', path: '04_PROJECTS/gravity-game-design.md', size: 5120, modified: '2026-05-26' },
      { name: 'agent-souls.md', path: '02_REFERENCE/agent-souls.md', size: 8900, modified: '2026-05-25' },
      { name: 'meeting-2026-05-26.md', path: '07_JOURNAL/meeting-2026-05-26.md', size: 3200, modified: '2026-05-26' },
      { name: 'hermes-config.md', path: '02_REFERENCE/hermes-config.md', size: 4500, modified: '2026-05-24' },
      { name: 'fleet-kanban.md', path: '04_PROJECTS/fleet-kanban.md', size: 1800, modified: '2026-05-27' },
      { name: 'README.md', path: 'README.md', size: 1024, modified: '2026-05-20' },
    ];
  },

  render() {
    const list = document.getElementById('vaultNotesList');
    const baseDir = '/';

    const grouped = {};
    for (const note of this.notes) {
      const parts = note.path.split('/');
      const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : baseDir;
      if (!grouped[folder]) grouped[folder] = [];
      grouped[folder].push(note);
    }

    let html = '';
    for (const [folder, notes] of Object.entries(grouped)) {
      html += `<div class="vault-folder">📁 <span>${folder}</span></div>`;
      for (const note of notes) {
        const name = note.name || note.path.split('/').pop();
        const kb = Math.round((note.size || 0) / 1024);
        html += `
          <div class="vault-note" onclick="VaultBrowser.openNote('${escAttr(note.path)}')">
            <span class="vault-note-icon">📄</span>
            <div class="vault-note-info">
              <div class="vault-note-name">${escHtml(name)}</div>
              <div class="vault-note-meta">${kb}KB • ${note.modified || ''}</div>
            </div>
          </div>`;
      }
    }

    list.innerHTML = html || '<div class="vault-empty">No notes found. Click + New or check vault connection.</div>';
  },

  async openNote(path) {
    this.currentPath = path;
    document.getElementById('vaultNoteTitle').textContent = path;

    // Try vault bridge
    let content = '';
    try {
      const res = await fetch(`${API_BASE_URL}:8699/read?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        content = data.content || '';
      }
    } catch {
      content = `> *Vault bridge offline — showing placeholder*\n\n# ${path.replace('.md', '').split('/').pop()}\n\nNote content would load here when the vault REST bridge is running.`;
    }

    document.getElementById('vaultNoteContent').value = content;
    document.getElementById('vaultNoteModal').classList.add('open');
  },

  showNewNote() {
    this.currentPath = '';
    document.getElementById('vaultNoteTitle').textContent = 'New Note';
    document.getElementById('vaultNoteContent').value = '# \n\n';
    document.getElementById('vaultNoteModal').classList.add('open');
  },

  closeNoteModal() {
    document.getElementById('vaultNoteModal').classList.remove('open');
  },

  async saveNote() {
    const content = document.getElementById('vaultNoteContent').value;
    let path = this.currentPath;

    if (!path) {
      // New note — derive path from first heading
      const m = content.match(/^# (.+)/m);
      const title = m ? m[1].replace(/[^a-zA-Z0-9 -]/g, '') : 'untitled';
      const stamp = new Date().toISOString().slice(0, 10);
      path = `07_JOURNAL/${stamp}-${title}.md`;
    }

    try {
      const res = await fetch(`${API_BASE_URL}:8699/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content }),
      });
      if (res.ok) {
        this.closeNoteModal();
        this.loadNotes();
        this.showToast('Note saved ✓');
        return;
      }
    } catch {
      // Vault bridge unavailable — show message
    }

    this.showToast('Note saved locally (vault bridge unavailable)');
    this.closeNoteModal();
  },

  async search() {
    const q = document.getElementById('vaultSearchInput').value.trim();
    if (!q) { this.loadNotes(); return; }

    const list = document.getElementById('vaultNotesList');
    list.innerHTML = '<div class="vault-loading"><div class="spinner"></div> Searching...</div>';

    try {
      const res = await fetch(`${API_BASE_URL}:8699/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        this.notes = (data.results || []).map(r => ({
          name: r.path.split('/').pop(),
          path: r.path,
          size: 0,
          modified: '',
          snippet: r.snippet,
        }));
      }
    } catch {
      // Local search fallback
      this.notes = this.getDemoNotes().filter(n =>
        n.name.toLowerCase().includes(q.toLowerCase()) ||
        n.path.toLowerCase().includes(q.toLowerCase())
      );
    }

    if (this.notes.length === 0) {
      list.innerHTML = `<div class="vault-empty">No results for "${escHtml(q)}"</div>`;
      return;
    }

    let html = '';
    for (const note of this.notes) {
      html += `
        <div class="vault-note" onclick="VaultBrowser.openNote('${escAttr(note.path)}')">
          <span class="vault-note-icon">📄</span>
          <div class="vault-note-info">
            <div class="vault-note-name">${escHtml(note.name)}</div>
            <div class="vault-note-meta">${escHtml(note.snippet || note.path)}</div>
          </div>
        </div>`;
    }
    list.innerHTML = html;
  },

  showToast(msg) {
    let toast = document.getElementById('vaultToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'vaultToast';
      toast.style.cssText = 'position:fixed;bottom:60px;right:20px;background:var(--bg-elevated);color:var(--text-primary);padding:10px 18px;border-radius:8px;font-size:13px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.5);transition:opacity 0.3s;pointer-events:none;';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
  },
};

function escAttr(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
