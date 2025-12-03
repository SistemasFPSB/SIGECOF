const fs = require('fs');
const path = require('path');

// Configuración de logging (por variables de entorno)
const LOG_TRANSACCIONES = process.env.LOG_TRANSACCIONES !== 'false'; // por defecto true
const LOG_NIVEL = process.env.LOG_NIVEL || 'info';
const LOG_ARCHIVO = process.env.LOG_ARCHIVO || '';

const asegurar_directorio = (filePath) => {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (_) {}
};

const escribir = (linea) => {
  console.log(linea);
  if (LOG_ARCHIVO) {
    try {
      asegurar_directorio(LOG_ARCHIVO);
      fs.appendFileSync(LOG_ARCHIVO, linea + '\n', 'utf8');
    } catch (e) {
      // Si no se puede escribir en archivo, continuar sin bloquear
    }
  }
};

const timestamp = () => new Date().toISOString();

const registrar_transaccion = ({ modulo, accion, estado, usuario, mensaje, datos }) => {
  if (!LOG_TRANSACCIONES) return;
  const icono = estado === 'exito' ? '✅' : estado === 'error' ? '❌' : 'ℹ️';
  const cuerpo = {
    usuario: usuario ?? '-',
    mensaje: mensaje ?? '',
    datos: datos ?? undefined,
  };
  const linea = `${timestamp()} ${icono} [${modulo}.${accion}] estado=${estado} ${JSON.stringify(cuerpo)}`;
  escribir(linea);
};

const log_info = (mensaje, contexto) => {
  if (LOG_NIVEL === 'silent') return;
  const linea = `${timestamp()} ℹ️ ${mensaje}${contexto ? ' ' + JSON.stringify(contexto) : ''}`;
  escribir(linea);
};

const log_error = (mensaje, contexto) => {
  const linea = `${timestamp()} ❌ ${mensaje}${contexto ? ' ' + JSON.stringify(contexto) : ''}`;
  escribir(linea);
};

module.exports = {
  registrar_transaccion,
  log_info,
  log_error,
};