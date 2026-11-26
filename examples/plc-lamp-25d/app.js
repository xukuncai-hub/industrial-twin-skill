(() => {
  const state = {
    mode: 'offline',
    lamp: false,
    startPulse: false,
    stopPulse: false,
    opsCount: 0,
    pulsePhase: 0,
    lastHit: null,
    manifest: null,
    client: null
  };

  const canvas = document.getElementById('isoCanvas');
  const ctx = canvas.getContext('2d');

  // Isometric helper
  const iso = (x, y, z, ox, oy, s) => [
    ox + (x - z) * 0.866 * s,
    oy + (x + z) * 0.5 * s - y * s
  ];

  function drawShadow(x, z, w, d, ox, oy, s, a = 0.14) {
    const p0 = iso(x, 0, z, ox, oy, s);
    const p1 = iso(x + w, 0, z, ox, oy, s);
    const p2 = iso(x + w, 0, z + d, ox, oy, s);
    const p3 = iso(x, 0, z + d, ox, oy, s);
    ctx.fillStyle = `rgba(15, 23, 42, ${a})`;
    ctx.beginPath();
    ctx.moveTo(...p0); ctx.lineTo(...p1); ctx.lineTo(...p2); ctx.lineTo(...p3);
    ctx.closePath(); ctx.fill();
  }

  function drawBox(x, y, z, w, h, d, c, ox, oy, s) {
    const p000 = iso(x, y, z, ox, oy, s);
    const p100 = iso(x + w, y, z, ox, oy, s);
    const p101 = iso(x + w, y, z + d, ox, oy, s);
    const p001 = iso(x, y, z + d, ox, oy, s);
    const p010 = iso(x, y + h, z, ox, oy, s);
    const p110 = iso(x + w, y + h, z, ox, oy, s);
    const p111 = iso(x + w, y + h, z + d, ox, oy, s);
    const p011 = iso(x, y + h, z + d, ox, oy, s);

    ctx.lineJoin = 'round';
    ctx.fillStyle = c.right;
    ctx.beginPath(); ctx.moveTo(...p100); ctx.lineTo(...p101); ctx.lineTo(...p111); ctx.lineTo(...p110); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c.left;
    ctx.beginPath(); ctx.moveTo(...p001); ctx.lineTo(...p101); ctx.lineTo(...p111); ctx.lineTo(...p011); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c.top;
    ctx.beginPath(); ctx.moveTo(...p010); ctx.lineTo(...p110); ctx.lineTo(...p111); ctx.lineTo(...p011); ctx.closePath(); ctx.fill();

    if (c.edge) {
      ctx.strokeStyle = c.edge;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(...p010); ctx.lineTo(...p110); ctx.lineTo(...p111); ctx.lineTo(...p011); ctx.closePath();
      ctx.moveTo(...p110); ctx.lineTo(...p100);
      ctx.moveTo(...p111); ctx.lineTo(...p101);
      ctx.moveTo(...p011); ctx.lineTo(...p001);
      ctx.stroke();
    }
  }

  function drawCallout(wx, wy, wz, dx, dy, title, sub, color, ox, oy, s) {
    const [sx, sy] = iso(wx, wy, wz, ox, oy, s);
    const tx = sx + dx;
    const ty = sy + dy;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.24)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(sx, sy, 3.2, 0, Math.PI * 2); ctx.fill();

    ctx.font = '600 11.5px "Fira Sans", "Segoe UI", sans-serif';
    const w1 = ctx.measureText(title).width;
    ctx.font = '400 10px "Fira Code", Consolas, monospace';
    const w2 = ctx.measureText(sub).width;
    const bw = Math.max(w1, w2) + 22;
    const bh = 38;
    const bx = dx >= 0 ? tx : tx - bw;
    const by = ty - bh / 2;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6); ctx.fill(); ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(bx + 10, by + 13, 2.8, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = '600 11.5px "Fira Sans", "Segoe UI", sans-serif';
    ctx.fillText(title, bx + 17, by + 16);
    ctx.fillStyle = '#475569';
    ctx.font = '400 10px "Fira Code", Consolas, monospace';
    ctx.fillText(sub, bx + 10, by + 30);
  }

  // Hitboxes for clicking 2.5D buttons directly on canvas
  let hitStart = null;
  let hitStop = null;

  function renderScene() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 2;
    const W = rect.width;
    const H = rect.height;
    if (canvas.width !== Math.floor(W * dpr) || canvas.height !== Math.floor(H * dpr)) {
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const ox = W * 0.49;
    const oy = H * 0.56;
    const s = Math.min(W, H) * 0.056;

    // Architectural grid floor
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.05)';
    ctx.lineWidth = 1;
    for (let gx = -9; gx <= 9; gx += 1.2) {
      const a = iso(gx, 0, -6, ox, oy, s), b = iso(gx, 0, 6, ox, oy, s);
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
    }
    for (let gz = -6; gz <= 6; gz += 1.2) {
      const a = iso(-9, 0, gz, ox, oy, s), b = iso(9, 0, gz, ox, oy, s);
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
    }

    const alu = { top: '#cbd5e1', left: '#94a3b8', right: '#64748b', edge: 'rgba(15,23,42,0.16)' };
    const cabinet = { top: '#e2e8f0', left: '#cbd5e1', right: '#94a3b8', edge: 'rgba(15,23,42,0.18)' };
    const darkBase = { top: '#475569', left: '#334155', right: '#1e293b', edge: 'rgba(15,23,42,0.22)' };
    const btnGreen = state.startPulse
      ? { top: '#34d399', left: '#10b981', right: '#059669', edge: 'rgba(5,150,105,0.8)' }
      : { top: '#10b981', left: '#059669', right: '#047857', edge: 'rgba(255,255,255,0.35)' };
    const btnRed = state.stopPulse
      ? { top: '#f87171', left: '#ef4444', right: '#dc2626', edge: 'rgba(220,38,38,0.8)' }
      : { top: '#ef4444', left: '#dc2626', right: '#b91c1c', edge: 'rgba(255,255,255,0.35)' };

    // Ground shadows
    drawShadow(-5.8, -1.6, 4.4, 3.2, ox, oy, s, 0.14);
    drawShadow(1.6, -1.6, 3.6, 3.2, ox, oy, s, 0.14);
    drawShadow(-1.4, -0.4, 3.2, 0.8, ox, oy, s, 0.08);

    // 1. Left Control Console Pedestal (-5.6 .. -1.6)
    drawBox(-5.6, 0, -1.5, 4.0, 0.35, 3.0, darkBase, ox, oy, s);
    drawBox(-5.3, 0.35, -1.2, 3.4, 1.8, 2.4, cabinet, ox, oy, s);
    drawBox(-5.45, 2.15, -1.35, 3.7, 0.28, 2.7, alu, ox, oy, s);

    // Start Push-Button (2.5D interactive)
    const startH = state.startPulse ? 0.14 : 0.34;
    drawBox(-4.75, 2.43, -0.55, 1.05, 0.12, 1.1, darkBase, ox, oy, s);
    drawBox(-4.63, 2.55, -0.43, 0.8, startH, 0.85, btnGreen, ox, oy, s);
    const sc = iso(-4.23, 2.7, 0, ox, oy, s);
    hitStart = { x: sc[0], y: sc[1], r: 34 };

    // Stop Push-Button (2.5D interactive)
    const stopH = state.stopPulse ? 0.14 : 0.34;
    drawBox(-3.2, 2.43, -0.55, 1.05, 0.12, 1.1, darkBase, ox, oy, s);
    drawBox(-3.08, 2.55, -0.43, 0.8, stopH, 0.85, btnRed, ox, oy, s);
    const stc = iso(-2.68, 2.7, 0, ox, oy, s);
    hitStop = { x: stc[0], y: stc[1], r: 34 };

    // 2. Industrial Cable Tray / Signal Bus connecting Console -> Output Lamp
    drawBox(-1.9, 0.1, -0.35, 3.8, 0.16, 0.7, darkBase, ox, oy, s);
    const busA = iso(-1.8, 0.28, 0, ox, oy, s);
    const busB = iso(1.8, 0.28, 0, ox, oy, s);
    ctx.strokeStyle = state.lamp ? '#059669' : '#94a3b8';
    ctx.lineWidth = state.lamp ? 3 : 2;
    ctx.beginPath(); ctx.moveTo(...busA); ctx.lineTo(...busB); ctx.stroke();

    // Animated signal pulse packet along bus when lamp is ON or button pulsed
    if (state.lamp || state.startPulse || state.stopPulse) {
      const t = state.pulsePhase % 1;
      const px = busA[0] + (busB[0] - busA[0]) * t;
      const py = busA[1] + (busB[1] - busA[1]) * t;
      ctx.fillStyle = state.stopPulse ? '#dc2626' : '#059669';
      ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2); ctx.fill();
    }

    // 3. Right PLC Cabinet + 2.5D Output Indicator Lamp (1.8 .. 5.0)
    drawBox(1.8, 0, -1.5, 3.2, 0.35, 3.0, darkBase, ox, oy, s);
    drawBox(2.0, 0.35, -1.3, 2.8, 2.6, 2.6, cabinet, ox, oy, s);
    // Cabinet HMI face plate
    drawBox(2.35, 1.4, 1.28, 1.5, 0.9, 0.06, { top: '#0284c7', left: '#0369a1', right: '#075985' }, ox, oy, s);

    // Lamp Pedestal Pole
    drawBox(3.15, 2.95, -0.25, 0.5, 0.75, 0.5, darkBase, ox, oy, s);

    // 2.5D Output Lamp Dome (Glowing Emerald when ON, Frosted Gray when OFF)
    const lampCol = state.lamp
      ? { top: '#6ee7b7', left: '#10b981', right: '#059669', edge: '#047857' }
      : { top: '#cbd5e1', left: '#94a3b8', right: '#64748b', edge: 'rgba(15,23,42,0.22)' };

    if (state.lamp) {
      const [lx, ly] = iso(3.4, 4.2, 0, ox, oy, s);
      const glow = ctx.createRadialGradient(lx, ly, 4, lx, ly, s * 2.1);
      glow.addColorStop(0, 'rgba(16, 185, 129, 0.55)');
      glow.addColorStop(0.5, 'rgba(16, 185, 129, 0.18)');
      glow.addColorStop(1, 'rgba(16, 185, 129, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(lx, ly, s * 2.1, 0, Math.PI * 2); ctx.fill();
    }
    drawBox(2.95, 3.7, -0.45, 0.9, 0.95, 0.9, lampCol, ox, oy, s);
    drawBox(3.05, 4.65, -0.35, 0.7, 0.14, 0.7, darkBase, ox, oy, s);

    // 4. Clean Non-Overlapping 2.5D Callout Badges
    drawCallout(-4.23, 2.9, 0, -24, -48, '启动按钮', 'DB1.DBX0.0 · Pulse', '#059669', ox, oy, s);
    drawCallout(-2.68, 2.9, 0, 18, -56, '停止按钮', 'DB1.DBX0.1 · Pulse', '#dc2626', ox, oy, s);
    drawCallout(3.4, 4.75, 0, 26, -34, state.lamp ? '灯 · 点亮' : '灯 · 熄灭', 'DB1.DBX0.2 = ' + (state.lamp ? '1' : '0'), state.lamp ? '#059669' : '#64748b', ox, oy, s);
  }

  function syncUI() {
    document.getElementById('stStart').textContent = state.startPulse ? '1' : '0';
    document.getElementById('stStart').className = `tag-state ${state.startPulse ? 'on' : ''}`;
    document.getElementById('stStop').textContent = state.stopPulse ? '1' : '0';
    document.getElementById('stStop').className = `tag-state ${state.stopPulse ? 'on' : ''}`;
    document.getElementById('stLamp').textContent = state.lamp ? 'ON (1)' : 'OFF (0)';
    document.getElementById('stLamp').className = `tag-state ${state.lamp ? 'on' : ''}`;

    const dDot = document.getElementById('dockDot');
    dDot.style.background = state.lamp ? 'var(--ok)' : 'var(--dim)';
    document.getElementById('dockLamp').textContent = state.lamp ? '点亮 · 运行中' : '熄灭 · 待机';
    const dbb0 = (state.startPulse ? 1 : 0) | (state.stopPulse ? 2 : 0) | (state.lamp ? 4 : 0);
    document.getElementById('dockBytes').textContent = `DBB0=0x0${dbb0}`;
    document.getElementById('dockOps').textContent = `${state.opsCount} 次`;
  }

  function triggerStart() {
    state.startPulse = true;
    state.opsCount += 1;
    document.getElementById('dockLog').textContent = '触发启动脉冲 DB1.DBX0.0 = 1';
    if (state.mode === 'offline') {
      state.lamp = true;
    } else if (state.client) {
      state.client.pulse('cmd.start').catch(() => {});
    }
    syncUI();
    setTimeout(() => { state.startPulse = false; syncUI(); }, 220);
  }

  function triggerStop() {
    state.stopPulse = true;
    state.opsCount += 1;
    document.getElementById('dockLog').textContent = '触发停止脉冲 DB1.DBX0.1 = 1';
    if (state.mode === 'offline') {
      state.lamp = false;
    } else if (state.client) {
      state.client.pulse('cmd.stop').catch(() => {});
    }
    syncUI();
    setTimeout(() => { state.stopPulse = false; syncUI(); }, 220);
  }

  document.getElementById('btnStart').addEventListener('click', triggerStart);
  document.getElementById('btnStop').addEventListener('click', triggerStop);

  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (hitStart && Math.hypot(x - hitStart.x, y - hitStart.y) <= hitStart.r) triggerStart();
    else if (hitStop && Math.hypot(x - hitStop.x, y - hitStop.y) <= hitStop.r) triggerStop();
  });

  // Modal & 1-Click Presets
  const modal = document.getElementById('connModal');
  const protoSel = document.getElementById('connProtocol');
  const syncRtuVisibility = () => {
    const isRtu = protoSel.value === 'modbus-rtu';
    document.getElementById('ipFieldWrap').style.display = isRtu ? 'none' : 'flex';
    document.getElementById('rtuFieldWrap').style.display = isRtu ? 'flex' : 'none';
  };
  protoSel.addEventListener('change', () => {
    syncRtuVisibility();
    if (protoSel.value === 'modbus-rtu') scanSerialPorts();
  });

  async function scanSerialPorts() {
    const sel = document.getElementById('rtuPortSelect');
    const btn = document.getElementById('btnScanPorts');
    btn.textContent = '识别中…';
    try {
      if (!state.manifest && window.TiaTwinClient) {
        state.manifest = await window.TiaTwinClient.loadManifest('twin.manifest.json');
      }
      const tmp = state.client || new window.TiaTwinClient({ manifest: state.manifest, url: 'ws://127.0.0.1:8765/ws', autoReconnect: false });
      if (tmp.status !== 'online') {
        await new Promise((resolve) => {
          const off = tmp.on('status', (s) => { if (s.state === 'online') { off(); resolve(); } });
          tmp.connect();
          setTimeout(resolve, 1500);
        });
      }
      const res = await tmp.listSerialPorts();
      if (res && Array.isArray(res.ports) && res.ports.length > 0) {
        sel.innerHTML = res.ports.map((p) => `<option value="${p.device}">${p.description}</option>`).join('');
      } else {
        sel.innerHTML = '<option value="COM3">未检测到串口 (手动默认 COM3)</option>';
      }
      if (!state.client) tmp.disconnect();
    } catch (_) {
      sel.innerHTML = '<option value="COM3">COM3 (请先启动网关以自动识别)</option>';
    } finally {
      btn.textContent = '识别串口';
    }
  }
  document.getElementById('btnScanPorts').addEventListener('click', scanSerialPorts);

  const presets = {
    's7': { proto: 's7', ep: '192.168.0.1', poll: '100' },
    'mc': { proto: 'mc', ep: '192.168.0.20:5000', poll: '100' },
    'modbus-tcp': { proto: 'modbus-tcp', ep: '192.168.0.21:502', poll: '100' },
    'modbus-rtu': { proto: 'modbus-rtu', ep: 'COM3', poll: '100' }
  };

  document.querySelectorAll('[data-preset]').forEach((b) => {
    b.addEventListener('click', () => {
      const p = presets[b.dataset.preset];
      if (!p) return;
      protoSel.value = p.proto;
      document.getElementById('connEndpoint').value = p.ep;
      document.getElementById('connPoll').value = p.poll;
      syncRtuVisibility();
      if (p.proto === 'modbus-rtu') scanSerialPorts();
    });
  });

  try {
    const saved = JSON.parse(localStorage.getItem('lamp_25d_conn') || 'null');
    if (saved) {
      document.getElementById('connProtocol').value = saved.proto || 's7';
      document.getElementById('connEndpoint').value = saved.ep || '192.168.0.1';
      document.getElementById('connPoll').value = saved.poll || '100';
    }
  } catch (_) {}

  document.getElementById('modeOnline').addEventListener('click', () => modal.classList.add('open'));
  document.getElementById('btnCloseModal').addEventListener('click', () => modal.classList.remove('open'));
  document.getElementById('modeOffline').addEventListener('click', () => {
    state.mode = 'offline';
    if (state.client) { try { state.client.disconnect(); } catch (_) {} state.client = null; }
    document.getElementById('modeOffline').classList.add('active');
    document.getElementById('modeOnline').classList.remove('active');
    document.getElementById('connDot').className = 'dot';
    document.getElementById('connText').textContent = '离线仿真模式（本地自锁响应）';
  });

  document.getElementById('btnConfirmConn').addEventListener('click', async () => {
    const proto = document.getElementById('connProtocol').value;
    const isRtu = proto === 'modbus-rtu';
    const rtuPort = document.getElementById('rtuPortSelect').value || 'COM3';
    const rtuBaud = Number(document.getElementById('rtuBaudSelect').value || 115200);
    const ep = isRtu ? rtuPort : (document.getElementById('connEndpoint').value.trim() || '192.168.0.1');
    const poll = document.getElementById('connPoll').value;
    try { localStorage.setItem('lamp_25d_conn', JSON.stringify({ proto, ep, poll })); } catch (_) {}

    state.mode = 'online';
    document.getElementById('modeOnline').classList.add('active');
    document.getElementById('modeOffline').classList.remove('active');
    document.getElementById('scanChip').textContent = `SCAN ${poll} ms (${Math.round(1000 / Number(poll))} Hz)`;
    document.getElementById('connDot').className = 'dot warn';
    document.getElementById('connText').textContent = `正在连接 [${proto}] · ${ep}`;
    modal.classList.remove('open');

    if (window.TiaTwinClient) {
      try {
        if (!state.manifest) {
          state.manifest = await window.TiaTwinClient.loadManifest('twin.manifest.json');
        }
        if (state.client) { try { state.client.disconnect(); } catch (_) {} }
        const cli = new window.TiaTwinClient({ manifest: state.manifest, url: 'ws://127.0.0.1:8765/ws' });
        cli.on('status', (s) => {
          if (s && s.state === 'online') {
            const cfg = isRtu
              ? { protocol: proto, port: rtuPort, baudrate: rtuBaud, pollMs: Number(poll) }
              : { protocol: proto, ip: ep.split(':')[0], rack: 0, slot: 1, pollMs: Number(poll) };
            cli.configurePlc(cfg).catch((err) => {
              document.getElementById('connDot').className = 'dot danger';
              document.getElementById('connText').textContent = `配置失败: ${err.message || err}`;
            });
          } else if (s && s.state === 'offline') {
            document.getElementById('connDot').className = 'dot danger';
            document.getElementById('connText').textContent = '网关未连接（请先运行 start.bat）';
          }
        });
        cli.on('plc', (p) => {
          if (!p) return;
          if (p.state === 'connected') {
            document.getElementById('connDot').className = 'dot';
            document.getElementById('connText').textContent = `已连通 [${proto}] · ${ep}`;
          } else if (p.state === 'waiting') {
            document.getElementById('connDot').className = 'dot warn';
            document.getElementById('connText').textContent = p.message || `正在连接 [${proto}] · ${ep}…`;
          } else if (p.state === 'error') {
            document.getElementById('connDot').className = 'dot danger';
            document.getElementById('connText').textContent = `连接失败: ${p.message || '请检查 PLC IP / PUT-GET'}`;
          }
        });
        cli.on('values', (payload) => {
          const vals = payload && (payload.values || payload);
          if (vals && 'out.lamp' in vals) {
            state.lamp = Boolean(vals['out.lamp']);
            syncUI();
          }
        });
        cli.on('tag:out.lamp', (val) => {
          state.lamp = Boolean(val);
          syncUI();
        });
        cli.connect();
        state.client = cli;
      } catch (_) {}
    }
  });

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state.lamp || state.startPulse || state.stopPulse) {
      state.pulsePhase += dt * 1.6;
    }
    renderScene();
    requestAnimationFrame(loop);
  }

  syncUI();
  requestAnimationFrame(loop);
})();
