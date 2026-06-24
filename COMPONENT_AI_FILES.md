# Framo 组件库与 AI 生成功能文件清单

## 可运行 MVP

- `server.mjs`：HTTP 服务、Sketch 上传、ZIP 安全解析、Symbol/图标/字体/字号/Token 识别、Sketchtool 官方预览导出、组件库持久化、AI 生成接口。
- `app.js`：组件库选择、上传交互、资产分类与搜索、Token 展示、AI 生成请求与组件引用展示。
- `index.html`：组件库与 AI 生成页面结构。
- `styles.css`：组件库资产面板、图标/组件预览和 AI 生成画布样式。
- `package.json`：本地启动脚本。
- `README.md`：启动与 API 说明。

## 当前识别数据

- `data/sketch-libraries.json`：已识别的组件库、Token 与资产索引。
- `data/sketch-assets/`：Sketch 官方导出的 SVG 图标和组件预览。

## 后端工程化骨架

- `backend/src/modules/ai/ai.controller.ts`：AI 接口控制器。
- `backend/src/modules/ai/ai.service.ts`：AI Prompt 与页面生成服务。
- `backend/src/modules/page/page.service.ts`：页面与组件库关联服务。
- `backend/src/modules/app.module.ts`、`backend/src/main.ts`：NestJS 模块及入口。
- `backend/prisma/schema.prisma`：项目、组件库、页面和原型数据模型。
- `backend/package.json`：工程化后端依赖。

## Prompt 与架构

- `docs/prompts.md`：规范解析、页面生成、JSON 转 HTML Prompt。
- `docs/architecture.md`：整体架构说明。

## 运行

```bash
npm start
```

访问 `http://[::1]:4173`。
