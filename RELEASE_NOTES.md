# Cómo instalar y ejecutar

Descarga `dist.zip` desde la sección Releases.

Haz clic derecho → "Extraer todo…" y descomprime. Recomiendo una ruta corta, por ejemplo: `C:\Ecommerce\dist`

Abre la carpeta extraída y verifica que el `.exe` esté junto a las demás subcarpetas y archivos de dist.

Crea el archivo `.env` en la misma carpeta `dist` con la siguiente configuración:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_contraseña_mysql
DB_NAME=ecommerce
PORT=3000
JWT_SECRET=tu_secreto_jwt_seguro_aqui
```
⚠️ **IMPORTANTE**: Reemplaza `tu_contraseña_mysql` con tu contraseña real de MySQL y `tu_secreto_jwt_seguro_aqui` por una cadena aleatoria segura.

Asegúrate de que tu base de datos MySQL esté configurada y accesible. La base de datos debe llamarse `ecommerce` (creada desde el script `ecommerce_mysql_es.sql` del repositorio).

Ejecuta `ecommerce-lab-backend.exe` desde dentro de la carpeta `dist`. No cambies la ubicación del `.exe`: debe permanecer y ejecutarse dentro de `dist`. - No renombres ni elimines archivos o subcarpetas de `dist`. - Si Windows SmartScreen muestra advertencia por editor desconocido, selecciona "Más información" → "Ejecutar de todas formas".

Abre tu navegador y visita `http://localhost:3000`

**Credenciales por defecto del administrador:**
- Correo: `admin@modanova.local`
- Contraseña: `admin123`
⚠️ **IMPORTANTE**: Cambia esta contraseña después del primer inicio de sesión.

## Solución de problemas

- **Error de conexión a BD**: Verifica que la contraseña de MySQL en el archivo `.env` sea correcta y que el servicio de MySQL esté activo. Asegúrate de que la base de datos `ecommerce` exista (ejecuta el script `ecommerce_mysql_es.sql` del repositorio si no la tienes).

- **La app no abre/da error inmediato**: Asegúrate de haber descomprimido el ZIP (no ejecutes desde dentro del ZIP) y de ejecutar el `.exe` desde dentro de `dist`. Verifica que el archivo `.env` existe y está bien configurado.

- **Archivos faltantes**: Vuelve a extraer `dist.zip` completo; no elimines ni muevas nada dentro de `dist`.

- **Antivirus/SmartScreen bloquea**: Marca como permitido o añade excepción y vuelve a ejecutar.

## Actualización

Para actualizar, reemplaza la carpeta `dist` completa por la nueva versión desde el nuevo `dist.zip` y restaura tu archivo `.env` en la nueva carpeta. Luego vuelve a ejecutar el `.exe` dentro de `dist`.

⚠️ **IMPORTANTE**: Respalda siempre tu archivo `.env` antes de actualizar para no perder tus configuraciones de base de datos y JWT_SECRET.

