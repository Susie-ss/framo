// api.js - API 调用封装（自动刷新 token）
const API_BASE = ''; // 同源，不需要写完整 URL

let isRefreshing = false;
let refreshPromise = null;

// ============ Token 操作 ============

function getAccessToken() {
  return localStorage.getItem('accessToken');
}

function getRefreshToken() {
  return localStorage.getItem('refreshToken');
}

function setTokens(accessToken, refreshToken) {
  if (accessToken) localStorage.setItem('accessToken', accessToken);
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
}

function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

// 检查 token 是否即将过期（剩余 < 1 小时）
function isTokenExpiringSoon(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000;
    return exp - Date.now() < 60 * 60 * 1000;
  } catch (e) {
    return true;
  }
}

// 刷新 access token
async function refreshAccessToken() {
  if (isRefreshing) return refreshPromise;

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) throw new Error('No refresh token');

      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (!res.ok) {
        clearTokens();
        window.location.href = '/login';
        throw new Error('Refresh token invalid, status: ' + res.status);
      }

      const data = await res.json();
      setTokens(data.accessToken, null);
      return data.accessToken;
    } catch (e) {
      console.error('[api.js] Token refresh failed:', e);
      clearTokens();
      window.location.href = '/login';
      throw e;
    } finally {
      isRefreshing = false;
    }
  })();

  return refreshPromise;
}

// ============ 通用请求封装 ============

async function apiRequest(url, options = {}) {
  let token = getAccessToken();

  // 只有在有 token 的情况下才检查是否即将过期
  if (token && isTokenExpiringSoon(token)) {
    try {
      token = await refreshAccessToken();
    } catch (e) {
      // refreshAccessToken 内部已处理跳转，这里直接抛错
      throw e;
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = { ...options, headers };

  let res;
  try {
    res = await fetch(`${API_BASE}${url}`, config);
  } catch (fetchErr) {
    console.error('[api.js] Fetch failed:', url, fetchErr);
    throw fetchErr;
  }

  // 如果是 401，尝试刷新 token 后重试一次
  // 排除公开接口（登录、注册、分享），它们的 401 是业务响应，不应触发 token 刷新
  const isPublicApi = url.startsWith('/api/auth/login') ||
                      url.startsWith('/api/auth/register') ||
                      url.startsWith('/api/share/');
  if (res.status === 401 && !isPublicApi) {
    try {
      token = await refreshAccessToken();
      headers['Authorization'] = `Bearer ${token}`;
      res = await fetch(`${API_BASE}${url}`, { ...config, headers });
    } catch (e) {
      // refreshAccessToken 内部已处理跳转
      throw e;
    }
  }

  // 尝试解析 JSON
  try {
    return await res.json();
  } catch (e) {
    console.error('[api.js] Failed to parse JSON from:', url, 'status:', res.status);
    throw new Error('服务器返回数据格式错误');
  }
}

// ============ 文件上传（FormData）============

async function apiUpload(url, formData) {
  let token = getAccessToken();
  if (token && isTokenExpiringSoon(token)) {
    try { token = await refreshAccessToken(); } catch (e) { throw e; }
  }

  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${url}`, {
      method: 'POST',
      headers,
      body: formData
    });
  } catch (fetchErr) {
    console.error('[api.js] Upload fetch failed:', url, fetchErr);
    throw fetchErr;
  }

  if (res.status === 401) {
    try {
      token = await refreshAccessToken();
      headers['Authorization'] = `Bearer ${token}`;
      res = await fetch(`${API_BASE}${url}`, {
        method: 'POST',
        headers,
        body: formData
      });
    } catch (e) {
      throw e;
    }
  }

  try {
    return await res.json();
  } catch (e) {
    console.error('[api.js] Failed to parse JSON from:', url, 'status:', res.status);
    throw new Error('服务器返回数据格式错误');
  }
}

// ============ 便捷方法（全局可用） ============

var api = {
  get: (url) => apiRequest(url, { method: 'GET' }),
  post: (url, data) => apiRequest(url, { method: 'POST', body: JSON.stringify(data) }),
  put: (url, data) => apiRequest(url, { method: 'PUT', body: JSON.stringify(data) }),
  del: (url) => apiRequest(url, { method: 'DELETE' }),
  upload: (url, formData) => apiUpload(url, formData)
};

// ============ 状态查询（全局可用） ============

function isLoggedIn() {
  const token = getAccessToken();
  return !!token && !isTokenExpiringSoon(token);
}

function getCurrentUser() {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { userId: payload.userId, username: payload.username, nickname: payload.nickname };
  } catch (e) {
    return null;
  }
}

// 挂载到全局（确保其他脚本能访问）
window.api = api;
window.isLoggedIn = isLoggedIn;
window.getCurrentUser = getCurrentUser;
window.getAccessToken = getAccessToken;
window.setTokens = setTokens;
window.clearTokens = clearTokens;
