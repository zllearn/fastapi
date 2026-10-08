# 未来产业洞见系统 · 项目交付

本包包括当前完整网站（FastAPI 前后端分离）、数据生成管线、正式源数据、前沿主题指标和股东关联核验快照。以当前已回填技术/地区/企业标签的专利 Excel 为起点；不包含重新抓取 IncoPat、人工企业校准或付费模型重新打标的上游实验工程。

快速上手与目录总览见根目录 `README.md`。

## 运行（FastAPI 服务）

```sh
python -m pip install -r requirements/server.txt
cp .env.example .env           # 填入本机 MySQL 账号密码
python scripts/serve.py            # http://127.0.0.1:8000/index.html
```

网站数据由 `backend/` 的 FastAPI 服务从 MySQL 统一库派生的载荷缓存经 `/api/payload/*` 提供给前端，不再以内联 JS 随页面分发。MySQL 连接只从 `.env`（或同名环境变量）读取，密码不入仓库；库内表结构由 `backend/schema.py` 单点定义。首次启动自动校验 `data/` 源表并在后台补齐缺失的载荷缓存（`backend/cache/`；页面右下角显示"数据构建中"直至就绪）。`python scripts/serve.py --rebuild-payloads` 强制重建全部载荷。API 一览见 `http://127.0.0.1:8000/docs`：`/api/auth/login|logout|session`（服务端会话鉴权）、`/api/payload/<名称>`（9 个页面载荷）、`/api/db/meta|stats|families/<家族ID>`（统一库实时查询）、`/api/health`。

frontier 页原 2.7MB 内联 JSON 与消费脚本已外置（`backend/snapshots/frontier-dashboard.json`、`frontend/assets/frontier/frontier-app.js`）。旧的纯静态直开方式（原 `启动网站.py`）已随静态载荷一并移除。

站点已启用服务端会话鉴权：`/api/payload/*` 与 `/api/db/*` 均需登录（否则 401），登录后由 HttpOnly Cookie 承载 HMAC 签名令牌（默认有效期 12h）。账号密码只在 `.env` 配置（`AUTH_USERNAME`/`AUTH_PASSWORD`），任一为空则鉴权关闭并放行全部请求（仅供本地无凭据调试，公网部署前必须设置，并务必改掉演示口令）。会话签名密钥 `AUTH_SECRET` 建议固定（`openssl rand -hex 32`），留空则每次启动随机生成、重启后所有会话失效、多进程部署不可用。登录接口对同一来源连续失败 5 次锁定 5 分钟（429）。静态页面（HTML/JS/CSS）不含授权数据、不单独鉴权，未登录直接打开子页面时 `api-preload.js` 会提示"等待登录"并轮询重试，登录成功后自动续跑。`AUTH_COOKIE_SECURE=1` 用于 HTTPS 部署（Cookie 仅经加密连接下发）。

`/api/payload/*` 按 `Accept-Encoding` 协商返回预压缩旁路文件（构建/写入载荷时自动生成同名 `.json.gz`，全量 229MB 约压至 41MB），并带 ETag + `Vary: Accept-Encoding`，二次访问命中 304 不再传体。旁路 `.gz` 属可再生产物，不入 Git、不入交付清单。

## 部署前置改进

服务内能力与 `deploy/` 配置均已就绪，端到端的服务器落地步骤（选型规格、系统与依赖安装、数据与建库两条路径、账号与 `.env`、预构建、systemd、nginx/HTTPS、备份、上线验收清单）见 `deploy/SERVER_SETUP.md`。

