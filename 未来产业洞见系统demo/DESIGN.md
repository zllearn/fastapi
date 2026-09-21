---
name: "未来产业洞见系统 · 中国企业产业链布局流"
description: "在前沿主题雷达图下，以可追溯的三列河流呈现中国企业在产业链二级指标上的专利布局。"
colors:
  river-ink: "#17212f"
  river-text: "#253244"
  river-muted: "#526174"
  river-upstream: "#315c79"
  river-midstream: "#007a63"
  river-midstream-strong: "#006b57"
  river-downstream: "#8c174f"
  river-focus: "#e9632d"
  river-surface: "#ffffff"
  river-surface-tint: "#f7faff"
  river-border: "#d8e1ea"
  river-divider: "#e8edf2"
  river-other: "#98a3b0"
typography:
  headline:
    fontFamily: "Arial, Microsoft YaHei, Noto Sans CJK SC, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Arial, Microsoft YaHei, Noto Sans CJK SC, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Arial, Microsoft YaHei, Noto Sans CJK SC, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.2
  node:
    fontFamily: "Arial, Microsoft YaHei, Noto Sans CJK SC, sans-serif"
    fontSize: "10.5px"
    fontWeight: 400
    lineHeight: 1.2
rounded:
  panel: "8px"
  control-rail: "7px"
  control: "5px"
  node: "3px"
  skeleton: "4px"
spacing:
  control: "10px"
  control-gap: "8px"
  panel-edge: "18px"
  note: "11px"
components:
  enterprise-chain-river:
    backgroundColor: "{colors.river-surface}"
    textColor: "{colors.river-ink}"
    rounded: "{rounded.panel}"
    width: "min(900px, 100%)"
  river-control-active:
    backgroundColor: "{colors.river-upstream}"
    textColor: "{colors.river-surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "44px"
    padding: "7px 10px"
  river-enterprise-node:
    backgroundColor: "{colors.river-midstream}"
    textColor: "{colors.river-text}"
    typography: "{typography.node}"
    rounded: "{rounded.node}"
---

# Design System: 未来产业洞见系统 · 中国企业产业链布局流

## Overview

**Creative North Star: "可核验的产业链布局"**

本文件只记录 `frontier.html` 中已实现的“中国企业产业链布局流”。它紧接主题雷达图，以浅色、高密度的分析界面，把主题专利从时间区间连接到中国企业，再连接到产业链二级指标；它不定义或替换系统其他页面。

索引为 `schemaVersion: 3`。企业集合要求 `country === "中国"` 且机构类型不为“个人”，其余企业、高校、研究所和政府等主体类型均保留；其中私企和国企在系统展示口径中统一归并为“企业”。Top 10 / Top 30 只裁剪企业列，排名外的合格主体汇入“其他企业”；时间列与产业链指标列不受 Top 控制。

产业链二级指标取自 `family_tech.chain_level2`，排除空值和“不适用”。当前主题范围内的所有有效二级指标均完整展示，没有 Top 上限：正常主题最多16个，未归类池21个。指标先按 `chain_level1` 的上游、中游、下游分组，再按关系数和名称排序，并以分组色编码。

**Key Characteristics:**

- 固定三列拓扑为“时间区间 → 中国企业 → 产业链二级指标”；带宽表示企业—专利族关系数。
- 时间列按新到旧由上至下排列，近20年与全期口径保持一致。
- 默认近20年与 Top 30；时间范围和企业数量是两个独立按钮组。
- Top 只作用企业，其他合格企业聚合为“其他企业”；产业链二级指标永不截断或聚合。
- “其他企业”显示隐藏机构数并可下钻，按当前 Top 容量分页展示长尾企业的真实河流。
- 二级指标按上游、中游、下游分组排序并着色，右侧显示关系数。
- 除“其他企业”外，企业节点可进入画像；显示名清理与原始身份严格分离。
- 横向窄屏、键盘激活、路径高亮、可见焦点和减少动态效果是组件契约。

## Colors

冷静的蓝灰承担时间、操作与结构；上游蓝、中游绿、下游酒红形成产业链分组语义；橙色只用于键盘焦点，灰色只标识“其他企业”。

### Primary

- **上游分析蓝** (`#315c79`)：时间节点、时间→企业关系带、上游指标与上游关系带、已选控制项。

### Secondary

