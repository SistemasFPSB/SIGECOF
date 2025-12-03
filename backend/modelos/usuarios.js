const { consultar } = require('../configuracion/base_datos');
const MIGRACION_LOGS = process.env.MIGRACION_LOGS === 'true';
const bcrypt = require('bcryptjs');

// Asegura la existencia y estructura de la tabla 'usuarios'
const asegurar_tabla_usuarios = async () => {
  // Verificar si existe 'usuarios'
  const regUsuarios = await consultar("SELECT to_regclass('public.usuarios') AS reg");
  const existeUsuarios = regUsuarios.rows[0].reg !== null;

  // Si no existe 'usuarios', intentar renombrar 'usuario' -> 'usuarios'
  if (!existeUsuarios) {
    const regUsuario = await consultar("SELECT to_regclass('public.usuario') AS reg");
    const existeUsuario = regUsuario.rows[0].reg !== null;

    if (existeUsuario) {
      await consultar('ALTER TABLE IF EXISTS usuario RENAME TO usuarios');
    } else {
      // Crear tabla con el esquema solicitado
      await consultar(`
        CREATE TABLE IF NOT EXISTS usuarios (
          id_usuario SERIAL PRIMARY KEY,
          id_personal INTEGER,
          nombre VARCHAR(200),
          usuario VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(255),
          password_hash VARCHAR(255),
          rol VARCHAR(50) DEFAULT 'pendiente',
          tipo_persona VARCHAR(50),
          estatus VARCHAR(50) DEFAULT 'activo',
          requiere_cambio_contrasena BOOLEAN DEFAULT FALSE,
          fecha_registro TIMESTAMP DEFAULT NOW(),
          fecha_actualizacion TIMESTAMP DEFAULT NOW()
        );
      `);
    }
  }

  // Asegurar columnas necesarias según el esquema solicitado
  await consultar("ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS id_personal INTEGER");
  await consultar("ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS nombre VARCHAR(200)");
  await consultar("ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS password VARCHAR(255)");
  await consultar("ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)");
  await consultar("ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS rol VARCHAR(50) DEFAULT 'pendiente'");
  await consultar("ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS tipo_persona VARCHAR(50)");
  await consultar("ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS estatus VARCHAR(50) DEFAULT 'activo'");
  await consultar("ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS requiere_cambio_contrasena BOOLEAN DEFAULT FALSE");
  await consultar("ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS fecha_registro TIMESTAMP DEFAULT NOW()");
  // Unificar nombre de columna sin acento
  await consultar("ALTER TABLE IF EXISTS usuarios ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMP DEFAULT NOW()");

  // Reglas de NULL/NOT NULL: solo 'usuario' debe ser NOT NULL
  try { await consultar("ALTER TABLE usuarios ALTER COLUMN usuario SET NOT NULL"); } catch (e) {}
  for (const col of ['id_personal','nombre','password','password_hash','rol','tipo_persona','estatus','requiere_cambio_contrasena','fecha_registro','fecha_actualizacion']) {
    try { await consultar(`ALTER TABLE usuarios ALTER COLUMN ${col} DROP NOT NULL`); } catch (e) {}
  }

  // Compatibilidad: si existe columna 'role' en inglés y no existe 'rol', renombrar
  try {
    const oldRole = await consultar(
      "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' AND column_name='role') AS exists"
    );
    const newRol = await consultar(
      "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' AND column_name='rol') AS exists"
    );
    if (oldRole.rows[0]?.exists && !newRol.rows[0]?.exists) {
      await consultar("ALTER TABLE usuarios RENAME COLUMN role TO rol");
    }
  } catch (e) {
    // Ignorar errores si no aplica
  }

  // Si existe la columna anterior en inglés, renombrarla solo si la nueva NO existe
  try {
    const oldCol = await consultar(
      "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' AND column_name='requires_password_change') AS exists"
    );
    const newCol = await consultar(
      "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' AND column_name='requiere_cambio_contrasena') AS exists"
    );
    const oldExists = oldCol.rows[0]?.exists;
    const newExists = newCol.rows[0]?.exists;
    if (oldExists && !newExists) {
      await consultar("ALTER TABLE usuarios RENAME COLUMN requires_password_change TO requiere_cambio_contrasena");
    }
  } catch (e) {
    // Ignorar errores de renombre si no aplica
  }

  // Compatibilidad con esquemas legados: transición desde columnas antiguas
  try {
    const colPassword = await consultar("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' AND column_name='password') AS exists");
    const colContrasena = await consultar("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' AND column_name='contrasena') AS exists");
    const colContrasenaHash = await consultar("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' AND column_name='contrasena_hash') AS exists");
    const colPasswordHash = await consultar("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' AND column_name='password_hash') AS exists");
    const colActualizadoEn = await consultar("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' AND column_name='actualizado_en') AS exists");
    const colFechaActualizacionSinAcento = await consultar("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' AND column_name='fecha_actualizacion') AS exists");
    const colFechaActualizacionConAcento = await consultar("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' AND column_name='fecha_actualización') AS exists");
    const colCreadoEn = await consultar("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' AND column_name='creado_en') AS exists");

    const existePassword = colPassword.rows[0]?.exists;
    const existeContrasena = colContrasena.rows[0]?.exists;
    const existeContrasenaHash = colContrasenaHash.rows[0]?.exists;
    const existePasswordHash = colPasswordHash.rows[0]?.exists;
    const existeActualizadoEn = colActualizadoEn.rows[0]?.exists;
    const existeFechaActualizacionSinAcento = colFechaActualizacionSinAcento.rows[0]?.exists;
    const existeFechaActualizacionConAcento = colFechaActualizacionConAcento.rows[0]?.exists;
    const existeCreadoEn = colCreadoEn.rows[0]?.exists;


    // Renombrar columnas legadas a 'fecha_actualizacion' (sin acento)
    if (existeActualizadoEn && !existeFechaActualizacionSinAcento) {
      try {
        await consultar("ALTER TABLE usuarios RENAME COLUMN actualizado_en TO fecha_actualizacion");
      } catch (e) {}
    } else if (existeActualizadoEn && existeFechaActualizacionSinAcento) {
      // Si ambas columnas existen, eliminar la legacy
      try { await consultar("ALTER TABLE IF EXISTS usuarios DROP COLUMN IF EXISTS actualizado_en"); } catch (e) {}
    }

    // Si existe la columna con acento y no existe la versión sin acento, renombrar
    if (existeFechaActualizacionConAcento && !existeFechaActualizacionSinAcento) {
      try {
        await consultar("ALTER TABLE usuarios RENAME COLUMN \"fecha_actualización\" TO fecha_actualizacion");
      } catch (e) {}
    }

    // Eliminar 'creado_en' si existe (se usa 'fecha_registro')
    if (existeCreadoEn) {
      try {
        await consultar("ALTER TABLE IF EXISTS usuarios DROP COLUMN IF EXISTS creado_en");
      } catch (e) {}
    }

    // Migrar datos de contrasena_hash -> password_hash si existen
    if (existeContrasenaHash) {
      try {
        await consultar("UPDATE usuarios SET password_hash = contrasena_hash WHERE contrasena_hash IS NOT NULL AND (password_hash IS NULL OR password_hash = '')");
      } catch (e) {
        // Ignorar errores de actualización
      }
      // Eliminar columna contrasena_hash si ya migramos
      try {
        await consultar("ALTER TABLE IF EXISTS usuarios DROP COLUMN IF EXISTS contrasena_hash");
      } catch (e) {
        // Ignorar si no se puede eliminar
      }
    }

    // Eliminar columna nombre_completo si existe (ya no se usa)
    try {
      await consultar("ALTER TABLE IF EXISTS usuarios DROP COLUMN IF EXISTS nombre_completo");
    } catch (e) {
      // Ignorar si no aplica
    }
  } catch (e) {
    // Ignorar si la comprobación de columnas falla
  }

  // Asegurar constraint único en 'usuario'
  await consultar("CREATE UNIQUE INDEX IF NOT EXISTS usuarios_usuario_key ON usuarios(usuario)");

  // Relajar/estandarizar constraint de rol para permitir nuevos roles dinámicos
  // Si existe un constraint anterior 'usuario_rol_check' con lista fija de valores, eliminarlo
  try {
    const con = await consultar("SELECT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid = 'public.usuarios'::regclass AND conname = 'usuario_rol_check') AS exists");
    if (con.rows[0]?.exists) {
      try { await consultar('ALTER TABLE usuarios DROP CONSTRAINT usuario_rol_check'); } catch (e) {}
    }
    // Agregar un constraint más permisivo: solo letras minúsculas, números y guiones bajos
    // Permitimos NULL y el valor 'pendiente' por compatibilidad (pero la lógica de la API evita asignarlo manualmente)
    try {
      await consultar("ALTER TABLE IF EXISTS usuarios ADD CONSTRAINT usuario_rol_check CHECK (rol IS NULL OR rol ~ '^[a-z0-9_]+$')");
    } catch (e) {
      // Si ya existe otro constraint equivalente, ignorar
    }
  } catch (e) {
    // Ignorar si no se puede inspeccionar/alterar constraint
  }
};

