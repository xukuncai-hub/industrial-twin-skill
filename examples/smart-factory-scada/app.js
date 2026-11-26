(() => {
  const state = {
    mode: 'offline',
    running: true,
    estop: false,
    speed: 1,
    xray: false,
    selectedStation: 2,
    totalCount: 4286,
    oee: 94.6,
    cycleS: 1.42,
    rpm: 1450,
    airMpa: 0.62,
    motorAmp: 14.2,
    laserTemp: 24.6,
    throughput: 42.2,
    pe1: false,
    pe2: false,
    pe3: false,
    laserFiring: false,
    cylExtend: false,
    robotPhase: 0,
    beltOffset: 0,
    workpieces: [
      { x: -9.5, lane: 0, sorted: false, color: 'ok' },
      { x: -4.2, lane: 0, sorted: false, color: 'ok' },
      { x: 1.2, lane: 0, sorted: false, color: 'sort' },
      { x: 6.4, lane: 0, sorted: false, color: 'ok' }
    ],
    trendAmp: Array.from({ length: 48 }, (_, i) => 13.6 + Math.sin(i * 0.35) * 0.9),
    logs: [
      { ts: '12:48:02.140', lvl: 'INFO', src: 'SYS', msg: '离线闭环仿真引擎已就绪 (DB1 20 Tags 校验通过)' },
      { ts: '12:48:15.420', lvl: 'OK', src: 'ST04', msg: '视觉 AOI 检测连续 200 件合格 (99.4%)' },
      { ts: '12:48:31.080', lvl: 'INFO', src: 'ST03', msg: '六轴机器人完成第 4,286 次电驱壳体抓取' }
    ]
  };

  const stations = [
    { name: 'ST01 · 自动上料码垛', step: '托盘升降供料', sig: 'DB1.DBX1.0', load: '31.4 %' },
    { name: 'ST02 · 激光打标工站', step: '光纤激光赋码中', sig: 'DB1.DBX2.2', load: '58.0 %' },
    { name: 'ST03 · 六轴机器人单元', step: '物料搬运至检测位', sig: 'DB1.DBX2.1', load: '42.8 %' },
    { name: 'ST04 · 视觉 AOI 门架', step: '飞行相机扫码复检', sig: 'DB1.DBX1.3', load: '24.5 %' },
    { name: 'ST05 · 气动分拣工站', step: '高速分流推杆就绪', sig: 'DB1.DBX2.3', load: '19.2 %' },
    { name: 'ST06 · AGV 满盘出料', step: '出料缓存接驳中', sig: 'DB1.DBX1.4', load: '27.6 %' }
  ];

  const devices = [
    { id: 'PLC-01', name: '西门子 S7-1500 主控', proto: 's7', endpoint: '192.168.0.10 (R0/S1)', pollMs: 100, active: true },
    { id: 'INV-01', name: '汇川 MD500 变频器', proto: 'modbus-tcp', endpoint: '192.168.0.21:502', pollMs: 100, active: false },
    { id: 'MTR-01', name: 'RS-485 智能电表', proto: 'modbus-rtu', endpoint: 'COM3 @ 115200', pollMs: 200, active: false },
    { id: 'CAM-01', name: '视觉扫码相机', proto: 'tcp-raw', endpoint: '192.168.0.30:9000', pollMs: 50, active: false }
  ];

  const tagsMeta = [
    { id: 'cmd.start', dev: 'PLC-01', addr: 'DB1.DBX0.0', type: 'bool', access: 'rw', desc: '产线总启动命令' },
    { id: 'cmd.stop', dev: 'PLC-01', addr: 'DB1.DBX0.1', type: 'bool', access: 'rw', desc: '产线有序停止命令' },
    { id: 'cmd.reset', dev: 'PLC-01', addr: 'DB1.DBX0.2', type: 'bool', access: 'rw', desc: '报警复位命令' },
    { id: 'cmd.estop', dev: 'PLC-01', addr: 'DB1.DBX0.3', type: 'bool', access: 'rw', desc: '安全急停触发' },
    { id: 'sens.pe1_infeed', dev: 'PLC-01', addr: 'DB1.DBX1.0', type: 'bool', access: 'w', desc: 'ST01 上料光电传感器' },
    { id: 'sens.pe2_laser', dev: 'PLC-01', addr: 'DB1.DBX1.1', type: 'bool', access: 'w', desc: 'ST02 打标定位光电' },
    { id: 'sens.pe3_vision', dev: 'PLC-01', addr: 'DB1.DBX1.2', type: 'bool', access: 'w', desc: 'ST04 视觉触发光电' },
    { id: 'sens.vision_ok', dev: 'CAM-01', addr: 'TCP:OK_FLAG', type: 'bool', access: 'w', desc: 'ST04 AOI 视觉判定合格' },
    { id: 'sens.pe4_outfeed', dev: 'PLC-01', addr: 'DB1.DBX1.4', type: 'bool', access: 'w', desc: 'ST06 出料满盘光电' },
    { id: 'line.running', dev: 'PLC-01', addr: 'DB1.DBX2.0', type: 'bool', access: 'r', desc: '主输送线运行反馈' },
    { id: 'robot.busy', dev: 'PLC-01', addr: 'DB1.DBX2.1', type: 'bool', access: 'r', desc: '六轴机器人抓取运行中' },
    { id: 'laser.firing', dev: 'PLC-01', addr: 'DB1.DBX2.2', type: 'bool', access: 'r', desc: '激光打标头出光状态' },
    { id: 'cyl.divert', dev: 'PLC-01', addr: 'DB1.DBX2.3', type: 'bool', access: 'r', desc: '气动分拣推杆电磁阀' },
    { id: 'line.rpm', dev: 'INV-01', addr: '40001 (HR0)', type: 'int16', access: 'r', desc: '主输送伺服电机转速 (RPM)' },
    { id: 'prod.total', dev: 'PLC-01', addr: 'DB1.DBD8', type: 'int32', access: 'r', desc: '当日累计合格产出 (PCS)' },
    { id: 'prod.oee', dev: 'PLC-01', addr: 'DB1.DBD12', type: 'real', access: 'r', desc: '产线综合设备效率 OEE (%)' },
    { id: 'prod.cycle_s', dev: 'PLC-01', addr: 'DB1.DBD16', type: 'real', access: 'r', desc: '单件平均节拍 (s)' },
    { id: 'sys.air_mpa', dev: 'PLC-01', addr: 'DB1.DBD20', type: 'real', access: 'r', desc: '主气源系统压力 (MPa)' },
    { id: 'sys.motor_amp', dev: 'MTR-01', addr: '30012 (IR12)', type: 'real', access: 'r', desc: '主驱动母线电流 (A)' },
    { id: 'laser.temp_c', dev: 'PLC-01', addr: 'DB1.DBD28', type: 'real', access: 'r', desc: '激光器冷却水温度 (°C)' }
  ];

  // View switching
  document.querySelectorAll('.rail-btn[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rail-btn[data-view]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.view;
      document.querySelectorAll('.view-pane').forEach((p) => p.classList.remove('active'));
      document.getElementById(`view-${target}`).classList.add('active');
      if (target === 'trends') drawTrends();
    });
  });

  function addLog(lvl, src, msg) {
    const now = new Date();
    const ts = now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0');
    state.logs.unshift({ ts, lvl, src, msg });
    if (state.logs.length > 40) state.logs.pop();
    renderLogs();
  }

  function renderLogs() {
    const body = document.getElementById('logTableBody');
    body.innerHTML = state.logs
      .map(
        (l) => `<tr>
          <td class="mono">${l.ts}</td>
          <td><span class="badge ${l.lvl === 'WARN' ? 'rw' : l.lvl === 'OK' ? 'r' : 'w'}">${l.lvl}</span></td>
          <td class="mono">${l.src}</td>
          <td>${l.msg}</td>
        </tr>`
      )
      .join('');
  }

  function getTagValue(id) {
    switch (id) {
      case 'line.running': return state.running && !state.estop ? '1' : '0';
      case 'robot.busy': return state.running && !state.estop ? '1' : '0';
      case 'laser.firing': return state.laserFiring ? '1' : '0';
      case 'cyl.divert': return state.cylExtend ? '1' : '0';
      case 'sens.pe1_infeed': return state.pe1 ? '1' : '0';
      case 'sens.pe2_laser': return state.pe2 ? '1' : '0';
      case 'sens.pe3_vision': return state.pe3 ? '1' : '0';
      case 'sens.vision_ok': return '1';
      case 'line.rpm': return String(state.running && !state.estop ? state.rpm : 0);
      case 'prod.total': return String(state.totalCount);
      case 'prod.oee': return state.oee.toFixed(1);
      case 'prod.cycle_s': return state.cycleS.toFixed(2);
      case 'sys.air_mpa': return state.airMpa.toFixed(2);
      case 'sys.motor_amp': return state.motorAmp.toFixed(1);
      case 'laser.temp_c': return state.laserTemp.toFixed(1);
      default: return '0';
    }
  }

  function renderTagTable() {
    const q = (document.getElementById('tagSearch').value || '').toLowerCase();
    const rows = tagsMeta.filter(
      (t) =>
        t.id.toLowerCase().includes(q) ||
        t.dev.toLowerCase().includes(q) ||
        t.addr.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q)
    );
    document.getElementById('tagTableBody').innerHTML = rows
      .map(
        (t) => `<tr>
          <td class="mono">${t.id}</td>
          <td class="mono" style="color:var(--active);">${t.dev}</td>
          <td class="mono">${t.addr}</td>
          <td class="mono">${t.type}</td>
          <td><span class="badge ${t.access}">${t.access.toUpperCase()}</span></td>
          <td class="mono" style="color:#f8fafc;font-weight:600;">${getTagValue(t.id)}</td>
          <td style="color:var(--muted);">${t.desc}</td>
        </tr>`
      )
      .join('');
  }

  function renderDeviceManager() {
    const listEl = document.getElementById('deviceList');
    const devSel = document.getElementById('newTagDev');
    document.getElementById('devCountBadge').textContent = `${devices.length} 台设备`;
    document.getElementById('tagCountBadge').textContent = `${tagsMeta.length} 个点位`;

    listEl.innerHTML = devices
      .map(
        (d, idx) => `<div class="device-card ${d.active ? 'active-dev' : ''}">
          <div class="dev-meta">
            <div class="dev-name">
              <span class="ind ${d.active ? 'ok' : ''}"></span>
              <span>${d.id} · ${d.name}</span>
              <span class="badge w">${d.proto}</span>
            </div>
            <div class="dev-endpoint">${d.endpoint} · ${d.pollMs} ms</div>
          </div>
          <button class="btn" data-toggle-dev="${idx}">${d.active ? '已激活' : '启用'}</button>
        </div>`
      )
      .join('');

    listEl.querySelectorAll('[data-toggle-dev]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.toggleDev);
        devices[idx].active = !devices[idx].active;
        addLog('INFO', devices[idx].id, `${devices[idx].name} (${devices[idx].proto}) 状态切换为 ${devices[idx].active ? '启用' : '停用'}`);
        renderDeviceManager();
      });
    });

    devSel.innerHTML = devices.map((d) => `<option value="${d.id}">${d.id} (${d.proto})</option>`).join('');

    const mgrBody = document.getElementById('mgrTagBody');
    mgrBody.innerHTML = tagsMeta
      .map(
        (t, idx) => `<tr>
          <td class="mono">${t.id}</td>
          <td class="mono" style="color:var(--active);">${t.dev}</td>
          <td class="mono">${t.addr}</td>
          <td class="mono">${t.type}</td>
          <td><span class="badge ${t.access}">${t.access.toUpperCase()}</span></td>
          <td><button class="btn" style="padding:3px 8px;font-size:11px;" data-del-tag="${idx}">移除</button></td>
        </tr>`
      )
      .join('');

    mgrBody.querySelectorAll('[data-del-tag]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.delTag);
        const removed = tagsMeta.splice(idx, 1)[0];
        addLog('INFO', 'DATA', `移除数据点位 ${removed.id}`);
        renderDeviceManager();
        renderTagTable();
      });
    });
  }

  document.getElementById('btnAddDeviceToggle').addEventListener('click', () => {
    const card = document.getElementById('addDeviceCard');
    card.style.display = card.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('btnCancelAddDev').addEventListener('click', () => {
    document.getElementById('addDeviceCard').style.display = 'none';
  });
  document.getElementById('btnSaveNewDev').addEventListener('click', () => {
    const name = document.getElementById('newDevName').value.trim();
    const proto = document.getElementById('newDevProto').value;
    const endpoint = document.getElementById('newDevEndpoint').value.trim() || '192.168.0.50:502';
    const pollMs = Number(document.getElementById('newDevPoll').value) || 100;
    if (!name) return;
    const id = `DEV-${String(devices.length + 1).padStart(2, '0')}`;
    devices.push({ id, name, proto, endpoint, pollMs, active: true });
    document.getElementById('newDevName').value = '';
    document.getElementById('newDevEndpoint').value = '';
    document.getElementById('addDeviceCard').style.display = 'none';
    addLog('OK', id, `新增设备通道 ${name} [${proto}] @ ${endpoint}`);
    renderDeviceManager();
  });

  document.getElementById('btnAddTag').addEventListener('click', () => {
    const id = document.getElementById('newTagId').value.trim();
    const dev = document.getElementById('newTagDev').value;
    const addr = document.getElementById('newTagAddr').value.trim();
    const type = document.getElementById('newTagType').value;
    const access = document.getElementById('newTagAccess').value;
    if (!id || !addr) return;
    tagsMeta.push({ id, dev, addr, type, access, desc: '自定义设备点位' });
    document.getElementById('newTagId').value = '';
    document.getElementById('newTagAddr').value = '';
    addLog('OK', dev, `新增数据映射 ${id} -> ${addr}`);
    renderDeviceManager();
    renderTagTable();
  });

  document.getElementById('btnExportManifest').addEventListener('click', () => {
    const manifest = {
      schema: 'tia-web-twin/manifest@1',
      project: 'smart-factory-scada',
      devices,
      tags: tagsMeta.map((t) => ({ id: t.id, device: t.dev, address: t.addr, type: t.type, access: t.access, desc: t.desc }))
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'twin.manifest.json';
    a.click();
    addLog('OK', 'EXPORT', '已导出多协议 twin.manifest.json 配置文件');
  });

  document.getElementById('tagSearch').addEventListener('input', renderTagTable);
  document.getElementById('btnClearLog').addEventListener('click', () => {
    state.logs = [];
    renderLogs();
  });

  // Controls
  document.getElementById('btnStart').addEventListener('click', () => {
    if (state.estop) return;
    state.running = true;
    addLog('OK', 'CMD', '操作员下发产线总启动命令 (DB1.DBX0.0)');
  });
  document.getElementById('btnStop').addEventListener('click', () => {
    state.running = false;
    addLog('INFO', 'CMD', '产线有序停机 (DB1.DBX0.1)');
  });
  document.getElementById('btnReset').addEventListener('click', () => {
    state.estop = false;
    addLog('OK', 'CMD', '安全回路与报警已复位 (DB1.DBX0.2)');
  });
  document.getElementById('btnEstop').addEventListener('click', () => {
    state.estop = true;
    state.running = false;
    addLog('WARN', 'ESTOP', '安全急停触发，全线伺服断电锁定');
  });
  document.getElementById('btnSpeed').addEventListener('click', (e) => {
    state.speed = state.speed === 1 ? 2 : 1;
    e.currentTarget.textContent = `${state.speed}.0x`;
  });
  document.getElementById('btnXray').addEventListener('click', (e) => {
    state.xray = !state.xray;
    e.currentTarget.classList.toggle('active-toggle', state.xray);
  });

  // Multi-Protocol Modal
  const isDarkTheme = () => false;
  const modal = document.getElementById('plcModal');
  const protoSel = document.getElementById('connProtocol');
  protoSel.addEventListener('change', () => {
    const v = protoSel.value;
    document.getElementById('protoFieldsS7').style.display = v === 's7' ? 'block' : 'none';
    document.getElementById('protoFieldsModbusTcp').style.display = v === 'modbus-tcp' ? 'block' : 'none';
    document.getElementById('protoFieldsRtu').style.display = v === 'modbus-rtu' ? 'block' : 'none';
    document.getElementById('protoFieldsRaw').style.display = v === 'tcp-raw' ? 'block' : 'none';
  });
  document.getElementById('btnOpenPlcModal').addEventListener('click', () => modal.classList.add('open'));
  document.getElementById('modeOnline').addEventListener('click', () => modal.classList.add('open'));
  document.getElementById('modeOffline').addEventListener('click', () => {
    state.mode = 'offline';
    document.getElementById('modeOffline').classList.add('active');
    document.getElementById('modeOnline').classList.remove('active');
    document.getElementById('connDot').className = 'status-dot';
    document.getElementById('connText').textContent = '离线自主仿真 · 100 ms';
  });
  document.getElementById('btnCloseModal').addEventListener('click', () => modal.classList.remove('open'));
  document.getElementById('btnConfirmPlc').addEventListener('click', () => {
    const proto = protoSel.value;
    const poll = document.getElementById('plcPollMs').value;
    let target = '';
    if (proto === 's7') target = document.getElementById('plcIp').value.trim() || '192.168.0.10';
    else if (proto === 'modbus-tcp') target = document.getElementById('mbIp').value.trim() || '192.168.0.21';
    else if (proto === 'modbus-rtu') target = document.getElementById('rtuPort').value.trim() || 'COM3';
    else target = document.getElementById('rawHost').value.trim() || '192.168.0.30:9000';

    state.mode = 'online';
    document.getElementById('modeOnline').classList.add('active');
    document.getElementById('modeOffline').classList.remove('active');
    document.getElementById('connDot').className = 'status-dot warn';
    document.getElementById('connText').textContent = `网关待命 [${proto}] · ${target} (${poll} ms)`;
    modal.classList.remove('open');
    addLog('INFO', 'GATEWAY', `已配置 ${proto} 目标 ${target}，扫描周期 ${poll} ms`);
  });

  // 2.5D Isometric Canvas Engine
  const canvas = document.getElementById('isoCanvas');
  const ctx = canvas.getContext('2d');

  function iso(x, y, z, ox, oy, s) {
    return [ox + (x - z) * 0.866 * s, oy + (x + z) * 0.5 * s - y * s];
  }

  function drawShadow(x, z, w, d, ox, oy, s, a = 0.3) {
    const p0 = iso(x, 0, z, ox, oy, s);
    const p1 = iso(x + w, 0, z, ox, oy, s);
    const p2 = iso(x + w, 0, z + d, ox, oy, s);
    const p3 = iso(x, 0, z + d, ox, oy, s);
    ctx.fillStyle = `rgba(3, 6, 11, ${a})`;
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
    if (!state.xray) {
      ctx.fillStyle = c.right;
      ctx.beginPath(); ctx.moveTo(...p100); ctx.lineTo(...p101); ctx.lineTo(...p111); ctx.lineTo(...p110); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c.left;
      ctx.beginPath(); ctx.moveTo(...p001); ctx.lineTo(...p101); ctx.lineTo(...p111); ctx.lineTo(...p011); ctx.closePath(); ctx.fill();
      ctx.fillStyle = c.top;
      ctx.beginPath(); ctx.moveTo(...p010); ctx.lineTo(...p110); ctx.lineTo(...p111); ctx.lineTo(...p011); ctx.closePath(); ctx.fill();
    }
    if (c.edge || state.xray) {
      ctx.strokeStyle = state.xray ? 'rgba(56,189,248,0.45)' : c.edge;
      ctx.lineWidth = 0.85;
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
    const dark = isDarkTheme();
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx, ty); ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();

    ctx.font = '600 11px "Fira Sans", "Segoe UI", sans-serif';
    const w1 = ctx.measureText(title).width;
    ctx.font = '400 10px "Fira Code", Consolas, monospace';
    const w2 = ctx.measureText(sub).width;
    const bw = Math.max(w1, w2) + 20;
    const bh = 36;
    const bx = dx >= 0 ? tx : tx - bw;
    const by = ty - bh / 2;

    ctx.fillStyle = dark ? 'rgba(15, 21, 31, 0.88)' : 'rgba(255, 255, 255, 0.94)';
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.13)' : 'rgba(15,23,42,0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.fill(); ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(bx + 9, by + 12, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = dark ? '#f1f5f9' : '#0f172a';
    ctx.font = '600 11px "Fira Sans", "Segoe UI", sans-serif';
    ctx.fillText(title, bx + 16, by + 15);
    ctx.fillStyle = dark ? '#8b98a9' : '#475569';
    ctx.font = '400 10px "Fira Code", Consolas, monospace';
    ctx.fillText(sub, bx + 9, by + 28);
  }

  function updatePhysics(dt) {
    if (state.running && !state.estop) {
      const v = 2.6 * state.speed * dt;
      state.beltOffset = (state.beltOffset + v) % 1.2;
      state.robotPhase += dt * 2.2 * state.speed;

      let pe1 = false, pe2 = false, pe3 = false, cyl = false, laser = false;
      for (const wp of state.workpieces) {
        wp.x += v;
        if (wp.x > -8.6 && wp.x < -7.4) pe1 = true;
        if (wp.x > -5.1 && wp.x < -3.9) { pe2 = true; laser = true; }
        if (wp.x > 1.3 && wp.x < 2.4) pe3 = true;
        if (wp.x > 4.2 && wp.x < 5.4 && wp.color === 'sort') cyl = true;
        if (wp.x > 9.4) {
          wp.x = -10.8;
          wp.color = Math.random() > 0.72 ? 'sort' : 'ok';
          state.totalCount += 1;
          state.motorAmp = +(13.8 + Math.sin(state.robotPhase) * 0.8).toFixed(1);
          state.trendAmp.push(state.motorAmp);
          if (state.trendAmp.length > 48) state.trendAmp.shift();
        }
      }
      state.pe1 = pe1;
      state.pe2 = pe2;
      state.pe3 = pe3;
      state.laserFiring = laser;
      state.cylExtend = cyl;
    } else {
      state.laserFiring = false;
    }
  }

  function renderTelemetry() {
    const activeRun = state.running && !state.estop;
    document.getElementById('kpiTotal').textContent = state.totalCount.toLocaleString();
    document.getElementById('indLine').className = `ind ${state.estop ? 'danger' : activeRun ? 'ok' : ''}`;
    document.getElementById('valRpm').textContent = activeRun ? `${state.rpm} RPM` : '0 RPM';
    document.getElementById('indPe1').className = `ind ${state.pe1 ? 'active' : ''}`;
    document.getElementById('valPe1').textContent = state.pe1 ? '已触发 (回写 PLC)' : '待机';
    document.getElementById('indLaser').className = `ind ${state.laserFiring ? 'warn' : ''}`;
    document.getElementById('valLaser').textContent = state.laserFiring ? '出光打标 · 24.8°C' : '待命 · 24.6°C';
    document.getElementById('indCyl').className = `ind ${state.cylExtend ? 'warn' : ''}`;
    document.getElementById('valCyl').textContent = state.cylExtend ? '推杆伸出' : '原位缩回';
    document.getElementById('valSys').textContent = `${state.airMpa.toFixed(2)} MPa · ${state.motorAmp.toFixed(1)} A`;
    document.getElementById('stCount').textContent = `${state.totalCount.toLocaleString()} PCS`;
    document.getElementById('stCode').textContent = state.estop ? 'E-STOP' : activeRun ? 'RUN' : 'STOP';
  }

  function renderCanvas() {
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
    const oy = H * 0.50;
    const s = Math.min(W, H) * 0.035;

    // Floor Grid
    ctx.strokeStyle = isDarkTheme() ? 'rgba(255,255,255,0.032)' : 'rgba(15,23,42,0.055)';
    ctx.lineWidth = 1;
    for (let gx = -14; gx <= 14; gx += 1.6) {
      const a = iso(gx, 0, -9, ox, oy, s), b = iso(gx, 0, 9, ox, oy, s);
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
    }
    for (let gz = -9; gz <= 9; gz += 1.6) {
      const a = iso(-14, 0, gz, ox, oy, s), b = iso(14, 0, gz, ox, oy, s);
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
    }

    const alu = { top: '#64748b', left: '#475569', right: '#334155', edge: 'rgba(255,255,255,0.12)' };
    const dark = { top: '#334155', left: '#1e293b', right: '#141c28', edge: 'rgba(255,255,255,0.09)' };
    const belt = { top: '#1e2530', left: '#141a22', right: '#0e1319', edge: 'rgba(255,255,255,0.08)' };
    const accent = { top: '#38bdf8', left: '#0284c7', right: '#0369a1', edge: 'rgba(186,230,253,0.4)' };
    const partOk = { top: '#34d399', left: '#10b981', right: '#059669', edge: 'rgba(255,255,255,0.22)' };
    const partSort = { top: '#fbbf24', left: '#f59e0b', right: '#d97706', edge: 'rgba(255,255,255,0.25)' };

    // Ground Shadows
    drawShadow(-11.2, -1.4, 21.4, 2.9, ox, oy, s, 0.28);
    drawShadow(-1.6, -4.6, 2.6, 2.4, ox, oy, s, 0.34);
    drawShadow(4.0, 3.0, 2.6, 2.2, ox, oy, s, 0.34);
    drawShadow(7.8, -5.0, 2.4, 2.0, ox, oy, s, 0.36);

    // Conveyor Legs
    for (const lx of [-10.5, -5.0, 0.5, 5.5, 9.2]) {
      drawBox(lx, 0, -1.3, 0.32, 2.0, 0.32, alu, ox, oy, s);
      drawBox(lx, 0, 0.98, 0.32, 2.0, 0.32, alu, ox, oy, s);
    }

    // Main Conveyor Frame & Belt
    drawBox(-11.0, 2.0, -1.4, 21.0, 0.42, 2.8, alu, ox, oy, s);
    drawBox(-10.8, 2.42, -1.1, 20.6, 0.14, 2.2, belt, ox, oy, s);

    // Moving Belt Ribs
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 1;
    for (let bx = -10.2 + state.beltOffset; bx < 9.4; bx += 1.2) {
      const p1 = iso(bx, 2.57, -1.0, ox, oy, s);
      const p2 = iso(bx, 2.57, 1.0, ox, oy, s);
      ctx.beginPath(); ctx.moveTo(...p1); ctx.lineTo(...p2); ctx.stroke();
    }

    // ST01: Infeed Loader (-10.6)
    drawBox(-10.6, 2.56, -1.25, 1.7, 2.1, 0.22, dark, ox, oy, s);
    drawBox(-10.6, 2.56, 1.03, 1.7, 2.1, 0.22, dark, ox, oy, s);
    drawBox(-10.6, 4.66, -1.25, 1.7, 0.24, 2.5, alu, ox, oy, s);

    // ST02: Laser Marker (-4.8)
    drawBox(-5.1, 2.42, -1.55, 0.34, 2.8, 0.34, alu, ox, oy, s);
    drawBox(-5.1, 2.42, 1.21, 0.34, 2.8, 0.34, alu, ox, oy, s);
    drawBox(-5.25, 5.1, -1.65, 0.65, 0.45, 3.3, dark, ox, oy, s);
    drawBox(-5.05, 4.55, -0.35, 0.55, 0.55, 0.7, state.laserFiring ? partSort : dark, ox, oy, s);
    if (state.laserFiring) {
      const lTop = iso(-4.78, 4.55, 0, ox, oy, s);
      const lBot = iso(-4.78, 3.25, 0, ox, oy, s);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(...lTop); ctx.lineTo(...lBot); ctx.stroke();
    }

    // ST03: 6-Axis Robot Base & Articulated Arm (-0.8, -3.4)
    drawBox(-1.4, 0, -4.4, 2.0, 1.8, 2.0, dark, ox, oy, s);
    const swing = Math.sin(state.robotPhase) * 0.55;
    drawBox(-0.75, 1.8, -3.75, 0.7, 1.5, 0.7, alu, ox, oy, s);
    drawBox(-0.6 + swing * 0.4, 3.2, -3.5 + Math.abs(swing) * 0.8, 0.45, 0.45, 2.2, accent, ox, oy, s);

    // Workpieces
    for (const wp of state.workpieces) {
      drawBox(wp.x, 2.57, -0.45, 1.0, 0.68, 0.9, wp.color === 'sort' ? partSort : partOk, ox, oy, s);
    }

    // ST04: Vision AOI Gantry (1.6)
    drawBox(1.5, 2.42, -1.55, 0.34, 2.8, 0.34, alu, ox, oy, s);
    drawBox(1.5, 2.42, 1.21, 0.34, 2.8, 0.34, alu, ox, oy, s);
    drawBox(1.35, 5.1, -1.65, 0.65, 0.42, 3.3, dark, ox, oy, s);
    drawBox(1.58, 4.65, -0.35, 0.52, 0.45, 0.7, accent, ox, oy, s);

    // ST05: Pneumatic Diverter & Pass Bin (4.6)
    drawBox(4.0, 0, 3.1, 2.4, 1.35, 2.0, dark, ox, oy, s);
    drawBox(4.2, 1.4, 1.35, 1.8, 0.2, 1.9, alu, ox, oy, s);
    drawBox(4.2, 2.42, -2.5, 1.2, 0.85, 1.1, dark, ox, oy, s);
    const rodLen = state.cylExtend ? 1.05 : 0.35;
    drawBox(4.68, 2.72, -1.4, 0.24, 0.24, rodLen, alu, ox, oy, s);

    // Control Cabinet (Right-back)
    drawBox(8.0, 0, -4.9, 2.2, 3.9, 1.6, dark, ox, oy, s);
    drawBox(8.3, 2.35, -3.28, 1.4, 1.0, 0.08, accent, ox, oy, s);
    drawBox(8.95, 3.9, -4.25, 0.22, 0.52, 0.22, state.estop ? partSort : partOk, ox, oy, s);

    // Callout Badges
    drawCallout(-8.0, 2.8, 1.05, -26, 62, 'ST01 · 上料光电 PE1', `DB1.DBX1.0 = ${state.pe1 ? 1 : 0}`, '#38bdf8', ox, oy, s);
    drawCallout(-4.8, 5.5, 0, -24, -38, 'ST02 · 激光打标', state.laserFiring ? 'FIRING' : 'READY', '#f59e0b', ox, oy, s);
    drawCallout(-0.4, 3.6, -2.6, 12, -74, 'ST03 · 六轴机器人', 'DB1.DBX2.1', '#38bdf8', ox, oy, s);
    drawCallout(1.8, 5.5, 0, 44, -18, 'ST04 · 视觉 AOI', '99.4% PASS', '#10b981', ox, oy, s);
    drawCallout(5.2, 0.7, 5.1, 26, 22, 'ST05 · 分拣料仓', `${state.totalCount} PCS`, '#10b981', ox, oy, s);
    drawCallout(9.1, 1.1, -3.3, -24, 62, '多协议主控网关', state.estop ? 'E-STOP' : 'S7 / Modbus / TCP', state.estop ? '#ef4444' : '#10b981', ox, oy, s);
  }

  function drawTrends() {
    const tc = document.getElementById('trendCanvas');
    if (!tc) return;
    const tctx = tc.getContext('2d');
    const W = tc.width, H = tc.height;
    tctx.clearRect(0, 0, W, H);
    tctx.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let y = 40; y < H; y += 55) {
      tctx.beginPath(); tctx.moveTo(0, y); tctx.lineTo(W, y); tctx.stroke();
    }
    tctx.strokeStyle = '#38bdf8';
    tctx.lineWidth = 2.2;
    tctx.beginPath();
    state.trendAmp.forEach((v, i) => {
      const px = (i / (state.trendAmp.length - 1)) * (W - 20) + 10;
      const py = H - ((v - 11.5) / 5) * (H - 30) - 15;
      if (i === 0) tctx.moveTo(px, py); else tctx.lineTo(px, py);
    });
    tctx.stroke();
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    updatePhysics(dt);
    renderCanvas();
    renderTelemetry();
    requestAnimationFrame(loop);
  }

  // Init
  renderTagTable();
  renderDeviceManager();
  renderLogs();
  setInterval(() => {
    if (document.getElementById('view-tags').classList.contains('active')) renderTagTable();
    if (document.getElementById('view-trends').classList.contains('active')) drawTrends();
  }, 400);

  const st = stations[state.selectedStation];
  document.getElementById('stTitle').textContent = st.name;
  document.getElementById('stStep').textContent = st.step;
  document.getElementById('stSignal').textContent = `${st.sig} = 1`;
  document.getElementById('stLoad').textContent = st.load;

  requestAnimationFrame(loop);
})();
