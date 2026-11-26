# 🏭 行业数字孪生示例库 · Examples

本目录用于存放基于 **Industrial Twin Skill** 标准架构（`twin.manifest.json` 统一 I/O 契约 + 动静分离 + 多协议网关）构建的完整工业数字孪生落地示例。

---

## 📦 示例列表

| 示例目录 | 行业场景 | 建模方式 | 通信协议 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| [`smt-pick-and-place/`](smt-pick-and-place/) | **SMT 高速贴片机生产线**（7 工位完整产线） | 工艺组态图 + 精密暖灰 (`warm-cad`) | S7comm / Modbus / Raw TCP | 含 7 工位产线组态、轴坐标/飞达/8 温区数据监控、多协议设备管理及 `TwinIO.scl`（[中文说明](smt-pick-and-place/README.md) · [English](smt-pick-and-place/README_en.md)） |
| [`plc-lamp-25d/`](plc-lamp-25d/) | **启停控制与输出小灯**（入门实机闭环） | 2.5D 交互控制台 + 瑞士浅色 (`swiss-light`) | S7 / MC / Modbus / 串口识别 | 2 个 2.5D 启停按钮 + 1 个输出小灯，含 S7 原子单比特写入与串口自动识别（[说明](plc-lamp-25d/README.md)） |
| [`smart-factory-scada/`](smart-factory-scada/) | **新能源电驱智能总装线**（大型多视图 SCADA） | 2.5D 等轴测 + 瑞士浅色 (`swiss-light`) | S7comm / Modbus / Raw TCP | 含 6 工位 2.5D 闭环、20 点位跨协议监视表、多协议设备管理与审计日志（[说明](smart-factory-scada/README.md)） |
| [`water-treatment-scada/`](water-treatment-scada/) | **智慧水务与污水处理 SCADA**（大型市政环保监控） | 2.5D 等轴测 + ISA-101 工业中性灰 (`isa-gray`) | S7 / MC / FINS / Modbus / MQTT / 串口识别 | 含 A2O+超滤四段工艺 2.5D 闭环、一级 A 在线水质监测、18 点位监视表与多协议设备管理（[说明](water-treatment-scada/README.md)） |

> 💡 后续新增的其他产线或设备数字孪生示例，将按独立子目录形式持续补充在此目录下。
