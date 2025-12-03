const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { consultar } = require('../configuracion/base_datos');
// Permitir acceso a cualquier usuario autenticado; se elimina restricción de rol
const { listar_documentos, listar_documentos_publicos, crear_documento, actualizar_documento, eliminar_documento, asegurar_tabla_normatividad } = require('../modelos/normatividad');

const router = express.Router();

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
  try {
    const secret = process.env.JWT_SECRET || 'sigecof-dev-secret';
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

router.get('/publico/documentos', async (req, res) => {
  try {
    const lista = await listar_documentos_publicos();
    return res.json({ exito: true, documentos: lista });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'Error obteniendo documentos públicos' });
  }
});

router.get('/documentos', authMiddleware, async (req, res) => {
  try {
    const lista = await listar_documentos();
    return res.json({ exito: true, documentos: lista });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'Error obteniendo documentos' });
  }
});

router.post('/documentos', authMiddleware, async (req, res) => {
  try {
    const creado = await crear_documento(req.body || {});
    return res.json({ exito: true, documento: creado });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'Error creando documento' });
  }
});

router.put('/documentos/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ exito: false, error: 'id inválido' });
    try { await asegurar_tabla_normatividad(); } catch (_) {}
    const DIR_PUBLIC = path.resolve(__dirname, '..', '..', 'public');
    const DIR_UPLOADS = path.resolve(__dirname, '..', 'archivos');
    const eliminar_archivo_si_existe = (url_publica) => {
      try {
        if (!url_publica || typeof url_publica !== 'string') return;
        let ruta_rel = String(url_publica).trim();
        if (/^https?:\/\//.test(ruta_rel)) {
          try { ruta_rel = new URL(ruta_rel).pathname || ruta_rel; } catch (_) {}
        }
        let limpia = ruta_rel.replace(/^\//, '');
        limpia = limpia.replace(/^archivos\//, '');
        const absoluta = path.join(DIR_UPLOADS, limpia);
        if (!absoluta.startsWith(DIR_UPLOADS + path.sep)) return;
        if (fs.existsSync(absoluta)) {
          fs.unlinkSync(absoluta);
        }
      } catch (_) {}
    };
    const prev = await consultar('SELECT documento_url FROM normatividad WHERE id_documento = $1 LIMIT 1', [id]).then(r => r.rows?.[0] || null);
    const actualizado = await actualizar_documento(id, req.body || {});
    if (prev?.documento_url && actualizado?.documento_url && prev.documento_url !== actualizado.documento_url) {
      eliminar_archivo_si_existe(prev.documento_url);
    }
    return res.json({ exito: true, documento: actualizado });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'Error actualizando documento' });
  }
});

router.delete('/documentos/:id', authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) return res.status(400).json({ exito: false, error: 'id inválido' });
    const DIR_UPLOADS = path.resolve(__dirname, '..', 'archivos');
    const eliminar_archivo_si_existe = (url_publica) => {
      try {
        if (!url_publica || typeof url_publica !== 'string') return;
        let ruta_rel = String(url_publica).trim();
        if (/^https?:\/\//.test(ruta_rel)) {
          try { ruta_rel = new URL(ruta_rel).pathname || ruta_rel; } catch (_) {}
        }
        let limpia = ruta_rel.replace(/^\//, '');
        limpia = limpia.replace(/^archivos\//, '');
        const absoluta = path.join(DIR_UPLOADS, limpia);
        if (!absoluta.startsWith(DIR_UPLOADS + path.sep)) return;
        if (fs.existsSync(absoluta)) {
          fs.unlinkSync(absoluta);
        }
      } catch (_) {}
    };
    const prev = await consultar('SELECT documento_url FROM normatividad WHERE id_documento = $1 LIMIT 1', [id]).then(r => r.rows?.[0] || null);
    await eliminar_documento(id);
    if (prev?.documento_url) eliminar_archivo_si_existe(prev.documento_url);
    return res.json({ exito: true });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'Error eliminando documento' });
  }
});

// Endpoint de desarrollo para asegurar la tabla y columnas de Normatividad
if ((process.env.NODE_ENV || 'development') === 'development') {
  router.post('/dev/asegurar_tabla', authMiddleware, async (req, res) => {
    try {
      await asegurar_tabla_normatividad();
      return res.json({ exito: true });
    } catch (error) {
      return res.status(500).json({ exito: false, error: 'Error asegurando tabla de normatividad' });
    }
  });
}

module.exports = router;
