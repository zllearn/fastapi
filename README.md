# 未来产业洞见系统（核聚变）

面向核聚变产业链的专利与企业洞察演示系统：FastAPI 后端 + 纯静态多页前端 + Python/Node 数据构建管线。数据源为 IncoPat 简单专利族 Excel，写入 MySQL 统一库，再派生 9 份页面载荷 JSON，由 `/api/payload/*` 分发给前端渲染。

## 快速开始

```sh
python -m pip install -r requirements/server.txt
cp .env.example .env         # 填入本机 MySQL 账号密码（Windows cmd 用 copy）
python scripts/build.py --rebuild   # 由 data/ 源表建库并生成全部载荷
python scripts/serve.py       # http://127.0.0.1:8000/index.html
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
scripts/     serve.py 起服务 / build.py 交付校验与重建 / migrate_sqlite_to_mysql.py 旧库导入
docs/        交付说明 DELIVERY.md
manifest/    文件清单与依赖核验（SHA256）
requirements build/server/frontier 三套依赖
```

## 常用命令

| 目的 | 命令 |
| --- | --- |
| 起服务 | `python scripts/serve.py [--port 8000] [--rebuild-payloads]` |
| 完整性校验 | `python scripts/build.py --verify-files` |
| 全量重建数据 | `python scripts/build.py --rebuild`（Excel 未变时自动跳过入库；入库会重建 MySQL 表） |
| 导入旧 SQLite 库 | `python scripts/migrate_sqlite_to_mysql.py --reset` |
| API 文档 | http://127.0.0.1:8000/docs |

## Git 约定

- 大文件（数据/缓存）与 `.env` 凭据不入仓库，完整性由 manifest + SHA256 核验
- 代码重组前的原始结构保存在基线提交 `abd0541`，可 bisect/回滚
- 分支策略建议：main 保持可交付，实验在 worktree 或 feature 分支进行

详见 `docs/DELIVERY.md`。
