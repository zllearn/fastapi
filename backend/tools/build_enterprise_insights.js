"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

// Backend copy of pipeline/build_enterprise_insights.js; takes explicit input/output paths.
const dataPath = process.argv[2];
const outputPath = process.argv[3];
if (!dataPath || !outputPath) throw new Error("usage: build_enterprise_insights.js <dashboard-data.js> <output.js>");
const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(dataPath, "utf8"), context, { filename: dataPath });

const dashboard = context.window.DASHBOARD_DATA;
const generatedAt = new Date().toISOString();
const generatedDate = generatedAt.slice(0, 10);
const yearMax = Number(dashboard.meta.yearMax || new Date().getFullYear());
const recentStart = yearMax - 4;
const previousStart = recentStart - 5;
const primaryCompanies = (dashboard.enterprise?.companies || []).filter(company =>
  (Array.isArray(company.countries) ? company.countries : [company.countries]).includes("中国")
);
const fallbackCompanies = (dashboard.enterprise?.directoryFallbackCompanies || []).filter(company =>
  (Array.isArray(company.countries) ? company.countries : [company.countries]).includes("中国")
);
const companies = [...new Map([
  ...fallbackCompanies.map(company => [company.name, company]),
  ...primaryCompanies.map(company => [company.name, company])
]).values()];