- **中游主体绿** (`#007a63`)：常规中国企业节点、中游指标与中游关系带。
- **中游深绿** (`#006b57`)：企业节点悬停或聚焦时的强调文字。

### Tertiary

- **下游酒红** (`#8c174f`)：下游指标、下游关系带及阻断性索引错误文案。
- **可见焦点橙** (`#e9632d`)：按钮、企业节点和图表舞台的双像素 `:focus-visible` 轮廓。

### Neutral

- **河流墨色 / 辅助蓝灰**：标题、正文、列标签、数字与方法说明。
- **白色数据面 / 轻蓝标题层**：图表舞台和头部层次。
- **结构边线 / 分隔线**：面板轮廓、标题分隔与底部注记。
- **其他企业灰** (`#98a3b0`)：只用于企业排名之外的聚合节点，不用于产业链指标。

### Named Rules

**The Three-Stage Color Rule.** 上游蓝、中游绿、下游酒红同时用于对应二级指标节点与企业→指标关系带；颜色跟随 `chain_level1`，不能按排名或主题临时重映射。

**The Visible Focus Rule.** 键盘焦点始终使用橙色双像素轮廓；舞台向内偏移3px，按钮与企业节点向外偏移2px。

## Typography

**Body Font:** Arial (with Microsoft YaHei, Noto Sans CJK SC, sans-serif fallbacks)

**Character:** 直接、技术性的无衬线排版服务于关系判读。层级由字重、字号、色彩和列对齐建立，不引入展示字体。

### Hierarchy

- **Headline** (700, 18px, 1.3): “中国企业产业链布局流”标题。
- **Body** (400, 12px, 1.55): 范围说明、空状态、错误与图表注记；头部说明最大约68ch。
- **Label** (700, 11px, 1.2): 范围和 Top 控制、列标题与关系数。
- **Node** (400, 10.5px, 1.2): 时间、企业和产业链二级指标名称；指标关系数使用 tabular numerals，指标名称加重至800。

### Enterprise-name display

- **Visible label:** 企业名称显示层统一隐藏末尾全角或半角的纯数字括号标号，例如“哈尔滨工业大学（23356）”显示为“哈尔滨工业大学”。非纯数字括号仍属于名称。
- **Identity separation:** 原始企业名继续用于索引、SVG `data-company-name`、画像 URL 查询参数与 iframe 消息；清理后的名称绝不成为身份键。

**The Display-Only Suffix Rule.** 末尾数字标号只在可见文字、标题和无障碍名称中隐藏，原始名称在查找与导航边界保持不变。

## Layout

河流位于主题雷达图正下方，宽度为 `min(900px, 100%)`。头部在桌面采用“说明 + 两个控制组”的双列布局，控制组可换行；图表从左至右固定为时间区间、中国企业、产业链二级指标三列，最右侧对齐显示每个指标的专利族关系数。

“近20年”严格生成连续20个年度节点，包含零关系年份；“全期”最多生成12个连续时间段。两种范围都按新到旧由上至下排列。企业默认 Top 30，可切换 Top 10，排名外主体并入“其他企业”。点击聚合节点后，按当前 Top 容量分页查看长尾企业，分页河流仅重算当前页企业的关系。指标列完整展示当前视图所有有效二级指标；SVG 高度按三列最大节点数增长且不低于780px。

画布宽900px、最小宽780px。窄于720px时头部改为单列，控制组保持44px最小触控高度；SVG 固定780px宽并由舞台横向浏览，三列不压缩、不改序、不堆叠。

## Elevation & Depth

该组件保持平面：白色数据面、轻蓝头部、单像素边线、节点色和半透明关系带建立层次。面板、节点与关系带没有悬浮阴影；只有固定定位的关系提示使用深色浮层与环境阴影。

### Shadow Vocabulary

- **关系提示浮层** (`0 14px 32px rgba(23, 33, 47, .22)`): 只在指向关系带时显示关系摘要、专利族数与代表专利。

**The Flat Evidence Rule.** 静止、悬停和聚焦依靠色面、文字权重与透明度，不把数据节点做成浮起卡片。

## Shapes

外层面板使用8px轻圆角；控制轨道7px、按钮5px、SVG节点3px、骨架条4px。组件不使用胶囊标签或装饰性几何；分组、交互与聚合状态由位置、语义颜色、文字和 ARIA 属性共同表达。

## Components

### Enterprise Chain River

