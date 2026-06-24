# Framo

Framo 已完整复用 `WorkBuddy/成品/ProtoPlatform` 的平台能力，并保留原有的 Sketch 组件库识别与 AI 生成逻辑。当前主应用是一个真实可运行的 Express + SQLite 平台，不再是静态演示页。

## 启动与预览

```bash
cd /Users/q1a2z3/Documents/Code/Framo
npm start
```

访问：<http://127.0.0.1:4173>

## 已复用的平台功能

- 注册、登录、令牌刷新、退出、个人资料、昵称、密码和头像
- 首页工作台、统计数据、最近项目和操作日志
- 项目创建、编辑、删除、搜索、排序、网格/列表视图
- 产品线/标签的创建、编辑、排序、项目归类与移除
- Axure 原型 ZIP 上传、解压、托管和项目版本管理
- 完整原型查看器：页面树、iframe 预览、缩放、刷新、全屏和新窗口打开
- 项目分享、分享口令、访问权限和分享链接重置
- 项目成员邀请、移除和成员权限
- 页面评论、评论数量、通知和项目统计
- 操作日志及日志统计
- 组件库、Design Token、Sketch 上传和解析
- AI 原型生成、设计系统选择、实时 iframe 预览和结果保存
- Axure/Electron 同步插件下载

## Sketch 与 AI 能力

- 单个 `.sketch` 文件最大 200MB
- 解析 Symbol、组件族、图标矢量路径、颜色、字体、字重、字号、文本样式和图层样式
- macOS 可调用 Sketch 官方 `sketchtool` 导出真实 SVG 预览，并在单项失败时降级
- 识别结果持久化到 `data/sketch-libraries.json`
- TethysDesign1.0 当前识别结果：41 个组件族、1547 个组件变体、931 个图标、5 种字体、11 档字号
- AI 生成会使用所选组件库的 Token，并返回实际组件名称和引用用途

## 插件

- 页面下载地址：<http://127.0.0.1:4173/downloads/Framo-Axure-Plugin-1.0.0.zip>
- 插件源码：`AxurePlugin/`
- 包含 Electron 主进程、同步界面、服务配置、macOS/Windows 构建脚本和安装说明
- 本地服务地址已配置为 `http://localhost:4173`

## 目录

- `platform-server/`：完整 ProtoPlatform 前端、后端、SQLite 数据库、原型查看器和业务路由
- `server.mjs`：原 Framo Sketch 深度解析与 AI 结构化生成逻辑
- `data/`：组件库、项目数据和 Sketch SVG 资源
- `AxurePlugin/`：真实 Axure/Electron 插件工程
- `downloads/`：可直接下载的插件开发包
- `backend-skeleton/`：原工程骨架参考

## 主要接口

- `/api/auth/*`：认证和账户
- `/api/projects/*`：项目、页面、成员、评论和分享权限
- `/api/upload`：Axure 原型上传
- `/api/share/*`：公开分享
- `/api/product-lines/*`：产品线和标签
- `/api/notifications`、`/api/logs/*`、`/api/stats`：通知、日志和统计
- `/api/ai/*`：平台 AI 生成、设计系统和结果保存
- `/api/framo/libraries`：深度识别后的组件库
- `/api/framo/sketch/import`：Sketch 上传解析
- `/api/framo/ai/generate`：引用组件库的结构化 AI 生成
- `/api/framo/prototypes`：Framo 原型列表
- `/api/health`：运行状态
