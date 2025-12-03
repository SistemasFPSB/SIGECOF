// rutas/carrusel.js - Endpoints para administración del carrusel (subida de archivos)
// Todas las definiciones en español y snake_case
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const { consultar } = require('../configuracion/base_datos');
// Permitir acceso a cualquier usuario autenticado; se elimina restricción de rol
const {
  listar_banners,
  listar_banners_publicos,
  obtener_banner_por_id,
  crear_banner,
  actualizar_banner,
  eliminar_banner,
  reordenar_prioridades,
} = require('../modelos/carrusel');

const router = express.Router();

const log_evento = (tipo, meta = {}) => {
  try {
    const entrada = {
      tipo,
      ts: new Date().toISOString(),
      ...meta,
    };
    console.log('[carrusel]', JSON.stringify(entrada));
  } catch (_) {}
};

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
    const ures = await consultar('SELECT id_usuario, usuario, rol, nombre, requiere_cambio_contrasena FROM usuarios WHERE id_usuario = $1 LIMIT 1', [s.id_usuario]);
    const u = ures.rows?.[0];
    if (!u) return res.status(401).json({ error: 'No autenticado' });
    req.user = { id_usuario: u.id_usuario, usuario: u.usuario, rol: u.rol, nombre: u.nombre, requiere_cambio_contrasena: !!u.requiere_cambio_contrasena };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'No autenticado' });
  }
};

// Directorios de destino de archivos públicos del backend
const DIR_UPLOADS = path.resolve(__dirname, '..', 'archivos');
const DIR_BANNERS = path.join(DIR_UPLOADS, 'carrusel', 'banners');
const DIR_ARCHIVOS = path.join(DIR_UPLOADS, 'carrusel', 'archivos');

// Asegurar directorios
for (const dir of [DIR_BANNERS, DIR_ARCHIVOS]) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {
    console.error('No se pudo crear directorio:', dir, e.message);
  }
}

// Utilidad: eliminar archivo anterior de forma segura si existe
const eliminar_archivo_si_existe = (url_publica) => {
  try {
    if (!url_publica || typeof url_publica !== 'string') return;
    let ruta_rel = String(url_publica).trim();
    // Si viene absoluta, extraer pathname
    if (/^https?:\/\//.test(ruta_rel)) {
      try { ruta_rel = new URL(ruta_rel).pathname || ruta_rel; } catch (_) {}
    }
    const limpia = ruta_rel.replace(/^\//, '');
    const absoluta = path.join(DIR_UPLOADS, limpia);
    const dentro_banners = absoluta.startsWith(DIR_BANNERS + path.sep);
    const dentro_archivos = absoluta.startsWith(DIR_ARCHIVOS + path.sep);
    if (!dentro_banners && !dentro_archivos) return;
    if (fs.existsSync(absoluta)) {
      fs.unlinkSync(absoluta);
    }
  } catch (e) {
    console.warn('No se pudo eliminar archivo anterior:', url_publica, e.message);
  }
};

// Filtro de tipos permitidos
const tipos_imagen = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
const tipos_pdf = ['.pdf'];

// Almacenamiento para imágenes del carrusel
const almacenamiento_banners = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!fs.existsSync(DIR_BANNERS)) fs.mkdirSync(DIR_BANNERS, { recursive: true });
      cb(null, DIR_BANNERS);
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
      const ext = path.extname(file.originalname).toLowerCase();
      const unico = Date.now();
      cb(null, `${nombre_original}_${unico}${ext}`);
    } catch (e) {
      cb(null, `banner_${Date.now()}${path.extname(file.originalname).toLowerCase() || '.png'}`);
    }
  }
});

// Almacenamiento para archivos descargables (PDF)
const almacenamiento_archivos = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!fs.existsSync(DIR_ARCHIVOS)) fs.mkdirSync(DIR_ARCHIVOS, { recursive: true });
      cb(null, DIR_ARCHIVOS);
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
      const ext = path.extname(file.originalname).toLowerCase();
      const unico = Date.now();
      cb(null, `${nombre_original}_${unico}${ext}`);
    } catch (e) {
      cb(null, `archivo_${Date.now()}${path.extname(file.originalname).toLowerCase() || '.pdf'}`);
    }
  }
});

