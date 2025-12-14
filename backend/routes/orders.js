// routes/orders.js
// Propósito: Endpoints para crear órdenes a partir del carrito.
// Relación: Usado por `backend/server.js` (ruta /api/ordenes) y consumido por `public/js/app.js` al hacer checkout.

const express = require('express');
const { getPool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/ordenes
 * Crea una orden a partir de ítems: [{ producto_id, cantidad }]
 * Requiere autenticación JWT; usa req.user.id como cliente.
 */
router.post('/', requireAuth, async (req, res) => {
  const { items } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'El carrito está vacío o es inválido' });
  }

  // Normalizamos cantidades e ids
  const normalized = [];
  for (const it of items) {
    const pid = Number(it.producto_id);
    const qty = Number(it.cantidad);
    if (!Number.isInteger(pid) || pid <= 0 || !Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ message: 'Ítem inválido en el carrito' });
    }
    normalized.push({ producto_id: pid, cantidad: qty });
  }

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Obtenemos info de productos afectados
    const ids = normalized.map((n) => n.producto_id);
    const [productos] = await conn.query(
      `
      SELECT
        p.id,
        p.sku,
        p.nombre,
        p.precio,
        p.moneda,
        p.existencias,
        p.activo,
        p.categoria_id,
        -- Calcular precio final con base en descuento producto > categoría
        ROUND(
          p.precio * (1 - (
            CASE
              WHEN p.descuento_activo = 1 AND p.descuento_pct IS NOT NULL AND p.descuento_pct > 0 THEN p.descuento_pct
              WHEN c.descuento_activo = 1 AND c.descuento_pct IS NOT NULL AND c.descuento_pct > 0 THEN c.descuento_pct
              ELSE 0
            END
          ) / 100),
          2
        ) AS precio_final
      FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE p.id IN (${ids.map(() => '?').join(',')})
      FOR UPDATE
      `,
      ids
    );

    // Validaciones: existencia, activo, stock
    const idToProducto = new Map(productos.map((p) => [p.id, p]));
    for (const it of normalized) {
      const p = idToProducto.get(it.producto_id);
      if (!p) {
        throw new Error(`Producto ${it.producto_id} no existe`);
      }
      if (!p.activo) {
        throw new Error(`Producto ${p.id} no está activo`);
      }
      if (p.existencias < it.cantidad) {
        throw new Error(`Stock insuficiente para producto ${p.id}`);
      }
    }

    // Insert orden (total en 0, se actualizará). Cliente desde token.
    const cliente = Number(req.user?.id);
    const moneda = 'COP';
    const [ordenRes] = await conn.query(
      `
      INSERT INTO ordenes (cliente_id, estado, total, moneda)
      VALUES (?, 'pendiente', 0, ?)
      `,
      [cliente, moneda]
    );
    const ordenId = ordenRes.insertId;

    // Insert items y actualizar existencias
    let sumaTotal = 0;
    for (const it of normalized) {
      const p = idToProducto.get(it.producto_id);
      const precio = Number(p.precio_final ?? p.precio);
      const cantidad = it.cantidad;
      const totalRenglon = precio * cantidad;
      sumaTotal += totalRenglon;

      await conn.query(
        `
        INSERT INTO items_orden
          (orden_id, producto_id, sku, nombre_producto, precio_unitario, cantidad)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [ordenId, p.id, p.sku, p.nombre, precio, cantidad]
      );

      await conn.query(
        `
        UPDATE productos
        SET existencias = existencias - ?
        WHERE id = ?
        `,
        [cantidad, p.id]
      );
    }

    // Actualizamos total de la orden
    await conn.query(
      `
      UPDATE ordenes
      SET total = ?
      WHERE id = ?
      `,
      [sumaTotal, ordenId]
    );

    await conn.commit();
    return res.status(201).json({ ordenId, total: sumaTotal, moneda });
  } catch (err) {
    await conn.rollback();
    console.error('POST /api/ordenes error:', err.message);
    return res.status(400).json({ message: 'No fue posible crear la orden', detail: err.message });
  } finally {
    conn.release();
  }
});

/**
 * GET /api/ordenes
 * Lista órdenes con total calculado. Si ?detalles=1, incluye items por orden.
 * Incluye nombre completo y correo del cliente.
 * Uso: interfaz administrativa.
 */
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  const includeItems = String(req.query.detalles || '').toLowerCase();
  const needItems = includeItems === '1' || includeItems === 'true';
  const estadoParam = String(req.query.estado || '').trim();
  const q = String(req.query.q || '').trim().toLowerCase();
  try {
    const pool = getPool();

    // WHERE dinámico por estado y búsqueda libre del cliente (nombre, apellido, correo)
    const conditions = [];
    const params = [];
    if (estadoParam) {
      // Aceptar sinónimos: procesando => pagada,enviada | terminada(s) => entregada
      let estados = estadoParam.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      estados = estados.flatMap((e) => {
        if (e === 'procesando' || e === 'procesadas' || e === 'procesados') return ['pagada', 'enviada'];
        if (e === 'terminada' || e === 'terminadas' || e === 'finalizada' || e === 'finalizadas') return ['entregada'];
        return [e];
      });
      if (estados.length) {
        conditions.push(`o.estado IN (${estados.map(() => '?').join(',')})`);
        params.push(...estados);
      }
    }
    if (q) {
      conditions.push(`LOWER(CONCAT_WS(' ', c.nombre, c.apellido, c.correo)) LIKE ?`);
      params.push(`%${q}%`);
    }
    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [orders] = await pool.query(
      `
      SELECT
        o.id,
        o.cliente_id,
        o.estado,
        o.moneda,
        o.realizada_en,
        o.actualizada_en,
        COALESCE(v.total_calculado, 0) AS total_calculado,
        c.nombre AS cliente_nombre,
        c.apellido AS cliente_apellido,
        c.correo AS cliente_correo
      FROM ordenes o
      JOIN clientes c ON c.id = o.cliente_id
      LEFT JOIN v_ordenes_con_totales v ON v.orden_id = o.id
      ${whereSql}
      ORDER BY o.realizada_en DESC
      `,
      params
    );

    if (!needItems || orders.length === 0) {
      return res.json(orders);
    }

    const ids = orders.map((o) => o.id);
    const placeholders = ids.map(() => '?').join(',');
    const [items] = await pool.query(
      `
      SELECT
        io.orden_id,
        io.producto_id,
        io.sku,
        io.nombre_producto,
        io.precio_unitario,
        io.cantidad,
        io.total_renglon
      FROM items_orden io
      WHERE io.orden_id IN (${placeholders})
      ORDER BY io.orden_id ASC, io.id ASC
      `,
      ids
    );

    const map = new Map();
    for (const o of orders) map.set(o.id, []);
    for (const it of items) {
      map.get(it.orden_id).push({
        producto_id: it.producto_id,
        sku: it.sku,
        nombre_producto: it.nombre_producto,
        precio_unitario: Number(it.precio_unitario),
        cantidad: it.cantidad,
        total_renglon: Number(it.total_renglon)
      });
    }

    const result = orders.map((o) => ({
      ...o,
      total_calculado: Number(o.total_calculado),
      items: map.get(o.id)
    }));
    return res.json(result);
  } catch (err) {
    console.error('GET /api/ordenes error:', err.message);
    return res.status(500).json({ message: 'Error al obtener órdenes' });
  }
});

/**
 * PUT /api/ordenes/:id/estado
 * Cambia el estado de una orden.
 * Body: { estado: 'pendiente'|'pagada'|'enviada'|'entregada'|'cancelada'|'reembolsada' }
 */
router.put('/:id/estado', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const estado = String(req.body?.estado || '').trim();
  const valid = new Set(['pendiente', 'pagada', 'enviada', 'entregada', 'cancelada', 'reembolsada']);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'id inválido' });
  if (!valid.has(estado)) return res.status(400).json({ message: 'estado inválido' });
  try {
    const pool = getPool();
    const [upd] = await pool.query(
      `UPDATE ordenes SET estado = ?, actualizada_en = CURRENT_TIMESTAMP WHERE id = ?`,
      [estado, id]
    );
    if (upd.affectedRows === 0) return res.status(404).json({ message: 'No encontrada' });
    return res.json({ id, estado });
  } catch (err) {
    console.error('PUT /api/ordenes/:id/estado error:', err.message);
    return res.status(500).json({ message: 'No fue posible actualizar el estado' });
  }
});

/**
 * GET /api/ordenes/mias
 * Lista las órdenes del cliente autenticado (req.user.id).
 * Si ?detalles=1, incluye los ítems por orden.
 * Relación: Consumido por `public/js/app.js` para "Mis compras" en el panel de perfil.
 */
router.get('/mias', requireAuth, async (req, res) => {
  const includeItems = String(req.query.detalles || '').toLowerCase();
  const needItems = includeItems === '1' || includeItems === 'true';
  try {
    const pool = getPool();
    const [orders] = await pool.query(
      `
      SELECT
        o.id,
        o.cliente_id,
        o.estado,
        o.moneda,
        o.realizada_en,
        o.actualizada_en,
        COALESCE(v.total_calculado, 0) AS total_calculado
      FROM ordenes o
      LEFT JOIN v_ordenes_con_totales v ON v.orden_id = o.id
      WHERE o.cliente_id = ?
      ORDER BY o.realizada_en DESC
      `,
      [Number(req.user.id)]
    );

    if (!needItems || orders.length === 0) {
      return res.json(orders.map((o) => ({ ...o, total_calculado: Number(o.total_calculado) })));
    }

    const ids = orders.map((o) => o.id);
    const placeholders = ids.map(() => '?').join(',');
    const [items] = await pool.query(
      `
      SELECT
        io.orden_id,
        io.producto_id,
        io.sku,
        io.nombre_producto,
        io.precio_unitario,
        io.cantidad,
        io.total_renglon
      FROM items_orden io
      WHERE io.orden_id IN (${placeholders})
      ORDER BY io.orden_id ASC, io.id ASC
      `,
      ids
    );

    const map = new Map();
    for (const o of orders) map.set(o.id, []);
    for (const it of items) {
      map.get(it.orden_id).push({
        producto_id: it.producto_id,
        sku: it.sku,
        nombre_producto: it.nombre_producto,
        precio_unitario: Number(it.precio_unitario),
        cantidad: it.cantidad,
        total_renglon: Number(it.total_renglon)
      });
    }

    const result = orders.map((o) => ({
      ...o,
      total_calculado: Number(o.total_calculado),
      items: map.get(o.id)
    }));
    return res.json(result);
  } catch (err) {
    console.error('GET /api/ordenes/mias error:', err.message);
    return res.status(500).json({ message: 'Error al obtener tus órdenes' });
  }
});

module.exports = router;


