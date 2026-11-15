import { requireAdmin } from '../lib/auth.js';

export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { results } = await env.DB.prepare(
    `SELECT oi.seller_id, s.name AS seller_name,
            SUM(oi.price_afn * oi.qty) AS sales_afn,
            SUM(oi.commission_afn) AS commission_afn,
            SUM(oi.price_afn * oi.qty) - SUM(oi.commission_afn) AS payable_to_seller_afn,
            COUNT(DISTINCT oi.order_id) AS orders
     FROM order_items oi
     LEFT JOIN sellers s ON s.id = oi.seller_id
     GROUP BY oi.seller_id
     ORDER BY sales_afn DESC`
  ).all();

  const totals = results.reduce((t, r) => ({
    sales_afn: t.sales_afn + (r.sales_afn || 0),
    commission_afn: t.commission_afn + (r.commission_afn || 0),
    payable_to_seller_afn: t.payable_to_seller_afn + (r.payable_to_seller_afn || 0)
  }), { sales_afn: 0, commission_afn: 0, payable_to_seller_afn: 0 });

  return Response.json({ sellers: results, totals });
}
