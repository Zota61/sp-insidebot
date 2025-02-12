## git

1. git clone <<url>>  download專案 (once)
  私人專案 > 使用者名稱 跟 access_token  (https://github.com/settings/tokens)



2. ssh to gcp server 
```
sudo su (root)
```
3. pull github to google server 
```
git pull origin master 
```

3-1. update local project to github
```
git push origin master
```

4. go to path 
```
cd /<<path>>
```


## gcp

> 啟動新的 server need open firewall port 


有更新的話 Visual 要註記更新內容 打勾後再 用CTRL+~叫出提示窗 輸入指令git push
然後到虛擬機內輸入git pull
虛擬機下載完檔案後 輸入Github使用者帳戶名稱 
輸入github使用者密碼(需要去github官網看CODE或存記事本)
輸入指令docker-compose up --build -d 
要看LOG的話再輸入docker logs -f linebot-nodejs

進入SSH後
cd projects   //進入專案資料夾
cd cd sp-insidebot    //進入資料夾 
sudo su root    //進入超級使用者權限 後就可以輸入指令了 

註冊 Cloudflare（Cloudflare 官網）
安裝 Cloudflare Tunnel
bash
複製
編輯
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/
登入 Cloudflare
bash
複製
編輯
cloudflared login
建立 Tunnel
bash
複製
編輯
cloudflared tunnel create my-tunnel
運行 Tunnel
bash
複製
編輯
cloudflared tunnel --url http://127.0.0.1:8080
之後，Cloudflare 會給你一個免費的 HTTPS 地址，例如：

lua
複製
編輯
https://random-string.trycloudflare.com