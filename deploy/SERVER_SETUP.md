# 服务器部署指南

把本项目部署到一台 Linux 云服务器（或内网机器）上对外提供访问。按顺序执行即可，命令针对 Ubuntu 22.04 / 24.04；Debian 12 一致，仅包名与 `mysql` 源略有差异。

本文所有容量/带宽数字来自 2026-10-08 本机实测：统一库数据+索引 907 MB（11 张表 + 2 个视图，6.8 万专利族）、逻辑备份 118 MB、载荷未压缩 214 MB + 快照 5 MB、预压缩旁路合计 38.9 MB（最大单文件 `derwent-dashboard.json.gz` 24.5 MB）。

## 0. 机器规格

| | 最低可用（1–3 人自用） | 推荐（10 人内并发 / 会在服务器上重建） |
| --- | --- | --- |
| CPU | 2 vCPU | 4 vCPU |
| 内存 | 4 GB + 2 GB swap | 8 GB |
| 系统盘 | 40 GB SSD | 80 GB SSD |
| 带宽 | 5 Mbps 或按量计费 | 10–30 Mbps / 按量峰值 |
| 参考月费 | ¥60–120 | ¥250–500（带宽另计） |

带宽决定体验而非 CPU：载荷是流式返回（`FileResponse`），单请求内存恒定，瓶颈在下发速度。最重的一页要下 24.5 MB。

| 带宽 | 单页首访 | 全部载荷 38.9 MB |
| --- | --- | --- |
| 5 Mbps（0.625 MB/s） | ≈ 41 秒 | ≈ 62 秒 |
| 10 Mbps | ≈ 21 秒 | ≈ 31 秒 |
| 30 Mbps | ≈ 3.4 秒 | ≈ 5.1 秒 |
| 按量 100 Mbps | ≈ 1 秒 | ≈ 1.6 秒 |

登录后重复访问命中 ETag/304 与 `immutable` 静态缓存，几乎不再产生流量，所以"按量峰值带宽 + 流量包"通常比买断固定带宽划算。

## 1. 采购前要先定的两件事

- **节点与备案**：中国大陆节点的 80/443 对外提供网页需要 ICP 备案（周期 1–3 周）；不想备案就选中国香港/新加坡节点，或用内网/VPN 方式访问（对应 `deploy/nginx/future-industry-insight.intranet.conf`）。
- **域名与证书**：Let's Encrypt 只签域名，不签裸 IP。有域名才走 HTTPS 版配置。

安全组/防火墙只放行 `22`（建议限定来源 IP）、`80`、`443`。**不要**放行 `8000`（应用）和 `3306`（MySQL）——应用只绑 `127.0.0.1`，全部对外访问经 nginx。

## 2. 系统初始化

```sh
ssh root@服务器IP
apt update && apt -y install git curl ca-certificates ufw unzip
adduser --system --home /opt/future-industry-insight --shell /usr/sbin/nologin fii

# 内存 ≤ 4 GB 时补 swap，防止重建载荷时 OOM
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
timedatectl set-timezone Asia/Shanghai
```

## 3. 运行环境

MySQL 用 8.0 及以上（本项目在 8.4.9 验证；不要用 5.7——`utf8mb4_bin`、窗口函数与 SQL 模式有差异）。

```sh
# MySQL：用发行版自带 server 即可（Ubuntu 24.04 为 8.0.x；需要 8.4 就加官方 APT 源，
# 见 dev.mysql.com 的 "MySQL APT Repository"，本项目在 8.4.9 上验证过）
apt -y install mysql-server mysql-client
mysql_secure_installation

# Node 20（enterprise-insights 的构建器是 node 脚本，缺它 build 会直接报依赖错误）
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt -y install nodejs

# Python + 虚拟环境
apt -y install python3-venv python3-pip nginx certbot python3-certbot-nginx
mkdir -p /opt/future-industry-insight && chown fii:fii /opt/future-industry-insight
```

MySQL 服务参数按 `deploy/mysql/future-industry-insight.cnf` 调整（buffer pool 让整库驻留内存、关 binlog 省磁盘）：

