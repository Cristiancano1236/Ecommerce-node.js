// db.js
// Propósito: Crear y exportar un pool de conexiones MySQL (mysql2/promise).
// Relación: Usado por `backend/routes/products.js` y `backend/routes/orders.js` para consultar la BD definida en `ecommerce_mysql_es.sql`.

const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Detectar si se ejecuta desde un ejecutable pkg
const isPkg = typeof process.pkg !== 'undefined';
const projectRoot = isPkg ? path.dirname(process.execPath) : path.join(__dirname, '..');

// Cargar variables desde .env en la raíz del proyecto
dotenv.config({ path: path.join(projectRoot, '.env') });

let pool;

/**
 * Obtiene (o crea) un pool de conexiones MySQL reutilizable.
 */
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'ecommerce',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4_general_ci'
    });
  }
  return pool;
}

module.exports = {
  getPool
};


