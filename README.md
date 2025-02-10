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


git push
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