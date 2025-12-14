#!/usr/bin/env node
// server.js
// Propósito: Servidor Express que expone APIs REST y sirve estáticos de `public/`.
// Relación: Rutea a `routes/products.js` y `routes/orders.js` y da servicio a `public/index.html`.

const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const { getPool } = require('./db');

// Detectar si se ejecuta desde un ejecutable pkg (cuando process.pkg existe)
// Si es ejecutable, __dirname apunta a donde está el ejecutable
// Si es desarrollo, __dirname apunta a backend/
const isPkg = typeof process.pkg !== 'undefined';
const projectRoot = isPkg ? path.dirname(process.execPath) : path.join(__dirname, '..');

// Cargar variables desde .env en la raíz del proyecto
dotenv.config({ path: path.join(projectRoot, '.env') });

const app = express();

// Middlewares básicos
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Rutas API
const productsRouter = require('./routes/products');
const ordersRouter = require('./routes/orders');
const authRouter = require('./routes/auth');
const categoriesRouter = require('./routes/categories');
const adminRouter = require('./routes/admin');
app.use('/api/productos', productsRouter);
app.use('/api/ordenes', ordersRouter);
app.use('/api/auth', authRouter);
app.use('/api/categorias', categoriesRouter);
app.use('/api/admin', adminRouter);

// Bootstrap: asegurar usuario admin por defecto con contraseña admin123
(async function ensureAdminUser() {
  try {
    const pool = getPool();
    const correo = 'admin@modanova.local';
    const [rows] = await pool.query(
      `SELECT id, password_hash, rol FROM clientes WHERE correo = ? LIMIT 1`,
      [correo]
    );
    const needHash =
      !rows.length || !rows[0].password_hash || rows[0].rol !== 'admin';
    if (needHash) {
      const hash = await bcrypt.hash('admin123', 10);
      if (rows.length) {
        await pool.query(
          `UPDATE clientes SET password_hash = ?, rol = 'admin', actualizado_en = CURRENT_TIMESTAMP WHERE id = ?`,
          [hash, rows[0].id]
        );
      } else {
        await pool.query(
          `INSERT INTO clientes (nombre, apellido, correo, telefono, password_hash, rol)
           VALUES ('Admin','Principal', ?, NULL, ?, 'admin')`,
          [correo, hash]
        );
      }
      console.log('Usuario admin inicial listo: admin@modanova.local / admin123');
    }
  } catch (err) {
    console.warn('No se pudo asegurar el usuario admin inicial:', err.message);
  }
})();

// Servir archivos estáticos (frontend)
// En ejecutable pkg: primero buscar en el directorio del ejecutable, luego usar __dirname (assets empaquetados)
// En desarrollo: usar la ruta relativa normal
const publicDirDev = path.join(__dirname, '..', 'public');
const publicDirPkg = path.join(projectRoot, 'public');

if (isPkg) {
  // Si es ejecutable, buscar primero en el directorio del ejecutable (para permitir actualizaciones)
  // Luego usar __dirname como fallback (assets empaquetados)
  const fs = require('fs');
  const publicDir = fs.existsSync(publicDirPkg) ? publicDirPkg : publicDirDev;
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => {
    const indexPath = fs.existsSync(path.join(publicDirPkg, 'index.html')) 
      ? path.join(publicDirPkg, 'index.html')
      : path.join(publicDirDev, 'index.html');
    res.sendFile(indexPath);
  });
} else {
  // Desarrollo normal
  app.use(express.static(publicDirDev));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicDirDev, 'index.html'));
  });
}

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});


