const { consultar } = require('../configuracion/base_datos');

const existe_columna = async (tabla, columna) => {
  const res = await consultar(
    `SELECT EXISTS(
       SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 AND column_name=$2
     ) AS existe`,
    [tabla, columna]
  );
  return !!(res.rows?.[0]?.existe);
};

const asegurar_tabla_comunicados = async () => {
  await consultar(`
    CREATE TABLE IF NOT EXISTS comunicados (
      id_comunicado SERIAL PRIMARY KEY,
      titulo TEXT NOT NULL,
      fecha TIMESTAMPTZ,
      categoria TEXT,
      prioridad TEXT,
      resumen TEXT,
      contenido TEXT,
      autor TEXT,
      imagen TEXT,
      adjunto_url TEXT,
      adjunto_nombre TEXT,
      adjunto_tipo TEXT,
      adjunto_tamano INTEGER,
      activo BOOLEAN DEFAULT TRUE,
      fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
      fecha_actualizacion TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await consultar("ALTER TABLE IF EXISTS comunicados ADD COLUMN IF NOT EXISTS imagen TEXT");
  await consultar("ALTER TABLE IF EXISTS comunicados ADD COLUMN IF NOT EXISTS adjunto_url TEXT");
  await consultar("ALTER TABLE IF EXISTS comunicados ADD COLUMN IF NOT EXISTS adjunto_nombre TEXT");
  await consultar("ALTER TABLE IF EXISTS comunicados ADD COLUMN IF NOT EXISTS adjunto_tipo TEXT");
  await consultar("ALTER TABLE IF EXISTS comunicados ADD COLUMN IF NOT EXISTS adjunto_tamano INTEGER");
  await consultar("ALTER TABLE IF EXISTS comunicados ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE");
  await consultar("ALTER TABLE IF EXISTS comunicados ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMPTZ DEFAULT NOW()");
  await consultar("ALTER TABLE IF EXISTS comunicados ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMPTZ DEFAULT NOW()");
  await consultar(`CREATE INDEX IF NOT EXISTS idx_comunicados_activo ON comunicados(activo)`);
  await consultar(`CREATE INDEX IF NOT EXISTS idx_comunicados_fecha ON comunicados(fecha)`);
};

const listar_comunicados = async () => {
  const tiene_imagen = await existe_columna('comunicados', 'imagen');
  const tiene_adjunto = await existe_columna('comunicados', 'adjunto_url');
  const campos = [
    'id_comunicado', 'titulo', 'fecha', 'categoria', 'prioridad', 'resumen', 'contenido', 'autor',
    ...(tiene_imagen ? ['imagen'] : []),
    ...(tiene_adjunto ? ['adjunto_url', 'adjunto_nombre', 'adjunto_tipo', 'adjunto_tamano'] : []),
    'activo', 'fecha_creacion', 'fecha_actualizacion'
  ].join(', ');
  const res = await consultar(`SELECT ${campos} FROM comunicados ORDER BY fecha DESC NULLS LAST, id_comunicado DESC`);
  return res.rows || [];
};

const listar_comunicados_publicos = async () => {
  const tiene_imagen = await existe_columna('comunicados', 'imagen');
  const tiene_adjunto = await existe_columna('comunicados', 'adjunto_url');
  const tiene_archivo_legacy = await existe_columna('comunicados', 'archivo_url');
  const campos = [
    'id_comunicado', 'titulo', 'fecha', 'categoria', 'prioridad', 'resumen', 'contenido', 'autor',
    ...(tiene_imagen ? ['imagen'] : []),
    ...(tiene_adjunto ? ['adjunto_url', 'adjunto_nombre', 'adjunto_tipo', 'adjunto_tamano'] : []),
    ...(tiene_archivo_legacy ? ['archivo_url', 'archivo_nombre'] : [])
  ].join(', ');
  const res = await consultar(
    `SELECT ${campos}
     FROM comunicados
     WHERE activo = TRUE
     ORDER BY fecha DESC NULLS LAST, id_comunicado DESC`
  );
  return res.rows || [];
};

const crear_comunicado = async (com) => {
  const tiene_imagen = await existe_columna('comunicados', 'imagen');
  const tiene_adjunto = await existe_columna('comunicados', 'adjunto_url');
  if (tiene_imagen) {
    const columnas = ['titulo','fecha','categoria','prioridad','resumen','contenido','autor','imagen'];
    const valores = [com.titulo, com.fecha, com.categoria, com.prioridad, com.resumen, com.contenido, com.autor, com.imagen];
    if (tiene_adjunto) {
      columnas.push('adjunto_url','adjunto_nombre','adjunto_tipo','adjunto_tamano');
      valores.push(com.adjunto_url, com.adjunto_nombre, com.adjunto_tipo, com.adjunto_tamano);
    }
    columnas.push('activo');
    const placeholders = valores.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO comunicados (${columnas.join(',')}) VALUES (${placeholders}, COALESCE($${valores.length + 1}, TRUE))
                 RETURNING id_comunicado, titulo, fecha, categoria, prioridad, resumen, contenido, autor${tiene_imagen ? ', imagen' : ''}${tiene_adjunto ? ', adjunto_url, adjunto_nombre, adjunto_tipo, adjunto_tamano' : ''}, activo, fecha_creacion, fecha_actualizacion`;
    const res = await consultar(sql, [...valores, com.activo]);
    return res.rows?.[0] || null;
  } else {
    const columnas = ['titulo','fecha','categoria','prioridad','resumen','contenido','autor'];
    const valores = [com.titulo, com.fecha, com.categoria, com.prioridad, com.resumen, com.contenido, com.autor];
    if (tiene_adjunto) {
      columnas.push('adjunto_url','adjunto_nombre','adjunto_tipo','adjunto_tamano');
      valores.push(com.adjunto_url, com.adjunto_nombre, com.adjunto_tipo, com.adjunto_tamano);
    }
    columnas.push('activo');
    const placeholders = valores.map((_, i) => `$${i + 1}`).join(',');
    const sql = `INSERT INTO comunicados (${columnas.join(',')}) VALUES (${placeholders}, COALESCE($${valores.length + 1}, TRUE))
                 RETURNING id_comunicado, titulo, fecha, categoria, prioridad, resumen, contenido, autor${tiene_adjunto ? ', adjunto_url, adjunto_nombre, adjunto_tipo, adjunto_tamano' : ''}, activo, fecha_creacion, fecha_actualizacion`;
    const res = await consultar(sql, [...valores, com.activo]);
    return res.rows?.[0] || null;
  }
};