const obtener_usuario_por_usuario = async (usuario) => {
  const res = await consultar('SELECT * FROM usuarios WHERE usuario = $1 LIMIT 1', [usuario]);
  return res.rows[0] || null;
};

const crear_usuario = async ({ usuario, nombre, password, password_hash, id_personal = null, tipo_persona = null, rol = 'pendiente', estatus = 'activo' }) => {
  // Insertar según el esquema solicitado
  const nombre_final = nombre || usuario;
  const res = await consultar(
    `INSERT INTO usuarios(id_personal, nombre, usuario, password, password_hash, rol, tipo_persona, estatus, requiere_cambio_contrasena, fecha_registro)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'pendiente'), $7, COALESCE($8, 'activo'), false, NOW())
     RETURNING id_usuario, id_personal, usuario, nombre, rol, tipo_persona, estatus, fecha_registro`,
    [id_personal, nombre_final, usuario, password || null, password_hash || null, rol, tipo_persona, estatus]
  );
  return res.rows[0];
};

// Actualizar rol de usuario
const actualizar_rol_usuario = async (id_usuario, nuevo_rol) => {
  const res = await consultar(
    'UPDATE usuarios SET rol = $1, fecha_actualizacion = NOW() WHERE id_usuario = $2 RETURNING id_usuario, usuario, nombre, rol',
    [nuevo_rol, id_usuario]
  );
  return res.rows[0] || null;
};

