// routes/products.js
// Propósito: Endpoints relacionados con productos (listado con imagen principal).
// Relación: Usado por `backend/server.js` (ruta /api/productos) y consumido por `public/js/app.js`.

const express = require('express');
const { getPool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/productos
 * Devuelve productos con su imagen principal (o primera imagen) si existe.
 * Si ?all=1 devuelve todos (activos e inactivos). Por defecto solo activos.
 */
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const all = String(req.query.all || '').toLowerCase();
    const includeAll = all === '1' || all === 'true';
    const categoriaIdRaw = req.query.categoria_id;
    const categoriaId = categoriaIdRaw ? Number(categoriaIdRaw) : null;

    const where = [];
    const params = [];
    if (!includeAll) where.push('p.activo = 1');
    if (categoriaId && Number.isInteger(categoriaId) && categoriaId > 0) {
      where.push('p.categoria_id = ?');
      params.push(categoriaId);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `
      SELECT
        p.id,
        p.sku,
        p.nombre,
        p.descripcion,
        p.precio,
        p.moneda,
        p.existencias,
        p.activo,
        p.categoria_id,
        p.descuento_pct AS producto_descuento_pct,
        p.descuento_activo AS producto_descuento_activo,
        c.descuento_pct AS categoria_descuento_pct,
        c.descuento_activo AS categoria_descuento_activo,
        CASE
          WHEN p.descuento_activo = 1 AND p.descuento_pct IS NOT NULL AND p.descuento_pct > 0
            THEN p.descuento_pct
          WHEN c.descuento_activo = 1 AND c.descuento_pct IS NOT NULL AND c.descuento_pct > 0
            THEN c.descuento_pct
          ELSE 0
        END AS descuento_aplicado_pct,
        ROUND(
          p.precio * (1 - (
            CASE
              WHEN p.descuento_activo = 1 AND p.descuento_pct IS NOT NULL AND p.descuento_pct > 0 THEN p.descuento_pct
              WHEN c.descuento_activo = 1 AND c.descuento_pct IS NOT NULL AND c.descuento_pct > 0 THEN c.descuento_pct
              ELSE 0
            END
          ) / 100),
          2
        ) AS precio_final,
        COALESCE(ip_principal.url, ip_any.url) AS imagen_url
      FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      LEFT JOIN imagenes_productos ip_principal
        ON ip_principal.producto_id = p.id AND ip_principal.es_principal = 1
      LEFT JOIN (
        SELECT producto_id, MIN(id) AS id
        FROM imagenes_productos
        GROUP BY producto_id
      ) first_img
        ON first_img.producto_id = p.id
      LEFT JOIN imagenes_productos ip_any
        ON ip_any.id = first_img.id
      ${whereSql}
      ORDER BY p.nombre ASC
      `,
      params
    );

    res.json(rows.map((p) => ({
      id: p.id,
      sku: p.sku,
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: Number(p.precio),
      precio_final: Number(p.precio_final ?? p.precio),
      moneda: p.moneda,
      existencias: p.existencias,
      activo: p.activo,
      categoria_id: p.categoria_id || null,
      producto_descuento_pct: p.producto_descuento_pct === null ? null : Number(p.producto_descuento_pct),
      producto_descuento_activo: p.producto_descuento_activo ? 1 : 0,
      descuento_aplicado_pct: Number(p.descuento_aplicado_pct || 0),
      imagen_url: p.imagen_url || null
    })));
  } catch (err) {
    // No exponemos detalles internos; log mínimo al servidor
    console.error('GET /api/productos error:', err.message);
    res.status(500).json({ message: 'Error al obtener productos' });
  }
});