- **访问日志中间件**：`backend/app.py` 对每个请求打印一行 `IP "方法 路径?查询" 状态 耗时ms 字节B "UA"`。客户端 IP 默认取直连地址；经 nginx 反代时在 `.env` 置 `TRUST_PROXY_HEADERS=1`，改取 `X-Forwarded-For` 首跳（该头可由客户端自报，只在信任的代理后面打开）。为降噪，静态资源（`.js/.css/.png/.woff2` 等）与 `/api/health` 不记录；页面 `.html` 与所有 `/api/*`（含载荷下载）会记录，可据此排查远程访问"谁下了多少数据、耗时多久"。`serve.py` 已关闭 uvicorn 自带访问日志避免重复；设 `ACCESS_LOG=0` 可整体关闭（如改用 nginx 日志）。
- **缓存策略（Cache-Control）**：带版本查询参数（`?v=...`，前端每次改动都换）的静态资源返回 `public, max-age=31536000, immutable`，浏览器长期缓存不再回源；HTML 与无版本资源返回 `no-cache`（每次经 ETag 再验证）；`/api/payload/*` 返回 `private, max-age=0, must-revalidate`（因需鉴权、且随重建变化，只允许私有缓存并每次再验证，命中 304 不重传大体积载荷）。
- **多 worker 构建锁**：`backend/payloads.py` 原用进程内 `threading.Lock`，多 worker（`uvicorn --workers N`）下各进程会重复构建同一载荷、并可能因共享 `.tmp` 目标而互相踩踏。现改为跨进程文件锁（`backend/cache/.<name>.lock`，`O_CREAT|O_EXCL` 原子独占 + 陈旧锁破除，兼容 Windows/POSIX），且临时文件改为按进程号唯一（`<name>.json.<pid>.tmp`），即便锁被破也不会写坏产物。**上线预构建用 `python scripts/build_payloads.py --rebuild`**（这个脚本才真正填 `backend/cache`；`build.py --rebuild` 只重建统一库与 `pipeline/output` 的中间产物），把载荷备齐再起多 worker，运行态就不触发构建、彻底规避锁竞争。
- **反向代理与进程数**：`scripts/serve.py` 与 `backend/app.py` 支持 `--workers N`（多进程须固定 `AUTH_SECRET`）。登录失败锁定按客户端 IP 计数，因此 `TRUST_PROXY_HEADERS` 必须与代理层匹配，否则 nginx 之后所有用户共用 `127.0.0.1` 一个桶（一人输错、全员被锁）。多 worker 下各进程计数独立，全局暴力破解兜底由 nginx `limit_req` 承担。
- **部署文件**：`deploy/` 内有可直接安装的配置——`nginx/`（HTTPS 与内网 HTTP 两版反代，含预压缩载荷的超时/缓冲与登录限流）、`systemd/`（应用服务 + 每日备份 service/timer + 按需重建 service）、`mysql/future-industry-insight.cnf`（buffer pool 等参数）、`env.production.example`（生产 `.env` 模板）、`SERVER_SETUP.md`（从选型到验收清单的完整步骤）。nginx 侧不对 `.json.gz` 用 `gzip_static` 直发：那会绕开 `/api/payload/*` 的服务端鉴权；现方案是后端鉴权后用 `FileResponse` 流式发送旁路文件，不做二次压缩。
- **MySQL 专用低权限账号**：`scripts/mysql_provision_user.sql` 建两个库级账号取代 root——`fii_runtime`（只读 + 允许 mysqldump，服务运行与备份用）与 `fii_build`（库级 DDL/DML，仅构建/迁移时用）。改好占位口令后 `mysql -u root -p < scripts/mysql_provision_user.sql`，再把 `.env` 的 `MYSQL_USER/MYSQL_PASSWORD` 指向 `fii_runtime`；跑构建脚本时临时切到 `fii_build`。root 不再被应用持有。
- **数据库备份**：`python scripts/backup_mysql.py [--keep N] [--output-dir DIR]` 调 `mysqldump --single-transaction` 导出为 gzip 的 `backups/<库>_<UTC时间>.sql.gz`（约 118MB，含建库建表与数据），口令经临时 defaults 文件传入不进命令行。`mysqldump` 不在 PATH 时用环境变量 `MYSQLDUMP_PATH` 指定。恢复：`gunzip -c backups/<file>.sql.gz | mysql -u root -p`。`backups/` 已 gitignore。上线后建议配 cron/计划任务定期备份并异地留存。


## 目录结构（2026-09-21 重组后）

| 路径 | 用途 |
| --- | --- |
| frontend/ | HTML、CSS、JS、图片、地图/图表库；含最新精简版股东可能关联专利展示 |
| backend/ | FastAPI 服务：app/config/database（MySQL 兼容层）/schema（建表与外键）/db/payloads + snapshots（随包快照数据）+ tools；cache 为可再生载荷缓存 |
| pipeline/ | 全部构建脚本（统一库、图谱、技术演进、企业画像/名录、主题索引）；tools 为股东关联所需脚本；output 为生成产物与核验报告 |
| data/ | 正式专利（incopat_patent_families.xlsx）、企业名单（enterprise_directory.xlsx）、股东结果（shareholder_review.xlsx）三个源表，仅维护端使用 |
| analytics/ | 主题聚类/指标和上游页面生成代码、当前主题工作簿、已生成主题文本 |
| scripts/ | 入口：serve.py（起服务，支持 `--workers`）、build.py（交付校验/重建统一库）、build_payloads.py（预构建 backend/cache 载荷）、backup_mysql.py（逻辑备份）、mysql_provision_user.sql（低权限账号）、migrate_sqlite_to_mysql.py（把旧版 SQLite 统一库导入 MySQL） |
| docs/ | 本交付说明 |
| deploy/ | 服务器落地：nginx 反代（HTTPS/内网 HTTP 两版）、systemd service/timer、MySQL 参数片段、生产 `.env` 模板、SERVER_SETUP.md 部署指南 |
| manifest/ | delivery_manifest.json/.csv（每文件用途与 SHA256）、dependency_check.json（本地资源核验） |
| requirements/ | build.txt / server.txt / frontier.txt 三套依赖 |

