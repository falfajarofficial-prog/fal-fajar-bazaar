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
      prods.forEach(p => {
        const a = JSON.parse(p.attributes || '{}');
        PRODS.push({
          id: p.id, t: p.title, cat: p.category_id, img: imgId(p.image_url),
          p: p.price_afn, r: a.rating || 0, rc: a.reviews || 0,
          s: p.seller_name, c: p.seller_city, type: 'Registered Shop',
          st: true, act: true, d: 20260901
        });
        try {
          const demo = DEMO_SELLERS.find(d => d.name === p.seller_name);
          if (demo && A.ss) A.ss[demo.key] = 'approved';
        } catch (e) { /* سیلر کی حالت نہ بدلے تو بھی باقی صفحہ چلے */ }
      });
    }
    route();
    renderSide();
  } catch (e) {
    console.warn('API load failed; showing built-in demo data.', e);
  }
})();
