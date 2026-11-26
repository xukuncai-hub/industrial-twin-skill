(() => {
  const state = {
    running: true,
    estop: false,
    speed: 1,
    xray: false,
    cph: 43200,
    totalCount: 2864,
    feederIdx: 4,
    axisX: 142.5,
    axisY: -218.4,
    axisZ: 12.4,
    vacuum: -84.2,
    tempPeak: 245.2,
    phase: 0,
    beltOffset: 0,
    pcbs: [-11.5, -5.5, 0.5, 6.5, 11.5]
  };

  const devices = [
    { id: 'PLC-01', name: '西门子 S7-1500 贴装主控', proto: 's7', endpoint: '192.168.0.1 (R0/S1)', pollMs: 100, active: true },
    { id: 'OVEN-01', name: '8 温区回流焊温控仪', proto: 'modbus-rtu', endpoint: 'COM4 @ 115200', pollMs: 200, active: true },
    { id: 'AOI-01', name: 'AOI 光学检测主机', proto: 'tcp-raw', endpoint: '192.168.0.35:9000', pollMs: 50, active: true },
    { id: 'FEED-01', name: '智能飞达总线控制器', proto: 'modbus-tcp', endpoint: '192.168.0.22:502', pollMs: 100, active: false }
  ];

  const tagsMeta = [
    { id: 'cmd.start', dev: 'PLC-01', addr: 'DB1.DBX0.0', type: 'bool', access: 'rw', desc: '产线启动命令' },
    { id: 'cmd.stop', dev: 'PLC-01', addr: 'DB1.DBX0.1', type: 'bool', access: 'rw', desc: '产线停止命令' },
    { id: 'cmd.estop', dev: 'PLC-01', addr: 'DB1.DBX0.3', type: 'bool', access: 'rw', desc: '安全急停信号' },
    { id: 'sens.infeed_pe', dev: 'PLC-01', addr: 'DB1.DBX1.0', type: 'bool', access: 'w', desc: '进板光电检测' },
    { id: 'sens.vision_ok', dev: 'AOI-01', addr: 'TCP:ALIGN_OK', type: 'bool', access: 'w', desc: '飞行视觉对准合格' },
    { id: 'sens.aoi_result', dev: 'AOI-01', addr: 'TCP:AOI_PASS', type: 'bool', access: 'w', desc: 'AOI 光学检测判定' },
    { id: 'smt.feeder_index', dev: 'FEED-01', addr: '40001 (HR0)', type: 'int16', access: 'r', desc: '当前取料飞达站号' },
    { id: 'smt.axis_x', dev: 'PLC-01', addr: 'DB1.DBD4', type: 'real', access: 'r', desc: 'X 轴贴装小车坐标 (mm)' },
    { id: 'smt.axis_y', dev: 'PLC-01', addr: 'DB1.DBD8', type: 'real', access: 'r', desc: 'Y 轴龙门梁坐标 (mm)' },
    { id: 'smt.axis_z', dev: 'PLC-01', addr: 'DB1.DBD12', type: 'real', access: 'r', desc: 'Z 轴吸嘴行程 (mm)' },
    { id: 'smt.vacuum_kpa', dev: 'PLC-01', addr: 'DB1.DBD16', type: 'real', access: 'r', desc: '工作吸嘴真空度 (kPa)' },
    { id: 'smt.cph', dev: 'PLC-01', addr: 'DB1.DBD20', type: 'real', access: 'r', desc: '实时贴装速度 (CPH)' },
    { id: 'smt.total_count', dev: 'PLC-01', addr: 'DB1.DBD28', type: 'int32', access: 'r', desc: '今日生产总数 (PCS)' },
    { id: 'smt.reflow_temp_peak', dev: 'OVEN-01', addr: '30006 (IR6)', type: 'real', access: 'r', desc: '回流焊第 6 峰值温区 (°C)' }
  ];

  const feeders = [
    { slot: '#01', comp: '0402 C', qty: 3400, max: 5000 },
    { slot: '#02', comp: '0603 R', qty: 2900, max: 5000 },
    { slot: '#03', comp: '0805 C', qty: 1800, max: 5000 },
    { slot: '#04', comp: 'QFP-48', qty: 420, max: 1000 },
    { slot: '#05', comp: 'BGA-144', qty: 210, max: 1000 },
    { slot: '#06', comp: 'SOT-23', qty: 890, max: 3000 }
  ];

  const ovenZones = [
    { z: '预热 1', temp: 148 }, { z: '预热 2', temp: 162 },
    { z: '恒温 3', temp: 175 }, { z: '恒温 4', temp: 185 },
    { z: '回流 5', temp: 218 }, { z: '峰值 6', temp: 245 },
    { z: '冷却 7', temp: 165 }, { z: '出料 8', temp: 85 }
  ];

  // Rail view switch
  document.querySelectorAll('.rail-btn[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rail-btn[data-view]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.view-pane').forEach((p) => p.classList.remove('active'));
      document.getElementById(`view-${btn.dataset.view}`).classList.add('active');
    });
  });

  // Controls
  document.getElementById('btnStart').addEventListener('click', () => { if (!state.estop) state.running = true; });
  document.getElementById('btnStop').addEventListener('click', () => { state.running = false; });
  document.getElementById('btnReset').addEventListener('click', () => { state.estop = false; });
  document.getElementById('btnEstop').addEventListener('click', () => { state.estop = true; state.running = false; });
  document.getElementById('btnSpeed').addEventListener('click', (e) => {
    state.speed = state.speed === 1 ? 2 : 1;
    e.currentTarget.textContent = `${state.speed}.0x`;
  });
  document.getElementById('btnXray').addEventListener('click', (e) => {
    state.xray = !state.xray;
    e.currentTarget.classList.toggle('active-toggle', state.xray);
  });

  // Modal
  const modal = document.getElementById('connModal');
  document.getElementById('btnOpenConn').addEventListener('click', () => modal.classList.add('open'));
  document.getElementById('modeOnline').addEventListener('click', () => modal.classList.add('open'));
  document.getElementById('modeOffline').addEventListener('click', () => {
    document.getElementById('modeOffline').classList.add('active');
    document.getElementById('modeOnline').classList.remove('active');
    document.getElementById('connDot').className = 'status-dot';
    document.getElementById('connText').textContent = '离线自主仿真 · 100 ms';
  });
  document.getElementById('btnCloseModal').addEventListener('click', () => modal.classList.remove('open'));
  document.getElementById('btnConfirmConn').addEventListener('click', () => {
    const proto = document.getElementById('connProtocol').value;
    const ep = document.getElementById('connEndpoint').value.trim() || '192.168.0.1';
    const poll = document.getElementById('connPoll').value;
    document.getElementById('modeOnline').classList.add('active');
    document.getElementById('modeOffline').classList.remove('active');
    document.getElementById('connDot').className = 'status-dot warn';
    document.getElementById('connText').textContent = `网关待命 [${proto}] · ${ep} (${poll} ms)`;
    modal.classList.remove('open');
  });

  // Render Process & Device/Tag Views
  function renderProcess() {
    document.getElementById('feederRows').innerHTML = feeders
      .map((f) => `<div class="bar-row">
        <span class="mono">${f.slot}</span><span>${f.comp}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((f.qty / f.max) * 100)}%"></div></div>
        <span class="mono">${f.qty}</span>
      </div>`).join('');
    document.getElementById('ovenRows').innerHTML = ovenZones
      .map((o) => `<div class="bar-row">
        <span>${o.z}</span><span class="mono">${o.temp} °C</span>
        <div class="bar-track"><div class="bar-fill hot" style="width:${Math.round((o.temp / 260) * 100)}%"></div></div>
        <span class="mono" style="color:var(--ok);">OK</span>
      </div>`).join('');
  }

  function getTagVal(id) {
    if (id === 'smt.axis_x') return state.axisX.toFixed(2);
    if (id === 'smt.axis_y') return state.axisY.toFixed(2);
    if (id === 'smt.axis_z') return state.axisZ.toFixed(2);
    if (id === 'smt.vacuum_kpa') return state.vacuum.toFixed(1);
    if (id === 'smt.cph') return String(Math.round(state.cph));
    if (id === 'smt.total_count') return String(state.totalCount);
    if (id === 'smt.reflow_temp_peak') return state.tempPeak.toFixed(1);
    if (id === 'smt.feeder_index') return String(state.feederIdx);
    return state.running && !state.estop ? '1' : '0';
  }

  function renderTags() {
    const q = (document.getElementById('tagSearch').value || '').toLowerCase();
    const list = tagsMeta.filter((t) => t.id.toLowerCase().includes(q) || t.dev.toLowerCase().includes(q) || t.addr.toLowerCase().includes(q));
    document.getElementById('tagTableBody').innerHTML = list
      .map((t) => `<tr>
        <td class="mono">${t.id}</td>
        <td class="mono" style="color:var(--active);">${t.dev}</td>
        <td class="mono">${t.addr}</td>
        <td class="mono">${t.type}</td>
        <td><span class="badge ${t.access}">${t.access.toUpperCase()}</span></td>
        <td class="mono" style="font-weight:600;">${getTagVal(t.id)}</td>
        <td style="color:var(--muted);">${t.desc}</td>
      </tr>`).join('');
  }

  function renderDevices() {
    document.getElementById('devCountBadge').textContent = `${devices.length} 台设备`;
    document.getElementById('tagCountBadge').textContent = `${tagsMeta.length} 个点位`;
    document.getElementById('deviceList').innerHTML = devices
      .map((d, i) => `<div class="device-card ${d.active ? 'active-dev' : ''}">
        <div>
          <div class="dev-name"><span class="ind ${d.active ? 'ok' : ''}"></span>${d.id} · ${d.name} <span class="badge w">${d.proto}</span></div>
          <div class="dev-endpoint">${d.endpoint} · ${d.pollMs} ms</div>
        </div>
        <button class="btn" data-dev="${i}">${d.active ? '已激活' : '启用'}</button>
      </div>`).join('');
    document.querySelectorAll('[data-dev]').forEach((b) => {
      b.addEventListener('click', () => {
        const i = Number(b.dataset.dev);
        devices[i].active = !devices[i].active;
        renderDevices();
      });
    });
    document.getElementById('newTagDev').innerHTML = devices.map((d) => `<option value="${d.id}">${d.id} (${d.proto})</option>`).join('');
    document.getElementById('mgrTagBody').innerHTML = tagsMeta
      .map((t, i) => `<tr>
        <td class="mono">${t.id}</td><td class="mono" style="color:var(--active);">${t.dev}</td>
        <td class="mono">${t.addr}</td><td class="mono">${t.type}</td>
        <td><span class="badge ${t.access}">${t.access.toUpperCase()}</span></td>
        <td><button class="btn" style="padding:2px 8px;font-size:11px;" data-del="${i}">移除</button></td>
      </tr>`).join('');
    document.querySelectorAll('[data-del]').forEach((b) => {
      b.addEventListener('click', () => { tagsMeta.splice(Number(b.dataset.del), 1); renderDevices(); renderTags(); });
    });
  }

  document.getElementById('tagSearch').addEventListener('input', renderTags);
  document.getElementById('btnAddTag').addEventListener('click', () => {
    const id = document.getElementById('newTagId').value.trim();
    const dev = document.getElementById('newTagDev').value;
    const addr = document.getElementById('newTagAddr').value.trim();
    if (!id || !addr) return;
    tagsMeta.push({ id, dev, addr, type: document.getElementById('newTagType').value, access: document.getElementById('newTagAccess').value, desc: '自定义点位' });
    document.getElementById('newTagId').value = '';
    document.getElementById('newTagAddr').value = '';
    renderDevices(); renderTags();
  });
  document.getElementById('btnExportManifest').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ schema: 'tia-web-twin/manifest@1', project: 'smt-pick-and-place', devices, tags: tagsMeta }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'twin.manifest.json'; a.click();
  });

  // 2.5D Isometric SMT Canvas (Warm-CAD Palette)
  const canvas = document.getElementById('isoCanvas');
  const ctx = canvas.getContext('2d');
  const iso = (x, y, z, ox, oy, s) => [ox + (x - z) * 0.866 * s, oy + (x + z) * 0.5 * s - y * s];

  function drawShadow(x, z, w, d, ox, oy, s, a = 0.14) {
    const p0 = iso(x, 0, z, ox, oy, s), p1 = iso(x + w, 0, z, ox, oy, s), p2 = iso(x + w, 0, z + d, ox, oy, s), p3 = iso(x, 0, z + d, ox, oy, s);
    ctx.fillStyle = `rgba(28, 25, 23, ${a})`;
    ctx.beginPath(); ctx.moveTo(...p0); ctx.lineTo(...p1); ctx.lineTo(...p2); ctx.lineTo(...p3); ctx.closePath(); ctx.fill();
  }

  function drawBox(x, y, z, w, h, d, c, ox, oy, s) {
    const p000 = iso(x, y, z, ox, oy, s), p100 = iso(x + w, y, z, ox, oy, s), p101 = iso(x + w, y, z + d, ox, oy, s), p001 = iso(x, y, z + d, ox, oy, s);
    const p010 = iso(x, y + h, z, ox, oy, s), p110 = iso(x + w, y + h, z, ox, oy, s), p111 = iso(x + w, y + h, z + d, ox, oy, s), p011 = iso(x, y + h, z + d, ox, oy, s);
    ctx.lineJoin = 'round';
    if (!state.xray) {
      ctx.fillStyle = c.right; ctx.beginPath(); ctx.moveTo(...p100); ctx.lineTo(...p101); ctx.lineTo(...p111); ctx.lineTo(...p110); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c.left; ctx.beginPath(); ctx.moveTo(...p001); ctx.lineTo(...p101); ctx.lineTo(...p111); ctx.lineTo(...p011); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c.top; ctx.beginPath(); ctx.moveTo(...p010); ctx.lineTo(...p110); ctx.lineTo(...p111); ctx.lineTo(...p011); ctx.closePath(); ctx.fill();
    }
    if (c.edge || state.xray) {
      ctx.strokeStyle = state.xray ? 'rgba(2,132,199,0.5)' : c.edge;
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.moveTo(...p010); ctx.lineTo(...p110); ctx.lineTo(...p111); ctx.lineTo(...p011); ctx.closePath();
      ctx.moveTo(...p110); ctx.lineTo(...p100); ctx.moveTo(...p111); ctx.lineTo(...p101); ctx.moveTo(...p011); ctx.lineTo(...p001);
      ctx.stroke();
    }
  }

  function drawCallout(wx, wy, wz, dx, dy, title, sub, color, ox, oy, s) {
    const [sx, sy] = iso(wx, wy, wz, ox, oy, s);
    const tx = sx + dx, ty = sy + dy;
    ctx.strokeStyle = 'rgba(28, 25, 23, 0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();

    ctx.font = '600 11px "Fira Sans", "Segoe UI", sans-serif';
    const w1 = ctx.measureText(title).width;
    ctx.font = '400 10px "Fira Code", Consolas, monospace';
    const w2 = ctx.measureText(sub).width;
    const bw = Math.max(w1, w2) + 20, bh = 36;
    const bx = dx >= 0 ? tx : tx - bw, by = ty - bh / 2;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = 'rgba(28, 25, 23, 0.14)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(bx + 9, by + 12, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = '#1c1917'; ctx.font = '600 11px "Fira Sans", "Segoe UI", sans-serif';
    ctx.fillText(title, bx + 16, by + 15);
    ctx.fillStyle = '#57534e'; ctx.font = '400 10px "Fira Code", Consolas, monospace';
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

    const ox = W * 0.49, oy = H * 0.50, s = Math.min(W, H) * 0.032;

    ctx.strokeStyle = 'rgba(28, 25, 23, 0.05)'; ctx.lineWidth = 1;
    for (let gx = -16; gx <= 16; gx += 1.6) {
      const a = iso(gx, 0, -8, ox, oy, s), b = iso(gx, 0, 8, ox, oy, s);
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
    }
    for (let gz = -8; gz <= 8; gz += 1.6) {
      const a = iso(-16, 0, gz, ox, oy, s), b = iso(16, 0, gz, ox, oy, s);
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
    }

    const shell = { top: '#e2e8f0', left: '#cbd5e1', right: '#94a3b8', edge: 'rgba(15,23,42,0.14)' };
    const frame = { top: '#64748b', left: '#475569', right: '#334155', edge: 'rgba(15,23,42,0.18)' };
    const belt = { top: '#334155', left: '#1e293b', right: '#0f172a', edge: 'rgba(15,23,42,0.2)' };
    const pcb = { top: '#10b981', left: '#059669', right: '#047857', edge: 'rgba(255,255,255,0.3)' };
    const accent = { top: '#38bdf8', left: '#0284c7', right: '#0369a1', edge: 'rgba(255,255,255,0.35)' };
    const ovenCol = { top: '#fbbf24', left: '#d97706', right: '#b45309', edge: 'rgba(255,255,255,0.25)' };

    // Ground shadow
    drawShadow(-13.5, -1.8, 27.2, 3.6, ox, oy, s, 0.14);

    // Unified Y=2.40m Conveyor Track
    drawBox(-13.2, 1.9, -1.2, 26.4, 0.45, 2.4, frame, ox, oy, s);
    drawBox(-13.0, 2.35, -0.9, 26.0, 0.12, 1.8, belt, ox, oy, s);

    // ST01 Loader
    drawBox(-13.0, 0, -1.5, 2.2, 4.2, 3.0, shell, ox, oy, s);
    // ST02 Solder Printer
    drawBox(-9.2, 0, -1.5, 2.6, 4.0, 3.0, shell, ox, oy, s);
    drawBox(-8.6, 4.0, -0.9, 1.4, 0.4, 1.8, accent, ox, oy, s);

    // PCBs on line
    for (const px of state.pcbs) {
      drawBox(px, 2.48, -0.5, 1.1, 0.14, 1.0, pcb, ox, oy, s);
    }

    // ST04 High-Speed Pick & Place Machine (Center)
    drawBox(-3.6, 0, -1.8, 4.8, 2.0, 3.6, frame, ox, oy, s);
    drawBox(-3.5, 2.0, -1.7, 0.35, 3.0, 0.35, shell, ox, oy, s);
    drawBox(0.8, 2.0, -1.7, 0.35, 3.0, 0.35, shell, ox, oy, s);
    drawBox(-3.5, 2.0, 1.35, 0.35, 3.0, 0.35, shell, ox, oy, s);
    drawBox(0.8, 2.0, 1.35, 0.35, 3.0, 0.35, shell, ox, oy, s);
    drawBox(-3.6, 4.9, -1.8, 4.8, 0.45, 3.6, shell, ox, oy, s);

    // Animated X/Y Gantry Head
    const gx = -1.6 + Math.sin(state.phase * 2.2) * 1.4;
    const gz = Math.cos(state.phase * 1.7) * 0.7;
    drawBox(gx, 3.6, gz - 0.35, 0.8, 1.2, 0.7, accent, ox, oy, s);

    // 12 Feeder Bank (Front)
    drawBox(-3.2, 0.8, 1.8, 4.0, 1.6, 1.0, frame, ox, oy, s);

    // ST05 8-Zone Reflow Oven
    drawBox(2.6, 0, -1.6, 6.2, 3.8, 3.2, shell, ox, oy, s);
    drawBox(3.0, 3.8, -1.1, 5.4, 0.28, 2.2, ovenCol, ox, oy, s);

    // ST06 AOI Inspection
    drawBox(9.8, 0, -1.4, 2.0, 4.1, 2.8, shell, ox, oy, s);
    drawBox(10.3, 4.1, -0.7, 1.0, 0.35, 1.4, accent, ox, oy, s);

    // Callouts
    drawCallout(-7.9, 4.4, 0, -28, -42, 'ST02 · 锡膏印刷机', 'S7 DB1.DBX1.0', '#0284c7', ox, oy, s);
    drawCallout(gx + 0.4, 4.9, gz, -18, -58, 'ST04 · 高速贴装头', '43,200 CPH · 8 吸嘴', '#059669', ox, oy, s);
    drawCallout(-1.2, 1.6, 2.8, -28, 52, '12 联装飞达料站', 'Modbus TCP · HR0', '#0284c7', ox, oy, s);
    drawCallout(5.7, 4.08, 0, 22, -48, 'ST05 · 8 温区回流焊', '245.2°C · Modbus RTU', '#d97706', ox, oy, s);
    drawCallout(10.8, 4.45, 0, 22, -32, 'ST06 · AOI 检测', '99.88% · Raw TCP', '#059669', ox, oy, s);
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state.running && !state.estop) {
      state.phase += dt * state.speed;
      state.axisX = +(Math.sin(state.phase * 2.2) * 180).toFixed(2);
      state.axisY = +(Math.cos(state.phase * 1.7) * 220).toFixed(2);
      state.axisZ = +(8 + Math.abs(Math.sin(state.phase * 3.4)) * 14).toFixed(2);
      for (let i = 0; i < state.pcbs.length; i++) {
        state.pcbs[i] += dt * 1.6 * state.speed;
        if (state.pcbs[i] > 12.2) {
          state.pcbs[i] = -12.6;
          state.totalCount += 1;
          state.feederIdx = (state.feederIdx % 12) + 1;
        }
      }
      document.getElementById('valAxisX').textContent = `${state.axisX >= 0 ? '+' : ''}${state.axisX} mm`;
      document.getElementById('valAxisY').textContent = `${state.axisY >= 0 ? '+' : ''}${state.axisY} mm`;
      document.getElementById('valAxisZ').textContent = `${state.axisZ} mm`;
      document.getElementById('valFeeder').textContent = `SLOT #${String(state.feederIdx).padStart(2, '0')}`;
      document.getElementById('kpiTotal').textContent = state.totalCount.toLocaleString();
      document.getElementById('headStatus').textContent = 'RUN';
    } else {
      document.getElementById('headStatus').textContent = state.estop ? 'E-STOP' : 'PAUSE';
    }
    renderCanvas();
    requestAnimationFrame(loop);
  }

  renderProcess();
  renderTags();
  renderDevices();
  requestAnimationFrame(loop);
})();
