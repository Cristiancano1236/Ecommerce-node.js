// routes/auth.js
// Propósito: Endpoints de autenticación (registro e inicio de sesión) basados en clientes.
// Relación: Registrado por `backend/server.js` bajo /api/auth. Consumido por `public/js/app.js`.

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getPool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 10;

/**
 * POST /api/auth/register
 * Crea un cliente con contraseña y devuelve token JWT + perfil.
 * Body: { nombre, apellido, correo, telefono?, password }
 */
router.post('/register', async (req, res) => {
  const { nombre, apellido, correo, telefono = null, password } = req.body || {};
  if (!nombre || !apellido || !correo || !password) {
    return res.status(400).json({ message: 'nombre, apellido, correo y password son obligatorios' });
  }
  try {
    const pool = getPool();
    const passwordHash = await bcrypt.hash(String(password), SALT_ROUNDS);

    // Intento de inserción; si correo existe, se rechaza
    const [result] = await pool.query(
      `
      INSERT INTO clientes (nombre, apellido, correo, telefono, password_hash)
      VALUES (?, ?, ?, ?, ?)
      `,
      [nombre, apellido, correo.toLowerCase(), telefono, passwordHash]
    );
    const id = result.insertId;

    const token = signToken({ id, nombre, apellido, correo: correo.toLowerCase(), rol: 'cliente' });
    return res.status(201).json({
      token,
      user: { id, nombre, apellido, correo: correo.toLowerCase() }
    });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'El correo ya está registrado' });
    }
    console.error('POST /api/auth/register error:', err.message);
    return res.status(500).json({ message: 'No fue posible registrar el usuario' });
  }
});

/**
 * POST /api/auth/login
 * Autentica al cliente y devuelve token JWT + perfil.
 * Body: { correo, password }
 */
router.post('/login', async (req, res) => {
  const { correo, password } = req.body || {};
  if (!correo || !password) {
    return res.status(400).json({ message: 'correo y password son obligatorios' });
  }
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `
      SELECT id, nombre, apellido, correo, password_hash, rol
      FROM clientes
      WHERE correo = ?
      LIMIT 1
      `,
      [correo.toLowerCase()]
    );
    if (!rows.length) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    const user = rows[0];
    if (!user.password_hash) {
      return res.status(401).json({ message: 'Cuenta sin contraseña. Regístrese.' });
    }
    const ok = await bcrypt.compare(String(password), String(user.password_hash));
    if (!ok) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const userRol = user.rol || 'cliente';
    const token = signToken({
      id: user.id,
      nombre: user.nombre,
      apellido: user.apellido,
      correo: user.correo,
      rol: userRol
    });
    return res.json({
      token,
      user: { id: user.id, nombre: user.nombre, apellido: user.apellido, correo: user.correo, rol: userRol }
    });
  } catch (err) {
    console.error('POST /api/auth/login error:', err.message);
    return res.status(500).json({ message: 'No fue posible iniciar sesión' });
  }
});

function signToken(payload) {
  const secret = process.env.JWT_SECRET || 'dev-insecure-secret';
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

/**
 * GET /api/auth/me
 * Devuelve el perfil básico del usuario autenticado.
 * Relación: Útil para sincronizar UI; consumible desde `public/js/app.js`.
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, nombre, apellido, correo, telefono, rol FROM clientes WHERE id = ? LIMIT 1`,
      [Number(req.user.id)]
    );
    if (!rows.length) return res.status(404).json({ message: 'Usuario no encontrado' });
    const u = rows[0];
    return res.json({
      id: u.id,
      nombre: u.nombre,
      apellido: u.apellido,
      correo: u.correo,
      telefono: u.telefono,
      rol: u.rol || 'cliente'
    });
  } catch (err) {
    console.error('GET /api/auth/me error:', err.message);
    return res.status(500).json({ message: 'Error al obtener el perfil' });
  }
});

/**
 * PUT /api/auth/profile
 * Actualiza datos básicos del perfil (nombre y/o telefono) del usuario autenticado.
 * Body: { nombre?, telefono? }
 * Devuelve user actualizado y un nuevo token JWT con los datos actuales para mantener consistencia en el cliente.
 */
router.put('/profile', requireAuth, async (req, res) => {
  const { nombre = undefined, telefono = undefined } = req.body || {};
  if (nombre === undefined && telefono === undefined) {
    return res.status(400).json({ message: 'Nada que actualizar' });
  }
  try {
    const pool = getPool();

    // Obtener actual para completar payload del token
    const [rows] = await pool.query(
      `SELECT id, nombre, apellido, correo, telefono, rol FROM clientes WHERE id = ? LIMIT 1`,
      [Number(req.user.id)]
    );
    if (!rows.length) return res.status(404).json({ message: 'Usuario no encontrado' });
    const current = rows[0];

    const newNombre = nombre !== undefined ? String(nombre).trim() : current.nombre;
    const newTelefono =
      telefono !== undefined
        ? (String(telefono).trim() || null)
        : current.telefono;

    if (nombre !== undefined && newNombre.length === 0) {
      return res.status(400).json({ message: 'nombre no puede estar vacío' });
    }

    const [upd] = await pool.query(
      `UPDATE clientes SET nombre = ?, telefono = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?`,
      [newNombre, newTelefono, Number(req.user.id)]
    );
    if (upd.affectedRows === 0) return res.status(404).json({ message: 'Usuario no encontrado' });

    const updated = {
      id: current.id,
      nombre: newNombre,
      apellido: current.apellido,
      correo: current.correo,
      telefono: newTelefono,
      rol: current.rol || 'cliente'
    };
    const token = signToken({
      id: updated.id,
      nombre: updated.nombre,
      apellido: updated.apellido,
      correo: updated.correo,
      rol: updated.rol
    });
    return res.json({ token, user: updated });
  } catch (err) {
    console.error('PUT /api/auth/profile error:', err.message);
    return res.status(500).json({ message: 'No fue posible actualizar el perfil' });
  }
});

/**
 * PUT /api/auth/password
 * Cambia la contraseña del usuario autenticado.
 * Body: { actual, nueva } — valida la contraseña actual y establece la nueva.
 */
router.put('/password', requireAuth, async (req, res) => {
  const { actual, nueva } = req.body || {};
  if (!actual || !nueva) {
    return res.status(400).json({ message: 'actual y nueva son obligatorias' });
  }
  if (String(nueva).length < 6) {
    return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, password_hash FROM clientes WHERE id = ? LIMIT 1`,
      [Number(req.user.id)]
    );
    if (!rows.length) return res.status(404).json({ message: 'Usuario no encontrado' });
    const user = rows[0];

    const ok = await bcrypt.compare(String(actual), String(user.password_hash || ''));
    if (!ok) {
      return res.status(401).json({ message: 'Contraseña actual incorrecta' });
    }

    const passwordHash = await bcrypt.hash(String(nueva), SALT_ROUNDS);
    await pool.query(
      `UPDATE clientes SET password_hash = ?, actualizado_en = CURRENT_TIMESTAMP WHERE id = ?`,
      [passwordHash, Number(req.user.id)]
    );

    return res.json({ message: 'Contraseña actualizada' });
  } catch (err) {
    console.error('PUT /api/auth/password error:', err.message);
    return res.status(500).json({ message: 'No fue posible cambiar la contraseña' });
  }
});

module.exports = router;


