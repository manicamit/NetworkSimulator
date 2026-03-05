const PacketAnimator = (() => {

  const COLORS = {
    data:   '#00d4ff',
    ack:    '#3dff9a',
    lost:   '#ff3c5f',
    retx:   '#ffd166',
    wire:   'rgba(255,255,255,0.06)',
    grid:   'rgba(0,212,255,0.03)',
    node:   'rgba(0,212,255,0.06)',
  };

  let canvas, ctx, W, H, raf;
  let packets  = [];
  let nodes    = {};

  function init(canvasEl) {
    canvas = canvasEl;
    ctx    = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    drawIdle();
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = canvas.offsetWidth;
    H = canvas.offsetHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    nodes = {
      client: { x: 48,     y: H / 2 },
      server: { x: W - 48, y: H / 2 },
    };
  }

  function drawGrid() {
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth   = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }

  function drawNode(x, y, label, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.fillStyle   = COLORS.node;
    ctx.beginPath();
    ctx.roundRect(x - 22, y - 18, 44, 36, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle  = color;
    ctx.font       = '8px "IBM Plex Mono", monospace';
    ctx.textAlign  = 'center';
    ctx.fillText(label, x, y + 4);
  }

  function drawWire() {
    ctx.strokeStyle = COLORS.wire;
    ctx.lineWidth   = 1;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(nodes.client.x + 22, H / 2);
    ctx.lineTo(nodes.server.x - 22, H / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawScene() {
    ctx.clearRect(0, 0, W, H);
    drawGrid();
    drawWire();
    drawNode(nodes.client.x, nodes.client.y, 'CLIENT', 'rgba(0,212,255,0.7)');
    drawNode(nodes.server.x, nodes.server.y, 'SERVER', 'rgba(61,255,154,0.7)');
  }

  function drawIdle() {
    drawScene();
    ctx.fillStyle = '#1e3040';
    ctx.font      = '9px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('press RUN to animate packet flow', W / 2, H / 2 - 34);
  }

  // spawn animated packets from simulation timeline data
  function animate(simData) {
    cancelAnimationFrame(raf);
    packets = [];

    const totalDuration = simData.timeline.at(-1).t + 300;

    simData.timeline.forEach((pkt, i) => {
      // data packet: client → server
      packets.push({
        id:        i,
        type:      pkt.retransmits > 0 ? 'retx' : 'data',
        startT:    pkt.t,
        endT:      pkt.t + pkt.duration * 0.5,
        fromX:     nodes.client.x + 22,
        toX:       nodes.server.x - 22,
        y:         H / 2,
        progress:  0,
        done:      false,
      });

      // ack packet: server → client
      packets.push({
        id:       i + 1000,
        type:     'ack',
        startT:   pkt.t + pkt.duration * 0.5,
        endT:     pkt.t + pkt.duration,
        fromX:    nodes.server.x - 22,
        toX:      nodes.client.x + 22,
        y:        H / 2,
        progress: 0,
        done:     false,
      });

      // lost marker stays at midpoint briefly
      if (pkt.retransmits > 0) {
        packets.push({
          id:      i + 2000,
          type:    'lost',
          startT:  pkt.t + pkt.duration * 0.2,
          endT:    pkt.t + pkt.duration * 0.5,
          fromX:   (nodes.client.x + nodes.server.x) / 2,
          toX:     (nodes.client.x + nodes.server.x) / 2,
          y:       H / 2,
          progress: 0,
          done:    false,
        });
      }
    });

    const startReal = performance.now();
    const speed     = totalDuration > 3000 ? totalDuration / 3000 : 1; // max 3s display

    function frame(now) {
      const elapsed = (now - startReal) * speed;
      drawScene();

      packets.forEach(p => {
        if (elapsed < p.startT || p.done) return;
        const t = Math.min((elapsed - p.startT) / (p.endT - p.startT), 1);
        p.progress = t;

        const x = p.fromX + (p.toX - p.fromX) * easeInOut(t);
        const color = COLORS[p.type];

        // trail
        ctx.strokeStyle = color + '40';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(p.fromX, p.y);
        ctx.lineTo(x, p.y);
        ctx.stroke();

        // packet dot
        ctx.beginPath();
        ctx.arc(x, p.y, p.type === 'lost' ? 5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur  = 8;
        ctx.fill();
        ctx.shadowBlur  = 0;

        if (t >= 1) p.done = true;
      });

      if (elapsed < totalDuration / speed) {
        raf = requestAnimationFrame(frame);
      }
    }

    raf = requestAnimationFrame(frame);
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  function stop() {
    cancelAnimationFrame(raf);
    drawIdle();
  }

  return { init, animate, stop };
})();
