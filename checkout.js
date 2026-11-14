window.ckPlace = async function () {
  if (!SNAP || !CART.length) return;
  const val = id => ((document.getElementById(id) || {}).value || '').trim();
  const prov = document.getElementById('ck_prov');
  const provName = prov && prov.selectedOptions && prov.selectedOptions[0] ? prov.selectedOptions[0].text : '';
  const address = [val('ck_street'), val('ck_dist'), val('ck_city')].filter(Boolean).join(', ');
  const body = {
    items: CART.map(x => ({ id: x.id, qty: x.q })),
    name: val('ck_name'),
    phone: val('ck_phone'),
    city: provName,
    address: address
  };
  try {
    const r = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const d = await r.json();
    if (!r.ok) {
      alert(d.error || 'Order failed');
      return;
    }
    SNAP.ref = d.order_id;
    CART = [];
    p5Save();
    p5Count();
    CKMODE = 'form';
    location.hash = '#/order';
  } catch (e) {
    alert('Error: ' + e.message);
  }
};
(() => {
  const map = [
    [/Demo order created/g, 'Order placed'],
    [/This is a demo\.[^]*?made\./g, 'Thank you. Your order has been received. Keep your order number to track it.'],
    [/Demo reference/g, 'Order number'],
    [/Place demo order/g, 'Place order'],
    [/Payment method \(demo only\)/g, 'Payment method'],
    [/Delivery fee \(estimated, sample\)/g, 'Delivery fee']
  ];

  const fix = root => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(n => {
      const v0 = n.nodeValue;
      if (!v0 || !/demo|This is a/i.test(v0)) return;
      let v = v0;
      map.forEach(([re, to]) => { v = v.replace(re, to); });
      if (v !== v0) n.nodeValue = v;
    });
  };
  
  fix(document.body);
  new MutationObserver(ms => ms.forEach(m =>
    m.addedNodes.forEach(n => { if (n.nodeType === 1) fix(n); })
  )).observe(document.body, { childList: true, subtree: true });
})();
(() => {
  const fixFee = root => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(n => {
      if (n.nodeValue && n.nodeValue.indexOf('Delivery fee (estimated, sample)') !== -1) {
        n.nodeValue = n.nodeValue.replace('Delivery fee (estimated, sample)', 'Delivery fee');
      }
    });
  };
  fixFee(document.body);
  new MutationObserver(ms => ms.forEach(m =>
    m.addedNodes.forEach(n => { if (n.nodeType === 1) fixFee(n); })
  )).observe(document.body, { childList: true, subtree: true });
})();
(() => {
  const css = document.createElement('style');
  css.textContent = '#lang,#lang-m,#st-lang{display:none!important}';
  document.head.appendChild(css);

  const forceEnglish = () => {
    try {
      if (typeof setLang === 'function') setLang('en');
      localStorage.setItem('ffb_lang', 'en');
    } catch (e) {}
  };
  forceEnglish();
})();
(() => {
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a');
    if (a && a.textContent.trim() === 'Become a Seller') {
      e.preventDefault();
      e.stopImmediatePropagation();
      location.href = '/become-seller.html';
    }
  }, true);
})();
