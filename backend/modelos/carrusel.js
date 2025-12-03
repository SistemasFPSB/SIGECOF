// backend/modelos/carrusel.js
// Modelo y utilidades para la tabla de banners del carrusel
const { consultar } = require('../configuracion/base_datos');

// Crear tabla si no existe
const asegurar_tabla_carrusel = async () => {
  // Crear tabla principal
  await consultar(`
    CREATE TABLE IF NOT EXISTS carrusel_banners (
      id_banner SERIAL PRIMARY KEY,
      titulo TEXT NOT NULL,
      descripcion TEXT,
      url_imagen TEXT NOT NULL,
      url_pdf TEXT,
      mostrar_indefinido BOOLEAN DEFAULT TRUE,
      fecha_inicio TIMESTAMPTZ,
      fecha_fin TIMESTAMPTZ,
      activo BOOLEAN DEFAULT TRUE,
      prioridad INTEGER DEFAULT 1,
      creado_por INTEGER,
      fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
      fecha_actualizacion TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  // Índices útiles
  await consultar(`CREATE INDEX IF NOT EXISTS idx_carrusel_activo ON carrusel_banners(activo)`);
  await consultar(`CREATE INDEX IF NOT EXISTS idx_carrusel_prioridad ON carrusel_banners(prioridad)`);
};

// Listar todos los banners (administración)
const listar_banners = async () => {
  const res = await consultar(
    `SELECT id_banner, titulo, descripcion, url_imagen, url_pdf, mostrar_indefinido,
            fecha_inicio, fecha_fin, activo, prioridad, fecha_creacion, fecha_actualizacion
     FROM carrusel_banners
     ORDER BY prioridad ASC, id_banner ASC`
  );
  return res.rows || [];
};

// Listar banners visibles (público)
const listar_banners_publicos = async () => {
  const res = await consultar(
    `SELECT id_banner, titulo, descripcion, url_imagen, url_pdf, mostrar_indefinido,
            fecha_inicio, fecha_fin, activo, prioridad
     FROM carrusel_banners
     WHERE activo = TRUE
       AND (
         mostrar_indefinido = TRUE
         OR (
           (fecha_inicio IS NULL OR NOW() >= fecha_inicio) AND
           (fecha_fin IS NULL OR NOW() <= fecha_fin)
         )
       )
     ORDER BY prioridad ASC, id_banner ASC`
  );
  return res.rows || [];
};

// Obtener un banner por id (administración)
const obtener_banner_por_id = async (id_banner) => {
  const res = await consultar(
    `SELECT id_banner, titulo, descripcion, url_imagen, url_pdf, mostrar_indefinido,
            fecha_inicio, fecha_fin, activo, prioridad, fecha_creacion, fecha_actualizacion
     FROM carrusel_banners
     WHERE id_banner=$1
     LIMIT 1`,
    [id_banner]
  );
  return res.rows?.[0] || null;
};

// Crear nuevo banner; la prioridad por defecto es max(prioridad)+1
const crear_banner = async (banner, creado_por = null) => {
  const rMax = await consultar('SELECT COALESCE(MAX(prioridad), 0) AS max FROM carrusel_banners');
  const siguiente = Number(rMax.rows?.[0]?.max || 0) + 1;
  const campos = [
    banner.titulo,
    banner.descripcion || null,
    banner.url_imagen,
    banner.url_pdf || null,
    banner.mostrar_indefinido ?? true,
    banner.fecha_inicio ? new Date(banner.fecha_inicio) : null,
    banner.fecha_fin ? new Date(banner.fecha_fin) : null,
    banner.activo ?? true,
    banner.prioridad ?? siguiente,
    creado_por || null,
  ];
  const res = await consultar(
    `INSERT INTO carrusel_banners
      (titulo, descripcion, url_imagen, url_pdf, mostrar_indefinido,
       fecha_inicio, fecha_fin, activo, prioridad, creado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id_banner, titulo, descripcion, url_imagen, url_pdf, mostrar_indefinido,
       fecha_inicio, fecha_fin, activo, prioridad, fecha_creacion, fecha_actualizacion`,
    campos
  );
  return res.rows?.[0] || null;
};

// Actualizar banner por id
const actualizar_banner = async (id_banner, banner) => {
  const campos = [
    banner.titulo,
    banner.descripcion || null,
    banner.url_imagen,
    banner.url_pdf || null,
    banner.mostrar_indefinido ?? true,
    banner.fecha_inicio ? new Date(banner.fecha_inicio) : null,
    banner.fecha_fin ? new Date(banner.fecha_fin) : null,
    banner.activo ?? true,
    banner.prioridad ?? null,
    id_banner,
  ];
  const res = await consultar(
    `UPDATE carrusel_banners SET
       titulo=$1,
       descripcion=$2,
       url_imagen=$3,
       url_pdf=$4,
       mostrar_indefinido=$5,
       fecha_inicio=$6,
       fecha_fin=$7,
       activo=$8,
       prioridad=COALESCE($9, prioridad),
       fecha_actualizacion=NOW()
     WHERE id_banner=$10
     RETURNING id_banner, titulo, descripcion, url_imagen, url_pdf, mostrar_indefinido,
       fecha_inicio, fecha_fin, activo, prioridad, fecha_creacion, fecha_actualizacion`,
    campos
  );
  return res.rows?.[0] || null;
};

// Eliminar banner y compactar prioridades
const eliminar_banner = async (id_banner) => {
  await consultar('DELETE FROM carrusel_banners WHERE id_banner=$1', [id_banner]);
  // Reasignar prioridades consecutivas según id_banner actual
  const rows = (await consultar('SELECT id_banner FROM carrusel_banners ORDER BY prioridad ASC, id_banner ASC')).rows || [];
  for (let i = 0; i < rows.length; i++) {
    await consultar('UPDATE carrusel_banners SET prioridad=$1 WHERE id_banner=$2', [i + 1, rows[i].id_banner]);
  }
  return true;
};

// Reordenar prioridades por listado de ids en orden
const reordenar_prioridades = async (ids_en_orden = []) => {
  if (!Array.isArray(ids_en_orden) || ids_en_orden.length === 0) return false;
  for (let i = 0; i < ids_en_orden.length; i++) {
    await consultar('UPDATE carrusel_banners SET prioridad=$1 WHERE id_banner=$2', [i + 1, ids_en_orden[i]]);
  }
  return true;
};

module.exports = {
  asegurar_tabla_carrusel,
  listar_banners,
  listar_banners_publicos,
  obtener_banner_por_id,
  crear_banner,
  actualizar_banner,
  eliminar_banner,
  reordenar_prioridades,
};