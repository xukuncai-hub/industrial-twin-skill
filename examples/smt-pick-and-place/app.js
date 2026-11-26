(() => {
  const devices = [
    { id: 'PLC-01', name: '西门子 S7-1500 贴装主控', proto: 's7', endpoint: '192.168.0.1 (R0/S1)', pollMs: 100, active: true },
    { id: 'OVEN-01', name: '8 温区回流焊温控仪', proto: 'modbus-rtu', endpoint: 'COM4 @ 115200', pollMs: 200, active: true },
    { id: 'AOI-01', name: 'AOI 光学检测主机', proto: 'tcp-raw', endpoint: '192.168.0.35:9000', pollMs: 50, active: true },
    { id: 'FEED-01', name: '智能飞达总线控制器', proto: 'modbus-tcp', endpoint: '192.168.0.22:502', pollMs: 100, active: false }
  ];

  const tagsMeta = [
    { id: 'cmd.start', dev: 'PLC-01', addr: 'DB1.DBX0.0', type: 'bool', access: 'rw', val: '1', desc: '产线启动命令' },
    { id: 'cmd.stop', dev: 'PLC-01', addr: 'DB1.DBX0.1', type: 'bool', access: 'rw', val: '0', desc: '产线停止命令' },
    { id: 'cmd.estop', dev: 'PLC-01', addr: 'DB1.DBX0.3', type: 'bool', access: 'rw', val: '0', desc: '安全急停信号' },
    { id: 'sens.infeed_pe', dev: 'PLC-01', addr: 'DB1.DBX1.0', type: 'bool', access: 'w', val: '1', desc: '进板光电检测' },
    { id: 'sens.vision_ok', dev: 'AOI-01', addr: 'TCP:ALIGN_OK', type: 'bool', access: 'w', val: '1', desc: '飞行视觉对准合格' },
    { id: 'sens.aoi_result', dev: 'AOI-01', addr: 'TCP:AOI_PASS', type: 'bool', access: 'w', val: '1', desc: 'AOI 光学检测判定' },
    { id: 'smt.feeder_index', dev: 'FEED-01', addr: '40001 (HR0)', type: 'int16', access: 'r', val: '4', desc: '当前取料飞达站号' },
    { id: 'smt.axis_x', dev: 'PLC-01', addr: 'DB1.DBD4', type: 'real', access: 'r', val: '+142.50', desc: 'X 轴贴装小车坐标 (mm)' },
    { id: 'smt.axis_y', dev: 'PLC-01', addr: 'DB1.DBD8', type: 'real', access: 'r', val: '-218.40', desc: 'Y 轴龙门梁坐标 (mm)' },
    { id: 'smt.axis_z', dev: 'PLC-01', addr: 'DB1.DBD12', type: 'real', access: 'r', val: '12.40', desc: 'Z 轴吸嘴行程 (mm)' },
    { id: 'smt.vacuum_kpa', dev: 'PLC-01', addr: 'DB1.DBD16', type: 'real', access: 'r', val: '-84.2', desc: '工作吸嘴真空度 (kPa)' },
    { id: 'smt.cph', dev: 'PLC-01', addr: 'DB1.DBD20', type: 'real', access: 'r', val: '43200', desc: '实时贴装速度 (CPH)' },
    { id: 'smt.total_count', dev: 'PLC-01', addr: 'DB1.DBD28', type: 'int32', access: 'r', val: '2864', desc: '今日生产总数 (PCS)' },
    { id: 'smt.reflow_temp_peak', dev: 'OVEN-01', addr: '30006 (IR6)', type: 'real', access: 'r', val: '245.2', desc: '回流焊第 6 峰值温区 (°C)' }
  ];

  const feeders = [
    { slot: '#01', comp: '0402 C', qty: 3400, max: 5000 },
    { slot: '#02', comp: '0603 R', qty: 2900, max: 5000 },
    { slot: '#03', comp: '0805 C', qty: 1800, max: 5000 },
    { slot: '#04', comp: 'QFP-48', qty: 420, max: 1000 },
    { slot: '#05', comp: 'BGA-144', qty: 210, max: 1000 },
    { slot: '#06', comp: 'SOT-23', qty: 890, max: 3000 },
    { slot: '#07', comp: '0402 R', qty: 4100, max: 5000 },
    { slot: '#08', comp: '0603 C', qty: 2700, max: 5000 }
  ];

  const ovenZones = [
    { z: '预热 1', temp: 148 },
    { z: '预热 2', temp: 162 },
    { z: '恒温 3', temp: 175 },
    { z: '恒温 4', temp: 185 },
    { z: '回流 5', temp: 218 },
    { z: '峰值 6', temp: 245 },
    { z: '冷却 7', temp: 165 },
    { z: '出料 8', temp: 85 }
  ];

  document.querySelectorAll('.rail-btn[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rail-btn[data-view]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.view-pane').forEach((p) => p.classList.remove('active'));
      document.getElementById(`view-${btn.dataset.view}`).classList.add('active');
    });
  });

  const modal = document.getElementById('connModal');
  const presets = {
    's7-1500': { proto: 's7', ep: '192.168.0.10', poll: '100' },
    'plcsim': { proto: 's7', ep: '192.168.0.1', poll: '100' },
    'modbus-tcp': { proto: 'modbus-tcp', ep: '192.168.0.21:502', poll: '100' },
    'modbus-rtu': { proto: 'modbus-rtu', ep: 'COM3', poll: '100' }
  };
  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = presets[btn.dataset.preset];
      if (!p) return;
      document.getElementById('connProtocol').value = p.proto;
      document.getElementById('connEndpoint').value = p.ep;
      document.getElementById('connPoll').value = p.poll;
    });
  });
  try {
    const saved = JSON.parse(localStorage.getItem('twin_last_conn') || 'null');
    if (saved) {
      document.getElementById('connProtocol').value = saved.proto || 's7';
      document.getElementById('connEndpoint').value = saved.ep || '192.168.0.1';
      document.getElementById('connPoll').value = saved.poll || '100';
    }
  } catch (_) {}

  document.getElementById('btnOpenConn').addEventListener('click', () => modal.classList.add('open'));
  document.getElementById('modeOnline').addEventListener('click', () => modal.classList.add('open'));
  document.getElementById('modeOffline').addEventListener('click', () => {
    document.getElementById('modeOffline').classList.add('active');
    document.getElementById('modeOnline').classList.remove('active');
    document.getElementById('connDot').className = 'status-dot';
    document.getElementById('connText').textContent = '离线就绪 · 多协议支持 (S7 / Modbus / TCP)';
  });
  document.getElementById('btnCloseModal').addEventListener('click', () => modal.classList.remove('open'));
  document.getElementById('btnConfirmConn').addEventListener('click', () => {
    const proto = document.getElementById('connProtocol').value;
    const ep = document.getElementById('connEndpoint').value.trim() || '192.168.0.1';
    const poll = document.getElementById('connPoll').value;
    try { localStorage.setItem('twin_last_conn', JSON.stringify({ proto, ep, poll })); } catch (_) {}
    document.getElementById('modeOnline').classList.add('active');
    document.getElementById('modeOffline').classList.remove('active');
    document.getElementById('connDot').className = 'status-dot warn';
    document.getElementById('connText').textContent = `正在连接 [${proto}] · ${ep} (${poll} ms)`;
    if (window.TiaTwinClient) {
      try {
        const cli = new window.TiaTwinClient('ws://127.0.0.1:8765/ws');
        cli.onStatus = (s) => {
          if (s && s.connected) {
            document.getElementById('connDot').className = 'status-dot';
            document.getElementById('connText').textContent = `已连通 [${proto}] · ${ep} (${poll} ms)`;
          }
        };
        cli.connect({ protocol: proto, ip: ep.split(':')[0], pollMs: Number(poll) });
      } catch (_) {}
    }
    modal.classList.remove('open');
  });

  function renderMainBars() {
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
        <td class="mono" style="font-weight:600;">${t.val}</td>
        <td style="color:var(--muted);">${t.desc}</td>
      </tr>`).join('');
  }

  function renderDevices() {
    document.getElementById('devCountBadge').textContent = `${devices.length} 台设备`;
    document.getElementById('tagCountBadge').textContent = `${tagsMeta.length} 个点位`;
    document.getElementById('deviceList').innerHTML = devices
      .map((d, i) => `<div class="device-card ${d.active ? 'active-dev' : ''}">
        <div>
          <div class="dev-name"><span class="dot-ok" style="background:${d.active ? 'var(--ok)' : 'var(--dim)'}"></span>${d.id} · ${d.name} <span class="badge w">${d.proto}</span></div>
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
    tagsMeta.push({ id, dev, addr, type: document.getElementById('newTagType').value, access: document.getElementById('newTagAccess').value, val: '0', desc: '自定义点位' });
    document.getElementById('newTagId').value = '';
    document.getElementById('newTagAddr').value = '';
    renderDevices(); renderTags();
  });

  document.getElementById('btnExportManifest').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ schema: 'tia-web-twin/manifest@1', project: 'smt-pick-and-place', devices, tags: tagsMeta }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'twin.manifest.json'; a.click();
  });

  renderMainBars();
  renderTags();
  renderDevices();
})();
