# Axure Preview Platform 生产部署指南

## 环境要求

- **Node.js**: 18.x 或更高版本
- **操作系统**: Linux (推荐 Ubuntu 20.04+ / CentOS 8+) 或 Windows Server
- **端口**: 3000 (可自定义)
- **磁盘**: 至少 5GB 可用空间（用于存储上传的预览文件）

## 部署步骤

### 1. 上传代码

将 `v2/server/` 目录完整上传到服务器，例如 `/opt/axure-platform/`：

```bash
scp -r v2/server/ user@your-server-ip:/opt/axure-platform/
```

### 2. 配置环境变量

```bash
cd /opt/axure-platform/server
cp .env.example .env
```

编辑 `.env` 文件：

```env
PORT=3000
# 生成随机密钥: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your_generated_random_secret_here
NODE_ENV=production
```

### 3. 安装依赖

```bash
cd /opt/axure-platform/server
npm install --production
```

### 4. 配置防火墙

确保服务器防火墙开放你的端口（以 3000 为例）：

```bash
# Ubuntu (ufw)
sudo ufw allow 3000/tcp

# CentOS (firewalld)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload

# 云服务器还需在安全组中放行端口
```

### 5. 启动服务

#### 方式一：直接启动（测试用）

```bash
cd /opt/axure-platform/server
NODE_ENV=production node index.js
```

#### 方式二：PM2 守护进程（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动
cd /opt/axure-platform/server
pm2 start index.js --name axure-platform

# 设置开机自启
pm2 startup
pm2 save

# 常用命令
pm2 status              # 查看状态
pm2 logs axure-platform # 查看日志
pm2 restart axure-platform  # 重启
pm2 stop axure-platform     # 停止
```

#### 方式三：systemd 服务（Linux）

创建 `/etc/systemd/system/axure-platform.service`：

```ini
[Unit]
Description=Axure Preview Platform
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/axure-platform/server
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=JWT_SECRET=your_secret_here
ExecStart=/usr/bin/node index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable axure-platform
sudo systemctl start axure-platform
```

### 6. 配置 Axure 插件

在 Axure 插件所在目录创建 `config.json`：

```json
{
    "serverUrl": "http://你的服务器IP:3000"
}
```

或者在 Axure 插件 UI 中修改服务器地址。

### 7. 验证部署

访问 `http://你的服务器IP:3000`，应看到管理平台登录页面。

## 数据库备份

SQLite 数据库文件位于 `database.sqlite`，备份方法：

```bash
# 手动备份
cp /opt/axure-platform/server/database.sqlite /backup/database-$(date +%Y%m%d).sqlite

# 定时备份 (crontab)
0 3 * * * cp /opt/axure-platform/server/database.sqlite /backup/database-$(date +%Y%m%d).sqlite
```

## 安全建议

1. **修改 JWT_SECRET**：务必使用随机字符串，不要用默认值
2. **防火墙**：只开放必要的端口
3. **Nginx 反向代理（可选）**：如需 HTTPS 或更多防护，可在前面加 Nginx
4. **定期备份数据库**
5. **日志轮转**：`logs/` 目录下的日志文件会持续增长，建议配置 logrotate

## 纯 IP 访问特别说明

本项目支持纯 IP 访问（无域名），无需额外配置。注意：

- 访问地址格式：`http://你的IP:3000`
- 插件 `serverUrl` 配置为：`http://你的IP:3000`
- 不需要配置 HTTPS（HTTP 明文传输，局域网内可接受）
- 如需要公网安全访问，建议配置 Nginx + Let's Encrypt 免费 SSL 证书

## 更新部署

```bash
# 1. 停止服务
pm2 stop axure-platform

# 2. 更新代码（rsync / git pull）

# 3. 安装新依赖
npm install --production

# 4. 重启
pm2 restart axure-platform
```
