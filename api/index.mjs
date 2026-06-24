// Framo Vercel API Handler
// 只处理 API 路由，静态文件由 Vercel CDN 处理
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { createHash, createHmac } from "node:crypto";

const ROOT = process.env.VERCEL ? process.cwd() : new URL("..", import.meta.url).pathname.replace(/\/$/, "");

function json(res, code, data) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
  });
}

// JWT
const SECRET = process.env.JWT_SECRET || "framo_dev_secret_2026";
function base64url(buf) {
  return buf.toString("base64url");
}
function createToken(payload) {
  const header = base64url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = base64url(Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })));
  const sig = base64url(createHmac("sha256", SECRET).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}
function verifyToken(token) {
  try {
    const [h, b, s] = token.split(".");
    const expected = base64url(createHmac("sha256", SECRET).update(`${h}.${b}`).digest());
    if (s !== expected) return null;
    const payload = JSON.parse(Buffer.from(b, "base64url").toString());
    return payload.exp && Date.now() > payload.exp ? null : payload;
  } catch { return null; }
}

// 内存存储（serverless 环境下重启会丢失，生产可改用 PostgreSQL）
const users = [{ id: "admin", username: "admin", password: createHash("sha256").update("framo2024").digest("hex"), nickname: "管理员", createdAt: Date.now() }];
const sessions = new Map();

async function tryReadJSON(filePath) {
  try {
    const data = await readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch { return null; }
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const method = req.method;
    const pathname = url.pathname;

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    const body = await parseBody(req);

    // Auth helper
    function getAuthUser() {
      const auth = req.headers["authorization"];
      if (!auth) return null;
      const payload = verifyToken(auth.replace("Bearer ", ""));
      return payload && sessions.has(auth.replace("Bearer ", "")) ? users.find(u => u.id === payload.userId) : null;
    }

    // 健康检查
    if (pathname === "/api/health") return json(res, 200, { status: "ok", vercel: true });

    // 注册
    if (pathname === "/api/auth/register" && method === "POST") {
      if (!body.username || !body.password) return json(res, 400, { error: "需要用户名和密码" });
      if (users.find(u => u.username === body.username)) return json(res, 409, { error: "用户名已存在" });
      const user = {
        id: "user_" + Date.now(),
        username: body.username,
        password: createHash("sha256").update(body.password).digest("hex"),
        nickname: body.nickname || body.username,
        createdAt: Date.now()
      };
      users.push(user);
      const token = createToken({ userId: user.id, exp: Date.now() + 86400000 });
      sessions.set(token, user.id);
      return json(res, 200, { ok: true, token, user: { id: user.id, username: user.username, nickname: user.nickname } });
    }

    // 登录
    if (pathname === "/api/auth/login" && method === "POST") {
      const pwd = createHash("sha256").update(body.password || "").digest("hex");
      const user = users.find(u => u.username === body.username && u.password === pwd);
      if (!user) return json(res, 401, { error: "用户名或密码错误" });
      const token = createToken({ userId: user.id, exp: Date.now() + 86400000 });
      sessions.set(token, user.id);
      return json(res, 200, { ok: true, token, user: { id: user.id, username: user.username, nickname: user.nickname } });
    }

    // 当前用户信息
    if (pathname === "/api/me" && method === "GET") {
      const user = getAuthUser();
      if (!user) return json(res, 401, { error: "未登录" });
      return json(res, 200, { ok: true, user: { id: user.id, username: user.username, nickname: user.nickname } });
    }

    // 项目列表
    if (pathname === "/api/projects" && method === "GET") {
      const data = await tryReadJSON(join(ROOT, "data", "platform.json"));
      return json(res, 200, data?.projects || [
        { id: "proj-1", name: "企业设计中台", status: "active" },
        { id: "proj-2", name: "Axure 托管改造", status: "planning" },
      ]);
    }

    // 统计
    if (pathname === "/api/stats" && method === "GET") {
      return json(res, 200, { projects: 4, libraries: 1, prototypes: 0 });
    }

    // 组件库列表
    if (pathname === "/api/framo/libraries" && method === "GET") {
      const libs = await tryReadJSON(join(ROOT, "data", "sketch-libraries.json"));
      return json(res, 200, libs || []);
    }

    // AI 生成（简化版）
    if (pathname === "/api/framo/ai/generate" && method === "POST") {
      return json(res, 200, {
        ok: true,
        result: { type: "ai-suggestion", layout: { sections: ["header", "hero", "features", "footer"] } }
      });
    }

    // 未匹配的 API 路由
    json(res, 404, { error: "API not found" });
  } catch (err) {
    console.error("API Error:", err.message);
    json(res, 500, { error: err.message });
  }
}
