const { consultar } = require('../configuracion/base_datos');

const asegurar_tabla_normatividad = async () => {
  await consultar(`
    CREATE TABLE IF NOT EXISTS normatividad (
      id_documento SERIAL PRIMARY KEY,
      titulo TEXT NOT NULL,
      categoria TEXT,
      fecha_publicacion TIMESTAMPTZ,
      fecha_actualizacion TIMESTAMPTZ,
      numero_oficial TEXT,
      resumen TEXT,
      contenido TEXT,
      enlace_oficial TEXT,
      vigencia TEXT,
      ambito TEXT,
      activo BOOLEAN DEFAULT TRUE,
      fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
      fecha_actualizacion_registro TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await consultar("ALTER TABLE IF EXISTS normatividad ADD COLUMN IF NOT EXISTS categoria TEXT");
  await consultar("ALTER TABLE IF EXISTS normatividad ADD COLUMN IF NOT EXISTS fecha_publicacion TIMESTAMPTZ");
  await consultar("ALTER TABLE IF EXISTS normatividad ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMPTZ");
  await consultar("ALTER TABLE IF EXISTS normatividad ADD COLUMN IF NOT EXISTS numero_oficial TEXT");
  await consultar("ALTER TABLE IF EXISTS normatividad ADD COLUMN IF NOT EXISTS resumen TEXT");
  await consultar("ALTER TABLE IF EXISTS normatividad ADD COLUMN IF NOT EXISTS contenido TEXT");
  await consultar("ALTER TABLE IF EXISTS normatividad ADD COLUMN IF NOT EXISTS enlace_oficial TEXT");
  await consultar("ALTER TABLE IF EXISTS normatividad ADD COLUMN IF NOT EXISTS vigencia TEXT");
  await consultar("ALTER TABLE IF EXISTS normatividad ADD COLUMN IF NOT EXISTS ambito TEXT");
  await consultar("ALTER TABLE IF EXISTS normatividad ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE");
  await consultar("ALTER TABLE IF EXISTS normatividad ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMPTZ DEFAULT NOW()");
  await consultar("ALTER TABLE IF EXISTS normatividad ADD COLUMN IF NOT EXISTS fecha_actualizacion_registro TIMESTAMPTZ DEFAULT NOW()");
  await consultar("ALTER TABLE IF EXISTS normatividad ADD COLUMN IF NOT EXISTS documento_url TEXT");
  await consultar("ALTER TABLE IF EXISTS normatividad ADD COLUMN IF NOT EXISTS documento_nombre TEXT");
  await consultar("ALTER TABLE IF EXISTS normatividad ADD COLUMN IF NOT EXISTS documento_tipo TEXT");
  await consultar("ALTER TABLE IF EXISTS normatividad ADD COLUMN IF NOT EXISTS tamano_documento INTEGER");
  await consultar(`CREATE INDEX IF NOT EXISTS idx_norma_activo ON normatividad(activo)`);
  await consultar(`CREATE INDEX IF NOT EXISTS idx_norma_fecha ON normatividad(fecha_publicacion)`);
  try { await consultar("ALTER TABLE IF EXISTS normatividad ALTER COLUMN categoria TYPE TEXT USING categoria::text"); } catch (e) {}
  try { await consultar("ALTER TABLE IF EXISTS normatividad ALTER COLUMN fecha_publicacion TYPE TIMESTAMPTZ USING NULLIF(fecha_publicacion::text,'')::timestamptz"); } catch (e) {}
  try { await consultar("ALTER TABLE IF EXISTS normatividad ALTER COLUMN fecha_actualizacion TYPE TIMESTAMPTZ USING NULLIF(fecha_actualizacion::text,'')::timestamptz"); } catch (e) {}
  try { await consultar("ALTER TABLE IF EXISTS normatividad ALTER COLUMN tamano_documento TYPE INTEGER USING NULLIF(tamano_documento::text,'')::integer"); } catch (e) {}
  try { await consultar("ALTER TABLE IF EXISTS normatividad ALTER COLUMN activo TYPE BOOLEAN USING CASE WHEN activo::text IN ('true','false') THEN (activo::text='true') ELSE activo::boolean END"); } catch (e) {}
};

const listar_documentos = async () => {
  const res = await consultar(
    `SELECT * FROM normatividad ORDER BY fecha_publicacion DESC NULLS LAST, id_documento DESC`
  );
  return res.rows || [];
};

const listar_documentos_publicos = async () => {
  const res = await consultar(
    `SELECT id_documento, titulo, categoria, fecha_publicacion, fecha_actualizacion, numero_oficial,
            resumen, contenido, enlace_oficial, vigencia, ambito,
            documento_url, documento_nombre, documento_tipo, tamano_documento
     FROM normatividad
     WHERE activo = TRUE
     ORDER BY fecha_publicacion DESC NULLS LAST, id_documento DESC`
  );
  return res.rows || [];
};

const crear_documento = async (d) => {
  const fp = d.fecha_publicacion && String(d.fecha_publicacion).trim() ? d.fecha_publicacion : null;
  const fa = d.fecha_actualizacion && String(d.fecha_actualizacion).trim() ? d.fecha_actualizacion : null;
  const res = await consultar(
    `INSERT INTO normatividad (titulo, categoria, fecha_publicacion, fecha_actualizacion, numero_oficial, resumen, contenido, enlace_oficial, vigencia, ambito, documento_url, documento_nombre, documento_tipo, tamano_documento, activo)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,COALESCE($15, TRUE))
     RETURNING *`,
    [d.titulo, d.categoria, fp, fa, d.numero_oficial, d.resumen, d.contenido, d.enlace_oficial, d.vigencia, d.ambito, d.documento_url, d.documento_nombre, d.documento_tipo, d.tamano_documento, d.activo]
  );
  return res.rows?.[0] || null;
};

const actualizar_documento = async (id, d) => {
  const fp = d.fecha_publicacion && String(d.fecha_publicacion).trim() ? d.fecha_publicacion : null;
  const fa = d.fecha_actualizacion && String(d.fecha_actualizacion).trim() ? d.fecha_actualizacion : null;
  const res = await consultar(
    `UPDATE normatividad SET
       titulo = COALESCE($2, titulo),
       categoria = COALESCE($3, categoria),
       fecha_publicacion = COALESCE($4::timestamptz, fecha_publicacion),
       fecha_actualizacion = COALESCE($5::timestamptz, fecha_actualizacion),
       numero_oficial = COALESCE($6, numero_oficial),
       resumen = COALESCE($7, resumen),
       contenido = COALESCE($8, contenido),
       enlace_oficial = COALESCE($9, enlace_oficial),
       vigencia = COALESCE($10, vigencia),
       ambito = COALESCE($11, ambito),
       documento_url = COALESCE($12, documento_url),
       documento_nombre = COALESCE($13, documento_nombre),
       documento_tipo = COALESCE($14, documento_tipo),
       tamano_documento = COALESCE($15::integer, tamano_documento),
       activo = COALESCE($16::boolean, activo),
       fecha_actualizacion_registro = NOW()
     WHERE id_documento = $1
     RETURNING *`,
    [id, d.titulo, d.categoria, fp, fa, d.numero_oficial, d.resumen, d.contenido, d.enlace_oficial, d.vigencia, d.ambito, d.documento_url, d.documento_nombre, d.documento_tipo, d.tamano_documento, d.activo]
  );
  return res.rows?.[0] || null;
};

const eliminar_documento = async (id) => {
  await consultar(`DELETE FROM normatividad WHERE id_documento = $1`, [id]);
  return true;
};

module.exports = {
  asegurar_tabla_normatividad,
  listar_documentos,
  listar_documentos_publicos,
  crear_documento,
  actualizar_documento,
  eliminar_documento
};
