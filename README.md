# Ecommerce Lab (ES) - ModaNova

Aplicación completa de e-commerce con frontend Bootstrap 5 y backend Node.js + MySQL. Sistema de tienda en línea con catálogo de productos, carrito de compras, autenticación de usuarios, gestión de órdenes y panel administrativo.

## 🎯 Características

### Frontend
- ✅ Interfaz moderna con Bootstrap 5.3.3
- ✅ Catálogo de productos con imágenes
- ✅ Búsqueda y filtrado por categorías
- ✅ Carrito de compras (localStorage)
- ✅ Sistema de autenticación (login/registro)
- ✅ Perfil de usuario con gestión de compras
- ✅ Panel administrativo completo
- ✅ Diseño responsive

### Backend
- ✅ API REST con Express.js
- ✅ Autenticación JWT (JSON Web Tokens)
- ✅ Sistema de roles (cliente/admin)
- ✅ Gestión de productos (CRUD)
- ✅ Gestión de categorías
- ✅ Sistema de órdenes
- ✅ Gestión de usuarios
- ✅ Descuentos por producto y categoría
- ✅ Conexión a MySQL con pool de conexiones

### Seguridad
- ✅ Contraseñas hasheadas con bcrypt
- ✅ Middleware de autenticación
- ✅ Validación de permisos por rol
- ✅ Protección de rutas administrativas

## 📁 Estructura del Proyecto

```
Ecommerce-Lab/
├── backend/
│   ├── db.js                    # Pool de conexiones MySQL
│   ├── server.js                # Servidor Express principal
│   ├── middleware/
│   │   └── auth.js              # Middleware de autenticación JWT
│   ├── routes/
│   │   ├── products.js          # Endpoints de productos
│   │   ├── orders.js            # Endpoints de órdenes
│   │   ├── auth.js              # Endpoints de autenticación
│   │   ├── categories.js        # Endpoints de categorías
│   │   └── admin.js             # Endpoints administrativos
│   └── package.json             # Dependencias del backend
├── public/
│   ├── index.html               # Página principal (catálogo)
│   ├── admin.html               # Panel administrativo
│   └── js/
│       ├── app.js               # Lógica del frontend principal
│       └── admin.js             # Lógica del panel admin
├── ecommerce_mysql_es.sql       # Script SQL con esquema y datos
├── .gitignore                   # Archivos a ignorar en Git
└── README.md                    # Este archivo
```

## 🔧 Requisitos

- **Node.js**: 18 o superior
- **MySQL**: 8.0 o superior
- **npm**: Incluido con Node.js

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/Cristiancano1236/Ecommerce-node.js.git
cd Ecommerce-node.js
```

### 2. Crear la base de datos

Ejecuta el script SQL en MySQL Workbench o desde la línea de comandos:

```sql
-- Opción 1: Desde MySQL Workbench
SOURCE ecommerce_mysql_es.sql;

-- Opción 2: Desde CLI de MySQL
mysql -u root -p < ecommerce_mysql_es.sql
```

Este script creará:
- La base de datos `ecommerce`
- Todas las tablas necesarias (productos, categorías, clientes, órdenes, etc.)
- Datos de ejemplo

### 3. Instalar dependencias

```bash
cd backend
npm install
```

### 4. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto (`Ecommerce-Lab/.env`) con el siguiente contenido:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_contraseña_mysql
DB_NAME=ecommerce
PORT=3000
JWT_SECRET=tu_secreto_jwt_aqui_cambiar_en_produccion
```

**⚠️ Importante**: Cambia `JWT_SECRET` por una cadena aleatoria segura en producción.

### 5. Iniciar el servidor

```bash
cd backend
npm start
```

Para desarrollo con recarga automática:

```bash
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

## 📚 API Endpoints

### Autenticación (`/api/auth`)
- `POST /api/auth/register` - Registrar nuevo usuario
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Obtener perfil actual (requiere autenticación)
- `PUT /api/auth/profile` - Actualizar perfil (requiere autenticación)
- `PUT /api/auth/password` - Cambiar contraseña (requiere autenticación)

### Productos (`/api/productos`)
- `GET /api/productos` - Listar productos (filtros: `?categoria_id=X`, `?all=1`)
- `GET /api/productos/:id` - Obtener producto por ID
- `POST /api/productos` - Crear producto (requiere admin)
- `PUT /api/productos/:id` - Actualizar producto (requiere admin)
- `DELETE /api/productos/:id` - Eliminar producto lógicamente (requiere admin)
- `POST /api/productos/descuento-masivo` - Aplicar descuento masivo (requiere admin)

### Categorías (`/api/categorias`)
- `GET /api/categorias` - Listar categorías
- `POST /api/categorias` - Crear categoría (requiere admin)
- `PUT /api/categorias/:id` - Actualizar categoría (requiere admin)
- `DELETE /api/categorias/:id` - Eliminar categoría (requiere admin)

### Órdenes (`/api/ordenes`)
- `POST /api/ordenes` - Crear orden desde carrito (requiere autenticación)
- `GET /api/ordenes` - Listar órdenes del usuario (requiere autenticación)
- `GET /api/ordenes/:id` - Obtener orden por ID (requiere autenticación)
- `GET /api/ordenes/admin/todas` - Listar todas las órdenes (requiere admin)
- `PUT /api/ordenes/:id/estado` - Actualizar estado de orden (requiere admin)

### Administración (`/api/admin`)
- `GET /api/admin/users` - Listar usuarios (requiere admin)
- `POST /api/admin/users` - Crear usuario (requiere admin)

## 👤 Usuario Administrador por Defecto

El sistema crea automáticamente un usuario administrador al iniciar:

- **Correo**: `admin@modanova.local`
- **Contraseña**: `admin123`

**⚠️ Importante**: Cambia esta contraseña en producción.

## 🛠️ Tecnologías Utilizadas

### Backend
- **Express.js** - Framework web para Node.js
- **MySQL2** - Cliente MySQL para Node.js
- **bcrypt** - Hashing de contraseñas
- **jsonwebtoken** - Autenticación JWT
- **dotenv** - Variables de entorno
- **cors** - Habilitar CORS

### Frontend
- **Bootstrap 5.3.3** - Framework CSS
- **Bootstrap Icons** - Iconografía
- **JavaScript Vanilla** - Sin frameworks adicionales

### Base de Datos
- **MySQL 8.0+** - Sistema de gestión de bases de datos relacional

## 📝 Características Adicionales

### Sistema de Descuentos
- Descuentos a nivel de producto
- Descuentos a nivel de categoría
- Prioridad: descuento de producto > descuento de categoría
- Activación/desactivación de descuentos
- Aplicación automática en el cálculo de precios

### Gestión de Inventario
- Control de existencias
- Validación de stock al crear órdenes
- Actualización automática de inventario

### Carrito de Compras
- Persistencia en `localStorage`
- Sincronización con el servidor al finalizar compra
- Validación de disponibilidad antes de procesar

## 🔒 Seguridad

- Contraseñas hasheadas con bcrypt (10 salt rounds)
- Tokens JWT con expiración de 7 días
- Validación de permisos por rol
- Protección contra inyección SQL (consultas parametrizadas)
- Validación de entrada en todos los endpoints

## 📄 Licencia

MIT

## 👨‍💻 Autor

Cristian Cano

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request


