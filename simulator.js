const Simulator = (() => {

  // Box-Muller transform to get normally distributed jitter values
  function gaussian(mean, sigma) {
    if (sigma === 0) return mean;
    const u = 1 - Math.random();
    const v = Math.random();
    return mean + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function packet(rtt, lossPct, jitter, isUDP) {
    if (isUDP) {
      const lat = Math.max(1, gaussian(rtt / 2, jitter / 2));
      return { delivered: true, latency: lat * 2, retransmits: 0 };
    }

    let totalMs = 0, retransmits = 0;
    for (let attempt = 0; attempt < 8; attempt++) {
      const dropped = Math.random() * 100 < lossPct;
      const oneWay  = Math.max(1, gaussian(rtt / 2, jitter / 2));
      if (!dropped) {
        totalMs += oneWay * 2;
        return { delivered: true, latency: totalMs, retransmits };
      }
      // each retry waits twice as long as the last
      totalMs += oneWay * 2 * Math.pow(2, attempt);
      retransmits++;
    }
    return { delivered: false, latency: totalMs, retransmits };
  }

  function run(params, numPackets = 40) {
    const { rtt, loss, jitter, bw, cwnd, protocol } = params;
    const isQUIC = protocol === 'quic' || protocol === 'http3';
    const isUDP  = protocol === 'udp';

    const pktKb  = 1.4; // one MSS
    const bwKbMs = (bw * 1000) / 8 / 1000;
    const txMs   = pktKb / bwKbMs;

    let clock = 0, window = cwnd, queue = 0;
    let totalRetx = 0, totalBytes = 0;

    const timeline = [], retrans = [], queueLog = [];

    for (let i = 0; i < numPackets; i++) {
      const pkt = packet(rtt, isUDP ? 0 : loss, jitter, isUDP);

      if (!isQUIC && !isUDP) {
        if (pkt.retransmits > 0) window = Math.max(1, Math.floor(window / 2));
        else if (window < cwnd * 4) window = Math.min(window + 1, 64);
      }

      queue = Math.min(128, Math.max(0, queue + (window / Math.max(rtt, 1)) - bwKbMs));

      const t = clock;
      // QUIC handles loss per-stream so it doesn't stall the whole connection
      clock += pkt.latency * (isQUIC && pkt.retransmits > 0 ? 0.7 : 1) + txMs;

      totalRetx  += pkt.retransmits;
      totalBytes += pkt.delivered ? pktKb : 0;

      timeline.push({ t, duration: parseFloat(pkt.latency.toFixed(1)), retransmits: pkt.retransmits });
      retrans.push({ t, count: pkt.retransmits });
      queueLog.push({ t, depth: parseFloat(queue.toFixed(2)) });
    }

    const bucketMs = clock / 20;
    const bandwidth = Array.from({ length: 20 }, (_, b) => {
      const t0 = b * bucketMs, t1 = t0 + bucketMs;
      const n  = timeline.filter(p => p.t >= t0 && p.t < t1).length;
      const util = Math.min((n * pktKb * 8) / (bucketMs * bw / 1000), 1);
      return { t: parseFloat(t0.toFixed(0)), util: parseFloat((util * 100).toFixed(1)) };
    });

    return {
      timeline, bandwidth, retrans,
      queue: queueLog,
      metrics: {
        throughput:  parseFloat(((totalBytes * 8) / clock).toFixed(2)),
        latency:     parseFloat((clock / numPackets).toFixed(0)),
        retransmits: totalRetx,
        queueDepth:  parseFloat(queue.toFixed(1)),
      }
    };
  }

  return { run };
})();
