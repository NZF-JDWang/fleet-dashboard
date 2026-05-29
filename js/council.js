// BlacksiteLab Fleet Command — Council Chamber v2
// Multi-round deliberation with consensus synthesis, transcript saving, vault bridge

const COUNCIL_ROUNDS = {
  initial: 'Round 1 — Initial Positions',
  rebuttal: 'Round 2 — Rebuttal & Deliberation',
  synthesis: 'Consensus Synthesis',
};

const Council = {
  transcript: [],
  debateActive: false,
  vaultBridgeUrl: '',

  init() {
    document.getElementById('btnFullDebate').addEventListener('click', () => this.startDebate('full'));
    document.getElementById('btnQuickPoll').addEventListener('click', () => this.startDebate('poll'));
    document.getElementById('btnDeliberate').addEventListener('click', () => this.startDeliberation());
    document.getElementById('btnSaveTranscript').addEventListener('click', () => this.saveTranscript());
    document.getElementById('btnCopyTranscript').addEventListener('click', () => this.copyTranscript());
    document.getElementById('btnClearCouncil').addEventListener('click', () => this.clearAll());

    // Toggle vault save option
    const autoSave = document.getElementById('councilAutoSave');
    if (autoSave) {
      autoSave.checked = AUTO_SAVE_TRANSCRIPTS;
      autoSave.addEventListener('change', () => {
        AUTO_SAVE_TRANSCRIPTS = autoSave.checked;
      });
    }

    // Set vault bridge URL from config
    this.vaultBridgeUrl = 'http://localhost:8699';
  },

  async startDebate(mode) {
    const proposal = document.getElementById('councilProposal').value.trim();
    if (!proposal) return;

    const results = document.getElementById('councilResults');
    results.innerHTML = '';
    this.transcript = [{ phase: 'proposal', content: proposal, time: new Date().toISOString() }];
    Council.showTypingStatus('Starting debate with all agents...');

    if (mode === 'poll') {
      await this.renderPoll(proposal);
    } else {
      await this.renderDebate(proposal);
    }
    Council.hideTypingStatus();
  },

  async startDeliberation() {
    const proposal = document.getElementById('councilProposal').value.trim();
    if (!proposal) return;
    if (this.debateActive) return;
    this.debateActive = true;

    const results = document.getElementById('councilResults');
    results.innerHTML = '';
    this.transcript = [{ phase: 'proposal', content: proposal, time: new Date().toISOString() }];

    // ---- Progressive Mode: Klaus + Yuki research briefing ----
    this.showTypingStatus('Klaus & Yuki: researching evidence...');
    const briefing = await this.runResearchBriefing(proposal);

    // ---- Round 1: Initial Positions ----
    this.updateTypingStatus('Round 1: Gathering initial positions...');
    await this.renderRound(proposal, 'initial');
    this.updateTypingStatus('Round 2: Processing rebuttals...');

    // ---- Round 2: Each agent sees all Round 1 responses and refines ----
    await this.renderRoundHeader('rebuttal');
    const round1Responses = this.transcript.filter(t => t.phase === 'round1').map(t => ({
      agent: t.agent, name: t.name, content: t.content,
    }));

    const rebuttalPromises = AGENTS.map(async (agent) => {
      const context = round1Responses
        .filter(r => r.agent !== agent.id)
        .map(r => `**${r.name} (${r.role}):** ${r.content.slice(0, 300)}...`)
        .join('\n\n');

      const result = await ApiClient.sendChat(agent.id, [
        { role: 'system', content: `You are ${agent.name}, ${agent.role} at BlacksiteLab. You are in a council deliberation. You just heard your colleagues' initial positions. Now provide your refined position: what do you agree with, what concerns remain, and what is your recommended path forward? Be concise.` },
        { role: 'user', content: `Original proposal: "${proposal}"\n\nYour colleagues' Round 1 positions:\n${context}\n\nNow provide your refined position.` },
      ]);

      let content, latency;
      if (result.status === 'ok') {
        content = result.content;
        latency = result.latency;
      } else {
        const simFn = SIMULATED_RESPONSES[agent.id];
        content = simFn ? simFn(proposal) : '[Analysis unavailable]';
        latency = 0;
      }
      return { agent, content, latency, live: result.status === 'ok' };
    });

    for (const promise of rebuttalPromises) {
      const { agent, content, latency, live } = await promise;
      this.transcript.push({
        phase: 'round2', agent: agent.id, name: agent.name, role: agent.role,
        content, latency, live, time: new Date().toISOString(),
      });
      this.renderAgentResponse(results, agent, content, latency, live, 'round2');
    }

    // ---- Consensus Synthesis ----
    this.updateTypingStatus('Synthesizing consensus...');
    await this.renderRoundHeader('synthesis');
    await this.synthesizeConsensus(proposal, results);
    this.hideTypingStatus();
    this.debateActive = false;

    // Auto-save if enabled
    if (AUTO_SAVE_TRANSCRIPTS) await this.saveTranscript();
  },

  async runResearchBriefing(proposal) {
    const results = document.getElementById('councilResults');

    // Parallel: Klaus (research) + Yuki (tech feasibility)
    const [klausResult, yukiResult] = await Promise.all([
      ApiClient.sendChat('klaus', [
        { role: 'system', content: `You are Klaus, Research Lead at BlacksiteLab. Summarize relevant research, evidence, and best practices for this topic. Be concise (2-4 bullet points).` },
        { role: 'user', content: `Research briefing request: "${proposal}". What does the literature, data, or precedent say?` },
      ]),
      ApiClient.sendChat('yuki', [
        { role: 'system', content: `You are Yuki, Infra Engineer at BlacksiteLab. Assess technical feasibility, infrastructure implications, and security concerns. Be concise (2-4 bullet points).` },
        { role: 'user', content: `Tech feasibility assessment: "${proposal}". What infra, security, or ops concerns exist?` },
      ]),
    ]);

    const klausContent = klausResult.status === 'ok' ? klausResult.content : 'Research: multiple precedents exist; recommended to standardize fleet-wide.';
    const yukiContent = yukiResult.status === 'ok' ? yukiResult.content : 'Tech: feasible with current stack; monitor resource usage.';

    this.transcript.push({
      phase: 'briefing', agent: 'klaus', name: 'Klaus', role: 'Research Lead',
      content: klausContent, latency: klausResult.latency || 0,
      live: klausResult.status === 'ok', time: new Date().toISOString(),
    });
    this.transcript.push({
      phase: 'briefing', agent: 'yuki', name: 'Yuki', role: 'Infra Engineer',
      content: yukiContent, latency: yukiResult.latency || 0,
      live: yukiResult.status === 'ok', time: new Date().toISOString(),
    });

    // Render briefing section
    const briefingEl = document.createElement('div');
    briefingEl.className = 'briefing-section';
    briefingEl.innerHTML = `<div class="council-round-header"><span class="round-marker">◆</span> Research Briefing</div>`;
    results.appendChild(briefingEl);

    this.renderAgentResponse(results, AGENTS_BY_ID.klaus, klausContent, klausResult.latency || 0, klausResult.status === 'ok', 'briefing');
    this.renderAgentResponse(results, AGENTS_BY_ID.yuki, yukiContent, yukiResult.latency || 0, yukiResult.status === 'ok', 'briefing');

    return { klaus: klausContent, yuki: yukiContent };
  },

  async renderRound(proposal, phase) {
    const results = document.getElementById('councilResults');
    const label = COUNCIL_ROUNDS[phase];
    this.renderRoundHeader(phase);

    const agentPromises = AGENTS.map(async (agent) => {
      const systemPrompt = phase === 'initial'
        ? `You are ${agent.name}, ${agent.role} at BlacksiteLab. Respond with your professional analysis.`
        : `You are ${agent.name}, ${agent.role} at BlacksiteLab. You are now in the rebuttal round.`;

      const result = await ApiClient.sendChat(agent.id, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `As ${agent.name} (${agent.role}) at BlacksiteLab, the operator has proposed: "${proposal}". Provide your professional analysis — what you agree with, concerns, and recommended actions. Be concise.` },
      ]);

      let content, latency;
      if (result.status === 'ok') {
        content = result.content;
        latency = result.latency;
      } else {
        const simFn = SIMULATED_RESPONSES[agent.id];
        content = simFn ? simFn(proposal) : `[${agent.name}: Unable to reach API for analysis]`;
        latency = 0;
      }
      return { agent, content, latency, live: result.status === 'ok' };
    });

    for (const promise of agentPromises) {
      const { agent, content, latency, live } = await promise;
      this.transcript.push({
        phase: 'round1', agent: agent.id, name: agent.name, role: agent.role,
        content, latency, live, time: new Date().toISOString(),
      });
      this.renderAgentResponse(results, agent, content, latency, live, 'round1');
    }
  },

  renderRoundHeader(phase) {
    const results = document.getElementById('councilResults');
    const label = COUNCIL_ROUNDS[phase] || phase;
    const header = document.createElement('div');
    header.className = 'council-round-header';
    header.innerHTML = `<span class="round-marker">◆</span> ${label}`;
    results.appendChild(header);
  },

  renderAgentResponse(results, agent, content, latency, live, round) {
    const el = document.createElement('div');
    el.className = 'agent-response';
    el.style.cssText = `--agent-color:${agent.color};border-left-color:${agent.color}`;
    const source = live ? `API • ${latency}ms` : 'simulated';
    el.innerHTML = `
      <div class="response-header">
        <div class="response-avatar" style="background:${agent.color}">${agent.avatar}</div>
        <div>
          <div style="font-size:13px;font-weight:600;color:${agent.color}">${agent.name}</div>
          <div class="response-meta">${agent.role} <span class="response-source">• ${source}</span></div>
        </div>
      </div>
      <div class="response-body">${escHtml(content)}</div>
    `;
    results.appendChild(el);
    results.scrollTop = results.scrollHeight;
  },

  async synthesizeConsensus(proposal, results) {
    // Use Claire (chief of staff) to synthesize
    const allResponses = this.transcript
      .filter(t => t.phase === 'round1' || t.phase === 'round2')
      .map(t => `**${t.name} (R${t.phase === 'round1' ? '1' : '2'}):** ${t.content.slice(0, 400)}`)
      .join('\n\n---\n\n');

    const synthPrompt = [
      { role: 'system', content: 'You are Claire, Chief of Staff at BlacksiteLab. Synthesize the fleet council deliberation into a concise decision brief. Identify: (1) Points of consensus, (2) Remaining disagreements, (3) Your recommended decision with rationale, (4) Next steps and action items assigned to specific agents.' },
      { role: 'user', content: `Proposal: "${proposal}"\n\nFleet Council Deliberation:\n${allResponses}\n\nSynthesize the decision brief.` },
    ];

    const result = await ApiClient.sendChat('claire', synthPrompt);
    let synthContent, latency, live;
    if (result.status === 'ok') {
      synthContent = result.content;
      latency = result.latency;
      live = true;
    } else {
      synthContent = `**Consensus Brief (simulated)**\n\n1. **Points of Consensus:** The fleet agrees this proposal merits consideration.\n2. **Remaining Disagreements:** Implementation details require further specification.\n3. **Recommended Decision:** Proceed with a pilot phase, assign Sven to prototype, Yuki to assess infra impact.\n4. **Next Steps:** Sven delivers prototype within 48h; full fleet review follows.`;
      latency = 0;
      live = false;
    }

    this.transcript.push({
      phase: 'synthesis', agent: 'claire', name: 'Claire', role: 'Chief of Staff',
      content: synthContent, latency, live, time: new Date().toISOString(),
    });

    const el = document.createElement('div');
    el.className = 'council-synthesis';
    el.innerHTML = `
      <div class="synth-header">
        <div class="synth-badge">${live ? '◆ LIVE' : '◆ SIMULATED'} Consensus</div>
        <div class="synth-by">Synthesized by Claire — Chief of Staff ${live ? `• ${latency}ms` : ''}</div>
      </div>
      <div class="synth-body">${markdownToHtml(synthContent)}</div>
    `;
    results.appendChild(el);
    results.scrollTop = results.scrollHeight;
  },

  async renderDebate(proposal) {
    const results = document.getElementById('councilResults');

    results.innerHTML = AGENTS.map(a => `
      <div class="agent-response" style="--agent-color:${a.color};border-left-color:${a.color}" id="resp-${a.id}">
        <div class="response-header">
          <div class="response-avatar" style="background:${a.color}">${a.avatar}</div>
          <div>
            <div style="font-size:13px;font-weight:600;color:${a.color}">${a.name}</div>
            <div class="response-meta" id="meta-${a.id}">${a.role}</div>
          </div>
        </div>
        <div class="response-loading" id="loading-${a.id}">
          <div class="spinner"></div> Analyzing...
        </div>
      </div>
    `).join('');

    const agentPromises = AGENTS.map(async (agent) => {
      const result = await ApiClient.sendChat(agent.id, [
        { role: 'system', content: `You are ${agent.name}, ${agent.role} at BlacksiteLab. Respond with your analysis.` },
        { role: 'user', content: `As ${agent.name} (${agent.role}) at BlacksiteLab, the operator has proposed: "${proposal}". Provide your professional analysis — what you agree with, concerns, and recommended actions. Be concise.` },
      ]);

      let content, latency;
      if (result.status === 'ok') {
        content = result.content;
        latency = result.latency;
      } else {
        const simFn = SIMULATED_RESPONSES[agent.id] || (() => `[Analysis unavailable for this topic]`);
        content = simFn(proposal);
        latency = 0;
      }
      return { agent, content, latency, live: result.status === 'ok' };
    });

    for (const promise of agentPromises) {
      const { agent, content, latency, live } = await promise;
      this.transcript.push({
        phase: 'round1', agent: agent.id, name: agent.name, role: agent.role,
        content, latency, live, time: new Date().toISOString(),
      });

      const loadingEl = document.getElementById(`loading-${agent.id}`);
      if (loadingEl) loadingEl.remove();

      const respEl = document.getElementById(`resp-${agent.id}`);
      if (respEl) {
        const bodyEl = document.createElement('div');
        bodyEl.className = 'response-body';
        bodyEl.textContent = content;
        respEl.appendChild(bodyEl);
        const meta = document.getElementById(`meta-${agent.id}`);
        if (meta) meta.textContent += live ? ` • ${latency}ms` : ' • simulated';
      }
    }
  },

  async renderPoll(proposal) {
    const results = document.getElementById('councilResults');
    results.innerHTML = `
      <div class="poll-grid">
        ${AGENTS.map(a => `
          <div class="poll-agent" id="poll-${a.id}">
            <div class="poll-avatar" style="background:${a.color}">${a.avatar}</div>
            <div class="poll-name">${a.name}</div>
            <div class="poll-vote" id="vote-${a.id}">
              <div class="spinner" style="margin:0 auto"></div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="consensus-bar" id="consensusBar" style="display:none"></div>
    `;

    const pollPrompt = `Respond with ONLY one word: "AGREE" or "DISAGREE". No explanation. Proposal: "${proposal}"`;

    const agentPromises = AGENTS.map(async (agent) => {
      const result = await ApiClient.sendChat(agent.id, [
        { role: 'user', content: pollPrompt },
      ]);
      let vote;
      if (result.status === 'ok') {
        const upper = result.content.toUpperCase();
        if (upper.includes('AGREE')) vote = 'agree';
        else if (upper.includes('DISAGREE')) vote = 'disagree';
        else vote = 'uncertain';
      } else {
        const tendencies = { claire: 'agree', sven: 'agree', yuki: 'disagree', margot: 'agree', klaus: 'disagree' };
        vote = tendencies[agent.id] || 'agree';
      }
      return { agent, vote, live: result.status === 'ok' };
    });

    let agree = 0, disagree = 0, errors = 0;
    for (const promise of agentPromises) {
      const { agent, vote, live } = await promise;
      this.transcript.push({
        phase: 'poll', agent: agent.id, name: agent.name, vote, live, time: new Date().toISOString(),
      });
      const voteEl = document.getElementById(`vote-${agent.id}`);
      let emoji;
      if (vote === 'agree') { emoji = '✅'; agree++; }
      else if (vote === 'disagree') { emoji = '❌'; disagree++; }
      else { emoji = '🤷'; errors++; }
      if (!live) emoji += ' *';
      if (voteEl) voteEl.textContent = emoji;
    }

    const bar = document.getElementById('consensusBar');
    bar.style.display = 'block';
    const total = AGENTS.length;
    if (agree > disagree && agree > total / 2) {
      bar.innerHTML = `<div class="consensus-result" style="color:var(--success)">Consensus: Agree</div><div class="consensus-label">${agree}/${total} agents in favor • * = simulated</div>`;
    } else if (disagree > agree && disagree > total / 2) {
      bar.innerHTML = `<div class="consensus-result" style="color:var(--danger)">Consensus: Disagree</div><div class="consensus-label">${disagree}/${total} agents opposed • * = simulated</div>`;
    } else {
      bar.innerHTML = `<div class="consensus-result" style="color:var(--warning)">Split Decision</div><div class="consensus-label">${agree} agree • ${disagree} disagree • ${errors} uncertain</div>`;
    }
  },

  // ---- Transcript saving ----
  async saveTranscript() {
    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const proposal = this.transcript.find(t => t.phase === 'proposal');
    const title = proposal
      ? proposal.content.slice(0, 60).replace(/[^a-zA-Z0-9 ]/g, '')
      : 'council-session';

    const md = this.buildTranscriptMarkdown();

    // Try vault bridge
    const vaultPath = `${COUNCIL_TRANSCRIPT_PATH}${stamp}-${title}.md`;
    try {
      const res = await fetch(`${this.vaultBridgeUrl}/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: vaultPath, content: md }),
      });
      if (res.ok) {
        this.showToast('Transcript saved to vault ✓');
        return;
      }
    } catch (e) {
      // Vault bridge not available — fall through to download
    }

    // Fallback: download as file
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${stamp}-${title}.md`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('Transcript downloaded (vault bridge unavailable)');
  },

  buildTranscriptMarkdown() {
    const proposal = this.transcript.find(t => t.phase === 'proposal');
    const title = proposal
      ? proposal.content.slice(0, 60).replace(/[^a-zA-Z0-9 ]/g, '')
      : 'council-session';
    const now = new Date().toISOString();
    const lines = [];

    // YAML frontmatter for Margot's vault schema
    lines.push('---');
    lines.push('created: ' + now.slice(0, 10));
    lines.push('type: council-transcript');
    lines.push("tags: [council, fleet, transcript]");
    lines.push(`aliases: ["Council: ${title}"]`);
    lines.push(`summary: "${title}"`);
    lines.push('agents: [claire, sven, yuki, margot, klaus]');
    lines.push('---');
    lines.push('');

    lines.push(`# Fleet Council Transcript\n`);
    lines.push(`**Session:** ${now}`);
    lines.push(`**Participants:** Claire, Sven, Yuki, Margot, Klaus\n`);

    // Synthesis block goes FIRST (decision brief at top)
    const synthEntry = this.transcript.find(t => t.phase === 'synthesis');
    if (synthEntry) {
      lines.push('> [!abstract]+ Decision Brief (Synthesized by Claire)');
      lines.push('> ' + synthEntry.content.replace(/\n/g, '\n> '));
      lines.push('');
    }

    if (proposal) {
      lines.push(`## Proposal\n`);
      lines.push('> [!question] Proposal');
      lines.push('> ' + proposal.content.replace(/\n/g, '\n> '));
      lines.push('');
    }

    // Briefing — Klaus + Yuki research
    const briefing = this.transcript.filter(t => t.phase === 'briefing');
    if (briefing.length) {
      lines.push('## Research Briefing\n');
      for (const entry of briefing) {
        const id = (entry.agent || entry.name || '').toLowerCase();
        lines.push(`> [!${id}]+ ${entry.name} — ${entry.role}`);
        lines.push('> ' + entry.content.replace(/\n/g, '\n> '));
        lines.push('');
      }
    }

    // Round 1 — each agent as an Obsidian callout
    const round1 = this.transcript.filter(t => t.phase === 'round1');
    if (round1.length) {
      lines.push('## Round 1 — Initial Positions\n');
      for (const entry of round1) {
        const src = entry.live ? '⚡ API' : '📋 simulated';
        const id = (entry.agent || entry.name || '').toLowerCase();
        lines.push(`> [!${id}]+ ${entry.name} — ${entry.role} [${src}]`);
        lines.push('> ' + entry.content.replace(/\n/g, '\n> '));
        lines.push('');
      }
    }

    // Round 2 — rebuttal
    const round2 = this.transcript.filter(t => t.phase === 'round2');
    if (round2.length) {
      lines.push('## Round 2 — Rebuttal & Deliberation\n');
      for (const entry of round2) {
        const src = entry.live ? '⚡ API' : '📋 simulated';
        const id = (entry.agent || entry.name || '').toLowerCase();
        lines.push(`> [!${id}]+ ${entry.name} — ${entry.role} [${src}]`);
        lines.push('> ' + entry.content.replace(/\n/g, '\n> '));
        lines.push('');
      }
    }

    // Poll results as summary
    const pollEntries = this.transcript.filter(t => t.phase === 'poll');
    if (pollEntries.length) {
      lines.push('## Quick Poll Results\n');
      for (const entry of pollEntries) {
        const emoji = entry.vote === 'agree' ? '✅' : entry.vote === 'disagree' ? '❌' : '🤷';
        const sim = entry.live ? '' : ' (sim)';
        lines.push(`- ${emoji} **${entry.name}:** ${entry.vote}${sim}`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push(`*Session: ${now}*`);
    lines.push(`*Generated by BlacksiteLab Fleet Command*`);
    return lines.join('\n');
  },

  async copyTranscript() {
    const md = this.buildTranscriptMarkdown();
    try {
      await navigator.clipboard.writeText(md);
      this.showToast('Transcript copied to clipboard ✓');
    } catch {
      this.showToast('Failed to copy — check permissions');
    }
  },

  clearAll() {
    this.transcript = [];
    document.getElementById('councilResults').innerHTML =
      '<div class="council-empty">Council results will appear here.</div>';
    document.getElementById('councilProposal').value = '';
  },

  showToast(msg) {
    let toast = document.getElementById('councilToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'councilToast';
      toast.style.cssText = 'position:fixed;bottom:60px;right:20px;background:var(--bg-elevated);color:var(--text-primary);padding:10px 18px;border-radius:8px;font-size:13px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.5);transition:opacity 0.3s;pointer-events:none;';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
  },

  // Typing indicator helpers
  showTypingStatus(msg) {
    const results = document.getElementById('councilResults');
    let el = document.getElementById('typingIndicator');
    if (!el) {
      el = document.createElement('div');
      el.id = 'typingIndicator';
      el.className = 'typing-indicator';
      results.appendChild(el);
    }
    el.innerHTML = `<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span> ${msg}`;
    el.style.display = 'flex';
    results.scrollTop = results.scrollHeight;
  },

  updateTypingStatus(msg) {
    const el = document.getElementById('typingIndicator');
    if (el) {
    el.innerHTML = `<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span> ${msg}`;
      const results = document.getElementById('councilResults');
      results.scrollTop = results.scrollHeight;
    }
  },

  hideTypingStatus() {
    const el = document.getElementById('typingIndicator');
    if (el) el.style.display = 'none';
  },
};

// Helpers
function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function markdownToHtml(md) {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
    .replace(/^### (.+)/gm, '<h4>$1</h4>')
    .replace(/^## (.+)/gm, '<h3>$1</h3>')
    .replace(/^# (.+)/gm, '<h2>$1</h2>')
    .replace(/^- (.+)/gm, '• $1')
    .replace(/^> (.+)/gm, '<blockquote>$1</blockquote>');
}
