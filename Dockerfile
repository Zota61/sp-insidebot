# 使用 Node.js 18 作為基礎
FROM node:18

# 設定工作目錄
WORKDIR /app

# 複製 package.json 並安裝依賴
COPY package.json package-lock.json ./
RUN npm install

# 複製所有程式碼
COPY . .

# 設定環境變數（可用 Cloud Run 設定）
ENV PORT=8080

# 允許外部存取的埠號
EXPOSE 8080

# 啟動 Bot
CMD ["node", "index.js"]
