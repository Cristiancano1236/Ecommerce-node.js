-- ================================================================
-- Script de base de datos (ES) para un e-commerce - MySQL 8.0+
-- Base de datos: ecommerce
-- Tablas en español y moneda por defecto: COP
-- Relación con otros archivos: variante en español del esquema
--   complementa a sql/ecommerce_mysql.sql (versión en inglés).
-- ================================================================

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS ecommerce
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE ecommerce;

SET sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- ================================================================
-- Tabla: categorias
-- Propósito: organización de productos y descuentos por categoría.
-- Referencias: padre de productos (productos.categoria_id).
-- ================================================================
CREATE TABLE IF NOT EXISTS categorias (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'PK categoría',
  nombre VARCHAR(150) NOT NULL COMMENT 'Nombre visible de la categoría',
  slug VARCHAR(160) NOT NULL COMMENT 'Identificador URL/único',
  descripcion TEXT NULL COMMENT 'Descripción opcional',
  activo TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Indicador de activación',
  -- Descuento a nivel de categoría (porcentaje 0-100). Se aplica si descuento_activo=1
  descuento_pct DECIMAL(5,2) NULL COMMENT 'Porcentaje de descuento [0-100] a nivel categoría',
  descuento_activo TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Si 1, aplica descuento_pct a los productos sin descuento propio',
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación',
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última actualización',
  PRIMARY KEY (id),
  UNIQUE KEY uk_categorias_slug (slug),
  KEY idx_categorias_nombre (nombre),
  CONSTRAINT chk_categorias_descuento_rango CHECK (
    descuento_pct IS NULL OR (descuento_pct >= 0 AND descuento_pct <= 100)
  )
) ENGINE=InnoDB COMMENT='Categorías de productos con control de descuento';

-- Para esquemas ya creados sin la tabla categorias, las sentencias anteriores la crean.
-- (No es necesario ALTER condicional aquí para creación de tabla).

-- ================================================================
-- Tabla: clientes
-- Propósito: almacenar clientes.
-- Referencias: padre de ordenes (ordenes.cliente_id).
-- ================================================================
CREATE TABLE IF NOT EXISTS clientes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'PK cliente',
  nombre VARCHAR(100) NOT NULL COMMENT 'Nombre del cliente',
  apellido VARCHAR(100) NOT NULL COMMENT 'Apellido del cliente',
  correo VARCHAR(255) NOT NULL COMMENT 'Correo único',
  telefono VARCHAR(30) NULL COMMENT 'Teléfono de contacto',
  -- Hash de contraseña para autenticación (bcrypt). Puede ser NULL para clientes legados sin cuenta.
  password_hash VARCHAR(255) NULL COMMENT 'Hash bcrypt de la contraseña',
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación',
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última actualización',
  PRIMARY KEY (id),
  UNIQUE KEY uk_clientes_correo (correo)
) ENGINE=InnoDB COMMENT='Clientes; referenciada por ordenes.cliente_id';

-- Para esquemas ya creados sin la columna password_hash (MySQL 8.0.12+)
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL COMMENT 'Hash bcrypt de la contraseña' AFTER telefono;

-- Rol del cliente/usuario (cliente|admin)
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS rol ENUM('cliente','admin') NOT NULL DEFAULT 'cliente' COMMENT 'Rol de usuario' AFTER password_hash;

-- Usuario admin por defecto con contraseña admin123 (hash bcrypt con 10 rounds)
-- Hash generado para la contraseña: admin123
INSERT INTO clientes (nombre, apellido, correo, telefono, password_hash, rol)
VALUES ('Admin','Principal','admin@modanova.local', NULL, '$2b$10$1KHs7KYtXLZPPVmES3/XrebpYpCWgY6C8etODTNxTOaQKR75yIIXe', 'admin')
ON DUPLICATE KEY UPDATE 
  password_hash = VALUES(password_hash),
  rol = VALUES(rol);

