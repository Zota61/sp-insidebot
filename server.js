// 最新版本，修復 Rich Menu 並確保功能正常運作

require('dotenv').config();
const express = require('express');
const line = require("@line/bot-sdk");
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// **環境變數檢查**
const requiredEnv = ["LINE_ACCESS_TOKEN", "LINE_CHANNEL_SECRET", "DB_HOST", "DB_USER", "DB_PASS", "DB_NAME", "DB_PORT", "DEVELOPER_USER_ID", "ADMIN_USER_IDS"];
const missingEnv = requiredEnv.filter(env => !process.env[env]);

if (missingEnv.length > 0) {
    console.error(`❌ 缺少環境變數: ${missingEnv.join(', ')}`);
    process.exit(1);
}

// **管理者名單**
const DEVELOPER_USER_ID = process.env.DEVELOPER_USER_ID;
const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS.split(',');
let dynamicAdmins = new Set(ADMIN_USER_IDS);

dynamicAdmins.add(DEVELOPER_USER_ID);

// **LINE Bot 設定**
const config = {
    channelAccessToken: process.env.LINE_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET
};
const client = new line.Client(config);

// **MySQL 連線池**
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


const moment = require('moment'); // 確保已安裝 moment.js 來處理日期格式
// **設定 Rich Menu**
async function handleEvent(event) {
    try {
        if (event.type !== 'message' || event.message.type !== 'text') {
            return;
        }
        const userMessage = event.message.text.trim();
        console.log('📩 收到訊息:', userMessage);
        const userId = event.source.userId;
                // 🔹 新增設備
if (userMessage === "新增設備") {
    return replyToUser(event.replyToken,
        `📌 新增設備請使用以下格式：
         新增設備 設備編號 設備狀態(可選填) 運轉時數(必填) 時間(可選填) 地點(可選填)
         - 設備狀態未填寫則預設為「回庫」
         - 時間未填寫則預設為當前時間
         - 地點未填寫則預設為「倉庫」
         例：新增設備 100K-3 出庫 1500H 2029/07/09 台北大佳河濱公園`
    );
}

if (userMessage.startsWith("新增設備 ")) {
    if (!dynamicAdmins.has(userId)) {
        return replyToUser(event.replyToken, "❌ 你沒有權限新增設備。");
    }

    const parts = userMessage.split(" ");
    if (parts.length < 3) {
        return replyToUser(event.replyToken, "⚠️ 格式錯誤，請使用「新增設備」獲取正確格式！");
    }

    const deviceId = parts[1];
    let runHours = parts[2] ? parts[2].replace(/\D/g, "") : null; // 確保即使 parts[3] 不存在，也能解析
    const status = "回庫"; // 預設值
    const time = new Date().toISOString().split("T")[0]; // 預設當前時間
    const location = "倉庫"; // 預設地點

    if (!runHours || runHours.trim() === "" || isNaN(parseInt(runHours))) {
        return replyToUser(event.replyToken, "❌ 請輸入正確的運轉時數，例如 1500H（系統將自動忽略 H）。");
    }


     try {
        await db.query(
    	`INSERT INTO 設備資料表 (設備編號, 設備狀態, 運轉時數, 日期, 使用地點) 
     	VALUES (?, ?, ?, ?, ?)
     	ON DUPLICATE KEY UPDATE 
     	設備狀態 = VALUES(設備狀態), 
     	運轉時數 = VALUES(運轉時數), 
     	日期 = VALUES(日期), 
     	使用地點 = VALUES(使用地點)`,
    	[deviceId, status, runHours, time, location]
	);
        return replyToUser(event.replyToken, `✅ 設備 ${deviceId} 已成功新增或更新！`);
    } catch (error) {
        console.error("❌ 新增設備錯誤:", error);
        return replyToUser(event.replyToken, `❌ 新增設備失敗，錯誤碼: ${error.code}`);
    }
}

// 🔹 更新設備
if (userMessage === "更新設備") {
    return replyToUser(event.replyToken,
        `📌 更新設備請使用以下格式：
         更新設備 設備編號 設備狀態(可選填) 運轉時數(可選填) 時間(可選填) 地點(可選填)
         - 未填寫的欄位將保留原本的值
         例：更新設備 100K-3 出庫 1600H 2029/08/15 新北市`
    );
}

if (userMessage.startsWith("更新設備 ")) {
    if (!dynamicAdmins.has(userId)) {
        return replyToUser(event.replyToken, "❌ 你沒有權限更新設備。");
    }

    const parts = userMessage.split(" ");
    if (parts.length < 2) {
        return replyToUser(event.replyToken, "⚠️ 格式錯誤，請使用「更新設備」獲取正確格式！");
    }

    const deviceId = parts[1];
    const status = parts[2] || null;
    let runHours = parts[3] || null;
    const time = parts[4] || null;
    const location = parts[5] || null;

    try {
        const [rows] = await db.query("SELECT * FROM 設備資料表 WHERE 設備編號 = ?", [deviceId]);

        if (rows.length === 0) {
            return replyToUser(event.replyToken, `❌ 設備 ${deviceId} 不存在，請先新增設備！`);
        }

        const updateFields = [];
        const updateValues = [];

        if (status) {
            updateFields.push("設備狀態 = ?");
            updateValues.push(status);
        }
        if (runHours) {
            runHours = runHours.replace(/\D/g, "")

            updateFields.push("運轉時數 = ?");
            updateValues.push(runHours);
        }
        if (time) {
            updateFields.push("日期 = ?");
            updateValues.push(time);
        }
        if (location) {
            updateFields.push("使用地點 = ?");
            updateValues.push(location);
        }

        if (updateFields.length === 0) {
            return replyToUser(event.replyToken, "⚠️ 沒有提供更新內容！");
        }

        updateValues.push(deviceId);

        await db.query(
            `UPDATE 設備資料表 SET ${updateFields.join(", ")} WHERE 設備編號 = ?`,
            updateValues
        );

        return replyToUser(event.replyToken, `✅ 設備 ${deviceId} 已成功更新！`);
    } catch (error) {
        console.error("❌ 更新設備錯誤:", error);
        return replyToUser(event.replyToken, "❌ 更新設備失敗，請稍後再試。");
    }
}

// 🔹 移除設備
if (userMessage === "移除設備") {
    return replyToUser(event.replyToken,
        `📌 移除設備請使用以下格式：
         移除設備 設備編號
         例：移除設備 100K-3`
    );
}

if (userMessage.startsWith("移除設備 ")) {
    if (!dynamicAdmins.has(userId)) {
        return replyToUser(event.replyToken, "❌ 你沒有權限移除設備。");
    }

    const parts = userMessage.split(" ");
    if (parts.length < 2) {
        return replyToUser(event.replyToken, "⚠️ 格式錯誤，請使用「移除設備」獲取正確格式！");
    }

    const deviceId = parts[1];

    try {
        const [result] = await db.query("DELETE FROM 設備資料表 WHERE 設備編號 = ?", [deviceId]);
        if (result.affectedRows > 0) {
            return replyToUser(event.replyToken, `✅ 設備 ${deviceId} 已成功移除！`);
        } else {
            return replyToUser(event.replyToken, "❌ 找不到該設備，無法移除。");
        }
    } catch (error) {
        console.error("❌ 移除設備錯誤:", error);
        return replyToUser(event.replyToken, "❌ 移除設備失敗，請稍後再試。");
    }
}

        // **🔹 查詢設備列表**
        if (userMessage === "查看設備列表") {
            console.log("🛠️ 進入 查看設備列表 判斷");

            if (!dynamicAdmins.has(userId)) {
                console.log("🚫 你沒有管理員權限");
                return replyToUser(event.replyToken, "❌ 你沒有權限查看設備列表。");
            }

            try {
                const [rows] = await db.query("SELECT DISTINCT 設備編號 FROM 設備資料表");
                console.log("📊 查詢結果:", rows);

                const deviceList = rows.map(row => row.設備編號).join('\n');
                return replyToUser(event.replyToken, deviceList ? `📋 設備列表：\n${deviceList}` : "📋 目前沒有設備資料。");
            } catch (error) {
                console.error("❌ 資料庫查詢錯誤:", error);
                return replyToUser(event.replyToken, "⚠️ 伺服器發生錯誤，請稍後再試。");
            }
        }

        // **功能指引**
        if (userMessage === "輸入範本") {
            return replyToUser(event.replyToken, "請輸入以下格式：\n1.設備編號: 例100K-3\n2.設備狀態: 例出庫, 回庫, 更換第一道柴油, 保養完成\n3.當前運轉時數: 例1000H\n4.日期: 例2029/07/09\n5.使用地點: 例台北大佳河濱公園");
        }

        if (userMessage === "功能選單") {
            return replyToUser(event.replyToken, "📋 功能選單：\n1️⃣ 查詢設備\n2️⃣ 查看設備列表（管理員限定）\n3️⃣ 我的 ID");
        }
        // **檢查管理員權限**
        const isAdmin = dynamicAdmins.has(userId);

        

        // **解析設備回報格式**
        const reportPattern = /^(\S+)\s+(\S+)\s+(\d+)\s*H?\s+(\d{4}\/\d{2}\/\d{2})\s+(.+)$/;
        const match = userMessage.match(reportPattern);

        if (match) {
            const [_, equipmentId, status, currentHours, date, location] = match;
            console.log(match, "match")
            const currentHoursNum = parseInt(currentHours, 10);

            try {
                // **查詢設備的上次保養紀錄**
                const [rows] = await db.query(
                    "SELECT 上次保養時間, 上次保養時數, 柴油更換狀態, 第一道柴油是否更換 FROM 設備資料表 WHERE 設備編號 = ?",
                    [equipmentId]
                );

                if (!rows || rows.length === 0) {
                    return replyToUser(event.replyToken, `❌ 找不到設備：${equipmentId}，請先新增設備！`);
                }

                const { 上次保養時間: lastMaintenanceDate, 上次保養時數: lastMaintenanceHours,  第一道柴油是否更換 } = rows[0] || {};
                const lastMaintenanceHoursNum = parseInt(lastMaintenanceHours, 10) || 0;

                let replyMessage = `✅ 設備回報成功！\n📌 設備編號: ${equipmentId}\n📅 日期: ${date}\n🏠 地點: ${location}\n🔄 設備狀態: ${status}\n⏳ 當前運轉時數: ${currentHours}H`;

                if (lastMaintenanceDate && lastMaintenanceDate !== "未知") {
    		const formattedMaintenanceDate = moment(lastMaintenanceDate).format("YYYY/MM/DD HH:mm:ss");
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
                    [equipmentId, status, currentHoursNum, date, location]
                );

                // **提醒機制：只在柴油更換狀態為 0 時提醒**
                const hourDiff = currentHoursNum - lastMaintenanceHoursNum;

                if (hourDiff >= 450) {
                    replyMessage += `\n⚠️ 提醒：設備 **${equipmentId}** 需要 **大保養**，已運轉 **${hourDiff}H**。		\n請保養完成後回報 **保養完成** 以解除提醒。`;
                } else if (hourDiff >= 250 
                    &&  第一道柴油是否更換 === 0
                ) { // 只有當柴油未更換時才提醒
                    replyMessage += `\n⚠️ 提醒：設備 **${equipmentId}** 需要 **更換第一道柴油**，已運轉 **			${hourDiff}H**。\n請更換完畢後回報 **更換第一道柴油** 以解除提醒。`;
                }
// **當使用者回報"更換第一道柴油"，則更新柴油更換狀態**
if (status === "更換第一道柴油") {
    try {
        await db.query(
            "UPDATE 設備資料表 SET 第一道柴油是否更換 = 1 WHERE 設備編號 = ?",
            [equipmentId]
        );
        replyMessage += `\n✅ **更換第一道柴油** 完成，提醒已解除。`;
    } catch (error) {
        console.error("❌ 更新柴油更換狀態時發生錯誤:", error);
        return replyToUser(event.replyToken, "⚠️ 更新柴油更換狀態失敗，請稍後再試。");
    }
}
// **當使用者回報"保養完成"，重置柴油更換狀態**
if (status === "保養完成") {
    try {
        // 確保設備存在
        const [deviceRows] = await db.query(
            "SELECT 設備編號, 上次保養時數 FROM 設備資料表 WHERE 設備編號 = ?",
            [equipmentId]
        );

        if (!deviceRows || deviceRows.length === 0) {
            return replyToUser(event.replyToken, `❌ 找不到設備 ${equipmentId}，請確認設備編號是否正確！`);
        }

        const lastMaintenanceHours = parseInt(deviceRows[0].上次保養時數, 10) || 0;

        // 確保新的運轉時數比上次保養時數高，避免錯誤回報
        if (currentHoursNum < lastMaintenanceHours) {
            return replyToUser(event.replyToken, `⚠️ 異常回報！當前運轉時數 (${currentHoursNum}H) 低於上次保養時數 (${lastMaintenanceHours}H)，請確認後重新輸入。`);
        }

        // 格式化時間
        const formattedDate = moment(date).format("YYYY/MM/DD HH:mm:ss");

        // **更新設備的上次保養時間、運轉時數，並重置柴油更換狀態**
        await db.query(
            "UPDATE 設備資料表 SET 上次保養時間 = ?, 上次保養時數 = ?, 柴油更換狀態 = 0 WHERE 設備編號 = ?",
            [date, currentHoursNum, equipmentId]
        );

        // 建立回覆訊息
        replyMessage += `\n✅ **保養完成**，系統已更新設備資訊！`;
        replyMessage += `\n📅 新的上次保養時間：${formattedDate}`;
        replyMessage += `\n⏳ 新的上次保養時數：${currentHoursNum}H`;
        replyMessage += `\n🔄 **更換第一道柴油提醒已重置，下一次 250H 後將重新觸發提醒！**`;

    } catch (error) {
        console.error("❌ 更新保養紀錄時發生錯誤:", error);
        return replyToUser(event.replyToken, "⚠️ 更新保養資訊失敗，請稍後再試。");
    }
}
// **更換第一道柴油提醒**
if (status === "更換第一道柴油") {
    try {
        await db.query(
            "UPDATE 設備資料表 SET  第一道柴油是否更換 = 1 WHERE 設備編號 = ?",
            [equipmentId]
        );
        replyMessage += `\n✅ **更換第一道柴油** 完成，提醒已解除。`;
    } catch (error) {
        console.error("❌ 更新柴油更換狀態時發生錯誤:", error);
        return replyToUser(event.replyToken, "⚠️ 更新柴油更換狀態失敗，請稍後再試。");
    }
}
console.log("status = ", status)

        // **如果格式錯誤，提示正確格式**
        return replyToUser(event.replyToken, "⚠️ 格式錯誤，請依照範本輸入！\n範例：100K-3 出庫 1200H 2029/07/09 台北大佳河濱公園");

    } catch (error) {
        console.error("❌ LINE 訊息處理錯誤:", error);
    }
}

} catch (error) {
    console.error("設備回報錯誤：", error);
    return "❌ 發生錯誤，請稍後再試！";
}} 
async function processEquipmentReport(userMessage, userId) {
    try {
        // 解析使用者輸入，例如："100K-3 回庫 1000H 20250207 台北"
        let parts = userMessage.split(" ");
        if (parts.length < 4) {
            return "❌ 格式錯誤！請使用格式：\n設備編號 狀態 運轉時數 日期(可省略) 地點\n範例：100K-3 回庫 1000H 20250207 台北";
        }

        let [equipmentId, status, runtime, date, location] = parts;

        // 如果日期缺少，自動補上今天的日期
        if (!date || !moment(date, "YYYYMMDD", true).isValid()) {
            date = moment().format("YYYYMMDD"); // 設定為當天日期
        }

        // 檢查設備狀態是否合法
        const validStatuses = ["出庫", "回庫", "更換第一道柴油", "保養完成"];
        if (!validStatuses.includes(status)) {
            return "❌ 錯誤！設備狀態必須是：「出庫」、「回庫」、「更換第一道柴油」、「保養完成」";
        }

        // 運轉時數檢查
        let runtimeHours = parseInt(runtime.replace("H", ""), 10);
        if (isNaN(runtimeHours)) {
            return "❌ 錯誤！運轉時數必須是數字 + H，例如 1000H";
        }
 

        // 查詢設備的上次保養紀錄
        const query = "SELECT last_maintenance_time, last_maintenance_hours, 柴油更換狀態 FROM 設備資料表 WHERE 設備編號 = ?";
        const [lastMaintenanceRows] = await db.query(query, [equipmentId]);

        let lastMaintenanceTime = "未知";
        let lastMaintenanceHours = 0;
        let dieselChangeStatus = 0; // 預設為 0（尚未更換）

        if (lastMaintenanceRows.length > 0) {
            lastMaintenanceTime = lastMaintenanceRows[0].last_maintenance_time || "未知";
            lastMaintenanceHours = lastMaintenanceRows[0].last_maintenance_hours || 0;
            dieselChangeStatus = lastMaintenanceRows[0]["柴油更換狀態"] ?? 0; // 防止 undefined 錯誤
        }


        // 計算距離上次保養的時數
        let hoursSinceLastMaintenance = runtimeHours - (lastMaintenanceHours || 0);

        // 確保設備存在，否則請先新增
	const [equipmentRows] = await db.query("SELECT * FROM 設備資料表 WHERE 設備編號 = ?", [equipmentId]);

        if (!equipmentRows || equipmentRows.length === 0) {
            return `❌ 設備 ${equipmentId} 不存在，請先新增設備。`;
        }

	// 如果設備存在，則更新設備狀態、運轉時數、日期、使用地點
	const updateQuery = `
            UPDATE 設備資料表
            SET 設備狀態 = ?, 運轉時數 = ?, 日期 = ?, 使用地點 = ?, user_id = ?
            WHERE 設備編號 = ?
        `;
        await db.query(updateQuery, [status, runtimeHours, date, location, userId ?? null, equipmentId]);

        // 回傳回應
        return `✅ 設備 ${equipmentId} 更新成功！\n📌 狀態：${status}\n⏳ 運轉時數：${runtimeHours}H\n📅 日期：${date}\n📍 地點：${location}\n\n📌 上次保養：${lastMaintenanceTime}\n🛠️ 距離保養：${hoursSinceLastMaintenance}H`;

    } catch (error) {
        console.error("設備回報錯誤：", error);
        return "❌ 發生錯誤，請稍後再試！";
    }
}

async function replyToUser(replyToken, message) {
    try {
        await client.replyMessage(replyToken, { type: "text", text: message });
    } catch (error) {
        console.error('❌ LINE 訊息回覆錯誤:', error);
    }
}



app.post('/webhook', line.middleware(config), async (req, res) => {
    try {
        if (!req.body.events || req.body.events.length === 0) {
            return res.sendStatus(200);
        }

        try {
            await Promise.all(req.body.events.map(event => handleEvent(event).catch(err => console.error("❌ 處理單個事件時錯誤:", err))));
            return res.sendStatus(200);  // Correct placement of return statement
        } catch (err) {
            console.error("❌ Webhook 處理錯誤:", err);
            return res.sendStatus(500);
        }
    } catch (err) {
        console.error("❌ Webhook 處理錯誤:", err);
        res.sendStatus(500);
    }
});

app.listen(PORT, () => {
    console.log(`🚀 伺服器運行中，監聽 ${PORT} 端口`);
});