const splitLabels = value => String(value || "").split(/[；;]+/).map(item => item.trim()).filter(Boolean);
const isUsableLabel = label => !["不适用", "未标注", "缺失", "未知"].includes(label);
const countLabels = (patents, field) => {
  const counts = new Map();
  patents.forEach(patent => splitLabels(patent[field]).filter(isUsableLabel)
    .forEach(label => counts.set(label, (counts.get(label) || 0) + 1)));
  const total = [...counts.values()].reduce((sum, value) => sum + value, 0);
  return [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"))
    .map(([label, count]) => ({ label, count, share: total ? Number((count / total).toFixed(4)) : 0 }));
};
const countChains = patents => {
  const counts = { "上游": 0, "中游": 0, "下游": 0, "不适用": 0 };
  patents.forEach(patent => splitLabels(patent.chain1).forEach(label => {
    if (label in counts) counts[label] += 1;
  }));
  return counts;
};
const scoreInputs = patents => {
  const chain2 = countLabels(patents, "chain2");
  const chain3 = countLabels(patents, "chain3");
  const recent = patents.filter(patent => Number(patent.year) >= recentStart).length;
  const citations = patents.reduce((sum, patent) => sum + Number(patent.citedBy || 0), 0);
  return { count: patents.length, chain2, chain3, recent, citations };
};

const benchmarkInputs = primaryCompanies.map(company => ({ company, ...scoreInputs(company.patents || []) }));
const allInputs = companies.map(company => ({ company, ...scoreInputs(company.patents || []) }));
const maxCount = Math.max(1, ...benchmarkInputs.map(item => item.count));
const maxCitations = Math.max(1, ...benchmarkInputs.map(item => item.citations));
const scoreFor = ({ count, chain2, chain3, recent, citations }) => {
  if (!count) return 0;
  const scale = Math.log1p(count) / Math.log1p(maxCount);
  const diversity = Math.min(chain3.length / Math.min(Math.max(count, 1), 10), 1);
  const breadth = Math.min(chain2.length / 5, 1);
  const activity = recent / count;
  const influence = Math.log1p(citations) / Math.log1p(maxCitations);
  return Number(Math.min(100, 20 + scale * 28 + diversity * 22 + breadth * 13 + activity * 10 + influence * 7).toFixed(2));
};
const scored = allInputs.map(item => ({ ...item, score: scoreFor(item) }));
const sortedScores = benchmarkInputs.map(item => scoreFor(item)).sort((a, b) => a - b);
const percentileFor = score => {
  let belowOrEqual = 0;
  for (const candidate of sortedScores) {
    if (candidate <= score) belowOrEqual += 1;
    else break;
  }
  return Number((belowOrEqual / Math.max(sortedScores.length, 1) * 100).toFixed(1));
};
const positionText = (patents, fallback) => {
  const counts = countChains(patents);
  const valid = counts.上游 + counts.中游 + counts.下游;
  if (!valid) return fallback || "产业链位置未标注";
  const ordered = [["上游", counts.上游], ["中游", counts.中游], ["下游", counts.下游]].sort((a, b) => b[1] - a[1]);
  const shares = ordered.map(([label, count]) => `${label}${(count / valid * 100).toFixed(1)}%`).join("、");
  return `${fallback || `${ordered[0][0]}主导型`}；当前标签构成为${shares}。`;
};
const layoutScoreForSubset = patents => scoreFor(scoreInputs(patents));

const insights = {};
scored.forEach(item => {
  const company = item.company;
  const patents = company.patents || [];
  const current = patents.filter(patent => Number(patent.year) >= recentStart && Number(patent.year) <= yearMax);
  const previous = patents.filter(patent => Number(patent.year) >= previousStart && Number(patent.year) < recentStart);
  const delta = Number((layoutScoreForSubset(current) - layoutScoreForSubset(previous)).toFixed(2));
  const topChain2 = item.chain2.slice(0, 8);
  const topClusters = item.chain3.slice(0, 8);
  const clusterNames = topClusters.slice(0, 3).map(entry => entry.label);
  const topThreeShare = item.chain3.slice(0, 3).reduce((sum, entry) => sum + entry.share, 0);
  const count = item.count;
  const tier = count >= 8 ? "high" : count >= 2 ? "standard" : "limited";
  const tierLabel = tier === "high" ? "A_深度分析" : tier === "standard" ? "B_标准分析" : "C_有限证据";
  const headline = count === 1
    ? `当前仅收录该主体1件相关专利族，技术信号集中于${clusterNames[0] || "当前标签方向"}；样本有限，暂不据此推断其整体技术战略。`
    : `当前收录${count}件主体相关专利族，覆盖${item.chain3.length}个三级技术集群，主要集中于${clusterNames.join("、") || "当前标签方向"}。`;
  const strengths = [];
  if (count >= 3 && item.recent / count >= 0.5) strengths.push(`近五年新增${item.recent}件，占当前收录专利族的${(item.recent / count * 100).toFixed(1)}%。`);
  if (item.chain3.length >= 5) strengths.push(`已覆盖${item.chain3.length}个三级技术集群，具有一定的技术布局广度。`);
  if (item.citations > 0) strengths.push(`当前专利族累计获得${item.citations}次后续引用，存在可追踪的技术影响信号。`);
  const risks = [];
  if (count <= 1) risks.push("当前仅收录1件相关专利族，不能据此判断主体的完整技术战略。");
  else if (!item.recent) risks.push("近五年未收录到新增相关专利族，需结合业务和项目信息判断技术活跃度。");
  if (!topChain2.length) risks.push("当前专利族缺少有效的产业链二级标签。");
  const evidence = [...patents].sort((left, right) =>
    Number(right.citedBy || 0) - Number(left.citedBy || 0)
    || Number(right.cites || 0) - Number(left.cites || 0)
    || Number(right.year || 0) - Number(left.year || 0)
  ).slice(0, 8).map(patent => patent.id);
  const idHash = crypto.createHash("sha256").update(company.name).digest("hex").slice(0, 12);
  insights[company.name] = {
    company_name: company.name,
    enterprise_id: idHash,
    prompt_version: "enterprise-evidence-v5-owner-applicant-fallback",
    evidence_scope: company.profileScope || "当前权利人",
    status: "prepared",
    tier,
    tier_label: tierLabel,
    evidence_level: tier === "high" ? "high" : tier === "standard" ? "medium" : "low",
    layout_score: item.score,
    layout_score_delta: delta,
    headline,
    technology_layout: `三级技术集群 Top 3 合计占${(topThreeShare * 100).toFixed(1)}%，技术布局得分为${item.score.toFixed(2)}，位于当前中国主体的第${percentileFor(item.score).toFixed(1)}百分位。`,
    chain_position: positionText(patents, company.positioning),
    trend: `近五年收录${current.length}件相关专利族，上一五年收录${previous.length}件；两个时段的技术布局得分变化为${delta >= 0 ? "+" : ""}${delta.toFixed(2)}。`,
    strengths,
    risks,
    top_chain2: topChain2,
    top_clusters: topClusters,
    evidence_patents: evidence,
    confidence: tier === "high" ? "high" : tier === "standard" ? "medium" : "low",
    data_note: `IncoPat 简单专利族；按${company.profileScope || "当前权利人"}口径关联`,
    generated_at: generatedDate
  };
});

const payload = {
  schema_version: 2,
  prompt_version: "enterprise-evidence-v5-owner-applicant-fallback",
  updated_at: generatedAt,
  source_hash: crypto.createHash("sha256").update(fs.readFileSync(dataPath)).digest("hex"),
  insight_count: Object.keys(insights).length,
  scope: "当前权利人为主，名单未命中时依次回退申请人与申请人终属母公司",
  counting_method: "IncoPat 简单专利族",
  insights
};

fs.writeFileSync(outputPath, `window.ENTERPRISE_INSIGHTS=${JSON.stringify(payload)};\n`);
console.log(JSON.stringify({ outputPath, insightCount: payload.insight_count, bytes: fs.statSync(outputPath).size }, null, 2));