-- ================================================================
-- Tabla: productos
-- Propósito: catálogo de productos.
-- Referencias: padre de items_orden (items_orden.producto_id).
-- ================================================================
CREATE TABLE IF NOT EXISTS productos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'PK producto',
  sku VARCHAR(64) NOT NULL COMMENT 'Código único de inventario',
  nombre VARCHAR(200) NOT NULL COMMENT 'Nombre visible del producto',
  descripcion TEXT NULL COMMENT 'Descripción del producto',
  precio DECIMAL(12,2) NOT NULL COMMENT 'Precio unitario',
  moneda CHAR(3) NOT NULL DEFAULT 'COP' COMMENT 'Código ISO 4217, por defecto COP',
  existencias INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Unidades disponibles',
  activo TINYINT(1) NOT NULL DEFAULT 1 COMMENT 'Indicador de activación',
  -- Descuentos opcionales por producto (porcentaje 0-100). Si descuento_activo=1, tiene prioridad sobre el de categoría.
  descuento_pct DECIMAL(5,2) NULL COMMENT 'Porcentaje de descuento [0-100] a nivel producto',
  descuento_activo TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Si 1, aplica descuento_pct del producto',
  -- Relación a categoría (opcional)
  categoria_id BIGINT UNSIGNED NULL COMMENT 'FK a categorias.id (opcional)',
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación',
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última actualización',
  PRIMARY KEY (id),
  UNIQUE KEY uk_productos_sku (sku),
  KEY idx_productos_nombre (nombre),
  KEY idx_productos_categoria (categoria_id),
  CONSTRAINT chk_productos_precio_no_neg CHECK (precio >= 0),
  CONSTRAINT chk_productos_existencias_no_neg CHECK (existencias >= 0),
  CONSTRAINT chk_productos_descuento_rango CHECK (
    descuento_pct IS NULL OR (descuento_pct >= 0 AND descuento_pct <= 100)
  ),
  CONSTRAINT fk_productos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias(id)
) ENGINE=InnoDB COMMENT='Productos; referenciada por items_orden.producto_id';

-- Para esquemas ya creados: agregar columnas si no existen (MySQL 8.0.12+)
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS descuento_pct DECIMAL(5,2) NULL COMMENT 'Porcentaje de descuento [0-100] a nivel producto' AFTER activo,
  ADD COLUMN IF NOT EXISTS descuento_activo TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Si 1, aplica descuento_pct del producto' AFTER descuento_pct,
  ADD COLUMN IF NOT EXISTS categoria_id BIGINT UNSIGNED NULL COMMENT 'FK a categorias.id (opcional)' AFTER descuento_activo;

-- ================================================================
-- Tabla: ordenes
-- Propósito: cabecera de pedido/orden.
-- Referencias: hija de clientes; padre de items_orden.
-- ================================================================
CREATE TABLE IF NOT EXISTS ordenes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'PK orden',
  cliente_id BIGINT UNSIGNED NOT NULL COMMENT 'FK a clientes.id',
  estado ENUM('pendiente','pagada','enviada','entregada','cancelada','reembolsada') NOT NULL DEFAULT 'pendiente' COMMENT 'Estado de la orden',
  total DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Total reportado de la orden',
  moneda CHAR(3) NOT NULL DEFAULT 'COP' COMMENT 'Código ISO 4217, por defecto COP',
  realizada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha/hora de creación',
  actualizada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha/hora de actualización',
  PRIMARY KEY (id),
  KEY idx_ordenes_cliente_id (cliente_id),
  KEY idx_ordenes_estado_realizada (estado, realizada_en),
  CONSTRAINT fk_ordenes_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  CONSTRAINT chk_ordenes_total_no_neg CHECK (total >= 0)
) ENGINE=InnoDB COMMENT='Órdenes; padre de items_orden';

