# Framo MVP Architecture

## Frontend

- `index.html`: 本地可运行的工作台 MVP
- `styles.css`: 视觉系统与响应式布局
- `app.js`: mock 数据、AI 页面 JSON 生成和渲染协议演示
- `prototype/demo/index.html`: 原型托管 iframe 示例

## Backend Skeleton

- `backend/prisma/schema.prisma`: 对齐组织、项目、组件库、页面、原型、评论与文件夹
- `backend/src/modules/ai`: Prompt 构建与生成入口
- `backend/src/modules/page`: 页面生成业务骨架
- `backend/src/main.ts`: Nest 启动入口

## Product Principles

1. Prompt → JSON → Render
2. Design Token 是约束核心
3. 原型托管优先采用 HTML + iframe
4. UI 规范解析优先输出结构化 JSON，再做 token 标准化