```sh
sudo cp deploy/mysql/future-industry-insight.cnf /etc/mysql/conf.d/
sudo systemctl restart mysql
mysql -u root -p -e "SHOW VARIABLES LIKE 'innodb_buffer_pool_size';"
```

## 4. 取代码与数据

```sh
cd /opt && sudo -u fii git clone https://github.com/zllearn/fastapi.git future-industry-insight
cd future-industry-insight
sudo -u fii python3 -m venv .venv
sudo -u fii .venv/bin/pip install -r requirements/server.txt -r requirements/build.txt
```

仓库不含大文件（见根目录 `.gitignore`），必须自己传上来，否则构建与校验都会失败（`data/` 目录本身也不在仓库里，要先建）：

```sh
# 服务器上
sudo mkdir -p /opt/future-industry-insight/data

# 本地（D:\future_industry_insight）执行
scp data/incopat_patent_families.xlsx data/enterprise_directory.xlsx data/shareholder_review.xlsx \
    root@服务器IP:/opt/future-industry-insight/data/
scp analytics/incopat_run/incopat_simple_families_topic_indicators.xlsx \
    root@服务器IP:/opt/future-industry-insight/analytics/incopat_run/

# 服务器上：把归属交回运行用户
sudo chown -R fii:fii /opt/future-industry-insight
```

`backend/snapshots/*.json`（frontier-dashboard / verified-events / world-map 三份快照载荷）随 Git 分发，无需另传。`backend/cache/` 不在仓库内，由第 8 步生成。

## 5. 配置 `.env`

后端与构建脚本都只从项目根目录的 `.env` 读连接参数与口令，**建库之前必须先有它**。

```sh
cd /opt/future-industry-insight
cp deploy/env.production.example .env
chmod 600 .env
nano .env
```

先填 `MYSQL_*`：这台机器上刚 `mysql_secure_installation` 完、还没建专用账号时，`MYSQL_USER` 暂时填 `root`（第 7 步换掉）。另外三处最容易出错：

- `AUTH_USERNAME`/`AUTH_PASSWORD` 必须填，且**不要沿用仓库文档里出现过的演示口令**；任一为空则鉴权整体关闭、`/api/payload/*` 放行。
- `AUTH_SECRET` 必须固定（`openssl rand -hex 32`）。留空 = 每次启动随机，多 worker 之间密钥不同，登录后会随机 401；重启也会让所有会话失效。
- `TRUST_PROXY_HEADERS=1`：走 nginx 就必须开，否则登录失败锁定会把所有用户记在 `127.0.0.1` 同一个桶里（一人输错、全员被锁 5 分钟）。

`AUTH_COOKIE_SECURE=1` 留到证书签好之后再打开（见第 10 步）。

## 6. 建库：两条路径选一条

**A. 从本机备份恢复（快，且与本地数据完全一致，推荐）**

```sh
# 本地：先出一份当前快照
python scripts/backup_mysql.py
scp backups/<最新>.sql.gz root@服务器IP:/tmp/

# 服务器
gunzip -c /tmp/<最新>.sql.gz | mysql -u root -p
rm /tmp/<最新>.sql.gz          # 别把带数据的文件留在 /tmp
```

备份文件里含建库语句，会重建 `future_industry_insight` 库。

**B. 从 Excel 全量重建**（数据源就是那三份 Excel 时）

```sh
sudo -u fii .venv/bin/python scripts/build.py --rebuild
```

两条路径都只填 MySQL，页面载荷统一在第 8 步生成。路径 B 耗时较长（读整份专利族 Excel 入库）。任一路径做完都校验一下：

```sh
mysql -u root -p -e "SELECT COUNT(*) FROM future_industry_insight.families;"   # 期望约 68151
```

## 7. 建低权限账号，弃用 root

运行态只需要 SELECT，写库只发生在构建脚本里。

```sh
# 先把脚本里的两个占位口令改成强口令（nano /opt/future-industry-insight/scripts/mysql_provision_user.sql），再执行
mysql -u root -p < /opt/future-industry-insight/scripts/mysql_provision_user.sql
mysql -u root -p -e "SHOW GRANTS FOR 'fii_runtime'@'localhost';"
```