-- ================================================================
-- Tabla: items_orden
-- Propósito: renglones de cada orden con cantidad y precio.
-- Referencias: puente entre ordenes y productos.
-- ================================================================
CREATE TABLE IF NOT EXISTS items_orden (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'PK ítem de orden',
  orden_id BIGINT UNSIGNED NOT NULL COMMENT 'FK a ordenes.id',
  producto_id BIGINT UNSIGNED NOT NULL COMMENT 'FK a productos.id',
  sku VARCHAR(64) NOT NULL COMMENT 'SKU copiado por trazabilidad',
  nombre_producto VARCHAR(200) NOT NULL COMMENT 'Nombre copiado por trazabilidad',
  precio_unitario DECIMAL(12,2) NOT NULL COMMENT 'Precio unitario al momento de la compra',
  cantidad INT UNSIGNED NOT NULL COMMENT 'Cantidad pedida',
  total_renglon DECIMAL(12,2) AS (cantidad * precio_unitario) STORED COMMENT 'Total calculado del renglón',
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de registro del ítem',
  PRIMARY KEY (id),
  KEY idx_items_orden_orden_id (orden_id),
  KEY idx_items_orden_producto_id (producto_id),
  CONSTRAINT fk_items_orden_orden FOREIGN KEY (orden_id) REFERENCES ordenes(id) ON DELETE CASCADE,
  CONSTRAINT fk_items_orden_producto FOREIGN KEY (producto_id) REFERENCES productos(id),
  CONSTRAINT chk_items_orden_cantidad_pos CHECK (cantidad > 0),
  CONSTRAINT chk_items_orden_precio_unit_no_neg CHECK (precio_unitario >= 0)
) ENGINE=InnoDB COMMENT='Ítems de cada orden; enlaza ordenes y productos';

-- ================================================================
-- Tabla: imagenes_productos
-- Propósito: almacenar imágenes asociadas a productos (BLOB o URL).
-- Referencias: hija de productos (productos.id). Consumida por la capa
--   de aplicación para renderizar galerías y miniaturas.
-- ================================================================
CREATE TABLE IF NOT EXISTS imagenes_productos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'PK imagen de producto',
  producto_id BIGINT UNSIGNED NOT NULL COMMENT 'FK a productos.id',
  nombre_archivo VARCHAR(255) NOT NULL COMMENT 'Nombre de archivo original (sanitizado)',
  tipo_mime VARCHAR(100) NULL COMMENT 'Tipo MIME detectado (p.ej. image/jpeg)',
  tamano_bytes BIGINT UNSIGNED NULL COMMENT 'Tamaño del binario en bytes si aplica',
  datos LONGBLOB NULL COMMENT 'Contenido binario de la imagen (opcional si se usa url)',
  url VARCHAR(1000) NULL COMMENT 'URL absoluta o relativa de la imagen (opcional si se usa datos)',
  hash_sha256 CHAR(64) NULL COMMENT 'Hash SHA-256 hex para deduplicación',
  ancho INT UNSIGNED NULL COMMENT 'Ancho en píxeles',
  alto INT UNSIGNED NULL COMMENT 'Alto en píxeles',
  orden_visual INT NOT NULL DEFAULT 0 COMMENT 'Orden sugerido de visualización',
  es_principal TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Indicador de imagen principal',
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación',
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Fecha de última actualización',
  -- Columna generada para asegurar unicidad de imagen principal por producto
  principal_producto_id BIGINT UNSIGNED GENERATED ALWAYS AS (IF(es_principal, producto_id, NULL)) STORED,
  PRIMARY KEY (id),
  KEY idx_imagenes_productos_producto_id (producto_id),
  KEY idx_imagenes_productos_hash (hash_sha256),
  CONSTRAINT fk_imagenes_productos_producto FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
  CONSTRAINT chk_imagenes_origen CHECK ((datos IS NOT NULL) OR (url IS NOT NULL)),
  UNIQUE KEY uk_imagenes_productos_principal (principal_producto_id)
) ENGINE=InnoDB COMMENT='Imágenes asociadas a productos; permite BLOB o URL';

-- ================================================================
-- Vista: v_ordenes_con_totales
-- Propósito: calcular total real de cada orden a partir de items_orden.total_renglon.
-- Uso: capa de aplicación para mostrar totales confiables.
-- ================================================================
CREATE OR REPLACE VIEW v_ordenes_con_totales AS
SELECT
  o.id AS orden_id,
  o.cliente_id,
  o.estado,
  o.moneda,
  o.realizada_en,
  o.actualizada_en,
  COALESCE(SUM(io.total_renglon), 0) AS total_calculado
FROM ordenes o
LEFT JOIN items_orden io ON io.orden_id = o.id
GROUP BY o.id, o.cliente_id, o.estado, o.moneda, o.realizada_en, o.actualizada_en;

