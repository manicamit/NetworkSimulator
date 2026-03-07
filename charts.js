const Charts = (() => {

  const C = {
    cyan:    '#00d4ff',
    green:   '#3dff9a',
    red:     '#ff3c5f',
    yellow:  '#ffd166',
    surface: '#0c0f14',
    border:  '#1a2230',
    dim:     '#4a6070',
    mid:     '#7a98aa',
  };

  function setup(id) {
    const canvas = document.getElementById(id);
    const dpr    = window.devicePixelRatio || 1;
    const W      = canvas.offsetWidth;
    const H      = canvas.offsetHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, W, H };
  }

  function grid(ctx, W, H) {
    ctx.strokeStyle = C.border;
    ctx.lineWidth   = 0.5;
    for (let y = 0; y <= H; y += H / 4) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  function axisLabel(ctx, W, H, unit, max) {
    ctx.fillStyle = C.dim;
    ctx.font      = '8px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(max)} ${unit}`, W - 2, 10);
    ctx.fillText('0', W - 2, H - 3);
  }

  // smooth line through points using quadratic curves
  function smoothLine(ctx, points, W, H, maxY, color, fill) {
    if (!points.length) return;
    const xs = points.map((_, i) => (i / (points.length - 1)) * W);
    const ys = points.map(v => H - (Math.min(v, maxY) / maxY) * (H * 0.88) - 4);

    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    for (let i = 1; i < xs.length - 1; i++) {
      const mx = (xs[i] + xs[i + 1]) / 2;
      const my = (ys[i] + ys[i + 1]) / 2;
      ctx.quadraticCurveTo(xs[i], ys[i], mx, my);
    }
    ctx.lineTo(xs.at(-1), ys.at(-1));

    if (fill) {
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      ctx.lineTo(xs.at(-1), H);
      ctx.lineTo(xs[0], H);
      ctx.closePath();
      ctx.fillStyle = color + '18';
      ctx.fill();
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }
  }

  // vertical bar per data point
  function bars(ctx, points, W, H, maxY, color) {
    const bw = Math.max(2, (W / points.length) - 2);
    points.forEach((v, i) => {
      const x  = (i / points.length) * W;
      const bh = (Math.min(v, maxY) / maxY) * (H * 0.88);
      if (bh < 1) return;
      ctx.fillStyle   = v > 0 ? color : C.border;
      ctx.shadowColor = color;
      ctx.shadowBlur  = v > 0 ? 6 : 0;
      ctx.fillRect(x, H - bh - 2, bw, bh);
      ctx.shadowBlur  = 0;
    });
  }

  // --- the four charts ---

  function timeline(data) {
    const { ctx, W, H } = setup('timelineChart');
    ctx.clearRect(0, 0, W, H);
    grid(ctx, W, H);

    const durations = data.timeline.map(p => p.duration);
    const maxMs     = Math.max(...durations, 1);
    axisLabel(ctx, W, H, 'ms', maxMs);

    // color each bar by whether it had retransmits
    const bw = Math.max(2, (W / durations.length) - 2);
    durations.forEach((d, i) => {
      const x      = (i / durations.length) * W;
      const bh     = (d / maxMs) * (H * 0.88);
      const hasRtx = data.timeline[i].retransmits > 0;
      ctx.fillStyle   = hasRtx ? C.red : C.cyan;
      ctx.shadowColor = hasRtx ? C.red : C.cyan;
      ctx.shadowBlur  = 4;
      ctx.fillRect(x, H - bh - 2, bw, bh);
      ctx.shadowBlur  = 0;
    });
  }

  function bandwidth(data) {
    const { ctx, W, H } = setup('bandwidthChart');
    ctx.clearRect(0, 0, W, H);
    grid(ctx, W, H);
    axisLabel(ctx, W, H, '%', 100);

    const utils = data.bandwidth.map(b => b.util);
    smoothLine(ctx, utils, W, H, 100, C.green, true);
  }

  function retransmissions(data) {
    const { ctx, W, H } = setup('retransChart');
    ctx.clearRect(0, 0, W, H);
    grid(ctx, W, H);

    const counts = data.retrans.map(r => r.count);
    const maxR   = Math.max(...counts, 1);
    axisLabel(ctx, W, H, 'rtx', maxR);
    bars(ctx, counts, W, H, maxR, C.red);
  }

  function queue(data) {
    const { ctx, W, H } = setup('queueChart');
    ctx.clearRect(0, 0, W, H);
    grid(ctx, W, H);

    const depths = data.queue.map(q => q.depth);
    const maxQ   = Math.max(...depths, 1);
    axisLabel(ctx, W, H, 'pkts', maxQ);
    smoothLine(ctx, depths, W, H, maxQ, C.yellow, true);
  }

  function drawAll(simData) {
    timeline(simData);
    bandwidth(simData);
    retransmissions(simData);
    queue(simData);
  }

  // placeholder grid shown before first run
  function drawPlaceholders() {
    ['timelineChart', 'bandwidthChart', 'retransChart', 'queueChart'].forEach(id => {
      const { ctx, W, H } = setup(id);
      grid(ctx, W, H);
      ctx.fillStyle = C.dim;
      ctx.font      = '9px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('awaiting simulation', W / 2, H / 2 + 4);
    });
  }

  return { drawAll, drawPlaceholders };
})();
