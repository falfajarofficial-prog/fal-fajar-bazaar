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
