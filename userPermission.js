'use strict';

const DEVELOPER_USER_ID = process.env.DEVELOPER_USER_ID;
const handleUserPermission = (userMessage, userId, dynamicAdmins) => {
  let result;

  // **處理管理員相關指令**
  if (userMessage === '查看管理者' || userMessage === '3️⃣ 查看管理者') {
    if (!dynamicAdmins.has(userId)) {
      return '❌ 你沒有權限查看管理者。';
    }

    const adminList = Array.from(dynamicAdmins)
      .map((admin, index) => `#${index + 1} - ${admin}`)
      .join('\n');
    return `👮‍♂️ **目前管理員列表**：\n${adminList || '⚠️ 尚無管理員'}`;
  }

  // **新增管理員（限開發者）**
  if (
    userMessage.startsWith('新增管理 ') ||
    userMessage.startsWith('4️⃣ 新增管理 ')
  ) {
    if (userId !== DEVELOPER_USER_ID) {
      return '❌ 你沒有權限新增管理員。';
    }

    const parts = userMessage.split(' ');
    if (parts.length < 2) {
      return '⚠️ 格式錯誤！請使用「新增管理 {UserID}」';
    }

    const newAdminId = parts[1];
    if (dynamicAdmins.has(newAdminId)) {
      return '⚠️ 該使用者已經是管理員！';
    }

    dynamicAdmins.add(newAdminId);
    return `✅ 已成功新增管理員：${newAdminId}`;
  }

  // **移除管理員（限開發者）**
  if (
    userMessage.startsWith('移除管理 ') ||
    userMessage.startsWith('5️⃣ 移除管理 ')
  ) {
    if (userId !== DEVELOPER_USER_ID) {
      return '❌ 你沒有權限移除管理員。';
    }

    const parts = userMessage.split(' ');
    if (parts.length < 2) {
      return '⚠️ 格式錯誤！請使用「移除管理 {UserID}」';
    }

    const removeAdminId = parts[1];
    if (!dynamicAdmins.has(removeAdminId)) {
      return '⚠️ 該使用者不是管理員！';
    }

    dynamicAdmins.delete(removeAdminId);
    return `✅ 已成功移除管理員：${removeAdminId}`;
  }

  // **查看自己的 LINE User ID**
  if (userMessage === '我的ID' || userMessage === '6️⃣ 我的ID') {
    return `👤 **你的 LINE User ID**：\n${userId}`;
  }

  return result;
};

module.exports = {handleUserPermission};
