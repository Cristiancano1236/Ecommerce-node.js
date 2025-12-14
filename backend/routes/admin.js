// routes/admin.js
// Propósito: Endpoints protegidos para gestión administrativa (usuarios).
// Relación: Montado en `backend/server.js` bajo /api/admin. Consumido por `public/js/admin.js` (tab Usuarios).

const express = require('express');
const bcrypt = require('bcrypt');
const { getPool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function requireAdminRole(req, res, next) {
  if (!req.user || req.user.rol !== 'admin') {
    return res.status(403).json({ message: 'Requiere rol admin' });
  }
  return next();
}

// GET /api/admin/users - lista básica de usuarios
router.get('/users', requireAuth, requireAdminRole, async (_req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, nombre, apellido, correo, rol, creado_en, actualizado_en FROM clientes ORDER BY creado_en DESC LIMIT 200`
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/admin/users error:', err.message);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});

// POST /api/admin/users - crear usuario (cliente o admin)
// Body: { nombre, apellido, correo, password, rol?='cliente' }
router.post('/users', requireAuth, requireAdminRole, async (req, res) => {
  const { nombre, apellido, correo, password, rol = 'cliente' } = req.body || {};
  if (!nombre || !apellido || !correo || !password) {
    return res.status(400).json({ message: 'nombre, apellido, correo y password son obligatorios' });
  }
  if (!['cliente', 'admin'].includes(String(rol))) {
    return res.status(400).json({ message: 'rol inválido' });
  }
  try {
    const pool = getPool();
    const hash = await bcrypt.hash(String(password), 10);
    const [ins] = await pool.query(
      `INSERT INTO clientes (nombre, apellido, correo, password_hash, rol)
       VALUES (?, ?, ?, ?, ?)`,
      [nombre, apellido, correo.toLowerCase(), hash, rol]
    );
    res.status(201).json({ id: ins.insertId });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'El correo ya existe' });
    }
    console.error('POST /api/admin/users error:', err.message);
    res.status(500).json({ message: 'No fue posible crear el usuario' });
  }
});

module.exports = router;