const subir_imagen = multer({
  storage: almacenamiento_banners,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!tipos_imagen.includes(ext)) {
      return cb(new Error('Tipo de imagen no permitido'));
    }
    cb(null, true);
  }
});

const subir_archivo = multer({
  storage: almacenamiento_archivos,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!tipos_pdf.includes(ext)) {
      return cb(new Error('Sólo se permite PDF'));
    }
    cb(null, true);
  }
});

// Endpoint: subir imagen del carrusel
router.post('/subir_imagen', (req, res) => {
  subir_imagen.single('file')(req, res, (err) => {
    if (err) {
      log_evento('subir_imagen_error', { ip: req.ip, origin: req.headers.origin || null, error: err.message });
      return res.status(400).json({ exito: false, error: err.message });
    }
    try {
      const nombre_archivo = req.file?.filename;
      if (!nombre_archivo) {
        log_evento('subir_imagen_sin_archivo', { ip: req.ip, origin: req.headers.origin || null });
        return res.status(400).json({ exito: false, error: 'No se recibió archivo' });
      }
      const ruta_publica = `/archivos/carrusel/banners/${nombre_archivo}`;
      log_evento('subir_imagen_ok', { ip: req.ip, origin: req.headers.origin || null, ruta_publica });
      return res.json({ exito: true, ruta_publica, nombre_archivo });
    } catch (e) {
      log_evento('subir_imagen_exception', { ip: req.ip, origin: req.headers.origin || null, error: e.message });
      return res.status(500).json({ exito: false, error: 'Error interno del servidor' });
    }
  });
});

// Endpoint: subir archivo descargable (PDF)
  router.post('/subir_archivo', (req, res) => {
    subir_archivo.single('file')(req, res, (err) => {
      if (err) {
        log_evento('subir_pdf_error', { ip: req.ip, origin: req.headers.origin || null, error: err.message });
        return res.status(400).json({ exito: false, error: err.message });
      }
      try {
        const archivo = req.file || (Array.isArray(req.files) && req.files.length > 0 ? req.files[0] : null);
        const nombre_archivo = archivo?.filename;
        if (!nombre_archivo) {
          log_evento('subir_pdf_sin_archivo', { ip: req.ip, origin: req.headers.origin || null });
          return res.status(400).json({ exito: false, error: 'No se recibió archivo' });
        }
        const ruta_publica = `/archivos/carrusel/archivos/${nombre_archivo}`;
        log_evento('subir_pdf_ok', { ip: req.ip, origin: req.headers.origin || null, ruta_publica });
        // Si se envía id_banner, actualizar el registro inmediatamente
        const idb_raw = req.body?.id_banner || req.query?.id_banner;
        const id_banner = Number(idb_raw);
        if (id_banner && !Number.isNaN(id_banner)) {
          (async () => {
            try {
              const anterior = await obtener_banner_por_id(id_banner);
              if (anterior) {
                const actualizado = await actualizar_banner(id_banner, {
                  titulo: anterior.titulo,
                  descripcion: anterior.descripcion,
                  url_imagen: anterior.url_imagen,
                  url_pdf: ruta_publica,
                  mostrar_indefinido: anterior.mostrar_indefinido,
                  fecha_inicio: anterior.fecha_inicio,
                  fecha_fin: anterior.fecha_fin,
                  activo: anterior.activo,
                  prioridad: anterior.prioridad,
                });
                // Borrar PDF anterior si cambió
                if (anterior?.url_pdf && anterior.url_pdf !== ruta_publica) {
                  eliminar_archivo_si_existe(anterior.url_pdf);
                }
                log_evento('subir_pdf_actualizado_banner_ok', { id_banner });
                try { return res.json({ exito: true, ruta_publica, nombre_archivo, banner: actualizado }); } catch (_) {}
              }
            } catch (e) {
              log_evento('subir_pdf_actualizar_banner_error', { id_banner, error: e.message });
              try { return res.json({ exito: true, ruta_publica, nombre_archivo }); } catch (_) {}
            }
          })();
          return; // respuesta se envía dentro de la IIFE
        }
        return res.json({ exito: true, ruta_publica, nombre_archivo });
      } catch (e) {
        log_evento('subir_pdf_exception', { ip: req.ip, origin: req.headers.origin || null, error: e.message });
        return res.status(500).json({ exito: false, error: 'Error interno del servidor' });
      }
    });
  });