`.env` 里用 `fii_runtime`；只有在跑 `scripts/build.py --rebuild` 或迁移脚本时才临时换 `fii_build`，跑完换回。`scripts/backup_mysql.py` 用 `fii_runtime` 即可（已授 `SELECT`、`LOCK TABLES`、`SHOW VIEW`、`TRIGGER`，配合 `--single-transaction` 足够）。

## 8. 预构建载荷

```sh
sudo -u fii .venv/bin/python scripts/build_payloads.py --rebuild
sudo -u fii .venv/bin/python scripts/build_payloads.py --status
```

上线前主动跑完，首个访问者就不用承担构建耗时；多 worker 下也避免各进程抢着构建（`payloads.py` 已有跨进程文件锁兜底，但预构建更省时间）。脚本会逐份打印耗时——首次部署记录一次，作为日后重建的时长参考。产物是 `backend/cache/<名称>.json` + 同名 `.json.gz` 旁路，服务端按 `Accept-Encoding` 协商返回。

## 9. systemd 接管

```sh
sudo chown -R fii:fii /opt/future-industry-insight
sudo cp deploy/systemd/future-industry-insight.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now future-industry-insight
systemctl status future-industry-insight --no-pager
curl -s http://127.0.0.1:8000/api/health | head -c 200
```

worker 数在 unit 的 `--workers` 上改（2C 用 2，4C 用 3–4）。日志：`journalctl -u future-industry-insight -f`，应用自身的 `[access]` 行就在里面；改用 nginx 日志后可在 `.env` 置 `ACCESS_LOG=0`。

按需重建载荷（数据变化后）：

```sh
sudo cp deploy/systemd/future-industry-insight-rebuild.service /etc/systemd/system/ && sudo systemctl daemon-reload
sudo systemctl start future-industry-insight-rebuild     # oneshot，不常驻
```

## 10. nginx 与 HTTPS

有域名（中国大陆节点请先完成备案）：

```sh
# a) 先签第一张证书。standalone 方式要占 80 端口，所以先停 nginx——
#    这样能避开"配置引用了还不存在的证书、nginx -t 通不过"的死循环。
sudo mkdir -p /var/www/certbot
sudo systemctl stop nginx
sudo certbot certonly --standalone -d 你的域名

# b) 装本配置（文件里 443 段的证书路径要和你拿到的 /etc/letsencrypt/live/<域名>/ 一致）
sudo cp deploy/nginx/future-industry-insight.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/future-industry-insight.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nano /etc/nginx/sites-available/future-industry-insight.conf   # 改 server_name 与证书路径
sudo nginx -t && sudo systemctl start nginx

# c) 之后续期走 webroot，不停机（配置里已留 /.well-known/acme-challenge/）
printf 'authenticator = webroot\nwebroot-path = /var/www/certbot\n' | sudo tee /etc/letsencrypt/cli.ini
sudo certbot renew --dry-run
```

证书签好之后，把 `.env` 的 `AUTH_COOKIE_SECURE=1` 打开并 `sudo systemctl restart future-industry-insight`，否则浏览器不会回传 Cookie（表现为"登录成功但接口仍 401"）。

没有域名 / 未备案的过渡期用 `deploy/nginx/future-industry-insight.intranet.conf`（纯 HTTP，只限内网或 VPN，公网裸 HTTP 会明文传口令）。

## 11. 备份计划

```sh
sudo cp deploy/systemd/future-industry-insight-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start future-industry-insight-backup.service     # 先手动验证一次
systemctl list-timers future-industry-insight-backup.timer
```

默认每天 02:30 跑 `scripts/backup_mysql.py --keep 14`，输出到 `backups/`（不入 Git）。**备份和库在同一块盘上等于没备份**：至少再加一份异机副本，例如每晚 `rsync` 到对象存储或另一台机器。

## 12. 上线验收清单

