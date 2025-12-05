// Rutas de notificaciones_eventos
const express = require('express');
const router = express.Router();
const { consultar } = require('../configuracion/base_datos');
const rateLimit = require('express-rate-limit');

router.get('/api/notificaciones_eventos', async (req, res) => {
  const rol = (req.query.rol || '').toLowerCase();
  try {
    const q = `
      SELECT 
        id_evento AS id_notificacion,
        tipo,
        titulo,
        mensaje,
        marca_temporal,
        leido,
        rol_destinatario,
        ruta_sugerida,
        datos,
        prioridad
      FROM notificaciones_eventos
      WHERE ($1 = '' OR LOWER(COALESCE(rol_destinatario,'')) = $1 OR rol_destinatario IS NULL)
        AND NOT (
          COALESCE(datos->>'es_evento_sistema','') IN ('registro_usuario','olvido_contrasena')
          AND NOT (datos ? 'version')
        )
      ORDER BY marca_temporal DESC
    `;
    const { rows } = await consultar(q, [rol]);
    res.json({ notificaciones: rows });
  } catch (e) {
    if (String(e?.code) === '42P01') {
      return res.json({ notificaciones: [] });
    }
    res.status(500).json({ error: 'error_listar_eventos' });
  }
});

router.post('/api/notificaciones_eventos', async (req, res) => {
  const { tipo, titulo, mensaje, rol_destinatario, ruta_sugerida, datos, prioridad } = req.body || {};
  try {
    const q = `
      INSERT INTO notificaciones_eventos(tipo, titulo, mensaje, rol_destinatario, ruta_sugerida, datos, prioridad)
      VALUES($1,$2,$3,$4,$5,$6,$7)
      RETURNING id_evento AS id_notificacion, tipo, titulo, mensaje, marca_temporal, leido, rol_destinatario, ruta_sugerida, datos, prioridad
    `;
    const vals = [tipo, titulo || null, mensaje || null, rol_destinatario || null, ruta_sugerida || null, datos || null, prioridad || 'media'];
    const { rows } = await consultar(q, vals);
    res.status(201).json({ notificacion: rows[0] });
  } catch (e) {
    if (String(e?.code) === '42P01') {
      return res.status(503).json({ error: 'tabla_no_disponible' });
    }
    res.status(500).json({ error: 'error_crear_evento' });
  }
});

router.patch('/api/notificaciones_eventos/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { leido } = req.body || {};
  try {
    const { rowCount } = await consultar('UPDATE notificaciones_eventos SET leido = COALESCE($2, leido) WHERE id_evento = $1', [id, leido]);
    if (rowCount === 0) return res.status(404).json({ error: 'no_encontrado' });
    res.json({ ok: true });
  } catch (e) {
    if (String(e?.code) === '42P01') {
      return res.status(503).json({ error: 'tabla_no_disponible' });
    }
    res.status(500).json({ error: 'error_actualizar_evento' });
  }
});

router.post('/api/notificaciones_eventos/marcar_todas_como_leidas', async (req, res) => {
  const { rol } = req.body || {};
  try {
    await consultar("UPDATE notificaciones_eventos SET leido = TRUE WHERE LOWER(COALESCE(rol_destinatario,'')) = LOWER($1)", [rol || '']);
    res.json({ ok: true });
  } catch (e) {
    if (String(e?.code) === '42P01') {
      return res.status(503).json({ error: 'tabla_no_disponible' });
    }
    res.status(500).json({ error: 'error_marcar_todas' });
  }
});

router.delete('/api/notificaciones_eventos/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const { rowCount } = await consultar('DELETE FROM notificaciones_eventos WHERE id_evento = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'no_encontrado' });
    res.json({ ok: true });
  } catch (e) {
    if (String(e?.code) === '42P01') {
      return res.status(503).json({ error: 'tabla_no_disponible' });
    }
    res.status(500).json({ error: 'error_eliminar_evento' });
  }
});

module.exports = router;

// Ruta de sistema para inicio de sesión sin autenticación (mantener consistencia)
const sistemaInicioSesionLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });
router.post('/api/notificaciones_eventos/sistema/inicio_sesion', sistemaInicioSesionLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const esEvento = body?.datos?.es_evento_sistema === 'inicio_sesion';
    if (!esEvento) return res.status(400).json({ exito: false, error: 'Evento de sistema inválido' });
    const q = `
      INSERT INTO notificaciones_eventos(tipo, titulo, mensaje, rol_destinatario, ruta_sugerida, datos, prioridad)
      VALUES($1,$2,$3,NULL,$4,$5,$6)
      RETURNING id_evento AS id_notificacion, tipo, titulo, mensaje, marca_temporal, leido, rol_destinatario, ruta_sugerida, datos, prioridad
    `;
    const vals = [body.tipo || 'informacion', body.titulo || 'Notificación', body.mensaje || '', body.ruta_sugerida || 'inicio', body.datos || {}, body.prioridad || 'media'];
    const { rows } = await consultar(q, vals);
    res.json({ exito: true, notificacion: rows[0] });
  } catch (error) {
    res.status(500).json({ exito: false, error: 'Error creando notificación (sistema)' });
  }
});