// ======================================
// API de configuración del carrusel (CRUD)
// ======================================

// Público: listado de banners visibles
router.get('/publico/banners', async (req, res) => {
  try {
    const lista = await listar_banners_publicos();
    return res.json({ exito: true, banners: lista });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'Error obteniendo banners públicos', detalle: error.message });
  }
});

// Administración: listado completo
router.get('/banners', authFlexible, async (req, res) => {
  try {
    const lista = await listar_banners();
    return res.json({ exito: true, banners: lista });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'Error obteniendo banners', detalle: error.message });
  }
});

// Crear banner
router.post('/banners', authFlexible, async (req, res) => {
  try {
    log_evento('crear_banner_intento', { ip: req.ip, origin: req.headers.origin || null, tiene_usuario: !!req.user, body_keys: Object.keys(req.body || {}) });
    const b = req.body || {};
    const to_rel = (u) => {
      try {
        const s = String(u || '').trim();
        if (!s) return null;
        if (/^https?:\/\//.test(s)) {
          try { return new URL(s).pathname || null; } catch (_) { return s; }
        }
        return s.startsWith('/') ? s : `/${s}`;
      } catch (_) { return null; }
    };
    b.url_imagen = to_rel(b.url_imagen);
    b.url_pdf = to_rel(b.url_pdf);
    if (!b.titulo || !b.url_imagen) {
      return res.status(400).json({ exito: false, error: 'Título y URL de imagen son requeridos' });
    }
    const creado = await crear_banner(b, req.user?.id_usuario || null);
    log_evento('crear_banner_ok', { id_banner: creado?.id_banner || null });
    return res.json({ exito: true, banner: creado });
  } catch (error) {
    log_evento('crear_banner_error', { error: error.message });
    return res.status(500).json({ exito: false, error: 'Error creando banner', detalle: error.message });
  }
});

// Actualizar banner
router.put('/banners/:id_banner', authFlexible, async (req, res) => {
  try {
    log_evento('actualizar_banner_intento', { ip: req.ip, origin: req.headers.origin || null, tiene_usuario: !!req.user, id_banner: req.params.id_banner });
    const id_banner = Number(req.params.id_banner);
    if (!id_banner || Number.isNaN(id_banner)) {
      return res.status(400).json({ exito: false, error: 'id_banner inválido' });
    }
    const b = req.body || {};
    const to_rel = (u) => {
      try {
        const s = String(u || '').trim();
        if (!s) return null;
        if (/^https?:\/\//.test(s)) {
          try { return new URL(s).pathname || null; } catch (_) { return s; }
        }
        return s.startsWith('/') ? s : `/${s}`;
      } catch (_) { return null; }
    };
    b.url_imagen = to_rel(b.url_imagen);
    b.url_pdf = to_rel(b.url_pdf);
    // Obtener datos anteriores para decidir borrado de archivos
    const anterior = await obtener_banner_por_id(id_banner);
    const actualizado = await actualizar_banner(id_banner, b);
    // Si cambió la imagen, borrar la anterior
    if (anterior?.url_imagen && actualizado?.url_imagen && anterior.url_imagen !== actualizado.url_imagen) {
      eliminar_archivo_si_existe(anterior.url_imagen);
    }
    // Si cambió el PDF, borrar el anterior
    if (anterior?.url_pdf && actualizado?.url_pdf && anterior.url_pdf !== actualizado.url_pdf) {
      eliminar_archivo_si_existe(anterior.url_pdf);
    }
    log_evento('actualizar_banner_ok', { id_banner });
    return res.json({ exito: true, banner: actualizado });
  } catch (error) {
    log_evento('actualizar_banner_error', { error: error.message });
    return res.status(500).json({ exito: false, error: 'Error actualizando banner', detalle: error.message });
  }
});

