/* Compact candidate list; ownership statistics remain unchanged. */
(() => {
  'use strict';
  const data = window.SHAREHOLDER_LEADS;
  if (!data || document.documentElement.dataset.module === 'china') return;
  const clean = value => String(value || '').replace(/[（(]\d+[)）]\s*$/, '').normalize('NFKC').replace(/[\s\p{P}\p{S}_]/gu, '').toLowerCase();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const named = value => window.FUSION_ENTERPRISE_NAME?.display(value) ?? String(value || '');
  const index = new Map();
  for (const c of data.companies) for (const m of c.mappings) {
    const key = clean(m.name);
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(c);
  }
  for (const c of data.companies) if (!index.has(clean(c.name))) index.set(clean(c.name), [c]);
  const lookup = name => index.get(clean(name)) || [];
  const count = name => new Set(lookup(name).flatMap(c => c.patents.map(p => p.family))).size;
  function mount(host, name, closable = false) {
    if (!host) return;
    const records = lookup(name);
    host.replaceChildren();
    host.hidden = !records.length;
    if (!records.length) return;
    host.classList.add('shareholder-panel');
    host.tabIndex = -1;
    host.setAttribute('aria-label', named(name) + '股东可能关联专利');
    const families = new Map();
    for (const c of records) for (const p of c.patents) if (!families.has(p.family)) families.set(p.family, p);
    const patents = [...families.values()].sort((a,b) => b.date.localeCompare(a.date));
    host.innerHTML = '<div class="shareholder-head"><div><h3>股东可能关联专利 <span class="shareholder-status">待核验</span></h3><p>' + esc(named(name)) + ' · ' + patents.length + ' 个专利族</p></div>' + (closable ? '<button type="button" data-close>收起</button>' : '') + '</div><div data-list class="shareholder-list"></div><nav class="shareholder-pagination" aria-label="可能关联专利分页"' + (patents.length <= 10 ? ' hidden' : '') + '><button type="button" data-prev>上一页</button><span data-page role="status"></span><button type="button" data-next>下一页</button></nav>';
    const query = s => host.querySelector(s);
    let page = 1;
    const pageSize = 10;
    function render() {
      const pages = Math.max(1, Math.ceil(patents.length / pageSize));
      query('[data-list]').innerHTML = patents.length ? patents.slice((page-1)*pageSize,page*pageSize).map(p => '<article class="shareholder-patent"><h4>' + esc(p.title || '未提供专利标题') + '</h4><p><span>' + esc(p.id || '公开号未提供') + '</span><span>最早优先权日 ' + esc(p.date || '未提供') + '</span></p></article>').join('') : '<p class="shareholder-empty">暂无可能关联的专利</p>';
      query('[data-page]').textContent = page + ' / ' + pages;
      query('[data-prev]').disabled = page===1;
      query('[data-next]').disabled = page===pages;
    }
    for (const [key,delta] of [['prev',-1],['next',1]]) query('[data-'+key+']').addEventListener('click',()=>{page+=delta;render();});
    query('[data-close]')?.addEventListener('click',()=>{host.hidden=true;document.querySelector('[data-shareholder-return="active"]')?.focus();});
    render();
  }
  window.ShareholderLeads = {has:name=>lookup(name).length>0,count,mount};
})();
