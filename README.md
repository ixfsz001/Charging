# Charging - 充电助手

<p align="center">
  <img src="img/LOGO.svg" width="120" alt="Charging Logo">
</p>

<p align="center">
  <strong>一款专为新能源汽车车主打造的充电数据管理工具</strong><br>
  帮助你清晰掌握每一次充电的花费、电量和习惯
</p>

<p align="center">
  <strong>作者：小枫社长</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Author-小枫社长-orange" alt="Author">
  <img src="https://img.shields.io/badge/version-1.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/PWA-supported-purple" alt="PWA">
</p>

## 为什么需要这款软件

作为新能源汽车车主，你是否遇到过这些问题：

- 充电记录分散在各个充电 APP 中，无法统一查看
- 想知道每月充电花了多少钱，却要逐笔手动统计
- 充电账单截图堆积在相册里，找起来费时费力
- 换了手机或卸载 APP 后，历史数据全部丢失

**Charging** 就是为解决这些痛点而生。

## 核心功能

### 智能记录管理

- 快速添加充电记录：充电站名称、时间、电量、金额，几秒完成
- 支持直流快充（DC）和交流慢充（AC）两种类型
- 充电站名称自动补全，常用站点一键选择
- 长按记录可编辑或删除，操作便捷

### 数据统计分析

- 实时统计：充电次数、总电量（kWh）、总花费（元）
- 灵活的时间范围：本周、本月、本季度、本年、全部
- 自定义时间区间查询，精准分析特定时段的充电习惯
- 自动计算平均电价，帮你找到最划算的充电站

### AI 智能识别

- 拍照自动识别充电账单
- 支持各大充电平台的账单截图
- 自动提取充电站、时间、电量、金额等信息
- 一键填充到表单，省去手动输入的麻烦

- **AI 识别配置**：支持自定义 API 地址和密钥，兼容多种 AI 服务

### 数据安全备份

- 一键备份到服务器，数据永不丢失
- 多用户隔离，每个人的备份独立存储
- 历史备份管理：查看、下载、恢复、删除
- 最多保留 30 份备份，自动清理旧版本
- 支持从备份文件导入恢复，换机无忧

### 智能搜索

- 按充电站名称快速搜索记录
- 实时搜索结果，输入即显示
- 结合筛选条件，精准定位目标记录

## 产品亮点

### 轻量纯净

- 无广告、无推送、无后台服务
- 纯本地运行，核心数据存储在设备上
- 安装包极小，不占用手机资源

### 离线可用

- 基于 PWA 技术，断网也能正常使用
- 所有数据本地存储，不依赖网络
- 可添加到手机桌面，像原生 APP 一样使用

### 跨平台兼容

- 支持 Android 5+ 打包为原生 APP
- 支持 iOS Safari 添加到主屏幕
- 支持桌面浏览器使用
- 一套代码，多端运行

### 隐私优先

- 数据默认存储在本地，不上传任何服务器
- 备份功能由用户主动触发，不会自动上传
- 服务器端不收集任何个人信息
- 多用户隔离，数据互不可见

## 功能一览

| 功能 | 说明 |
|------|------|
| 充电记录 | 添加/编辑/删除充电记录 |
| 数据统计 | 多维度统计分析 |
| AI 识别 | 拍照自动识别账单 |
| 智能搜索 | 按站点名称搜索 |
| 数据备份 | 服务器备份，多用户隔离 |
| 备份管理 | 查看/下载/恢复/删除历史备份 |
| 数据导入 | 从备份文件恢复数据 |
| 离线使用 | PWA 支持，断网可用 |

## 适用人群

- 新能源汽车车主：记录每次充电，掌握充电开支
- 家庭用户：多人共用一辆车，各自记录
- 车队管理：批量管理多辆车的充电数据
- 精打细算：通过统计分析找到最省钱的充电方案

## 快速开始

### 后端服务

#### 环境要求

- Node.js 14+
- 无需安装任何第三方依赖

#### 启动服务

```bash
cd backend
npm start
```

服务默认运行在 `0.0.0.0:3001`，支持局域网访问。

#### 自定义端口

修改 `server.js` 中的 `PORT` 变量：

```javascript
const PORT = 3001;  // 改为你想要的端口
```

### 前端应用

#### HBuilder 云打包

