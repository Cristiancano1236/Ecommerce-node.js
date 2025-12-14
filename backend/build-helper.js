// build-helper.js
// Propósito: Script auxiliar para copiar archivos necesarios después del build de pkg.
// Relación: Se ejecuta después de npm run build para preparar la distribución.

const fs = require('fs');
const path = require('path');

const sourcePublic = path.join(__dirname, '..', 'public');
const distDir = path.join(__dirname, 'dist');
const distPublic = path.join(distDir, 'public');

// Función recursiva para copiar directorios
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copiar carpeta public a dist/public
if (fs.existsSync(sourcePublic)) {
  console.log('Copiando archivos públicos a dist/public...');
  copyDir(sourcePublic, distPublic);
  console.log('✓ Archivos públicos copiados correctamente');
} else {
  console.warn('⚠ No se encontró la carpeta public');
}

console.log('\n✓ Build helper completado');
console.log('Los ejecutables están en: backend/dist/');
console.log('Los archivos públicos están en: backend/dist/public/');

