// rutas/archivos.js - Subida genérica de archivos (boletines, comunicados, normatividad)
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const { consultar } = require('../configuracion/base_datos');

const router = express.Router();

// Autenticación flexible: acepta Bearer o cookie de sesión
const authFlexible = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      try {
        const secret = process.env.JWT_SECRET || 'sigecof-dev-secret';
        const decoded = jwt.verify(token, secret);
        req.user = decoded;
        return next();
      } catch (_) { /* continuar con cookie */ }
    }
    const raw = req.headers.cookie || '';
    const parsed = cookie.parse(raw || '');
    const sid = parsed.sid || parsed.sigecof_session || null;
    if (!sid) return res.status(401).json({ error: 'No autenticado' });
    const r = await consultar('SELECT id_usuario, expira_en FROM sesiones WHERE sid = $1 LIMIT 1', [sid]);
    const s = r.rows?.[0];
    if (!s) return res.status(401).json({ error: 'No autenticado' });
    if (new Date(s.expira_en).getTime() < Date.now()) return res.status(401).json({ error: 'No autenticado' });
    const ures = await consultar('SELECT id_usuario, usuario, rol, nombre FROM usuarios WHERE id_usuario = $1 LIMIT 1', [s.id_usuario]);
    const u = ures.rows?.[0];
    if (!u) return res.status(401).json({ error: 'No autenticado' });
    req.user = { id_usuario: u.id_usuario, usuario: u.usuario, rol: u.rol, nombre: u.nombre };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'No autenticado' });
  }
};

const DIR_UPLOADS = path.resolve(__dirname, '..', 'archivos');

// Sanitizar destino para evitar traversal y fijar base en uploads del backend
const sanitizar_destino = (destino_raw) => {
  try {
    let d = String(destino_raw || '').trim();
    if (!d) d = 'pantalla_inicial/otros';
    d = d.replace(/\\/g, '/');
    d = d.replace(/\.\.+/g, '').replace(/\/+\/+/, '/');
    d = d.replace(/^\//, '');
    const destino_abs = path.join(DIR_UPLOADS, d);
    if (!destino_abs.startsWith(DIR_UPLOADS + path.sep)) {
      return path.join(DIR_UPLOADS, 'pantalla_inicial', 'otros');
    }
    return destino_abs;
  } catch (_) {
    return path.join(DIR_UPLOADS, 'pantalla_inicial', 'otros');
  }
};

const almacenamiento_generico = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const destino = sanitizar_destino(req.body?.destino || req.query?.destino);
      fs.mkdirSync(destino, { recursive: true });
      cb(null, destino);
    } catch (e) {
      cb(e, DIR_UPLOADS);
    }
  },
  filename: (req, file, cb) => {
    try {
      const nombre_original = path.parse(file.originalname).name
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_\-]/g, '');
      const ext = path.extname(file.originalname).toLowerCase() || '.bin';
      cb(null, `${nombre_original}_${Date.now()}${ext}`);
    } catch (e) {
      cb(null, `archivo_${Date.now()}${path.extname(file.originalname).toLowerCase() || '.bin'}`);
    }
  }
});

const subir_archivo = multer({
  storage: almacenamiento_generico,
  limits: { fileSize: 100 * 1024 * 1024 }
});
const subir_archivo_flexible = multer({
  storage: almacenamiento_generico,
  limits: { fileSize: 100 * 1024 * 1024 }
});

router.post('/subir', authFlexible, (req, res) => {
  console.log('[archivos]', JSON.stringify({ tipo: 'subir_intento', ts: new Date().toISOString(), ip: req.ip, origin: req.headers.origin || null, destino: req.body?.destino || req.query?.destino || null }));
  subir_archivo_flexible.any()(req, res, (err) => {
    if (err) {
      console.log('[archivos]', JSON.stringify({ tipo: 'subir_error', ts: new Date().toISOString(), ip: req.ip, origin: req.headers.origin || null, error: err.message }));
      return res.status(400).json({ exito: false, error: err.message });
    }
    try {
      const archivo = Array.isArray(req.files) && req.files.length > 0 ? req.files[0] : (req.file || null);
      const nombre_archivo = archivo?.filename;
      const destino = sanitizar_destino(req.body?.destino || req.query?.destino);
      const rel = nombre_archivo ? path.relative(DIR_UPLOADS, path.join(destino, nombre_archivo)).replace(/\\/g, '/') : '';
      const ruta_publica = rel ? `/archivos/${rel}` : '';
      if (!nombre_archivo || !ruta_publica) {
        return res.status(400).json({ exito: false, error: 'No se recibió archivo' });
      }
      console.log('[archivos]', JSON.stringify({ tipo: 'subir_ok', ts: new Date().toISOString(), ip: req.ip, origin: req.headers.origin || null, url_publica: ruta_publica }));
      return res.json({ exito: true, url_publica: ruta_publica, nombre: nombre_archivo, tipo: archivo?.mimetype || null, tamano: archivo?.size || null });
    } catch (e) {
      console.log('[archivos]', JSON.stringify({ tipo: 'subir_exception', ts: new Date().toISOString(), ip: req.ip, origin: req.headers.origin || null, error: e.message }));
      return res.status(500).json({ exito: false, error: 'Error interno del servidor' });
    }
  });
});

// Eliminar archivo previamente subido
router.delete('/eliminar', authFlexible, (req, res) => {
  try {
    const url = (req.query.url || req.body?.url || '').toString();
    if (!url) return res.status(400).json({ exito: false, error: 'url requerida' });
    let ruta_rel = url.trim();
    if (/^https?:\/\//.test(ruta_rel)) {
      try { ruta_rel = new URL(ruta_rel).pathname || ruta_rel; } catch (_) {}
    }
    let limpia = ruta_rel.replace(/^\//, '');
    limpia = limpia.replace(/^archivos\//, '');
    const absoluta = path.join(DIR_UPLOADS, limpia);
    if (!absoluta.startsWith(DIR_UPLOADS + path.sep)) {
      return res.status(400).json({ exito: false, error: 'ruta inválida' });
    }
    if (fs.existsSync(absoluta)) {
      try { fs.unlinkSync(absoluta); } catch (e) {
        return res.status(500).json({ exito: false, error: 'No se pudo eliminar el archivo' });
      }
    }
    return res.json({ exito: true });
  } catch (e) {
    return res.status(500).json({ exito: false, error: 'Error interno del servidor' });
  }
});

module.exports = router;
