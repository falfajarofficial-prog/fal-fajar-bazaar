import { requireAdmin } from '../lib/auth.js';

export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { results } = await env.DB.prepare(
    "SELECT id, full_name, phone, email, city, business_type, message, status, created_at FROM seller_applications ORDER BY created_at DESC LIMIT 100"
  ).all();
  return Response.json(results);
}
