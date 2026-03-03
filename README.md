# LatencyLab

An interactive network simulator that explains why apps feel slow.

Adjust RTT, packet loss, jitter, bandwidth, and congestion window in real time and watch how they affect packet flow, throughput, retransmissions, and queue buildup across different protocols and scenarios.

---

## Scenarios

- **WhatsApp** — why messages feel instant (persistent connections, small payloads)
- **HTTP/1.1** — why websites feel slow (head-of-line blocking, cold TCP)
- **TCP Handshake** — the 1.5x RTT cost before a single byte is sent
- **QUIC** — why it beats TCP on lossy networks (per-stream, 0-RTT)

## Parameters

| Parameter | What it models |
|-----------|---------------|
| RTT | Round-trip time between client and server |
| Packet Loss | Probability a packet is dropped in transit |
| Jitter | Variance in packet arrival times |
| Bandwidth | Raw link capacity |
| CWND | TCP initial congestion window size |

## Stack

Plain HTML, CSS, and vanilla JavaScript. No build step, no dependencies.

## Local development

```bash
git clone https://github.com/YOUR_USERNAME/latency-lab.git
cd latency-lab
# open index.html in a browser, or serve it:
npx serve .
```

## Deployment

Hosted on Cloudflare Pages. Any push to `main` triggers a deploy.

1. Push repo to GitHub
2. Cloudflare Pages > New project > Connect repo
3. Leave build settings blank
4. Deploy

Live at: `latency-lab.pages.dev`

---

## Project structure

```
NetworkSimulator/
├── index.html      # markup and layout
├── styles.css      # design tokens, components
├── simulator.js    # network math (RTT, loss, jitter, CWND)
├── packets.js      # packet flow canvas animation
├── charts.js       # timeline, bandwidth, retrans, queue graphs
└── main.js         # wires sliders, tabs, scenarios together
```