-- ================================================================
-- Datos de ejemplo mínimos
-- Nota: Para ambientes productivos, utilizar transacciones desde la app.
-- ================================================================
-- Categoría de ejemplo
INSERT INTO categorias (nombre, slug, descripcion, activo, descuento_pct, descuento_activo)
VALUES ('Destacados', 'destacados', 'Categoría de ejemplo', 1, NULL, 0)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- ================================================================
-- Categorías de ropa y accesorios
-- Propósito: categorías principales para organizar productos de ropa.
-- Referencias: utilizadas por productos.categoria_id.
-- ================================================================
INSERT INTO categorias (nombre, slug, descripcion, activo, descuento_pct, descuento_activo)
VALUES 
  ('Hombre', 'hombre', 'Ropa para hombre', 1, NULL, 0),
  ('Mujer', 'mujer', 'Ropa para mujer', 1, NULL, 0),
  ('Niño', 'nino', 'Ropa para niños', 1, NULL, 0),
  ('Niñas', 'ninas', 'Ropa para niñas', 1, NULL, 0),
  ('Accesorios Hombre', 'accesorios-hombre', 'Accesorios para hombre', 1, NULL, 0),
  ('Accesorios Mujer', 'accesorios-mujer', 'Accesorios para mujer', 1, NULL, 0)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

INSERT INTO clientes (nombre, apellido, correo, telefono)
VALUES ('Cliente','Demo','cliente.demo@example.com',NULL)
ON DUPLICATE KEY UPDATE correo = VALUES(correo);

-- Producto de ejemplo: asociado a la categoría creada
INSERT INTO productos (sku, nombre, descripcion, precio, moneda, existencias, activo, categoria_id)
VALUES (
  'SKU-ES-001',
  'Producto Demo ES',
  'Artículo de ejemplo en español',
  19990, 'COP', 100, 1,
  (SELECT id FROM categorias WHERE slug = 'destacados' LIMIT 1)
)
ON DUPLICATE KEY UPDATE sku = VALUES(sku);

-- ================================================================
-- Productos de ejemplo por categoría (3 productos por categoría)
-- Propósito: datos de ejemplo para ropa en cada categoría.
-- Referencias: productos.categoria_id -> categorias.id
-- ================================================================

-- Productos categoría Hombre (3 productos)
INSERT INTO productos (sku, nombre, descripcion, precio, moneda, existencias, activo, categoria_id)
VALUES 
  ('SKU-HOM-001', 'Camisa Formal Hombre', 'Camisa de manga larga en algodón 100%, ideal para ocasiones formales. Disponible en varios colores.', 89900, 'COP', 50, 1, (SELECT id FROM categorias WHERE slug = 'hombre' LIMIT 1)),
  ('SKU-HOM-002', 'Pantalón Jeans Clásico', 'Pantalón jeans de corte clásico, cómodo y resistente. Talla disponible desde 28 hasta 40.', 129900, 'COP', 75, 1, (SELECT id FROM categorias WHERE slug = 'hombre' LIMIT 1)),
  ('SKU-HOM-003', 'Chaqueta Deportiva', 'Chaqueta deportiva con capucha, perfecta para actividades al aire libre. Material transpirable.', 159900, 'COP', 40, 1, (SELECT id FROM categorias WHERE slug = 'hombre' LIMIT 1))
ON DUPLICATE KEY UPDATE sku = VALUES(sku);

-- Productos categoría Mujer (3 productos)
INSERT INTO productos (sku, nombre, descripcion, precio, moneda, existencias, activo, categoria_id)
VALUES 
  ('SKU-MUJ-001', 'Blusa Elegante', 'Blusa de corte elegante en poliéster y elastano. Perfecta para oficina o eventos casuales.', 79900, 'COP', 60, 1, (SELECT id FROM categorias WHERE slug = 'mujer' LIMIT 1)),
  ('SKU-MUJ-002', 'Vestido Casual', 'Vestido casual de algodón, cómodo y versátil. Ideal para el día a día. Disponible en varios estampados.', 119900, 'COP', 45, 1, (SELECT id FROM categorias WHERE slug = 'mujer' LIMIT 1)),
  ('SKU-MUJ-003', 'Pantalón Tiro Alto', 'Pantalón de tiro alto en tela elástica, cómodo y favorecedor. Perfecto para combinar con cualquier top.', 99900, 'COP', 55, 1, (SELECT id FROM categorias WHERE slug = 'mujer' LIMIT 1))
ON DUPLICATE KEY UPDATE sku = VALUES(sku);

