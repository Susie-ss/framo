// config.js - 统一配置管理
require('dotenv').config();

module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'default_secret_change_me',
  ACCESS_TOKEN_EXPIRY: '1d',
  REFRESH_TOKEN_EXPIRY: 7 * 24 * 60 * 60, // 7天（秒）
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development'
};
