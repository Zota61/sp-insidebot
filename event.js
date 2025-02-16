'use strict';

const moment = require('moment');
const {handleUserPermission} = require('./userPermission');
const mysql = require('mysql2/promise');
const {replyToUser} = require('./linebot');
// **管理者名單**
const DEVELOPER_USER_ID = process.env.DEVELOPER_USER_ID;
const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS.split(',');
const dynamicAdmins = new Set(ADMIN_USER_IDS);

dynamicAdmins.add(DEVELOPER_USER_ID);

// **MySQL 連線池**
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  port: process.env.DB_PORT,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const handleEvent = async event => {
  try {
    if (event.type !== 'message' || event.message.type !== 'text') {
      return;
    }
    const userMessage = event.message.text.trim();
    console.log('📩 收到訊息:', userMessage);
    const userId = event.source.userId;
    const isAdmin = dynamicAdmins.has(userId);

    const resultUserPermission = await handleUserPermission(
      userMessage,
      userId,
      dynamicAdmins,
    );
    if (resultUserPermission) {
      return replyToUser(event.replyToken, resultUserPermission);
    }

    // 🔹 新增設備
    if (userMessage === '新增設備') {
      return replyToUser(
        event.replyToken,
        `📌 新增設備請使用以下格式：
         新增設備 設備編號 設備狀態(可選填) 運轉時數(必填) 時間(可選填) 地點(可選填)
         - 設備狀態未填寫則預設為「回庫」
         - 時間未填寫則預設為當前時間
         - 地點未填寫則預設為「倉庫」
         例：新增設備 100K-3 出庫 1500H 2029/07/09 台北大佳河濱公園`,
      );
    }

    switch (true) {
      case userMessage.startsWith('新增設備 ') && !isAdmin:
      case userMessage.startsWith('更新設備 ') && !isAdmin:
      case userMessage.startsWith('移除設備 ') && !isAdmin:
      case userMessage === '查看設備列表' && !isAdmin:
        return replyToUser(event.replyToken, '❌ 你沒有權限');
    }

    if (userMessage.startsWith('新增設備 ')) {
      const parts = userMessage.split(' ');
      if (parts.length < 3) {
        return replyToUser(
          event.replyToken,
          '⚠️ 格式錯誤，請使用「新增設備」獲取正確格式！',
        );
      }

      const deviceId = parts[1];
      let status = '回庫'; // 預設值
      let runHours;
      switch (parts[2]) {
        case '出庫':
        case '回庫':
        case '保養完成':
        case '更換第一道柴油':
          status = parts[2];
          runHours = parts[3] ? parts[3].replace(/\D/g, '') : null;
          break;
        default:
          runHours = parts[2] ? parts[2].replace(/\D/g, '') : null;
      }
      const time = new Date().toISOString().split('T')[0]; // 預設當前時間
      const location = '倉庫'; // 預設地點

      if (!runHours || runHours.trim() === '' || isNaN(parseInt(runHours))) {
        return replyToUser(
          event.replyToken,
          '❌ 請輸入正確的運轉時數，例如 1500H（系統將自動忽略 H）。',
        );
      }

      const [equipmentRows] = await db.query(
        'SELECT 設備編號, 設備狀態, 運轉時數, 日期, 使用地點, 上次保養時間, 上次保養時數 FROM 設備資料表 WHERE 設備編號 = ?',
        [deviceId],
      );
      // 確保變數有值，避免 ReferenceError
      let lastMaintenanceTime = null; // 預設為 null
      let lastMaintenanceHours = 0; // 預設為 0

      if (equipmentRows.length > 0) {
        lastMaintenanceTime = equipmentRows[0].上次保養時間 || null;
        lastMaintenanceHours = equipmentRows[0].上次保養時數 || 0;
      }

      if (!equipmentRows || equipmentRows.length === 0) {
        try {
          await db.query(
            `INSERT INTO 設備資料表 (設備編號, 設備狀態, 運轉時數, 日期, 使用地點) 
     	VALUES (?, ?, ?, ?, ?)
     	ON DUPLICATE KEY UPDATE 
     	設備狀態 = VALUES(設備狀態), 
     	運轉時數 = VALUES(運轉時數), 
     	日期 = VALUES(日期), 
     	使用地點 = VALUES(使用地點)`,
            [deviceId, status, runHours, time, location],
          );
          return replyToUser(
            event.replyToken,
            `✅ 設備 ${deviceId} 已成功新增或更新！`,
          );
        } catch (error) {
          console.error('❌ 新增設備錯誤:', error);
          return replyToUser(
            event.replyToken,
            `❌ 新增設備失敗，錯誤碼: ${error.code}`,
          );
        }
      } else {
        const updateQuery = `
            UPDATE 設備資料表
            SET 設備狀態 = ?, 運轉時數 = ?, 日期 = ?, 使用地點 = ?
            WHERE 設備編號 = ?
        `;
        await db.query(updateQuery, [
          status,
          runHours,
          time,
          location,
          deviceId,
        ]);
        let hoursSinceLastMaintenance = runHours - (lastMaintenanceHours || 0);

        // 回傳回應
        return replyToUser(
          event.replyToken,
          `✅ 設備 ${deviceId} 更新成功！\n📌 狀態：${status}\n⏳ 運轉時數：${runHours}H\n📅 日期：${time}\n📍 地點：${location}\n\n📌 上次保養：${moment(
            lastMaintenanceTime,
          ).format(
            'YYYY/MM/DD',
          )}\n📌 上次保養：${lastMaintenanceHours}\n🛠️ 距離保養：${hoursSinceLastMaintenance}H`,
        );
      }
    }

    // 🔹 更新設備
    if (userMessage === '更新設備') {
      return replyToUser(
        event.replyToken,
        `📌 更新設備請使用以下格式：
         更新設備 設備編號 設備狀態(可選填) 運轉時數 上次保養時數 上次保養時間
         - 未填寫的欄位將保留原本的值
         例：更新設備 100K-3 出庫 1600H 300H 2025-02-01`,
      );
    }

    if (userMessage.startsWith('更新設備 ')) {
      const parts = userMessage.split(' ');
      if (parts.length < 4) {
        return replyToUser(
          event.replyToken,
          '⚠️ 格式錯誤，請使用「更新設備」獲取正確格式！',
        );
      }

      const deviceId = parts[1];
      let status = '回庫'; // 預設值
      let time = new Date().toISOString().split('T')[0];
      let runHours, prevMaintainanceTime, prevMaintainanceDate;
      let location = '倉庫';
      switch (parts[2]) {
        case '出庫':
        case '回庫':
        case '保養完成':
        case '更換第一道柴油':
          status = parts[2];
          runHours = parts[3] ? parts[3].replace(/\D/g, '') : null;
          if (parts.length < 6) {
            return replyToUser(
              event.replyToken,
              '⚠️ 格式錯誤，請使用「更新設備」獲取正確格式！',
            );
          }
          prevMaintainanceTime = parts[4];
          prevMaintainanceDate = parts[5];
          //   time = parts[4] ?? null;
          //   location = parts[5] ?? null;
          break;
        default:
          runHours = parts[2] ? parts[2].replace(/\D/g, '') : null;
          if (parts.length < 5) {
            return replyToUser(
              event.replyToken,
              '⚠️ 格式錯誤，請使用「更新設備」獲取正確格式！',
            );
          }
          prevMaintainanceTime = parts[3];
          prevMaintainanceDate = parts[4];

        //   time = parts[3] ?? null;
        //   location = parts[4] ?? null;
      }

      const timeRegex = /^\d{2,3}H$/;
      if (prevMaintainanceTime && !timeRegex.test(prevMaintainanceTime)) {
        return replyToUser(
          event.replyToken,
          '⚠️ 格式錯誤，上次保養時數 ex: 更新設備 100K-3 出庫 1200H 200H 2025/01/02',
        );
      }
      const dateRegex = /^\d{4}([\/\-]?)\d{2}\1\d{2}$/;
      if (prevMaintainanceDate && !dateRegex.test(prevMaintainanceDate)) {
        return replyToUser(
          event.replyToken,
          '⚠️ 格式錯誤，上次保養時間 ex: 更新設備 100K-3 出庫 1200H 200H 2025/01/02',
        );
      }

      try {
        const [rows] = await db.query(
          'SELECT * FROM 設備資料表 WHERE 設備編號 = ?',
          [deviceId],
        );

        if (rows.length === 0) {
          return replyToUser(
            event.replyToken,
            `❌ 設備 ${deviceId} 不存在，請先新增設備！`,
          );
        }

        const updateFields = [];
        const updateValues = [];

        if (status) {
          updateFields.push('設備狀態 = ?');
          updateValues.push(status);
        }
        if (runHours) {
          runHours = runHours.replace(/\D/g, '');

          updateFields.push('運轉時數 = ?');
          updateValues.push(runHours);
        }
        if (time) {
          updateFields.push('日期 = ?');
          updateValues.push(time);
        }
        if (location) {
          updateFields.push('使用地點 = ?');
          updateValues.push(location);
        }
        if (prevMaintainanceDate) {
          updateFields.push('上次保養時間 = ?');
          updateValues.push(moment(prevMaintainanceDate).format('YYYY-MM-DD'));
        }
        if (prevMaintainanceTime) {
          prevMaintainanceTime = prevMaintainanceTime.replace(/\D/g, '');
          updateFields.push('上次保養時數 = ?');
          updateValues.push(prevMaintainanceTime);
        }

        if (updateFields.length === 0) {
          return replyToUser(event.replyToken, '⚠️ 沒有提供更新內容！');
        }

        updateValues.push(deviceId);

        await db.query(
          `UPDATE 設備資料表 SET ${updateFields.join(', ')} WHERE 設備編號 = ?`,
          updateValues,
        );

        return replyToUser(
          event.replyToken,
          `✅ 設備 ${deviceId} 已成功更新！`,
        );
      } catch (error) {
        console.error('❌ 更新設備錯誤:', error);
        return replyToUser(event.replyToken, '❌ 更新設備失敗，請稍後再試。');
      }
    }

    // 🔹 移除設備
    if (userMessage === '移除設備') {
      return replyToUser(
        event.replyToken,
        `📌 移除設備請使用以下格式：
         移除設備 設備編號
         例：移除設備 100K-3`,
      );
    }

    if (userMessage.startsWith('移除設備 ')) {
      const parts = userMessage.split(' ');
      if (parts.length < 2) {
        return replyToUser(
          event.replyToken,
          '⚠️ 格式錯誤，請使用「移除設備」獲取正確格式！',
        );
      }

      const deviceId = parts[1];

      try {
        const [result] = await db.query(
          'DELETE FROM 設備資料表 WHERE 設備編號 = ?',
          [deviceId],
        );
        if (result.affectedRows > 0) {
          return replyToUser(
            event.replyToken,
            `✅ 設備 ${deviceId} 已成功移除！`,
          );
        } else {
          return replyToUser(event.replyToken, '❌ 找不到該設備，無法移除。');
        }
      } catch (error) {
        console.error('❌ 移除設備錯誤:', error);
        return replyToUser(event.replyToken, '❌ 移除設備失敗，請稍後再試。');
      }
    }

    // **🔹 查詢設備列表**
    if (userMessage === '查看設備列表') {
      try {
        const [rows] = await db.query('SELECT * FROM 設備資料表');
        console.log('📊 查詢結果:', rows);

        const header = `📋 設備清單\n──────────────────────────────────\n`;
        const table = rows
          .map(row => {
            return `${row.設備編號.padEnd(8)} | ${row.設備狀態.padEnd(
              6,
            )} | 目前: ${row.運轉時數.toString().padEnd(6)}H | ${moment(
              row.日期,
            ).format('YYYY/MM/DD')} | ${row.使用地點.padEnd(10)} | 保養: ${
              row.上次保養時數
            }H | 柴油更換: ${row.第一道柴油是否更換 === 1 ? '✅' : '❌'}`;
          })
          .join('\n');

        const deviceList =
          header + table + '\n──────────────────────────────────';
        console.log(deviceList);
        return replyToUser(
          event.replyToken,
          deviceList ? `📋 設備列表：\n${deviceList}` : '📋 目前沒有設備資料。',
        );
      } catch (error) {
        console.error('❌ 資料庫查詢錯誤:', error);
        return replyToUser(event.replyToken, '⚠️ 伺服器發生錯誤，請稍後再試。');
      }
    }
    // 📌 查詢設備
    if (userMessage.startsWith('查詢設備 ')) {
      const parts = userMessage.split(' ');
      if (parts.length < 2) {
        return replyToUser(
          event.replyToken,
          '❌ 格式錯誤，請使用「查詢設備 設備編號」\n範例：查詢設備 100K-3',
        );
      }

      const equipmentId = parts[1];

      try {
        const [rows] = await db.query(
          'SELECT * FROM 設備資料表 WHERE 設備編號 = ?',
          [equipmentId],
        );

        if (rows.length === 0) {
          return replyToUser(event.replyToken, `❌ 找不到設備：${equipmentId}`);
        }

        const device = rows[0];
        const formattedDate = moment(device.日期).format('YYYY/MM/DD');
        const lastMaintenance = device.上次保養時間
          ? moment(device.上次保養時間).format('YYYY/MM/DD HH:mm:ss')
          : '未知';

        const message =
          `📋 **設備資訊**\n` +
          `📌 設備編號：${device.設備編號}\n` +
          `🔄 設備狀態：${device.設備狀態 || '未知'}\n` +
          `⏳ 當前運轉時數：${device.運轉時數}H\n` +
          `📅 記錄日期：${formattedDate}\n` +
          `🏠 位置：${device.使用地點 || '未知'}\n` +
          `🛠️ 上次保養時間：${lastMaintenance}\n` +
          `🛠️ 第一道柴油是否更換：${device.第一道柴油是否更換}\n` +
          `⏳ 上次保養時數：${device.上次保養時數 || 0}H`;

        return replyToUser(event.replyToken, message);
      } catch (error) {
        console.error('❌ 查詢設備錯誤:', error);
        return replyToUser(event.replyToken, '⚠️ 查詢設備失敗，請稍後再試。');
      }
    }
    // **功能指引**
    if (userMessage === '範本') {
      return replyToUser(
        event.replyToken,
        '請輸入以下格式：\n1.設備編號: 例100K-3\n2.設備狀態: 例出庫, 回庫, 更換第一道柴油, 保養完成\n3.當前運轉時數: 例1000H\n4.日期: 例2029/07/09\n5.使用地點: 例台北大佳河濱公園',
      );
    }

    if (userMessage === '功能選單') {
      return replyToUser(
        event.replyToken,
        '📋 功能選單：\n1️⃣ 設備回報-輸入 範本可參考回報格式\n2️⃣ 查詢設備\n3️⃣ 新增設備\n4️⃣ 移除設備\n5️⃣ 查看設備列表 \n6️⃣ 新增管理\n7️⃣ 移除管理\n8️⃣ 查看管理者\n9️⃣ 我的ID',
      );
    }

    // **解析設備回報格式**
    const reportPattern =
      /^(\S+)\s+(\S+)\s+(\d+)\s*H?\s+(\d{4}\/\d{1,2}\/\d{1,2})\s+(.+)$/;
    const match = userMessage.match(reportPattern);

    if (match) {
      const [_, equipmentId, status, currentHours, date, location] = match;

      const currentHoursNum = parseInt(currentHours, 10);

      try {
        // **查詢設備的上次保養紀錄**
        const [rows] = await db.query(
          'SELECT 上次保養時間, 上次保養時數,  第一道柴油是否更換 FROM 設備資料表 WHERE 設備編號 = ?',
          [equipmentId],
        );

        if (!rows || rows.length === 0) {
          return replyToUser(
            event.replyToken,
            `❌ 找不到設備：${equipmentId}，請先新增設備！`,
          );
        }

        const {上次保養時間: lastMaintenanceDate, 第一道柴油是否更換} =
          rows[0] || {};
        let {上次保養時數: lastMaintenanceHours} = rows[0] || {};
        const lastMaintenanceHoursNum = parseInt(lastMaintenanceHours, 10) || 0;

        const [deviceRows] = await db.query(
          'SELECT 設備編號, 上次保養時數 FROM 設備資料表 WHERE 設備編號 = ?',
          [equipmentId],
        );
        lastMaintenanceHours = parseInt(deviceRows[0].上次保養時數, 10) || 0;

        // 確保新的運轉時數比上次保養時數高，避免錯誤回報
        if (currentHoursNum < lastMaintenanceHours) {
          return replyToUser(
            event.replyToken,
            `⚠️ 異常回報！當前運轉時數 (${currentHoursNum}H) 低於上次保養時數 (${lastMaintenanceHours}H)，請確認後重新輸入。`,
          );
        }

        let replyMessage = `✅ 設備回報成功！\n📌 設備編號: ${equipmentId}\n📅 日期: ${date}\n🏠 地點: ${location}\n🔄 設備狀態: ${status}\n⏳ 當前運轉時數: ${currentHours}H`;

        if (lastMaintenanceDate && lastMaintenanceDate !== '未知') {
          const formattedMaintenanceDate = moment(lastMaintenanceDate).format(
            'YYYY/MM/DD HH:mm:ss',
          );
          replyMessage += `\n🛠️ 上次保養時間: ${formattedMaintenanceDate}`;
        } else {
          replyMessage += `\n🛠️ 上次保養時間: 未知`;
        }

        if (lastMaintenanceHours) {
          replyMessage += `\n⏳ 上次保養時數: ${lastMaintenanceHours}H`;
        }

        // **儲存設備回報資訊**
        await db.query(
          `INSERT INTO 設備資料表 (設備編號, 設備狀態, 運轉時數, 日期, 使用地點) 
     		VALUES (?, ?, ?, ?, ?)
     		ON DUPLICATE KEY UPDATE 
     		設備狀態 = VALUES(設備狀態), 
     		運轉時數 = VALUES(運轉時數), 
     		日期 = VALUES(日期), 
     		使用地點 = VALUES(使用地點)`,
          [equipmentId, status, currentHoursNum, date, location],
        );

        // **提醒機制：只在柴油更換狀態為 0 時提醒**
        const hourDiff = currentHoursNum - lastMaintenanceHoursNum;

        if (hourDiff >= 450) {
          replyMessage += `\n⚠️ 提醒：設備 **${equipmentId}** 需要 **大保養**，已運轉 **${hourDiff}H**。		\n請保養完成後回報 **保養完成** 以解除提醒。`;
        } else if (hourDiff >= 250 && 第一道柴油是否更換 === 0) {
          // 只有當柴油未更換時才提醒
          replyMessage += `\n⚠️ 提醒：設備 **${equipmentId}** 需要 **更換第一道柴油**，已運轉 **			${hourDiff}H**。\n請更換完畢後回報 **更換第一道柴油** 以解除提醒。`;
        }

        // **當使用者回報"保養完成"，重置柴油更換狀態**
        if (status === '保養完成') {
          try {
            // 確保設備存在

            if (!deviceRows || deviceRows.length === 0) {
              return replyToUser(
                event.replyToken,
                `❌ 找不到設備 ${equipmentId}，請確認設備編號是否正確！`,
              );
            }

            // 格式化時間
            const formattedDate = moment(date).format('YYYY/MM/DD');

            // **更新設備的上次保養時間、運轉時數，並重置柴油更換狀態**
            await db.query(
              'UPDATE 設備資料表 SET 上次保養時間 = ?, 上次保養時數 = ?, 第一道柴油是否更換 = 0 WHERE 設備編號 = ?',
              [formattedDate, currentHoursNum, equipmentId],
            );

            // 建立回覆訊息
            replyMessage += `\n✅ **保養完成**，系統已更新設備資訊！`;
            replyMessage += `\n📅 新的上次保養時間：${formattedDate}`;
            replyMessage += `\n⏳ 新的上次保養時數：${currentHoursNum}H`;
            replyMessage += `\n🔄 **更換第一道柴油提醒已重置，下一次 250H 後將重新觸發提醒！**`;
            return replyToUser(event.replyToken, replyMessage);
          } catch (error) {
            console.error('❌ 更新保養紀錄時發生錯誤:', error);
            return replyToUser(
              event.replyToken,
              '⚠️ 更新保養資訊失敗，請稍後再試。',
            );
          }
        }
        // **更換第一道柴油提醒**
        if (status === '更換第一道柴油') {
          try {
            await db.query(
              'UPDATE 設備資料表 SET  第一道柴油是否更換 = 1 WHERE 設備編號 = ?',
              [equipmentId],
            );
            replyMessage += `\n✅ **更換第一道柴油** 完成，提醒已解除。`;
            return replyToUser(event.replyToken, replyMessage);
          } catch (error) {
            console.error('❌ 更新柴油更換狀態時發生錯誤:', error);
            return replyToUser(
              event.replyToken,
              '⚠️ 更新柴油更換狀態失敗，請稍後再試。',
            );
          }
        }
        if (status === '出庫' || status === '回庫') {
          //   replyMessage = await processEquipmentReport(userMessage, userId);

          return replyToUser(event.replyToken, replyMessage);
        }
        // **如果格式錯誤，提示正確格式**
        return replyToUser(
          event.replyToken,
          '⚠️ 格式錯誤，請依照範本輸入！\n範例：100K-3 出庫 1200H 2029/07/09 台北大佳河濱公園',
        );
      } catch (error) {
        console.error('❌ LINE 訊息處理錯誤:', error);
      }
    }
  } catch (error) {
    console.error('設備回報錯誤：', error);
    return replyToUser(event.replyToken, '❌ 發生錯誤，請稍後再試！');
  }
};

module.exports = {
  handleEvent,
  dynamicAdmins,
};