-- Productos categoría Niño (3 productos)
INSERT INTO productos (sku, nombre, descripcion, precio, moneda, existencias, activo, categoria_id)
VALUES 
  ('SKU-NIN-001', 'Camiseta Estampada', 'Camiseta de algodón con estampados divertidos. Disponible en tallas desde 4 hasta 14 años.', 39900, 'COP', 80, 1, (SELECT id FROM categorias WHERE slug = 'nino' LIMIT 1)),
  ('SKU-NIN-002', 'Pantalón Corto Deportivo', 'Pantalón corto deportivo con cintura elástica. Ideal para jugar y hacer deporte.', 49900, 'COP', 70, 1, (SELECT id FROM categorias WHERE slug = 'nino' LIMIT 1)),
  ('SKU-NIN-003', 'Sudadera con Capucha', 'Sudadera cómoda con capucha y bolsillo delantero. Perfecta para días frescos.', 89900, 'COP', 50, 1, (SELECT id FROM categorias WHERE slug = 'nino' LIMIT 1))
ON DUPLICATE KEY UPDATE sku = VALUES(sku);

-- Productos categoría Niñas (3 productos)
INSERT INTO productos (sku, nombre, descripcion, precio, moneda, existencias, activo, categoria_id)
VALUES 
  ('SKU-NIA-001', 'Vestido Floral', 'Vestido con estampado floral, suave y cómodo. Perfecto para ocasiones especiales. Tallas 4-14 años.', 79900, 'COP', 65, 1, (SELECT id FROM categorias WHERE slug = 'ninas' LIMIT 1)),
  ('SKU-NIA-002', 'Falda Plisada', 'Falda plisada en colores vibrantes, ideal para el colegio o eventos casuales. Tallas disponibles.', 59900, 'COP', 55, 1, (SELECT id FROM categorias WHERE slug = 'ninas' LIMIT 1)),
  ('SKU-NIA-003', 'Blusa con Volantes', 'Blusa de algodón con detalles de volantes en los hombros. Diseño encantador y cómodo.', 69900, 'COP', 60, 1, (SELECT id FROM categorias WHERE slug = 'ninas' LIMIT 1))
ON DUPLICATE KEY UPDATE sku = VALUES(sku);

-- Productos categoría Accesorios Hombre (3 productos)
INSERT INTO productos (sku, nombre, descripcion, precio, moneda, existencias, activo, categoria_id)
VALUES 
  ('SKU-ACH-001', 'Cinturón de Cuero', 'Cinturón de cuero genuino con hebilla metálica. Disponible en varios colores y tallas.', 89900, 'COP', 100, 1, (SELECT id FROM categorias WHERE slug = 'accesorios-hombre' LIMIT 1)),
  ('SKU-ACH-002', 'Gorra Deportiva', 'Gorra ajustable con diseño moderno. Perfecta para proteger del sol durante actividades deportivas.', 49900, 'COP', 120, 1, (SELECT id FROM categorias WHERE slug = 'accesorios-hombre' LIMIT 1)),
  ('SKU-ACH-003', 'Billetera de Cuero', 'Billetera de cuero con múltiples compartimentos para tarjetas y billetes. Diseño elegante y funcional.', 129900, 'COP', 80, 1, (SELECT id FROM categorias WHERE slug = 'accesorios-hombre' LIMIT 1))
ON DUPLICATE KEY UPDATE sku = VALUES(sku);

-- Productos categoría Accesorios Mujer (3 productos)
INSERT INTO productos (sku, nombre, descripcion, precio, moneda, existencias, activo, categoria_id)
VALUES 
  ('SKU-ACM-001', 'Bolso Tote', 'Bolso tote espacioso en tela resistente. Perfecto para el día a día, con asas largas y bolsillo interior.', 149900, 'COP', 45, 1, (SELECT id FROM categorias WHERE slug = 'accesorios-mujer' LIMIT 1)),
  ('SKU-ACM-002', 'Collar de Perlas', 'Collar elegante con perlas naturales. Diseño clásico que complementa cualquier outfit formal o casual.', 199900, 'COP', 30, 1, (SELECT id FROM categorias WHERE slug = 'accesorios-mujer' LIMIT 1)),
  ('SKU-ACM-003', 'Gafas de Sol', 'Gafas de sol con protección UV400. Diseño moderno y elegante, disponibles en varios colores de montura.', 89900, 'COP', 60, 1, (SELECT id FROM categorias WHERE slug = 'accesorios-mujer' LIMIT 1))
