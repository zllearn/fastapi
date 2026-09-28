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

## 目录结构（2026-09-21 重组后）

| 路径 | 用途 |
| --- | --- |
| frontend/ | HTML、CSS、JS、图片、地图/图表库；含最新精简版股东可能关联专利展示 |
| backend/ | FastAPI 服务：app/config/database（MySQL 兼容层）/schema（建表与外键）/db/payloads + snapshots（随包快照数据）+ tools；cache 为可再生载荷缓存 |
| pipeline/ | 全部构建脚本（统一库、图谱、技术演进、企业画像/名录、主题索引）；tools 为股东关联所需脚本；output 为生成产物与核验报告 |
| data/ | 正式专利（incopat_patent_families.xlsx）、企业名单（enterprise_directory.xlsx）、股东结果（shareholder_review.xlsx）三个源表，仅维护端使用 |
| analytics/ | 主题聚类/指标和上游页面生成代码、当前主题工作簿、已生成主题文本 |
| scripts/ | 入口：serve.py（起服务）、build.py（交付校验/重建）、migrate_sqlite_to_mysql.py（把旧版 SQLite 统一库导入 MySQL） |
| docs/ | 本交付说明 |
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
