# 🏭 行业数字孪生示例库 · Examples

本目录用于存放基于 **Industrial Twin Skill** 标准架构（`twin.manifest.json` 统一 I/O 契约 + 动静分离 + 多协议网关）构建的完整工业数字孪生落地示例。

---

## 📦 示例列表

| 示例目录 | 行业场景 | 建模方式 | 通信协议 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| [`smt-pick-and-place/`](smt-pick-and-place/) | **SMT 高速贴片机生产线**（7 工位完整产线） | 2.5D 等轴测 + 精密暖灰 (`warm-cad`) | S7comm / Modbus / Raw TCP | 含 7 工位 2.5D 贴装仿真、12 飞达与 8 温区监控、多协议设备管理及 `TwinIO.scl`（[中文说明](smt-pick-and-place/README.md) · [English](smt-pick-and-place/README_en.md)） |
| [`smart-factory-scada/`](smart-factory-scada/) | **新能源电驱智能总装线**（大型多视图 SCADA） | 2.5D 等轴测 + 瑞士浅色 (`swiss-light`) | S7comm / Modbus / Raw TCP | 含 6 工位 2.5D 闭环、20 点位跨协议监视表、多协议设备管理与审计日志（[说明](smart-factory-scada/README.md)） |

> 💡 后续新增的其他产线或设备数字孪生示例，将按独立子目录形式持续补充在此目录下。
