const { consultar } = require('../configuracion/base_datos');

const asegurar_tabla_boletines = async () => {
  await consultar(`
    CREATE TABLE IF NOT EXISTS boletines (
      id_boletin SERIAL PRIMARY KEY,
      titulo TEXT NOT NULL,
      numero_boletin TEXT,
      fecha_publicacion TIMESTAMPTZ,
      fecha_vigencia TIMESTAMPTZ,
      categoria TEXT,
      tipo TEXT,
      resumen TEXT,
      contenido TEXT,
      autor TEXT,
      archivo_url TEXT,
      archivo_nombre TEXT,
      archivo_tipo TEXT,
      tamano_archivo INTEGER,
      etiquetas TEXT,
      estado TEXT,
      activo BOOLEAN DEFAULT TRUE,
      fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
      fecha_actualizacion TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await consultar("ALTER TABLE IF EXISTS boletines ADD COLUMN IF NOT EXISTS numero_boletin TEXT");
  await consultar("ALTER TABLE IF EXISTS boletines ADD COLUMN IF NOT EXISTS fecha_publicacion TIMESTAMPTZ");
  await consultar("ALTER TABLE IF EXISTS boletines ADD COLUMN IF NOT EXISTS fecha_vigencia TIMESTAMPTZ");
  await consultar("ALTER TABLE IF EXISTS boletines ADD COLUMN IF NOT EXISTS categoria TEXT");
  await consultar("ALTER TABLE IF EXISTS boletines ADD COLUMN IF NOT EXISTS tipo TEXT");
  await consultar("ALTER TABLE IF EXISTS boletines ADD COLUMN IF NOT EXISTS resumen TEXT");
  await consultar("ALTER TABLE IF EXISTS boletines ADD COLUMN IF NOT EXISTS contenido TEXT");
  await consultar("ALTER TABLE IF EXISTS boletines ADD COLUMN IF NOT EXISTS autor TEXT");
  await consultar("ALTER TABLE IF EXISTS boletines ADD COLUMN IF NOT EXISTS archivo_url TEXT");
  await consultar("ALTER TABLE IF EXISTS boletines ADD COLUMN IF NOT EXISTS archivo_nombre TEXT");
  await consultar("ALTER TABLE IF EXISTS boletines ADD COLUMN IF NOT EXISTS archivo_tipo TEXT");
  await consultar("ALTER TABLE IF EXISTS boletines ADD COLUMN IF NOT EXISTS tamano_archivo INTEGER");
  await consultar("ALTER TABLE IF EXISTS boletines ADD COLUMN IF NOT EXISTS etiquetas TEXT");
  await consultar("ALTER TABLE IF EXISTS boletines ADD COLUMN IF NOT EXISTS estado TEXT");
  await consultar("ALTER TABLE IF EXISTS boletines ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE");
  await consultar("ALTER TABLE IF EXISTS boletines ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMPTZ DEFAULT NOW()");
  await consultar("ALTER TABLE IF EXISTS boletines ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMPTZ DEFAULT NOW()");
  await consultar(`CREATE INDEX IF NOT EXISTS idx_boletines_activo ON boletines(activo)`);
  await consultar(`CREATE INDEX IF NOT EXISTS idx_boletines_fecha ON boletines(fecha_publicacion)`);
};

const listar_boletines = async () => {
  const res = await consultar(
    `SELECT * FROM boletines ORDER BY fecha_publicacion DESC NULLS LAST, id_boletin DESC`
  );
  return res.rows || [];
};

const listar_boletines_publicos = async () => {
  const res = await consultar(
    `SELECT id_boletin, titulo, numero_boletin, fecha_publicacion AS fecha, categoria, tipo,
            resumen, contenido, archivo_url
     FROM boletines
     WHERE activo = TRUE
     ORDER BY fecha_publicacion DESC NULLS LAST, id_boletin DESC`
  );
  return res.rows || [];
};

const crear_boletin = async (b) => {
  const fp = b.fecha_publicacion && String(b.fecha_publicacion).trim() ? b.fecha_publicacion : null;
  const fv = b.fecha_vigencia && String(b.fecha_vigencia).trim() ? b.fecha_vigencia : null;
  const res = await consultar(
    `INSERT INTO boletines (titulo, numero_boletin, fecha_publicacion, fecha_vigencia, categoria, tipo, resumen, contenido, autor, archivo_url, archivo_nombre, archivo_tipo, tamano_archivo, etiquetas, estado, activo)
     VALUES ($1,$2,$3::timestamptz,$4::timestamptz,$5,$6,$7,$8,$9,$10,$11,$12,$13::integer,$14,$15,COALESCE($16::boolean, TRUE))
     RETURNING *`,
    [b.titulo, b.numero_boletin, fp, fv, b.categoria, b.tipo, b.resumen, b.contenido, b.autor, b.archivo_url, b.archivo_nombre, b.archivo_tipo, b.tamano_archivo, b.etiquetas, b.estado, b.activo]
  );
  return res.rows?.[0] || null;
};

const actualizar_boletin = async (id, b) => {
  const fp = b.fecha_publicacion && String(b.fecha_publicacion).trim() ? b.fecha_publicacion : null;
  const fv = b.fecha_vigencia && String(b.fecha_vigencia).trim() ? b.fecha_vigencia : null;
  const res = await consultar(
    `UPDATE boletines SET
       titulo = COALESCE($2, titulo),
       numero_boletin = COALESCE($3, numero_boletin),
       fecha_publicacion = COALESCE($4::timestamptz, fecha_publicacion),
       fecha_vigencia = COALESCE($5::timestamptz, fecha_vigencia),
       categoria = COALESCE($6, categoria),
       tipo = COALESCE($7, tipo),
       resumen = COALESCE($8, resumen),
       contenido = COALESCE($9, contenido),
       autor = COALESCE($10, autor),
       archivo_url = COALESCE($11, archivo_url),
       archivo_nombre = COALESCE($12, archivo_nombre),
       archivo_tipo = COALESCE($13, archivo_tipo),
       tamano_archivo = COALESCE($14::integer, tamano_archivo),
       etiquetas = COALESCE($15, etiquetas),
       estado = COALESCE($16, estado),
       activo = COALESCE($17::boolean, activo),
       fecha_actualizacion = NOW()
     WHERE id_boletin = $1
     RETURNING *`,
    [id, b.titulo, b.numero_boletin, fp, fv, b.categoria, b.tipo, b.resumen, b.contenido, b.autor, b.archivo_url, b.archivo_nombre, b.archivo_tipo, b.tamano_archivo, b.etiquetas, b.estado, b.activo]
  );
  return res.rows?.[0] || null;
};

const eliminar_boletin = async (id) => {
  await consultar(`DELETE FROM boletines WHERE id_boletin = $1`, [id]);
  return true;
};

module.exports = {
  asegurar_tabla_boletines,
  listar_boletines,
  listar_boletines_publicos,
  crear_boletin,
  actualizar_boletin,
  eliminar_boletin
};