1. 使用 HBuilder X 打开项目
2. 修改 `manifest.json` 中的应用信息
3. 菜单 → 发行 → 原生App-云打包

#### 本地调试

1. 在 HBuilder X 中运行到浏览器
2. 或使用真机调试（USB 连接手机）

## 项目结构

```
Charging/
├── backend/                 # 后端服务
│   ├── server.js            # 服务器主程序
│   ├── package.json         # 项目配置
│   └── backups/             # 备份文件存储（按用户隔离）
│       ├── user_xxx/        # 用户A的备份
│       └── user_yyy/        # 用户B的备份
├── js/
│   ├── app.js               # 主应用逻辑
│   ├── data.js              # 数据管理模块
│   ├── ui.js                # UI 界面模块
│   ├── utils.js             # 工具函数
│   └── ai.js                # AI 图片识别模块
├── css/
│   └── main.css             # 样式文件
├── img/                     # 图片资源
├── iconfont/                # 图标字体
├── index.html               # 主页面
├── manifest.json            # PWA 配置
└── sw.js                    # Service Worker
```

## API 接口文档

### 基础信息

- 基础路径：`http://<服务器IP>:3001`
- 所有接口支持跨域（CORS）
- 用户通过 `uid` 参数隔离数据

### 接口列表

#### 1. 创建备份

**POST** `/api/backup?uid={用户ID}`

请求体：
```json
{
  "content": "备份内容（JSON 字符串）",
  "fileName": "文件名"
}
```

响应：
```json
{
  "success": true,
  "url": "http://192.168.1.100:3001/api/download/charging_backup_2026-07-10T15-00-00-000Z.json",
  "fileName": "charging_backup_2026-07-10T15-00-00-000Z.json"
}
```

说明：
- 自动清理旧备份，每个用户最多保留 30 份
- 文件名基于时间戳自动生成

#### 2. 获取备份列表

**GET** `/api/backups?uid={用户ID}`

响应：
```json
{
  "success": true,
  "files": [
    {
      "name": "charging_backup_2026-07-10T15-00-00-000Z.json",
      "size": 19663,
      "time": "2026-07-10T15:00:00.000Z"
    }
  ]
}
```

#### 3. 下载备份文件

**GET** `/api/download/{文件名}?uid={用户ID}`

- 返回文件内容，支持直接下载
- Content-Type: `application/json` 或 `text/plain`

#### 4. 获取备份内容（用于恢复）

**GET** `/api/content/{文件名}?uid={用户ID}`

响应：
```json
{
  "success": true,
  "content": "{\"records\":[...],...}"
}
```

#### 5. 删除备份

**DELETE** `/api/backups/{文件名}?uid={用户ID}`

响应：
```json
{
  "success": true
}
```

## 多用户机制

- 每个用户首次使用时自动生成唯一 ID（存储在浏览器 localStorage）
- 备份数据按用户 ID 隔离存储在 `backups/{uid}/` 目录下
- 不同用户之间互不影响

## 数据格式

备份文件为 JSON 格式，结构如下：

```json
{
  "records": [
    {
      "id": "1720000000000",
      "stationName": "XX充电站",
      "chargeType": "fast",
      "startTime": "2026-07-10T10:00:00.000Z",
      "endTime": "2026-07-10T11:30:00.000Z",
      "chargeAmount": 45.5,
      "finalPrice": 58.25,
      "discountAmount": 5.00
    }
  ],
  "exportTime": "2026-07-10T15:00:00.000Z",
  "version": "1.0"
}
```

## 常见问题

### 手机无法连接服务器

1. 确认手机和电脑在同一局域网
2. 确认电脑 IP 地址正确（`ipconfig` 查看）
3. 检查 Windows 防火墙是否放行了 Node.js
4. 确认服务器已启动且端口正确

### 备份文件在哪里

- 服务器端：`backend/backups/{用户ID}/` 目录下
- 手机端：备份数据上传到服务器，本地不存储

### 如何恢复备份

1. 打开 APP → 设置 → 备份记录
2. 找到要恢复的备份，点击「恢复」
3. 确认覆盖当前数据

## 技术栈

- **前端**：原生 HTML/CSS/JavaScript，PWA
- **后端**：Node.js（无第三方依赖）
- **打包**：HBuilder 5+ App（Android）
- **AI 识别**：兼容多种 AI API 服务
