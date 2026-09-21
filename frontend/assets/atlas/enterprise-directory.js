(() => {
  "use strict";

  const source = window.DASHBOARD_DATA?.enterprise;
  const directoryMaster = window.ENTERPRISE_DIRECTORY_MASTER?.entries || [];
  if (!source?.companies?.length || !window.echarts) return;

  const TREE_SPEC = {
    上游: {
      "第一壁材料 / 等离子体面对材料": [
        "第一壁材料", "面向等离子体壁材料", "plasma-facing material", "plasma-facing component",
        "高纯钨板", "钨合金", "纳米晶钨", "弥散强化钨", "抗辐照钨合金", "抗溅射钨材料",
        "钼及钼合金", "钽及钽涂层", "高温钽合金", "钛合金防护层", "锆合金", "Zr-4",
        "氧扩散阻挡层", "碳基材料", "石墨", "碳纤维复合材料", "SiC/SiC 复合材料",
        "低活化铁素体/马氏体钢", "RAFM steel", "ODS steel"
      ],
      "超导材料与超导磁体基础材料": [
        "Nb3Sn 超导线材", "铌三锡超导线材", "NbTi 超导线材", "铌钛超导线材",
        "REBCO 高温超导带材", "YBCO 高温超导带材", "第二代高温超导带材", "HTS tape",
        "MgB2 超导材料", "高温超导带材缓冲层", "MgO 异质外延基底", "银基过渡层",
        "导电连接层", "超导磁体稳定接触层", "高纯无氧铜", "稳定铜基体", "电流引线材料",
        "氧化铝陶瓷绝缘层", "陶瓷绝缘材料", "结构支撑材料"
      ],
      "包层、氚增殖和燃料循环相关材料": [
        "氚增殖材料", "tritium breeding material", "锂陶瓷", "Li2TiO3", "Li4SiO4",
        "液态锂铅", "LiPb", "PbLi", "氚渗透阻挡层", "tritium permeation barrier",
        "氚吸附材料", "氚分离材料", "氚回收材料", "氘处理材料", "氚处理材料", "氦处理材料"
      ],
      "冷却、耐热、耐辐照、真空和密封基础材料": [
        "液氦低温材料", "低温绝热材料", "cryogenic insulation", "高温合金", "耐辐照合金",
        "抗中子辐照材料", "真空密封材料", "金属密封材料", "陶瓷密封材料",
        "热交换基础材料", "耐腐蚀冷却回路材料"
      ]
    },
    中游: {
      "核聚变反应堆与磁约束装置": [
        "tokamak", "托卡马克", "stellarator", "仿星器", "spherical tokamak", "球形托卡马克",
        "magnetic confinement fusion", "磁约束聚变", "thermonuclear reactor", "fusion reactor",
        "聚变反应堆", "toroidal plasma", "环形等离子体", "divertor", "偏滤器", "limiter",
        "限制器", "blanket module", "包层模块", "tritium breeding blanket", "氚增殖包层",
        "vacuum vessel", "真空室", "cryostat", "低温恒温器", "plasma heating", "等离子体加热",
        "neutral beam injection", "NBI 中性束注入", "RF heating", "射频加热", "ECRH", "ICRH",
        "LHCD", "plasma control", "等离子体控制"
      ],
      "聚变堆结构与磁体系统": [
        "环向场线圈", "TF coil", "极向场线圈", "PF coil", "中心螺线管", "central solenoid",
        "超导磁体", "superconducting magnet", "高场磁体", "强磁场装置", "磁体支撑结构",
        "磁体冷却结构", "超导接头", "超导电缆", "CICC 导体", "低温恒温传输系统",
        "YBCO 高温超导电缆", "第二代高温超导带材电缆"
      ],
      "聚变堆热管理、冷却与能量转换设备": [
        "聚变堆热移除系统", "第一壁冷却回路", "液氦冷却系统", "超临界 CO2 冷却系统",
        "氦冷却系统", "液态金属冷却系统", "聚变堆主回路循环泵", "屏蔽电机泵",
        "磁力耦合泵", "聚变堆热交换器", "一次侧换热器", "中间冷却器",
        "聚变热能转换汽轮机", "超临界汽轮机", "闭式氦气轮机"
      ],
      "真空、抽气、密封、阀门与辅助系统": [
        "高真空抽气机组", "cryopump", "低温泵", "真空隔离阀", "冷却剂控制阀", "快速切断阀",
        "超高温密封阀", "真空密封阀", "氚处理系统", "燃料注入系统", "氘氚燃料循环",
        "等离子体诊断系统", "中子诊断", "磁诊断", "光谱诊断", "辐射屏蔽",
        "远程维护", "机器人维护", "热室系统"
      ],
      "惯性约束聚变和激光聚变设备": [
        "laser fusion", "激光聚变", "inertial confinement fusion", "ICF", "靶丸",
        "target capsule", "hohlraum", "黑腔", "高功率激光驱动器", "Z-pinch",
        "磁化靶聚变", "magnetized target fusion"
      ]
    },
    下游: {
      "核能发电与聚变电站应用": [
        "聚变电站总体设计", "fusion power plant", "核能发电", "基荷电力输出",
        "电网调频服务", "聚变能并网系统", "能源转换", "电力调度"
      ],
      "核能供热与工业应用": [
        "区域供热", "工业蒸汽供应", "高温热源利用", "核能耦合工业园区供能"
      ],
      "核能高温制氢与燃料应用": [
        "核能高温制氢", "热化学硫碘循环", "电解水耦合发电", "氢气生产", "氘氚燃料相关下游利用"
      ],
      "核电工程与核电配套系统": [
        "核电工程", "模块化建造", "安全认证体系", "主控室通风系统", "应急冷却风机",
        "防爆风机", "核电通风", "核岛通风", "安全壳通风"
      ]
    },
    不适用: {}
  };

  const COLORS = { 上游: "#315c79", 中游: "#e9632d", 下游: "#8c174f", 不适用: "#aaa39a" };
  const TECHNOLOGY_LABELS = {
    B1: "磁约束聚变 MCF",
    B2: "FRC 与紧凑环聚变",
    B3: "磁惯性聚变 MIF",
    B4: "惯性约束聚变 ICF",
    B5: "替代、非热及其他聚变路线",
    B6: "LENR 与凝聚态低能核反应",
    B7: "通用聚变支撑技术",
    B8: "聚变基础科学",
    B9: "潜力应用"
  };
  const SECONDARY_ALIASES = {
    上游: {
      "等离子体面对与结构材料": "第一壁材料 / 等离子体面对材料",
      "超导与磁体基础材料": "超导材料与超导磁体基础材料",
      "包层与氚增殖材料": "包层、氚增殖和燃料循环相关材料",
      "耐热、耐辐照与特种结构材料": "冷却、耐热、耐辐照、真空和密封基础材料",
      "真空、低温、绝缘与密封基础材料": "冷却、耐热、耐辐照、真空和密封基础材料"
    },
    中游: {
      "聚变装置与反应堆系统": "核聚变反应堆与磁约束装置",
      "第一壁、偏滤器、包层与堆内结构": "核聚变反应堆与磁约束装置",
      "等离子体加热与电流驱动系统": "核聚变反应堆与磁约束装置",
      "磁体、线圈与磁场系统": "聚变堆结构与磁体系统",
      "热管理、冷却与能量提取系统": "聚变堆热管理、冷却与能量转换设备",
      "真空、抽气与低温系统": "真空、抽气、密封、阀门与辅助系统",
      "燃料循环与氚处理系统": "真空、抽气、密封、阀门与辅助系统",
      "诊断、控制与数据系统": "真空、抽气、密封、阀门与辅助系统",
      "屏蔽、安全、维护与遥操作系统": "真空、抽气、密封、阀门与辅助系统",
      "电源与功率电子系统": "真空、抽气、密封、阀门与辅助系统",
      "惯性聚变驱动与靶系统": "惯性约束聚变和激光聚变设备",
      "脉冲功率与快速能量释放系统": "惯性约束聚变和激光聚变设备"
    },
    下游: {
      "聚变发电与聚变电站": "核能发电与聚变电站应用",
      "聚变能源与电网耦合": "核能发电与聚变电站应用",
      "聚变能源综合利用": "核能发电与聚变电站应用",
      "聚变供热与工业热利用": "核能供热与工业应用",
      "聚变制氢与燃料生产": "核能高温制氢与燃料应用"
    }
  };
  const PAGE_SIZE = 24;
  const normalizeEnterpriseName = value => String(value || "").normalize("NFKC").toLocaleLowerCase("zh-CN")
    .replace(/[\s\[\]【】()（）·,，.。'"“”‘’\-—_]/g, "")
    .replace(/有限责任公司$/, "有限公司");
  const enterpriseNameRoot = value => {
    let cleaned = String(value || "").normalize("NFKC").toLocaleLowerCase("zh-CN").trim()
      .replace(/^大陆商\s*/, "").replace(/^香港商\s*/, "").replace(/^台湾商\s*/, "")
      .replace(/[（(](?:中国大陆|中国|中华民国|台湾|香港)[）)]\s*$/, "");
    cleaned = normalizeEnterpriseName(cleaned)
      .replace(/(?:股份有限公司|有限公司|总公司|公司)$/, "");
    return cleaned;
  };
  const isUsableEnterpriseRoot = value => {
    if (!value || !/^[\p{Script=Han}a-z0-9]+$/u.test(value)) return false;
    const containsHan = [...value].some(character => /\p{Script=Han}/u.test(character));
    return containsHan ? [...value].length >= 4 : value.length >= 8;
  };
  const patentSignature = company => [...(company.patents || [])]
    .map(patent => patent.familyId || patent.id || "").filter(Boolean).sort().join("|");
  const enterpriseNameScore = value => {
    const name = String(value || "").normalize("NFKC").trim();
    let score = 0;
    if (/^[\p{Script=Han}]/u.test(name)) score += 10;
    if (/股份有限公司$/.test(name)) score += 24;
    else if (/(?:有限责任公司|有限公司)$/.test(name)) score += 14;
    if (/^(?:大陆商|香港商|台湾商)/.test(name)) score -= 80;
    if (/[（(](?:中国大陆|中国|中华民国|台湾|香港)[）)]$/.test(name)) score -= 60;
    return score - name.length / 1000;
  };
  const preferredEnterprise = values => [...values].sort((left, right) =>
    enterpriseNameScore(right.name) - enterpriseNameScore(left.name)
      || String(left.name).localeCompare(String(right.name), "zh-CN")
  )[0];
  const allBaseCompanies = source.companies;
  const baseCompanies = allBaseCompanies.filter(company =>
    (Array.isArray(company.countries) ? company.countries : [company.countries]).includes("中国")
  );
  const fallbackCompanies = (source.directoryFallbackCompanies || []).filter(company =>
    (Array.isArray(company.countries) ? company.countries : [company.countries]).includes("中国")
  );
  const baseCompanyByNormalizedName = new Map();
  const baseCompaniesByRoot = new Map();
  const fallbackCompanyByNormalizedName = new Map();
  const fallbackCompaniesByRoot = new Map();
  allBaseCompanies.forEach(company => {
    const identityNames = [...new Set([company.name, ...(company.aliases || [])].filter(Boolean))];
    identityNames.forEach(identityName => {
      const key = normalizeEnterpriseName(identityName);
      const existing = baseCompanyByNormalizedName.get(key);
      if (!existing || Number(company.value || 0) > Number(existing.value || 0)) {
        baseCompanyByNormalizedName.set(key, company);
      }
    });
  });
  baseCompanies.forEach(company => {
    const identityNames = [...new Set([company.name, ...(company.aliases || [])].filter(Boolean))];
    identityNames.forEach(identityName => {
      const root = enterpriseNameRoot(identityName);
      if (!isUsableEnterpriseRoot(root)) return;
      if (!baseCompaniesByRoot.has(root)) baseCompaniesByRoot.set(root, []);
      const candidates = baseCompaniesByRoot.get(root);
      if (!candidates.includes(company)) candidates.push(company);
    });
  });
  fallbackCompanies.forEach(company => {
    const identityNames = [...new Set([company.name, ...(company.aliases || [])].filter(Boolean))];
    identityNames.forEach(identityName => {
      const key = normalizeEnterpriseName(identityName);
      const existing = fallbackCompanyByNormalizedName.get(key);
      if (!existing || Number(company.value || 0) > Number(existing.value || 0)) {
        fallbackCompanyByNormalizedName.set(key, company);
      }
      const root = enterpriseNameRoot(identityName);
      if (!isUsableEnterpriseRoot(root)) return;
      if (!fallbackCompaniesByRoot.has(root)) fallbackCompaniesByRoot.set(root, []);
      const candidates = fallbackCompaniesByRoot.get(root);
      if (!candidates.includes(company)) candidates.push(company);
    });
  });
  const safeRootCandidatesFrom = (index, root) => {
    if (!isUsableEnterpriseRoot(root)) return [];
    const candidates = index.get(root) || [];
    if (candidates.length <= 1) return candidates;
    return new Set(candidates.map(patentSignature)).size === 1 ? candidates : [];
  };
  const safeRootCandidates = root => safeRootCandidatesFrom(baseCompaniesByRoot, root);
  const safeFallbackRootCandidates = root => safeRootCandidatesFrom(fallbackCompaniesByRoot, root);
  const directoryEntries = (() => {
    if (!directoryMaster.length) return [];
    const groups = new Map();
    directoryMaster.forEach(entry => {
      const root = enterpriseNameRoot(entry.name);
      const groupKey = isUsableEnterpriseRoot(root) ? root : `@${normalizeEnterpriseName(entry.name)}`;
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(entry);
    });
    return [...groups.entries()].flatMap(([groupKey, entries]) => {
      const currentOwnerCandidates = groupKey.startsWith("@") ? [] : safeRootCandidates(groupKey);
      const candidates = currentOwnerCandidates.length
        ? currentOwnerCandidates
        : (groupKey.startsWith("@") ? [] : safeFallbackRootCandidates(groupKey));
      if (entries.length < 2 || !candidates.length) {
        return entries.map(entry => ({ ...entry, aliases: [...new Set([entry.name, ...(entry.aliases || [])])] }));
      }
      const preferredCompany = preferredEnterprise(candidates);
      const preferredEntry = entries.find(entry =>
        normalizeEnterpriseName(entry.name) === normalizeEnterpriseName(preferredCompany?.name)
      ) || preferredEnterprise(entries);
      return [{
        ...preferredEntry,
        aliases: [...new Set(entries.flatMap(entry => [entry.name, ...(entry.aliases || [])]).concat(candidates.map(company => company.name)))],
        source: [...new Set(entries.map(entry => entry.source).filter(Boolean))].join(" + ")
      }];
    });
  })();
  const companies = directoryEntries.length ? directoryEntries.map(entry => {
    const aliases = [...new Set([entry.name, ...(entry.aliases || [])].filter(Boolean))];
    const currentOwnerExactCandidates = [...new Set(aliases.map(alias =>
      baseCompanyByNormalizedName.get(normalizeEnterpriseName(alias))
    ).filter(Boolean))];
    const currentOwnerRootCandidates = safeRootCandidates(enterpriseNameRoot(entry.name));
    const fallbackExactCandidates = [...new Set(aliases.map(alias =>
      fallbackCompanyByNormalizedName.get(normalizeEnterpriseName(alias))
    ).filter(Boolean))];
    const fallbackRootCandidates = safeFallbackRootCandidates(enterpriseNameRoot(entry.name));
    const matched = preferredEnterprise(
      currentOwnerExactCandidates.length ? currentOwnerExactCandidates
        : currentOwnerRootCandidates.length ? currentOwnerRootCandidates
          : fallbackExactCandidates.length ? fallbackExactCandidates
            : fallbackRootCandidates
    );
    if (matched && !aliases.includes(matched.name)) aliases.push(matched.name);
    if (matched) {
      return {
        ...matched,
        directoryName: entry.name,
        directoryAliases: aliases,
        directoryMatched: true,
        directoryMatchScope: matched.profileScope || "当前权利人",
        directorySource: entry.source,
        directoryVerificationStatus: entry.verificationStatus,
        directoryValue: Number(matched.value || 0),
        countries: ["中国"],
        provinces: entry.province ? [entry.province] : [...(matched.provinces || [])],
        cities: entry.city ? [entry.city] : [...(matched.cities || [])]
      };
    }
    return {
      name: entry.name,
      directoryName: entry.name,
      directoryAliases: aliases,
      directoryMatched: false,
      directoryMatchScope: "",
      directorySource: entry.source,
      directoryVerificationStatus: entry.verificationStatus,
      directoryValue: 0,
      type: "企业",
      countries: ["中国"],
      provinces: entry.province ? [entry.province] : [],
      cities: entry.city ? [entry.city] : [],
      value: 0,
      fractionalValue: 0,
      recent5: 0,
      firstYear: null,
      chain: { "上游": 0, "中游": 0, "下游": 0, "有效": 0, "不适用": 0, "缺失": 0 },
      ratios: { "上游": 0, "中游": 0, "下游": 0 },
      positioning: "暂未关联专利布局",
      patents: []
    };
  }) : baseCompanies.map(company => ({
    ...company,
    directoryName: company.name,
    directoryAliases: [...new Set([company.name, ...(company.aliases || [])].filter(Boolean))],
    directoryMatched: true,
    directoryMatchScope: company.profileScope || "当前权利人",
    directoryValue: Number(company.value || 0)
  }));
  const numberFormat = new Intl.NumberFormat("zh-CN");
  const PROVINCE_ALIASES = [
    ["北京", ["北京市", "北京"]], ["天津", ["天津市", "天津"]], ["上海", ["上海市", "上海"]], ["重庆", ["重庆市", "重庆"]],
    ["河北", ["河北省", "河北"]], ["山西", ["山西省", "山西"]], ["辽宁", ["辽宁省", "辽宁"]], ["吉林", ["吉林省", "吉林"]],
    ["黑龙江", ["黑龙江省", "黑龙江"]], ["江苏", ["江苏省", "江苏"]], ["浙江", ["浙江省", "浙江"]], ["安徽", ["安徽省", "安徽"]],
    ["福建", ["福建省", "福建"]], ["江西", ["江西省", "江西"]], ["山东", ["山东省", "山东"]], ["河南", ["河南省", "河南"]],
    ["湖北", ["湖北省", "湖北"]], ["湖南", ["湖南省", "湖南"]], ["广东", ["广东省", "广东"]], ["海南", ["海南省", "海南"]],
    ["四川", ["四川省", "四川"]], ["贵州", ["贵州省", "贵州"]], ["云南", ["云南省", "云南"]], ["陕西", ["陕西省", "陕西"]],
    ["甘肃", ["甘肃省", "甘肃"]], ["青海", ["青海省", "青海"]], ["台湾", ["台湾省", "台湾"]],
    ["内蒙古", ["内蒙古自治区", "内蒙古"]], ["广西", ["广西壮族自治区", "西壮族自治区", "广西"]], ["西藏", ["西藏自治区", "西藏"]],
    ["宁夏", ["宁夏回族自治区", "宁夏"]], ["新疆", ["新疆维吾尔自治区", "新疆"]],
    ["香港", ["香港特别行政区", "香港"]], ["澳门", ["澳门特别行政区", "澳门"]]
  ];
  const provinceAliasLookup = new Map(PROVINCE_ALIASES.flatMap(([canonical, aliases]) => aliases.map(alias => [alias, canonical])));
  const sortedProvinceAliases = [...provinceAliasLookup.keys()].sort((left, right) => right.length - left.length);

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const displayEnterpriseName = window.FUSION_ENTERPRISE_NAME?.display || (value => String(value || ""));
  const splitLabels = value => String(value || "").split(/[；;]+/).map(item => item.trim()).filter(Boolean);
  const cleanLocation = value => String(value || "").trim().replace(/^[\[【(（]+|[\]】)）]+$/g, "").trim();
  const canonicalCountry = value => {
    const cleaned = cleanLocation(value);
    return ["中华人民共和国", "中国大陆"].includes(cleaned) ? "中国" : cleaned;
  };
  const canonicalProvince = value => {
    const cleaned = cleanLocation(value);
    return provinceAliasLookup.get(cleaned) || cleaned.replace(/省$/, "").replace(/市$/, "");
  };
  const cityEntry = (value, provinceHints = []) => {
    const raw = cleanLocation(value);
    if (!raw || /未识别|未知|不适用/.test(raw)) return null;
    const matchedAlias = sortedProvinceAliases.find(alias => raw.startsWith(alias));
    let province = matchedAlias ? provinceAliasLookup.get(matchedAlias) : "";
    let remainder = matchedAlias ? raw.slice(matchedAlias.length) : raw;
    const hints = [...new Set(provinceHints.map(canonicalProvince).filter(Boolean))];
    if (!province && hints.length === 1) province = hints[0];
    if (["北京", "天津", "上海", "重庆", "香港", "澳门"].includes(province)) remainder = province;
    remainder = remainder.replace(/^省/, "").replace(/^市辖区/, "").trim();
    const prefecture = remainder.match(/^(.+?)(?:市|自治州|地区|盟)/);
    const city = cleanLocation(prefecture ? prefecture[1] : remainder.replace(/市$/, ""));
    return city && !/未识别|未知|不适用/.test(city) ? { city, province } : null;
  };
  const geographyCache = new WeakMap();
  const geographyFor = company => {
    if (geographyCache.has(company)) return geographyCache.get(company);
    const countries = new Set((company.countries || []).map(canonicalCountry).filter(Boolean));
    const provinces = new Set((company.provinces || []).map(canonicalProvince).filter(value => value && !/未识别|未知|不适用/.test(value)));
    const cities = (company.cities || []).map(value => cityEntry(value, [...provinces])).filter(Boolean);
    const geography = { countries, provinces, cities };
    geographyCache.set(company, geography);
    return geography;
  };
  const normalize = value => String(value || "").normalize("NFKC").toLocaleLowerCase("zh-CN")
    .replace(/\s+/g, "")
    .replaceAll("聚變", "聚变").replaceAll("反應堆", "反应堆").replaceAll("磁體", "磁体")
    .replaceAll("結構", "结构").replaceAll("系統", "系统").replaceAll("熱", "热")
    .replaceAll("冷卻", "冷却").replaceAll("與", "与").replaceAll("轉換", "转换");
  const keyFor = path => path.length ? path.map((item, index) => index === 2 ? normalize(item) : item).join("¦") : "ROOT";

  function ensureMarkup() {
    const switcher = document.querySelector(".enterprise-mode-switch");
    if (!switcher.querySelector('[data-enterprise-mode="directory"]')) {
      const intelligenceButton = switcher.querySelector('[data-enterprise-mode="intelligence"]');
      const directoryButton = `
        <button type="button" role="tab" aria-selected="false" data-enterprise-mode="directory">
          <span>02</span><b>企业名单</b><small>产业链三级分类名录</small>
        </button>`;
      if (intelligenceButton) intelligenceButton.insertAdjacentHTML("beforebegin", directoryButton);
      else switcher.insertAdjacentHTML("beforeend", directoryButton);
    }
    const view = document.getElementById("enterpriseView");
    if (!document.getElementById("enterpriseDirectory")) {
      view.insertAdjacentHTML("beforeend", `
        <section id="enterpriseDirectory" class="enterprise-directory" data-enterprise-panel="directory" aria-label="企业产业链分类名录" hidden>
          <article class="panel directory-toolbar">
            <div class="directory-toolbar-copy"><h3>中国企业产业链分类名录</h3></div>
            <div class="directory-toolbar-stats"><span><b id="directoryTotalCompanies">—</b> 家核验企业</span><span><b id="directoryMatchedCompanies">—</b> 家已关联专利</span><span><b id="directorySupplementCompanies">—</b> 家暂未关联专利</span></div>
            <div class="directory-controls">
              <label class="directory-search-control"><span>检索企业</span><input id="directorySearch" type="search" placeholder="输入企业名称或地区" autocomplete="off"></label>
              <label class="directory-country-control"><span>国家</span><select id="directoryCountry"><option value="">全部国家</option></select></label>
              <label class="directory-province-control"><span>省份</span><select id="directoryProvince"><option value="">全部省份</option></select></label>
              <label class="directory-city-control"><span>城市</span><select id="directoryCity"><option value="">全部城市</option></select></label>
              <label class="directory-type-control"><span>企业类型</span><select id="directoryType"><option value="">全部企业类型</option></select></label>
              <label class="directory-sort-control"><span>排序方式</span><select id="directorySort"><option value="scale">专利族数量</option><option value="recent">首次布局年份</option><option value="name">企业名称</option></select></label>
              <button id="directoryReset" class="directory-reset-control" type="button">重置全部</button>
              <label class="directory-technology-control"><span>技术分类</span><select id="directoryTechnology"><option value="">全部技术分类</option></select></label>
              <label class="directory-chain1-control"><span>产业链一级</span><select id="directoryChain1"><option value="">全部一级标签</option></select></label>
              <label class="directory-chain2-control"><span>产业链二级</span><select id="directoryChain2"><option value="">请先选择一级标签</option></select></label>
              <label class="directory-chain3-control"><span>产业链三级</span><select id="directoryChain3"><option value="">请先选择二级标签</option></select></label>
            </div>
          </article>
          <section id="directoryShareholderLeads" class="panel" hidden></section>
          <div class="directory-layout">
            <article class="panel directory-tree-panel">
              <div class="directory-panel-head"><div><h3>产业链三级桑基图</h3><p>各列按固定分类顺序从顶部向下排列</p></div><button id="directoryTreeReset" type="button">复位图谱</button></div>
              <div id="directoryTreePath" class="directory-tree-path">全部企业</div>
              <div id="directoryTree" class="directory-tree" aria-hidden="true"></div>
            </article>
            <article class="panel directory-list-panel">
              <div class="directory-panel-head"><div><h3>企业名单</h3><p id="directoryListScope">全部产业链位置</p></div><div class="directory-list-head-tools"><div class="directory-patent-status" role="group" aria-label="按专利关联状态筛选"><button class="active" type="button" data-directory-patent-status="all" aria-pressed="true">全部</button><button type="button" data-directory-patent-status="patented" aria-pressed="false">已关联专利</button><button type="button" data-directory-patent-status="unpatented" aria-pressed="false">暂未关联专利</button></div><strong id="directoryResultCount">—</strong></div></div>
              <div id="directoryCompanyList" class="directory-company-list" aria-live="polite"></div>
              <div class="directory-pagination"><button id="directoryPrev" type="button">上一页</button><span id="directoryPage">—</span><button id="directoryNext" type="button">下一页</button></div>
            </article>
          </div>
        </section>`);
    }
  }

  ensureMarkup();

  const standardSecondary = new Map();
  Object.entries(TREE_SPEC).forEach(([primary, branches]) => {
    Object.keys(branches).forEach(secondary => standardSecondary.set(`${primary}¦${normalize(secondary)}`, secondary));
  });
  Object.entries(SECONDARY_ALIASES).forEach(([primary, aliases]) => {
    Object.entries(aliases).forEach(([sourceLabel, standardLabel]) => {
      standardSecondary.set(`${primary}¦${normalize(sourceLabel)}`, standardLabel);
    });
  });
  const patentPathCounts = new Map([["ROOT", 0]]);
  const observedTertiaries = new Map();
  const technologyCodeOf = value => String(value || "").match(/\bB[1-9]\b/i)?.[0].toUpperCase() || "";

  function indexCompany(company) {
    const keys = new Set(["ROOT"]);
    const secondaryCounts = new Map();
    const technologyCodes = new Set();
    const chainPaths = [];
    const patentFacets = [];
    company.patents.forEach(patent => {
      patentPathCounts.set("ROOT", (patentPathCounts.get("ROOT") || 0) + 1);
      const patentKeys = new Set();
      const patentTechnologyCodes = new Set(splitLabels(patent.tech).map(technologyCodeOf).filter(Boolean));
      const primaries = splitLabels(patent.chain1).filter(primary => primary in TREE_SPEC);
      const secondaries = splitLabels(patent.chain2);
      const tertiaries = splitLabels(patent.chain3);
      const patentChainPaths = [];
      patentTechnologyCodes.forEach(code => technologyCodes.add(code));
      primaries.forEach(primary => {
        patentKeys.add(keyFor([primary]));
        patentChainPaths.push({ primary, secondary: "", tertiary: "" });
        secondaries.forEach(rawSecondary => {
          const secondary = standardSecondary.get(`${primary}¦${normalize(rawSecondary)}`);
          if (!secondary) return;
          const secondaryKey = keyFor([primary, secondary]);
          patentKeys.add(secondaryKey);
          secondaryCounts.set(secondary, (secondaryCounts.get(secondary) || 0) + 1);
          if (!observedTertiaries.has(secondaryKey)) observedTertiaries.set(secondaryKey, new Set());
          if (!tertiaries.length) patentChainPaths.push({ primary, secondary, tertiary: "" });
          tertiaries.forEach(tertiary => {
            patentKeys.add(keyFor([primary, secondary, tertiary]));
            observedTertiaries.get(secondaryKey).add(tertiary);
            patentChainPaths.push({ primary, secondary, tertiary });
          });
        });
      });
      chainPaths.push(...patentChainPaths);
      patentFacets.push({ technologyCodes: patentTechnologyCodes, chainPaths: patentChainPaths });
      patentKeys.forEach(key => {
        keys.add(key);
        patentPathCounts.set(key, (patentPathCounts.get(key) || 0) + 1);
      });
    });
    return {
      company,
      companyKey: normalizeEnterpriseName(company.directoryName || company.name),
      keys, secondaryCounts, technologyCodes, chainPaths, patentFacets
    };
  }

  let records = null;
  let directoryReady = false;
  const companyCountFor = (path, sourceRecords = records || []) => sourceRecords.reduce((total, record) => total + (record.keys.has(keyFor(path)) ? 1 : 0), 0);
  const patentCountFor = path => patentPathCounts.get(keyFor(path)) || 0;
  const expandedSecondary = new Set();

  function fuzzyWeight(count) {
    if (count <= 2) return .72;
    if (count <= 5) return .94;
    if (count <= 15) return 1.18;
    if (count <= 40) return 1.46;
    if (count <= 100) return 1.78;
    return 2.12;
  }

  function buildSankey() {
    const nodes = [];
    const links = [];
    const nodeKeys = new Set();
    const scopedRecords = (records || []).filter(record => {
      const geography = geographyFor(record.company);
      if (state.country && !geography.countries.has(state.country)) return false;
      if (state.province && !geography.provinces.has(state.province)) return false;
      if (state.city && !geography.cities.some(entry => entry.city === state.city && (!state.province || !entry.province || entry.province === state.province))) return false;
      if (state.type && record.company.type !== state.type) return false;
      if (!recordMatchesPatentStatus(record)) return false;
      return recordMatchesPatentFacets(record);
    });
    const addNode = (label, path, depth, metadata = {}) => {
      const name = keyFor(path);
      if (nodeKeys.has(name)) return name;
      nodeKeys.add(name);
      nodes.push({
        name,
        displayName: label,
        path,
        depth,
        ...metadata,
        itemStyle: { color: COLORS[path[0]] || "#aaa39a", borderColor: "#fffdf9", borderWidth: .6 }
      });
      return name;
    };
    Object.entries(TREE_SPEC).forEach(([primary, branches]) => {
      if (state.chain1 && primary !== state.chain1) return;
      const secondaryEntries = Object.entries(branches).filter(([secondary]) => !state.chain2 || secondary === state.chain2).map(([secondary, referenceTertiaries]) => {
        const secondaryPath = [primary, secondary];
        const secondaryKey = keyFor(secondaryPath);
        const observed = [...(observedTertiaries.get(secondaryKey) || [])];
        const tertiaries = [...new Set([...referenceTertiaries, ...observed])]
          .filter(tertiary => !state.chain3 || tertiary === state.chain3);
        return {
          secondary,
          secondaryCount: companyCountFor(secondaryPath, scopedRecords),
          tertiaries: tertiaries.map(tertiary => ({
            tertiary,
            count: companyCountFor([...secondaryPath, tertiary], scopedRecords),
            hasData: companyCountFor([...secondaryPath, tertiary], scopedRecords) > 0
          })).filter(item => item.hasData)
        };
      }).filter(item => item.secondaryCount > 0 || item.tertiaries.length);
      if (!secondaryEntries.length) return;
      const primaryName = addNode(primary, [primary], 0);
      secondaryEntries.forEach(({ secondary, secondaryCount, tertiaries }) => {
        const secondaryPath = [primary, secondary];
        const secondaryKey = keyFor(secondaryPath);
        const secondaryWeight = fuzzyWeight(secondaryCount);
        const secondaryName = addNode(secondary, secondaryPath, 1, {
          expandable: tertiaries.length > 0,
          expanded: expandedSecondary.has(secondaryKey)
        });
        links.push({ source: primaryName, target: secondaryName, value: secondaryWeight, path: secondaryPath, sourceLabel: primary, targetLabel: secondary });
        if ((!expandedSecondary.has(secondaryKey) && !state.chain3) || !tertiaries.length) return;
        const rawWeights = tertiaries.map(item => fuzzyWeight(item.count));
        const rawTotal = rawWeights.reduce((sum, value) => sum + value, 0);
        tertiaries.forEach(({ tertiary }, index) => {
          const tertiaryPath = [primary, secondary, tertiary];
          const tertiaryName = addNode(tertiary, tertiaryPath, 2);
          const normalizedWeight = secondaryWeight * rawWeights[index] / Math.max(rawTotal, .01);
          links.push({ source: secondaryName, target: tertiaryName, value: normalizedWeight, path: tertiaryPath, sourceLabel: secondary, targetLabel: tertiary });
        });
      });
    });
    return { nodes, links };
  }

  const state = {
    path: [], query: "", country: "中国", province: "", city: "", type: "",
    technology: "", chain1: "", chain2: "", chain3: "", patentStatus: "all", sort: "scale", page: 1
  };
  let treeChart = null;

  function treeOption() {
    const compact = document.getElementById("directoryTree").clientWidth < 620;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const sankey = buildSankey();
    return {
      animationDuration: reduceMotion ? 0 : 320,
      animationDurationUpdate: reduceMotion ? 0 : 480,
      animationEasing: "cubicOut",
      animationEasingUpdate: "cubicInOut",
      tooltip: {
        trigger: "item", confine: true, backgroundColor: "rgba(21,35,55,.96)", borderWidth: 0,
        textStyle: { color: "#fff", fontSize: 12 },
        formatter: params => params.dataType === "edge"
          ? `${escapeHtml(params.data.sourceLabel)} → ${escapeHtml(params.data.targetLabel)}<br><span style="opacity:.72">相对规模等级（非精确数量）</span>`
          : `${escapeHtml((params.data.path || []).join(" / "))}${params.data.expandable ? `<br><span style="opacity:.72">${params.data.expanded ? "点击收起三级分类" : "点击展开三级分类"}</span>` : ""}`
      },
      series: [{
        type: "sankey",
        data: sankey.nodes,
        links: sankey.links,
        top: 28, left: compact ? 12 : 28, bottom: 28, right: compact ? 116 : 215,
        nodeAlign: "left",
        nodeWidth: compact ? 8 : 10,
        nodeGap: compact ? 8 : 10,
        draggable: false,
        layoutIterations: 0,
        orient: "horizontal",
        lineStyle: { color: "gradient", opacity: .22, curveness: .52 },
        label: {
          position: "right", distance: 7, verticalAlign: "middle", align: "left",
          color: "#152337", fontSize: compact ? 9 : 11, width: compact ? 108 : 198, overflow: "truncate",
          formatter: params => params.data.depth === 1 && params.data.expandable
            ? `${params.data.displayName}  ${params.data.expanded ? "−" : "+"}`
            : params.data.displayName
        },
        emphasis: { focus: "adjacency", lineStyle: { opacity: .52 } },
        universalTransition: true
      }]
    };
  }

  function ensureTree() {
    if (!treeChart) {
      treeChart = echarts.init(document.getElementById("directoryTree"), null, { renderer: "canvas" });
      treeChart.setOption(treeOption());
      treeChart.on("click", event => {
        if (!Array.isArray(event.data?.path)) return;
        const clickedPath = event.data.path;
        if (event.dataType === "node" && clickedPath.length === 2 && event.data.expandable) {
          const secondaryKey = keyFor(clickedPath);
          if (expandedSecondary.has(secondaryKey)) expandedSecondary.delete(secondaryKey);
          else expandedSecondary.add(secondaryKey);
          treeChart.setOption(treeOption(), true);
        }
      });
    }
    treeChart.resize();
  }

  function recordMatchesPatentFacets(record) {
    const hasPatentFacetFilter = state.technology || state.chain1 || state.chain2 || state.chain3;
    if (!hasPatentFacetFilter) return true;
    return record.patentFacets.some(facet => {
      if (state.technology && !facet.technologyCodes.has(state.technology)) return false;
      if (!state.chain1 && !state.chain2 && !state.chain3) return true;
      return facet.chainPaths.some(path =>
        (!state.chain1 || path.primary === state.chain1)
        && (!state.chain2 || path.secondary === state.chain2)
        && (!state.chain3 || path.tertiary === state.chain3)
      );
    });
  }

  const recordHasPatents = record => Array.isArray(record.company.patents) && record.company.patents.length > 0;
  function recordMatchesPatentStatus(record) {
    if (state.patentStatus === "patented") return recordHasPatents(record);
    if (state.patentStatus === "unpatented") return !recordHasPatents(record);
    return true;
  }

  function syncPatentStatusButtons() {
    document.querySelectorAll("[data-directory-patent-status]").forEach(button => {
      const active = button.dataset.directoryPatentStatus === state.patentStatus;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function filteredRecords() {
    if (!records) return [];
    const activeKey = keyFor(state.path);
    const query = state.query;
    const rows = records.filter(record => {
      const company = record.company;
      if (!record.keys.has(activeKey)) return false;
      const geography = geographyFor(company);
      if (state.country && !geography.countries.has(state.country)) return false;
      if (state.province && !geography.provinces.has(state.province)) return false;
      if (state.city && !geography.cities.some(entry => entry.city === state.city && (!state.province || !entry.province || entry.province === state.province))) return false;
      if (state.type && company.type !== state.type) return false;
      if (!recordMatchesPatentStatus(record)) return false;
      if (!recordMatchesPatentFacets(record)) return false;
      if (query) {
        const haystack = [company.directoryName, company.name, ...(company.directoryAliases || []), ...company.countries, ...company.provinces, ...company.cities].join(" ").toLocaleLowerCase("zh-CN");
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
    return rows.sort((left, right) => {
      const leftName = left.company.directoryName || left.company.name;
      const rightName = right.company.directoryName || right.company.name;
      const leftValue = Number(left.company.directoryValue ?? left.company.value ?? 0);
      const rightValue = Number(right.company.directoryValue ?? right.company.value ?? 0);
      if (state.sort === "name") return leftName.localeCompare(rightName, "zh-CN");
      if (state.sort === "recent") return Number(right.company.firstYear || 0) - Number(left.company.firstYear || 0) || rightValue - leftValue;
      return rightValue - leftValue || leftName.localeCompare(rightName, "zh-CN");
    });
  }

  function companyRow(record) {
    const company = record.company;
    const displayName = displayEnterpriseName(company.directoryName || company.name);
    const hasPatents = recordHasPatents(record);
    const displayValue = Number(company.directoryValue ?? company.value ?? 0);
    const topSecondary = [...record.secondaryCounts].sort((a, b) => b[1] - a[1]).slice(0, 2).map(item => item[0]);
    const location = [...new Set([...company.provinces, ...company.cities].filter(value => value && value !== "未知"))].join(" · ") || company.countries.join(" · ") || "地区未标注";
    const matchScope = company.directoryMatchScope || company.profileScope || "当前权利人";
    const meta = hasPatents
      ? `${escapeHtml(company.type)} · ${escapeHtml(location)} · ${escapeHtml(matchScope)}匹配 · 首次布局 ${company.firstYear || "—"}`
      : `核验企业 · ${escapeHtml(location)} · 当前数据暂未关联专利`;
    const chainMarkup = hasPatents
      ? `<div class="directory-chain-counts"><span style="--chain-color:${COLORS.上游}">上游 <b>${numberFormat.format(company.chain.上游 || 0)}</b></span><span style="--chain-color:${COLORS.中游}">中游 <b>${numberFormat.format(company.chain.中游 || 0)}</b></span><span style="--chain-color:${COLORS.下游}">下游 <b>${numberFormat.format(company.chain.下游 || 0)}</b></span></div>`
      : '<div class="directory-chain-empty">暂未关联产业链标签</div>';
    const valueLabels = {
      "当前权利人": "当前权利人专利族",
      "申请人": "申请人专利族",
      "申请人终属母公司": "终属母公司关联专利族"
    };
    const valueLabel = hasPatents ? (valueLabels[matchScope] || "相关专利族") : "暂未关联专利";
    const action = hasPatents
      ? `<button type="button" data-directory-company="${escapeHtml(company.name)}">查看画像</button>`
      : '<button type="button" disabled>暂未生成画像</button>';
    const leadName = company.directoryName || company.name;
    const leadAction = window.ShareholderLeads?.has(leadName)
      ? `<button type="button" class="directory-shareholder-button" data-shareholder-company="${escapeHtml(leadName)}">股东线索 ${window.ShareholderLeads.count(leadName)}</button>` : "";
    return `<article class="directory-company-row">
      <div class="directory-company-main"><h4>${escapeHtml(displayName)}</h4><p>${meta}</p>${topSecondary.length ? `<div>${topSecondary.map(label => `<span>${escapeHtml(label)}</span>`).join("")}</div>` : ""}</div>
      ${chainMarkup}
      <div class="directory-company-action"><strong>${numberFormat.format(displayValue)}</strong><small>${valueLabel}</small>${hasPatents || !leadAction ? action : ""}${leadAction}</div>
    </article>`;
  }

  function renderList() {
    if (!records) return;
    syncPatentStatusButtons();
    const rows = filteredRecords();
    const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    state.page = Math.min(state.page, pages);
    const pageRows = rows.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    const treeScope = state.path.length ? state.path.join(" / ") : "全部企业";
    const scopeParts = [
      state.path.length ? treeScope : "",
      state.technology ? `${state.technology} ${TECHNOLOGY_LABELS[state.technology] || ""}`.trim() : "",
      state.path.length ? "" : state.chain1,
      state.province,
      state.city
    ].filter(Boolean);
    const scope = scopeParts.length ? scopeParts.join(" · ") : "全部企业";
    document.getElementById("directoryTreePath").textContent = treeScope;
    document.getElementById("directoryListScope").textContent = scope;
    document.getElementById("directoryResultCount").textContent = `${numberFormat.format(rows.length)} 家`;
    document.getElementById("directoryCompanyList").innerHTML = pageRows.length
      ? pageRows.map(companyRow).join("")
      : '<div class="directory-empty"><strong>没有匹配的企业</strong><span>请调整技术分类、产业链标签、地区或检索关键词。</span></div>';
    document.getElementById("directoryPage").textContent = `${state.page} / ${pages}`;
    document.getElementById("directoryPrev").disabled = state.page <= 1;
    document.getElementById("directoryNext").disabled = state.page >= pages;
    document.querySelectorAll("[data-directory-company]").forEach(button => button.addEventListener("click", () => {
      window.openEnterpriseProfile?.(button.dataset.directoryCompany);
    }));
    document.querySelectorAll("[data-shareholder-company]").forEach(button => button.addEventListener("click", () => {
      document.querySelectorAll('[data-shareholder-return]').forEach(el => el.removeAttribute('data-shareholder-return'));
      button.dataset.shareholderReturn = "active";
      const host = document.getElementById("directoryShareholderLeads");
      window.ShareholderLeads.mount(host, button.dataset.shareholderCompany, true);
      host.scrollIntoView({behavior:"auto",block:"start"});
      host.focus({preventScroll:true});
    }));
  }

  const typeSelect = document.getElementById("directoryType");
  const countrySelect = document.getElementById("directoryCountry");
  const provinceSelect = document.getElementById("directoryProvince");
  const citySelect = document.getElementById("directoryCity");
  const technologySelect = document.getElementById("directoryTechnology");
  const chain1Select = document.getElementById("directoryChain1");
  const chain2Select = document.getElementById("directoryChain2");
  const chain3Select = document.getElementById("directoryChain3");
  const replaceOptions = (select, firstLabel, values, selected = "") => {
    select.innerHTML = `<option value="">${escapeHtml(firstLabel)}</option>${values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
    select.value = values.includes(selected) ? selected : "";
  };
  const updateRegionOptions = () => {
    const countryCompanies = companies.filter(company => !state.country || geographyFor(company).countries.has(state.country));
    const provinces = [...new Set(countryCompanies.flatMap(company => [...geographyFor(company).provinces]))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    replaceOptions(provinceSelect, "全部省份", provinces, state.province);
    if (state.province && !provinces.includes(state.province)) state.province = "";
    const provinceCompanies = countryCompanies.filter(company => !state.province || geographyFor(company).provinces.has(state.province));
    const cities = [...new Set(provinceCompanies.flatMap(company => geographyFor(company).cities
      .filter(entry => !state.province || !entry.province || entry.province === state.province)
      .map(entry => entry.city)))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    replaceOptions(citySelect, "全部城市", cities, state.city);
    if (state.city && !cities.includes(state.city)) state.city = "";
  };
  const updateTagOptions = () => {
    if (!records) return;
    const availableTechnologies = Object.keys(TECHNOLOGY_LABELS)
      .filter(code => records.some(record => record.technologyCodes.has(code)));
    technologySelect.innerHTML = `<option value="">全部技术分类</option>${availableTechnologies.map(code =>
      `<option value="${code}">${code} · ${escapeHtml(TECHNOLOGY_LABELS[code])}</option>`).join("")}`;
    technologySelect.value = availableTechnologies.includes(state.technology) ? state.technology : "";
    if (state.technology && !availableTechnologies.includes(state.technology)) state.technology = "";

    const paths = records.flatMap(record => record.chainPaths);
    const primaryOrder = ["上游", "中游", "下游"];
    const primaries = primaryOrder.filter(primary => paths.some(path => path.primary === primary));
    replaceOptions(chain1Select, "全部一级标签", primaries, state.chain1);
    if (state.chain1 && !primaries.includes(state.chain1)) state.chain1 = "";

    const secondaries = state.chain1
      ? [...new Set(paths.filter(path => path.primary === state.chain1 && path.secondary).map(path => path.secondary))]
        .sort((a, b) => a.localeCompare(b, "zh-CN"))
      : [];
    replaceOptions(chain2Select, state.chain1 ? "全部二级标签" : "请先选择一级标签", secondaries, state.chain2);
    chain2Select.disabled = !state.chain1;
    if (state.chain2 && !secondaries.includes(state.chain2)) state.chain2 = "";

    const tertiaries = state.chain1 && state.chain2
      ? [...new Set(paths.filter(path => path.primary === state.chain1 && path.secondary === state.chain2 && path.tertiary).map(path => path.tertiary))]
        .sort((a, b) => a.localeCompare(b, "zh-CN"))
      : [];
    replaceOptions(chain3Select, state.chain2 ? "全部三级标签" : "请先选择二级标签", tertiaries, state.chain3);
    chain3Select.disabled = !state.chain2;
    if (state.chain3 && !tertiaries.includes(state.chain3)) state.chain3 = "";

    state.path = [state.chain1, state.chain2, state.chain3].filter(Boolean);
  };
  [...new Set(companies.map(company => company.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"))
    .forEach(type => typeSelect.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`));
  const countries = [...new Set(companies.flatMap(company => [...geographyFor(company).countries]))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  replaceOptions(countrySelect, "全部国家", countries, "中国");
  countrySelect.value = countries.includes("中国") ? "中国" : "";
  state.country = countrySelect.value;
  updateRegionOptions();
  const directoryMatchedCount = companies.filter(company => Array.isArray(company.patents) && company.patents.length > 0).length;
  document.getElementById("directoryTotalCompanies").textContent = numberFormat.format(companies.length);
  document.getElementById("directoryMatchedCompanies").textContent = numberFormat.format(directoryMatchedCount);
  document.getElementById("directorySupplementCompanies").textContent = numberFormat.format(companies.length - directoryMatchedCount);

  document.getElementById("directorySearch").addEventListener("input", event => { state.query = event.target.value.trim().toLocaleLowerCase("zh-CN"); state.page = 1; renderList(); });
  document.querySelectorAll("[data-directory-patent-status]").forEach(button => button.addEventListener("click", () => {
    const nextStatus = button.dataset.directoryPatentStatus;
    if (!["all", "patented", "unpatented"].includes(nextStatus) || nextStatus === state.patentStatus) return;
    state.patentStatus = nextStatus;
    state.page = 1;
    syncPatentStatusButtons();
    treeChart?.setOption(treeOption(), true);
    renderList();
  }));
  countrySelect.addEventListener("change", event => { state.country = event.target.value; state.province = ""; state.city = ""; state.page = 1; updateRegionOptions(); treeChart?.setOption(treeOption(), true); renderList(); });
  provinceSelect.addEventListener("change", event => { state.province = event.target.value; state.city = ""; state.page = 1; updateRegionOptions(); treeChart?.setOption(treeOption(), true); renderList(); });
  citySelect.addEventListener("change", event => { state.city = event.target.value; state.page = 1; treeChart?.setOption(treeOption(), true); renderList(); });
  typeSelect.addEventListener("change", event => { state.type = event.target.value; state.page = 1; treeChart?.setOption(treeOption(), true); renderList(); });
  technologySelect.addEventListener("change", event => { state.technology = event.target.value; state.page = 1; treeChart?.setOption(treeOption(), true); renderList(); });
  chain1Select.addEventListener("change", event => {
    state.chain1 = event.target.value; state.chain2 = ""; state.chain3 = ""; state.page = 1;
    expandedSecondary.clear();
    updateTagOptions(); treeChart?.setOption(treeOption(), true); renderList();
  });
  chain2Select.addEventListener("change", event => {
    state.chain2 = event.target.value; state.chain3 = ""; state.page = 1;
    expandedSecondary.clear();
    updateTagOptions(); treeChart?.setOption(treeOption(), true); renderList();
  });
  chain3Select.addEventListener("change", event => {
    state.chain3 = event.target.value; state.page = 1;
    if (state.chain3 && state.chain1 && state.chain2) expandedSecondary.add(keyFor([state.chain1, state.chain2]));
    updateTagOptions(); treeChart?.setOption(treeOption(), true); renderList();
  });
  document.getElementById("directorySort").addEventListener("change", event => { state.sort = event.target.value; state.page = 1; renderList(); });
  document.getElementById("directoryPrev").addEventListener("click", () => { if (state.page > 1) { state.page -= 1; renderList(); document.getElementById("directoryCompanyList").scrollTop = 0; } });
  document.getElementById("directoryNext").addEventListener("click", () => { const pages = Math.max(1, Math.ceil(filteredRecords().length / PAGE_SIZE)); if (state.page < pages) { state.page += 1; renderList(); document.getElementById("directoryCompanyList").scrollTop = 0; } });

  function resetDirectory() {
    state.path = []; state.query = ""; state.country = countries.includes("中国") ? "中国" : ""; state.province = ""; state.city = ""; state.type = "";
    state.technology = ""; state.chain1 = ""; state.chain2 = ""; state.chain3 = ""; state.patentStatus = "all"; state.sort = "scale"; state.page = 1;
    expandedSecondary.clear();
    document.getElementById("directorySearch").value = "";
    countrySelect.value = state.country;
    updateRegionOptions();
    updateTagOptions();
    typeSelect.value = "";
    technologySelect.value = "";
    chain1Select.value = "";
    syncPatentStatusButtons();
    document.getElementById("directorySort").value = "scale";
    if (treeChart) treeChart.setOption(treeOption(), true);
    if (records) renderList();
  }

  document.getElementById("directoryReset").addEventListener("click", resetDirectory);
  document.getElementById("directoryTreeReset").addEventListener("click", () => {
    expandedSecondary.clear();
    if (treeChart) treeChart.setOption(treeOption(), true);
  });
  function initializeDirectory() {
    if (directoryReady) return;
    directoryReady = true;
    records = companies.map(indexCompany);
    updateTagOptions();
    renderList();
  }

  document.querySelector('[data-enterprise-mode="directory"]').addEventListener("click", () => requestAnimationFrame(() => {
    initializeDirectory();
    ensureTree();
  }));
  window.addEventListener("resize", () => treeChart?.resize());

  document.getElementById("directoryCompanyList").innerHTML = '<div class="directory-empty"><strong>企业名单将在进入本页时加载</strong></div>';
})();
