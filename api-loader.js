(() => {
  const root = document.documentElement;
  root.style.visibility = 'hidden';
  const show = () => { root.style.visibility = ''; };
  setTimeout(show, 4000);

  (async () => {
    try {
      const [cr, pr] = await Promise.all([fetch('/api/categories'), fetch('/api/products')]);
      if (!cr.ok || !pr.ok) throw new Error('API error');
      const cats = await cr.json();
      const prods = await pr.json();
      const imgId = u => String(u || '').replace(/^https:\/\/images\.unsplash\.com\/photo-/, '').split('?')[0];

      if (cats.length) {
        CATS.length = 0;
        cats.forEach(c => CATS.push({ id: c.id, n: c.name_en, img: imgId(c.image_url) }));
      }
      if (prods.length) {
        PRODS.length = 0;
        A.ps = {};
        prods.forEach(p => {
          const a = JSON.parse(p.attributes || '{}');
          PRODS.push({
            id: p.id, t: p.title, cat: p.category_id, img: imgId(p.image_url),
            p: p.price_afn, r: a.rating || 0, rc: a.reviews || 0,
            s: p.seller_name, c: p.seller_city, type: 'Registered Shop',
            st: p.stock > 0, act: true, own: 'api', d: 20260901
          });
          A.ps[p.id] = p.status;
        });
      }
      route();
      renderSide();
    } catch (e) {
      console.warn('API load failed; showing built-in demo data.', e);
    } finally {
      show();
    }
  })();
})();

(() => {
  const st = document.createElement('style');
  st.textContent = '.sample{display:none!important}';
  document.head.appendChild(st);

  const hideSampleTags = root => {
    if (!root.querySelectorAll) return;
    root.querySelectorAll('.tag').forEach(el => {
      if (/sample/i.test(el.textContent)) el.style.display = 'none';
    });
  };

  const cleanText = root => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(n => {
      if (!n.nodeValue || !/sample/i.test(n.nodeValue)) return;
      n.nodeValue = n.nodeValue
        .replace(/\s*·?\s*sample count/gi, '')
        .replace(/\s*·?\s*sample data/gi, '')
        .replace(/\s*\(sample\)/gi, '');
    });
  };

  const run = root => { hideSampleTags(root); cleanText(root); };
  run(document.body);
  new MutationObserver(ms => ms.forEach(m =>
    m.addedNodes.forEach(n => { if (n.nodeType === 1) run(n); })
  )).observe(document.body, { childList: true, subtree: true });
})();
