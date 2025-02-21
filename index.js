'use strict';

require('dotenv').config();
const express = require('express');

const app = express();
const PORT = process.env.PORT || 8080;

// **環境變數檢查**
const requiredEnv = [
  'LINE_ACCESS_TOKEN',
  'LINE_CHANNEL_SECRET',
  'ZUSERS_API_PREFIX',
  'ZUSERS_PLATFORM_ID',
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
