// Script de utilidad para actualizar la contraseña (hash) de un usuario
// Uso: node backend/scripts/reset_password.js <usuario> <nueva_contrasena>

// Cargar variables de entorno desde backend/.env
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { query, pool } = require('../configuracion/base_datos');

const run = async () => {
  const [usuario, nueva] = process.argv.slice(2);
  if (!usuario || !nueva) {
    console.error('Uso: node backend/scripts/reset_password.js <usuario> <nueva_contrasena>');
    process.exit(1);
  }
  try {
    // Verificar existencia
    const resUsr = await query('SELECT usuario FROM usuarios WHERE usuario = $1 LIMIT 1', [usuario]);
    const existente = resUsr.rows[0];
    if (!existente) {
      console.error(`Usuario "${usuario}" no encontrado`);
      process.exit(2);
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(nueva, salt);
    await query('UPDATE usuarios SET password = $1, password_hash = $2, requiere_cambio_contrasena = false, fecha_actualizacion = NOW() WHERE usuario = $3', [nueva, hash, usuario]);
    console.log(`✅ Contraseña actualizada para usuario "${usuario}"`);
  } catch (err) {
    console.error('❌ Error actualizando contraseña:', err.message);
    process.exit(3);
  } finally {
    await pool.end();
  }
};

run();