// BlacksiteLab Fleet Command — Council Chamber

// Simulated responses for when APIs are unreachable. Each agent has a unique persona.
const SIMULATED_RESPONSES = {
  claire: (proposal) => `As Chief of Staff, I see this as primarily a coordination challenge. The proposal has merit — ${proposal.slice(0, 60)}... — but we need to assess: (1) Does this align with our current priorities? (2) What's the resource cost vs. benefit? (3) How does it affect each agent's workload?\n\nMy recommendation: Let me gather input from the fleet, assess impact, and present a decision framework. We should move deliberately, not hastily.`,

  sven: (proposal) => `Looking at this from a technical implementation perspective: ${proposal.slice(0, 60)}...\n\nI'd want to break this down into concrete deliverables. What's the API surface? What needs refactoring? Can we ship incrementally? I'm ready to start prototyping once we have clear requirements. The key is shipping something that works and iterating — not getting bogged down in analysis paralysis.`,

  yuki: (proposal) => `Infrastructure angle: ${proposal.slice(0, 60)}...\n\nWe need to think about deployment, scaling, monitoring, and rollback strategy. What's the blast radius if this goes wrong? Do we need new containers, ports, or credentials? I'd want a staging environment to test before anything hits production. Keep me in the loop early — infrastructure surprises are the expensive kind.`,

  margot: (proposal) => `Vault perspective: ${proposal.slice(0, 60)}...\n\nI need to know what gets documented: new schemas, config files, API contracts, decision records. Every change creates knowledge debt if we don't track it. I'd propose we create a linked note with the proposal, fleet responses, final decision, and outcome — so we can reference it later. The vault is our institutional memory.`,

  klaus: (proposal) => `Research analysis: ${proposal.slice(0, 60)}...\n\nI've been reading about similar approaches. There are interesting parallels in the literature — multi-agent coordination patterns, consensus algorithms, and decision frameworks. The academic consensus suggests structured deliberation outperforms ad-hoc voting. I can prepare a brief lit review if we need evidence to support our decision.`,
};

const Council = {
  init() {
    document.getElementById('btnFullDebate').addEventListener('click', () => this.startDebate('full'));
    document.getElementById('btnQuickPoll').addEventListener('click', () => this.startDebate('poll'));
  },

  async startDebate(mode) {
    const proposal = document.getElementById('councilProposal').value.trim();
    if (!proposal) return;

    const results = document.getElementById('councilResults');
    results.innerHTML = '';

    if (mode === 'poll') {
      await this.renderPoll(proposal);
    } else {
      await this.renderDebate(proposal);
    }
  },

  async renderDebate(proposal) {
    const results = document.getElementById('councilResults');

    // Show all agent cards with loading spinners
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

    // Fire all API calls in parallel + fall back to simulated responses
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
        // Fall back to simulated response
        const simFn = SIMULATED_RESPONSES[agent.id] || (() => `[Analysis unavailable for this topic]`);
        content = simFn(proposal);
        latency = 0;
      }
      return { agent, content, latency, live: result.status === 'ok' };
    });

    // Update UI as each agent completes (don't wait for all)
    for (const promise of agentPromises) {
      const { agent, content, latency, live } = await promise;
      const loadingEl = document.getElementById(`loading-${agent.id}`);
      if (loadingEl) loadingEl.remove();

      const respEl = document.getElementById(`resp-${agent.id}`);
      if (respEl) {
        const bodyEl = document.createElement('div');
        bodyEl.className = 'response-body';
        bodyEl.style.fontStyle = live ? 'italic' : 'normal';
        bodyEl.textContent = content;
        respEl.appendChild(bodyEl);

        const meta = document.getElementById(`meta-${agent.id}`);
        if (meta) {
          meta.textContent += live
            ? ` • ${latency}ms`
            : ' • simulated (API unavailable)';
        }
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

    // Fire all poll calls in parallel
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
        // Simulated voting: agents vote based on their persona tendencies
        const tendencies = { claire: 'agree', sven: 'agree', yuki: 'disagree', margot: 'agree', klaus: 'disagree' };
        vote = tendencies[agent.id] || 'agree';
      }
      return { agent, vote, live: result.status === 'ok' };
    });

    let agree = 0, disagree = 0, errors = 0;
    for (const promise of agentPromises) {
      const { agent, vote, live } = await promise;
      const voteEl = document.getElementById(`vote-${agent.id}`);
      let emoji;
      if (vote === 'agree') { emoji = '✅'; agree++; }
      else if (vote === 'disagree') { emoji = '❌'; disagree++; }
      else { emoji = '🤷'; errors++; }
      if (!live) emoji += ' *';
      if (voteEl) voteEl.textContent = emoji;
    }

    // Show consensus
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
};
