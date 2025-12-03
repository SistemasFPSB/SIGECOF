const { consultar, obtener_cliente } = require('../configuracion/base_datos');

const asegurar_tabla_permisos_roles = async () => {
  await consultar(`
    CREATE TABLE IF NOT EXISTS permisos_roles (
      rol VARCHAR(50) NOT NULL,
      alias VARCHAR(50) NOT NULL,
      id_seccion VARCHAR(100) NOT NULL,
      creado_en TIMESTAMP DEFAULT NOW(),
      actualizado_en TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (rol, id_seccion)
    )
  `);
};

const listar_permisos_por_rol = async () => {
  const res = await consultar('SELECT rol, alias, id_seccion FROM permisos_roles');
  const map = {};
  for (const row of res.rows) {
    if (!map[row.rol]) map[row.rol] = [];
    map[row.rol].push(row.id_seccion);
  }
  return map;
};

const obtener_permisos_de_rol = async (rol) => {
  const res = await consultar('SELECT id_seccion FROM permisos_roles WHERE rol = $1 ORDER BY id_seccion', [rol]);
  return res.rows.map(r => r.id_seccion);
};

const reemplazar_permisos_de_rol = async (rol, permisos = [], alias_visible = null) => {
  const client = await obtener_cliente();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM permisos_roles WHERE rol = $1', [rol]);
    const alias_final = (typeof alias_visible === 'string' && alias_visible.trim()) ? String(alias_visible).trim() : rol;
    for (const id of permisos) {
      await client.query('INSERT INTO permisos_roles(rol, alias, id_seccion) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [rol, alias_final, id]);
    }
    if (typeof alias_visible === 'string' && alias_visible.trim()) {
      await client.query('UPDATE permisos_roles SET alias = $2 WHERE rol = $1', [rol, alias_final]);
    }
    await client.query('COMMIT');
    return true;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    client.release();
  }
};

const actualizar_alias_de_rol = async (rol, alias) => {
  const rol_norm = String(rol || '').trim().toLowerCase();
  const alias_norm = String(alias || '').trim();
  if (!rol_norm || !alias_norm) return false;
  const existe = await consultar('SELECT COUNT(*) AS total FROM permisos_roles WHERE rol = $1', [rol_norm]);
  const total = Number(existe.rows?.[0]?.total || 0);
  if (total === 0) {
    try { await consultar('INSERT INTO permisos_roles(rol, alias, id_seccion) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [rol_norm, alias_norm, 'inicio']); } catch (_) {}
  }
  const rUpd = await consultar('UPDATE permisos_roles SET alias = $2, actualizado_en = NOW() WHERE rol = $1', [rol_norm, alias_norm]);
  return (rUpd.rowCount || 0) > 0;
};

module.exports = {
  asegurar_tabla_permisos_roles,
  listar_permisos_por_rol,
  obtener_permisos_de_rol,
  reemplazar_permisos_de_rol,
  actualizar_alias_de_rol,
};