- **Structure:** 标题、时间范围与企业数量控制、长尾分页条、可获焦图表舞台、SVG三列河流、关系提示和底部方法注记。长尾分页条仅在下钻状态显示。
- **Scope controls:** “近20年 / 全期”与“Top 10 / Top 30”是独立按钮组，选中项以实心蓝和 `aria-pressed` 表示；重绘后焦点回到刚改变的控制项。
- **Topology:** 时间→企业关系带使用蓝色半透明；企业→产业链二级指标关系带按上游蓝、中游绿、下游酒红着色。不存在可见的当前权利人列或节点。
- **Enterprise ranking:** Top 控制只排名企业；排名外合格企业统一映射为“其他企业”。聚合节点显示隐藏机构数、关系数与占比，可通过点击或键盘激活进入长尾分页，但不打开企业画像。
- **Long-tail drilldown:** 长尾企业依原排名分页，每页容量等于当前 Top 值；只绘制当前页企业及其真实时间和产业链关系，提供返回总览、上一页和下一页。切换主题、时间范围或 Top 值时回到总览。
- **Complete chain column:** 所有有效 `chain_level2` 均呈现，不设 Top 上限、不生成“其他指标”；先按上游、中游、下游分组，再按组内关系数降序和中文名称排序。
- **Chart semantics:** SVG 使用 `role="group"`、`title` 和 `desc`；舞台可获焦，并说明窄屏可左右浏览完整路径。
- **Motion and highlighting:** 指向关系带时突出同一企业对应的两段路径并显示提示；指向或聚焦企业节点时突出该企业全部路径。指向或聚焦时间节点时，按该时间内的真实记录突出其“时间→企业→指标”路径；产业链二级指标节点则反向突出对应的“时间→企业→指标”路径。其余关系带降至 `.12` 透明度。关系带过渡180ms，提示140ms；`prefers-reduced-motion: reduce` 下全部取消。

### Enterprise Node

- **Profile route:** 普通企业节点都有 `role="button"`、`tabindex="0"` 与可读 `aria-label`；点击、Enter 或 Space 以原始企业名打开画像。“其他企业”使用相同键盘激活方式进入下钻，不打开画像。独立页使用 `enterprise.html?company=<原始名称>&from=frontier`，iframe 发送 `fusion:open-enterprise`。
- **Identity:** `data-company-name` 保存原始名，显示文本、`title` 与 `aria-label` 使用隐藏末尾数字标号后的名称。
- **Highlight key:** 每个企业节点与其两段关系带共享一个内部 `data-company-id`；高亮以该单一企业键匹配。

### Industry-chain Metric Node

- **Completeness:** 只排除空值、“不适用”或缺少有效上/中/下游分组的记录；其余二级指标全部显示。
- **Grouping:** 分组顺序固定为上游→中游→下游；组内按关系数降序，再按中文名称排序。
- **Presentation:** 节点与入带使用分组色，名称加粗；右侧显示专利族关系数，`title` 同时给出二级指标和一级分组。

## Do's and Don'ts

### Do:

- **Do** 保持“时间区间 → 中国企业 → 产业链二级指标”的固定三列拓扑。
- **Do** 先以 `country === "中国"` 且机构类型不为“个人”形成合格企业集合，保留其他主体类型，再对企业应用 Top 10 / 30 与“其他企业”聚合。
- **Do** 从 `family_tech.chain_level2` 完整展示所有有效指标，排除“不适用”，并按 `chain_level1` 的上、中、下游分组排序和着色。
- **Do** 保持近20年逐年节点（含零关系年份）、全期最多12段，并始终按最新到最旧由上至下排列；同时保持窄屏横向浏览、画像路由、键盘激活、高亮和减少动态效果。
- **Do** 只在显示层隐藏企业名末尾数字标号，以原始名称承担索引和导航身份。

### Don't:

- **Don't** 加回“当前权利人”可见节点、列或中间拓扑；河流中间列只有中国企业。
- **Don't** 让 Top 10 / 30 截断产业链二级指标，也不要创建“其他指标”；有效指标必须完整展示。
- **Don't** 把非中国主体或机构类型为“个人”的主体混入“其他企业”，也不要额外过滤其他中国主体类型。
- **Don't** 让“其他企业”进入画像，也不要一次将全部长尾企业铺开或在窄屏压缩、重排三列结构。
- **Don't** 把显示名清理结果写回索引、`data-company-name`、URL 或 iframe 消息。
