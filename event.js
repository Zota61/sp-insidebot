'use strict';

const moment = require('moment');
const {handleUserPermission, handleGetUserId} = require('./userPermission');
const {replyToUser} = require('./linebot');
const {
  LinebotSignin,
  CreatePlatformDevice,
  GetPlatformDeviceByDeviceNo,
  UpdatePlatformDevice,
  DeletePlatformDevice,
} = require('./api');
const {HttpStatusCode} = require('axios');

const helperText =
  '📋 功能選單：\n1️⃣ 設備回報-輸入 範本可參考回報格式\n2️⃣ 查詢設備\n3️⃣ 新增設備\n4️⃣ 移除設備\n5️⃣ 更新設備\n6️⃣ 我的ID ';

const handleEvent = async event => {
  try {
    if (event.type !== 'message' || event.message.type !== 'text') {
      return;
    }
    if (!event.source.userId) {
      return;
    }
    const userMessage = event.message.text.trim();
    const userId = event.source.userId;

    const [user, singinStatus] = await LinebotSignin({
      userId,
      type: event.source.type,
      groupId: event.source.groupId,
    });
    if (singinStatus !== HttpStatusCode.Ok) {
      return replyToUser(event.replyToken, JSON.stringify(user));
    }
    const token = user.data.token;
    console.log('📩 收到訊息:', userMessage);

    // const isAdmin = dynamicAdmins.has(userId);
    // const resultUserPermission = await handleUserPermission(
    //   userMessage,
    //   userId,
    //   dynamicAdmins,
    // );
    // if (resultUserPermission) {
    //   return replyToUser(event.replyToken, resultUserPermission);
    // }
    // switch (true) {
    //   case userMessage.startsWith('新增設備 ') && !isAdmin:
    //   case userMessage.startsWith('更新設備 ') && !isAdmin:
    //   case userMessage.startsWith('移除設備 ') && !isAdmin:
    //   case userMessage === '查看設備列表' && !isAdmin:
    //     return replyToUser(event.replyToken, '❌ 你沒有權限');
    // }

    const resultUserPermission = await handleGetUserId(userMessage, userId);
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
         - 設備狀態有回庫，出庫，保養完成，更換第一道柴油
         - 時間未填寫則預設為當前時間
         - 地點未填寫則預設為「倉庫」
         例：新增設備 100K-3 出庫 1500H 2029/07/09 台北大佳河濱公園`,
      );
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

      const [getPlatformDevice, getDeviceStatus] =
        await GetPlatformDeviceByDeviceNo(deviceId, token);
      if (
        getDeviceStatus !== HttpStatusCode.Ok &&
        getPlatformDevice.code !== 4095
      ) {
        return replyToUser(
          event.replyToken,
          `❌ 新增設備失敗: ${JSON.stringify(getPlatformDevice)}`,
        );
      }

      let lastMaintenanceTime = null; // 預設為 null
      let lastMaintenanceHours = 0; // 預設為 0
      if (getPlatformDevice) {
        lastMaintenanceTime = getPlatformDevice.lastMaintenanceDate || null;
        lastMaintenanceHours = getPlatformDevice.lastMaintenanceHours || 0;
      }

      if (
        getDeviceStatus !== HttpStatusCode.Ok &&
        getPlatformDevice.code === 4095
      ) {
        const [createPlatformDeviceData, createPlatformDeviceStatus] =
          await CreatePlatformDevice(
            {
              deviceId,
              status,
              runHours,
              date: time,
              location,
            },
            token,
          );
        if (createPlatformDeviceStatus !== HttpStatusCode.Ok) {
          console.error(JSON.stringify(createPlatformDeviceData));
          return replyToUser(
            event.replyToken,
            `❌ 新增設備失敗，錯誤碼: ${JSON.stringify(
              createPlatformDeviceData,
            )}`,
          );
        }
        return replyToUser(
          event.replyToken,
          `✅ 設備 ${deviceId} 已成功新增或更新！`,
        );
      } else {
        const [updatePlatformDevice, updateStatus] = await UpdatePlatformDevice(
          getPlatformDevice.data.id,
          {
            status,
            runHours,
            date: time,
            location,
            deviceId,
          },
          token,
        );

        if (updateStatus !== HttpStatusCode.Ok) {
          return replyToUser(
            event.replyToken,
            `❌ 更新設備失敗，錯誤碼: ${JSON.stringify(updatePlatformDevice)}`,
          );
        }

        let hoursSinceLastMaintenance = runHours - (lastMaintenanceHours || 0);
        return replyToUser(
          event.replyToken,
          `✅ 設備 ${deviceId} 更新成功！\n📌 狀態：${status}\n⏳ 運轉時數：${runHours}H\n📅 日期：${time}\n📍 地點：${location}\n\n📌 上次保養時間：${
            lastMaintenanceTime
              ? moment(lastMaintenanceTime).format('YYYY/MM/DD')
              : null
          }\n📌 上次保養時數：${lastMaintenanceHours}\n🛠️ 距離保養：${hoursSinceLastMaintenance}H`,
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
        const [getPlatformDevice, getPlatformDeviceStatus] =
          await GetPlatformDeviceByDeviceNo(deviceId, token);

        if (
          getPlatformDeviceStatus !== HttpStatusCode.Ok &&
          getPlatformDevice.code === 4095
        ) {
          return replyToUser(
            event.replyToken,
            `❌ 設備 ${deviceId} 不存在，請先新增設備！`,
          );
        } else if (getPlatformDeviceStatus !== HttpStatusCode.Ok) {
          return replyToUser(
            event.replyToken,
            `❌ 設備更新查找錯誤 ${JSON.stringify(getPlatformDevice)}`,
          );
        }

        if (runHours) {
          runHours = runHours.replace(/\D/g, '');
        }
        if (prevMaintainanceTime) {
          prevMaintainanceTime = prevMaintainanceTime.replace(/\D/g, '');
        }

        const [updatePlatformDevice, updatePlatformDeviceStatus] =
          await UpdatePlatformDevice(
            getPlatformDevice.data.id,
            {
              location,
              status,
              lastMaintenanceDate: prevMaintainanceDate,
              lastMaintenanceHours: prevMaintainanceTime,
              runHours,
              date: time,
            },
            token,
          );
        if (updatePlatformDeviceStatus !== HttpStatusCode.Ok) {
          return replyToUser(
            event.replyToken,
            `❌ 更新設備失敗，錯誤碼: ${JSON.stringify(updatePlatformDevice)}`,
          );
        }

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
        const [getPlatformDevice, getPlatformDeviceStatus] =
          await GetPlatformDeviceByDeviceNo(deviceId, token);

        if (
          getPlatformDeviceStatus !== HttpStatusCode.Ok &&
          getPlatformDevice.code === 4095
        ) {
          return replyToUser(
            event.replyToken,
            `❌ 設備 ${deviceId} 不存在，請先新增設備！`,
          );
        } else if (getPlatformDeviceStatus !== HttpStatusCode.Ok) {
          return replyToUser(
            event.replyToken,
            `❌ 設備查找錯誤 ${JSON.stringify(getPlatformDevice)}`,
          );
        }

        const [deletePlatformDevice, deletePlatformDeviceStatus] =
          await DeletePlatformDevice(getPlatformDevice.data.id, token);
        if (deletePlatformDeviceStatus !== HttpStatusCode.Ok) {
          return replyToUser(
            event.replyToken,
            `❌ 設備刪除錯誤 ${JSON.stringify(deletePlatformDevice)}`,
          );
        }
        return replyToUser(
          event.replyToken,
          `✅ 設備 ${deviceId} 已成功移除！`,
        );
      } catch (error) {
        console.error('❌ 移除設備錯誤:', error);
        return replyToUser(event.replyToken, '❌ 移除設備失敗，請稍後再試。');
      }
    }

    // 📌 查詢設備
    // 🔹 新增設備
    if (userMessage === '查詢設備') {
      return replyToUser(
        event.replyToken,
        `📌 查詢設備請使用以下格式：
         查詢設備 設備編號
         例：查詢設備 100K-3`,
      );
    }

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
        const [getPlatformDevice, getPlatformDeviceStatus] =
          await GetPlatformDeviceByDeviceNo(equipmentId, token);

        if (
          getPlatformDeviceStatus !== HttpStatusCode.Ok &&
          getPlatformDevice.code === 4095
        ) {
          return replyToUser(
            event.replyToken,
            `❌ 設備 ${deviceId} 不存在，請先新增設備！`,
          );
        } else if (getPlatformDeviceStatus !== HttpStatusCode.Ok) {
          return replyToUser(
            event.replyToken,
            `❌ 設備查找錯誤 ${JSON.stringify(getPlatformDevice)}`,
          );
        }

        const device = getPlatformDevice.data;
        const formattedDate = moment(device.updatedAt).format('YYYY/MM/DD');
        const lastMaintenance = device.lastMaintenanceDate
          ? moment(device.lastMaintenanceDate).format('YYYY/MM/DD')
          : '未知';

        const message =
          `📋 **設備資訊**\n` +
          `📌 設備編號：${device.deviceNo}\n` +
          `🔄 設備狀態：${device.status || '未知'}\n` +
          `⏳ 當前運轉時數：${device.runHours}H\n` +
          `📅 記錄日期：${formattedDate}\n` +
          `🏠 位置：${device.location || '未知'}\n` +
          `🛠️ 上次保養時間：${lastMaintenance}\n` +
          `🛠️ 第一道柴油是否更換：${device.isFirstDieselReplaced}\n` +
          `⏳ 上次保養時數：${device.lastMaintenanceHours || 0}H`;

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
      return replyToUser(event.replyToken, helperText);
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
        const [getPlatformDevice, getPlatformDeviceStatus] =
          await GetPlatformDeviceByDeviceNo(equipmentId, token);

        if (
          getPlatformDeviceStatus !== HttpStatusCode.Ok &&
          getPlatformDevice.code === 4095
        ) {
          return replyToUser(
            event.replyToken,
            `❌ 設備 ${equipmentId} 不存在，請先新增設備！`,
          );
        } else if (getPlatformDeviceStatus !== HttpStatusCode.Ok) {
          return replyToUser(
            event.replyToken,
            `❌ 設備查找錯誤 ${JSON.stringify(getPlatformDevice)}`,
          );
        }

        const {lastMaintenanceDate, lastMaintenanceHours} =
          getPlatformDevice.data;
        const lastMaintenanceHoursNum = parseInt(lastMaintenanceHours, 10) || 0;

        // 確保新的運轉時數比上次保養時數高，避免錯誤回報
        if (currentHoursNum < lastMaintenanceHoursNum) {
          return replyToUser(
            event.replyToken,
            `⚠️ 異常回報！當前運轉時數 (${currentHoursNum}H) 低於上次保養時數 (${lastMaintenanceHoursNum}H)，請確認後重新輸入。`,
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

        if (lastMaintenanceHoursNum) {
          replyMessage += `\n⏳ 上次保養時數: ${lastMaintenanceHoursNum}H`;
        }

        // **提醒機制：只在柴油更換狀態為 0 時提醒**
        const hourDiff = currentHoursNum - lastMaintenanceHoursNum;
        let note;
        if (hourDiff >= 450) {
          note = `${hourDiff}H`;
          replyMessage += `\n⚠️ 提醒：設備 **${equipmentId}** 需要 **大保養**，已運轉 **${hourDiff}H**。		\n請保養完成後回報 **保養完成** 以解除提醒。`;
        } else if (
          hourDiff >= 250 &&
          getPlatformDevice.data?.isFirstDieselReplaced === false
        ) {
          // 只有當柴油未更換時才提醒
          note = `${hourDiff}H`;
          replyMessage += `\n⚠️ 提醒：設備 **${equipmentId}** 需要 **更換第一道柴油**，已運轉 **			${hourDiff}H**。\n請更換完畢後回報 **更換第一道柴油** 以解除提醒。`;
        }

        // **當使用者回報"保養完成"，重置柴油更換狀態**
        if (status === '保養完成') {
          try {
            // 格式化時間
            const formattedDate = moment(date).format('YYYY/MM/DD');

            const [updatePlatformDevice, updatePlatformDeviceStatus] =
              await UpdatePlatformDevice(
                getPlatformDevice.data.id,
                {
                  status,
                  runHours: currentHoursNum,
                  date,
                  location,
                  lastMaintenanceDate: formattedDate,
                  lastMaintenanceHours: currentHoursNum,
                  isFirstDieselReplaced: false,
                },
                token,
              );
            if (updatePlatformDeviceStatus !== HttpStatusCode.Ok) {
              return replyToUser(
                event.replyToken,
                `❌ 更新設備失敗，錯誤碼: ${JSON.stringify(
                  updatePlatformDevice,
                )}`,
              );
            }

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
          const [updatePlatformDevice, updatePlatformDeviceStatus] =
            await UpdatePlatformDevice(
              getPlatformDevice.data.id,
              {
                status,
                runHours: currentHoursNum,
                date,
                location,
                isFirstDieselReplaced: true,
              },
              token,
            );
          if (updatePlatformDeviceStatus !== HttpStatusCode.Ok) {
            return replyToUser(
              event.replyToken,
              `❌ 更新設備失敗，錯誤碼: ${JSON.stringify(
                updatePlatformDevice,
              )}`,
            );
          }
          replyMessage += `\n✅ **更換第一道柴油** 完成，提醒已解除。`;
          return replyToUser(event.replyToken, replyMessage);
        }
        if (status === '出庫' || status === '回庫') {
          const [updatePlatformDevice, updatePlatformDeviceStatus] =
            await UpdatePlatformDevice(
              getPlatformDevice.data.id,
              {
                status,
                runHours: currentHoursNum,
                date,
                location,
                note,
              },
              token,
            );
          if (updatePlatformDeviceStatus !== HttpStatusCode.Ok) {
            return replyToUser(
              event.replyToken,
              `❌ 更新設備失敗，錯誤碼: ${JSON.stringify(
                updatePlatformDevice,
              )}`,
            );
          }

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
};
