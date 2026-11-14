const fail = (msg, status = 400) => Response.json({ error: msg }, { status });

export async function onRequestPost({ request, env }) {
  const b = await request.json().catch(() => null);
  if (!b) return fail('Invalid request');

  const name = String(b.full_name || '').trim().slice(0, 100);
  const phone = String(b.phone || '').trim().slice(0, 30);
  const email = String(b.email || '').trim().slice(0, 100);
  const city = String(b.city || '').trim().slice(0, 60);
  const business = String(b.business_type || '').trim().slice(0, 60);
  const message = String(b.message || '').trim().slice(0, 1000);

  if (!name || !phone || !city) return fail('Name, phone and city are required');
  if (!/^[+0-9 ]{7,20}$/.test(phone)) return fail('Please enter a valid phone number');

  const id = 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await env.DB.prepare(
    "INSERT INTO seller_applications (id, full_name, phone, email, city, business_type, message, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')"
  ).bind(id, name, phone, email, city, business, message).run();

  return Response.json({ ok: true, id }, { status: 201 });
}