const eliminar_usuario_por_id = async (id_usuario) => {
  const res = await consultar('DELETE FROM usuarios WHERE id_usuario = $1', [id_usuario]);
  return res.rowCount > 0;
};

module.exports = {
  asegurar_tabla_usuarios,
  obtener_usuario_por_usuario,
  crear_usuario,
  actualizar_rol_usuario,
  eliminar_usuario_por_id,
  actualizar_usuario_campos: async (id_usuario, campos) => {
    const setParts = [];
    const valores = [];
    let idx = 1;
    if (typeof campos?.nombre !== 'undefined') {
      setParts.push(`nombre = $${idx++}`);
      valores.push(campos.nombre || null);
    }
    if (typeof campos?.estatus !== 'undefined') {
      setParts.push(`estatus = $${idx++}`);
      valores.push(String(campos.estatus || '').trim() || null);
    }
    if (setParts.length === 0) return null;
    setParts.push('fecha_actualizacion = NOW()');
    valores.push(id_usuario);
    const sql = `UPDATE usuarios SET ${setParts.join(', ')} WHERE id_usuario = $${idx} RETURNING id_usuario, usuario, nombre, rol, estatus`;
    const res = await consultar(sql, valores);
    return res.rows[0] || null;
  },
  // Utilidad para migrar contraseñas antiguas
  migrar_contrasenas: async () => {
    try {
      // Verificar existencia de columnas legacy y nuevas
      const colPwd = await consultar("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' AND column_name='password') AS exists");
      const colPwdHash = await consultar("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' AND column_name='password_hash') AS exists");
      const colContraHash = await consultar("SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='usuarios' AND column_name='contrasena_hash') AS exists");

      const existePassword = colPwd.rows[0]?.exists;
      const existePasswordHash = colPwdHash.rows[0]?.exists;
      const existeContrasenaHash = colContraHash.rows[0]?.exists;

      if (!existePassword) {
        if (MIGRACION_LOGS) console.log('ℹ️ Columna "password" no existe. No hay migración necesaria.');
        return { migrated: 0, copied: 0 };
      }

      // Seleccionar usuarios con password y sin password_hash
      let res;
      if (existeContrasenaHash) {
        res = await consultar(
          "SELECT usuario, password, password_hash, contrasena_hash FROM usuarios WHERE password IS NOT NULL AND (password_hash IS NULL OR password_hash = '')"
        );
      } else {
        res = await consultar(
          "SELECT usuario, password, password_hash FROM usuarios WHERE password IS NOT NULL AND (password_hash IS NULL OR password_hash = '')"
        );
      }
      let migrated = 0;
      let copied = 0;

      for (const row of res.rows) {
        const { usuario, password } = row;
        const contrasena_hash = row.contrasena_hash;
        let nuevoHash = null;

        if (contrasena_hash && /^\$2(a|b|y)\$/.test(contrasena_hash)) {
          // Copiar contrasena_hash si ya es bcrypt
          nuevoHash = contrasena_hash;
          copied++;
        } else if (password) {
          const salt = await bcrypt.genSalt(10);
          nuevoHash = await bcrypt.hash(password, salt);
          migrated++;
        }

        await consultar(
          'UPDATE usuarios SET password_hash = $1, fecha_actualizacion = NOW() WHERE usuario = $2',
          [nuevoHash, usuario]
        );
        if (MIGRACION_LOGS) {
          console.log(`🔧 Usuario "${usuario}" migrado/copiado a password_hash`);
        }
      }

      if (MIGRACION_LOGS) {
        console.log(`✅ Migración de contraseñas completada. Hashed: ${migrated}, Copied: ${copied}`);
      }
      return { migrated, copied };
    } catch (err) {
      console.error('❌ Error en migración de contraseñas:', err.message);
      return { migrated: 0, copied: 0, error: err.message };
    }
  },
};