ON DUPLICATE KEY UPDATE sku = VALUES(sku);

INSERT INTO ordenes (cliente_id, estado, total, moneda)
VALUES (1, 'pendiente', 0, 'COP');

INSERT INTO items_orden (orden_id, producto_id, sku, nombre_producto, precio_unitario, cantidad)
SELECT o.id, p.id, p.sku, p.nombre, p.precio, 2
FROM ordenes o
JOIN productos p ON p.sku = 'SKU-ES-001'
WHERE o.id = LAST_INSERT_ID();

UPDATE ordenes o
JOIN (
  SELECT orden_id, SUM(total_renglon) AS suma_total
  FROM items_orden
  GROUP BY orden_id
) x ON x.orden_id = o.id
SET o.total = x.suma_total
WHERE o.id = LAST_INSERT_ID();

-- ================================================================
-- Datos de ejemplo para imagenes_productos
-- Propósito: asignar una imagen principal (por URL) al producto de demo.
-- Nota: En entornos productivos, las cargas BLOB deben gestionarse desde la app.
-- ================================================================
INSERT INTO imagenes_productos (
  producto_id, nombre_archivo, tipo_mime, tamano_bytes, datos, url,
  hash_sha256, ancho, alto, orden_visual, es_principal
) 
SELECT 
  p.id,
  'producto-demo-es.jpg',
  'image/jpeg',
  NULL,
  NULL,
  'https://www.planetkids.com.co/cdn/shop/products/21-03116-088-800-1.jpg?v=1631823859',
  NULL,
  600,
  400,
  0,
  1
FROM productos p
WHERE p.sku = 'SKU-ES-001'
ON DUPLICATE KEY UPDATE
  url = VALUES(url),
  actualizado_en = CURRENT_TIMESTAMP;

-- ================================================================
-- Imágenes para productos de ropa por categoría
-- Propósito: asignar imágenes principales a cada producto de ropa.
-- Referencias: imagenes_productos.producto_id -> productos.id
-- ================================================================

-- Imágenes categoría Hombre
INSERT INTO imagenes_productos (
  producto_id, nombre_archivo, tipo_mime, tamano_bytes, datos, url,
  hash_sha256, ancho, alto, orden_visual, es_principal
)
SELECT 
  p.id,
  CONCAT('hombre-', p.sku, '.jpg'),
  'image/jpeg',
  NULL,
  NULL,
  CASE p.sku
    WHEN 'SKU-HOM-001' THEN 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&h=800&fit=crop'
    WHEN 'SKU-HOM-002' THEN 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=600&h=800&fit=crop'
    WHEN 'SKU-HOM-003' THEN 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&h=800&fit=crop'
  END,
  NULL,
  600,
  800,
  0,
  1
FROM productos p
WHERE p.sku IN ('SKU-HOM-001', 'SKU-HOM-002', 'SKU-HOM-003')
ON DUPLICATE KEY UPDATE
  url = VALUES(url),
  actualizado_en = CURRENT_TIMESTAMP;

-- Imágenes categoría Mujer
INSERT INTO imagenes_productos (
  producto_id, nombre_archivo, tipo_mime, tamano_bytes, datos, url,
  hash_sha256, ancho, alto, orden_visual, es_principal
)
SELECT 
  p.id,
  CONCAT('mujer-', p.sku, '.jpg'),
  'image/jpeg',
  NULL,
  NULL,
  CASE p.sku
    WHEN 'SKU-MUJ-001' THEN 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=600&h=800&fit=crop'
    WHEN 'SKU-MUJ-002' THEN 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&h=800&fit=crop'
    WHEN 'SKU-MUJ-003' THEN 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=600&h=800&fit=crop'
  END,
  NULL,
  600,
  800,
  0,
  1
FROM productos p
WHERE p.sku IN ('SKU-MUJ-001', 'SKU-MUJ-002', 'SKU-MUJ-003')
ON DUPLICATE KEY UPDATE
  url = VALUES(url),
  actualizado_en = CURRENT_TIMESTAMP;