/**
 * GET /api/productos/:id
 * Obtiene un producto por id (incluye imagen principal si existe).
 */
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'id inválido' });
  }
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `
      SELECT
        p.id,
        p.sku,
        p.nombre,
        p.descripcion,
        p.precio,
        p.moneda,
        p.existencias,
        p.activo,
        p.categoria_id,
        p.descuento_pct AS producto_descuento_pct,
        p.descuento_activo AS producto_descuento_activo,
        c.descuento_pct AS categoria_descuento_pct,
        c.descuento_activo AS categoria_descuento_activo,
        CASE
          WHEN p.descuento_activo = 1 AND p.descuento_pct IS NOT NULL AND p.descuento_pct > 0
            THEN p.descuento_pct
          WHEN c.descuento_activo = 1 AND c.descuento_pct IS NOT NULL AND c.descuento_pct > 0
            THEN c.descuento_pct
          ELSE 0
        END AS descuento_aplicado_pct,
        ROUND(
          p.precio * (1 - (
            CASE
              WHEN p.descuento_activo = 1 AND p.descuento_pct IS NOT NULL AND p.descuento_pct > 0 THEN p.descuento_pct
              WHEN c.descuento_activo = 1 AND c.descuento_pct IS NOT NULL AND c.descuento_pct > 0 THEN c.descuento_pct
              ELSE 0
            END
          ) / 100),
          2
        ) AS precio_final,
        COALESCE(ip_principal.url, ip_any.url) AS imagen_url
      FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      LEFT JOIN imagenes_productos ip_principal
        ON ip_principal.producto_id = p.id AND ip_principal.es_principal = 1
      LEFT JOIN (
        SELECT producto_id, MIN(id) AS id
        FROM imagenes_productos
        GROUP BY producto_id
      ) first_img
        ON first_img.producto_id = p.id
      LEFT JOIN imagenes_productos ip_any
        ON ip_any.id = first_img.id
      WHERE p.id = ?
      `,
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: 'No encontrado' });
    const p = rows[0];
    return res.json({
      id: p.id,
      sku: p.sku,
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: Number(p.precio),
      precio_final: Number(p.precio_final ?? p.precio),
      moneda: p.moneda,
      existencias: p.existencias,
      activo: p.activo,
      categoria_id: p.categoria_id || null,
      producto_descuento_pct: p.producto_descuento_pct === null ? null : Number(p.producto_descuento_pct),
      producto_descuento_activo: p.producto_descuento_activo ? 1 : 0,
      descuento_aplicado_pct: Number(p.descuento_aplicado_pct || 0),
      imagen_url: p.imagen_url || null
    });
  } catch (err) {
    console.error('GET /api/productos/:id error:', err.message);
    return res.status(500).json({ message: 'Error al obtener el producto' });
  }
});