数据文件（data/、载荷缓存、pipeline/output）不入 Git，`.env` 凭据同样不入 Git（只提交 `.env.example`），见 `.gitignore`；代码与前端资源由 Git 跟踪。统一库存放在 MySQL 中，不是包内文件。

## 重建与检查

Python 3.10+、Node.js（当前构建代码不需要 npm 安装）、MySQL 8.0+（已在 8.4.9 验证，需 utf8mb4）。建议创建新虚拟环境，不复制开发机虚拟环境。

```sh
python -m pip install -r requirements/build.txt
python scripts/build.py --verify-files
python scripts/build.py --rebuild
```

不带 `--rebuild` 默认只检查。完整重建会覆盖生成数据；Git 基线提交可作为恢复点。统一库现在是 MySQL 中的 11 张表加 2 个视图（约 6.8 万专利族、56 万行），`--rebuild` 会先 `DROP` 再重建这些表并入库，因此**只对可丢弃的开发库执行**；已交付的旧版 SQLite 库（`pipeline/output/unified_patent_families.sqlite3`，约 500MB，中间产物、不入 Git）可用 `python scripts/migrate_sqlite_to_mysql.py --reset` 原样导入，导入脚本会逐表比对行数、外键孤儿与中文字段往返。入库完成后 `--rebuild --skip-unified` 可复用 MySQL 数据只重建载荷。

股东前端单独刷新：`python scripts/build.py --shareholders-only`。它从 20260916 核验报告生成，不会自动核验人员身份、校准企业名或确认权属迁移。报告中 XLSX、两个 CSV 和 JSON 是现有构建脚本的实际输入，不是旧版本备份。

重新做股东同名匹配时，先完整构建统一库，再从 pipeline 目录运行 `python tools/match_shareholder_patents.py`，随后运行 `python tools/build_shareholder_frontend.py --date 20260916`。匹配范围/名称校准使用随包 20260916 快照；增量更新时须同步更新这些快照和脚本日期。

## 前沿主题更新边界

常规重建使用随包主题工作簿更新主题—企业产业链索引；保留 `frontier.html` 内已有的聚类指标、文案和人工升级后的界面，不用旧模板覆盖新页面。

如需重新聚类，提供了 `dedup_patentbert_topic_cluster_score.py` 和所需模块。先安装 `requirements/frontier.txt`，通过 `pipeline/export_frontier_input.py --help` 从统一库导出输入；将 `FUSION_TOPIC_BASE_DIR` 设置为包内 analytics 的绝对路径，再查看聚类脚本 `--help` 指定输入/输出。模型权重需另行下载，结果受模型、参数和依赖版本影响，不保证重跑后主题编号不变。采用 `--local-topic-summaries` 可避免外部文字模型调用。

`make_topic_dashboard.py` 是上游原始页面生成器，使用 `--no-interpret` 可禁止 API 调用。输出到临时 HTML 后，只迁移其 `id="dashboard-data"` JSON 数据到 `backend/snapshots/frontier-dashboard.json`，再重建企业索引；不要直接覆盖已升级页面。

## 保留与排除原则

保留页面实际引用的全部运行资源以及当前构建的依赖代码/输入。排除虚拟环境、字节码、历史归档、旧压缩包、重复数据库、旧打标缓存、实验截图、联网检索日志及五个明确未使用的旧界面/图片文件（详见 manifest/dependency_check.json）。图表库、地图数据不是冗余，不能按文件体积删除。

数据包包含原始专利与企业核验资料，交付给获授权的项目接收方。未包含 API 密钥、浏览器登录状态或开发机环境。联网新闻/参考文章属于外部跳转；本站展示数据、图表和图片均为本地资源。

当前统计与原始输入口径以代码和核验报告为准；候选股东专利始终不并入企业自有专利、地图、排名和产业链统计。交付仅做整理、可移植入口与依赖检查，未借机重新计算或改变现有网站数据。
