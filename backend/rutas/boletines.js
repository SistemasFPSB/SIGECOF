const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { consultar } = require('../configuracion/base_datos');
// Permitir acceso a cualquier usuario autenticado; se elimina restricción de rol
const { listar_boletines, listar_boletines_publicos, crear_boletin, actualizar_boletin, eliminar_boletin } = require('../modelos/boletines');

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
    const lista = await listar_boletines_publicos();
    return res.json({ exito: true, boletines: lista });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'Error obteniendo boletines públicos' });
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const lista = await listar_boletines();
    return res.json({ exito: true, boletines: lista });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'Error obteniendo boletines' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const creado = await crear_boletin(req.body || {});
    return res.json({ exito: true, boletin: creado });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'Error creando boletín' });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
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
    const prev = await consultar('SELECT archivo_url FROM boletines WHERE id_boletin = $1 LIMIT 1', [id]).then(r => r.rows?.[0] || null);
    const actualizado = await actualizar_boletin(id, req.body || {});
    if (prev?.archivo_url && actualizado?.archivo_url && prev.archivo_url !== actualizado.archivo_url) {
      eliminar_archivo_si_existe(prev.archivo_url);
    }
    return res.json({ exito: true, boletin: actualizado });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'Error actualizando boletín' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
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
    const prev = await consultar('SELECT archivo_url FROM boletines WHERE id_boletin = $1 LIMIT 1', [id]).then(r => r.rows?.[0] || null);
    await eliminar_boletin(id);
    if (prev?.archivo_url) eliminar_archivo_si_existe(prev.archivo_url);
    return res.json({ exito: true });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'Error eliminando boletín' });
  }
});

module.exports = router;
