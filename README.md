# 未来产业洞见系统（核聚变）

面向核聚变产业链的专利与企业洞察演示系统：FastAPI 后端 + 纯静态多页前端 + Python/Node 数据构建管线。数据源为 IncoPat 简单专利族 Excel，写入 MySQL 统一库，再派生 9 份页面载荷 JSON，由 `/api/payload/*` 分发给前端渲染。

## 快速开始

```sh
python -m pip install -r requirements/server.txt
cp .env.example .env         # 填入本机 MySQL 账号密码（Windows cmd 用 copy）
python scripts/build.py --rebuild   # 由 data/ 源表建库
python scripts/build_payloads.py    # 备齐 backend/cache 载荷（省略则启动时自动补齐）
python scripts/serve.py             # http://127.0.0.1:8000/index.html
```

`.env` 需给出 `MYSQL_HOST/PORT/USER/PASSWORD/DATABASE`；库不存在时重建与迁移脚本会自动 `CREATE DATABASE`。没有 MySQL 时先安装 8.0 及以上版本（已在 8.4.9 验证），字符集需支持 `utf8mb4`。手上还有旧版 SQLite 统一库的，可用 `python scripts/migrate_sqlite_to_mysql.py --reset` 直接导入，免去 Excel 入库。

访问鉴权：`/api/payload/*` 与 `/api/db/*` 需登录后访问（HttpOnly Cookie 承载 HMAC 令牌）。在 `.env` 设 `AUTH_USERNAME`/`AUTH_PASSWORD` 即启用（任一为空则关闭鉴权、放行全部请求，仅供本地调试）；`AUTH_SECRET` 建议固定（`openssl rand -hex 32`），`AUTH_TTL_HOURS` 默认 12，HTTPS 部署置 `AUTH_COOKIE_SECURE=1`。登录页在 `index.html`，公网部署前务必改掉演示口令。

依赖大文件（不随 Git 分发，需从交付包获取放入 `data/`）：

- `data/incopat_patent_families.xlsx` 专利族源表（缺失则无法重建统一库）
- `data/enterprise_directory.xlsx` 企业总名单
- `data/shareholder_review.xlsx` 股东核验结果
- `backend/cache/*.json` 载荷缓存（可由统一库重建：启动即自动补齐）

MySQL 表 `families` 等 11 张表＋2 个视图是运行态数据，由 `python scripts/build.py --rebuild` 从源表入库（约 6.8 万家族、56 万行关联数据）。

## 目录

```
frontend/    网站页面与静态资源（HTML/CSS/JS，无数据文件）
backend/     FastAPI 服务（app、database MySQL 兼容层、schema 建表、payloads 注册表、db 只读查询、snapshots 快照）
pipeline/    构建脚本链：Excel→MySQL→载荷；tools 为股东关联核验管线
analytics/   前沿主题聚类子项目（PatentBERT/DeepSeek，独立于主链）
data/        源数据 Excel（gitignore）
scripts/     serve.py 起服务 / build.py 交付校验与重建 / build_payloads.py 载荷预构建 / backup_mysql.py 备份 / migrate_sqlite_to_mysql.py 旧库导入
docs/        交付说明 DELIVERY.md
deploy/      服务器落地：nginx / systemd / mysql 参数 / 生产 .env 模板 / SERVER_SETUP.md 部署指南
manifest/    文件清单与依赖核验（SHA256）
requirements build/server/frontier 三套依赖
```

## 常用命令

| 目的 | 命令 |
| --- | --- |
| 起服务 | `python scripts/serve.py [--port 8000] [--workers 2] [--rebuild-payloads]` |
| 预构建页面载荷 | `python scripts/build_payloads.py [--rebuild] [--status] [--only 名称]` |
| 完整性校验 | `python scripts/build.py --verify-files` |
| 全量重建数据 | `python scripts/build.py --rebuild`（Excel 未变时自动跳过入库；入库会重建 MySQL 表） |
| 导入旧 SQLite 库 | `python scripts/migrate_sqlite_to_mysql.py --reset` |
| 备份数据库 | `python scripts/backup_mysql.py [--keep 7]`（mysqldump→gzip 到 `backups/`） |
| API 文档 | http://127.0.0.1:8000/docs |

## 部署前置

面向云服务器（nginx 反代 + 多 worker uvicorn）的服务端能力已内建：访问日志、版本化 `Cache-Control`、跨进程构建锁、服务端会话鉴权、MySQL 低权限账号与逻辑备份。

**完整上线步骤（选型规格 → 系统初始化 → 建库 → systemd/nginx/HTTPS → 验收清单）见 `deploy/SERVER_SETUP.md`**，可直接安装的配置在 `deploy/`：

| 文件 | 用途 |
| --- | --- |
| `deploy/nginx/future-industry-insight.conf` | HTTPS + 域名反代（预压缩载荷的超时/缓冲、登录 `limit_req`、安全响应头） |
| `deploy/nginx/future-industry-insight.intranet.conf` | 无域名/未备案过渡：纯 HTTP，仅限内网或 VPN |
| `deploy/systemd/future-industry-insight.service` | 应用服务（绑 `127.0.0.1`、`--workers 2`、目录权限白名单） |
| `deploy/systemd/…-backup.service` / `.timer` | 每日 02:30 `backup_mysql.py --keep 14` |
| `deploy/systemd/…-rebuild.service` | 按需重建载荷（oneshot，不配 timer） |
| `deploy/mysql/future-industry-insight.cnf` | buffer pool 等参数（整库 907MB 驻留内存） |
| `deploy/env.production.example` | 生产 `.env` 模板（鉴权/代理头/账号逐项注释） |

细节与取舍说明见 `docs/DELIVERY.md`：

- **访问日志**：每个请求打印 `IP 方法 路径 状态 耗时 字节 UA`；经 nginx 时置 `TRUST_PROXY_HEADERS=1` 才取 `X-Forwarded-For` 首跳，`ACCESS_LOG=0` 可关。
- **缓存头**：带 `?v=` 的静态资源 `immutable` 长缓存，HTML `no-cache`，载荷 `private, must-revalidate`（配 ETag 命中 304）。
- **多 worker**：`scripts/serve.py --workers N`（Windows 与 Linux 均可；须固定 `AUTH_SECRET`）；`payloads.py` 用跨进程文件锁 + 按进程号唯一的临时文件，上线前用 `scripts/build_payloads.py --rebuild` 预构建载荷。
- **数据库账号**：`scripts/mysql_provision_user.sql` 建只读运行账号 `fii_runtime` 与库级构建账号 `fii_build` 取代 root。
- **备份**：`scripts/backup_mysql.py` 逻辑备份为 `.sql.gz`（约 118MB/份），配 systemd timer 定期执行，务必再留一份异机副本。

## Git 约定

- 大文件（数据/缓存）与 `.env` 凭据不入仓库，完整性由 manifest + SHA256 核验
- 代码重组前的原始结构保存在基线提交 `abd0541`，可 bisect/回滚
- 分支策略建议：main 保持可交付，实验在 worktree 或 feature 分支进行

详见 `docs/DELIVERY.md`。
