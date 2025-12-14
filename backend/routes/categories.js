// routes/categories.js
// Propósito: Endpoints CRUD para categorías y gestión de descuentos por categoría.
// Relación: Montado en `backend/server.js` bajo /api/categorias. Consumido por `public/js/admin.js`.

const express = require('express');
const { getPool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/categorias
 * Lista categorías.
 */
router.get('/', async (_req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, nombre, slug, descripcion, activo, descuento_pct, descuento_activo
       FROM categorias
       ORDER BY nombre ASC`
    );
    res.json(rows.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      slug: c.slug,
      descripcion: c.descripcion,
      activo: c.activo,
      descuento_pct: c.descuento_pct === null ? null : Number(c.descuento_pct),
      descuento_activo: c.descuento_activo ? 1 : 0
    })));
  } catch (err) {
    console.error('GET /api/categorias error:', err.message);
    res.status(500).json({ message: 'Error al obtener categorías' });
  }
});

/**
 * POST /api/categorias
 * Crea una categoría.
 * Body: { nombre, slug, descripcion?, activo=1, descuento_pct?, descuento_activo? }
 */
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const {
    nombre,
    slug,
    descripcion = null,
    activo = 1,
    descuento_pct = null,
    descuento_activo = 0
  } = req.body || {};

  if (!nombre || !slug) return res.status(400).json({ message: 'nombre y slug son obligatorios' });
  const activoNum = Number(activo) ? 1 : 0;
  const descPctNum = (descuento_pct === null || descuento_pct === undefined || descuento_pct === '') ? null : Number(descuento_pct);
  const descActivoNum = Number(descuento_activo) ? 1 : 0;
  if (descPctNum !== null && (!Number.isFinite(descPctNum) || descPctNum < 0 || descPctNum > 100)) {
    return res.status(400).json({ message: 'descuento_pct inválido (0-100)' });
  }

  try {
    const pool = getPool();
    const [ins] = await pool.query(
      `INSERT INTO categorias (nombre, slug, descripcion, activo, descuento_pct, descuento_activo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nombre, slug, descripcion, activoNum, descPctNum, descActivoNum]
    );
    res.status(201).json({ id: ins.insertId });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'slug duplicado' });
    }
    console.error('POST /api/categorias error:', err.message);
    res.status(500).json({ message: 'No fue posible crear la categoría' });
  }
});

/**
 * PUT /api/categorias/:id
 * Actualiza una categoría.
 */
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'id inválido' });

  const {
    nombre,
    slug,
    descripcion = null,
    activo = 1,
    descuento_pct = null,
    descuento_activo = 0
  } = req.body || {};

  if (!nombre || !slug) return res.status(400).json({ message: 'nombre y slug son obligatorios' });
  const activoNum = Number(activo) ? 1 : 0;
  const descPctNum = (descuento_pct === null || descuento_pct === undefined || descuento_pct === '') ? null : Number(descuento_pct);
  const descActivoNum = Number(descuento_activo) ? 1 : 0;
  if (descPctNum !== null && (!Number.isFinite(descPctNum) || descPctNum < 0 || descPctNum > 100)) {
    return res.status(400).json({ message: 'descuento_pct inválido (0-100)' });
  }

  try {
    const pool = getPool();
    const [upd] = await pool.query(
      `UPDATE categorias
       SET nombre = ?, slug = ?, descripcion = ?, activo = ?, descuento_pct = ?, descuento_activo = ?
       WHERE id = ?`,
      [nombre, slug, descripcion, activoNum, descPctNum, descActivoNum, id]
    );
    if (upd.affectedRows === 0) return res.status(404).json({ message: 'No encontrada' });
    res.json({ id });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'slug duplicado' });
    }
    console.error('PUT /api/categorias/:id error:', err.message);
    res.status(500).json({ message: 'No fue posible actualizar la categoría' });
  }
});

/**
 * POST /api/categorias/:id/descuento
 * Define el descuento de una categoría (no reescribe productos, se aplica en consulta).
 * Body: { porcentaje: number (0-100) | null, activar: 0|1 }
 */
router.post('/:id/descuento', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'id inválido' });
  const activar = Number(req.body?.activar) ? 1 : 0;
  const porcentajeRaw = req.body?.porcentaje;
  const porcentaje = (porcentajeRaw === null || porcentajeRaw === undefined || porcentajeRaw === '') ? null : Number(porcentajeRaw);
  if (activar && (porcentaje === null || !Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100)) {
    return res.status(400).json({ message: 'porcentaje inválido (0-100)' });
  }
  try {
    const pool = getPool();
    const [upd] = await pool.query(
      `UPDATE categorias
       SET descuento_pct = ${activar ? '?' : 'NULL'},
           descuento_activo = ?,
           actualizado_en = CURRENT_TIMESTAMP
       WHERE id = ?`,
      activar ? [porcentaje, activar, id] : [activar, id]
    );
    if (upd.affectedRows === 0) return res.status(404).json({ message: 'No encontrada' });
    res.json({ id });
  } catch (err) {
    console.error('POST /api/categorias/:id/descuento error:', err.message);
    res.status(500).json({ message: 'No fue posible actualizar el descuento de la categoría' });
  }
});

/**
 * POST /api/categorias/descuento-masivo
 * Aplica (o desactiva) un mismo descuento a todas las categorías.
 * Body: { porcentaje: number (0-100), activar: 0|1 }
 */
router.post('/descuento-masivo', requireAuth, requireAdmin, async (req, res) => {
  const activar = Number(req.body?.activar) ? 1 : 0;
  const porcentaje = Number(req.body?.porcentaje);
  if (activar && (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100)) {
    return res.status(400).json({ message: 'porcentaje inválido (0-100)' });
  }
  try {
    const pool = getPool();
    const [upd] = await pool.query(
      `UPDATE categorias
       SET descuento_pct = ${activar ? '?' : 'NULL'},
           descuento_activo = ?,
           actualizado_en = CURRENT_TIMESTAMP`,
      activar ? [porcentaje, activar] : [activar]
    );
    res.json({ updated: upd.affectedRows });
  } catch (err) {
    console.error('POST /api/categorias/descuento-masivo error:', err.message);
    res.status(500).json({ message: 'No fue posible aplicar el descuento masivo a categorías' });
  }
});

module.exports = router;