/**
 * POST /api/productos
 * Crea un producto. Opcionalmente registra una imagen por URL como principal.
 * Body esperado:
 * {
 *   sku, nombre, descripcion?, precio, moneda?='COP', existencias=0, activo=1, imagen_url?,
 *   categoria_id?, descuento_pct?, descuento_activo?
 * }
 */
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const {
    sku,
    nombre,
    descripcion = null,
    precio,
    moneda = 'COP',
    existencias = 0,
    activo = 1,
    imagen_url = null,
    categoria_id = null,
    descuento_pct = null,
    descuento_activo = 0
  } = req.body || {};

  if (!sku || !nombre || precio === undefined) {
    return res.status(400).json({ message: 'sku, nombre y precio son obligatorios' });
  }
  const precioNum = Number(precio);
  const existNum = Number(existencias);
  const activoNum = Number(activo) ? 1 : 0;
  const categoriaIdNum = categoria_id ? Number(categoria_id) : null;
  const descPctNum = (descuento_pct === null || descuento_pct === undefined || descuento_pct === '') ? null : Number(descuento_pct);
  const descActivoNum = Number(descuento_activo) ? 1 : 0;
  if (!Number.isFinite(precioNum) || precioNum < 0) {
    return res.status(400).json({ message: 'precio inválido' });
  }
  if (!Number.isInteger(existNum) || existNum < 0) {
    return res.status(400).json({ message: 'existencias inválidas' });
  }
  if (descPctNum !== null && (!Number.isFinite(descPctNum) || descPctNum < 0 || descPctNum > 100)) {
    return res.status(400).json({ message: 'descuento_pct inválido (0-100)' });
  }

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [ins] = await conn.query(
      `
      INSERT INTO productos (sku, nombre, descripcion, precio, moneda, existencias, activo, categoria_id, descuento_pct, descuento_activo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [sku, nombre, descripcion, precioNum, moneda, existNum, activoNum, categoriaIdNum, descPctNum, descActivoNum]
    );
    const productId = ins.insertId;

    if (imagen_url) {
      await conn.query(
        `
        INSERT INTO imagenes_productos (
          producto_id, nombre_archivo, tipo_mime, tamano_bytes, datos, url,
          hash_sha256, ancho, alto, orden_visual, es_principal
        ) VALUES (?, ?, NULL, NULL, NULL, ?, NULL, NULL, NULL, 0, 1)
        `,
        [productId, `${sku}.url`, imagen_url]
      );
    }

    await conn.commit();
    return res.status(201).json({ id: productId });
  } catch (err) {
    await conn.rollback();
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'SKU duplicado' });
    }
    console.error('POST /api/productos error:', err.message);
    return res.status(500).json({ message: 'No fue posible crear el producto' });
  } finally {
    conn.release();
  }
});

/**
 * PUT /api/productos/:id
 * Actualiza un producto existente. Requiere campos principales.
 * Si viene imagen_url, se establece/actualiza como principal.
 */
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'id inválido' });
  }

  const {
    sku,
    nombre,
    descripcion = null,
    precio,
    moneda = 'COP',
    existencias,
    activo,
    imagen_url = undefined,
    categoria_id = null,
    descuento_pct = null,
    descuento_activo = 0
  } = req.body || {};

  if (!sku || !nombre || precio === undefined || existencias === undefined || activo === undefined) {
    return res.status(400).json({ message: 'sku, nombre, precio, existencias y activo son obligatorios' });
  }
  const precioNum = Number(precio);
  const existNum = Number(existencias);
  const activoNum = Number(activo) ? 1 : 0;
  const categoriaIdNum = categoria_id ? Number(categoria_id) : null;
  const descPctNum = (descuento_pct === null || descuento_pct === undefined || descuento_pct === '') ? null : Number(descuento_pct);
  const descActivoNum = Number(descuento_activo) ? 1 : 0;
  if (!Number.isFinite(precioNum) || precioNum < 0) {
    return res.status(400).json({ message: 'precio inválido' });
  }
  if (!Number.isInteger(existNum) || existNum < 0) {
    return res.status(400).json({ message: 'existencias inválidas' });
  }
  if (descPctNum !== null && (!Number.isFinite(descPctNum) || descPctNum < 0 || descPctNum > 100)) {
    return res.status(400).json({ message: 'descuento_pct inválido (0-100)' });
  }

  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [upd] = await conn.query(
      `
      UPDATE productos
      SET sku = ?, nombre = ?, descripcion = ?, precio = ?, moneda = ?, existencias = ?, activo = ?, categoria_id = ?, descuento_pct = ?, descuento_activo = ?
      WHERE id = ?
      `,
      [sku, nombre, descripcion, precioNum, moneda, existNum, activoNum, categoriaIdNum, descPctNum, descActivoNum, id]
    );
    if (upd.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    if (imagen_url !== undefined) {
      // Si se entregó imagen_url (aunque sea cadena vacía), intentamos actualizar/insertar
      const [resUpd] = await conn.query(
        `
        UPDATE imagenes_productos
        SET url = ?, actualizado_en = CURRENT_TIMESTAMP
        WHERE producto_id = ? AND es_principal = 1
        `,
        [imagen_url || null, id]
      );
      if (resUpd.affectedRows === 0) {
        await conn.query(
          `
          INSERT INTO imagenes_productos (
            producto_id, nombre_archivo, tipo_mime, tamano_bytes, datos, url,
            hash_sha256, ancho, alto, orden_visual, es_principal
          ) VALUES (?, ?, NULL, NULL, NULL, ?, NULL, NULL, NULL, 0, 1)
          `,
          [id, `${sku}.url`, imagen_url || null]
        );
      }
    }

    await conn.commit();
    return res.json({ id });
  } catch (err) {
    await conn.rollback();
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'SKU duplicado' });
    }
    console.error('PUT /api/productos/:id error:', err.message);
    return res.status(500).json({ message: 'No fue posible actualizar el producto' });
  } finally {
    conn.release();
  }
});

/**
 * DELETE /api/productos/:id
 * Borrado lógico: marca activo=0.
 */
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'id inválido' });
  }
  try {
    const pool = getPool();
    const [upd] = await pool.query(
      `UPDATE productos SET activo = 0 WHERE id = ?`,
      [id]
    );
    if (upd.affectedRows === 0) return res.status(404).json({ message: 'No encontrado' });
    return res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/productos/:id error:', err.message);
    return res.status(500).json({ message: 'No fue posible eliminar el producto' });
  }
});

/**
 * POST /api/productos/descuento-masivo
 * Aplica (o desactiva) un descuento porcentual a todos los productos.
 * Body: { porcentaje: number (0-100), activar: 0|1 }
 */
router.post('/descuento-masivo', async (req, res) => {
  const porcentaje = Number(req.body?.porcentaje);
  const activar = Number(req.body?.activar) ? 1 : 0;
  if (activar && (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100)) {
    return res.status(400).json({ message: 'porcentaje inválido (0-100)' });
  }
  try {
    const pool = getPool();
    const [upd] = await pool.query(
      `UPDATE productos
       SET descuento_pct = ${activar ? '?' : 'NULL'},
           descuento_activo = ?,
           actualizado_en = CURRENT_TIMESTAMP`,
      activar ? [porcentaje, activar] : [activar]
    );
    return res.json({ updated: upd.affectedRows });
  } catch (err) {
    console.error('POST /api/productos/descuento-masivo error:', err.message);
    return res.status(500).json({ message: 'No fue posible aplicar el descuento masivo' });
  }
});

module.exports = router;


