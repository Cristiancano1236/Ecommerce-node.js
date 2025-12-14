# Instrucciones de Instalación - Ecommerce Lab

## Cómo instalar y ejecutar

1. **Descarga `dist.zip` desde la sección Releases.**

2. **Haz clic derecho → "Extraer todo…" y descomprime.** 
   - Recomiendo una ruta corta, por ejemplo: `C:\Ecommerce\dist`

3. **Abre la carpeta extraída y verifica que el `.exe` esté junto a las demás subcarpetas y archivos de dist.**
   - Deberías ver:
     - `ecommerce-lab-backend.exe`
     - Carpeta `public/`
     - Archivo `.env` (debes crearlo si no existe, ver paso 4)

4. **Crea el archivo `.env` en la misma carpeta `dist` con la siguiente configuración:**
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=tu_contraseña_mysql
   DB_NAME=ecommerce
   PORT=3000
   JWT_SECRET=tu_secreto_jwt_seguro_aqui
   ```
   - ⚠️ **IMPORTANTE**: Reemplaza `tu_contraseña_mysql` con tu contraseña real de MySQL
   - ⚠️ **IMPORTANTE**: Cambia `tu_secreto_jwt_seguro_aqui` por una cadena aleatoria segura
   - Asegúrate de que tu base de datos MySQL esté configurada y accesible
   - La base de datos debe llamarse `ecommerce` (creada desde el script `ecommerce_mysql_es.sql` del repositorio)

5. **Ejecuta `ecommerce-lab-backend.exe` desde dentro de la carpeta `dist`.**
   - ⚠️ **No cambies la ubicación del `.exe`**: debe permanecer y ejecutarse dentro de `dist`.
   - ⚠️ **No renombres ni elimines archivos o subcarpetas de `dist`**.
   - ⚠️ Si Windows SmartScreen muestra advertencia por editor desconocido, selecciona "Más información" → "Ejecutar de todas formas".

6. **Abre tu navegador y visita:**
   - `http://localhost:3000`

7. **Credenciales por defecto del administrador:**
   - Correo: `admin@modanova.local`
   - Contraseña: `admin123`
   - ⚠️ **IMPORTANTE**: Cambia esta contraseña después del primer inicio de sesión.

---

## Solución de problemas

- **Error de conexión a BD**: Verifica que la contraseña de MySQL en el archivo `.env` sea correcta y que el servicio de MySQL esté activo. Asegúrate de que la base de datos `ecommerce` exista (ejecuta el script `ecommerce_mysql_es.sql` del repositorio si no la tienes).

- **La app no abre/da error inmediato**: Asegúrate de haber descomprimido el ZIP (no ejecutes desde dentro del ZIP) y de ejecutar el `.exe` desde dentro de `dist`. Verifica que el archivo `.env` existe y está bien configurado.

- **Archivos faltantes**: Vuelve a extraer `dist.zip` completo; no elimines ni muevas nada dentro de `dist`.

- **Antivirus/SmartScreen bloquea**: Marca como permitido o añade excepción y vuelve a ejecutar. Para Windows SmartScreen: "Más información" → "Ejecutar de todas formas".

- **El servidor no inicia**: Verifica que el puerto 3000 no esté siendo usado por otra aplicación. Cambia el `PORT` en el archivo `.env` si es necesario.

- **Error 404 en el navegador**: Asegúrate de que la carpeta `public/` esté en el mismo directorio que el ejecutable y que estés accediendo a `http://localhost:3000` (o el puerto configurado en `.env`).

---

## Actualización

Para actualizar, reemplaza la carpeta `dist` completa por la nueva versión desde el nuevo `dist.zip` y restaura tu archivo `.env` en la nueva carpeta. Luego vuelve a ejecutar el `.exe` dentro de `dist`.

⚠️ **IMPORTANTE**: Respalda siempre tu archivo `.env` antes de actualizar para no perder tus configuraciones de base de datos y JWT_SECRET.

---

## Requisitos del sistema

- **Windows**: Windows 7 o superior (64-bit)
- **MySQL**: MySQL 8.0 o superior (debe estar instalado y ejecutándose)
- **Navegador**: Cualquier navegador moderno (Chrome, Firefox, Edge, etc.)
- **Memoria**: Mínimo 512 MB RAM
- **Espacio en disco**: Mínimo 50 MB libres

---

## Notas adicionales

- El ejecutable incluye todo lo necesario para funcionar (no requiere Node.js instalado)
- La aplicación requiere conexión a MySQL para funcionar correctamente
- El ejecutable funciona de manera independiente y no requiere instalación adicional

