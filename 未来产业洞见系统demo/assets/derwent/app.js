const DATA = window.FUSION_DASHBOARD_DATA;
    const WORLD_GEOJSON = window.FUSION_WORLD_GEOJSON;
    const COUNTRY_BOUNDARIES = window.FUSION_COUNTRY_BOUNDARIES;
    echarts.registerMap("fusion-world", WORLD_GEOJSON);

    const COLORS = ["#18324d", "#e9632d", "#f3aa2c", "#315c79", "#8c174f", "#4d8c98", "#4f8063", "#718092", "#b76a3d"];
    const TECH_COLORS = {B0:"#a2a9b1", B1:"#e9632d", B2:"#4f8063", B3:"#f3aa2c", B4:"#4d8c98", B5:"#8c174f", B6:"#b76a3d", B7:"#315c79", B8:"#391039", B9:"#718092", "未分类":"#a2a9b1"};
    const TECH_ROUTE_NAMES = {
      B1:"磁约束聚变 MCF",
      B2:"FRC 与紧凑环聚变",
      B3:"磁惯性聚变 MIF",
      B4:"惯性约束聚变 ICF",
      B5:"替代、非热及其他聚变路线",
      B6:"LENR 与凝聚态低能核反应",
      B7:"通用聚变支撑技术",
      B8:"聚变基础科学",
      B9:"潜力应用",
    };
    const INDUSTRY_CHAIN_GUIDE = {
      "上游":{
        title:"核心材料与基础部件",
        items:[
          {name:"第一壁材料 / 等离子体面对材料",description:"直接面对高温等离子体、高热流和中子辐照的材料与表面防护体系。",tags:["高纯钨板","钨合金","弥散强化钨","钼及钼合金","碳纤维复合材料","SiC/SiC 复合材料","低活化钢","ODS 钢"]},
          {name:"超导材料与超导磁体基础材料",description:"为高场磁体、超导线圈和大电流传输提供超导、稳定、绝缘及支撑材料。",tags:["Nb3Sn 超导线材","NbTi 超导线材","REBCO 高温超导带材","YBCO 带材","MgB2 超导材料","高纯无氧铜","电流引线材料","陶瓷绝缘层"]},
          {name:"包层、氚增殖和燃料循环相关材料",description:"服务于中子能量利用、氚增殖、阻渗、分离、回收和氘氚燃料管理的材料体系。",tags:["锂陶瓷","Li2TiO3","Li4SiO4","液态锂铅","PbLi","氚渗透阻挡层","氚吸附材料","氚分离与回收材料"]},
          {name:"冷却、耐热、耐辐照、真空和密封基础材料",description:"保障聚变设备在低温、高温、辐照、真空及腐蚀环境下可靠运行的基础材料。",tags:["液氦低温材料","低温绝热材料","高温合金","耐辐照合金","抗中子辐照材料","金属密封材料","陶瓷密封材料","耐腐蚀冷却回路材料"]},
        ],
      },
      "中游":{
        title:"关键设备、工程系统与装置集成",
        items:[
          {name:"核聚变反应堆与磁约束装置",description:"承载等离子体产生、约束、加热与控制的核心装置及堆内系统。",tags:["托卡马克","仿星器","球形托卡马克","聚变反应堆","偏滤器","氚增殖包层","真空室","中性束注入","射频加热","等离子体控制"]},
          {name:"聚变堆结构与磁体系统",description:"建立强磁场、承受电磁力并维持线圈和堆体结构稳定的工程系统。",tags:["环向场线圈","极向场线圈","中心螺线管","超导磁体","高场磁体","磁体支撑结构","超导接头","CICC 导体","高温超导电缆"]},
          {name:"聚变堆热管理、冷却与能量转换设备",description:"移除堆内热负荷、组织冷却介质循环并将聚变热能传递至能量转换环节。",tags:["第一壁冷却回路","液氦冷却系统","超临界 CO2 冷却","氦冷系统","液态金属冷却","主回路循环泵","聚变堆换热器","闭式氦气轮机"]},
          {name:"真空、抽气、密封、阀门与辅助系统",description:"保障真空环境、燃料处理、装置诊断、辐射防护与可维护性的工程配套系统。",tags:["高真空抽气机组","低温泵","真空隔离阀","快速切断阀","氘氚燃料循环","等离子体诊断","辐射屏蔽","远程与机器人维护","热室系统"]},
          {name:"惯性约束聚变和激光聚变设备",description:"围绕靶丸压缩、能量驱动和脉冲聚变过程构建的装置与实验系统。",tags:["激光聚变","ICF 惯性约束聚变","靶丸","黑腔","高功率激光驱动器","Z-pinch","磁化靶聚变"]},
        ],
      },
      "下游":{
        title:"能源转化、电站工程与终端应用",
        items:[
          {name:"核能发电与聚变电站应用",description:"将聚变能转化为可调度电力，并完成电站总体、并网和运行服务设计。",tags:["聚变电站总体设计","核能发电","基荷电力输出","聚变能并网","电网调频服务","能源转换","电力调度"]},
          {name:"核能供热与工业应用",description:"将核能高品位热量应用于城镇供暖、工业蒸汽和综合能源供应。",tags:["区域供热","工业蒸汽供应","高温热源利用","工业园区综合供能"]},
          {name:"核能高温制氢与燃料应用",description:"利用高温热源或核能电力制取氢气，并拓展至燃料与储能应用。",tags:["核能高温制氢","热化学硫碘循环","电解水耦合发电","氢气生产","氘氚燃料下游利用"]},
          {name:"核电工程与核电配套系统",description:"围绕电站建设、模块化施工、安全认证和核岛环境控制建立配套工程能力。",tags:["核电工程","模块化建造","安全认证体系","主控室通风","应急冷却风机","防爆风机","核岛通风","安全壳通风"]},
        ],
      },
    };
    const INDUSTRY_CHAIN_CARD_META = {
      "上游":{eyebrow:"UPSTREAM / SUPPLY FOUNDATION",mark:"Ⅰ",summary:"为聚变装置提供材料、涂层、导体、绝缘与密封等基础供给，核心判断依据是发明的创新点是否位于材料或基础部件。"},
      "中游":{eyebrow:"MIDSTREAM / ENGINEERING SYSTEM",mark:"Ⅱ",summary:"将聚变原理转化为可建造、可控制和可运行的装置，覆盖反应堆、关键设备、工程系统、控制方法与装置集成。"},
      "下游":{eyebrow:"DOWNSTREAM / ENERGY APPLICATION",mark:"Ⅲ",summary:"将聚变能转化为电力、热能或氢能，并延伸至电站建设、并网服务、核电配套工程与终端能源应用。"},
    };
    const TECHNOLOGY_CARD_GUIDE = [
      {code:"B1",title:"磁约束聚变 MCF",eyebrow:"MAGNETIC CONFINEMENT",mark:"B1",summary:"以磁场约束高温等离子体，覆盖托卡马克、仿星器及其加热、控制与工程系统。",tags:["托卡马克","仿星器","磁场约束","等离子体加热","稳态控制"]},
      {code:"B2",title:"FRC 与紧凑环聚变",eyebrow:"FRC / COMPACT TORUS",mark:"B2",summary:"围绕场反位形、紧凑环及等离子体团的形成、注入、合并、约束和维持展开。",tags:["FRC","紧凑环","Spheromak","等离子体注入","合并压缩"]},
      {code:"B3",title:"磁惯性聚变 MIF",eyebrow:"MAGNETO-INERTIAL FUSION",mark:"B3",summary:"结合预磁化等离子体与脉冲压缩，通过液态金属、等离子体衬层等实现快速增密加热。",tags:["磁惯性聚变","磁化靶聚变","脉冲压缩","等离子体衬层","液态金属压缩"]},
      {code:"B4",title:"惯性约束聚变 ICF",eyebrow:"INERTIAL CONFINEMENT",mark:"B4",summary:"利用激光或脉冲驱动器压缩靶丸与燃料，在极短时间内达到惯性约束聚变条件。",tags:["激光聚变","ICF","靶丸","黑腔","高功率激光","Z-pinch"]},
      {code:"B5",title:"替代、非热及其他聚变路线",eyebrow:"ALTERNATIVE FUSION ROUTES",mark:"B5",summary:"涵盖静电约束、束流聚变、聚变—裂变混合及其他无法归入主流路线的聚变方案。",tags:["IEC","Polywell","束流—靶聚变","非热聚变","聚变—裂变混合"]},
      {code:"B6",title:"LENR 与凝聚态低能核反应",eyebrow:"LOW-ENERGY NUCLEAR REACTION",mark:"B6",summary:"关注凝聚态体系、异常热及低输入能量条件下报告的低能核反应现象与装置。",tags:["LENR","凝聚态核反应","异常热","低能核反应"]},
      {code:"B7",title:"通用聚变支撑技术",eyebrow:"CROSS-ROUTE ENABLING SYSTEM",mark:"B7",summary:"为多条聚变路线提供材料、部件、诊断、低温、真空、换热、电源与远程维护能力。",tags:["超导与磁体","低温与真空","泵阀与密封","冷却与诊断","电源与维护"]},
      {code:"B8",title:"聚变基础科学",eyebrow:"FUSION FUNDAMENTAL SCIENCE",mark:"B8",summary:"研究等离子体、核反应、聚变截面和基础实验方法，尚未直接指向具体工程路线。",tags:["等离子体物理","核反应基础","聚变截面","基础实验","理论模型"]},
      {code:"B9",title:"潜力应用",eyebrow:"POTENTIAL FUSION APPLICATION",mark:"B9",summary:"技术本身具有跨行业属性，但其材料、部件或方法具备明确的聚变工程应用潜力。",tags:["潜力材料","潜力部件","潜力工艺","跨领域赋能"]},
    ];
    const INFOGRAPHIC_CARDS = [
      {src:"assets/derwent/knowledge-cards/01_artificial_sun.png",kicker:"终极能源",title:"人造太阳"},
      {src:"assets/derwent/knowledge-cards/02_energy_coordinate.png",kicker:"能源坐标",title:"能源版图的终极拼图"},
      {src:"assets/derwent/knowledge-cards/03_fusion_principle.png",kicker:"原理极简",title:"一克燃料，千万吨煤"},
      {src:"assets/derwent/knowledge-cards/05_global_milestones.png",kicker:"全球里程碑",title:"60年长征，人造太阳从未如此接近"},
      {src:"assets/derwent/knowledge-cards/07_tokamak_components.png",kicker:"设备拆解",title:"托卡马克的“五脏六腑”"},
    ];
    echarts.registerTheme("fusion-lens",{
      color:COLORS,
      backgroundColor:"transparent",
      textStyle:{fontFamily:'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',color:"#718092"},
      categoryAxis:{axisLine:{lineStyle:{color:"rgba(21,35,55,.18)"}},axisLabel:{color:"#718092"},splitLine:{lineStyle:{color:"rgba(21,35,55,.08)"}}},
      valueAxis:{axisLine:{lineStyle:{color:"rgba(21,35,55,.18)"}},axisLabel:{color:"#718092"},splitLine:{lineStyle:{color:"rgba(21,35,55,.08)"}}},
    });
    const techLabels = {
      ...(DATA.technologyLabels || {}),
      ...Object.fromEntries(Object.entries(TECH_ROUTE_NAMES).map(([code,name])=>[code,`[${code}] ${name}`])),
    };
    const nodeById = new Map(DATA.nodes.map((node) => [node.id, node]));
    const charts = new Map();
    let yearTimer = null;
    let matrixYearTimer = null;
    let renderFrame = null;
    const matrix3D = {
      initialized:false,
      scene:null,
      renderer:null,
      camera:null,
      dataGroup:null,
      meshes:[],
      model:null,
      raycaster:null,
      pointer:null,
      target:null,
      bounds:null,
      fitBounds:null,
      boundsRadius:0,
      resizeObserver:null,
      theta:.72,
      phi:1.02,
      radius:58,
      dragging:false,
      dragDistance:0,
      startX:0,
      startY:0,
      lastX:0,
      lastY:0,
      hovered:null,
    };

    const state = {
      view: "world",
      yearStart: Number(DATA.stats.minYear),
      yearEnd: Number(DATA.stats.maxYear),
      technology: "",
      industry1: "",
      applicantType: "",
      country: "",
      province: "",
      pathGroup: "DIVERSE_SPC",
      activePathIndex: 0,
      matrixView: "3d",
      matrixPeriodIndex: null,
      riverMode: "count",
      worldTrendMode: "country",
      worldLayers: {flows:true, bubbles:true, labels:true},
    };
    const countryTrendSelected = new Set(["中国","美国","日本","韩国","德国","英国"]);

    const countryCoordinates = {
      "中国":[104,35],"日本":[138,37],"美国":[-100,38],"德国":[10,51],"俄罗斯":[76,60],"韩国":[128,36],"英国":[-3,55],"法国":[2,47],"意大利":[12,42],"加拿大":[-106,57],"澳大利亚":[134,-25],"瑞士":[8,47],"奥地利":[14,47],"巴西":[-52,-10],"印度":[79,22],"西班牙":[-4,40],"荷兰":[5,52],"瑞典":[16,62],"比利时":[4,51],"捷克":[15,50],"匈牙利":[19,47],"芬兰":[26,64],"罗马尼亚":[25,46],"以色列":[35,31],"新西兰":[174,-41],"南非":[24,-29],"墨西哥":[-102,23],"挪威":[10,62],"东德":[12,52],"哈萨克斯坦":[68,48],"波兰":[19,52],"乌克兰":[31,49],"新加坡":[104,1],"列支敦士登":[10,47],"丹麦":[10,56],"斯洛伐克":[20,49],"捷克斯洛伐克":[17,49],"格鲁吉亚":[44,42],"白俄罗斯":[28,54],"拉脱维亚":[25,57],"马来西亚":[102,4],"越南":[108,16],"摩尔多瓦":[29,47],"吉尔吉斯斯坦":[75,41],"希腊":[22,39],"印度尼西亚":[118,-2],"保加利亚":[25,43],"沙特阿拉伯":[45,24],"欧盟":[5,50],"国际（PCT）":[-24,4],"欧亚专利组织":[45,53],"阿根廷":[-64,-34],"智利":[-71,-33],"葡萄牙":[-8,39],"土耳其":[35,39],"泰国":[101,15],"菲律宾":[122,13],"爱尔兰":[-8,53],"卢森堡":[6,50],"斯洛文尼亚":[15,46],"克罗地亚":[16,45],"塞尔维亚":[21,44],"爱沙尼亚":[25,59],"立陶宛":[24,55],"阿联酋":[54,24]
    };
    const provinceCoordinates = {
      "北京":[116.40,39.90],"天津":[117.20,39.12],"河北":[114.50,38.04],"山西":[112.55,37.87],"内蒙古":[111.75,40.84],"辽宁":[123.43,41.80],"吉林":[125.32,43.90],"黑龙江":[126.64,45.76],"上海":[121.47,31.23],"江苏":[118.80,32.06],"浙江":[120.15,30.27],"安徽":[117.28,31.86],"福建":[119.30,26.08],"江西":[115.86,28.68],"山东":[117.02,36.67],"河南":[113.63,34.75],"湖北":[114.30,30.59],"湖南":[112.94,28.23],"广东":[113.27,23.13],"广西":[108.32,22.82],"海南":[110.35,20.02],"重庆":[106.55,29.56],"四川":[104.07,30.67],"贵州":[106.71,26.58],"云南":[102.71,25.04],"西藏":[91.11,29.65],"陕西":[108.95,34.27],"甘肃":[103.83,36.06],"青海":[101.78,36.62],"宁夏":[106.23,38.49],"新疆":[87.62,43.82],"台湾":[121.00,23.70],"香港":[114.17,22.32],"澳门":[113.54,22.20]
    };
    const cityCoordinates = {
      "北京":[116.40,39.90],"上海":[121.47,31.23],"天津":[117.20,39.12],"重庆":[106.55,29.56],"深圳":[114.06,22.55],"广州":[113.27,23.13],"南京":[118.80,32.06],"苏州":[120.58,31.30],"杭州":[120.15,30.27],"宁波":[121.55,29.87],"合肥":[117.28,31.86],"武汉":[114.30,30.59],"长沙":[112.94,28.23],"成都":[104.07,30.67],"西安":[108.95,34.27],"沈阳":[123.43,41.80],"大连":[121.61,38.91],"长春":[125.32,43.90],"哈尔滨":[126.64,45.76],"济南":[117.02,36.67],"青岛":[120.38,36.07],"郑州":[113.63,34.75],"石家庄":[114.50,38.04],"太原":[112.55,37.87],"福州":[119.30,26.08],"厦门":[118.09,24.48],"南昌":[115.86,28.68],"昆明":[102.71,25.04],"贵阳":[106.71,26.58],"南宁":[108.32,22.82],"海口":[110.35,20.02],"兰州":[103.83,36.06],"银川":[106.23,38.49],"西宁":[101.78,36.62],"乌鲁木齐":[87.62,43.82],"呼和浩特":[111.75,40.84],"珠海":[113.58,22.27],"东莞":[113.75,23.02],"无锡":[120.31,31.49],"常州":[119.97,31.81],"佛山":[113.12,23.02]
    };

    function esc(value) {
      return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
    }
    function fmt(value) {
      const number = Number(value);
      return Number.isFinite(number) ? number.toLocaleString("zh-CN") : String(value == null ? "-" : value);
    }
    function short(value, length=16) {
      const text = String(value || "");
      return text.length > length ? `${text.slice(0, length)}…` : text;
    }
    function splitValues(value) {
      return Array.from(new Set(String(value || "").split(/[;；\n、|]+/).map((item) => item.trim()).filter(Boolean)));
    }
    function normalizeApplicantType(value) {
      return ["私企","国企"].includes(value) ? "企业" : value;
    }
    function applicantTypesOf(node) {
      const values=splitValues(node?.applicantType).map(normalizeApplicantType);
      return Array.from(new Set(values.length?values:["未标注"]));
    }
    function splitIndustryLevel2(value) {
      return Array.from(new Set(String(value || "").split(/[;；\n|]+/).map((item) => item.trim()).filter(Boolean)));
    }
    function normalizeProvince(value) {
      const text = String(value || "").replace(/省$|市$|特别行政区$/g, "").replace(/壮族自治区$|维吾尔自治区$|回族自治区$|自治区$/g, "");
      return ({"广西壮族":"广西","新疆维吾尔":"新疆","宁夏回族":"宁夏","内蒙古":"内蒙古","中国台湾":"台湾"})[text] || text;
    }
    function countriesOf(node) {
      const values = splitValues(node.applicantCountry);
      const normalized=(values.length?values:[node.country||"未知"]).map((value)=>["苏联","SU"].includes(value)?"俄罗斯":value);
      return Array.from(new Set(normalized));
    }
    function primaryCountry(node) {
      const values = countriesOf(node || {});
      return values.find((value) => value !== "国际（PCT）" && value !== "未知") || values[0] || "未知";
    }
    function provincesOf(node) { return splitValues(node.province).map(normalizeProvince).filter(Boolean); }
    function citiesOf(node) { return splitValues(node.city).map((value) => value.replace(/市$|地区$/g, "")).filter(Boolean); }
    function techLabel(code) { return techLabels[code] || code || "未分类"; }
    function countBy(items, accessor) {
      const counts = new Map();
      items.forEach((item) => {
        const raw = accessor(item);
        const keys = Array.isArray(raw) ? raw : [raw];
        Array.from(new Set(keys.filter(Boolean))).forEach((key) => counts.set(key, (counts.get(key) || 0) + 1));
      });
      return Array.from(counts, ([key,count]) => ({key,count})).sort((a,b) => b.count - a.count || String(a.key).localeCompare(String(b.key), "zh-CN"));
    }
    function leadingDisplayYear(items, fallback=state.yearStart) {
      const years=items.map((item)=>Number(item?.year)).filter(Number.isFinite);
      return (years.length?Math.min(...years):Number(fallback))-1;
    }
    function matchesGlobal(node) {
      if (node.year == null) return state.yearStart === Number(DATA.stats.minYear) && state.yearEnd === Number(DATA.stats.maxYear);
      if (node.year < state.yearStart || node.year > state.yearEnd) return false;
      if (state.technology && node.technologyDimension !== state.technology) return false;
      if (state.industry1 && node.industryDimension !== state.industry1) return false;
      if (state.applicantType && !applicantTypesOf(node).includes(state.applicantType)) return false;
      return true;
    }
    function worldBaseNodes() { return DATA.nodes.filter(matchesGlobal); }
    function worldSelectedNodes() {
      const nodes = worldBaseNodes();
      return state.country ? nodes.filter((node) => countriesOf(node).includes(state.country)) : nodes;
    }
    function isChinaNode(node) { return countriesOf(node).includes("中国"); }
    function chinaBaseNodes() { return DATA.nodes.filter((node) => isChinaNode(node) && matchesGlobal(node)); }
    function chinaSelectedNodes() {
      const nodes = chinaBaseNodes();
      return state.province ? nodes.filter((node) => provincesOf(node).includes(state.province)) : nodes;
    }
    function edgeSubset(nodes) {
      const ids = new Set(nodes.map((node) => node.id));
      return DATA.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
    }
    function aggregateCountryFlows(nodes) {
      const ids = new Set(nodes.map((node) => node.id));
      const flows = new Map();
      DATA.edges.forEach((edge) => {
        if (!ids.has(edge.source) || !ids.has(edge.target)) return;
        const source = primaryCountry(nodeById.get(edge.source));
        const target = primaryCountry(nodeById.get(edge.target));
        if (!countryCoordinates[source] || !countryCoordinates[target] || source === target) return;
        const key = `${source}\u0000${target}`;
        flows.set(key, (flows.get(key) || 0) + Math.max(1, Number(edge.weight) || 1));
      });
      return Array.from(flows, ([key,count]) => { const [source,target] = key.split("\u0000"); return {source,target,count}; }).sort((a,b) => b.count - a.count);
    }
    function chart(id) {
      if (!charts.has(id)) charts.set(id, echarts.init(document.getElementById(id), "fusion-lens", {renderer:"canvas"}));
      return charts.get(id);
    }
    function applyChart(id, option, clickHandler) {
      const instance = chart(id);
      instance.setOption(option, {notMerge:true, lazyUpdate:true});
      instance.off("click");
      if (clickHandler) instance.on("click", clickHandler);
    }
    function tooltipBase() {
      return {backgroundColor:"rgba(21,35,55,.95)", borderWidth:0, padding:[8,10], textStyle:{color:"#fff",fontSize:10}, extraCssText:"box-shadow:0 12px 32px rgba(21,35,55,.2);border-radius:2px"};
    }
    function axisLabel() { return {color:"#718092",fontSize:9}; }
    function renderKpis(targetId, items) {
      document.getElementById(targetId).innerHTML = items.map(([label,value,note]) => `<div class="kpi"><span>${esc(label)}</span><strong>${fmt(value)}</strong><small>${esc(note || "")}</small></div>`).join("");
    }
    function renderActiveFilters() {
      const shared = [state.technology && techLabel(state.technology), state.industry1, state.applicantType, `${state.yearStart}-${state.yearEnd}`].filter(Boolean);
      const world = [...shared, state.country && `国家 ${state.country}`].filter(Boolean);
      const china = [...shared, state.province && `省份 ${state.province}`].filter(Boolean);
      document.getElementById("worldActiveFilters").innerHTML = world.map((value) => `<span class="filter-chip">${esc(value)}</span>`).join("");
      document.getElementById("chinaActiveFilters").innerHTML = china.map((value) => `<span class="filter-chip">${esc(value)}</span>`).join("");
    }
    function barOption(rows, labelFormatter=(value)=>value, color=COLORS[0], limit=12) {
      const shown = rows.slice(0, limit).reverse();
      return {
        animationDuration:450,
        grid:{left:12,right:48,top:12,bottom:12,containLabel:true},
        tooltip:{...tooltipBase(),trigger:"axis",axisPointer:{type:"shadow"}},
        xAxis:{type:"value",show:false},
        yAxis:{type:"category",data:shown.map((row)=>labelFormatter(row.key)),axisLine:{show:false},axisTick:{show:false},axisLabel:{...axisLabel(),width:118,overflow:"truncate"}},
        series:[{type:"bar",name:"专利族",data:shown.map((row,index)=>({value:row.count,itemStyle:{color:typeof color === "function" ? color(row, shown.length - index - 1) : color}})),barWidth:8,showBackground:true,backgroundStyle:{color:"rgba(21,35,55,.06)"},label:{show:true,position:"right",color:"#596979",fontSize:9,formatter:(p)=>fmt(p.value)}}]
      };
    }
    function donutOption(rows, centerText) {
      const shown = rows.slice(0,8);
      return {
        color:COLORS,
        tooltip:{...tooltipBase(),trigger:"item",formatter:(p)=>`${esc(p.name)}<br><b>${fmt(p.value)}</b> · ${p.percent}%`},
        legend:{type:"scroll",orient:"vertical",right:8,top:"middle",textStyle:{color:"#65716d",fontSize:9},pageTextStyle:{fontSize:8}},
        graphic:[{type:"text",left:"28%",top:"44%",style:{text:centerText,textAlign:"center",fill:"#152337",fontSize:14,fontWeight:650}},{type:"text",left:"28%",top:"54%",style:{text:"专利族",textAlign:"center",fill:"#929ca7",fontSize:8}}],
        series:[{type:"pie",radius:["53%","76%"],center:["30%","50%"],avoidLabelOverlap:true,itemStyle:{borderColor:"#fff",borderWidth:2},label:{show:false},data:shown.map((row)=>({name:row.key,value:row.count}))}]
      };
    }

    function renderWorldTrend(nodes, countryRows) {
      const mode=state.worldTrendMode;
      const modeConfig={
        country:{
          title:"国家专利年度趋势",
          subtitle:"完整国家 / 地区清单 · 点击图例添加或移除折线",
          axisName:"专利族",
          selected:state.country,
          scope:state.country||"全球",
          values:(node)=>countriesOf(node),
        },
        industry:{
          title:"上中下游年度趋势",
          subtitle:"产业链一级标签 / 专利族数量 / 年度",
          axisName:"专利族",
          selected:state.industry1,
          scope:state.country?`${state.country} · 上中下游`:"全球 · 上中下游",
          values:(node)=>splitValues(node.industryDimension).filter((value)=>["上游","中游","下游"].includes(value)),
        },
        applicant:{
          title:"机构类型年度趋势",
          subtitle:"当前权利人类型 / 专利族数量 / 年度",
          axisName:"专利族",
          selected:state.applicantType,
          scope:state.country?`${state.country} · 企业类型`:"全球 · 企业类型",
          values:applicantTypesOf,
        },
      }[mode];
      let scopedNodes=nodes;
      if(mode!=="country"&&state.country){
        scopedNodes=nodes.filter((node)=>countriesOf(node).includes(state.country));
      }
      let categories;
      if(mode==="country"){
        categories=countryRows.filter((row)=>row.key!=="未知").map((row)=>row.key);
        if(state.country) countryTrendSelected.add(state.country);
      }else if(mode==="industry"){
        categories=["上游","中游","下游"].filter((value)=>scopedNodes.some((node)=>modeConfig.values(node).includes(value)));
      }else{
        categories=countBy(scopedNodes,modeConfig.values).slice(0,7).map((row)=>row.key);
      }
      if(modeConfig.selected&&!categories.includes(modeConfig.selected)) categories.push(modeConfig.selected);
      const relevantNodes=scopedNodes.filter((node)=>node.year!=null&&modeConfig.values(node).some((value)=>categories.includes(value)));
      const displayStart=leadingDisplayYear(relevantNodes);
      const years=[];
      for(let year=displayStart;year<=state.yearEnd;year+=1) years.push(year);
      const counts=new Map();
      scopedNodes.forEach((node)=>{
        if(node.year==null||node.year<state.yearStart||node.year>state.yearEnd) return;
        modeConfig.values(node).forEach((value)=>{
          if(!categories.includes(value)) return;
          const key=`${value}\u0000${node.year}`;
          counts.set(key,(counts.get(key)||0)+1);
        });
      });
      const industryColors={上游:"#315c79",中游:"#4d8c98",下游:"#e9632d"};
      const colors=categories.map((category,index)=>{
        if(mode==="industry") return industryColors[category]||COLORS[index%COLORS.length];
        if(mode==="applicant") return matrixApplicantColor(category,index);
        return state.country===category?COLORS[1]:COLORS[index%COLORS.length];
      });
      document.getElementById("worldTrendTitle").textContent=modeConfig.title;
      const trendSubtitle=document.getElementById("worldTrendSubtitle");
      trendSubtitle.textContent=modeConfig.subtitle;
      trendSubtitle.hidden=!modeConfig.subtitle;
      trendSubtitle.closest(".panel-head")?.classList.toggle("compact-head",!modeConfig.subtitle);
      document.getElementById("countrySelection").textContent=modeConfig.scope;
      const legendSelected=mode==="country"
        ? Object.fromEntries(categories.map((category)=>[category,countryTrendSelected.has(category)]))
        : undefined;
      applyChart("countryRanking",{
        color:colors,
        tooltip:{...tooltipBase(),textStyle:{color:"#fff",fontSize:12},trigger:"axis",order:"valueDesc"},
        legend:{type:"scroll",top:10,left:14,right:14,itemWidth:18,itemHeight:9,itemGap:18,selected:legendSelected,textStyle:{fontSize:12,color:"#526272"},pageTextStyle:{fontSize:11,color:"#65716d"}},
        grid:{left:58,right:22,top:66,bottom:52},
        xAxis:{type:"category",boundaryGap:false,data:years,axisLine:{lineStyle:{color:"#ccd4d1"}},axisTick:{show:false},axisLabel:{...axisLabel(),fontSize:11,interval:"auto"}},
        yAxis:{type:"value",name:modeConfig.axisName,nameTextStyle:{...axisLabel(),fontSize:11},axisLine:{show:false},axisTick:{show:false},axisLabel:{...axisLabel(),fontSize:11},splitLine:{lineStyle:{color:"#e7ecea"}}},
        dataZoom:[{type:"inside"},{type:"slider",height:14,bottom:8,borderColor:"transparent",backgroundColor:"rgba(21,35,55,.06)",fillerColor:"rgba(233,99,45,.16)",handleStyle:{color:"#e9632d"},textStyle:{fontSize:10}}],
        series:categories.map((category,index)=>({
          name:category,
          type:"line",
          smooth:.22,
          showSymbol:false,
          symbolSize:5,
          data:years.map((year)=>counts.get(`${category}\u0000${year}`)||0),
          lineStyle:{
            width:modeConfig.selected===category?2.8:index<3?2:1.25,
            opacity:modeConfig.selected && modeConfig.selected!==category ? .22 : 1,
          },
          areaStyle:index===0&&!modeConfig.selected?{opacity:.055}:undefined,
          emphasis:{focus:"series"},
        }))
      },(params)=>{
        if(!categories.includes(params.seriesName)) return;
        if(mode==="country") state.country=state.country===params.seriesName?"":params.seriesName;
        if(mode==="industry") state.industry1=state.industry1===params.seriesName?"":params.seriesName;
        if(mode==="applicant") state.applicantType=state.applicantType===params.seriesName?"":params.seriesName;
        scheduleRender();
      });
      const trendChart=chart("countryRanking");
      trendChart.off("legendselectchanged");
      if(mode==="country") trendChart.on("legendselectchanged",(params)=>{
        Object.entries(params.selected||{}).forEach(([name,selected])=>{
          if(selected) countryTrendSelected.add(name);
          else countryTrendSelected.delete(name);
        });
      });
    }

    function renderWorldMap() {
      const baseNodes = worldBaseNodes();
      const mapElement=document.getElementById("worldMap");
      const mapWidth=Math.max(1,mapElement.clientWidth);
      const mapHeight=Math.max(1,mapElement.clientHeight);
      const mapBase=Math.min(mapWidth,mapHeight);
      const mapTargetWidth=Math.min(mapWidth*.94,mapHeight*2.05);
      const mapLayoutSize=`${Math.round(mapTargetWidth/mapBase*100)}%`;
      const countryRows = countBy(baseNodes, countriesOf).filter((row) => countryCoordinates[row.key]);
      const maxCountry = Math.max(1, ...countryRows.map((row) => row.count));
      const allFlows = aggregateCountryFlows(baseNodes);
      const flows = (
        state.country
          ? allFlows.filter((row) => row.source === state.country || row.target === state.country)
          : allFlows
      ).slice(0, state.country ? 60 : 42);
      const maxFlow = Math.max(1, ...flows.map((row) => row.count));
      const bubbleData = state.worldLayers.bubbles ? countryRows.map((row) => ({name:row.key,value:[...countryCoordinates[row.key],row.count],selected:state.country===row.key,itemStyle:{color:state.country===row.key?"#e9632d":"#315c79"}})) : [];
      const lineData = state.worldLayers.flows ? flows.map((row) => {
        const strength=Math.sqrt(row.count/maxFlow);
        return {name:`${row.source} → ${row.target}`,coords:[countryCoordinates[row.source],countryCoordinates[row.target]],value:row.count,lineStyle:{width:.18+2.65*strength,opacity:(state.country?.14:.09)+(state.country?.2:.16)*strength}};
      }) : [];
      applyChart("worldMap", {
        animationDuration:700,
        backgroundColor:"#fbf8f3",
        tooltip:{...tooltipBase(),trigger:"item",formatter:(p)=>{
          if (p.seriesName === "国家专利族") return `${esc(p.name)}<br><b>${fmt(p.value[2])}</b> 个专利族`;
          if (p.seriesName === "跨国引用") return `${esc(p.name)}<br><b>${fmt(p.value)}</b> 次引用`;
          return p.name || "";
        }},
        geo:{map:"fusion-world",roam:true,scaleLimit:{min:1,max:8},aspectScale:1,layoutCenter:["50%","50%"],layoutSize:mapLayoutSize,itemStyle:{areaColor:"#e9e3da",borderColor:"#d5cec5",borderWidth:.45},emphasis:{disabled:true},silent:true},
        series:[
          {name:"行政边界",type:"lines",coordinateSystem:"geo",polyline:true,silent:true,data:COUNTRY_BOUNDARIES,lineStyle:{color:"#b9afa5",width:.42,opacity:.55},z:2},
          {name:"跨国引用",type:"lines",coordinateSystem:"geo",data:lineData,symbol:["none","arrow"],symbolSize:3.5,lineStyle:{color:"#315c79",curveness:.18},effect:{show:state.worldLayers.flows,period:8,trailLength:.1,symbolSize:1.5,color:"rgba(233,99,45,.74)"},z:3},
          {name:"国家专利族",type:"scatter",coordinateSystem:"geo",data:bubbleData,symbolSize:(value)=>Math.min(31,5+25*Math.sqrt(value[2]/maxCountry)),itemStyle:{opacity:.78,borderColor:"#fffdf9",borderWidth:1},label:{show:state.worldLayers.labels,position:"top",distance:5,color:"#152337",fontSize:8,formatter:(p)=>p.value[2]>=maxCountry*.025||p.data.selected?p.name:""},emphasis:{scale:1.15,itemStyle:{opacity:.95,borderWidth:2}},z:5}
        ]
      }, (params) => {
        if (params.seriesName !== "国家专利族") return;
        state.country = state.country === params.name ? "" : params.name;
        scheduleRender();
      });
    }
    function renderCitationNetwork(nodes) {
      const technologyLanes=["B1","B2","B3","B4","B5","B6","B7","B8","B9"];
      const activePath=getActivePath();
      const useIndustryLevel2=/^B[1-6]$/.test(state.pathGroup);
      const hasNetworkClassification=(node)=>useIndustryLevel2
        ? splitIndustryLevel2(node?.industryLevel2).length>0
        : technologyLanes.includes(node?.technologyDimension);
      const filteredRouteNodes=nodes.filter((node)=>hasNetworkClassification(node)&&(!useIndustryLevel2||node.technologyDimension===state.pathGroup));
      const routeNodes=filteredRouteNodes;
      const laneSourceNodes=useIndustryLevel2?DATA.nodes.filter((node)=>node.technologyDimension===state.pathGroup&&hasNetworkClassification(node)):routeNodes;
      let lanes=technologyLanes;
      let laneForNode=(node)=>node.technologyDimension;
      let laneColors=new Map(technologyLanes.map((lane)=>[lane,TECH_COLORS[lane]||COLORS[0]]));
      if(useIndustryLevel2){
        const level2Rows=countBy(laneSourceNodes,(node)=>splitIndustryLevel2(node.industryLevel2));
        const topLevel2=level2Rows.slice(0,10).map((row)=>row.key);
        const hasOverflow=level2Rows.length>topLevel2.length;
        lanes=[...topLevel2,...(hasOverflow?["其余二级指标（Top 10外）"]:[])];
        laneForNode=(node)=>{
          const values=splitIndustryLevel2(node.industryLevel2);
          return values.find((value)=>topLevel2.includes(value))||"其余二级指标（Top 10外）";
        };
        laneColors=new Map(lanes.map((lane,index)=>[lane,COLORS[index%COLORS.length]]));
      }
      const ranked=[...routeNodes].filter((node)=>node.year!=null).sort((a,b)=>(Number(b.adjacentEdgeSpc)||0)-(Number(a.adjacentEdgeSpc)||0)||(b.degree||0)-(a.degree||0));
      const picked=[];
      const pickedIds=new Set();
      const pathNodes=(activePath?.nodes||[]).map((id)=>nodeById.get(id)).filter(hasNetworkClassification);
      const activePathIds=new Set(pathNodes.map((node)=>node.id));
      const activeEdgeKeys=new Set((activePath?.edges||[]).filter(([source,target])=>activePathIds.has(source)&&activePathIds.has(target)).map(([source,target])=>`${source}\u0000${target}`));
      [...pathNodes,...ranked].forEach((node)=>{if(picked.length<280&&!pickedIds.has(node.id)){picked.push(node);pickedIds.add(node.id);}});
      const maxSpc=Math.max(1,...picked.map((node)=>Number(node.adjacentEdgeSpc)||0));
      const positions=new Map();
      picked.forEach((node,index)=>{
        const laneName=laneForNode(node);
        const lane=Math.max(0,lanes.indexOf(laneName));
        const pathPosition=(activePath?.nodes||[]).indexOf(node.id);
        const jitter=pathPosition>=0?0:((((index*37)%17)-8)/28);
        positions.set(node.id,[Number(node.year)||state.yearStart,lane+jitter]);
      });
      const contextPointData=picked.filter((node)=>!activePathIds.has(node.id)).map((node)=>{
        const laneName=laneForNode(node);
        const score=Number(node.adjacentEdgeSpc)||0;
        return {name:node.label,nodeId:node.id,value:[...positions.get(node.id),score],symbolSize:Math.min(9,3+5.5*Math.sqrt(score/maxSpc)),itemStyle:{color:laneColors.get(laneName)||COLORS[0],opacity:.58,borderColor:"#fff",borderWidth:.7}};
      });
      const pathStep=Math.max(1,Math.ceil(pathNodes.length/8));
      const foregroundNodes=pathNodes.map((node,index)=>{
        const score=Number(node.adjacentEdgeSpc)||0;
        const endpoint=index===0||index===pathNodes.length-1;
        const labelPosition=index===0?"right":index===pathNodes.length-1?"left":index%2?"bottom":"top";
        return {name:node.label,nodeId:node.id,pathOrder:index+1,value:[...positions.get(node.id),score],symbolSize:endpoint?15:10+3*Math.sqrt(score/maxSpc),itemStyle:{color:endpoint?(index===0?COLORS[1]:COLORS[0]):COLORS[2],borderColor:"#fff",borderWidth:2.2,shadowBlur:9,shadowColor:"rgba(23,32,30,.24)"},label:{show:endpoint||index%pathStep===0,position:labelPosition,distance:7,formatter:short(node.label,13),fontSize:8,color:"#26332f",backgroundColor:"rgba(255,255,255,.88)",padding:[2,3],borderRadius:2}};
      });
      const contextEdges=DATA.edges.filter((edge)=>pickedIds.has(edge.source)&&pickedIds.has(edge.target)&&!activeEdgeKeys.has(`${edge.source}\u0000${edge.target}`)).sort((a,b)=>(b.spc||0)-(a.spc||0)).slice(0,560).map((edge)=>({coords:[positions.get(edge.source),positions.get(edge.target)],value:edge.spc,lineStyle:{width:Math.min(1.35,.3+Math.log1p(Number(edge.spc)||0)/10),opacity:.07+Math.min(.13,Math.log1p(Number(edge.spc)||0)/80)}}));
      const edgeByKey=new Map(DATA.edges.map((edge)=>[`${edge.source}\u0000${edge.target}`,edge]));
      const foregroundEdges=(activePath?.edges||[]).map(([source,target],index)=>{
        const edge=edgeByKey.get(`${source}\u0000${target}`)||{};
        const value=activePath?.scoreLabel==="SPNP"?(edge.spnp||0):(edge.spc||0);
        return {name:`${nodeById.get(source)?.label||source} → ${nodeById.get(target)?.label||target}`,coords:[positions.get(source),positions.get(target)],value,pathOrder:index+1,lineStyle:{width:3.1,opacity:.92}};
      }).filter((edge)=>edge.coords[0]&&edge.coords[1]);
      const plottedYears=picked.map((node)=>Number(node.year)).filter(Number.isFinite);
      const minYear=(plottedYears.length?Math.min(...plottedYears):state.yearStart)-1;
      const maxYear=Math.max(state.yearEnd,...plottedYears);
      const pathLabel=activePath?`${activePath.scoreLabel} #${activePath.rank}`:"未选择路径";
      applyChart("citationNetwork", {
        animationDuration:650,
        backgroundColor:"#fbf8f3",
        tooltip:{...tooltipBase(),formatter:(p)=>{
          if(p.data?.nodeId){const node=nodeById.get(p.data.nodeId);return `<b>${esc(node.label)}</b><br>${esc(node.title||"无题名")}<br>${esc(techLabel(node.technologyDimension))}<br>前向 SPC ${fmt(node.inEdgeSpc)} · 后向 SPC ${fmt(node.outEdgeSpc)}`;}
          if(p.seriesName===pathLabel)return `<b>${esc(p.data.name||pathLabel)}</b><br>${esc(activePath?.scoreLabel||"")} 线段值 ${fmt(p.data.value)}`;
          return `背景边 SPC ${fmt(p.data?.value||0)}`;
        }},
        grid:{left:useIndustryLevel2?190:238,right:20,top:30,bottom:48},
        xAxis:{type:"value",min:minYear,max:maxYear,minInterval:1,axisLine:{lineStyle:{color:"rgba(21,35,55,.18)"}},axisTick:{show:false},axisLabel:{...axisLabel(),formatter:(value)=>String(Math.round(value))},splitLine:{lineStyle:{color:"rgba(21,35,55,.07)"}}},
        yAxis:{type:"value",min:-.6,max:lanes.length-.4,interval:1,inverse:true,axisLine:{show:false},axisTick:{show:false},axisLabel:{...axisLabel(),fontWeight:650,lineHeight:11,width:useIndustryLevel2?166:210,overflow:useIndustryLevel2?"truncate":"break",formatter:(value)=>{const lane=lanes[Math.round(value)]||"";return useIndustryLevel2?lane:(TECH_ROUTE_NAMES[lane]||lane);}},splitLine:{show:false},splitArea:{show:true,areaStyle:{color:["rgba(233,99,45,.022)","rgba(21,35,55,.012)"]}}},
        dataZoom:[{type:"inside",xAxisIndex:0},{type:"slider",xAxisIndex:0,height:14,bottom:8,borderColor:"transparent",backgroundColor:"rgba(21,35,55,.06)",fillerColor:"rgba(233,99,45,.15)",handleStyle:{color:"#e9632d"},textStyle:{fontSize:8}}],
        series:[
          {name:"背景引文",type:"lines",coordinateSystem:"cartesian2d",silent:true,data:contextEdges,lineStyle:{color:"#718092",curveness:.08},z:1},
          {name:"相关专利",type:"scatter",data:contextPointData,itemStyle:{color:"#718092"},emphasis:{scale:1.5,itemStyle:{opacity:1}},z:2},
          {name:pathLabel,type:"lines",coordinateSystem:"cartesian2d",data:foregroundEdges,symbol:["none","arrow"],symbolSize:7,lineStyle:{color:COLORS[2],curveness:.04},effect:{show:true,period:5,trailLength:.16,symbol:"circle",symbolSize:3,color:COLORS[1]},z:5},
          {name:pathLabel,type:"effectScatter",data:foregroundNodes,rippleEffect:{scale:2,brushType:"stroke"},itemStyle:{color:COLORS[2]},z:6}
        ]
      },(params)=>{
        if(params.data?.nodeId){openNodeInspector(nodeById.get(params.data.nodeId));return;}
      });
    }
    const MATRIX_APPLICANT_COLORS={
      "研究所":"#2a8c78",
      "高校":"#e9632d",
      "企业":"#f3aa2c",
      "个人":"#315c79",
      "政府":"#718092",
      "待核验":"#b76a3d",
      "主体信息缺失":"#a2a9b1",
      "未标注":"#929ca7",
      "未知":"#929ca7",
    };
    function matrixApplicant(node) {
      return applicantTypesOf(node)[0]||"未标注";
    }
    function matrixApplicantColor(applicant,index=0) {
      return MATRIX_APPLICANT_COLORS[applicant]||COLORS[index%COLORS.length];
    }
    function renderMatrixColorLegend(model) {
      const host=document.getElementById("matrixColorLegend");
      if(!host) return;
      host.innerHTML=model.applicantTypes.map((applicant,index)=>
        `<span><i style="--matrix-legend-color:${matrixApplicantColor(applicant,index)}"></i>${esc(applicant)}</span>`
      ).join("");
    }
    function niceMatrixAxisMax(value) {
      if(!Number.isFinite(value)||value<=0) return 1;
      const power=Math.pow(10,Math.floor(Math.log10(value)));
      const fraction=value/power;
      const niceFraction=fraction<=1?1:fraction<=2?2:fraction<=5?5:10;
      return niceFraction*power;
    }
    function buildMatrixModel(nodes,scaleMax=null) {
      const technologyCodes=["B1","B2","B3","B4","B5","B6","B7","B8","B9"];
      const preferredIndustries=["上游","中游","下游","不适用","未分类"];
      const allIndustries=new Set(DATA.nodes.map((node)=>node.industryDimension||"未分类"));
      const industries=preferredIndustries.filter((value)=>allIndustries.has(value));
      const preferredApplicants=["企业","个人","高校","研究所","政府","待核验","主体信息缺失","未知","未标注"];
      const allApplicants=new Set(DATA.nodes.map(matrixApplicant));
      const applicantTypes=[
        ...preferredApplicants.filter((value)=>allApplicants.has(value)),
        ...Array.from(allApplicants).filter((value)=>!preferredApplicants.includes(value)).sort((a,b)=>a.localeCompare(b,"zh-CN")),
      ];
      const matrixNodes=nodes.filter((node)=>technologyCodes.includes(node.technologyDimension));
      const counts=new Map();
      const cellTotals=new Map();
      const technologyTotals=new Map();
      const industryTotals=new Map();
      matrixNodes.forEach((node)=>{
        const technology=node.technologyDimension;
        const industry=node.industryDimension||"未分类";
        const applicant=matrixApplicant(node);
        const cellKey=`${technology}\u0000${industry}`;
        cellTotals.set(cellKey,(cellTotals.get(cellKey)||0)+1);
        counts.set(`${cellKey}\u0000${applicant}`,(counts.get(`${cellKey}\u0000${applicant}`)||0)+1);
        technologyTotals.set(technology,(technologyTotals.get(technology)||0)+1);
        industryTotals.set(industry,(industryTotals.get(industry)||0)+1);
      });
      const cells=[];
      technologyCodes.forEach((technology,technologyIndex)=>{
        industries.forEach((industry,industryIndex)=>{
          const cellKey=`${technology}\u0000${industry}`;
          const total=cellTotals.get(cellKey)||0;
          let start=0;
          const segments=[];
          applicantTypes.forEach((applicant,applicantIndex)=>{
            const count=counts.get(`${cellKey}\u0000${applicant}`)||0;
            if(!count) return;
            segments.push({applicant,applicantIndex,count,start,end:start+count});
            start+=count;
          });
          cells.push({technology,technologyIndex,industry,industryIndex,total,segments});
        });
      });
      return {
        technologyCodes,
        industries,
        applicantTypes,
        matrixNodes,
        cells,
        maxCell:Math.max(1,scaleMax||0,...cells.map((cell)=>cell.total)),
        axisMaxX:niceMatrixAxisMax(Math.max(1,...technologyTotals.values())),
        axisMaxY:niceMatrixAxisMax(Math.max(1,...industryTotals.values())),
        effectiveCells:cells.filter((cell)=>cell.total>0).length,
      };
    }
    function buildMatrixTimelineStats(nodes) {
      const eligibleNodes=nodes.filter((node)=>node.year!=null&&node.year>=state.yearStart&&node.year<=state.yearEnd&&/^B[0-9]$/.test(node.technologyDimension));
      const min=eligibleNodes.length?Math.min(...eligibleNodes.map((node)=>Number(node.year))):state.yearStart;
      const max=state.yearEnd;
      const periods=[];
      for(let start=min;start<=max;start+=5) periods.push({start,end:Math.min(start+4,max),label:`${start}-${Math.min(start+4,max)}`});
      const periodCounts=new Map();
      const periodCells=new Map();
      const periodTechnologyTotals=new Map();
      const periodIndustryTotals=new Map();
      eligibleNodes.forEach((node)=>{
        const periodIndex=Math.floor((node.year-min)/5);
        const industry=node.industryDimension||"未分类";
        periodCounts.set(periodIndex,(periodCounts.get(periodIndex)||0)+1);
        const cellKey=`${periodIndex}\u0000${node.technologyDimension}\u0000${industry}`;
        const technologyKey=`${periodIndex}\u0000${node.technologyDimension}`;
        const industryKey=`${periodIndex}\u0000${industry}`;
        periodCells.set(cellKey,(periodCells.get(cellKey)||0)+1);
        periodTechnologyTotals.set(technologyKey,(periodTechnologyTotals.get(technologyKey)||0)+1);
        periodIndustryTotals.set(industryKey,(periodIndustryTotals.get(industryKey)||0)+1);
      });
      return {
        min,
        max,
        periods,
        periodCounts,
        maxPeriodCell:Math.max(1,...periodCells.values()),
        axisMaxX:niceMatrixAxisMax(Math.max(1,...periodTechnologyTotals.values())),
        axisMaxY:niceMatrixAxisMax(Math.max(1,...periodIndustryTotals.values())),
      };
    }
    function makeMatrixTextSprite(text,color="#536963",fontSize=42) {
      const canvas=document.createElement("canvas");
      const context=canvas.getContext("2d");
      context.font=`600 ${fontSize}px "Microsoft YaHei", sans-serif`;
      const width=Math.ceil(context.measureText(text).width+32);
      canvas.width=Math.max(96,width);
      canvas.height=72;
      context.font=`600 ${fontSize}px "Microsoft YaHei", sans-serif`;
      context.fillStyle=color;
      context.textAlign="center";
      context.textBaseline="middle";
      context.fillText(text,canvas.width/2,canvas.height/2);
      const texture=new THREE.CanvasTexture(canvas);
      if(THREE.SRGBColorSpace) texture.colorSpace=THREE.SRGBColorSpace;
      texture.minFilter=THREE.LinearFilter;
      const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false});
      const sprite=new THREE.Sprite(material);
      sprite.scale.set(canvas.width*.018,canvas.height*.018,1);
      return sprite;
    }
    function makeMatrixLine(points,color=0x9fb2ac,opacity=.58) {
      const geometry=new THREE.BufferGeometry().setFromPoints(points);
      return new THREE.Line(geometry,new THREE.LineBasicMaterial({color,transparent:true,opacity}));
    }
    function disposeMatrixObject(object) {
      object.traverse((child)=>{
        if(child.geometry) child.geometry.dispose();
        const materials=Array.isArray(child.material)?child.material:[child.material];
        materials.filter(Boolean).forEach((material)=>{
          if(material.map) material.map.dispose();
          material.dispose();
        });
      });
    }
    function updateMatrixCamera() {
      if(!matrix3D.camera||!matrix3D.target) return;
      const sinPhi=Math.sin(matrix3D.phi);
      matrix3D.camera.position.set(
        matrix3D.target.x+matrix3D.radius*sinPhi*Math.cos(matrix3D.theta),
        matrix3D.target.y+matrix3D.radius*Math.cos(matrix3D.phi),
        matrix3D.target.z+matrix3D.radius*sinPhi*Math.sin(matrix3D.theta),
      );
      matrix3D.camera.lookAt(matrix3D.target);
    }
    function updateMatrixDepthRange() {
      if(!matrix3D.camera) return;
      const span=Math.max(12,matrix3D.boundsRadius||24);
      matrix3D.camera.near=.1;
      matrix3D.camera.far=Math.max(220,matrix3D.radius+span*4);
      matrix3D.camera.updateProjectionMatrix();
      if(matrix3D.scene?.fog){
        matrix3D.scene.fog.near=Math.max(24,matrix3D.radius-span*.7);
        matrix3D.scene.fog.far=matrix3D.radius+span*2.8;
      }
    }
    function matrixBoundsCorners(bounds) {
      const {min,max}=bounds;
      return [
        new THREE.Vector3(min.x,min.y,min.z),
        new THREE.Vector3(min.x,min.y,max.z),
        new THREE.Vector3(min.x,max.y,min.z),
        new THREE.Vector3(min.x,max.y,max.z),
        new THREE.Vector3(max.x,min.y,min.z),
        new THREE.Vector3(max.x,min.y,max.z),
        new THREE.Vector3(max.x,max.y,min.z),
        new THREE.Vector3(max.x,max.y,max.z),
      ];
    }
    function centerMatrixProjection(bounds) {
      matrix3D.camera.updateMatrixWorld(true);
      const projected=matrixBoundsCorners(bounds).map((point)=>point.project(matrix3D.camera));
      const minX=Math.min(...projected.map((point)=>point.x));
      const maxX=Math.max(...projected.map((point)=>point.x));
      const minY=Math.min(...projected.map((point)=>point.y));
      const maxY=Math.max(...projected.map((point)=>point.y));
      if(![minX,maxX,minY,maxY].every(Number.isFinite)) return;
      const centerX=(minX+maxX)/2,centerY=(minY+maxY)/2;
      if(Math.abs(centerX)<.001&&Math.abs(centerY)<.001) return;
      const distance=matrix3D.camera.position.distanceTo(matrix3D.target);
      const halfHeight=Math.tan(THREE.MathUtils.degToRad(matrix3D.camera.fov)/2)*distance;
      const halfWidth=halfHeight*matrix3D.camera.aspect;
      const right=new THREE.Vector3().setFromMatrixColumn(matrix3D.camera.matrixWorld,0).normalize();
      const up=new THREE.Vector3().setFromMatrixColumn(matrix3D.camera.matrixWorld,1).normalize();
      matrix3D.target
        .addScaledVector(right,centerX*halfWidth)
        .addScaledVector(up,centerY*halfHeight);
      updateMatrixCamera();
    }
    function centerMatrixBounds(bounds) {
      matrix3D.target.copy(bounds.getCenter(new THREE.Vector3()));
      updateMatrixCamera();
      centerMatrixProjection(bounds);
      centerMatrixProjection(bounds);
    }
    function fitMatrixScene() {
      if(!matrix3D.dataGroup||!matrix3D.camera||!matrix3D.target) return;
      matrix3D.dataGroup.updateMatrixWorld(true);
      const bounds=(matrix3D.fitBounds||new THREE.Box3().setFromObject(matrix3D.dataGroup)).clone();
      if(bounds.isEmpty()) return;
      const sphere=bounds.getBoundingSphere(new THREE.Sphere());
      const verticalFov=THREE.MathUtils.degToRad(matrix3D.camera.fov);
      const horizontalFov=2*Math.atan(Math.tan(verticalFov/2)*matrix3D.camera.aspect);
      const limitingFov=Math.max(.12,Math.min(verticalFov,horizontalFov));
      matrix3D.bounds=bounds;
      matrix3D.boundsRadius=Math.max(1,sphere.radius);
      matrix3D.radius=Math.max(30,Math.min(160,matrix3D.boundsRadius/Math.sin(limitingFov/2)*1.08));
      updateMatrixDepthRange();
      centerMatrixBounds(bounds);
    }
    function resetMatrixCamera() {
      matrix3D.theta=.72;
      matrix3D.phi=1.02;
      const host=document.getElementById("matrixThree");
      if(matrix3D.dataGroup&&host.clientWidth>1&&host.clientHeight>1) fitMatrixScene();
      else{
        matrix3D.radius=host.clientWidth<600?68:58;
        updateMatrixDepthRange();
        updateMatrixCamera();
      }
    }
    function resizeMatrixScene(refit=false) {
      if(!matrix3D.initialized) return false;
      const host=document.getElementById("matrixThree");
      const width=host.clientWidth,height=host.clientHeight;
      if(width<2||height<2) return false;
      matrix3D.renderer.setSize(width,height,true);
      matrix3D.camera.aspect=width/height;
      matrix3D.camera.fov=width<600?46:34;
      matrix3D.camera.updateProjectionMatrix();
      if(refit&&matrix3D.dataGroup) fitMatrixScene();
      else updateMatrixCamera();
      return true;
    }
    function matrixPointerHit(event) {
      if(!matrix3D.initialized||state.matrixView!=="3d") return null;
      const rect=matrix3D.renderer.domElement.getBoundingClientRect();
      matrix3D.pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
      matrix3D.raycaster.setFromCamera(matrix3D.pointer,matrix3D.camera);
      return matrix3D.raycaster.intersectObjects(matrix3D.meshes,false)[0]||null;
    }
    function setMatrixHover(hit,event) {
      const tooltip=document.getElementById("matrixTooltip");
      if(matrix3D.hovered&&matrix3D.hovered!==hit?.object) matrix3D.hovered.material.emissiveIntensity=.07;
      matrix3D.hovered=hit?.object||null;
      if(!hit){
        tooltip.style.display="none";
        matrix3D.renderer.domElement.style.cursor=matrix3D.dragging?"grabbing":"grab";
        return;
      }
      const data=hit.object.userData;
      hit.object.material.emissiveIntensity=.3;
      const share=data.total?(data.count/data.total*100).toFixed(1):"0.0";
      tooltip.innerHTML=`<strong>${esc(techLabel(data.technology))}</strong><br>${esc(data.industry)} · ${esc(data.applicant)} · ${esc(data.period)}<br>${fmt(data.count)} 个专利族 · 单元格占比 ${share}%`;
      const viewport=document.getElementById("matrixViewport").getBoundingClientRect();
      tooltip.style.left=`${Math.min(viewport.width-280,event.clientX-viewport.left+14)}px`;
      tooltip.style.top=`${Math.min(viewport.height-92,event.clientY-viewport.top+14)}px`;
      tooltip.style.display="block";
      matrix3D.renderer.domElement.style.cursor="pointer";
    }
    function nearestMatrixAxisView() {
      if(!matrix3D.camera||!matrix3D.target) return null;
      const direction=matrix3D.camera.position.clone().sub(matrix3D.target).normalize();
      const ax=Math.abs(direction.x),ay=Math.abs(direction.y),az=Math.abs(direction.z);
      const candidates=[
        {mode:"x",strength:ax,label:"X 轴侧视"},
        {mode:"y",strength:az,label:"Y 轴侧视"},
        {mode:"z",strength:ay,label:"Z 轴俯视"},
      ].sort((left,right)=>right.strength-left.strength);
      return candidates[0].strength>=.96?candidates[0]:null;
    }
    function detectMatrixAxisView() {
      const candidate=nearestMatrixAxisView();
      if(!candidate){
        document.getElementById("matrixModeReadout").textContent="自由 3D 视角";
        return false;
      }
      setMatrixView(candidate.mode);
      return true;
    }
    function initializeMatrix3D() {
      if(matrix3D.initialized) return;
      const host=document.getElementById("matrixThree");
      matrix3D.scene=new THREE.Scene();
      matrix3D.scene.background=new THREE.Color(0xf4f1eb);
      matrix3D.scene.fog=new THREE.Fog(0xeef4f2,50,86);
      matrix3D.camera=new THREE.PerspectiveCamera(34,1,.1,180);
      matrix3D.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
      matrix3D.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
      if(THREE.SRGBColorSpace) matrix3D.renderer.outputColorSpace=THREE.SRGBColorSpace;
      matrix3D.renderer.shadowMap.enabled=true;
      matrix3D.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      host.appendChild(matrix3D.renderer.domElement);
      matrix3D.raycaster=new THREE.Raycaster();
      matrix3D.pointer=new THREE.Vector2();
      matrix3D.target=new THREE.Vector3(0,4.5,0);
      matrix3D.scene.add(new THREE.HemisphereLight(0xffffff,0xb4c5c0,1.65));
      const keyLight=new THREE.DirectionalLight(0xffffff,2.1);
      keyLight.position.set(18,34,22);
      keyLight.castShadow=true;
      keyLight.shadow.mapSize.set(1024,1024);
      matrix3D.scene.add(keyLight);
      const rimLight=new THREE.DirectionalLight(0x7cc7ba,.7);
      rimLight.position.set(-20,14,-18);
      matrix3D.scene.add(rimLight);
      const canvas=matrix3D.renderer.domElement;
      canvas.style.touchAction="none";
      canvas.addEventListener("pointerdown",(event)=>{
        matrix3D.dragging=true;
        matrix3D.dragDistance=0;
        matrix3D.startX=matrix3D.lastX=event.clientX;
        matrix3D.startY=matrix3D.lastY=event.clientY;
        canvas.setPointerCapture(event.pointerId);
        canvas.style.cursor="grabbing";
      });
      canvas.addEventListener("pointermove",(event)=>{
        if(matrix3D.dragging){
          const dx=event.clientX-matrix3D.lastX,dy=event.clientY-matrix3D.lastY;
          matrix3D.dragDistance+=Math.abs(dx)+Math.abs(dy);
          matrix3D.theta-=dx*.007;
          matrix3D.phi=Math.max(.055,Math.min(Math.PI-.055,matrix3D.phi+dy*.006));
          matrix3D.lastX=event.clientX;
          matrix3D.lastY=event.clientY;
          updateMatrixCamera();
          const candidate=nearestMatrixAxisView();
          document.getElementById("matrixModeReadout").textContent=candidate?`接近 ${candidate.label}`:"自由 3D 视角";
          setMatrixHover(null,event);
        }else setMatrixHover(matrixPointerHit(event),event);
      });
      canvas.addEventListener("pointerleave",(event)=>{if(!matrix3D.dragging)setMatrixHover(null,event);});
      canvas.addEventListener("pointerup",(event)=>{
        const wasClick=matrix3D.dragDistance<5;
        matrix3D.dragging=false;
        canvas.releasePointerCapture(event.pointerId);
        const hit=matrixPointerHit(event);
        if(wasClick&&hit){
          const data=hit.object.userData;
          state.technology=data.technology;
          state.industry1=data.industry==="未分类"?"":data.industry;
          state.applicantType=data.applicant==="未标注"?"":data.applicant;
          scheduleRender();
        }else if(!wasClick){
          if(detectMatrixAxisView()){
            setMatrixHover(null,event);
            return;
          }
          if(matrix3D.bounds) centerMatrixBounds(matrix3D.bounds);
        }
        setMatrixHover(hit,event);
      });
      canvas.addEventListener("wheel",(event)=>{
        event.preventDefault();
        matrix3D.radius=Math.max(28,Math.min(180,matrix3D.radius*Math.exp(event.deltaY*.001)));
        updateMatrixDepthRange();
        if(matrix3D.bounds) centerMatrixBounds(matrix3D.bounds);
        else updateMatrixCamera();
      },{passive:false});
      matrix3D.initialized=true;
      resizeMatrixScene();
      resetMatrixCamera();
      if(window.ResizeObserver){
        matrix3D.resizeObserver=new ResizeObserver(()=>{
          if(state.view!=="world"||state.matrixView!=="3d") return;
          requestAnimationFrame(()=>resizeMatrixScene(true));
        });
        matrix3D.resizeObserver.observe(document.getElementById("matrixViewport"));
      }
      const animate=()=>{
        requestAnimationFrame(animate);
        if(state.view==="world"&&state.matrixView==="3d"&&matrix3D.renderer){
          const now=performance.now();
          matrix3D.meshes.forEach((mesh)=>{
            const animation=mesh.userData.animation;
            if(!animation) return;
            const progress=Math.min(1,(now-animation.startedAt)/animation.duration);
            const eased=1-Math.pow(1-progress,3);
            mesh.scale.y=animation.fromScale+(1-animation.fromScale)*eased;
            mesh.position.y=animation.fromY+(animation.toY-animation.fromY)*eased;
            if(progress>=1) delete mesh.userData.animation;
          });
          matrix3D.renderer.render(matrix3D.scene,matrix3D.camera);
        }
      };
      animate();
    }
    function renderMatrix3D(model) {
      initializeMatrix3D();
      const previousBars=new Map(matrix3D.meshes.map((mesh)=>[
        mesh.userData.key,
        {
          height:(mesh.geometry.parameters?.height||0)*mesh.scale.y,
          y:mesh.position.y,
        },
      ]));
      if(matrix3D.dataGroup){
        matrix3D.scene.remove(matrix3D.dataGroup);
        disposeMatrixObject(matrix3D.dataGroup);
      }
      const group=new THREE.Group();
      matrix3D.dataGroup=group;
      matrix3D.meshes=[];
      const xSpacing=7,depthSpacing=4.35,maxHeight=17;
      const xSpan=Math.max(1,(model.industries.length-1)*xSpacing);
      const depthSpan=(model.technologyCodes.length-1)*depthSpacing;
      const planeWidth=xSpan+10,planeDepth=depthSpan+8;
      matrix3D.fitBounds=new THREE.Box3(
        new THREE.Vector3(-planeWidth/2,-.05,-planeDepth/2),
        new THREE.Vector3(planeWidth/2,maxHeight,planeDepth/2),
      );
      const plane=new THREE.Mesh(
        new THREE.PlaneGeometry(planeWidth,planeDepth),
        new THREE.MeshStandardMaterial({color:0xe7efec,roughness:.86,metalness:.02,transparent:true,opacity:.92}),
      );
      plane.rotation.x=-Math.PI/2;
      plane.position.y=-.035;
      plane.receiveShadow=true;
      group.add(plane);
      for(let index=0;index<=model.industries.length;index+=1){
        const x=-xSpan/2-xSpacing/2+index*xSpacing;
        group.add(makeMatrixLine([new THREE.Vector3(x,.015,-depthSpan/2-depthSpacing/2),new THREE.Vector3(x,.015,depthSpan/2+depthSpacing/2)],0x9fb5af,.43));
      }
      for(let index=0;index<=model.technologyCodes.length;index+=1){
        const z=-depthSpan/2-depthSpacing/2+index*depthSpacing;
        group.add(makeMatrixLine([new THREE.Vector3(-xSpan/2-xSpacing/2,.015,z),new THREE.Vector3(xSpan/2+xSpacing/2,.015,z)],0x9fb5af,.43));
      }
      model.industries.forEach((industry,index)=>{
        const label=makeMatrixTextSprite(industry,"#425b55",34);
        label.position.set(-xSpan/2+index*xSpacing,.35,depthSpan/2+3);
        group.add(label);
      });
      model.technologyCodes.forEach((technology,index)=>{
        const label=makeMatrixTextSprite(technology,TECH_COLORS[technology]||"#536963",34);
        label.position.set(-xSpan/2-4,.35,-depthSpan/2+index*depthSpacing);
        group.add(label);
      });
      const axisX=makeMatrixTextSprite("X · 产业链一级","#234c45",30);
      axisX.position.set(0,.45,depthSpan/2+5.4);
      group.add(axisX);
      const axisY=makeMatrixTextSprite("Y · 技术路线","#234c45",30);
      axisY.position.set(-xSpan/2-6,.45,0);
      group.add(axisY);
      const zAxisX=-xSpan/2-xSpacing/2,zAxisZ=depthSpan/2+depthSpacing/2;
      group.add(makeMatrixLine([new THREE.Vector3(zAxisX,0,zAxisZ),new THREE.Vector3(zAxisX,maxHeight+1,zAxisZ)],0x426c64,.9));
      [0,.25,.5,.75,1].forEach((ratio)=>{
        const y=ratio*maxHeight;
        group.add(makeMatrixLine([new THREE.Vector3(zAxisX-.3,y,zAxisZ),new THREE.Vector3(zAxisX+.3,y,zAxisZ)],0x426c64,.8));
        const tick=makeMatrixTextSprite(fmt(Math.round(model.maxCell*ratio)),"#5c716b",24);
        tick.scale.multiplyScalar(.72);
        tick.position.set(zAxisX-1.8,y,zAxisZ);
        group.add(tick);
      });
      const zTitle=makeMatrixTextSprite("Z · 专利族数量","#234c45",28);
      zTitle.position.set(zAxisX-1.8,maxHeight+2,zAxisZ);
      group.add(zTitle);
      model.cells.forEach((cell)=>{
        if(!cell.total) return;
        const x=-xSpan/2+cell.industryIndex*xSpacing;
        const z=-depthSpan/2+cell.technologyIndex*depthSpacing;
        cell.segments.forEach((segment)=>{
          const rawHeight=maxHeight*segment.count/model.maxCell;
          const height=Math.max(.035,rawHeight);
          const y=maxHeight*(segment.start+segment.count/2)/model.maxCell;
          const color=matrixApplicantColor(segment.applicant,segment.applicantIndex);
          const geometry=new THREE.BoxGeometry(2.75,height,2.45);
          const material=new THREE.MeshStandardMaterial({
            color,
            roughness:.36,
            metalness:.08,
            transparent:true,
            opacity:.94,
            emissive:new THREE.Color(color).multiplyScalar(.12),
            emissiveIntensity:.07,
          });
          const mesh=new THREE.Mesh(geometry,material);
          const key=`${cell.technology}\u0000${cell.industry}\u0000${segment.applicant}`;
          const previous=previousBars.get(key);
          const startY=maxHeight*segment.start/model.maxCell;
          const fromScale=previous?Math.max(.001,previous.height/height):.001;
          mesh.scale.y=fromScale;
          mesh.position.set(x,previous?previous.y:startY,z);
          mesh.castShadow=true;
          mesh.receiveShadow=true;
          mesh.userData={
            technology:cell.technology,
            industry:cell.industry,
            applicant:segment.applicant,
            count:segment.count,
            total:cell.total,
            key,
            period:model.periodLabel,
            animation:{startedAt:performance.now(),duration:520,fromScale,fromY:previous?previous.y:startY,toY:y},
          };
          const edges=new THREE.LineSegments(
            new THREE.EdgesGeometry(geometry),
            new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.32}),
          );
          mesh.add(edges);
          group.add(mesh);
          matrix3D.meshes.push(mesh);
        });
      });
      matrix3D.scene.add(group);
      matrix3D.model=model;
      resizeMatrixScene(true);
    }
    function matrixStackedBarOption(model,mode) {
      const keys=mode==="x"?model.technologyCodes:model.industries;
      const totals=new Map();
      model.matrixNodes.forEach((node)=>{
        const key=mode==="x"?node.technologyDimension:(node.industryDimension||"未分类");
        const applicant=matrixApplicant(node);
        totals.set(`${key}\u0000${applicant}`,(totals.get(`${key}\u0000${applicant}`)||0)+1);
      });
      return {
        animationDuration:520,
        color:model.applicantTypes.map(matrixApplicantColor),
        tooltip:{...tooltipBase(),trigger:"axis",axisPointer:{type:"shadow"}},
        legend:{type:"scroll",top:16,left:"center",itemWidth:16,itemHeight:8,textStyle:{fontSize:9,color:"#60706a"}},
        grid:{left:mode==="x"?64:72,right:34,top:62,bottom:76},
        xAxis:{type:"category",data:keys,axisLine:{lineStyle:{color:"#bfcfc9"}},axisTick:{show:false},axisLabel:{color:"#53635e",fontSize:9,interval:0,width:mode==="x"?112:80,overflow:"truncate",formatter:mode==="x"?techLabel:(value)=>value}},
        yAxis:{type:"value",max:mode==="x"?model.axisMaxX:model.axisMaxY,name:"专利族数量",nameTextStyle:{color:"#75837e",fontSize:9},axisLine:{show:false},axisTick:{show:false},axisLabel:axisLabel(),splitLine:{lineStyle:{color:"#dce6e2"}}},
        series:model.applicantTypes.map((applicant,index)=>({
          name:applicant,
          type:"bar",
          stack:"patents",
          barMaxWidth:mode==="x"?62:86,
          data:keys.map((key)=>totals.get(`${key}\u0000${applicant}`)||0),
          itemStyle:{color:matrixApplicantColor(applicant,index),borderColor:"rgba(255,255,255,.68)",borderWidth:.45},
          emphasis:{focus:"series"},
        })),
      };
    }
    function renderMatrix2D(model,mode) {
      if(mode==="x"||mode==="y"){
        applyChart("matrix2D",matrixStackedBarOption(model,mode),(params)=>{
          if(params.seriesType!=="bar") return;
          if(mode==="x") state.technology=params.name;
          else state.industry1=params.name==="未分类"?"":params.name;
          state.applicantType=["未标注","未知"].includes(params.seriesName)?"":params.seriesName;
          scheduleRender();
        });
        return;
      }
      const data=model.cells.map((cell)=>({value:[cell.industryIndex,cell.technologyIndex,cell.total],technology:cell.technology,industry:cell.industry}));
      applyChart("matrix2D",{
        animationDuration:520,
        tooltip:{...tooltipBase(),formatter:(p)=>`${esc(techLabel(p.data.technology))} × ${esc(p.data.industry)}<br><b>${fmt(p.value[2])}</b> 个专利族`},
        grid:{left:205,right:80,top:42,bottom:74},
        xAxis:{type:"category",data:model.industries,axisLine:{lineStyle:{color:"#bfcfc9"}},axisTick:{show:false},axisLabel:{color:"#53635e",fontSize:10,fontWeight:650}},
        yAxis:{type:"category",inverse:true,data:model.technologyCodes,axisLine:{show:false},axisTick:{show:false},axisLabel:{color:"#53635e",fontSize:9,width:184,overflow:"truncate",formatter:techLabel}},
        visualMap:{min:0,max:model.maxCell,calculable:true,orient:"horizontal",left:"center",bottom:12,itemWidth:14,itemHeight:220,textStyle:{fontSize:8,color:"#718092"},inRange:{color:["#f2ede6","#d6c6b4","#f3aa2c","#e9632d","#8c174f"]}},
        series:[{name:"专利族数量",type:"heatmap",data,label:{show:true,color:"#24332f",fontSize:9,fontWeight:650,formatter:(p)=>p.value[2]?fmt(p.value[2]):""},itemStyle:{borderColor:"#f7faf9",borderWidth:2},emphasis:{itemStyle:{borderColor:"#17201e",borderWidth:2,shadowBlur:10,shadowColor:"rgba(23,32,30,.22)"}}}],
      },(params)=>{
        if(params.seriesType!=="heatmap") return;
        state.technology=params.data.technology;
        state.industry1=params.data.industry==="未分类"?"":params.data.industry;
        scheduleRender();
      });
    }
    function syncMatrixViewUI() {
      const modeLabels={x:"X 轴侧视 · 技术路线堆叠柱",y:"Y 轴侧视 · 产业链堆叠柱",z:"Z 轴俯视 · 技术—产业热力图","3d":"自由 3D 视角"};
      document.querySelectorAll("[data-matrix-view]").forEach((button)=>button.classList.toggle("active",button.dataset.matrixView===state.matrixView));
      document.getElementById("matrixThree").classList.toggle("hidden",state.matrixView!=="3d");
      document.getElementById("matrix2D").classList.toggle("active",state.matrixView!=="3d");
      document.getElementById("matrixModeReadout").textContent=modeLabels[state.matrixView];
      document.getElementById("matrixTooltip").style.display="none";
    }
    function setMatrixView(mode,resetCamera=false) {
      state.matrixView=mode;
      syncMatrixViewUI();
      if(mode==="3d"){
        if(matrix3D.model) renderMatrix3D(matrix3D.model);
        if(resetCamera) resetMatrixCamera();
      }else if(matrix3D.model){
        renderMatrix2D(matrix3D.model,mode);
        setTimeout(()=>chart("matrix2D").resize(),30);
      }
    }
    function stopMatrixPlayback() {
      if(matrixYearTimer){
        clearInterval(matrixYearTimer);
        matrixYearTimer=null;
      }
      document.getElementById("matrixPlay").classList.remove("playing");
    }
    function drawMatrixTimeline(stats) {
      const range=document.getElementById("matrixYearRange");
      const lastIndex=Math.max(0,stats.periods.length-1);
      range.min=0;
      range.max=lastIndex;
      range.step=1;
      range.value=state.matrixPeriodIndex??lastIndex;
      range.disabled=stats.periods.length<=1;
      document.getElementById("matrixYearValue").textContent=state.matrixPeriodIndex==null?"全期":stats.periods[state.matrixPeriodIndex].label;
      document.getElementById("matrixAllYears").classList.toggle("active",state.matrixPeriodIndex==null);
      const canvas=document.getElementById("matrixTimelineCanvas");
      const width=canvas.clientWidth,height=canvas.clientHeight;
      if(!width||!height) return;
      const dpr=Math.min(window.devicePixelRatio||1,2);
      canvas.width=Math.round(width*dpr);
      canvas.height=Math.round(height*dpr);
      const context=canvas.getContext("2d");
      context.scale(dpr,dpr);
      context.clearRect(0,0,width,height);
      const periodIndexes=stats.periods.map((_period,index)=>index);
      const maxCount=Math.max(1,...periodIndexes.map((index)=>stats.periodCounts.get(index)||0));
      const left=4,right=width-4,top=5,bottom=height-12;
      const displayPointCount=stats.periods.length+1;
      const xFor=(displayIndex)=>left+(right-left)*displayIndex/Math.max(1,displayPointCount-1);
      context.beginPath();
      context.moveTo(xFor(0),bottom);
      periodIndexes.forEach((periodIndex,index)=>{
        const x=xFor(index+1);
        const y=bottom-(bottom-top)*(stats.periodCounts.get(periodIndex)||0)/maxCount;
        context.lineTo(x,y);
      });
      context.lineTo(right,bottom);
      context.closePath();
      context.fillStyle="rgba(8,127,114,.12)";
      context.fill();
      context.beginPath();
      context.moveTo(xFor(0),bottom);
      periodIndexes.forEach((periodIndex,index)=>{
        const x=xFor(index+1);
        const y=bottom-(bottom-top)*(stats.periodCounts.get(periodIndex)||0)/maxCount;
        context.lineTo(x,y);
      });
      context.strokeStyle="rgba(8,127,114,.7)";
      context.lineWidth=1.25;
      context.stroke();
      context.beginPath();
      context.arc(xFor(0),bottom,1.8,0,Math.PI*2);
      context.fillStyle="#087f72";
      context.fill();
      periodIndexes.forEach((periodIndex)=>{
        const x=xFor(periodIndex+1);
        const y=bottom-(bottom-top)*(stats.periodCounts.get(periodIndex)||0)/maxCount;
        context.beginPath();
        context.arc(x,y,1.8,0,Math.PI*2);
        context.fillStyle="#087f72";
        context.fill();
      });
      if(state.matrixPeriodIndex!=null){
        const x=xFor(state.matrixPeriodIndex+1);
        context.beginPath();
        context.moveTo(x,top);
        context.lineTo(x,bottom+3);
        context.strokeStyle="#d2594b";
        context.lineWidth=1.5;
        context.stroke();
      }
      context.fillStyle="#7b8883";
      context.font='8px "Microsoft YaHei", sans-serif';
      const labelEvery=width>=900?1:width>=560?2:4;
      context.textAlign="left";
      context.fillText(String(stats.min-1),xFor(0),height-1);
      stats.periods.forEach((period,index)=>{
        if(index%labelEvery!==0&&index!==lastIndex) return;
        context.textAlign=index===lastIndex?"right":"center";
        context.fillText(String(period.start),xFor(index+1),height-1);
      });
    }
    function toggleMatrixPlayback() {
      if(matrixYearTimer){
        stopMatrixPlayback();
        return;
      }
      const stats=buildMatrixTimelineStats(worldSelectedNodes());
      const lastIndex=Math.max(0,stats.periods.length-1);
      state.matrixPeriodIndex=state.matrixPeriodIndex==null||state.matrixPeriodIndex>=lastIndex?0:state.matrixPeriodIndex;
      document.getElementById("matrixPlay").classList.add("playing");
      renderWorldComposition(worldSelectedNodes());
      matrixYearTimer=setInterval(()=>{
        if(state.matrixPeriodIndex>=lastIndex){
          stopMatrixPlayback();
          return;
        }
        state.matrixPeriodIndex+=1;
        renderWorldComposition(worldSelectedNodes());
      },820);
    }
    function renderWorldComposition(nodes) {
      const timelineStats=buildMatrixTimelineStats(nodes);
      if(state.matrixPeriodIndex!=null) state.matrixPeriodIndex=Math.max(0,Math.min(timelineStats.periods.length-1,state.matrixPeriodIndex));
      const period=state.matrixPeriodIndex==null?null:timelineStats.periods[state.matrixPeriodIndex];
      const sliceNodes=period==null?nodes:nodes.filter((node)=>node.year>=period.start&&node.year<=period.end);
      const model=buildMatrixModel(sliceNodes,period==null?null:timelineStats.maxPeriodCell);
      if(period){
        model.axisMaxX=timelineStats.axisMaxX;
        model.axisMaxY=timelineStats.axisMaxY;
      }
      model.periodLabel=period==null?`${state.yearStart}-${state.yearEnd}`:period.label;
      matrix3D.model=model;
      renderMatrixColorLegend(model);
      document.getElementById("compositionScope").textContent=`${model.periodLabel} · ${fmt(model.matrixNodes.length)} 专利族 · ${fmt(model.effectiveCells)} 个组合`;
      drawMatrixTimeline(timelineStats);
      syncMatrixViewUI();
      if(state.matrixView==="3d") renderMatrix3D(model);
      else renderMatrix2D(model,state.matrixView);
    }
    function renderWorld() {
      const baseNodes = worldBaseNodes();
      const nodes = worldSelectedNodes();
      const countryRows = countBy(baseNodes,countriesOf);
      const flows = aggregateCountryFlows(baseNodes);
      const selectedEdges = edgeSubset(nodes);
      renderKpis("worldKpis", [
        ["相关专利族",nodes.length,state.country||"全球"],
        ["国家 / 地区",countryRows.length,"申请人国家"],
        ["族间引用",selectedEdges.length,"当前筛选"],
        ["跨国引用次数",flows.reduce((sum,row)=>sum+row.count,0),"定向累计"],
      ]);
      renderWorldMap();
      renderWorldTrend(baseNodes,countryRows);
      renderWorldComposition(nodes);
      renderCitationNetwork(nodes);
    }

    function provinceColor(value,max) {
      const ratio = Math.sqrt(value/Math.max(1,max));
      return `rgba(49,92,121,${(.13+ratio*.68).toFixed(2)})`;
    }
    function renderChinaMap() {
      const baseNodes = chinaBaseNodes();
      const nodes = chinaSelectedNodes();
      const provinceRows = countBy(baseNodes,provincesOf).filter((row)=>provinceCoordinates[row.key]);
      const cityRows = countBy(nodes,citiesOf).filter((row)=>cityCoordinates[row.key]).slice(0,28);
      const maxProvince = Math.max(1,...provinceRows.map((row)=>row.count));
      const maxCity = Math.max(1,...cityRows.map((row)=>row.count));
      const regions = provinceRows.map((row)=>({name:row.key,itemStyle:{areaColor:provinceColor(row.count,maxProvince),borderColor:state.province===row.key?"#e9632d":"#fffdf9",borderWidth:state.province===row.key?2:1}}));
      const bubbles = provinceRows.map((row)=>({name:row.key,value:[...provinceCoordinates[row.key],row.count],itemStyle:{color:state.province===row.key?COLORS[1]:COLORS[2]}}));
      const cities = cityRows.map((row)=>({name:row.key,value:[...cityCoordinates[row.key],row.count]}));
      applyChart("chinaMap",{
        animationDuration:650,
        backgroundColor:"#fbf8f3",
        tooltip:{...tooltipBase(),formatter:(p)=>`${esc(p.name)}<br><b>${fmt(p.value?.[2]??p.value)}</b> 个专利族`},
        geo:{map:"china",roam:true,scaleLimit:{min:.85,max:8},layoutCenter:["50%","50%"],layoutSize:"106%",regions,itemStyle:{areaColor:"#e9e3da",borderColor:"#fffdf9",borderWidth:1},emphasis:{itemStyle:{areaColor:"#e7c39e"},label:{show:false}}},
        series:[
          {name:"省份",type:"scatter",coordinateSystem:"geo",data:bubbles,symbolSize:(v)=>Math.min(26,5+20*Math.sqrt(v[2]/maxProvince)),itemStyle:{opacity:.8,borderColor:"#fffdf9",borderWidth:1},label:{show:true,position:"top",fontSize:8,color:"#152337",formatter:(p)=>p.value[2]>maxProvince*.055||state.province===p.name?p.name:""},z:4},
          {name:"城市",type:"effectScatter",coordinateSystem:"geo",data:cities,symbolSize:(v)=>Math.min(12,3+8*Math.sqrt(v[2]/maxCity)),rippleEffect:{scale:2.5,brushType:"stroke"},itemStyle:{color:COLORS[1]},label:{show:false},z:5}
        ]
      },(p)=>{
        if(!provinceCoordinates[p.name]) return;
        state.province=state.province===p.name?"":p.name;
        scheduleRender();
      });
    }
    function renderChinaTrend(nodes) {
      const dated = nodes.filter((node)=>node.year!=null);
      const displayStart=leadingDisplayYear(dated);
      const years=[]; for(let y=displayStart;y<=state.yearEnd;y+=1) years.push(y);
      const techRows=countBy(dated,(node)=>node.technologyDimension||"未分类").slice(0,8);
      const counts=new Map();
      dated.forEach((node)=>{const key=`${node.technologyDimension||"未分类"}\u0000${node.year}`;counts.set(key,(counts.get(key)||0)+1);});
      applyChart("chinaTrend",{
        color:techRows.map((row)=>TECH_COLORS[row.key]||COLORS[0]),
        tooltip:{...tooltipBase(),trigger:"axis"},
        legend:{type:"scroll",top:8,left:12,right:12,textStyle:{fontSize:8,color:"#65716d"},formatter:(name)=>short(name,20)},
        grid:{left:48,right:18,top:48,bottom:38},
        xAxis:{type:"category",boundaryGap:false,data:years,axisLine:{lineStyle:{color:"#ccd4d1"}},axisTick:{show:false},axisLabel:{...axisLabel(),interval:"auto"}},
        yAxis:{type:"value",name:"专利族",nameTextStyle:{...axisLabel()},splitLine:{lineStyle:{color:"#e7ecea"}},axisLabel:axisLabel()},
        dataZoom:[{type:"inside"},{type:"slider",height:14,bottom:8,borderColor:"transparent",backgroundColor:"rgba(21,35,55,.06)",fillerColor:"rgba(233,99,45,.16)",handleStyle:{color:"#e9632d"},textStyle:{fontSize:8}}],
        series:techRows.map((row,index)=>({name:techLabel(row.key),type:"line",smooth:.24,showSymbol:false,symbolSize:5,data:years.map((year)=>counts.get(`${row.key}\u0000${year}`)||0),lineStyle:{width:index<3?2:1.3},areaStyle:index<2?{opacity:.07}:undefined,emphasis:{focus:"series"}}))
      });
    }
    function renderChinaIndustryRiver(nodes) {
      const chains=["上游","中游","下游"];
      const chainColors={"上游":"#315c79","中游":"#168a96","下游":"#e9632d"};
      const counts=new Map();
      const level2Counts=new Map();
      nodes.forEach((node)=>{
        if(node.year==null) return;
        const nodeChains=splitValues(node.industryDimension).filter((chain)=>chains.includes(chain));
        const level2Values=splitIndustryLevel2(node.industryLevel2);
        const level2Labels=level2Values.length?level2Values:["未分类"];
        nodeChains.forEach((chain)=>{
          const key=`${node.year}\u0000${chain}`;
          counts.set(key,(counts.get(key)||0)+1);
          if(!level2Counts.has(key)) level2Counts.set(key,new Map());
          const distribution=level2Counts.get(key);
          level2Labels.forEach((label)=>distribution.set(label,(distribution.get(label)||0)+1));
        });
      });
      const recordedYears=Array.from(counts.keys(),(key)=>Number(key.split("\u0000")[0])).filter(Number.isFinite);
      const displayStart=(recordedYears.length?Math.min(...recordedYears):state.yearStart)-1;
      const years=[];
      for(let year=displayStart;year<=state.yearEnd;year+=1) years.push(year);
      const totals=years.map((year)=>chains.reduce((sum,chain)=>sum+(counts.get(`${year}\u0000${chain}`)||0),0));
      const shareMode=state.riverMode==="share";
      const growthMode=state.riverMode==="growth";
      document.getElementById("industryRiverScope").textContent=state.province||"全国";
      document.getElementById("industryRiverNote").textContent=growthMode
        ?"正负堆叠柱表示各产业链对总量同比的增长贡献 · 悬停系列自动置于堆叠基底"
        :shareMode
          ?"100% 堆叠面积表示年度产业结构 · 深色折线保留年度总量"
          :"面积表示产业结构 · 深色折线表示年度总量 · 点击查看产业二级指标详情";
      document.querySelectorAll("[data-river-mode]").forEach((button)=>button.classList.toggle("active",button.dataset.riverMode===state.riverMode));
      const riverTooltip=tooltipBase();
      const yearFromValue=(value)=>{
        if(value==null||value==="") return "";
        if(typeof value==="number"&&value>=1800&&value<=3000) return String(Math.round(value));
        if(typeof value==="number") return String(new Date(value).getFullYear());
        const text=String(value);
        return /^\d{4}/.test(text)?text.slice(0,4):String(new Date(value).getFullYear());
      };
      const distributionFor=(year,chain)=>Array.from(level2Counts.get(`${year}\u0000${chain}`)||[],([label,count])=>({label,count})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,"zh-CN"));
      const openIndustryBreakdown=(year)=>{
        if(!year) return;
        const sections=chains.map((chain)=>{
          const total=counts.get(`${year}\u0000${chain}`)||0;
          const distribution=distributionFor(year,chain);
          const max=Math.max(1,...distribution.map((row)=>row.count));
          const rows=distribution.map((row)=>{
            const percent=total?row.count/total*100:0;
            return `<div class="industry-breakdown-row"><div><strong>${esc(row.label)}</strong><span>${fmt(row.count)} · ${percent.toFixed(1)}%</span></div><i><b style="width:${Math.min(100,row.count/max*100).toFixed(1)}%"></b></i></div>`;
          }).join("")||'<div class="industry-breakdown-empty">暂无产业二级标签</div>';
          return `<section class="industry-breakdown-section"><h4><span style="background:${chainColors[chain]}"></span>${esc(chain)}<b>${fmt(total)} 个专利族</b></h4>${rows}</section>`;
        }).join("");
        document.getElementById("inspectorTitle").textContent=`${year} 年产业二级指标`;
        document.getElementById("inspectorSubtitle").textContent=`${state.province||"全国"} · 上中下游产业链分布`;
        document.getElementById("inspectorBody").innerHTML=`<div class="industry-breakdown">${sections}<p>多标签专利族在各二级指标中分别计数。</p></div>`;
        document.getElementById("nodeInspector").classList.add("open");
      };
      let activeRiverYear=String([...years].reverse().find((year)=>totals[years.indexOf(year)]>0)||state.yearEnd);
      const growthValue=(chain,index)=>{
        if(index<=0||totals[index-1]<=0) return null;
        const current=counts.get(`${years[index]}\u0000${chain}`)||0;
        const previous=counts.get(`${years[index-1]}\u0000${chain}`)||0;
        return (current-previous)/totals[index-1]*100;
      };
      const totalGrowthValue=(index)=>index>0&&totals[index-1]>0?(totals[index]-totals[index-1])/totals[index-1]*100:null;
      const areaSeries=chains.map((chain)=>({
        id:`industry-${chain}`,
        name:chain,
        type:growthMode?"bar":"line",
        stack:growthMode?"同比增长贡献":"产业链结构",
        smooth:growthMode?false:.22,
        showSymbol:false,
        symbol:"circle",
        symbolSize:5,
        barMaxWidth:growthMode?18:undefined,
        data:years.map((year,index)=>{
          const value=counts.get(`${year}\u0000${chain}`)||0;
          if(growthMode) return growthValue(chain,index);
          return shareMode?(totals[index]?value/totals[index]*100:0):value;
        }),
        lineStyle:{width:growthMode?0:1.35,color:chainColors[chain]},
        itemStyle:{color:chainColors[chain],borderColor:"#fff",borderWidth:1},
        areaStyle:growthMode?undefined:{color:chainColors[chain],opacity:.72},
        emphasis:{focus:"series",lineStyle:{width:growthMode?0:2.4},areaStyle:growthMode?undefined:{opacity:.9}},
        z:2
      }));
      const totalSeriesName=growthMode?"总量同比":"年度总量";
      const totalSeries={
        id:"industry-total",
        name:totalSeriesName,
        type:"line",
        yAxisIndex:shareMode&&!growthMode?1:0,
        smooth:.18,
        showSymbol:false,
        symbol:"circle",
        symbolSize:6,
        data:growthMode?years.map((_year,index)=>totalGrowthValue(index)):totals,
        lineStyle:{width:2.1,color:"#152337"},
        itemStyle:{color:"#152337",borderColor:"#fff",borderWidth:1.5},
        emphasis:{focus:"series",lineStyle:{width:3}},
        endLabel:{show:true,color:"#152337",fontSize:9,fontWeight:650,distance:7,formatter:(params)=>growthMode?`同比 ${Number(params.value)>=0?"+":""}${Number(params.value).toFixed(1)}%`:`总量 ${fmt(params.value)}`},
        labelLayout:{moveOverlap:"shiftY"},
        markLine:growthMode?{silent:true,symbol:"none",label:{show:false},lineStyle:{color:"rgba(21,35,55,.35)",width:1.2},data:[{yAxis:0}]}:undefined,
        z:8
      };
      const riverOption={
        color:[...chains.map((chain)=>chainColors[chain]),"#152337"],
        animationDuration:600,
        tooltip:{
          ...riverTooltip,
          trigger:"axis",
          confine:true,
          axisPointer:{type:"line",snap:true,lineStyle:{color:"rgba(21,35,55,.28)",width:1}},
          extraCssText:`${riverTooltip.extraCssText||""}max-width:460px;max-height:430px;overflow:auto;`,
          formatter:(params)=>{
            const list=Array.isArray(params)?params:[params];
            const year=yearFromValue(list[0]?.axisValue??list[0]?.name);
            activeRiverYear=year||activeRiverYear;
            const yearIndex=years.indexOf(Number(activeRiverYear));
            const annualTotal=chains.reduce((sum,chain)=>sum+(counts.get(`${activeRiverYear}\u0000${chain}`)||0),0);
            const previousTotal=yearIndex>0?totals[yearIndex-1]:0;
            const annualGrowth=yearIndex>0&&previousTotal>0?(annualTotal-previousTotal)/previousTotal*100:null;
            const sections=chains.map((chain)=>{
              const total=counts.get(`${activeRiverYear}\u0000${chain}`)||0;
              const share=annualTotal?total/annualTotal*100:0;
              const contribution=growthMode&&yearIndex>=0?growthValue(chain,yearIndex):null;
              const distribution=distributionFor(activeRiverYear,chain);
              const rows=distribution.slice(0,5).map((row)=>`<div style="display:flex;justify-content:space-between;gap:16px;padding:2px 0;opacity:.82"><span>${esc(row.label)}</span><b>${fmt(row.count)}</b></div>`).join("");
              const metric=growthMode
                ?contribution==null?(total>0&&previousTotal===0?"新增":"—"):`贡献 ${contribution>=0?"+":""}${contribution.toFixed(1)}%`
                :`${fmt(total)} · ${share.toFixed(1)}%`;
              return `<div style="padding:6px 0;border-top:1px solid rgba(255,255,255,.12)"><div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:3px"><strong style="color:${chainColors[chain]}">${esc(chain)}</strong><b>${metric}</b></div>${rows||'<div style="opacity:.55">暂无产业二级标签</div>'}</div>`;
            }).join("");
            const headline=growthMode
              ?`总量同比 ${annualGrowth==null?(annualTotal>0&&previousTotal===0?"新增":"—"):`${annualGrowth>=0?"+":""}${annualGrowth.toFixed(1)}%`}`
              :`总量 ${fmt(annualTotal)}`;
            return `<div style="min-width:360px"><div style="display:flex;justify-content:space-between;gap:18px;margin-bottom:4px"><b>${esc(activeRiverYear)} 年 · 产业链结构</b><b>${headline}</b></div>${sections}<div style="padding-top:5px;font-size:9px;opacity:.55">点击当前年份查看完整产业二级指标</div></div>`;
          }
        },
        legend:{top:13,left:18,itemWidth:18,itemHeight:8,data:[...chains,totalSeriesName],textStyle:{fontSize:9,color:"#65716d"}},
        grid:{left:62,right:72,top:58,bottom:64,containLabel:false},
        dataZoom:[
          {type:"inside",xAxisIndex:0,filterMode:"none",zoomOnMouseWheel:true,moveOnMouseWheel:true,moveOnMouseMove:true},
          {type:"slider",xAxisIndex:0,filterMode:"none",height:16,bottom:8,left:62,right:72,borderColor:"transparent",backgroundColor:"rgba(21,35,55,.06)",fillerColor:"rgba(22,138,150,.16)",handleStyle:{color:"#168a96",borderColor:"#fff",borderWidth:1},moveHandleStyle:{color:"#168a96"},textStyle:{fontSize:8,color:"#718092"}}
        ],
        xAxis:{
          type:"category",
          boundaryGap:false,
          data:years,
          axisLine:{lineStyle:{color:"rgba(21,35,55,.18)"}},
          axisTick:{show:false},
          axisLabel:{...axisLabel(),interval:years.length>70?9:years.length>40?4:years.length>22?2:"auto"},
          splitLine:{show:true,lineStyle:{color:"rgba(21,35,55,.07)"}},
        },
        yAxis:growthMode?{
          type:"value",name:"同比增长贡献",nameTextStyle:{...axisLabel()},axisLabel:{...axisLabel(),formatter:(value)=>`${value}%`},splitLine:{lineStyle:{color:"rgba(21,35,55,.07)",type:"dashed"}}
        }:shareMode?[
          {type:"value",min:0,max:100,name:"结构占比",nameTextStyle:{...axisLabel()},axisLabel:{...axisLabel(),formatter:(value)=>`${value}%`},splitLine:{lineStyle:{color:"rgba(21,35,55,.07)",type:"dashed"}}},
          {type:"value",min:0,name:"年度总量",nameTextStyle:{...axisLabel()},axisLabel:axisLabel(),splitLine:{show:false}}
        ]:{
          type:"value",min:0,minInterval:1,name:"专利族数量",nameTextStyle:{...axisLabel()},axisLabel:axisLabel(),splitLine:{lineStyle:{color:"rgba(21,35,55,.07)",type:"dashed"}}
        },
        series:[...areaSeries,totalSeries]
      };
      applyChart("chinaIndustryRiver",riverOption);
      const riverChart=chart("chinaIndustryRiver");
      const orderedGrowthSeries=(focusedChain)=>{
        if(!growthMode||!chains.includes(focusedChain)) return [...areaSeries,totalSeries];
        const focused=areaSeries.find((series)=>series.name===focusedChain);
        return [focused,...areaSeries.filter((series)=>series.name!==focusedChain),totalSeries];
      };
      let focusedGrowthChain="";
      const reorderGrowthStack=(chain)=>{
        const next=chains.includes(chain)?chain:"";
        if(!growthMode||next===focusedGrowthChain) return;
        focusedGrowthChain=next;
        const currentZoom=riverChart.getOption().dataZoom||[];
        const dataZoom=riverOption.dataZoom.map((item,index)=>({
          ...item,
          ...(Number.isFinite(currentZoom[index]?.start)?{start:currentZoom[index].start}:{}),
          ...(Number.isFinite(currentZoom[index]?.end)?{end:currentZoom[index].end}:{}),
          ...(currentZoom[index]?.startValue!=null?{startValue:currentZoom[index].startValue}:{}),
          ...(currentZoom[index]?.endValue!=null?{endValue:currentZoom[index].endValue}:{})
        }));
        riverChart.setOption(
          {
            ...riverOption,
            animationDuration:0,
            animationDurationUpdate:220,
            animationEasingUpdate:"cubicOut",
            dataZoom,
            series:orderedGrowthSeries(next)
          },
          {notMerge:true,lazyUpdate:false}
        );
        if(next) riverChart.dispatchAction({type:"highlight",seriesName:next});
      };
      riverChart.off("mouseover");
      if(growthMode){
        riverChart.on("mouseover",(event)=>{
          if(event.seriesType==="bar"&&chains.includes(event.seriesName)) reorderGrowthStack(event.seriesName);
        });
      }
      riverChart.off("updateAxisPointer");
      riverChart.on("updateAxisPointer",(event)=>{
        const rawValue=event.axesInfo?.[0]?.value;
        const year=typeof rawValue==="number"&&rawValue>=0&&rawValue<years.length
          ?String(years[Math.round(rawValue)])
          :yearFromValue(rawValue);
        if(year) activeRiverYear=year;
      });
      riverChart.getZr().off("click");
      riverChart.getZr().on("click",(event)=>{
        if(event.offsetY<58||event.offsetY>riverChart.getHeight()-64) return;
        openIndustryBreakdown(activeRiverYear);
      });
      riverChart.getZr().off("globalout");
      riverChart.getZr().on("globalout",()=>{
        if(!growthMode||!focusedGrowthChain) return;
        riverChart.dispatchAction({type:"downplay",seriesName:focusedGrowthChain});
        reorderGrowthStack("");
      });
    }
    function renderChinaHeatmap(nodes) {
      const techs=countBy(nodes,(node)=>node.technologyDimension||"未分类").slice(0,9).map((row)=>row.key);
      const applicants=countBy(nodes,applicantTypesOf).slice(0,9).map((row)=>row.key);
      const counts=new Map();
      nodes.forEach((node)=>{
        const tech=node.technologyDimension||"未分类";
        const types=applicantTypesOf(node);
        types.forEach((type)=>{const key=`${tech}\u0000${type}`;counts.set(key,(counts.get(key)||0)+1);});
      });
      const values=[]; techs.forEach((tech,x)=>applicants.forEach((type,y)=>values.push([x,y,counts.get(`${tech}\u0000${type}`)||0])));
      const max=Math.max(1,...values.map((v)=>v[2]));
      applyChart("chinaHeatmap",{
        tooltip:{...tooltipBase(),position:"top",formatter:(p)=>`${esc(techLabel(techs[p.value[0]]))}<br>${esc(applicants[p.value[1]])}<br><b>${fmt(p.value[2])}</b> 个专利族`},
        grid:{left:92,right:22,top:18,bottom:72},
        xAxis:{type:"category",data:techs.map((v)=>v),splitArea:{show:true,areaStyle:{color:["#fff","#f8faf9"]}},axisLine:{show:false},axisTick:{show:false},axisLabel:{...axisLabel(),rotate:0}},
        yAxis:{type:"category",data:applicants,splitArea:{show:true,areaStyle:{color:["#fff","#f8faf9"]}},axisLine:{show:false},axisTick:{show:false},axisLabel:{...axisLabel(),width:78,overflow:"truncate"}},
        visualMap:{min:0,max,calculable:true,orient:"horizontal",left:"center",bottom:8,itemWidth:10,itemHeight:92,inRange:{color:["#f2ede6","#e7c39e","#e9632d","#8c174f"]},textStyle:{fontSize:8,color:"#718092"}},
        series:[{type:"heatmap",data:values,label:{show:values.length<60,fontSize:8,color:"#34413d"},itemStyle:{borderColor:"#fff",borderWidth:2},emphasis:{itemStyle:{shadowBlur:8,shadowColor:"rgba(23,32,30,.18)"}}}]
      });
    }
    function renderChina() {
      const baseNodes=chinaBaseNodes();
      const nodes=chinaSelectedNodes();
      const provinces=countBy(baseNodes,provincesOf);
      const cities=countBy(nodes,citiesOf);
      const edges=edgeSubset(nodes);
      renderKpis("chinaKpis",[
        ["中国相关专利族",nodes.length,state.province||"全国"],
        ["覆盖省份",provinces.length,"申请人地址"],
        ["覆盖城市",cities.length,"当前筛选"],
        ["中国内部引用",edges.length,"族间关系"],
        ["时间窗口",`${state.yearStart}-${state.yearEnd}`,`${DATA.stats.minYear}-${DATA.stats.maxYear}`],
      ]);
      document.getElementById("provinceSelection").textContent=state.province||"全国";
      renderChinaMap();
      renderChinaTrend(nodes);
      renderChinaIndustryRiver(nodes);
      renderChinaHeatmap(nodes);
      applyChart("provinceRanking",barOption(provinces,(v)=>v,(row)=>state.province===row.key?COLORS[1]:COLORS[0],14),(p)=>{state.province=state.province===p.name?"":p.name;scheduleRender();});
      applyChart("cityRanking",barOption(cities,(v)=>v,COLORS[3],14));
    }

    function nodeInfo(node) {
      return {
        "代表 PN":node.label||node.id,
        "专利族全部成员":(node.members||[]).join("；"),
        "专利题名":node.title||"",
        "技术特征":node.technicalFeature||"",
        "B 技术维度":techLabel(node.technologyDimension),
        "产业链一级标签":node.industryDimension||"",
        "产业链二级标签":node.industryLevel2||"",
        "产业链三级标签":node.industryLevel3||"",
        "当前权利人类型":applicantTypesOf(node).join("；"),
        "申请人正式中文名称":node.applicantChineseName||"",
        "国家":countriesOf(node).join("；"),
        "省":node.province||"",
        "市":node.city||"",
        "最早日期":node.date||"",
        "前向邻边 SPC":node.inEdgeSpc||0,
        "后向邻边 SPC":node.outEdgeSpc||0,
      };
    }
    function fieldsHtml(record) {
      return Object.entries(record).map(([key,value])=>{const text=String(value==null||value===""?"-":value);const wide=text.length>80||["AB","CP","MERGED_RECORDS","分类依据","技术特征","专利族全部成员"].includes(key);return `<div class="field ${wide?"wide":""}"><label>${esc(key)}</label><span>${esc(text)}</span></div>`;}).join("");
    }
    const PATH_DIAGRAMS={
      "DIVERSE_SPC:1":{src:"assets/derwent/path-diagrams/diverse_spc_top1.png",title:"磁化靶聚变（MTF）与 FRC 技术路线"},
      "DIVERSE_SPC:2":{src:"assets/derwent/path-diagrams/diverse_spc_top2.png",title:"磁约束、紧凑环与 FRC 磁化靶聚变技术路线"},
      "DIVERSE_SPC:3":{src:"assets/derwent/path-diagrams/diverse_spc_top3.png",title:"束流注入、FRC 复合约束与高性能维持技术路线"},
      "B1:1":{src:"assets/derwent/path-diagrams/磁约束_top1.png",title:"磁约束聚变 MCF 主路线"},
      "B2:1":{src:"assets/derwent/path-diagrams/FRC_top1.png",title:"FRC 与紧凑环聚变主路线"},
      "B3:1":{src:"assets/derwent/path-diagrams/磁惯性_top1.png",title:"磁惯性聚变 MIF 主路线"},
      "B4:1":{src:"assets/derwent/path-diagrams/惯性约束_top1.png",title:"惯性约束聚变 ICF 主路线"},
      "B5:1":{src:"assets/derwent/path-diagrams/替代路线_top1.png",title:"替代、非热及其他聚变路线主路线"},
      "B6:1":{src:"assets/derwent/path-diagrams/LENR_top1.png",title:"LENR 与凝聚态低能核反应主路线"},
    };
    function openNodeInspector(node) {
      if(!node) return;
      document.getElementById("inspectorTitle").textContent=node.label||node.id;
      document.getElementById("inspectorSubtitle").textContent=`${node.year||"年份未知"} · 专利族 ${fmt(node.memberCount||1)} 件`;
      document.getElementById("inspectorBody").innerHTML=`<div class="field-grid">${fieldsHtml(nodeInfo(node))}</div>`;
      document.getElementById("nodeInspector").classList.add("open");
    }
    function openPath(path,label) {
      const nodes=(path.nodes||[]).map((id)=>nodeById.get(id)).filter(Boolean);
      const diagram=PATH_DIAGRAMS[`${state.pathGroup}:${path.rank}`]||null;
      document.getElementById("drawerTitle").textContent=`${label} #${path.rank}`;
      document.getElementById("drawerSummary").textContent=`${nodes.length} 个专利点 · ${path.length} 条边 · ${path.scoreLabel||"路径"} 总和 ${fmt(path.score)}`;
      const nodeDetails=nodes.map((node,index)=>{
        return `<details class="detail-node" ${index===0?"open":""}><summary><span class="detail-order">${index+1}</span><span class="detail-title"><strong>${esc(node.label||node.id)}</strong><small>${esc(node.title||node.applicantChineseName||"无题名")}</small></span><span class="detail-year">${esc(node.year||"-")}</span></summary><div class="detail-content"><h4 class="record-title">专利族节点信息</h4><div class="field-grid">${fieldsHtml(nodeInfo(node))}</div></div></details>`;
      }).join("");
      const drawerBody=document.getElementById("drawerBody");
      drawerBody.classList.toggle("has-diagram",Boolean(diagram));
      drawerBody.innerHTML=diagram
        ? `<section class="path-diagram-stage">
            <div class="path-diagram-toolbar"><div><span>TECHNOLOGY EVOLUTION MAP</span><strong>${esc(diagram.title)}</strong></div><a href="${esc(diagram.src)}" target="_blank" rel="noopener">查看原图</a></div>
            <figure class="path-diagram-figure"><img class="path-diagram-image" src="${esc(diagram.src)}" alt="${esc(diagram.title)}"><figcaption class="path-diagram-missing" hidden><strong>路线图资源待导入</strong><span>${esc(diagram.src)}</span></figcaption></figure>
          </section>
          <aside class="path-node-sidebar"><div class="path-node-sidebar-head"><span>PATH NODES</span><strong>路径专利节点 · ${fmt(nodes.length)}</strong></div>${nodeDetails}</aside>`
        : `<section class="path-node-full"><div class="path-node-sidebar-head"><span>PATH NODES</span><strong>路径专利节点 · ${fmt(nodes.length)}</strong></div>${nodeDetails}</section>`;
      const image=drawerBody.querySelector(".path-diagram-image");
      if(image) image.addEventListener("error",()=>{
        image.hidden=true;
        const missing=drawerBody.querySelector(".path-diagram-missing");
        if(missing) missing.hidden=false;
        drawerBody.querySelector(".path-diagram-toolbar a")?.setAttribute("hidden","");
      },{once:true});
      document.getElementById("pathDrawer").classList.add("open");
      document.body.style.overflow="hidden";
    }
    function getPathsForGroup(group=state.pathGroup) {
      if(group==="SPC") return DATA.topSpcPaths||[];
      if(group==="DIVERSE_SPC") return DATA.topDiverseSpcPaths||[];
      return (DATA.topBxB7TechnologyPaths||{})[group]||[];
    }
    function pathGroupTitle(group=state.pathGroup) {
      if(group==="SPC") return "SPC 累计路径 Top 10";
      if(group==="DIVERSE_SPC") return "全球历史主路线 Top 10";
      return `${TECH_ROUTE_NAMES[group]||group} · 直接关联 B7 · SPNP Top 3`;
    }
    function getActivePath() {
      const paths=getPathsForGroup();
      if(!paths.length) return null;
      state.activePathIndex=Math.min(Math.max(0,state.activePathIndex),paths.length-1);
      return paths[state.activePathIndex];
    }
    function renderPaths() {
      const groups=["DIVERSE_SPC","B1","B2","B3","B4","B5","B6"];
      const labels={
        DIVERSE_SPC:"全球历史主路线",
        ...TECH_ROUTE_NAMES,
      };
      const descriptions={
        DIVERSE_SPC:"主动减少新路径与已有路径的重复，确保重合度不超过50%，从而发现更多不同的技术方向和潜在发展机会。",
      };
      document.getElementById("pathGroups").innerHTML=groups.map((group)=>{
        const title=labels[group]||`${group} 技术路线`;
        const description=descriptions[group]||"";
        return `<button class="path-group ${state.pathGroup===group?"active":""}" data-path-group="${group}"><span class="path-group-title">${title}</span>${description?`<span class="path-group-description">${description}</span>`:""}</button>`;
      }).join("");
      document.querySelectorAll("[data-path-group]").forEach((button)=>button.addEventListener("click",()=>{state.pathGroup=button.dataset.pathGroup;state.activePathIndex=0;renderPaths();if(state.view==="world")renderCitationNetwork(worldSelectedNodes());}));
      const isSpc=["SPC","DIVERSE_SPC"].includes(state.pathGroup);
      const paths=getPathsForGroup();
      const meta=(DATA.bxB7PathGroupMeta||{})[state.pathGroup]||{};
      const title=pathGroupTitle();
      const notes={
        SPC:"允许任意节点作为起点，按路径线段 SPC 累计值排名",
        DIVERSE_SPC:"主动减少新路径与已有路径的重复，确保重合度不超过50%，从而发现更多不同的技术方向和潜在发展机会。",
      };
      const note=isSpc?notes[state.pathGroup]:`${state.pathGroup} 专利族 ${fmt(meta.bxNodes||0)} · 关联 B7 ${fmt(meta.connectedB7Nodes||0)} · 并集 ${fmt(meta.unionNodes||0)}`;
      document.getElementById("pathSummary").innerHTML=`<div><strong>${esc(title)}</strong>${esc(note)}</div><div>${fmt(paths.length)} 条路径</div>`;
      document.getElementById("pathList").innerHTML=paths.map((path,index)=>{
        const labels=(path.nodes||[]).map((id)=>nodeById.get(id)?.label||id);
        const shown=labels.slice(0,6);
        const ribbon=shown.map((label,i)=>`${i?'<span class="path-arrow">›</span>':''}<span class="path-node-label">${esc(label)}</span>`).join("")+(labels.length>6?`<span class="path-arrow">›</span><span class="path-node-label">另 ${labels.length-6} 个</span>`:"");
        const endpointTitle=labels.length?`${labels[0]} → ${labels[labels.length-1]}`:"路径专利号待补充";
        const active=state.activePathIndex===index;
        return `<div class="path-item ${active?"active":""}" data-path-index="${index}" role="button" tabindex="0" aria-pressed="${active}"><span class="path-item-head"><span class="path-rank">#${path.rank}</span><span class="path-title">${esc(endpointTitle)}</span><button class="path-detail-button" type="button" data-path-detail="${index}">查看详情</button></span><span class="path-ribbon">${ribbon}</span></div>`;
      }).join("")||'<div class="empty">当前分组没有可用路径</div>';
      const activatePath=(index,showDetails=false)=>{
        const path=paths[index];
        if(!path) return;
        state.activePathIndex=index;
        renderPaths();
        if(state.view==="world") renderCitationNetwork(worldSelectedNodes());
        if(showDetails) openPath(path,title);
      };
      document.querySelectorAll("[data-path-index]").forEach((item)=>{
        item.addEventListener("click",(event)=>{
          if(event.target.closest("[data-path-detail]")) return;
          activatePath(Number(item.dataset.pathIndex));
        });
        item.addEventListener("keydown",(event)=>{
          if(event.target!==item||!["Enter"," "].includes(event.key)) return;
          event.preventDefault();
          activatePath(Number(item.dataset.pathIndex));
        });
      });
      document.querySelectorAll("[data-path-detail]").forEach((button)=>button.addEventListener("click",(event)=>{
        event.stopPropagation();
        activatePath(Number(button.dataset.pathDetail),true);
      }));
    }

    function setupInfographicCarousel() {
      const viewport=document.getElementById("infographicViewport");
      const track=document.getElementById("infographicTrack");
      const dots=document.getElementById("infographicDots");
      const enlarge=document.getElementById("infographicEnlarge");
      const playButton=document.getElementById("infographicPlay");
      const lightbox=document.getElementById("infographicLightbox");
      if(!viewport||!track||!dots||!enlarge||!playButton||!lightbox) return;
      let activeIndex=0;
      let playing=true;
      let timer=null;
      let hovering=false;

      track.innerHTML=INFOGRAPHIC_CARDS.map((item,index)=>`<button class="infographic-slide" type="button" data-infographic-card="${index}" aria-label="${esc(item.title)}"><img src="${esc(item.src)}" alt="${esc(item.title)}"><span class="infographic-missing"><b>${String(index+1).padStart(2,"0")} / 05</b><strong>${esc(item.title)}</strong><small>原图待导入<br>${esc(item.src)}</small></span></button>`).join("");
      dots.innerHTML=INFOGRAPHIC_CARDS.map((item,index)=>`<button type="button" data-infographic-dot="${index}" aria-label="查看${esc(item.title)}"></button>`).join("");
      const slides=Array.from(track.querySelectorAll("[data-infographic-card]"));
      slides.forEach((slide)=>{
        const image=slide.querySelector("img");
        image.addEventListener("error",()=>{slide.classList.add("image-missing");if(Number(slide.dataset.infographicCard)===activeIndex) enlarge.disabled=true;},{once:true});
        image.addEventListener("load",()=>{slide.classList.remove("image-missing");if(Number(slide.dataset.infographicCard)===activeIndex) enlarge.disabled=false;});
      });

      const normalizedDelta=(index)=>{
        let delta=index-activeIndex;
        const half=INFOGRAPHIC_CARDS.length/2;
        if(delta>half) delta-=INFOGRAPHIC_CARDS.length;
        if(delta<-half) delta+=INFOGRAPHIC_CARDS.length;
        return delta;
      };
      const render=()=>{
        const current=INFOGRAPHIC_CARDS[activeIndex];
        slides.forEach((slide,index)=>{
          const delta=normalizedDelta(index);
          slide.className=`infographic-slide ${delta===0?"is-active":delta===-1?"is-prev":delta===1?"is-next":delta<0?"is-far-prev":"is-far-next"}${slide.classList.contains("image-missing")?" image-missing":""}`;
          slide.setAttribute("aria-current",delta===0?"true":"false");
        });
        dots.querySelectorAll("[data-infographic-dot]").forEach((dot,index)=>dot.classList.toggle("active",index===activeIndex));
        document.getElementById("infographicIndex").textContent=String(activeIndex+1).padStart(2,"0");
        document.getElementById("infographicKicker").textContent=current.kicker;
        document.getElementById("infographicTitle").textContent=current.title;
        enlarge.disabled=slides[activeIndex].classList.contains("image-missing");
      };
      const stopTimer=()=>{if(timer){clearInterval(timer);timer=null;}};
      const startTimer=()=>{
        stopTimer();
        if(playing&&!hovering) timer=setInterval(()=>{activeIndex=(activeIndex+1)%INFOGRAPHIC_CARDS.length;render();},4800);
      };
      const select=(index,restart=true)=>{
        activeIndex=((index%INFOGRAPHIC_CARDS.length)+INFOGRAPHIC_CARDS.length)%INFOGRAPHIC_CARDS.length;
        render();
        if(restart) startTimer();
      };
      const openLightbox=()=>{
        if(enlarge.disabled) return;
        const item=INFOGRAPHIC_CARDS[activeIndex];
        document.getElementById("infographicLightboxImage").src=item.src;
        document.getElementById("infographicLightboxImage").alt=item.title;
        document.getElementById("infographicLightboxKicker").textContent=item.kicker;
        document.getElementById("infographicLightboxTitle").textContent=item.title;
        lightbox.hidden=false;
        document.body.style.overflow="hidden";
      };
      const closeLightbox=()=>{lightbox.hidden=true;document.body.style.overflow="";};

      slides.forEach((slide)=>slide.addEventListener("click",()=>{
        const index=Number(slide.dataset.infographicCard);
        if(index===activeIndex) openLightbox(); else select(index);
      }));
      dots.querySelectorAll("[data-infographic-dot]").forEach((dot)=>dot.addEventListener("click",()=>select(Number(dot.dataset.infographicDot))));
      document.getElementById("infographicPrev").addEventListener("click",()=>select(activeIndex-1));
      document.getElementById("infographicNext").addEventListener("click",()=>select(activeIndex+1));
      enlarge.addEventListener("click",openLightbox);
      playButton.addEventListener("click",()=>{
        playing=!playing;
        playButton.textContent=playing?"暂停轮播":"自动轮播";
        startTimer();
      });
      viewport.addEventListener("mouseenter",()=>{hovering=true;stopTimer();});
      viewport.addEventListener("mouseleave",()=>{hovering=false;startTimer();});
      viewport.addEventListener("keydown",(event)=>{
        if(event.key==="ArrowLeft"){event.preventDefault();select(activeIndex-1);}
        if(event.key==="ArrowRight"){event.preventDefault();select(activeIndex+1);}
        if(event.key==="Enter"){event.preventDefault();openLightbox();}
      });
      document.getElementById("infographicLightboxClose").addEventListener("click",closeLightbox);
      lightbox.addEventListener("click",(event)=>{if(event.target===lightbox) closeLightbox();});
      document.addEventListener("keydown",(event)=>{if(event.key==="Escape"&&!lightbox.hidden) closeLightbox();});
      render();
      startTimer();
    }

    function setupClassificationBrowser() {
      const browser=document.getElementById("classificationBrowser");
      const list=document.getElementById("classificationList");
      const detail=document.getElementById("classificationDetail");
      const modeButtons=Array.from(document.querySelectorAll("[data-classification-mode]"));
      if(!browser||!list||!detail||!modeButtons.length) return;
      const industryCards=Object.entries(INDUSTRY_CHAIN_GUIDE).map(([code,guide])=>({code,...guide,...INDUSTRY_CHAIN_CARD_META[code]}));
      const modeMeta={
        industry:{eyebrow:"INDUSTRY CHAIN",title:"产业链分类",description:"从上游基础供给、中游装置集成到下游能源应用。"},
        technology:{eyebrow:"TECHNOLOGY ROUTES",title:"技术路线分类",description:"通过 B1–B9 区分聚变路线、通用支撑技术、基础科学与潜力应用。"},
      };
      const state={mode:"industry",index:0};
      const cards=()=>state.mode==="industry"?industryCards:TECHNOLOGY_CARD_GUIDE;
      const render=()=>{
        const collection=cards();
        state.index=Math.min(Math.max(0,state.index),collection.length-1);
        const current=collection[state.index];
        const meta=modeMeta[state.mode];
        browser.dataset.mode=state.mode;
        document.getElementById("classificationEyebrow").textContent=meta.eyebrow;
        document.getElementById("classificationModeTitle").textContent=meta.title;
        document.getElementById("classificationModeDescription").textContent=meta.description;
        modeButtons.forEach((button)=>{
          const active=button.dataset.classificationMode===state.mode;
          button.classList.toggle("active",active);
          button.setAttribute("aria-selected",String(active));
        });
        list.innerHTML=collection.map((item,index)=>`<button class="${index===state.index?"active":""}" type="button" role="tab" aria-selected="${index===state.index}" data-classification-card="${index}"><b>${esc(item.code)}</b><span>${esc(item.title)}</span></button>`).join("");
        list.querySelectorAll("[data-classification-card]").forEach((button)=>button.addEventListener("click",()=>{state.index=Number(button.dataset.classificationCard);render();}));
        if(state.mode==="industry") {
          detail.innerHTML=`<div class="classification-detail-title"><span>${esc(current.eyebrow)}</span><h5>${esc(current.code)} · ${esc(current.title)}</h5><p>${esc(current.summary)}</p></div><div class="classification-accordion">${current.items.map((item,index)=>`<details ${index===0?"open":""}><summary><b>${String(index+1).padStart(2,"0")}</b><span>${esc(item.name)}</span><i>+</i></summary><p>${esc(item.description)}</p><div>${item.tags.map((tag)=>`<em>${esc(tag)}</em>`).join("")}</div></details>`).join("")}</div>`;
        } else {
          detail.innerHTML=`<div class="classification-detail-title"><span>${esc(current.eyebrow)}</span><h5>${esc(current.code)} · ${esc(current.title)}</h5><p>${esc(current.summary)}</p></div><div class="classification-object-head"><span>典型技术与装置</span><b>KEY OBJECTS</b></div><div class="classification-object-tags">${current.tags.map((tag)=>`<em>${esc(tag)}</em>`).join("")}</div>`;
        }
      };
      modeButtons.forEach((button)=>button.addEventListener("click",()=>{
        if(state.mode===button.dataset.classificationMode) return;
        state.mode=button.dataset.classificationMode;
        state.index=0;
        render();
      }));
      render();
    }

    function syncControls() {
      const min=Number(DATA.stats.minYear),max=Number(DATA.stats.maxYear),span=Math.max(1,max-min);
      const start=document.getElementById("yearStart"),end=document.getElementById("yearEnd");
      start.value=state.yearStart; end.value=state.yearEnd;
      start.style.zIndex=state.yearStart>=max-1?3:2; end.style.zIndex=state.yearStart>=max-1?2:3;
      document.getElementById("yearStartText").textContent=state.yearStart;
      document.getElementById("yearEndText").textContent=state.yearEnd;
      document.getElementById("yearFill").style.left=`${(state.yearStart-min)/span*100}%`;
      document.getElementById("yearFill").style.right=`${100-(state.yearEnd-min)/span*100}%`;
      document.getElementById("techFilter").value=state.technology;
      document.getElementById("industryFilter").value=state.industry1;
      document.getElementById("applicantFilter").value=state.applicantType;
      document.querySelectorAll("[data-world-layer]").forEach((button)=>button.classList.toggle("active",state.worldLayers[button.dataset.worldLayer]));
      document.querySelectorAll("[data-world-trend-mode]").forEach((button)=>button.classList.toggle("active",state.worldTrendMode===button.dataset.worldTrendMode));
      renderActiveFilters();
    }
    function renderAll() {
      syncControls();
      if(state.view==="world") renderWorld(); else renderChina();
    }
    function scheduleRender() {
      if(document.documentElement.dataset.module==="technology"){
        Object.assign(state,{
          yearStart:Number(DATA.stats.minYear),
          yearEnd:Number(DATA.stats.maxYear),
          technology:"",
          industry1:"",
          applicantType:"",
          country:"",
          province:"",
          matrixPeriodIndex:null,
        });
      }
      if(renderFrame) cancelAnimationFrame(renderFrame);
      renderFrame=requestAnimationFrame(()=>{renderFrame=null;renderAll();});
    }
    function setupFilters() {
      const min=Number(DATA.stats.minYear),max=Number(DATA.stats.maxYear);
      ["yearStart","yearEnd"].forEach((id)=>{
        const input=document.getElementById(id); input.min=min; input.max=max; input.step=1;
        input.addEventListener("input",()=>{
          const value=Number(input.value);
          if(id==="yearStart"){state.yearStart=value;if(state.yearStart>state.yearEnd)state.yearEnd=state.yearStart;}
          else{state.yearEnd=value;if(state.yearEnd<state.yearStart)state.yearStart=state.yearEnd;}
          stopPlayback(); stopMatrixPlayback(); scheduleRender();
        });
      });
      const techCodes=["B1","B2","B3","B4","B5","B6","B7","B8","B9"].filter((code)=>DATA.nodes.some((node)=>node.technologyDimension===code));
      document.getElementById("techFilter").innerHTML+=""+techCodes.map((code)=>`<option value="${esc(code)}">${esc(techLabel(code))}</option>`).join("");
      countBy(DATA.nodes,(node)=>node.industryDimension||"未分类").forEach((row)=>document.getElementById("industryFilter").insertAdjacentHTML("beforeend",`<option value="${esc(row.key)}">${esc(row.key)}</option>`));
      countBy(DATA.nodes,applicantTypesOf).forEach((row)=>document.getElementById("applicantFilter").insertAdjacentHTML("beforeend",`<option value="${esc(row.key)}">${esc(row.key)}</option>`));
      document.getElementById("techFilter").addEventListener("change",(e)=>{state.technology=e.target.value;scheduleRender();});
      document.getElementById("industryFilter").addEventListener("change",(e)=>{state.industry1=e.target.value;scheduleRender();});
      document.getElementById("applicantFilter").addEventListener("change",(e)=>{state.applicantType=e.target.value;scheduleRender();});
      document.getElementById("resetFilters").addEventListener("click",()=>{stopPlayback();stopMatrixPlayback();Object.assign(state,{yearStart:min,yearEnd:max,technology:"",industry1:"",applicantType:"",country:"",province:"",matrixPeriodIndex:null});scheduleRender();});
      document.querySelectorAll("[data-world-layer]").forEach((button)=>button.addEventListener("click",()=>{state.worldLayers[button.dataset.worldLayer]=!state.worldLayers[button.dataset.worldLayer];renderWorldMap();syncControls();}));
      document.querySelectorAll("[data-world-trend-mode]").forEach((button)=>button.addEventListener("click",()=>{state.worldTrendMode=button.dataset.worldTrendMode;scheduleRender();}));
    }
    function stopPlayback() {
      if(yearTimer){clearInterval(yearTimer);yearTimer=null;document.getElementById("playYears").classList.remove("playing");}
    }
    function togglePlayback() {
      if(yearTimer){stopPlayback();return;}
      const min=Number(DATA.stats.minYear),max=Number(DATA.stats.maxYear);
      let year=state.yearStart===state.yearEnd?state.yearStart:min;
      state.yearStart=year;state.yearEnd=year;document.getElementById("playYears").classList.add("playing");scheduleRender();
      yearTimer=setInterval(()=>{year=year>=max?min:year+1;state.yearStart=year;state.yearEnd=year;scheduleRender();},850);
    }
    function switchView(view) {
      stopPlayback();stopMatrixPlayback();state.view=view;
      document.getElementById("worldView").hidden=view!=="world";
      document.getElementById("chinaView").hidden=view!=="china";
      document.querySelectorAll(".view-tab").forEach((button)=>button.classList.toggle("active",button.dataset.view===view));
      scheduleRender();setTimeout(()=>{charts.forEach((instance)=>instance.resize());resizeMatrixScene(true);},40);
    }

    document.querySelectorAll(".view-tab").forEach((button)=>button.addEventListener("click",()=>switchView(button.dataset.view)));
    document.querySelectorAll("[data-matrix-view]").forEach((button)=>button.addEventListener("click",()=>setMatrixView(button.dataset.matrixView,true)));
    document.getElementById("matrixResetView").addEventListener("click",()=>{
      if(state.matrixView!=="3d") setMatrixView("3d",true);
      else resetMatrixCamera();
      document.getElementById("matrixModeReadout").textContent="自由 3D 视角";
    });
    document.querySelectorAll("[data-river-mode]").forEach((button)=>button.addEventListener("click",()=>{
      if(!["count","share","growth"].includes(button.dataset.riverMode)||state.riverMode===button.dataset.riverMode) return;
      state.riverMode=button.dataset.riverMode;
      renderChinaIndustryRiver(chinaSelectedNodes());
    }));
    document.getElementById("matrixPlay").addEventListener("click",toggleMatrixPlayback);
    document.getElementById("matrixAllYears").addEventListener("click",()=>{
      stopMatrixPlayback();
      state.matrixPeriodIndex=null;
      renderWorldComposition(worldSelectedNodes());
    });
    document.getElementById("matrixYearRange").addEventListener("input",(event)=>{
      stopMatrixPlayback();
      state.matrixPeriodIndex=Number(event.target.value);
      renderWorldComposition(worldSelectedNodes());
    });
    document.getElementById("playYears").addEventListener("click",togglePlayback);
    document.getElementById("inspectorClose").addEventListener("click",()=>document.getElementById("nodeInspector").classList.remove("open"));
    document.getElementById("drawerClose").addEventListener("click",()=>{document.getElementById("pathDrawer").classList.remove("open");document.body.style.overflow="";});
    document.getElementById("pathDrawer").addEventListener("click",(event)=>{if(event.target.id==="pathDrawer")document.getElementById("drawerClose").click();});
    document.addEventListener("keydown",(event)=>{if(event.key==="Escape"){document.getElementById("drawerClose").click();document.getElementById("inspectorClose").click();}});
    window.addEventListener("resize",()=>{
      charts.forEach((instance)=>instance.resize());
      resizeMatrixScene(true);
      if(state.view==="world") drawMatrixTimeline(buildMatrixTimelineStats(worldSelectedNodes()));
    });

    document.getElementById("topCount").textContent=fmt(DATA.stats.families);
    document.getElementById("sourceName").textContent=`${DATA.dashboardMeta.inputFile} · ${DATA.dashboardMeta.generatedAt}`;
    setupFilters();setupInfographicCarousel();setupClassificationBrowser();renderPaths();renderAll();
