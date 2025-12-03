// Rutas de notificaciones_configuracion
const express = require('express');
const router = express.Router();
const { consultar } = require('../configuracion/base_datos');

router.get('/api/notificaciones_configuracion', async (_req, res) => {
  try {
    const q = `
      SELECT id, activo, titulo_regla, mensaje, trigger_id, tipo, prioridad, rol_origen, seccion_accion, roles_destino, ruta_sugerida
      FROM notificaciones_configuracion
      ORDER BY id DESC
    `;
    const { rows } = await consultar(q);
    res.json({ reglas: rows });
  } catch (e) {
    res.status(500).json({ error: 'error_listar_config' });
  }
});

router.post('/api/notificaciones_configuracion', async (req, res) => {
  const { activo, titulo_regla, mensaje, trigger_id, tipo, prioridad, rol_origen, seccion_accion, roles_destino, ruta_sugerida } = req.body || {};
  try {
    const q = `
      INSERT INTO notificaciones_configuracion(activo, titulo_regla, mensaje, trigger_id, tipo, prioridad, rol_origen, seccion_accion, roles_destino, ruta_sugerida)
      VALUES(COALESCE($1, TRUE), $2, $3, $4, $5, COALESCE($6,'media'), $7, $8, COALESCE($9, ARRAY[]::text[]), $10)
      RETURNING id, activo, titulo_regla, mensaje, trigger_id, tipo, prioridad, rol_origen, seccion_accion, roles_destino, ruta_sugerida
    `;
    const vals = [activo, titulo_regla, mensaje, trigger_id, tipo, prioridad, rol_origen, seccion_accion, roles_destino, ruta_sugerida];
    const { rows } = await consultar(q, vals);
    res.status(201).json({ regla: rows[0] });
  } catch (e) {
    res.status(500).json({ error: 'error_crear_regla' });
  }
});

router.put('/api/notificaciones_configuracion/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { activo, titulo_regla, mensaje, trigger_id, tipo, prioridad, rol_origen, seccion_accion, roles_destino, ruta_sugerida } = req.body || {};
  try {
    const q = `
      UPDATE notificaciones_configuracion
      SET activo = COALESCE($2, activo),
          titulo_regla = COALESCE($3, titulo_regla),
          mensaje = COALESCE($4, mensaje),
          trigger_id = COALESCE($5, trigger_id),
          tipo = COALESCE($6, tipo),
          prioridad = COALESCE($7, prioridad),
          rol_origen = COALESCE($8, rol_origen),
          seccion_accion = COALESCE($9, seccion_accion),
          roles_destino = COALESCE($10, roles_destino),
          ruta_sugerida = COALESCE($11, ruta_sugerida)
      WHERE id = $1
    `;
    const vals = [id, activo, titulo_regla, mensaje, trigger_id, tipo, prioridad, rol_origen, seccion_accion, roles_destino, ruta_sugerida];
    const { rowCount } = await consultar(q, vals);
    if (rowCount === 0) return res.status(404).json({ error: 'no_encontrado' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'error_actualizar_regla' });
  }
});

router.delete('/api/notificaciones_configuracion/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    const { rowCount } = await consultar('DELETE FROM notificaciones_configuracion WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'no_encontrado' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'error_eliminar_regla' });
  }
});

// Migración: actualizar seccion_accion y trigger_id para 'registro_nuevo' desde 'perfil' a 'pantalla_inicial'
router.post('/api/notificaciones_configuracion/migrar_registro_nuevo', async (_req, res) => {
  try {
    const q1 = `
      UPDATE notificaciones_configuracion
      SET seccion_accion = 'pantalla_inicial:registro_nuevo'
      WHERE LOWER(TRIM(seccion_accion)) = 'perfil:registro_nuevo'
    `;
    const r1 = await consultar(q1);
    const q2 = `
      UPDATE notificaciones_configuracion
      SET trigger_id = 'pantalla_inicial_registro_nuevo'
      WHERE LOWER(TRIM(trigger_id)) = 'perfil_registro_nuevo'
    `;
    const r2 = await consultar(q2);
    res.json({ ok: true, actualizados: { seccion_accion: r1.rowCount || 0, trigger_id: r2.rowCount || 0 } });
  } catch (e) {
    res.status(500).json({ error: 'error_migrar_reglas' });
  }
});

module.exports = router;
