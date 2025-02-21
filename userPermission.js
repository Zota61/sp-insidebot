'use strict';
const handleGetUserId = (userMessage, userId) => {
  // **查看自己的 LINE User ID**
  if (userMessage === '我的ID' || userMessage === '6️⃣ 我的ID') {
    return `👤 **你的 LINE User ID**：\n${userId}`;
  }
};

module.exports = {handleGetUserId};
