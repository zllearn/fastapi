const payload = window.FRONTIER_DASHBOARD_DATA;
    const metrics = payload.metrics;
    const labels = payload.metricLabels;
    const explanations = payload.metricExplanations || {};
    const axisExplanations = payload.metricAxisExplanations || {};
    const resultLimit = payload.sorterResultLimit || 10;
    const interpretations = payload.interpretations || {};
    const singleMetricDirectionSummaries = payload.singleMetricDirectionSummaries || {};
    const topics = new Map(payload.topics.map(topic => [topic.topic_id, topic]));
    const center = 360;
    const radius = 238;
    const labelRadius = 296;
    const top1Radius = 268;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.getElementById('radar');
    const trendSvg = document.getElementById('patentTrend');
    const trendSummary = document.getElementById('trendSummary');
    const growthSvg = document.getElementById('growthTrend');
    const growthSummary = document.getElementById('growthSummary');
    const ipcSvg = document.getElementById('ipcDistribution');
    const ipcSummary = document.getElementById('ipcSummary');
    const ipcLegend = document.getElementById('ipcLegend');
    const hoverTip = document.getElementById('hoverTip');
    let currentTopic = topics.get(payload.initialTopicId);
    let currentValues = metrics.map(metric => safeRelative(currentTopic, metric));
    let currentRMax = rMaxForValues(currentValues);
    let polygon;
    let pointNodes = [];
    let top1Labels = [];
    let tickNodes = [];
    let avgRing;
    let selectedSortMetrics = [];

    function createSvg(tag, attrs = {}) {
      const node = document.createElementNS(ns, tag);
      Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
      return node;
    }

    function angleAt(index) {
      return -Math.PI / 2 + (Math.PI * 2 * index / metrics.length);
    }

    function coord(index, value, rMax, extra = 0) {
      const angle = angleAt(index);
      const scaled = Math.max(0, Math.min(value / rMax, 1));
      const r = radius * scaled + extra;
      return {
        x: center + Math.cos(angle) * r,
        y: center + Math.sin(angle) * r
      };
    }

    function coordAbsolute(index, absoluteRadius) {
      const angle = angleAt(index);
      return {
        x: center + Math.cos(angle) * absoluteRadius,
        y: center + Math.sin(angle) * absoluteRadius
      };
    }

    function safeRelative(topic, metric) {
      const value = topic?.relative?.[metric];
      return Number.isFinite(value) ? value : 0;
    }

    function rMaxForValues(values) {
      const finite = values.filter(Number.isFinite);
      const maxValue = finite.length ? Math.max(...finite) : 1;
      return Math.min(3, Math.max(1.5, Math.ceil(maxValue * 2) / 2));
    }

    function pointsFor(values, rMax) {
      return values.map((value, index) => {
        const p = coord(index, value, rMax);
        return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      }).join(' ');
    }

    function ringPoints(value, rMax) {
      return metrics.map((_, index) => {
        const p = coord(index, value, rMax);
        return `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      }).join(' ');
    }

    function drawBase() {
      svg.innerHTML = '';
      [0.5, 1.0, 1.5, 2.0, 2.5, 3.0].forEach(tick => {
        const ring = createSvg('polygon', { class: tick === 1 ? 'avg-ring' : 'grid-line', points: ringPoints(tick, currentRMax), 'data-tick': tick });
        svg.appendChild(ring);
        if (tick !== 1) tickNodes.push(ring);
        else avgRing = ring;
      });

      metrics.forEach((metric, index) => {
        const end = coordAbsolute(index, radius);
        svg.appendChild(createSvg('line', { class: 'axis-line', x1: center, y1: center, x2: end.x, y2: end.y }));
        const label = coordAbsolute(index, labelRadius);
        const text = createSvg('text', { class: 'axis-label', x: label.x, y: label.y, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
        text.textContent = labels[metric] || metric;
        text.addEventListener('mouseenter', event => showTip(event, axisMetricTooltip(metric)));
        text.addEventListener('mousemove', moveTip);
        text.addEventListener('mouseleave', hideTip);
        svg.appendChild(text);
      });

      const tickLabel = createSvg('text', { class: 'tick-label', x: center + 8, y: center - radius / currentRMax, id: 'avgTickLabel' });
      tickLabel.textContent = '1.0 均值';
      svg.appendChild(tickLabel);

      polygon = createSvg('polygon', { class: 'radar-shape', points: pointsFor(currentValues, currentRMax) });
      svg.appendChild(polygon);

      metrics.forEach((metric, index) => {
        const p = coord(index, currentValues[index], currentRMax);
        const circle = createSvg('circle', { class: 'radar-point', cx: p.x, cy: p.y, r: 5 });
        pointNodes.push(circle);
        svg.appendChild(circle);
        const marker = coordAbsolute(index, top1Radius);
        const topLabel = createSvg('text', { class: 'top1-label', x: marker.x, y: marker.y, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
        topLabel.textContent = '第1';
        top1Labels.push(topLabel);
        svg.appendChild(topLabel);
      });
    }

    function updateGrid(rMax) {
      svg.querySelectorAll('[data-tick]').forEach(node => {
        const tick = Number(node.getAttribute('data-tick'));
        node.setAttribute('points', ringPoints(tick, rMax));
        node.style.display = tick <= rMax ? '' : 'none';
      });
      const avgLabel = document.getElementById('avgTickLabel');
      if (avgLabel) {
        avgLabel.setAttribute('y', center - radius / rMax);
      }
    }

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function animateRadar(nextTopic) {
      const startValues = currentValues.slice();
      const targetValues = metrics.map(metric => safeRelative(nextTopic, metric));
      const startRMax = currentRMax;
      const targetRMax = rMaxForValues(targetValues);
      const startTime = performance.now();
      const duration = 520;

      function frame(now) {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = easeOutCubic(t);
        const values = startValues.map((value, index) => value + (targetValues[index] - value) * eased);
        const rMax = startRMax + (targetRMax - startRMax) * eased;
        polygon.setAttribute('points', pointsFor(values, rMax));
        pointNodes.forEach((node, index) => {
          const p = coord(index, values[index], rMax);
          node.setAttribute('cx', p.x);
          node.setAttribute('cy', p.y);
        });
        updateGrid(rMax);
        if (t < 1) requestAnimationFrame(frame);
        else {
          currentValues = targetValues;
          currentRMax = targetRMax;
          updateTop1Labels(nextTopic);
        }
      }
      requestAnimationFrame(frame);
    }

    function niceTrendMax(value) {
      if (!Number.isFinite(value) || value <= 0) return 1;
      if (value <= 5) return Math.ceil(value);
      const power = Math.pow(10, Math.floor(Math.log10(value)));
      const scaled = value / power;
      if (scaled <= 2) return 2 * power;
      if (scaled <= 5) return 5 * power;
      return 10 * power;
    }

    function formatCount(value) {
      return Number.isFinite(value) ? String(Math.round(value)) : '0';
    }

    function patentTrendSeries(topic) {
      if (Array.isArray(topic?.recent_patent_counts) && topic.recent_patent_counts.length) {
        return topic.recent_patent_counts
          .map(item => ({ period: String(item.period || ''), label: String(item.label || item.period || ''), count: Number(item.count) }))
          .filter(item => item.period && item.label && Number.isFinite(item.count));
      }
      const periods = Array.isArray(payload.patentTrendPeriods) ? payload.patentTrendPeriods : [];
      return periods
        .map(item => ({ period: String(item.period || ''), label: String(item.label || item.period || ''), count: 0 }))
        .filter(item => item.period && item.label);
    }

    function trendX(index, length, left, width) {
      if (length <= 1) return left + width / 2;
      return left + width * index / (length - 1);
    }

    function shouldShowPeriodLabel(index, length) {
      if (length <= 14) return true;
      if (length <= 26) return index % 2 === 0 || index === length - 1;
      return index % 4 === 0 || index === length - 1;
    }

    function shouldShowPointValue(index, length) {
      return length <= 16 || index === length - 1;
    }

    function trendY(count, yMax, top, height) {
      return top + height * (1 - Math.max(0, Math.min(count / yMax, 1)));
    }

    function renderPatentTrend(topic) {
      const series = patentTrendSeries(topic);
      trendSvg.innerHTML = '';
      if (!series.length) {
        trendSummary.textContent = '暂无年度数据';
        const empty = createSvg('text', {
          class: 'trend-empty',
          x: 360,
          y: 112,
          'text-anchor': 'middle',
          'dominant-baseline': 'central'
        });
        empty.textContent = '暂无年度数据';
        trendSvg.appendChild(empty);
        return;
      }

      const left = 54;
      const right = 690;
      const top = 24;
      const bottom = 174;
      const width = right - left;
      const height = bottom - top;
      const counts = series.map(item => Math.max(0, item.count));
      const labels = series.map(item => item.label);
      const total = counts.reduce((sum, value) => sum + value, 0);
      const yMax = niceTrendMax(Math.max(...counts));
      const midTick = yMax <= 2 ? 1 : Math.round(yMax / 2);
      const yTicks = [...new Set([0, midTick, yMax])].sort((a, b) => a - b);

      trendSummary.textContent = `${labels[0]}-${labels[labels.length - 1]} 合计 ${formatCount(total)} 件`;

      yTicks.forEach(tick => {
        const y = trendY(tick, yMax, top, height);
        trendSvg.appendChild(createSvg('line', { class: 'trend-grid', x1: left, y1: y, x2: right, y2: y }));
        const label = createSvg('text', { class: 'trend-label', x: left - 10, y, 'text-anchor': 'end', 'dominant-baseline': 'central' });
        label.textContent = formatCount(tick);
        trendSvg.appendChild(label);
      });

      trendSvg.appendChild(createSvg('line', { class: 'trend-axis', x1: left, y1: bottom, x2: right, y2: bottom }));
      trendSvg.appendChild(createSvg('line', { class: 'trend-axis', x1: left, y1: top, x2: left, y2: bottom }));

      const points = series.map((item, index) => ({
        x: trendX(index, series.length, left, width),
        y: trendY(Math.max(0, item.count), yMax, top, height),
        period: item.period,
        label: item.label,
        count: Math.max(0, item.count)
      }));
      const linePoints = points.map(point => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
      trendSvg.appendChild(createSvg('polyline', { class: 'trend-line', points: linePoints }));

      points.forEach((point, index) => {
        if (shouldShowPeriodLabel(index, points.length)) {
          const xLabel = createSvg('text', {
            class: 'trend-label',
            x: point.x,
            y: bottom + 24,
            'text-anchor': 'middle',
            'dominant-baseline': 'central'
          });
          xLabel.textContent = point.label;
          trendSvg.appendChild(xLabel);
        }

        if (shouldShowPointValue(index, points.length)) {
          const valueLabel = createSvg('text', {
            class: 'trend-value',
            x: point.x,
            y: Math.max(top + 10, point.y - 10),
            'text-anchor': 'middle',
            'dominant-baseline': 'central'
          });
          valueLabel.textContent = formatCount(point.count);
          trendSvg.appendChild(valueLabel);
        }

      });
    }

    function formatPercent(value) {
      if (!Number.isFinite(value)) return '不可算';
      const percent = value * 100;
      const digits = Math.abs(percent) < 10 && percent !== 0 ? 1 : 0;
      return `${percent.toFixed(digits)}%`;
    }

    function niceGrowthMax(value) {
      if (!Number.isFinite(value) || value <= 0) return 1;
      if (value <= 0.5) return 0.5;
      if (value <= 1) return 1;
      if (value <= 2) return 2;
      if (value <= 5) return 5;
      return Math.ceil(value / 5) * 5;
    }

    function growthY(value, maxAbs, top, height) {
      const clipped = Math.max(-maxAbs, Math.min(value, maxAbs));
      return top + height * (1 - ((clipped + maxAbs) / (2 * maxAbs)));
    }

    function renderGrowthTrend(topic) {
      const series = Array.isArray(topic?.growth_rate_series) ? topic.growth_rate_series : [];
      growthSvg.innerHTML = '';
      const usable = series
        .map(item => ({
          period: String(item.period || ''),
          label: String(item.label || item.period || ''),
          count: Number(item.count),
          previous_count: item.previous_count === null || item.previous_count === undefined ? null : Number(item.previous_count),
          growth_rate: item.growth_rate === null || item.growth_rate === undefined ? null : Number(item.growth_rate)
        }))
        .filter(item => item.period && item.label && Number.isFinite(item.count));
      const finite = usable.filter(item => Number.isFinite(item.growth_rate));
      if (!usable.length || !finite.length) {
        growthSummary.textContent = '暂无可计算增长率';
        const empty = createSvg('text', {
          class: 'trend-empty',
          x: 360,
          y: 112,
          'text-anchor': 'middle',
          'dominant-baseline': 'central'
        });
        empty.textContent = '暂无可计算增长率';
        growthSvg.appendChild(empty);
        return;
      }

      const left = 54;
      const right = 690;
      const top = 24;
      const bottom = 174;
      const width = right - left;
      const height = bottom - top;
      const maxAbs = niceGrowthMax(Math.max(...finite.map(item => Math.abs(item.growth_rate))));
      const labels = usable.map(item => item.label);
      const latest = [...finite].reverse()[0];
      const avg = finite.reduce((sum, item) => sum + item.growth_rate, 0) / finite.length;
      growthSummary.textContent = `${labels[0]}-${labels[labels.length - 1]} 最近 ${formatPercent(latest.growth_rate)} | 平均 ${formatPercent(avg)}`;

      [-maxAbs, 0, maxAbs].forEach(tick => {
        const y = growthY(tick, maxAbs, top, height);
        growthSvg.appendChild(createSvg('line', {
          class: tick === 0 ? 'zero-line' : 'trend-grid',
          x1: left,
          y1: y,
          x2: right,
          y2: y
        }));
        const label = createSvg('text', { class: 'trend-label', x: left - 10, y, 'text-anchor': 'end', 'dominant-baseline': 'central' });
        label.textContent = formatPercent(tick);
        growthSvg.appendChild(label);
      });

      growthSvg.appendChild(createSvg('line', { class: 'trend-axis', x1: left, y1: bottom, x2: right, y2: bottom }));
      growthSvg.appendChild(createSvg('line', { class: 'trend-axis', x1: left, y1: top, x2: left, y2: bottom }));

      const points = usable.map((item, index) => ({
        x: trendX(index, usable.length, left, width),
        y: Number.isFinite(item.growth_rate) ? growthY(item.growth_rate, maxAbs, top, height) : null,
        label: item.label,
        count: item.count,
        previous_count: item.previous_count,
        growth_rate: item.growth_rate
      }));

      let segment = [];
      points.forEach(point => {
        if (point.y === null) {
          if (segment.length >= 2) {
            growthSvg.appendChild(createSvg('polyline', { class: 'growth-line', points: segment.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') }));
          }
          segment = [];
          return;
        }
        segment.push(point);
      });
      if (segment.length >= 2) {
        growthSvg.appendChild(createSvg('polyline', { class: 'growth-line', points: segment.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') }));
      }

      points.forEach((point, index) => {
        if (shouldShowPeriodLabel(index, points.length)) {
          const xLabel = createSvg('text', {
            class: 'trend-label',
            x: point.x,
            y: bottom + 24,
            'text-anchor': 'middle',
            'dominant-baseline': 'central'
          });
          xLabel.textContent = point.label;
          growthSvg.appendChild(xLabel);
        }
      });
    }

    const ipcColors = ['#005fb8', '#007a63', '#b23b3b', '#7a5c00', '#725ac1', '#0086a8', '#8a94a6'];

    function renderIpcDistribution(topic) {
      const payload = topic?.ipc_year_distribution || {};
      const years = Array.isArray(payload.years) ? payload.years : [];
      const codes = Array.isArray(payload.codes) ? payload.codes : [];
      ipcSvg.innerHTML = '';
      ipcLegend.innerHTML = '';
      const totalAll = years.reduce((sum, row) => sum + Number(row.total || 0), 0);
      if (!years.length || !codes.length || totalAll <= 0) {
        ipcSummary.textContent = '暂无 IPC subclass 数据';
        const empty = createSvg('text', {
          class: 'trend-empty',
          x: 360,
          y: 128,
          'text-anchor': 'middle',
          'dominant-baseline': 'central'
        });
        empty.textContent = '暂无 IPC subclass 数据';
        ipcSvg.appendChild(empty);
        return;
      }

      const left = 54;
      const right = 690;
      const top = 26;
      const bottom = 198;
      const width = right - left;
      const height = bottom - top;
      const yMax = niceTrendMax(Math.max(...years.map(row => Number(row.total || 0))));
      const midTick = yMax <= 2 ? 1 : Math.round(yMax / 2);
      const yTicks = [...new Set([0, midTick, yMax])].sort((a, b) => a - b);
      const barWidth = Math.max(7, Math.min(24, width / Math.max(years.length, 1) * 0.62));
      ipcSummary.textContent = `${years[0].year}-${years[years.length - 1].year} 合计 ${formatCount(totalAll)} 个 subclass 记录`;

      yTicks.forEach(tick => {
        const y = trendY(tick, yMax, top, height);
        ipcSvg.appendChild(createSvg('line', { class: 'trend-grid', x1: left, y1: y, x2: right, y2: y }));
        const label = createSvg('text', { class: 'trend-label', x: left - 10, y, 'text-anchor': 'end', 'dominant-baseline': 'central' });
        label.textContent = formatCount(tick);
        ipcSvg.appendChild(label);
      });

      ipcSvg.appendChild(createSvg('line', { class: 'trend-axis', x1: left, y1: bottom, x2: right, y2: bottom }));
      ipcSvg.appendChild(createSvg('line', { class: 'trend-axis', x1: left, y1: top, x2: left, y2: bottom }));

      years.forEach((row, index) => {
        const x = trendX(index, years.length, left, width);
        let baseY = bottom;
        const segments = Array.isArray(row.segments) ? row.segments : [];
        segments.forEach((segment, segmentIndex) => {
          const count = Math.max(0, Number(segment.count || 0));
          if (!count) return;
          const nextY = trendY(count + (bottom - baseY) / height * yMax, yMax, top, height);
          const rect = createSvg('rect', {
            class: 'ipc-segment',
            x: x - barWidth / 2,
            y: nextY,
            width: barWidth,
            height: Math.max(0, baseY - nextY),
            fill: ipcColors[segmentIndex % ipcColors.length]
          });
          const title = createSvg('title');
          title.textContent = `${row.year} ${segment.code}：${formatCount(count)}`;
          rect.appendChild(title);
          ipcSvg.appendChild(rect);
          baseY = nextY;
        });

        if (years.length <= 12 || index % 2 === 0 || index === years.length - 1) {
          const xLabel = createSvg('text', {
            class: 'trend-label',
            x,
            y: bottom + 22,
            'text-anchor': 'middle',
            'dominant-baseline': 'central'
          });
          xLabel.textContent = String(row.year);
          ipcSvg.appendChild(xLabel);
        }
      });

      ipcLegend.innerHTML = codes.map((code, index) => `
        <span class="legend-item"><span class="legend-swatch" style="background:${ipcColors[index % ipcColors.length]}"></span>${escapeHtml(code)}</span>
      `).join('');
    }

    function formatNumber(value, digits = 3) {
      return Number.isFinite(value) ? value.toFixed(digits) : '';
    }

    function shortText(value, limit = 170) {
      const text = String(value || '').replace(/\s+/g, ' ').trim();
      return text.length > limit ? text.slice(0, limit - 3) + '...' : text;
    }

    function escapeHtml(value) {
      return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    function metricTooltip(metric) {
      return `<div class="tip-title">${escapeHtml(labels[metric])} 前5</div>
        <div class="tip-muted">按 ${escapeHtml(labels[metric])} 排序；已排除 topic_id = -1。</div>`;
    }

    function axisMetricTooltip(metric) {
      const label = labels[metric] || metric;
      const explanation = axisExplanations[metric] || explanations[metric] || '';
      return `<div class="tip-title">${escapeHtml(label)}</div>
        <div>${escapeHtml(explanation)}</div>`;
    }

    function topicTooltip(metric, item) {
      return `<div class="tip-title">${escapeHtml(labels[metric])} | 主题 ${item.topic_id}</div>
        <div>得分：<strong>${formatNumber(item.score)}</strong> | 相对均值：<strong>${formatNumber(item.relative, 2)}</strong> | 排名：<strong>${item.rank ?? ''}</strong></div>
        <div class="tip-muted">主题规模=${item.topic_size ?? '未知'}</div>
        <div style="margin-top:6px;">${escapeHtml(shortText(item.topic_keywords, 210))}</div>`;
    }

    function moveTip(event) {
      if (!hoverTip.classList.contains('show')) return;
      const gap = 16;
      const width = hoverTip.offsetWidth || 320;
      const height = hoverTip.offsetHeight || 120;
      const left = Math.min(event.clientX + gap, window.innerWidth - width - gap);
      const top = Math.min(event.clientY + gap, window.innerHeight - height - gap);
      hoverTip.style.left = `${Math.max(gap, left)}px`;
      hoverTip.style.top = `${Math.max(gap, top)}px`;
    }

    function showTip(event, htmlText) {
      hoverTip.innerHTML = htmlText;
      hoverTip.classList.add('show');
      moveTip(event);
    }

    function hideTip() {
      hoverTip.classList.remove('show');
    }

    function bestMetric(topic) {
      let best = metrics[0];
      let bestValue = -Infinity;
      metrics.forEach(metric => {
        const value = safeRelative(topic, metric);
        if (value > bestValue) {
          bestValue = value;
          best = metric;
        }
      });
      return { metric: best, value: bestValue };
    }

    function listHtml(items) {
      if (!Array.isArray(items) || !items.length) return '<li>暂无数据</li>';
      return items.slice(0, 6).map(item => `<li>${escapeHtml(item)}</li>`).join('');
    }

    function statusText(status) {
      if (!status) return '未生成';
      if (status.startsWith('missing_env:')) return `缺少环境变量 ${status.split(':')[1] || ''}`;
      if (status === 'error') return '生成失败';
      if (status === 'generated') return '已生成';
      if (status === 'not_generated') return '未生成';
      return status;
    }

    function confidenceText(value) {
      const map = { high: '高', medium: '中', low: '低', unknown: '未知' };
      return map[value] || value || '未知';
    }

    function updateInterpretation(topic) {
      const panel = document.getElementById('routePanel');
      const info = interpretations[String(topic.topic_id)];
      if (!info || info.status !== 'generated') {
        const status = info?.status || 'not_generated';
        const error = info?.error ? `<p>${escapeHtml(info.error)}</p>` : '';
        panel.innerHTML = `<h3>技术路线解读 <span class="route-status">${escapeHtml(statusText(status))}</span></h3>
          <p>该主题尚未通过 DeepSeek API 生成解释。设置 DEEPSEEK_API_KEY 后重新运行脚本即可生成。</p>${error}`;
        return;
      }
      panel.innerHTML = `
        <h3>${escapeHtml(info.route_name_cn || '技术路线解读')} <span class="route-status">置信度：${escapeHtml(confidenceText(info.confidence))}</span></h3>
        <p>${escapeHtml(info.meaning || '')}</p>
        <div class="route-grid">
          <div class="route-block">
            <div class="route-label">技术路线</div>
            <ol class="route-list">${listHtml(info.technology_route)}</ol>
          </div>
          <div class="route-block">
            <div class="route-label">关键技术要素</div>
            <ul class="route-list">${listHtml(info.key_components)}</ul>
          </div>
          <div class="route-block">
            <div class="route-label">核聚变产业链关系与应用</div>
            <p><strong>产业链位置：</strong>${escapeHtml(info.fusion_industry_chain_position || '关系尚不明确')}</p>
            <p>${escapeHtml(info.fusion_industry_chain_relation || '代表专利尚未提供足够证据判断具体关系。')}</p>
            <ul class="route-list">${listHtml(info.application_scenarios)}</ul>
          </div>
        </div>
        <p><strong>信号说明：</strong>${escapeHtml(info.signal_notes || '')}</p>`;
    }

    function updateTop1Labels(topic) {
      metrics.forEach((metric, index) => {
        const show = Boolean(topic.top1?.[metric]);
        top1Labels[index].classList.toggle('show', show);
        pointNodes[index].classList.toggle('top1', show);
      });
    }

    function updateDetails(topic) {
      document.getElementById('topicTitle').textContent = `主题 ${topic.topic_id}`;
      document.getElementById('topicSize').textContent = `主题规模=${topic.topic_size ?? '未知'}`;
      document.getElementById('outlierFlag').textContent = topic.is_bertopic_outlier ? 'BERTopic 离群主题' : '聚类主题';
      const best = bestMetric(topic);
      document.getElementById('maxMetric').textContent = `${labels[best.metric]} 相对均值=${formatNumber(best.value, 2)}`;
      document.getElementById('topicKeywords').textContent = shortText(topic.topic_keywords, 260);
      updateInterpretation(topic);
    }

    function setActive(topicId) {
      document.querySelectorAll('.topic-button').forEach(button => {
        button.classList.toggle('active', Number(button.dataset.topicId) === topicId);
      });
    }

    function selectTopic(topicId) {
      const topic = topics.get(Number(topicId));
      if (!topic) return;
      setActive(topic.topic_id);
      updateDetails(topic);
      animateRadar(topic);
      currentTopic = topic;
      document.documentElement.dataset.frontierTopicId = String(topic.topic_id);
      document.dispatchEvent(new CustomEvent('frontier:topic-change', { detail: { topicId: topic.topic_id } }));
    }

    function renderTopLists() {
      const container = document.getElementById('topList');
      container.innerHTML = metrics.map(metric => {
        const explanation = explanations[metric] || '';
        const items = payload.top5[metric].map(item => `
          <button class="topic-button" type="button" data-topic-id="${item.topic_id}" data-metric="${metric}">
            <div class="topic-row">
              <span class="topic-id">主题 ${item.topic_id}</span>
              <span class="score">${formatNumber(item.score)} / 相对 ${formatNumber(item.relative, 2)}</span>
            </div>
            <div class="topic-key">${escapeHtml(shortText(item.topic_keywords, 110))}</div>
          </button>
        `).join('');
        return `<section class="metric-group">
          <div class="metric-title" data-metric="${metric}"><span>${escapeHtml(labels[metric])}</span><span>前5</span></div>
          <div class="metric-explanation"><span class="metric-explanation-label">${escapeHtml(explanation)}</div>
          ${items}
        </section>`;
      }).join('');

      container.querySelectorAll('.topic-button').forEach(button => {
        button.addEventListener('click', () => selectTopic(button.dataset.topicId));
        button.addEventListener('mouseenter', event => {
          const metric = button.dataset.metric;
          const topicId = Number(button.dataset.topicId);
          const item = (payload.top5[metric] || []).find(candidate => candidate.topic_id === topicId);
          if (item) showTip(event, topicTooltip(metric, item));
        });
        button.addEventListener('mousemove', moveTip);
        button.addEventListener('mouseleave', hideTip);
      });
      container.querySelectorAll('.metric-title').forEach(title => {
        title.addEventListener('mouseenter', event => showTip(event, metricTooltip(title.dataset.metric)));
        title.addEventListener('mousemove', moveTip);
        title.addEventListener('mouseleave', hideTip);
      });
    }

    function metricScore(topic, metric) {
      const value = topic?.scores?.[metric];
      return Number.isFinite(value) ? value : -Infinity;
    }

    function sorterCompositeScore(topic) {
      if (!selectedSortMetrics.length) return 0;
      return selectedSortMetrics.reduce((total, metric, index) => {
        const value = metricScore(topic, metric);
        const normalized = Number.isFinite(value) ? value : 0;
        return total + normalized * Math.pow(2, selectedSortMetrics.length - index - 1);
      }, 0);
    }

    function sorterStatusText() {
      if (!selectedSortMetrics.length) return '点击指标开始排序';
      return '排序条件（先点优先）：' + selectedSortMetrics
        .map((metric, index) => `${index + 1}.${labels[metric] || metric}`)
        .join(' → ');
    }

    function sorterBreakdown(topic) {
      if (!selectedSortMetrics.length) return '';
      return selectedSortMetrics
        .map(metric => `${escapeHtml(labels[metric] || metric)}=${formatNumber(metricScore(topic, metric))}`)
        .join(' · ');
    }

    function summarizedTopicName(topic) {
      const name = String(topic?.route_name_cn || '').trim();
      if (name) return name;
      const summary = String(topic?.topic_summary || topic?.topic_keywords || '').trim();
      return summary || `主题 ${topic?.topic_id ?? ''}`;
    }

    function sortedTopicsForSorter() {
      if (!selectedSortMetrics.length) return [];
      return [...topics.values()].sort((left, right) => {
        const compositeDiff = sorterCompositeScore(right) - sorterCompositeScore(left);
        if (Math.abs(compositeDiff) > 1e-12) return compositeDiff;
        for (let index = 0; index < selectedSortMetrics.length; index += 1) {
          const metric = selectedSortMetrics[index];
          const diff = metricScore(right, metric) - metricScore(left, metric);
          if (Math.abs(diff) > 1e-12) return diff;
        }
        return left.topic_id - right.topic_id;
      });
    }

    function sorterTopicTooltip(topic) {
      const lines = selectedSortMetrics.map(metric => `
        <div>${escapeHtml(labels[metric] || metric)}：<strong>${formatNumber(metricScore(topic, metric))}</strong>
          | 相对均值：<strong>${formatNumber(topic.relative?.[metric], 2)}</strong>
          | 排名：<strong>${topic.rank?.[metric] ?? ''}</strong></div>
      `).join('');
      return `<div class="tip-title">排序结果 | 主题 ${topic.topic_id}</div>
        <div>综合排序分：<strong>${formatNumber(sorterCompositeScore(topic))}</strong></div>
        ${lines}
        <div class="tip-muted">主题规模=${topic.topic_size ?? '未知'}</div>
        <div style="margin-top:6px;">${escapeHtml(shortText(topic.topic_keywords, 210))}</div>`;
    }

    function renderSorter() {
      const container = document.getElementById('topList');
      const controls = metrics.map(metric => {
        const orderIndex = selectedSortMetrics.indexOf(metric);
        const activeClass = orderIndex >= 0 ? ' active' : '';
        const orderText = orderIndex >= 0 ? String(orderIndex + 1) : '+';
        const explanation = explanations[metric] || '';
        return `<button class="sorter-button${activeClass}" type="button" data-metric="${metric}">
          <div class="sorter-button-head">
            <span>${escapeHtml(labels[metric] || metric)}</span>
            <span class="sorter-order">${escapeHtml(orderText)}</span>
          </div>
          <div class="sorter-note">${escapeHtml(explanation)}</div>
        </button>`;
      }).join('');

      const resultTopics = sortedTopicsForSorter().slice(0, resultLimit);
      const directionSummary = selectedSortMetrics.length === 1
        ? singleMetricDirectionSummaries[selectedSortMetrics[0]]
        : null;
      const results = selectedSortMetrics.length
        ? resultTopics.map((topic, index) => `
          <button class="topic-button" type="button" data-topic-id="${topic.topic_id}">
            <div class="topic-row">
              <span class="topic-id" title="${escapeHtml(summarizedTopicName(topic))}">${index + 1}. ${escapeHtml(shortText(summarizedTopicName(topic), 28))}</span>
              <span class="score">综合 ${formatNumber(sorterCompositeScore(topic))}</span>
            </div>
            <div class="sorter-breakdown">${sorterBreakdown(topic)}</div>
            <div class="topic-key">${escapeHtml(shortText(topic.topic_keywords, 110))}</div>
          </button>
        `).join('')
        : '<div class="sorter-empty">点击上方指标后显示排序结果；先点击的指标权重更高。</div>';

      container.innerHTML = `<section class="metric-group sorter-panel">
          <div class="sorter-controls">${controls}</div>
          <div class="sorter-status">
            <span>${escapeHtml(sorterStatusText())}</span>
            <button class="sorter-reset" type="button">重置</button>
          </div>
        </section>
        <section class="sorter-results">
          <div class="sorter-results-title"><span>排序结果</span><span>Top ${resultLimit}</span></div>
          ${directionSummary ? `<div class="sorter-direction-summary">
            <div>${escapeHtml(directionSummary.technology)}</div>
            <div>${escapeHtml(directionSummary.industry)}</div>
          </div>` : ''}
          ${results}
        </section>`;

      container.querySelectorAll('.sorter-button').forEach(button => {
        button.addEventListener('click', () => {
          const metric = button.dataset.metric;
          const selectedIndex = selectedSortMetrics.indexOf(metric);
          if (selectedIndex >= 0) {
            selectedSortMetrics.splice(selectedIndex, 1);
          } else {
            selectedSortMetrics.push(metric);
          }
          renderSorter();
          setActive(currentTopic.topic_id);
        });
        button.addEventListener('mouseenter', event => showTip(event, axisMetricTooltip(button.dataset.metric)));
        button.addEventListener('mousemove', moveTip);
        button.addEventListener('mouseleave', hideTip);
      });

      const reset = container.querySelector('.sorter-reset');
      reset.addEventListener('click', () => {
        selectedSortMetrics = [];
        renderSorter();
        setActive(currentTopic.topic_id);
      });

      container.querySelectorAll('.topic-button').forEach(button => {
        button.addEventListener('click', () => selectTopic(button.dataset.topicId));
        button.addEventListener('mouseenter', event => {
          const topic = topics.get(Number(button.dataset.topicId));
          if (topic) showTip(event, sorterTopicTooltip(topic));
        });
        button.addEventListener('mousemove', moveTip);
        button.addEventListener('mouseleave', hideTip);
      });
    }

    drawBase();
    renderSorter();
    updateDetails(currentTopic);
    updateTop1Labels(currentTopic);
    setActive(currentTopic.topic_id);
    document.documentElement.dataset.frontierTopicId = String(currentTopic.topic_id);
  