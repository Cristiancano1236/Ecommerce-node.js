// middleware/auth.js
// Propósito: Middleware para validar JWT en Authorization: Bearer <token>.
// Relación: Usado por `routes/orders.js` para proteger la creación de órdenes y por cualquier ruta que requiera usuario autenticado.

const jwt = require('jsonwebtoken');

/**
 * Verifica un JWT en el header Authorization y adjunta el usuario a req.user.
 * Espera JWT_SECRET en variables de entorno.
 */
function requireAuth(req, res, next) {
  try {
    const header = String(req.headers.authorization || '');
    const [, token] = header.split(' ');
    if (!token) {
      return res.status(401).json({ message: 'No autenticado' });
    }
    const secret = process.env.JWT_SECRET || 'dev-insecure-secret';
    const payload = jwt.verify(token, secret);
    if (!payload || !payload.id) {
      return res.status(401).json({ message: 'Token inválido' });
    }
    req.user = {
      id: payload.id,
      nombre: payload.nombre,
      apellido: payload.apellido,
      correo: payload.correo,
      rol: payload.rol || 'cliente'
    };
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

module.exports = {
  requireAuth,
  requireAdmin(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ message: 'No autenticado' });
    }
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ message: 'Requiere rol admin' });
    }
    return next();
  }
};


