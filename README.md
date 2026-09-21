# 未来产业洞见系统（核聚变）

面向核聚变产业链的专利与企业洞察演示系统：FastAPI 后端 + 纯静态多页前端 + Python/Node 数据构建管线。数据源为 IncoPat 简单专利族 Excel，经统一 SQLite 库派生 9 份页面载荷 JSON，由 `/api/payload/*` 分发给前端渲染。

## 快速开始

```sh
python -m pip install -r requirements/server.txt
python scripts/serve.py            # http://127.0.0.1:8000/index.html
```

依赖大文件（不随 Git 分发，需从交付包获取放入 `data/`）：

- `data/incopat_patent_families.xlsx` 专利族源表（缺失则无法重建统一库）
- `data/enterprise_directory.xlsx` 企业总名单
- `data/shareholder_review.xlsx` 股东核验结果
- `pipeline/output/unified_patent_families.sqlite3` 统一库（可由源表重建：`python scripts/build.py --rebuild`）
- `backend/cache/*.json` 载荷缓存（可由统一库重建：启动即自动补齐）

## 目录

```
frontend/    网站页面与静态资源（HTML/CSS/JS，无数据文件）
backend/     FastAPI 服务（app、payloads 注册表、db 只读查询、snapshots 快照）
pipeline/    构建脚本链：Excel→SQLite→载荷；tools 为股东关联核验管线
analytics/   前沿主题聚类子项目（PatentBERT/DeepSeek，独立于主链）
data/        源数据 Excel（gitignore）
scripts/     serve.py 起服务 / build.py 交付校验与重建
docs/        交付说明 DELIVERY.md
manifest/    文件清单与依赖核验（SHA256）
requirements build/server/frontier 三套依赖
```

## 常用命令

| 目的 | 命令 |
| --- | --- |
| 起服务 | `python scripts/serve.py [--port 8000] [--rebuild-payloads]` |
| 完整性校验 | `python scripts/build.py --verify-files` |
| 全量重建数据 | `python scripts/build.py --rebuild`（Excel 未变时自动跳过入库） |
| API 文档 | http://127.0.0.1:8000/docs |

## Git 约定

- 大文件（数据/库/缓存）不入仓库，完整性由 manifest + SHA256 核验
- 代码重组前的原始结构保存在基线提交 `abd0541`，可 bisect/回滚
- 分支策略建议：main 保持可交付，实验在 worktree 或 feature 分支进行

详见 `docs/DELIVERY.md`。