| 检查 | 命令 | 期望 |
| --- | --- | --- |
| 未登录取数据 | `curl -i https://域名/api/payload/atlas-dashboard` | `401` |
| 健康检查开放 | `curl https://域名/api/health` | `status ok`，`auth.enabled: true` |
| 错口令达阈值 | 用错口令连续登录 | 触发 `429`（应用内 5 次/5 分钟；多 worker 时约为 worker 数 × 5），且日志里 IP 是真实来源而非 `127.0.0.1` |
| 正确登录 | `curl -i -c /tmp/j -H 'Content-Type: application/json' -d '{"username":"…","password":"…"}' https://域名/api/auth/login` | `200`，`Set-Cookie` 含 `HttpOnly`、HTTPS 下含 `Secure` |
| 登录后取数据 | `curl -b /tmp/j -H 'Accept-Encoding: gzip' -D - -o /dev/null https://域名/api/payload/atlas-dashboard` | `200`，`content-encoding: gzip`，`etag` 带 `-gz` |
| 二次访问 | 同上再加 `-H 'If-None-Match: <上一步 etag>'` | `304`，无响应体 |
| 应用端口不外露 | 本地 `curl -m 5 http://服务器IP:8000/api/health` | 超时/拒绝，不是 200 |
| 会话跨重启有效 | 登录 → `sudo systemctl restart future-industry-insight` → 刷新页面 | 仍是登录态（依赖固定 `AUTH_SECRET`） |
| 载荷就绪 | `curl https://域名/api/health` 看 `payloads` | 全部 `ready`，无 `stale-or-missing` |

浏览器端再做一次：登录页输入口令后应跳进首页并渲染数据；F12 控制台执行
`fetch('/api/payload/frontier-index').then(r => console.log(r.status))`，登录态 `200`、退出登录后 `401`。

## 13. 日常运维

**更新代码**

```sh
cd /opt/future-industry-insight
sudo -u fii git pull --ff-only
sudo -u fii .venv/bin/pip install -r requirements/server.txt
sudo systemctl restart future-industry-insight
# 数据有变化时再跑： sudo systemctl start future-industry-insight-rebuild
```

**恢复备份**（会覆盖同名库，执行前确认目标实例）

```sh
gunzip -c backups/<文件>.sql.gz | mysql -u root -p
```

**换登录口令**：改 `.env` 的 `AUTH_PASSWORD` 后重启服务即可。注意 HMAC 令牌里不含口令，**改口令不会让已签发的会话立刻失效**；需要立刻踢掉所有在线会话时，同时更换 `AUTH_SECRET` 并重启（代价是所有人要重新登录）。

**磁盘**：`backend/cache` 约 470 MB（`.json` 214 + 中间 `.js` 224 + `.json.gz` 38）、`backups` 每份约 118 MB × 14 份 ≈ 1.7 GB、MySQL datadir 约 1.2 GB。加上系统与日志，40 GB 起步够用，`df -h` 定期看一眼。

## 14. 已知取舍

- **静态页面不单独鉴权**：登录页在 `index.html`，未登录时必须可达，否则没人能登录；HTML/JS/CSS 里不含授权数据。未登录直接打开子页面时前端会显示"等待登录"并轮询重试。
- **不走 nginx `gzip_static` 直读磁盘**：那样等于绕开 `/api/payload/*` 的服务端鉴权，把授权数据变成可枚举的公开文件。当前由后端鉴权后用 `FileResponse` 流式发送现成的 `.json.gz`，nginx 侧 `gzip off`，不做二次压缩。若将来确实要用 nginx 直发，必须配 `auth_request` 子请求校验会话 Cookie。
- **载荷用 `private, max-age=0, must-revalidate`**：安全优先，每次新会话都要向服务端再验证一次（命中 304 时不传体）。
- **多 worker 下登录锁定阈值约为 worker 数 × 5 次**：应用内计数是进程内的，暴力破解的全局兜底交给 nginx 的 `limit_req`（见配置里的 `zone=fii_login`）。
- **暂时不要挂公共 CDN**：数据来自 IncoPat 授权，公开缓存会把鉴权拆掉。确需加速请先做签名回源。
- **手机端瘦身方案（载荷切片/流式解析/IndexedDB）暂不实施**：部署目标以电脑端为主。
