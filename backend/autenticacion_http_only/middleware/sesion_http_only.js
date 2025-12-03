import crypto from 'crypto';

export const crear_sesion = async (pool, usuario, persistente = false) => {
  const sid = crypto.randomBytes(24).toString('hex');
  const ttlMs = persistente ? (1000 * 60 * 60 * 24 * 7) : (1000 * 60 * 60);
  const exp = new Date(Date.now() + ttlMs).toISOString();
  await pool.query(
    'INSERT INTO sesiones (sid, id_usuario, rol, expira_en) VALUES ($1, $2, $3, $4)',
    [sid, usuario.id_usuario, usuario.rol, exp]
  );
  return sid;
};

export const validar_sesion = async (pool, sid) => {
  if (!sid) return null;
  const r = await pool.query('SELECT id_usuario, rol, expira_en FROM sesiones WHERE sid=$1 LIMIT 1', [sid]);
  if (r.rowCount === 0) return null;
  const s = r.rows[0];
  if (new Date(s.expira_en).getTime() < Date.now()) return null;
  return { id_usuario: s.id_usuario, rol: s.rol };
};

export const eliminar_sesion = async (pool, sid) => {
  if (!sid) return;
  await pool.query('DELETE FROM sesiones WHERE sid=$1', [sid]);
};

export const renovar_sesion = async (pool, sid) => {
  if (!sid) return null;
  const nuevaExp = new Date(Date.now() + 1000 * 60 * 30).toISOString();
  const r = await pool.query('UPDATE sesiones SET expira_en = GREATEST(expira_en, $1) WHERE sid=$2 RETURNING id_usuario, rol, expira_en', [nuevaExp, sid]);
  if (r.rowCount === 0) return null;
  return { id_usuario: r.rows[0].id_usuario, rol: r.rows[0].rol, expira_en: r.rows[0].expira_en };
};