// Eliminar banner
router.delete('/banners/:id_banner', authFlexible, async (req, res) => {
  try {
    log_evento('eliminar_banner_intento', { ip: req.ip, origin: req.headers.origin || null, tiene_usuario: !!req.user, id_banner: req.params.id_banner });
    const id_banner = Number(req.params.id_banner);
    if (!id_banner || Number.isNaN(id_banner)) {
      return res.status(400).json({ exito: false, error: 'id_banner inválido' });
    }
    // Recuperar archivos asociados antes de borrar el registro
    const anterior = await obtener_banner_por_id(id_banner);
    await eliminar_banner(id_banner);
    // Borrar archivos físicos asociados si existen
    if (anterior?.url_imagen) eliminar_archivo_si_existe(anterior.url_imagen);
    if (anterior?.url_pdf) eliminar_archivo_si_existe(anterior.url_pdf);
    log_evento('eliminar_banner_ok', { id_banner });
    return res.json({ exito: true });
  } catch (error) {
    log_evento('eliminar_banner_error', { error: error.message });
    return res.status(500).json({ exito: false, error: 'Error eliminando banner', detalle: error.message });
  }
});

// Reordenar prioridades
router.patch('/banners/reordenar', authFlexible, async (req, res) => {
  try {
    log_evento('reordenar_intento', { ip: req.ip, origin: req.headers.origin || null, tiene_usuario: !!req.user });
    const ids_en_orden = Array.isArray(req.body?.ids_en_orden) ? req.body.ids_en_orden.map(Number) : [];
    if (!ids_en_orden.length || ids_en_orden.some(n => Number.isNaN(n))) {
      return res.status(400).json({ exito: false, error: 'ids_en_orden inválido' });
    }
    await reordenar_prioridades(ids_en_orden);
    const lista = await listar_banners();
    log_evento('reordenar_ok', { cantidad: lista.length });
    return res.json({ exito: true, banners: lista });
  } catch (error) {
    log_evento('reordenar_error', { error: error.message });
    return res.status(500).json({ exito: false, error: 'Error reordenando prioridades', detalle: error.message });
  }
});

router.get('/diagnostico', authFlexible, async (req, res) => {
  const resultado = { pasos: {} };
  try {
    resultado.pasos.origen = { origin: req.headers.origin || null, ip: req.ip };
    // Probar escritura en banners
    const prueba_banner = path.join(DIR_BANNERS, `__prueba_${Date.now()}.tmp`);
    fs.writeFileSync(prueba_banner, 'ok');
    fs.unlinkSync(prueba_banner);
    resultado.pasos.escritura_banners = 'ok';
  } catch (e) {
    resultado.pasos.escritura_banners = `error:${e.message}`;
  }
  try {
    // Probar escritura en archivos
    const prueba_archivo = path.join(DIR_ARCHIVOS, `__prueba_${Date.now()}.tmp`);
    fs.writeFileSync(prueba_archivo, 'ok');
    fs.unlinkSync(prueba_archivo);
    resultado.pasos.escritura_archivos = 'ok';
  } catch (e) {
    resultado.pasos.escritura_archivos = `error:${e.message}`;
  }
  try {
    const r = await consultar('SELECT 1 AS uno');
    resultado.pasos.db = r.rows?.[0]?.uno === 1 ? 'ok' : 'resultado_inesperado';
  } catch (e) {
    resultado.pasos.db = `error:${e.message}`;
  }
  try {
    res.json({ exito: true, resultado });
  } catch (e) {
    res.status(500).json({ exito: false, error: 'diagnostico_error', detalle: e.message, resultado });
  }
});

module.exports = router;
