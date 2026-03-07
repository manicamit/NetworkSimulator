const PRESETS = {
  whatsapp: {
    rtt: 60, loss: 0, jitter: 3, bw: 10, cwnd: 10, proto: 'tcp',
    explain: [
      { type: 'good', html: '<strong>Why WhatsApp feels instant:</strong> it keeps a persistent TCP connection alive. No handshake on every message — you skip the 1.5× RTT penalty entirely.' },
      { type: '',     html: '<strong>Message size matters.</strong> A typical WhatsApp message is under 1 KB — it fits in the very first congestion window, so slow-start never kicks in.' },
    ]
  },
  http1: {
    rtt: 120, loss: 5, jitter: 20, bw: 5, cwnd: 4, proto: 'tcp',
    explain: [
      { type: 'bad',  html: '<strong>HTTP/1.1 opens a new TCP connection per request.</strong> That\'s a full 3-way handshake (1.5× RTT) before a single byte of your page loads.' },
      { type: 'warn', html: '<strong>Head-of-line blocking:</strong> requests are queued. If request #1 stalls, requests #2–6 wait — even if they\'re ready to go.' },
    ]
  },
  tcp: {
    rtt: 100, loss: 2, jitter: 10, bw: 10, cwnd: 1, proto: 'tcp',
    explain: [
      { type: '',     html: '<strong>TCP slow-start:</strong> the connection begins with CWND=1 and doubles each RTT. At 100ms RTT it takes ~400ms just to reach a useful window size.' },
      { type: 'warn', html: '<strong>On loss, CWND halves.</strong> A 2% loss rate means frequent halving — throughput never reaches line rate on short transfers.' },
    ]
  },
  quic: {
    rtt: 80, loss: 10, jitter: 15, bw: 20, cwnd: 10, proto: 'quic',
    explain: [
      { type: 'good', html: '<strong>QUIC uses 0-RTT on resumed connections.</strong> The first packet can carry application data — no separate handshake round trip.' },
      { type: 'good', html: '<strong>No head-of-line blocking.</strong> Each stream is independent. A lost packet on stream A doesn\'t stall stream B — critical at 10% loss.' },
    ]
  },
  custom: {
    rtt: 80, loss: 0, jitter: 5, bw: 10, cwnd: 10, proto: 'tcp',
    explain: [
      { type: '', html: '<strong>Custom mode.</strong> Adjust the sliders and run to see how your parameters affect the network.' },
    ]
  },
};

const SLIDERS = {
  rtt:    { el: null, valEl: null, fmt: v => `${v} ms`,              warn: v => v > 100, danger: v => v > 250 },
  loss:   { el: null, valEl: null, fmt: v => `${(v/10).toFixed(1)}%`, warn: v => v > 10,  danger: v => v > 50  },
  jitter: { el: null, valEl: null, fmt: v => `${v} ms`,              warn: v => v > 30,  danger: v => v > 80  },
  bw:     { el: null, valEl: null, fmt: v => `${v} Mbps` },
  cwnd:   { el: null, valEl: null, fmt: v => `${v} pkts` },
};

function getParams() {
  return {
    rtt:      parseFloat(SLIDERS.rtt.el.value),
    loss:     parseFloat(SLIDERS.loss.el.value) / 10,
    jitter:   parseFloat(SLIDERS.jitter.el.value),
    bw:       parseFloat(SLIDERS.bw.el.value),
    cwnd:     parseFloat(SLIDERS.cwnd.el.value),
    protocol: document.querySelector('.proto-btn.active')?.dataset.proto ?? 'tcp',
  };
}

function setSlider(key, raw) {
  const s = SLIDERS[key];
  s.el.value = raw;
  s.el.dispatchEvent(new Event('input'));
}

function loadPreset(name) {
  const p = PRESETS[name]; if (!p) return;
  setSlider('rtt',    p.rtt);
  setSlider('loss',   p.loss * 10);
  setSlider('jitter', p.jitter);
  setSlider('bw',     p.bw);
  setSlider('cwnd',   p.cwnd);
  setActiveProto(p.proto);
  renderExplain(p.explain);
}

function setActiveProto(name) {
  document.querySelectorAll('.proto-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.proto === name));
}

function renderExplain(blocks) {
  const panel = document.getElementById('explainPanel');
  panel.innerHTML = blocks.map(b =>
    `<div class="explain ${b.type}">${b.html}</div>`
  ).join('');
}

function updateMetrics(metrics) {
  const throughput = document.getElementById('m-throughput');
  const latency    = document.getElementById('m-latency');
  const retransmit = document.getElementById('m-retransmit');
  const queueEl    = document.getElementById('m-queue');

  throughput.innerHTML = `${metrics.throughput}<span class="unit"> Mbps</span>`;
  latency.innerHTML    = `${metrics.latency}<span class="unit"> ms</span>`;
  retransmit.textContent = metrics.retransmits;
  queueEl.innerHTML    = `${metrics.queueDepth}<span class="unit"> pkts</span>`;

  // colour by severity
  const bw = parseFloat(SLIDERS.bw.el.value);
  throughput.className = 'metric-value ' + (metrics.throughput > bw * 0.7 ? 'good' : metrics.throughput > bw * 0.3 ? 'medium' : 'bad');
  latency.className    = 'metric-value ' + (metrics.latency < 100 ? 'good' : metrics.latency < 300 ? 'medium' : 'bad');
  retransmit.className = 'metric-value ' + (metrics.retransmits === 0 ? 'good' : metrics.retransmits < 5 ? 'medium' : 'bad');
  queueEl.className    = 'metric-value ' + (metrics.queueDepth < 10 ? 'good' : metrics.queueDepth < 40 ? 'medium' : 'bad');
}

function runSimulation() {
  const btn = document.getElementById('runBtn');
  btn.textContent = '⟳ RUNNING…';
  btn.disabled    = true;

  // let the browser paint the button state before blocking on sim
  requestAnimationFrame(() => {
    const params = getParams();
    const result = Simulator.run(params);

    Charts.drawAll(result);
    PacketAnimator.animate(result);
    updateMetrics(result.metrics);

    btn.textContent = '▶ RUN SIMULATION';
    btn.disabled    = false;
  });
}

// --- boot ---

document.addEventListener('DOMContentLoaded', () => {

  // wire sliders
  Object.entries(SLIDERS).forEach(([key, s]) => {
    s.el    = document.getElementById(`${key}Slider`);
    s.valEl = document.getElementById(`${key}Val`);
    s.el.addEventListener('input', () => {
      const v = parseFloat(s.el.value);
      s.valEl.textContent = s.fmt(v);
      s.valEl.className   = 'ctrl-val' + (s.danger?.(v) ? ' danger' : s.warn?.(v) ? ' warn' : '');
    });
  });

  // scenario tabs
  document.getElementById('scenarioTabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab'); if (!btn) return;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    loadPreset(btn.dataset.scenario);
  });

  // protocol buttons
  document.getElementById('protocolGrid').addEventListener('click', e => {
    const btn = e.target.closest('.proto-btn'); if (!btn) return;
    setActiveProto(btn.dataset.proto);
  });

  document.getElementById('runBtn').addEventListener('click', runSimulation);

  PacketAnimator.init(document.getElementById('packetCanvas'));
  Charts.drawPlaceholders();
  loadPreset('whatsapp');
});
