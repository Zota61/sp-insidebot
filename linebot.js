'use strict';
const line = require('@line/bot-sdk');
const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new line.Client(config);

const replyToUser = async (replyToken, message) => {
  try {
    await client.replyMessage(replyToken, {type: 'text', text: message});
  } catch (error) {
    console.error('❌ LINE 訊息回覆錯誤:', error);
  }
};

const listenLineWebhook = (app, handleEvent) => {
  app.post('/webhook', line.middleware(config), async (req, res) => {
    try {
      if (!req.body.events || req.body.events.length === 0) {
        return res.sendStatus(200);
      }

      try {
        await Promise.all(
          req.body.events.map(event =>
            handleEvent(event).catch(err =>
              console.error('❌ 處理單個事件時錯誤:', err),
            ),
          ),
        );
        return res.sendStatus(200); // Correct placement of return statement
      } catch (err) {
        console.error('❌ Webhook 處理錯誤:', err);
        return res.sendStatus(500);
      }
    } catch (err) {
      console.error('❌ Webhook 處理錯誤:', err);
      res.sendStatus(500);
    }
  });
};

module.exports = {
  replyToUser,
  listenLineWebhook,
};
