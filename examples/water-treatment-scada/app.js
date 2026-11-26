(() => {
  const state = {
    mode: 'offline',
    running: true,
    backwash: false,
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
  document.getElementById('btnDosing').addEventListener('click', () => {
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

  function drawShadow(x, z, w, d, ox, oy, s, a = 0.14) {
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
      ctx.strokeStyle = c.edge; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(...p010); ctx.lineTo(...p110); ctx.lineTo(...p111); ctx.lineTo(...p011); ctx.closePath();
      ctx.moveTo(...p110); ctx.lineTo(...p100); ctx.moveTo(...p111); ctx.lineTo(...p101); ctx.moveTo(...p011); ctx.lineTo(...p001);
      ctx.stroke();
    }
  }

  function drawCallout(wx, wy, wz, dx, dy, title, sub, color, ox, oy, s) {
    const [sx, sy] = iso(wx, wy, wz, ox, oy, s);
    const tx = sx + dx, ty = sy + dy;
    ctx.strokeStyle = 'rgba(17, 24, 39, 0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(sx, sy, 3.2, 0, Math.PI * 2); ctx.fill();

    ctx.font = '600 11px "Fira Sans", "Segoe UI", sans-serif';
    const w1 = ctx.measureText(title).width;
    ctx.font = '400 10px "Fira Code", Consolas, monospace';
    const w2 = ctx.measureText(sub).width;
    const bw = Math.max(w1, w2) + 20, bh = 36;
    const bx = dx >= 0 ? tx : tx - bw, by = ty - bh / 2;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = 'rgba(17, 24, 39, 0.14)'; ctx.lineWidth = 1;
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

    const ox = W * 0.49, oy = H * 0.54, s = Math.min(W, H) * 0.036;

    ctx.strokeStyle = 'rgba(17, 24, 39, 0.055)'; ctx.lineWidth = 1;
    for (let gx = -14; gx <= 14; gx += 1.6) {
      const a = iso(gx, 0, -8, ox, oy, s), b = iso(gx, 0, 8, ox, oy, s);
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
    }
    for (let gz = -8; gz <= 8; gz += 1.6) {
      const a = iso(-14, 0, gz, ox, oy, s), b = iso(14, 0, gz, ox, oy, s);
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
    }

    const concrete = { top: '#cbd5e1', left: '#94a3b8', right: '#64748b', edge: 'rgba(17,24,39,0.18)' };
    const darkPipe = { top: '#475569', left: '#334155', right: '#1e293b', edge: 'rgba(17,24,39,0.22)' };
    const rawWater = { top: '#38bdf8', left: '#0284c7', right: '#0369a1', edge: 'rgba(255,255,255,0.28)' };
    const bioWater = { top: '#2dd4bf', left: '#0d9488', right: '#0f766e', edge: 'rgba(255,255,255,0.28)' };
    const cleanWater = { top: '#34d399', left: '#10b981', right: '#059669', edge: 'rgba(255,255,255,0.3)' };
    const machineCol = state.running ? { top: '#34d399', left: '#059669', right: '#047857' } : { top: '#94a3b8', left: '#64748b', right: '#475569' };

    drawShadow(-11.5, -2.0, 4.2, 4.0, ox, oy, s);
    drawShadow(-5.8, -2.2, 5.2, 4.4, ox, oy, s);
    drawShadow(0.8, -2.0, 4.0, 4.0, ox, oy, s);
    drawShadow(6.2, -1.8, 3.8, 3.6, ox, oy, s);

    drawBox(-7.4, 0.8, -0.3, 1.8, 0.35, 0.6, darkPipe, ox, oy, s);
    drawBox(-0.7, 0.8, -0.3, 1.7, 0.35, 0.6, darkPipe, ox, oy, s);
    drawBox(4.7, 0.8, -0.3, 1.7, 0.35, 0.6, darkPipe, ox, oy, s);

    drawBox(-11.4, 0, -1.8, 4.0, 2.2, 3.6, concrete, ox, oy, s);
    drawBox(-11.1, 0.4, -1.5, 3.4, 1.45, 3.0, rawWater, ox, oy, s);
    drawBox(-8.2, 2.2, -0.6, 0.8, 0.9, 1.2, machineCol, ox, oy, s);

    drawBox(-5.8, 0, -2.0, 5.2, 2.5, 4.0, concrete, ox, oy, s);
    drawBox(-5.5, 0.4, -1.7, 4.6, 1.85, 3.4, bioWater, ox, oy, s);
    drawBox(-4.2, 0, -4.6, 2.2, 1.8, 1.8, darkPipe, ox, oy, s);
    drawBox(-3.8, 1.8, -4.2, 1.4, 0.4, 1.0, machineCol, ox, oy, s);

    drawBox(0.8, 0, -1.8, 4.0, 2.3, 3.6, concrete, ox, oy, s);
    drawBox(1.1, 0.4, -1.5, 3.4, 1.65, 3.0, bioWater, ox, oy, s);
    drawBox(2.5, 2.05, -1.6, 0.6, 0.35, 3.2, darkPipe, ox, oy, s);

    drawBox(6.2, 0, -1.6, 3.8, 2.1, 3.2, concrete, ox, oy, s);
    drawBox(6.5, 0.4, -1.3, 3.2, 1.45, 2.6, cleanWater, ox, oy, s);

    drawCallout(-9.4, 2.2, 1.5, -24, 58, '01 · 格栅调节池', `液位 ${state.regLevel.toFixed(2)} m · 1#泵`, '#0369a1', ox, oy, s);
    drawCallout(-3.1, 2.2, -4.1, -14, -48, '02 · 罗茨曝气风机', `${state.blowerHz.toFixed(1)} Hz · DO ${state.wqDo.toFixed(2)}`, '#059669', ox, oy, s);
    drawCallout(2.8, 2.4, 0, 18, -52, '03 · 二沉池刮泥机', `污泥回流 ${state.running ? 'RUN' : 'STOP'}`, '#0369a1', ox, oy, s);
    drawCallout(8.1, 2.1, 0, 22, -38, '04 · 超滤达标出水', `COD ${state.wqCod.toFixed(1)} mg/L · 一级A`, '#059669', ox, oy, s);
  }

  function renderTables() {
    const q = (document.getElementById('tagSearch').value || '').toLowerCase();
    const list = tagsMeta.filter((t) => t.id.toLowerCase().includes(q) || t.dev.toLowerCase().includes(q) || t.addr.toLowerCase().includes(q));
    document.getElementById('tagTableBody').innerHTML = list.map((t) => `<tr>
      <td class="mono">${t.id}</td><td class="mono" style="color:var(--active);">${t.dev}</td>
      <td class="mono">${t.addr}</td><td class="mono">${t.type}</td>
      <td><span class="badge ${t.access}">${t.access.toUpperCase()}</span></td>
      <td class="mono" style="font-weight:600;">${t.id === 'wq.cod' ? state.wqCod.toFixed(1) : t.id === 'wq.do' ? state.wqDo.toFixed(2) : state.running ? '1' : '0'}</td>
      <td style="color:var(--muted);">${t.desc}</td>
    </tr>`).join('');

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