const actualizar_comunicado = async (id, com) => {
  const tiene_imagen = await existe_columna('comunicados', 'imagen');
  const tiene_adjunto = await existe_columna('comunicados', 'adjunto_url');
  const setImagen = tiene_imagen ? ', imagen = COALESCE($9, imagen)' : '';
  const returningImagen = tiene_imagen ? ', imagen' : '';
  // Construir SET dinámico para adjunto
  let setAdjunto = '';
  let params = [id, com.titulo, com.fecha, com.categoria, com.prioridad, com.resumen, com.contenido, com.autor];
  let indices = { imagen: 9, activo: 10 };
  if (tiene_imagen) params.push(com.imagen);
  if (tiene_adjunto) {
    setAdjunto = `, adjunto_url = COALESCE($${indices.activo + 1}, adjunto_url), adjunto_nombre = COALESCE($${indices.activo + 2}, adjunto_nombre), adjunto_tipo = COALESCE($${indices.activo + 3}, adjunto_tipo), adjunto_tamano = COALESCE($${indices.activo + 4}, adjunto_tamano)`;
  }
  params.push(com.activo);
  if (tiene_adjunto) {
    params.push(com.adjunto_url, com.adjunto_nombre, com.adjunto_tipo, com.adjunto_tamano);
  }
  const sql = `UPDATE comunicados SET
       titulo = COALESCE($2, titulo),
       fecha = COALESCE($3, fecha),
       categoria = COALESCE($4, categoria),
       prioridad = COALESCE($5, prioridad),
       resumen = COALESCE($6, resumen),
       contenido = COALESCE($7, contenido),
       autor = COALESCE($8, autor)
       ${setImagen}
       ${setAdjunto},
       activo = COALESCE($${tiene_imagen ? 10 : 9}, activo),
       fecha_actualizacion = NOW()
     WHERE id_comunicado = $1
     RETURNING id_comunicado, titulo, fecha, categoria, prioridad, resumen, contenido, autor${returningImagen}${tiene_adjunto ? ', adjunto_url, adjunto_nombre, adjunto_tipo, adjunto_tamano' : ''}, activo, fecha_creacion, fecha_actualizacion`;
  const res = await consultar(sql, params);
  return res.rows?.[0] || null;
};

const eliminar_comunicado = async (id) => {
  await consultar(`DELETE FROM comunicados WHERE id_comunicado = $1`, [id]);
  return true;
};

module.exports = {
  asegurar_tabla_comunicados,
  listar_comunicados,
  listar_comunicados_publicos,
  crear_comunicado,
  actualizar_comunicado,
  eliminar_comunicado
};