-- Imágenes categoría Niño
INSERT INTO imagenes_productos (
  producto_id, nombre_archivo, tipo_mime, tamano_bytes, datos, url,
  hash_sha256, ancho, alto, orden_visual, es_principal
)
SELECT 
  p.id,
  CONCAT('nino-', p.sku, '.jpg'),
  'image/jpeg',
  NULL,
  NULL,
  CASE p.sku
    WHEN 'SKU-NIN-001' THEN 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=600&h=800&fit=crop'
    WHEN 'SKU-NIN-002' THEN 'https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=600&h=800&fit=crop'
    WHEN 'SKU-NIN-003' THEN 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=800&fit=crop'
  END,
  NULL,
  600,
  800,
  0,
  1
FROM productos p
WHERE p.sku IN ('SKU-NIN-001', 'SKU-NIN-002', 'SKU-NIN-003')
ON DUPLICATE KEY UPDATE
  url = VALUES(url),
  actualizado_en = CURRENT_TIMESTAMP;

-- Imágenes categoría Niñas
INSERT INTO imagenes_productos (
  producto_id, nombre_archivo, tipo_mime, tamano_bytes, datos, url,
  hash_sha256, ancho, alto, orden_visual, es_principal
)
SELECT 
  p.id,
  CONCAT('ninas-', p.sku, '.jpg'),
  'image/jpeg',
  NULL,
  NULL,
  CASE p.sku
    WHEN 'SKU-NIA-001' THEN 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=800&fit=crop'
    WHEN 'SKU-NIA-002' THEN 'https://images.unsplash.com/photo-1594633313593-bab3825d0caf?w=600&h=800&fit=crop'
    WHEN 'SKU-NIA-003' THEN 'https://images.unsplash.com/photo-1594633313593-bab3825d0caf?w=600&h=800&fit=crop'
  END,
  NULL,
  600,
  800,
  0,
  1
FROM productos p
WHERE p.sku IN ('SKU-NIA-001', 'SKU-NIA-002', 'SKU-NIA-003')
ON DUPLICATE KEY UPDATE
  url = VALUES(url),
  actualizado_en = CURRENT_TIMESTAMP;

-- Imágenes categoría Accesorios Hombre
INSERT INTO imagenes_productos (
  producto_id, nombre_archivo, tipo_mime, tamano_bytes, datos, url,
  hash_sha256, ancho, alto, orden_visual, es_principal
)
SELECT 
  p.id,
  CONCAT('accesorios-hombre-', p.sku, '.jpg'),
  'image/jpeg',
  NULL,
  NULL,
  CASE p.sku
    WHEN 'SKU-ACH-001' THEN 'https://images.unsplash.com/photo-1624222247344-550fb60583fd?w=600&h=600&fit=crop'
    WHEN 'SKU-ACH-002' THEN 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600&h=600&fit=crop'
    WHEN 'SKU-ACH-003' THEN 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&h=600&fit=crop'
  END,
  NULL,
  600,
  600,
  0,
  1
FROM productos p
WHERE p.sku IN ('SKU-ACH-001', 'SKU-ACH-002', 'SKU-ACH-003')
ON DUPLICATE KEY UPDATE
  url = VALUES(url),
  actualizado_en = CURRENT_TIMESTAMP;

-- Imágenes categoría Accesorios Mujer
INSERT INTO imagenes_productos (
  producto_id, nombre_archivo, tipo_mime, tamano_bytes, datos, url,
  hash_sha256, ancho, alto, orden_visual, es_principal
)
SELECT 
  p.id,
  CONCAT('accesorios-mujer-', p.sku, '.jpg'),
  'image/jpeg',
  NULL,
  NULL,
  CASE p.sku
    WHEN 'SKU-ACM-001' THEN 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=600&h=600&fit=crop'
    WHEN 'SKU-ACM-002' THEN 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=600&h=600&fit=crop'
    WHEN 'SKU-ACM-003' THEN 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&h=600&fit=crop'
  END,
  NULL,
  600,
  600,
  0,
  1
FROM productos p
WHERE p.sku IN ('SKU-ACM-001', 'SKU-ACM-002', 'SKU-ACM-003')
ON DUPLICATE KEY UPDATE
  url = VALUES(url),
  actualizado_en = CURRENT_TIMESTAMP;


