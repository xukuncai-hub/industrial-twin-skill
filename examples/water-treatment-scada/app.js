(() => {
  const state = {
    mode: 'offline',
    running: true,
    backwash: false,
    dosing: false,
    regLevel: 3.42,
    flowIn: 128.4,
    wqDo: 2.45,
    wqPh: 7.18,
    wqCod: 28.6,
    wqTurb: 0.82,
    blowerHz: 42.5,
    dailyM3: 2480,
    powerKw: 68.4,
    phase: 0,
    codHistory: Array.from({ length: 40 }, (_, i) => 28.2 + Math.sin(i * 0.3) * 0.9),
    manifest: null,
    client: null
  };

  const devices = [
    { id: 'PLC-01', name: '西门子 S7-1500 水厂主控', proto: 's7', endpoint: '192.168.0.10 (R0/S1)', pollMs: 100, active: true },
    { id: 'VFD-01', name: '曝气风机变频器', proto: 'modbus-tcp', endpoint: '192.168.0.21:502', pollMs: 100, active: true },
    { id: 'WQ-01', name: 'COD/DO 在线水质仪', proto: 'modbus-rtu', endpoint: 'COM3 @ 9600', pollMs: 500, active: true },
    { id: 'IOT-01', name: '环保局数据上传网关', proto: 'mqtt', endpoint: '192.168.0.40:1883', pollMs: 1000, active: false }
  ];

  const tagsMeta = [
    { id: 'cmd.auto', dev: 'PLC-01', addr: 'DB1.DBX0.0', type: 'bool', access: 'rw', desc: '全厂自动运行启动' },
    { id: 'cmd.stop', dev: 'PLC-01', addr: 'DB1.DBX0.1', type: 'bool', access: 'rw', desc: '全厂有序停机命令' },
    { id: 'cmd.backwash', dev: 'PLC-01', addr: 'DB1.DBX0.2', type: 'bool', access: 'rw', desc: '超滤膜反洗触发' },
    { id: 'cmd.dosing', dev: 'PLC-01', addr: 'DB1.DBX0.3', type: 'bool', access: 'rw', desc: 'PAC/PAM 加药泵点动' },
    { id: 'pump.infeed', dev: 'PLC-01', addr: 'DB1.DBX1.0', type: 'bool', access: 'r', desc: '1# 提升泵运行状态' },
    { id: 'blower.aeration', dev: 'PLC-01', addr: 'DB1.DBX1.1', type: 'bool', access: 'r', desc: '罗茨曝气风机运行状态' },
    { id: 'pump.sludge', dev: 'PLC-01', addr: 'DB1.DBX1.2', type: 'bool', access: 'r', desc: '污泥回流泵运行状态' },
    { id: 'valve.outlet', dev: 'PLC-01', addr: 'DB1.DBX1.3', type: 'bool', access: 'r', desc: '达标排放电动阀开到位' },
    { id: 'alarm.high_level', dev: 'PLC-01', addr: 'DB1.DBX1.4', type: 'bool', access: 'r', desc: '调节池高液位越限报警' },
    { id: 'tank.reg_level', dev: 'PLC-01', addr: 'DB1.DBD4', type: 'real', access: 'r', desc: '调节池实时液位 (m)' },
    { id: 'flow.inlet', dev: 'PLC-01', addr: 'DB1.DBD8', type: 'real', access: 'r', desc: '进水瞬时流量 (m³/h)' },
    { id: 'wq.do', dev: 'WQ-01', addr: '30001 (IR1)', type: 'real', access: 'r', desc: '好氧池溶解氧 DO (mg/L)' },
    { id: 'wq.ph', dev: 'WQ-01', addr: '30003 (IR3)', type: 'real', access: 'r', desc: '出水 pH 值' },
    { id: 'wq.cod', dev: 'WQ-01', addr: '30005 (IR5)', type: 'real', access: 'r', desc: '出水在线 COD (mg/L)' },
    { id: 'wq.turbidity', dev: 'WQ-01', addr: '30007 (IR7)', type: 'real', access: 'r', desc: '出水浊度 (NTU)' },
    { id: 'blower.hz', dev: 'VFD-01', addr: '40001 (HR1)', type: 'real', access: 'r', desc: '曝气风机变频频率 (Hz)' },
    { id: 'prod.daily_m3', dev: 'PLC-01', addr: 'DB1.DBD32', type: 'int32', access: 'r', desc: '今日累计处理水量 (m³)' },
    { id: 'sys.power_kw', dev: 'VFD-01', addr: '40005 (HR5)', type: 'real', access: 'r', desc: '全厂实时总功率 (kW)' }
  ];

  // View switch
  document.querySelectorAll('.rail-btn[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rail-btn[data-view]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.view-pane').forEach((p) => p.classList.remove('active'));
      document.getElementById(`view-${btn.dataset.view}`).classList.add('active');
      if (btn.dataset.view === 'trends') drawTrends();
    });
  });

  // Controls
  document.getElementById('btnAuto').addEventListener('click', () => {
    state.running = true;
    if (state.mode === 'online' && state.client) state.client.pulse('cmd.auto').catch(() => {});
  });
  document.getElementById('btnStop').addEventListener('click', () => {
    state.running = false;
    if (state.mode === 'online' && state.client) state.client.pulse('cmd.stop').catch(() => {});
  });
  document.getElementById('btnBackwash').addEventListener('click', (e) => {
    state.backwash = !state.backwash;
    e.currentTarget.classList.toggle('active-toggle', state.backwash);
    if (state.mode === 'online' && state.client) state.client.pulse('cmd.backwash').catch(() => {});
  });
  document.getElementById('btnDosing').addEventListener('click', (e) => {
    state.dosing = !state.dosing;
    e.currentTarget.classList.toggle('active-toggle', state.dosing);
    if (state.mode === 'online' && state.client) state.client.pulse('cmd.dosing').catch(() => {});
  });

  // Modal + Presets + Serial Port Auto-Detect
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
      if (!state.manifest && window.TiaTwinClient) state.manifest = await window.TiaTwinClient.loadManifest('twin.manifest.json');
      const tmp = state.client || new window.TiaTwinClient({ manifest: state.manifest, url: 'ws://127.0.0.1:8765/ws', autoReconnect: false });
      if (tmp.status !== 'online') {
        await new Promise((resolve) => {
          const off = tmp.on('status', (s) => { if (s.state === 'online') { off(); resolve(); } });
          tmp.connect(); setTimeout(resolve, 1500);
        });
      }
      const res = await tmp.listSerialPorts();
      sel.innerHTML = res && res.ports && res.ports.length
        ? res.ports.map((p) => `<option value="${p.device}">${p.description}</option>`).join('')
        : '<option value="COM3">未检测到串口 (默认 COM3)</option>';
      if (!state.client) tmp.disconnect();
    } catch (_) {
      sel.innerHTML = '<option value="COM3">COM3 (请先启动网关以识别)</option>';
    } finally {
      btn.textContent = '识别串口';
    }
  }
  document.getElementById('btnScanPorts').addEventListener('click', scanSerialPorts);

  const presets = {
    's7': { proto: 's7', ep: '192.168.0.10', poll: '100' },
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

  document.getElementById('btnOpenConn').addEventListener('click', () => modal.classList.add('open'));
  document.getElementById('modeOnline').addEventListener('click', () => modal.classList.add('open'));
  document.getElementById('btnCloseModal').addEventListener('click', () => modal.classList.remove('open'));
  document.getElementById('modeOffline').addEventListener('click', () => {
    state.mode = 'offline';
    if (state.client) { try { state.client.disconnect(); } catch (_) {} state.client = null; }
    document.getElementById('modeOffline').classList.add('active');
    document.getElementById('modeOnline').classList.remove('active');
    document.getElementById('connDot').className = 'status-dot';
    document.getElementById('connText').textContent = '离线自主仿真 · 100 ms';
  });

  document.getElementById('btnConfirmConn').addEventListener('click', async () => {
    const proto = protoSel.value;
    const isRtu = proto === 'modbus-rtu';
    const rtuPort = document.getElementById('rtuPortSelect').value || 'COM3';
    const rtuBaud = Number(document.getElementById('rtuBaudSelect').value || 115200);
    const ep = isRtu ? rtuPort : (document.getElementById('connEndpoint').value.trim() || '192.168.0.10');
    const poll = document.getElementById('connPoll').value;
    state.mode = 'online';
    document.getElementById('modeOnline').classList.add('active');
    document.getElementById('modeOffline').classList.remove('active');
    document.getElementById('connDot').className = 'status-dot warn';
    document.getElementById('connText').textContent = `正在连接 [${proto}] · ${ep}`;
    modal.classList.remove('open');

    if (window.TiaTwinClient) {
      try {
        if (!state.manifest) state.manifest = await window.TiaTwinClient.loadManifest('twin.manifest.json');
        if (state.client) { try { state.client.disconnect(); } catch (_) {} }
        const cli = new window.TiaTwinClient({ manifest: state.manifest, url: 'ws://127.0.0.1:8765/ws' });
        cli.on('status', (s) => {
          if (s && s.state === 'online') {
            const cfg = isRtu
              ? { protocol: proto, port: rtuPort, baudrate: rtuBaud, pollMs: Number(poll) }
              : { protocol: proto, ip: ep.split(':')[0], rack: 0, slot: 1, pollMs: Number(poll) };
            cli.configurePlc(cfg).catch(() => {});
          }
        });
        cli.on('plc', (p) => {
          if (!p) return;
          if (p.state === 'connected') {
            document.getElementById('connDot').className = 'status-dot';
            document.getElementById('connText').textContent = `已连通 [${proto}] · ${ep}`;
          } else if (p.state === 'error') {
            document.getElementById('connDot').className = 'status-dot danger';
            document.getElementById('connText').textContent = `连接失败: ${p.message || ep}`;
          }
        });
        cli.on('values', ({ values }) => {
          if (!values) return;
          if ('pump.infeed' in values) state.running = Boolean(values['pump.infeed']);
          if ('tank.reg_level' in values) state.regLevel = Number(values['tank.reg_level']);
          if ('flow.inlet' in values) state.flowIn = Number(values['flow.inlet']);
          if ('wq.cod' in values) state.wqCod = Number(values['wq.cod']);
          if ('wq.do' in values) state.wqDo = Number(values['wq.do']);
        });
        cli.connect();
        state.client = cli;
      } catch (_) {}
    }
  });

  // 2.5D Isometric Water Treatment Plant
  const canvas = document.getElementById('isoCanvas');
  const ctx = canvas.getContext('2d');
  const iso = (x, y, z, ox, oy, s) => [ox + (x - z) * 0.866 * s, oy + (x + z) * 0.5 * s - y * s];

  function drawShadow(x, z, w, d, ox, oy, s, a = 0.13) {
    const p0 = iso(x, 0, z, ox, oy, s), p1 = iso(x + w, 0, z, ox, oy, s), p2 = iso(x + w, 0, z + d, ox, oy, s), p3 = iso(x, 0, z + d, ox, oy, s);
    ctx.fillStyle = `rgba(17, 24, 39, ${a})`;
    ctx.beginPath(); ctx.moveTo(...p0); ctx.lineTo(...p1); ctx.lineTo(...p2); ctx.lineTo(...p3); ctx.closePath(); ctx.fill();
  }

  function drawBox(x, y, z, w, h, d, c, ox, oy, s) {
    const p000 = iso(x, y, z, ox, oy, s), p100 = iso(x + w, y, z, ox, oy, s), p101 = iso(x + w, y, z + d, ox, oy, s), p001 = iso(x, y, z + d, ox, oy, s);
    const p010 = iso(x, y + h, z, ox, oy, s), p110 = iso(x + w, y + h, z, ox, oy, s), p111 = iso(x + w, y + h, z + d, ox, oy, s), p011 = iso(x, y + h, z + d, ox, oy, s);
    ctx.lineJoin = 'round';
    ctx.fillStyle = c.right; ctx.beginPath(); ctx.moveTo(...p100); ctx.lineTo(...p101); ctx.lineTo(...p111); ctx.lineTo(...p110); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c.left; ctx.beginPath(); ctx.moveTo(...p001); ctx.lineTo(...p101); ctx.lineTo(...p111); ctx.lineTo(...p011); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c.top; ctx.beginPath(); ctx.moveTo(...p010); ctx.lineTo(...p110); ctx.lineTo(...p111); ctx.lineTo(...p011); ctx.closePath(); ctx.fill();
    if (c.edge) {
      ctx.strokeStyle = c.edge; ctx.lineWidth = 0.85;
      ctx.beginPath(); ctx.moveTo(...p010); ctx.lineTo(...p110); ctx.lineTo(...p111); ctx.lineTo(...p011); ctx.closePath();
      ctx.moveTo(...p110); ctx.lineTo(...p100); ctx.moveTo(...p111); ctx.lineTo(...p101); ctx.moveTo(...p011); ctx.lineTo(...p001);
      ctx.stroke();
    }
  }

  function drawOpenTank(x, y, z, w, h, d, wallT, waterRatio, wallCol, waterCol, phase, ox, oy, s) {
    // Back concrete walls
    drawBox(x, y, z, w, h, wallT, wallCol, ox, oy, s);
    drawBox(x, y, z + wallT, wallT, h, d - wallT, wallCol, ox, oy, s);
    // Floor slab + water volume
    const innerW = w - wallT * 2, innerD = d - wallT * 2;
    const wh = Math.max(0.28, (h - 0.35) * waterRatio);
    drawBox(x + wallT, y + 0.14, z + wallT, innerW, wh, innerD, waterCol, ox, oy, s);
    // Subtle water ripple lines on top face
    const wy = y + 0.14 + wh + 0.01;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 3; k++) {
      const shift = ((phase * 0.4 + k * 0.33) % 1);
      const wz = z + wallT + 0.3 + shift * Math.max(0.4, innerD - 0.6);
      const a = iso(x + wallT + 0.25, wy, wz, ox, oy, s);
      const b = iso(x + w - wallT - 0.25, wy, wz, ox, oy, s);
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
    }
    // Front concrete walls
    drawBox(x + wallT, y, z + d - wallT, w - wallT, h, wallT, wallCol, ox, oy, s);
    drawBox(x + w - wallT, y, z + wallT, wallT, h, d - wallT * 2, wallCol, ox, oy, s);
  }

  function drawCylinder(cx, y, cz, r, h, c, ox, oy, s) {
    const [bx, by] = iso(cx, y, cz, ox, oy, s);
    const [tx, ty] = iso(cx, y + h, cz, ox, oy, s);
    const rx = r * 1.12 * s;
    const ry = r * 0.56 * s;

    const grad = ctx.createLinearGradient(bx - rx, by, bx + rx, by);
    grad.addColorStop(0, c.left);
    grad.addColorStop(0.5, c.mid || c.top);
    grad.addColorStop(1, c.right);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(tx - rx, ty);
    ctx.lineTo(bx - rx, by);
    ctx.ellipse(bx, by, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(tx + rx, ty);
    ctx.closePath();
    ctx.fill();

    if (c.edge) {
      ctx.strokeStyle = c.edge;
      ctx.lineWidth = 0.85;
      ctx.stroke();
    }

    ctx.fillStyle = c.top;
    ctx.beginPath();
    ctx.ellipse(tx, ty, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    if (c.edge) {
      ctx.strokeStyle = c.edge;
      ctx.lineWidth = 0.85;
      ctx.stroke();
    }
  }

  function drawIsoPipe(pts, width, casingCol, flowCol, active, reverse, phase, ox, oy, s) {
    if (!pts || pts.length < 2) return;
    const sp = pts.map((p) => iso(p[0], p[1], p[2], ox, oy, s));
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(sp[0][0], sp[0][1]);
      for (let i = 1; i < sp.length; i++) ctx.lineTo(sp[i][0], sp[i][1]);
    };

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Outer pipe drop shadow
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.22)';
    ctx.lineWidth = width + 2.5;
    trace();
    ctx.stroke();

    // Metallic pipe casing
    ctx.strokeStyle = casingCol;
    ctx.lineWidth = width;
    trace();
    ctx.stroke();

    // Inner specular highlight
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.25)';
    ctx.lineWidth = Math.max(1.8, width * 0.35);
    trace();
    ctx.stroke();

    // Animated directional flow inside pipe
    if (active) {
      ctx.strokeStyle = flowCol;
      ctx.lineWidth = Math.max(2.0, width * 0.42);
      ctx.setLineDash([7, 9]);
      ctx.lineDashOffset = (reverse ? 1 : -1) * (phase * 28);
      trace();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Metallic flange collars at elbow joints
    for (let i = 1; i < sp.length - 1; i++) {
      ctx.fillStyle = '#94a3b8';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sp[i][0], sp[i][1], width * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawValve(wx, wy, wz, isOpen, ox, oy, s) {
    const [vx, vy] = iso(wx, wy, wz, ox, oy, s);
    ctx.save();
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(vx - 6, vy - 4, 12, 8, 2);
    ctx.fill();
    ctx.stroke();

    // Valve stem + motorized actuator cap
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(vx, vy - 4);
    ctx.lineTo(vx, vy - 12);
    ctx.stroke();

    ctx.fillStyle = isOpen ? '#059669' : '#dc2626';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(vx - 5.5, vy - 17, 11, 6.5, 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawPumpUnit(x, y, z, running, ox, oy, s) {
    const skidCol = { top: '#64748b', left: '#475569', right: '#334155', edge: 'rgba(15,23,42,0.28)' };
    const motorCol = running
      ? { top: '#10b981', mid: '#059669', left: '#047857', right: '#065f46', edge: 'rgba(15,23,42,0.25)' }
      : { top: '#94a3b8', mid: '#64748b', left: '#475569', right: '#334155', edge: 'rgba(15,23,42,0.25)' };
    const voluteCol = { top: '#cbd5e1', mid: '#94a3b8', left: '#64748b', right: '#475569', edge: 'rgba(15,23,42,0.25)' };

    drawBox(x - 0.55, y, z - 0.55, 1.1, 0.22, 1.1, skidCol, ox, oy, s);
    drawCylinder(x - 0.15, y + 0.22, z, 0.28, 0.58, motorCol, ox, oy, s);
    drawCylinder(x + 0.24, y + 0.22, z + 0.12, 0.22, 0.42, voluteCol, ox, oy, s);

    // Status beacon
    const [lx, ly] = iso(x - 0.15, y + 0.85, z, ox, oy, s);
    ctx.fillStyle = running ? '#34d399' : '#ef4444';
    ctx.beginPath(); ctx.arc(lx, ly, 2.8, 0, Math.PI * 2); ctx.fill();
  }

  function drawCallout(wx, wy, wz, dx, dy, title, sub, color, ox, oy, s) {
    const [sx, sy] = iso(wx, wy, wz, ox, oy, s);
    const tx = sx + dx, ty = sy + dy;
    ctx.strokeStyle = 'rgba(17, 24, 39, 0.30)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(sx, sy, 3.2, 0, Math.PI * 2); ctx.fill();

    ctx.font = '600 11px "Fira Sans", "Segoe UI", sans-serif';
    const w1 = ctx.measureText(title).width;
    ctx.font = '400 10px "Fira Code", Consolas, monospace';
    const w2 = ctx.measureText(sub).width;
    const bw = Math.max(w1, w2) + 22, bh = 36;
    const bx = dx >= 0 ? tx : tx - bw, by = ty - bh / 2;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.strokeStyle = 'rgba(17, 24, 39, 0.16)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(bx + 9, by + 12, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = '#111827'; ctx.font = '600 11px "Fira Sans", "Segoe UI", sans-serif';
    ctx.fillText(title, bx + 16, by + 15);
    ctx.fillStyle = '#4b5563'; ctx.font = '400 10px "Fira Code", Consolas, monospace';
    ctx.fillText(sub, bx + 9, by + 28);
  }

  function renderCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 2;
    const W = rect.width, H = rect.height;
    if (canvas.width !== Math.floor(W * dpr) || canvas.height !== Math.floor(H * dpr)) {
      canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const ox = W * 0.48, oy = H * 0.56, s = Math.min(W, H) * 0.032;

    // Subtle concrete plant pad & isometric engineering grid
    const pad0 = iso(-15.5, 0, -7.2, ox, oy, s), pad1 = iso(14.5, 0, -7.2, ox, oy, s), pad2 = iso(14.5, 0, 5.4, ox, oy, s), pad3 = iso(-15.5, 0, 5.4, ox, oy, s);
    ctx.fillStyle = 'rgba(209, 213, 219, 0.28)';
    ctx.beginPath(); ctx.moveTo(...pad0); ctx.lineTo(...pad1); ctx.lineTo(...pad2); ctx.lineTo(...pad3); ctx.closePath(); ctx.fill();

    ctx.strokeStyle = 'rgba(17, 24, 39, 0.055)'; ctx.lineWidth = 1;
    for (let gx = -15; gx <= 14; gx += 1.6) {
      const a = iso(gx, 0, -7.2, ox, oy, s), b = iso(gx, 0, 5.4, ox, oy, s);
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
    }
    for (let gz = -7.2; gz <= 5.4; gz += 1.6) {
      const a = iso(-15, 0, gz, ox, oy, s), b = iso(14.5, 0, gz, ox, oy, s);
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
    }

    const concrete = { top: '#e2e8f0', left: '#94a3b8', right: '#64748b', edge: 'rgba(15,23,42,0.22)' };
    const baffleWall = { top: '#cbd5e1', left: '#64748b', right: '#475569', edge: 'rgba(15,23,42,0.2)' };
    const steelSkid = { top: '#94a3b8', left: '#475569', right: '#334155', edge: 'rgba(15,23,42,0.28)' };
    const bridgeCol = { top: '#334155', left: '#1e293b', right: '#0f172a', edge: 'rgba(255,255,255,0.12)' };

    const rawWater = { top: '#38bdf8', left: '#0284c7', right: '#0369a1', edge: 'rgba(255,255,255,0.26)' };
    const anaerobicWater = { top: '#22d3ee', left: '#0891b2', right: '#0e7490', edge: 'rgba(255,255,255,0.24)' };
    const aerobicWater = { top: '#2dd4bf', left: '#0d9488', right: '#0f766e', edge: 'rgba(255,255,255,0.26)' };
    const clarifierWater = { top: '#34d399', left: '#059669', right: '#047857', edge: 'rgba(255,255,255,0.28)' };
    const cleanWater = { top: '#4ade80', left: '#10b981', right: '#059669', edge: 'rgba(255,255,255,0.3)' };

    const blowerBody = { top: '#94a3b8', mid: '#64748b', left: '#475569', right: '#334155', edge: 'rgba(15,23,42,0.25)' };
    const ufVessel = { top: '#f8fafc', mid: '#e2e8f0', left: '#cbd5e1', right: '#94a3b8', edge: 'rgba(15,23,42,0.25)' };
    const pacTank = { top: '#fde68a', mid: '#fbbf24', left: '#f59e0b', right: '#d97706', edge: 'rgba(120,53,15,0.28)' };

    // 1. Ground Shadows
    drawShadow(-5.8, -5.9, 3.6, 2.0, ox, oy, s);
    drawShadow(3.3, -5.8, 2.6, 2.0, ox, oy, s);
    drawShadow(-12.3, -1.9, 4.0, 3.7, ox, oy, s);
    drawShadow(-6.5, -2.1, 5.8, 4.1, ox, oy, s);
    drawShadow(0.9, -2.0, 4.2, 3.9, ox, oy, s);
    drawShadow(6.7, -2.0, 4.6, 3.9, ox, oy, s);

    // 2. Back Row Equipment: Roots Blower Skid & Galvanized Air Header
    drawBox(-5.6, 0, -5.8, 3.4, 0.25, 1.8, steelSkid, ox, oy, s);
    drawPumpUnit(-4.7, 0.25, -4.9, state.running, ox, oy, s);
    drawPumpUnit(-3.1, 0.25, -4.9, state.running, ox, oy, s);
    drawCylinder(-4.7, 1.0, -5.2, 0.24, 0.55, blowerBody, ox, oy, s);
    drawCylinder(-3.1, 1.0, -5.2, 0.24, 0.55, blowerBody, ox, oy, s);

    // Elevated Galvanized Air Header Pipe + 3 Drop Branches into A2O O-Zone
    drawIsoPipe([[-4.7, 1.55, -5.2], [-4.7, 2.55, -5.2], [-1.8, 2.55, -5.2], [-1.8, 2.55, -1.0]], 5.5, '#64748b', '#e0f2fe', state.running, false, state.phase, ox, oy, s);
    drawIsoPipe([[-3.1, 1.55, -5.2], [-3.1, 2.55, -5.2]], 5.0, '#64748b', '#e0f2fe', state.running, false, state.phase, ox, oy, s);
    drawIsoPipe([[-1.8, 2.55, -1.0], [-1.8, 2.55, 1.0]], 4.8, '#64748b', '#e0f2fe', state.running, false, state.phase, ox, oy, s);
    drawValve(-2.6, 2.55, -5.2, state.running, ox, oy, s);

    // 3. Back Row Equipment: PAC/PAM Dosing Skid & Amber Chemical Pipeline
    drawBox(3.4, 0, -5.7, 2.4, 0.24, 1.8, steelSkid, ox, oy, s);
    drawCylinder(4.1, 0.24, -4.8, 0.56, 1.55, pacTank, ox, oy, s);
    drawCylinder(4.1, 1.79, -4.8, 0.18, 0.35, blowerBody, ox, oy, s); // Agitator motor
    drawPumpUnit(5.1, 0.24, -4.6, state.dosing || state.running, ox, oy, s);
    // Amber chemical dosing pipe -> injects into Unit 03 -> 04 transfer tee
    const dosingActive = state.dosing || state.running;
    drawIsoPipe([[5.1, 0.65, -4.4], [5.85, 0.65, -4.4], [5.85, 1.25, -0.2]], 4.4, '#78350f', state.dosing ? '#fde047' : '#f59e0b', dosingActive, false, state.phase * (state.dosing ? 1.8 : 1.0), ox, oy, s);
    drawValve(5.85, 1.25, -2.2, dosingActive, ox, oy, s);

    // 4. Raw Water Inlet Pipeline -> Unit 01
    drawIsoPipe([[-14.8, 1.3, -0.2], [-12.2, 1.3, -0.2]], 7.5, '#334155', '#38bdf8', state.running, false, state.phase, ox, oy, s);
    drawValve(-13.4, 1.3, -0.2, state.running, ox, oy, s);

    // 5. Unit 01: Bar Screen & Regulation Basin (x=-12.2, w=3.8, d=3.4)
    const regRatio = Math.min(0.95, Math.max(0.35, (state.regLevel - 2.2) / 2.2));
    drawOpenTank(-12.2, 0, -1.7, 3.8, 2.2, 3.4, 0.25, regRatio, concrete, rawWater, state.phase, ox, oy, s);
    // Inclined mechanical bar screen (5 angled bars + top drive motor)
    ctx.save();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.6;
    for (let bi = 0; bi < 5; bi++) {
      const bz = -1.15 + bi * 0.45;
      const pBot = iso(-11.4, 0.8, bz, ox, oy, s);
      const pTop = iso(-10.8, 2.55, bz, ox, oy, s);
      ctx.beginPath(); ctx.moveTo(...pBot); ctx.lineTo(...pTop); ctx.stroke();
    }
    ctx.restore();
    drawBox(-11.0, 2.45, -1.35, 0.45, 0.35, 2.3, bridgeCol, ox, oy, s);

    // 1# Infeed Lift Pump on side plinth + Transfer Pipe 01 -> 02
    drawBox(-8.4, 0, -0.9, 1.3, 0.35, 1.5, steelSkid, ox, oy, s);
    drawPumpUnit(-7.75, 0.35, -0.15, state.running, ox, oy, s);
    drawIsoPipe([[-8.4, 1.15, -0.15], [-7.75, 1.15, -0.15], [-7.75, 1.55, -0.15], [-6.4, 1.55, -0.15]], 7.2, '#334155', '#38bdf8', state.running, false, state.phase, ox, oy, s);
    drawValve(-7.05, 1.55, -0.15, state.running, ox, oy, s);

    // 6. Unit 02: A2O Biological Reactor (x=-6.4, w=5.6, d=3.8) divided into A1 / A2 / O
    drawOpenTank(-6.4, 0, -1.9, 5.6, 2.45, 3.8, 0.24, 0.84, concrete, anaerobicWater, state.phase, ox, oy, s);
    // Sub-tint O-zone water right side, then re-draw front retaining walls so concrete rim stays cleanly in front
    drawBox(-3.1, 0.14, -1.66, 2.06, 1.85, 3.32, aerobicWater, ox, oy, s);
    drawBox(-4.6, 0.25, -1.66, 0.16, 2.1, 3.32, baffleWall, ox, oy, s);
    drawBox(-3.2, 0.25, -1.66, 0.16, 2.1, 3.32, baffleWall, ox, oy, s);
    drawBox(-6.16, 0, 1.66, 5.36, 2.45, 0.24, concrete, ox, oy, s);
    drawBox(-1.04, 0, -1.66, 0.24, 2.45, 3.32, concrete, ox, oy, s);

    // Rising aeration bubbles in O-Zone when running
    if (state.running) {
      ctx.save();
      for (let i = 0; i < 12; i++) {
        const bx = -2.85 + (i % 4) * 0.48;
        const bz = -1.1 + Math.floor(i / 4) * 1.05;
        const rise = ((state.phase * 0.85 + i * 0.21) % 1);
        const by = 1.65 + rise * 0.65;
        const [sx, sy] = iso(bx, by, bz, ox, oy, s);
        ctx.fillStyle = `rgba(224, 242, 254, ${(1 - rise) * 0.78})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 2.2 + (i % 2) * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Top air manifold branches directly visible above O-zone
    [-1.0, 0.0, 1.0].forEach((bz) => {
      drawIsoPipe([[-1.8, 2.55, bz], [-1.8, 1.95, bz]], 3.8, '#64748b', '#e0f2fe', state.running, false, state.phase, ox, oy, s);
    });

    // Transfer Pipe 02 -> 03
    drawIsoPipe([[-0.8, 1.45, -0.15], [1.0, 1.45, -0.15]], 7.2, '#334155', '#2dd4bf', state.running, false, state.phase, ox, oy, s);
    drawValve(0.1, 1.45, -0.15, state.running, ox, oy, s);

    // 7. Unit 03: Secondary Clarifier & Scraper Bridge (x=1.0, w=4.0, d=3.6)
    drawOpenTank(1.0, 0, -1.8, 4.0, 2.3, 3.6, 0.24, 0.82, concrete, clarifierWater, state.phase, ox, oy, s);
    // Central cylindrical feedwell
    drawCylinder(3.0, 1.4, 0.0, 0.55, 0.65, concrete, ox, oy, s);
    // Gently oscillating truss scraper bridge
    const sweep = state.running ? Math.sin(state.phase * 0.55) * 0.35 : 0;
    drawBox(2.75 + sweep, 2.22, -1.75, 0.5, 0.26, 3.5, bridgeCol, ox, oy, s);
    drawCylinder(3.0 + sweep, 2.48, 0.0, 0.22, 0.35, blowerBody, ox, oy, s);

    // Transfer Pipe 03 -> 04 (with PAC injection tee at x=5.85)
    drawIsoPipe([[5.0, 1.25, -0.2], [6.8, 1.25, -0.2]], 7.2, '#334155', state.dosing ? '#fbbf24' : '#34d399', state.running, false, state.phase, ox, oy, s);
    drawValve(6.15, 1.25, -0.2, state.running, ox, oy, s);

    // 8. Unit 04: UF Membrane Pressure Vessel Skid (left half) + Clean Effluent Basin (right half)
    drawBox(6.8, 0, -1.8, 2.0, 0.3, 3.6, steelSkid, ox, oy, s);
    const ufCoords = [
      [7.35, -0.9], [8.25, -0.9],
      [7.35, 0.7],  [8.25, 0.7]
    ];
    ufCoords.forEach(([ux, uz]) => {
      drawCylinder(ux, 0.3, uz, 0.32, 2.15, ufVessel, ox, oy, s);
    });
    // UF top permeate & backwash header manifold
    const ufColor = state.backwash ? '#f59e0b' : '#34d399';
    drawIsoPipe([[7.35, 2.52, -0.9], [8.25, 2.52, -0.9], [8.25, 2.52, 0.7], [7.35, 2.52, 0.7]], 4.8, '#475569', ufColor, state.running || state.backwash, state.backwash, state.phase, ox, oy, s);
    drawIsoPipe([[8.25, 2.52, 0.0], [9.15, 2.52, 0.0], [9.15, 1.7, 0.0]], 5.0, '#475569', ufColor, state.running || state.backwash, state.backwash, state.phase, ox, oy, s);

    // Clean Effluent Basin
    drawOpenTank(8.9, 0, -1.8, 2.3, 2.1, 3.6, 0.22, 0.85, concrete, cleanWater, state.phase, ox, oy, s);

    // 9. Effluent Discharge Pipe -> Outlet
    drawIsoPipe([[11.2, 1.15, -0.1], [13.5, 1.15, -0.1]], 7.5, '#334155', '#4ade80', state.running, false, state.phase, ox, oy, s);
    drawValve(12.25, 1.15, -0.1, state.running, ox, oy, s);

    // 10. Foreground Sludge Return Loop (drawn last so 100% unobstructed)
    drawBox(0.55, 0, 2.35, 1.3, 0.28, 1.25, steelSkid, ox, oy, s);
    drawPumpUnit(1.2, 0.28, 2.95, state.running, ox, oy, s);
    drawIsoPipe(
      [[2.8, 0.85, 1.8], [2.8, 0.85, 2.95], [1.2, 0.85, 2.95], [-5.2, 0.85, 2.95], [-5.2, 1.65, 1.9]],
      6.4,
      '#334155',
      '#22d3ee',
      state.running,
      false,
      state.phase,
      ox,
      oy,
      s
    );
    drawValve(-1.8, 0.85, 2.95, state.running, ox, oy, s);

    // 11. Five Clean Callouts positioned without touching HUDs
    drawCallout(-10.3, 2.2, 1.3, -16, 48, '01 · 格栅调节池', `液位 ${state.regLevel.toFixed(2)} m · 1#提升泵`, '#0369a1', ox, oy, s);
    drawCallout(-3.9, 1.65, -5.2, -16, -44, '02 · 罗茨曝气风机', `${state.blowerHz.toFixed(1)} Hz · DO ${state.wqDo.toFixed(2)}`, '#059669', ox, oy, s);
    drawCallout(1.2, 1.0, 2.95, 16, 42, '03 · 二沉池 · 污泥回流', `刮泥机 / 回流泵 ${state.running ? 'RUN' : 'STOP'}`, '#0369a1', ox, oy, s);
    drawCallout(4.1, 2.15, -4.8, 12, -40, '04 · PAC 加药撬装', `加药泵 ${state.dosing ? '强力加药中' : '自动定量'}`, '#d97706', ox, oy, s);
    drawCallout(10.0, 1.9, -0.2, 16, -42, '05 · 超滤膜组 · 达标出水', `COD ${state.wqCod.toFixed(1)} mg/L · ${state.backwash ? '反洗中' : '一级A'}`, '#059669', ox, oy, s);
  }

  function formatTagValue(id) {
    switch (id) {
      case 'cmd.auto': return state.running ? '1' : '0';
      case 'cmd.stop': return state.running ? '0' : '1';
      case 'cmd.backwash': return state.backwash ? '1' : '0';
      case 'cmd.dosing': return state.dosing ? '1' : '0';
      case 'pump.infeed':
      case 'blower.aeration':
      case 'pump.sludge':
      case 'valve.outlet': return state.running ? '1' : '0';
      case 'alarm.high_level': return state.regLevel > 4.2 ? '1' : '0';
      case 'tank.reg_level': return `${state.regLevel.toFixed(2)} m`;
      case 'flow.inlet': return `${state.flowIn.toFixed(1)} m³/h`;
      case 'wq.do': return `${state.wqDo.toFixed(2)} mg/L`;
      case 'wq.ph': return state.wqPh.toFixed(2);
      case 'wq.cod': return `${state.wqCod.toFixed(1)} mg/L`;
      case 'wq.turbidity': return `${state.wqTurb.toFixed(2)} NTU`;
      case 'blower.hz': return `${state.blowerHz.toFixed(1)} Hz`;
      case 'prod.daily_m3': return `${state.dailyM3}`;
      case 'sys.power_kw': return `${state.powerKw.toFixed(1)} kW`;
      default: return state.running ? '1' : '0';
    }
  }

  function renderTables() {
    const q = (document.getElementById('tagSearch').value || '').toLowerCase();
    const list = tagsMeta.filter((t) => t.id.toLowerCase().includes(q) || t.dev.toLowerCase().includes(q) || t.addr.toLowerCase().includes(q));
    document.getElementById('tagTableBody').innerHTML = list.map((t) => `<tr>
      <td class="mono">${t.id}</td><td class="mono" style="color:var(--active);">${t.dev}</td>
      <td class="mono">${t.addr}</td><td class="mono">${t.type}</td>
      <td><span class="badge ${t.access}">${t.access.toUpperCase()}</span></td>
      <td class="mono" style="font-weight:600;">${formatTagValue(t.id)}</td>
      <td style="color:var(--muted);">${t.desc}</td>
    </tr>`).join('');

    document.getElementById('tagCountBadge').textContent = `${tagsMeta.length} 个点位`;
    document.getElementById('deviceList').innerHTML = devices.map((d, i) => `<div class="device-card ${d.active ? 'active-dev' : ''}">
      <div>
        <div class="dev-name"><span class="ind ${d.active ? 'ok' : ''}"></span>${d.id} · ${d.name} <span class="badge w">${d.proto}</span></div>
        <div class="dev-endpoint">${d.endpoint} · ${d.pollMs} ms</div>
      </div>
      <button class="btn" data-dev="${i}">${d.active ? '已激活' : '启用'}</button>
    </div>`).join('');
    document.querySelectorAll('[data-dev]').forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.dev); devices[i].active = !devices[i].active; renderTables();
    }));

    document.getElementById('newTagDev').innerHTML = devices.map((d) => `<option value="${d.id}">${d.id} (${d.proto})</option>`).join('');
    document.getElementById('mgrTagBody').innerHTML = tagsMeta.map((t, i) => `<tr>
      <td class="mono">${t.id}</td><td class="mono" style="color:var(--active);">${t.dev}</td>
      <td class="mono">${t.addr}</td><td class="mono">${t.type}</td>
      <td><span class="badge ${t.access}">${t.access.toUpperCase()}</span></td>
      <td><button class="btn" style="padding:2px 8px;font-size:11px;" data-del="${i}">移除</button></td>
    </tr>`).join('');
    document.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      tagsMeta.splice(Number(b.dataset.del), 1); renderTables();
    }));
  }

  function drawTrends() {
    const tc = document.getElementById('trendCanvas'); if (!tc) return;
    const tctx = tc.getContext('2d'), W = tc.width, H = tc.height;
    tctx.clearRect(0, 0, W, H);
    tctx.strokeStyle = 'rgba(17,24,39,0.08)';
    for (let y = 40; y < H; y += 55) { tctx.beginPath(); tctx.moveTo(0, y); tctx.lineTo(W, y); tctx.stroke(); }
    tctx.strokeStyle = '#059669'; tctx.lineWidth = 2.2; tctx.beginPath();
    state.codHistory.forEach((v, i) => {
      const px = (i / (state.codHistory.length - 1)) * (W - 20) + 10;
      const py = H - ((v - 20) / 20) * (H - 30) - 15;
      if (i === 0) tctx.moveTo(px, py); else tctx.lineTo(px, py);
    });
    tctx.stroke();
  }

  document.getElementById('tagSearch').addEventListener('input', renderTables);
  document.getElementById('btnAddTag').addEventListener('click', () => {
    const id = document.getElementById('newTagId').value.trim(), addr = document.getElementById('newTagAddr').value.trim();
    if (!id || !addr) return;
    tagsMeta.push({ id, dev: document.getElementById('newTagDev').value, addr, type: document.getElementById('newTagType').value, access: document.getElementById('newTagAccess').value, desc: '自定义水务点位' });
    document.getElementById('newTagId').value = ''; document.getElementById('newTagAddr').value = '';
    renderTables();
  });
  document.getElementById('btnExportManifest').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ schema: 'tia-web-twin/manifest@1', project: 'water-treatment-scada', devices, tags: tagsMeta }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'twin.manifest.json'; a.click();
  });

  function loop(now) {
    state.phase = now * 0.001;
    if (state.running && state.mode === 'offline') {
      state.regLevel = +(3.40 + Math.sin(state.phase * 0.6) * 0.04).toFixed(2);
      state.wqDo = +(2.44 + Math.cos(state.phase * 0.8) * 0.03).toFixed(2);
      document.getElementById('valLevel').textContent = `${state.regLevel.toFixed(2)} m`;
      document.getElementById('valDo').textContent = `${state.wqDo.toFixed(2)} mg/L`;
    }
    document.getElementById('indPump').className = `ind ${state.running ? 'ok' : ''}`;
    document.getElementById('valPump').textContent = state.running ? '运行中' : '已停机';
    document.getElementById('indBlower').className = `ind ${state.running ? 'ok' : ''}`;
    renderCanvas();
    requestAnimationFrame(loop);
  }

  renderTables();
  requestAnimationFrame(loop);
})();
