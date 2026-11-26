# Industrial Web SCADA / Digital Twin HTML 美化规范 (UI Beautification Sub-Skill)

本规范作为 `industrial-twin-skill` 的内置前端视觉与交互美化子技能，融合了 GitHub 三大主流开源设计 Skill 的核心方法论与 **ISA-101 高性能工业 HMI 标准**：

- **[`anthropics/skills` · `frontend-design`](https://github.com/anthropics/skills/tree/main/skills/frontend-design)**：反 AI 模板化（Anti-Slop）、主题与场景锚定、排版克制与视觉重心唯一性。
- **[`nextlevelbuilder/ui-ux-pro-max-skill`](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)**：工业仪表盘设计系统（Swiss Minimalism / Industrial Slate 色板、`Fira Sans + Fira Code` 字体配对、交付前核对清单）。
- **[`pbakaus/impeccable`](https://github.com/pbakaus/impeccable)**：`Operate`（工控操作台）与 `Experience`（3D/2.5D 数字孪生视口）双模式分工原则——视口退后让位于设备本身，操作台追求扫描效率与精确克制。

---

## 1. 反 AI 廉价模板红线（源自 `frontend-design` & `impeccable`）

生成 `index.html`、`styles.css` 与画布渲染代码时，**严禁**出现以下通用 AI 生成特征：
1. **禁止“SaaS 套娃圆角卡片墙”**：不要把所有数据、按钮、状态都塞进相同 `border-radius` + 渐变描边 + 软阴影的卡片里；避免左右塞满厚重侧边栏把产线画布挤扁。
2. **禁止滥用全大写眉标与中点拼接**：不要在每个标题上方堆砌 `ALL CAPS EYEBROW` 或用 `A · B · C` 拼接装饰性元信息。
3. **禁止用 Emoji 充当工业图标**：所有操作按钮、状态指示、连接开关必须使用 crisp SVG（如 Lucide / Heroicons 风格线条图标）或纯几何指示灯。
4. **禁止“霓虹赛博朋克”光晕滥用**：遵循 **ISA-101 高性能 HMI 原则**——平时界面沉稳克制，**高饱和色彩只留给运行状态、传感器触发与故障报警**。

---

## 2. 多风格主题矩阵（严禁千篇一律只用暗黑风！）

工业现场光照、行业属性与交付场景各不相同，**禁止所有项目默认套用“深色赛博风”**！生成前端前，应根据用户场景或偏好从以下 **4 套工业级风格预设** 中主动挑选最契合的一套（默认推荐高对比浅色/中性灰，仅在展厅大屏或明确要求夜间模式时使用深色）：

| 风格预设 | 适用场景 | 核心色板 (`--bg` / `--surface` / `--fg` / `--accent`) |
| :--- | :--- | :--- |
| **1. 瑞士极简浅色工控风** (`swiss-light`) | 医药/食品/洁净车间、平板端操作、日间强光现场 | `#F8FAFC` / `#FFFFFF` / `#0F172A` / `#059669`（描边 `#E2E8F0`） |
| **2. ISA-101 标准中性灰** (`isa-gray`) | 24 小时中控室、流程工业 SCADA（零视觉疲劳） | `#E5E7EB` / `#F3F4F6` / `#111827` / `#0369A1`（描边 `#D1D5DB`） |
| **3. 精密暖灰工程台风** (`warm-cad`) | 实验室测试台、精密检测设备、CAD 风格工作台 | `#F4F3EF` / `#FFFFFF` / `#1C1917` / `#0284C7`（描边 `#E7E5E4`） |
| **4. 深色控制室夜间风** (`dark-control`) | 展厅汇报大屏、夜间值守、低照度暗室环境 | `#0E131B` / `rgba(20,27,39,0.86)` / `#EEF2F6` / `#10B981` |

> [!TIP]
> **多协议与设备管理界面规范**：上位机不得假定只有西门子 S7！中大型项目必须提供专门的**“设备接入与数据点位管理”**视图，支持 `S7comm`、`Modbus TCP`、`Modbus RTU (RS-485)`、`Raw TCP/IP` 设备通道的新增/启停、点位地址映射及 `twin.manifest.json` 导出。

### 2.1 通用工业语义色（四套主题共用）
- **运行 / 正常 (`--ok`)**：`#059669`（浅色系）/ `#10B981`（深色系）
- **传感 / 激活 (`--active`)**：`#0284C7`（浅色系）/ `#38BDF8`（深色系）
- **警告 / 动作中 (`--warn`)**：`#D97706`（浅色系）/ `#F59E0B`（深色系）
- **急停 / 故障 (`--danger`)**：`#DC2626`（浅色系）/ `#EF4444`（深色系）

### 2.2 字体与等宽数字排版（`Fira Sans` + `Fira Code`）
- **无衬线正文/标签**：优先 `"Fira Sans", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`（离线环境自动回退系统字体）。
- **数据与 PLC 地址**：`"Fira Code", "Cascadia Code", Consolas, monospace`，所有实时跳动数值必须启用 `font-variant-numeric: tabular-nums;`，杜绝数字宽度变化引起的界面抖动。
- **对比度底线**：正文与按钮文字对比度不低于 `4.5:1`。

---

## 3. 布局与视口黄金法则（`Operate` + `Experience` 融合）

1. **80/20 视口绝对主角**：2.5D / 3D 产线画布占满视觉中心（全屏或 ≥ 75% 空间），仅用**顶部极简状态条 + 底部紧凑悬浮遥测条（Floating Dock）**承载高频数据，不遮挡机械运动轨迹。
2. **2.5D/3D 材质与地面投影**：设备本体使用冷铝型材明暗三面（`#64748B` / `#475569` / `#334155`）与哑光深炭灰输送带（`#1E2530`），并在地面绘制柔和投影，消除“纸片悬浮感”。
3. **非必要不动效**：除真实设备运动与状态变更外，禁止在卡片上堆砌入场滑入动画；所有交互过渡控制在 `150–250ms` 并尊重 `prefers-reduced-motion`。

---

## 4. 交付前强制自检清单（Pre-Delivery Checklist）

- [ ] **视口主导**：产线画布是否占绝对主导，无厚重侧边栏挤压？
- [ ] **零 AI 模板味**：是否去除了套娃圆角卡片、无意义全大写眉标与 Emoji 图标？
- [ ] **数据清晰**：关键 I/O 地址与实时数值是否启用 `tabular-nums`，单位弱化、数值醒目？
- [ ] **可访问性**：可点击元素均有 `cursor: pointer`、清晰 `:focus-visible` 焦点环及 ≥ `4.5:1` 对比度？
- [ ] **截图肉眼复核**：打开渲染页面截图检查——引线标注无重叠、无边缘裁切、整体具备真实工业软件质感。
