// BlacksiteLab Fleet Command — Canvas Topology Graph
// Renders 5 agent nodes in pentagonal layout with glow, particles, hover

class FleetGraph {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.nodes = [];
    this.particles = [];
    this.hoveredNode = null;
    this.animationId = null;
    this.time = 0;
    this.dpr = window.devicePixelRatio || 1;
    this.onNodeClick = null;
    this.onNodeHover = null;

    this._resize();
    this._initParticles();
    this._bind();
  }

  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this._computeLayout();
  }

  _computeLayout() {
    const cx = this.width / 2;
    const cy = this.height / 2;
    const radius = Math.min(this.width, this.height) * 0.32;
    this.nodes = AGENTS.map((agent, i) => {
      const angle = (i / AGENTS.length) * Math.PI * 2 - Math.PI / 2;
      return {
        ...agent,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        radius: 24,
        pulsePhase: Math.random() * Math.PI * 2,
      };
    });
  }

  _initParticles() {
    this.particles = [];
    for (let i = 0; i < 60; i++) {
      this.particles.push({
        x: Math.random() * (this.width || 600),
        y: Math.random() * (this.height || 400),
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.4 + 0.1,
      });
    }
  }

  _bind() {
    this.canvas.addEventListener('mousemove', e => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let found = null;
      for (const node of this.nodes) {
        const dx = mx - node.x, dy = my - node.y;
        if (Math.sqrt(dx * dx + dy * dy) < node.radius + 6) { found = node; break; }
      }
      if (found !== this.hoveredNode) {
        this.hoveredNode = found;
        this.canvas.style.cursor = found ? 'pointer' : 'default';
        if (this.onNodeHover) this.onNodeHover(found);
      }
    });
    this.canvas.addEventListener('click', e => {
      if (this.hoveredNode && this.onNodeClick) {
        const s = State.agents[this.hoveredNode.id] || {};
        this.onNodeClick({ ...this.hoveredNode, status: s.status });
      }
    });
    window.addEventListener('resize', () => this._resize());
  }

  _drawGlow(x, y, r, color, alpha = 0.15) {
    const glow = this.ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.2);
    glow.addColorStop(0, color.replace(')', `, ${alpha})`).replace('rgb', 'rgba'));
    glow.addColorStop(1, 'transparent');
    this.ctx.fillStyle = glow;
    this.ctx.beginPath();
    this.ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    this.ctx.fill();
  }

  _drawNode(node) {
    const { x, y, color, radius, name } = node;
    const state = State.agents[node.id] || { status: 'unknown' };
    const isHovered = this.hoveredNode === node;

    // Status ring
    const ringAlpha = 0.6 + Math.sin(this.time * 0.03 + node.pulsePhase) * 0.2;
    const ringColor = state.status === 'online' ? 'rgba(16,185,129,_A_)'
      : state.status === 'busy' ? 'rgba(245,158,11,_A_)'
      : 'rgba(239,68,68,_A_)';

    this.ctx.beginPath();
    this.ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
    this.ctx.strokeStyle = ringColor.replace('_A_', String(ringAlpha));
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Glow
    this._drawGlow(x, y, radius, hexToRgb(node.color));

    // Node circle
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    const grad = this.ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, 0, x, y, radius);
    grad.addColorStop(0, lightenColor(node.color, 40));
    grad.addColorStop(0.6, node.color);
    grad.addColorStop(1, darkenColor(node.color, 30));
    this.ctx.fillStyle = grad;
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    this.ctx.lineWidth = 1;
    this.ctx.stroke();

    // Avatar letter
    this.ctx.fillStyle = '#fff';
    this.ctx.font = `bold ${isHovered ? 16 : 14}px Inter, sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(node.avatar, x, y);

    // Name label
    this.ctx.fillStyle = isHovered ? '#f7f8f8' : '#d0d6e0';
    this.ctx.font = `${isHovered ? 12 : 11}px Inter, sans-serif`;
    this.ctx.fillText(name, x, y + radius + 14);

    // Role label
    this.ctx.fillStyle = '#8a8f98';
    this.ctx.font = '10px Inter, sans-serif';
    this.ctx.fillText(node.role, x, y + radius + 28);
  }

  _drawEdges() {
    // Draw subtle connections between all nodes
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const a = this.nodes[i], b = this.nodes[j];
        this.ctx.beginPath();
        this.ctx.moveTo(a.x, a.y);
        this.ctx.lineTo(b.x, b.y);
        this.ctx.strokeStyle = 'rgba(113,112,255,0.06)';
        this.ctx.lineWidth = 0.5;
        this.ctx.stroke();
      }
    }
  }

  _drawParticles() {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height;
      if (p.y > this.height) p.y = 0;

      this.ctx.fillStyle = `rgba(113,112,255,${p.alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  _draw() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this._drawEdges();
    this._drawParticles();
    for (const node of this.nodes) {
      this._drawNode(node);
    }
  }

  _animate() {
    this.time++;
    this._draw();
    this.animationId = requestAnimationFrame(() => this._animate());
  }

  start() {
    this._resize();
    if (!this.animationId) this._animate();
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}

// Color helpers
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgb(${r},${g},${b})`;
}

function lightenColor(hex, pct) {
  const r = Math.min(255, parseInt(hex.slice(1,3), 16) + pct);
  const g = Math.min(255, parseInt(hex.slice(3,5), 16) + pct);
  const b = Math.min(255, parseInt(hex.slice(5,7), 16) + pct);
  return `rgb(${r},${g},${b})`;
}

function darkenColor(hex, pct) {
  const r = Math.max(0, parseInt(hex.slice(1,3), 16) - pct);
  const g = Math.max(0, parseInt(hex.slice(3,5), 16) - pct);
  const b = Math.max(0, parseInt(hex.slice(5,7), 16) - pct);
  return `rgb(${r},${g},${b})`;
}
