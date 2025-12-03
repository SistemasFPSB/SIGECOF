const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { consultar } = require('../configuracion/base_datos');
// Permitir acceso a cualquier usuario autenticado; se elimina restricción de rol
const { listar_comunicados_publicos, listar_comunicados, crear_comunicado, actualizar_comunicado, eliminar_comunicado, asegurar_tabla_comunicados } = require('../modelos/comunicados');

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

router.get('/publico/publicaciones', async (req, res) => {
  try {
    const lista = await listar_comunicados_publicos();
    return res.json({ exito: true, comunicados: lista });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'Error obteniendo comunicados públicos' });
  }
});

router.get('/publicaciones', authMiddleware, async (req, res) => {
  try {
    const lista = await listar_comunicados();
    return res.json({ exito: true, comunicados: lista });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'Error obteniendo comunicados' });
  }
});

router.post('/publicaciones', authMiddleware, async (req, res) => {
  try {
    const creado = await crear_comunicado(req.body || {});
    return res.json({ exito: true, comunicado: creado });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'Error creando comunicado' });
  }
});

router.put('/publicaciones/:id', authMiddleware, async (req, res) => {
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
    const prev = await consultar('SELECT adjunto_url FROM comunicados WHERE id_comunicado = $1 LIMIT 1', [id]).then(r => r.rows?.[0] || null);
    const actualizado = await actualizar_comunicado(id, req.body || {});
    if (prev?.adjunto_url && actualizado?.adjunto_url && prev.adjunto_url !== actualizado.adjunto_url) {
      eliminar_archivo_si_existe(prev.adjunto_url);
    }
    return res.json({ exito: true, comunicado: actualizado });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'Error actualizando comunicado' });
  }
});

router.delete('/publicaciones/:id', authMiddleware, async (req, res) => {
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
    const prev = await consultar('SELECT adjunto_url FROM comunicados WHERE id_comunicado = $1 LIMIT 1', [id]).then(r => r.rows?.[0] || null);
    await eliminar_comunicado(id);
    if (prev?.adjunto_url) eliminar_archivo_si_existe(prev.adjunto_url);
    return res.json({ exito: true });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'Error eliminando comunicado' });
  }
});

if ((process.env.NODE_ENV || 'development') === 'development') {
  router.post('/dev/asegurar_tabla', authMiddleware, async (req, res) => {
    try {
      await asegurar_tabla_comunicados();
      return res.json({ exito: true });
    } catch (error) {
      return res.status(500).json({ exito: false, error: 'Error asegurando tabla de comunicados' });
    }
  });
}

module.exports = router;
