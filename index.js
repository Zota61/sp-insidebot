'use strict';

require('dotenv').config();
const express = require('express');

const app = express();
const PORT = process.env.PORT || 8080; // Cloud Run 需要監聽 8080

// **環境變數檢查**
const requiredEnv = [
  'LINE_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET',
  'DB_HOST',
  'DB_USER',
  'DB_PASS',
  'DB_NAME',
  'DB_PORT',
  'DEVELOPER_USER_ID',
  'ADMIN_USER_IDS',
];
const missingEnv = requiredEnv.filter(env => !process.env[env]);

if (missingEnv.length > 0) {
  console.error(`❌ 缺少環境變數: ${missingEnv.join(', ')}`);
  process.exit(1);
}

const {listenLineWebhook} = require('./linebot');
const {handleEvent} = require('./event');

listenLineWebhook(app, handleEvent);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 伺服器運行中，監聽 ${PORT} 端口`);
});
