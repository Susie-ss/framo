// middleware/rate-limit.js — 统一限流中间件
// 支持多策略叠加（月/天/时/分），从最大窗口优先检测
// 配置驱动：config/rate-limit.json

const path = require('path');
const fs = require('fs');

// 加载配置
const configPath = path.join(__dirname, '..', 'config', 'rate-limit.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (e) {
  console.error('[RateLimit] 无法加载限流配置文件:', e.message);
  config = { endpoints: {}, defaults: { statusCode: 429, headers: true } };
}

// 窗口大小排序权重（越大越优先检查）
const WINDOW_ORDER = { month: 3, day: 2, hour: 1, minute: 0 };

// 缓存: Map<key, { value, resetAt }>  value 对 count 存次数，对 bytes 存字节数
const cache = new Map();

// 获取时间窗口标识
function getWindowKey(window, now) {
  const d = new Date(now);
  const pad = n => String(n).padStart(2, '0');
  switch (window) {
    case 'minute': return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    case 'hour':   return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}`;
    case 'day':    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    case 'month':  return `${d.getFullYear()}-${pad(d.getMonth()+1)}`;
    default:       return '';
  }
}

// 获取窗口重置时间（毫秒时间戳）
function getWindowResetAt(window, now) {
  const d = new Date(now);
  switch (window) {
    case 'minute':
      d.setSeconds(60, 0, 0);
      return d.getTime();
    case 'hour':
      d.setMinutes(60, 0, 0);
      return d.getTime();
    case 'day':
      d.setHours(24, 0, 0, 0);
      return d.getTime();
    case 'month':
      d.setMonth(d.getMonth() + 1, 1);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    default:
      return now + 60000;
  }
}

// 核心检测函数
// 返回 { allowed, strategies: [{ window, max, current, remaining, resetAt }] }
function check(action, identifier, addValue = 1) {
  const endpoint = config.endpoints[action];
  if (!endpoint || !endpoint.strategies || endpoint.strategies.length === 0) {
    return { allowed: true, strategies: [] };
  }

  const now = Date.now();
  // 按窗口从大到小排序
  const sorted = [...endpoint.strategies].sort(
    (a, b) => WINDOW_ORDER[b.window] - WINDOW_ORDER[a.window]
  );

  const results = [];
  let blocked = null;

  for (const strategy of sorted) {
    const windowKey = getWindowKey(strategy.window, now);
    const cacheKey = `${action}:${identifier}:${strategy.window}:${windowKey}`;
    const resetAt = getWindowResetAt(strategy.window, now);
    const max = strategy.max;

    let entry = cache.get(cacheKey);
    if (!entry || entry.resetAt <= now) {
      entry = { value: 0, resetAt };
    }

    const current = entry.value;
    const wouldBe = current + addValue;
    const remaining = Math.max(0, max - current);

    results.push({
      window: strategy.window,
      label: strategy.label || strategy.window,
      max,
      current,
      remaining,
      resetAt: entry.resetAt
    });

    if (wouldBe > max) {
      blocked = blocked || {
        window: strategy.window,
        label: strategy.label || strategy.window,
        max,
        current,
        remaining: 0,
        resetAt: entry.resetAt
      };
    }
  }

  return {
    allowed: !blocked,
    blocked,
    strategies: results
  };
}

// 记录一次命中（递增计数）
function hit(action, identifier, addValue = 1) {
  const endpoint = config.endpoints[action];
  if (!endpoint || !endpoint.strategies) return;

  const now = Date.now();
  for (const strategy of endpoint.strategies) {
    const windowKey = getWindowKey(strategy.window, now);
    const cacheKey = `${action}:${identifier}:${strategy.window}:${windowKey}`;
    const resetAt = getWindowResetAt(strategy.window, now);

    let entry = cache.get(cacheKey);
    if (!entry || entry.resetAt <= now) {
      entry = { value: 0, resetAt };
    }
    entry.value += addValue;
    cache.set(cacheKey, entry);
  }
}

// 清除某 action 的所有计数（如登录成功后重置失败计数）
function clear(action, identifier) {
  const endpoint = config.endpoints[action];
  if (!endpoint) return;

  const now = Date.now();
  for (const strategy of endpoint.strategies) {
    const windowKey = getWindowKey(strategy.window, now);
    const cacheKey = `${action}:${identifier}:${strategy.window}:${windowKey}`;
    cache.delete(cacheKey);
  }
}

// 设置限流响应头
function setHeaders(res, result) {
  if (!config.defaults.headers) return;

  for (const s of result.strategies) {
    const name = s.window.charAt(0).toUpperCase() + s.window.slice(1);
    res.set(`X-RateLimit-Limit-${name}`, s.max);
    res.set(`X-RateLimit-Remaining-${name}`, s.remaining);
    res.set(`X-RateLimit-Reset-${name}`, Math.ceil(s.resetAt / 1000));
  }
}

// 构建限流错误消息
function buildMessage(action, blocked) {
  const endpoint = config.endpoints[action];
  const label = endpoint?.label || action;
  const strategy = endpoint?.strategies.find(s => s.window === blocked.window);
  const readableMax = strategy?.type === 'bytes'
    ? formatBytes(blocked.max)
    : blocked.max;

  if (strategy?.type === 'bytes') {
    return `操作太频繁，${label}${blocked.label || ''}最多${readableMax}，请稍后再试`;
  }
  return `操作太频繁，${label}${blocked.label || ''}最多${blocked.max}次，请稍后再试`;
}

function formatBytes(bytes) {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)}GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${bytes}B`;
}

// 中间件工厂函数
// @param {string} action - 限流点名称（对应 rate-limit.json 中的 key）
// @param {function} [getIdentifier] - 自定义标识提取函数，默认从 req.user.userId 取
// @param {function} [getAddValue] - 自定义累加值函数，默认累加 1
function rateLimit(action, getIdentifier, getAddValue) {
  const endpoint = config.endpoints[action];
  if (!endpoint) {
    return (req, res, next) => next();
  }

  return (req, res, next) => {
    let identifier;
    if (getIdentifier) {
      identifier = getIdentifier(req);
    } else {
      identifier = req.user?.userId;
    }

    if (!identifier) {
      return res.status(401).json({ error: '未登录' });
    }

    const addValue = getAddValue ? getAddValue(req) : 1;
    const result = check(action, identifier, addValue);

    if (!result.allowed) {
      setHeaders(res, result);
      return res.status(config.defaults.statusCode).json({
        error: buildMessage(action, result.blocked)
      });
    }

    // 通过检测，记录本次操作
    hit(action, identifier, addValue);
    setHeaders(res, result);
    next();
  };
}

// 暴露底层 API 供特殊场景使用（如 login_fail 需要条件性记录）
rateLimit.check = check;
rateLimit.hit = hit;
rateLimit.clear = clear;
rateLimit.config = config;

// 定期清理过期记录（每5分钟）
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.resetAt <= now) {
      cache.delete(key);
    }
  }
}, 5 * 60 * 1000);

module.exports = { rateLimit };
