# 🏭 行业数字孪生示例库 · Examples

本目录用于存放基于 **Industrial Twin Skill** 标准架构（`twin.manifest.json` 统一 I/O 契约 + 动静分离 + 多协议网关）构建的完整工业数字孪生落地示例。

---

## 📦 示例列表

| 示例目录 | 行业场景 | 建模方式 | 通信协议 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| [`smt-pick-and-place/`](smt-pick-and-place/) | **SMT 高速贴片机生产线**（7 工位完整产线） | Three.js + Blender 自动化脚本 | S7comm / Modbus / Mock | 含 3D 渲染、SCADA 仪表盘、`TwinIO.scl`、`smt_blender_script.py`（[中文说明](smt-pick-and-place/README.md) · [English](smt-pick-and-place/README_en.md)） |
| [`smart-factory-scada/`](smart-factory-scada/) | **新能源电驱智能总装线**（大型多视图 SCADA） | 2.5D 等轴测 + ISA-101 极简工控台 | S7comm / Offline | 含 6 工位 2.5D 闭环、20 点位 `DB1` 监视表、实时波形与审计日志（[说明](smart-factory-scada/README.md)） |

> 💡 后续新增的其他产线或设备数字孪生示例，将按独立子目录形式持续补充在此目录下。
