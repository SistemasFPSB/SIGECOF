const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cookie = require('cookie');
const { obtener_usuario_por_usuario, crear_usuario, actualizar_rol_usuario, eliminar_usuario_por_id, actualizar_usuario_campos } = require('../modelos/usuarios');
const { listar_permisos_por_rol, reemplazar_permisos_de_rol, actualizar_alias_de_rol, obtener_permisos_de_rol } = require('../modelos/permisos_roles');
const { consultar } = require('../configuracion/base_datos');
const { registrar_transaccion, log_error } = require('../utilidades/logger');
const { requiere_rol } = require('../utilidades/autorizacion');

const router = express.Router();

const crearToken = (usuario) => {
  const payload = {
    id_usuario: usuario.id_usuario,
    usuario: usuario.usuario,
    nombre: usuario.nombre || usuario.usuario,
    requiere_cambio_contrasena: usuario.requiere_cambio_contrasena || false,
    rol: usuario.rol || 'pendiente',
  };
  const secret = process.env.JWT_SECRET || 'sigecof-dev-secret';
  const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  return jwt.sign(payload, secret, { expiresIn });
};

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

const authFlexible = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) {
    try {
      const secret = process.env.JWT_SECRET || 'sigecof-dev-secret';
      const decoded = jwt.verify(token, secret);
      req.user = decoded;
      return next();
    } catch (_) { /* fallthrough */ }
  }
  try {
    const raw = req.headers.cookie || '';
    const parsed = cookie.parse(raw);
    const sid = parsed.sid || parsed.sigecof_session || null;
    if (!sid) return res.status(401).json({ error: 'No autenticado' });
    const r = await consultar('SELECT id_usuario, expira_en FROM sesiones WHERE sid = $1 LIMIT 1', [sid]);
    const s = r.rows?.[0];
    if (!s) return res.status(401).json({ error: 'No autenticado' });
    if (new Date(s.expira_en).getTime() < Date.now()) return res.status(401).json({ error: 'No autenticado' });
    const ures = await consultar('SELECT id_usuario, usuario, rol, nombre, requiere_cambio_contrasena FROM usuarios WHERE id_usuario = $1 LIMIT 1', [s.id_usuario]);
    const u = ures.rows?.[0];
    if (!u) return res.status(401).json({ error: 'No autenticado' });
    req.user = { id_usuario: u.id_usuario, usuario: u.usuario, rol: u.rol, nombre: u.nombre, requiere_cambio_contrasena: !!u.requiere_cambio_contrasena };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'No autenticado' });
  }
};

async function generar_notificaciones_por_reglas({ seccion, accion, rol_origen, datos, marcador }) {
  try {
    const origen = String(rol_origen || '').toLowerCase().trim() || 'cualquiera';
    const sec = String(seccion || '').trim();
    const acc = String(accion || '').trim();
    const clave = `${sec}:${acc}`;
    const trig = `${sec}_${acc}`;
    const rs = await consultar(
      `SELECT activo, titulo_regla, mensaje, tipo, prioridad, roles_destino, ruta_sugerida
       FROM notificaciones_configuracion
       WHERE activo = TRUE
         AND (
           seccion_accion = $1 OR seccion_accion LIKE $2 OR
           trigger_id = $3 OR trigger_id LIKE $4
         )
         AND (LOWER(TRIM(rol_origen)) = $5 OR LOWER(TRIM(rol_origen)) = 'cualquiera')`,
      [clave, `%:${acc}`, trig, `%_${acc}`, origen]
    );
    const reglas = rs.rows || [];
    if (!Array.isArray(reglas) || reglas.length === 0) return;
    const version = Date.now();
    const d = datos || {};
    const datos_evento = { ...d, ...(marcador ? { es_evento_sistema: marcador } : {}), version };
    const tpl = (s) => {
      if (!s) return s;
      let out = s;
      const rep = {
        '{{nombre}}': datos_evento.nombre || '',
        '{{usuario}}': datos_evento.usuario || '',
        '{{rol}}': datos_evento.rol || '',
      };
      Object.keys(rep).forEach(k => { out = out.split(k).join(rep[k]); });
      return out;
    };
    for (const r of reglas) {
      const tipo = r.tipo || 'informacion';
      const prioridad = r.prioridad || 'media';
      const ruta = (r.ruta_sugerida && String(r.ruta_sugerida).trim()) || 'inicio';
      const titulo = tpl(r.titulo_regla || 'Notificación');
      const mensaje = tpl(typeof r.mensaje === 'string' ? r.mensaje : '');
      const destinos = Array.isArray(r.roles_destino) ? r.roles_destino : [];
      if (destinos.length === 0) {
        await consultar(
          'INSERT INTO notificaciones_eventos(tipo, titulo, mensaje, rol_destinatario, ruta_sugerida, datos, prioridad) VALUES($1,$2,$3,NULL,$4,$5,$6)',
          [tipo, titulo, mensaje, ruta, datos_evento, prioridad]
        );
      } else {
        for (const dest of destinos) {
          const rolDest = String(dest || '').trim() || null;
          await consultar(
            'INSERT INTO notificaciones_eventos(tipo, titulo, mensaje, rol_destinatario, ruta_sugerida, datos, prioridad) VALUES($1,$2,$3,$4,$5,$6,$7)',
            [tipo, titulo, mensaje, rolDest, ruta, datos_evento, prioridad]
          );
        }
      }
    }
  } catch (_) { /* noop */ }
}

// Registro de usuario (handler reutilizable)
const registrar = async (req, res) => {
  const usuario_body = req.body?.usuario;
  try {
    const { usuario, contrasena, password } = req.body || {};
    const nombre = (req.body?.nombre ?? null);
    const clave = password ?? contrasena;
    if (!usuario || !clave) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    const existente = await obtener_usuario_por_usuario(usuario);
    if (existente) {
      return res.status(409).json({ error: 'El usuario ya existe' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(clave, salt);

    const nuevo = await crear_usuario({ usuario, nombre, password: clave, password_hash });
    const token = crearToken(nuevo);

    await generar_notificaciones_por_reglas({
      seccion: 'inicio_sesion',
      accion: 'registro_nuevo',
      rol_origen: 'cualquiera',
      datos: { nombre: nombre || nuevo.nombre || usuario, usuario, rol: 'pendiente' },
      marcador: 'registro_usuario',
    });

    // Incluir campos opcionales como 'nombre' y 'rol' si existen en la base de datos
    res.json({
      exito: true,
      usuario: {
        id_usuario: nuevo.id_usuario,
        usuario: nuevo.usuario,
        nombre: nuevo.nombre || null,
        rol: nuevo.rol || 'pendiente',
        estatus: nuevo.estatus || 'activo',
        fecha_registro: nuevo.fecha_registro || null,
      },
      token,
    });
    registrar_transaccion({ modulo: 'autenticacion', accion: 'registrar', estado: 'exito', usuario, mensaje: 'registro exitoso', datos: { id_usuario: nuevo.id_usuario } });
  } catch (error) {
    // Mapear errores comunes de PostgreSQL a mensajes claros para el usuario
    const code = error?.code;
    const detail = error?.detail || error?.message || '';
    log_error('Error en /registrar', { error: error.message, code, detalle: detail, usuario: usuario_body });

    // 23505: unique_violation (usuario duplicado)
    if (code === '23505' || /usuarios?_usuario_key/i.test(detail)) {
      return res.status(409).json({ error: 'El usuario ya existe' });
    }
    // 23502: not_null_violation (faltan datos requeridos)
    if (code === '23502' || /no\s+nulo/i.test(detail)) {
      // Intentar detectar la columna
      const columna = (error?.column || '').toLowerCase();
      if (columna === 'nombre' || /columna\s+«?nombre»?/i.test(detail)) {
        return res.status(400).json({ error: 'El nombre es requerido' });
      }
      if (columna === 'password' || /columna\s+«?password»?/i.test(detail) || columna === 'contrasena' || /columna\s+«?contrasena»?/i.test(detail)) {
        return res.status(400).json({ error: 'La contraseña es requerida' });
      }
      return res.status(400).json({ error: 'Faltan datos requeridos para el registro' });
    }
    // 42601: syntax_error (error de SQL)
    if (code === '42601') {
      return res.status(500).json({ error: 'Error en la base de datos. Contacte al administrador.' });
    }
    // Genérico
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
router.post('/registrar', registrar);

// Inicio de sesión (handler reutilizable)
const iniciar_sesion = async (req, res) => {
  try {
    const { usuario, contrasena, password, persistente } = req.body || {};
    const clave = password ?? contrasena;
    if (!usuario || !clave) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    const existente = await obtener_usuario_por_usuario(usuario);
    if (!existente) {
      registrar_transaccion({ modulo: 'autenticacion', accion: 'iniciar_sesion', estado: 'error', usuario, mensaje: 'usuario no existe' });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    let valido = false;
    if (existente.password_hash) {
      try { valido = await bcrypt.compare(clave, existente.password_hash); } catch (_) { valido = false; }
      if (!valido && existente.password) {
        // Fallback adicional si el hash no coincide pero existe columna en texto plano
        valido = clave === existente.password;
      }
    } else if (existente.password) {
      // Compatibilidad con registros antiguos sin hash
      valido = clave === existente.password;
    }

    if (!valido) {
      registrar_transaccion({ modulo: 'autenticacion', accion: 'iniciar_sesion', estado: 'error', usuario, mensaje: 'credenciales inválidas' });
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = crearToken(existente);
    // Crear sesión httpOnly adicional para rehidratación sin localStorage
    const sid = crypto.randomBytes(24).toString('hex');
    const ttlMs = persistente ? (1000 * 60 * 60 * 24 * 7) : (1000 * 60 * 60);
    const exp = new Date(Date.now() + ttlMs).toISOString();
    await consultar(
      'INSERT INTO sesiones (sid, id_usuario, rol, expira_en) VALUES ($1, $2, $3, $4)',
      [sid, existente.id_usuario, existente.rol || 'pendiente', exp]
    );
    const esProduccion = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
    const base = { httpOnly: true, path: '/' };
    const dom = process.env.COOKIE_DOMAIN || undefined;
    const maxAge = ttlMs;
    let optsCookie;
    if (esProduccion) {
      const sameSiteEnv = (process.env.COOKIE_SAMESITE || '').toLowerCase();
      const secureEnv = (process.env.COOKIE_SECURE || '').toLowerCase();
      const sameSite = ['lax','strict','none'].includes(sameSiteEnv) ? sameSiteEnv : 'none';
      const secure = ['true','false'].includes(secureEnv) ? (secureEnv === 'true') : true;
      optsCookie = { ...base, secure, sameSite, domain: dom, maxAge };
    } else {
      // En desarrollo, usar SameSite=Lax y secure=false para que el navegador acepte cookies
      // en el contexto frontend localhost:3000 ↔ backend localhost:5000 (mismo sitio).
      optsCookie = { ...base, secure: false, sameSite: 'lax', domain: dom, maxAge };
    }
    res.cookie('sid', sid, optsCookie);
    res.cookie('sigecof_session', sid, optsCookie);
    const csrf = (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 32);
    res.cookie('sigecof_csrf', csrf, optsCookie);
    // Incluir 'nombre' y 'rol' si están presentes en el registro de la BD
    res.json({
      exito: true,
      usuario: {
        id_usuario: existente.id_usuario,
        usuario: existente.usuario,
        nombre: existente.nombre || null,
        rol: existente.rol || 'pendiente',
        estatus: existente.estatus || 'activo',
        fecha_registro: existente.fecha_registro || null,
      },
      token,
    });
    registrar_transaccion({ modulo: 'autenticacion', accion: 'iniciar_sesion', estado: 'exito', usuario, mensaje: 'login exitoso', datos: { id_usuario: existente.id_usuario } });
  } catch (error) {
    log_error('Error en /iniciar_sesion', { error: error.message, usuario });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
router.post('/iniciar_sesion', iniciar_sesion);
// Recuperación de contraseña: genera una temporal y obliga cambio
router.post('/recuperar_contrasena', async (req, res) => {
  try {
    const { usuario } = req.body || {};
    if (!usuario) {
      registrar_transaccion({ modulo: 'autenticacion', accion: 'recuperar_contrasena', estado: 'error', usuario: '-', mensaje: 'usuario requerido' });
      return res.status(400).json({ error: 'Usuario requerido' });
    }
    const existente = await obtener_usuario_por_usuario(usuario);
    if (!existente) {
      registrar_transaccion({ modulo: 'autenticacion', accion: 'recuperar_contrasena', estado: 'error', usuario, mensaje: 'usuario no encontrado' });
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    // Generar contraseña temporal
    const temporal = Math.random().toString(36).slice(-8);
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(temporal, salt);
    await consultar(
      'UPDATE usuarios SET password = $1, password_hash = $2, requiere_cambio_contrasena = true, fecha_actualizacion = NOW() WHERE usuario = $3',
      [temporal, hash, usuario]
    );
    registrar_transaccion({ modulo: 'autenticacion', accion: 'recuperar_contrasena', estado: 'exito', usuario, mensaje: 'contraseña temporal generada' });
    await generar_notificaciones_por_reglas({
      seccion: 'inicio_sesion',
      accion: 'solicitar_restablecer_contrasena',
      rol_origen: 'cualquiera',
      datos: { nombre: existente?.nombre || usuario, usuario, rol: existente?.rol || 'pendiente' },
      marcador: 'olvido_contrasena',
    });
    res.json({ exito: true, mensaje: 'Contraseña temporal generada. Contacte al administrador.', contrasena_temporal: temporal });
  } catch (error) {
    log_error('Error en /recuperar_contrasena', { error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
// Alias en español
// Eliminar alias duplicado que causaba manejo recursivo

// Información del usuario autenticado (handler reutilizable)
const yo = async (req, res) => {
  try {
    const existente = await obtener_usuario_por_usuario(req.user.usuario);
    if (!existente) {
      registrar_transaccion({ modulo: 'autenticacion', accion: 'yo', estado: 'error', usuario: req.user?.usuario, mensaje: 'usuario no encontrado' });
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    // Responder con información ampliada del usuario
    res.json({
      usuario: {
        id_usuario: existente.id_usuario,
        usuario: existente.usuario,
        nombre: existente.nombre || null,
        nombre_completo: existente.nombre || null,
        rol: existente.rol || 'pendiente',
      },
    });
  } catch (error) {
    log_error('Error en /yo', { error: error.message, usuario: req.user?.usuario });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
const extraerSid = (req) => {
  try {
    const raw = req.headers.cookie || '';
    const parsed = cookie.parse(raw);
    return parsed.sid || parsed.sigecof_session || null;
  } catch (_) { return null; }
};

router.get('/yo', async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const tieneBearer = authHeader.startsWith('Bearer ');
  if (tieneBearer) {
    return authMiddleware(req, res, () => yo(req, res));
  }
  try {
    const sid = extraerSid(req);
    if (!sid) return res.status(401).json({ error: 'No autenticado' });
    const r = await consultar('SELECT id_usuario, expira_en FROM sesiones WHERE sid = $1 LIMIT 1', [sid]);
    const s = r.rows?.[0];
    if (!s) return res.status(401).json({ error: 'No autenticado' });
    if (new Date(s.expira_en).getTime() < Date.now()) return res.status(401).json({ error: 'No autenticado' });
    // Renovar expiración estilo sliding window (30 minutos)
    await consultar('UPDATE sesiones SET expira_en = GREATEST(expira_en, NOW() + INTERVAL \'30 minutes\') WHERE sid = $1', [sid]);
    const ures = await consultar('SELECT id_usuario, usuario, rol, nombre FROM usuarios WHERE id_usuario = $1 LIMIT 1', [s.id_usuario]);
    const u = ures.rows?.[0];
    if (!u) return res.status(401).json({ error: 'No autenticado' });
    const token = crearToken(u);
    return res.json({ usuario: { id_usuario: u.id_usuario, usuario: u.usuario, nombre: u.nombre || null, nombre_completo: u.nombre || null, rol: u.rol }, token });
  } catch (error) {
    return next(error);
  }
});

// Cambio de contraseña (requiere autenticación)
const cambiarContrasena = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword) {
      return res.status(400).json({ error: 'Nueva contraseña requerida' });
    }

    // Obtener usuario actual
    const existente = await obtener_usuario_por_usuario(req.user.usuario);
    if (!existente) {
      registrar_transaccion({ modulo: 'autenticacion', accion: 'cambiar_contrasena', estado: 'error', usuario: req.user?.usuario, mensaje: 'usuario no encontrado' });
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Si se envía contraseña actual, validarla; si no, permitir cambio (se requiere token)
    if (typeof currentPassword === 'string' && currentPassword.length > 0) {
      const coincide = await bcrypt.compare(currentPassword, existente.password_hash || '');
      if (!coincide) {
        registrar_transaccion({ modulo: 'autenticacion', accion: 'cambiar_contrasena', estado: 'error', usuario: existente.usuario, mensaje: 'contraseña actual incorrecta' });
        return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
      }
    }

    // Actualizar contraseña y marcar que no requiere cambio
    const salt = await bcrypt.genSalt(10);
    const nuevoHash = await bcrypt.hash(newPassword, salt);
    // Usar usuario como clave para compatibilidad
    await consultar(
      'UPDATE usuarios SET password = $1, password_hash = $2, requiere_cambio_contrasena = false, fecha_actualizacion = NOW() WHERE usuario = $3',
      [newPassword, nuevoHash, existente.usuario]
    );

    registrar_transaccion({ modulo: 'autenticacion', accion: 'cambiar_contrasena', estado: 'exito', usuario: existente.usuario, mensaje: 'contraseña actualizada' });
    res.json({ exito: true, mensaje: 'Contraseña actualizada' });
  } catch (error) {
    log_error('Error en /cambiar_contrasena', { error: error.message, usuario: req.user?.usuario });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
router.post('/cambiar_contrasena', authFlexible, cambiarContrasena);

router.get('/estado_cambio_contrasena', authFlexible, async (req, res) => {
  try {
    const ures = await consultar('SELECT requiere_cambio_contrasena FROM usuarios WHERE usuario = $1 LIMIT 1', [req.user.usuario]);
    const u = ures.rows?.[0];
    return res.json({ requiere_cambio_contrasena: !!(u && u.requiere_cambio_contrasena) });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
});
// Alias en español
// Eliminar alias duplicado que causaba manejo recursivo

// Búsqueda de usuarios (solo para administradores)
const buscarUsuarios = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Término de búsqueda muy corto (mínimo 2 caracteres)' });
    }

    const termino = `%${q.trim().toLowerCase()}%`;
    const terminoPalabras = q.trim().toLowerCase().split(/\s+/).filter(p => p.length > 0);
    
    // Buscar por nombre, usuario, id o rol (búsqueda flexible)
    // Excluir al admin principal (id_usuario = 1) de los resultados para seguridad
    const query = `
      SELECT id_usuario, usuario, nombre, rol, fecha_registro, fecha_actualizacion, estatus
      FROM usuarios 
      WHERE id_usuario != 1 AND (
        LOWER(usuario) LIKE $1 
         OR LOWER(nombre) LIKE $1 
         OR LOWER(rol) LIKE $1 
         OR CAST(id_usuario AS TEXT) LIKE $1
         ${terminoPalabras.length > 1 ? 'OR LOWER(nombre) LIKE ANY($4) OR LOWER(usuario) LIKE ANY($4)' : ''}
      )
      ORDER BY 
        CASE 
          WHEN LOWER(usuario) = LOWER($2) THEN 1  -- Coincidencia exacta en usuario
          WHEN LOWER(nombre) = LOWER($2) THEN 2   -- Coincidencia exacta en nombre
          WHEN LOWER(usuario) LIKE $3 THEN 3       -- Comienza con en usuario
          WHEN LOWER(nombre) LIKE $3 THEN 4        -- Comienza con en nombre
          ELSE 5                                   -- Otras coincidencias parciales
        END,
        usuario ASC
      LIMIT 20
    `;
    
    // Preparar parámetros para la consulta
    const parametros = [termino, q.trim().toLowerCase(), `${q.trim().toLowerCase()}%`];
    if (terminoPalabras.length > 1) {
      // Agregar array de patrones para búsqueda por palabras
      const patronesPalabras = terminoPalabras.map(palabra => `%${palabra}%`);
      parametros.push(patronesPalabras);
    }
    
    const resultado = await consultar(query, parametros);
    
    // Log de depuración para verificar resultados
    console.log(`🔍 Búsqueda de usuarios: "${q}" - ${resultado.rows.length} resultados encontrados`);
    
    // Verificar que tenemos resultados válidos
    if (!resultado || !resultado.rows) {
      return res.json({ 
        exito: true, 
        usuarios: [],
        total: 0
      });
    }
    
    // Formatear respuesta
    const usuariosFormateados = resultado.rows.map(user => ({
      id_usuario: user.id_usuario,
      usuario: user.usuario,
      nombre: user.nombre || user.usuario,
      rol: user.rol || 'pendiente',
      activo: user.estatus === 'activo',
      es_admin_principal: user.id_usuario === 1 // Marca especial para el admin principal
    }));

    registrar_transaccion({ 
      modulo: 'autenticacion', 
      accion: 'buscar_usuarios', 
      estado: 'exito', 
      usuario: req.user?.usuario, 
      mensaje: `Búsqueda de usuarios: "${q}" - ${resultado.rows.length} resultados`
    });
    
    res.json({ 
      exito: true, 
      usuarios: usuariosFormateados,
      total: usuariosFormateados.length
    });
    
  } catch (error) {
    log_error('Error en /admin/usuarios/buscar', { 
      error: error.message, 
      usuario: req.user?.usuario,
      query: req.query
    });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Ruta protegida para administradores
router.get('/admin/usuarios/buscar', authMiddleware, requiere_rol(['admin', 'administrador']), buscarUsuarios);

// Asignar rol a usuario (solo para administradores)
const asignarRolUsuario = async (req, res) => {
  try {
    const { id_usuario, rol } = req.body;
    
    if (!id_usuario || !rol) {
      return res.status(400).json({ error: 'ID de usuario y rol son requeridos' });
    }

    // PROTECCIÓN ESPECIAL: El admin principal (id_usuario = 1) no puede cambiar de rol
    const idUsuarioNumerico = parseInt(id_usuario, 10);
    console.log(`[DEBUG] Intentando cambiar rol - ID recibido: ${id_usuario}, ID parseado: ${idUsuarioNumerico}, tipo: ${typeof idUsuarioNumerico}`);
    
    // Primero verificar si es el admin por ID (método principal)
    if (idUsuarioNumerico === 1) {
      console.log('[DEBUG] BLOQUEADO: Intento de cambiar rol al admin principal por ID');
      return res.status(403).json({ 
        error: 'Acción prohibida',
        detalle: 'El usuario administrador principal (ID: 1) no puede cambiar de rol por seguridad del sistema'
      });
    }
    
    // Verificar si es el admin principal por nombre de usuario (método alternativo)
    const usuarioInfo = await consultar('SELECT usuario FROM usuarios WHERE id_usuario = $1', [idUsuarioNumerico]);
    if (usuarioInfo.rows.length > 0) {
      const nombreUsuario = usuarioInfo.rows[0].usuario;
      // Si el usuario es 'admin' y tiene ID bajo (posible admin principal), también bloquear
      if (nombreUsuario === 'admin' && idUsuarioNumerico <= 5) {
        console.log(`[DEBUG] BLOQUEADO: Intento de cambiar rol al usuario 'admin' con ID ${idUsuarioNumerico}`);
        return res.status(403).json({ 
          error: 'Acción prohibida',
          detalle: 'El usuario administrador principal no puede cambiar de rol por seguridad del sistema'
        });
      }
    }

    // Validar que el rol no sea admin o administrador (solo admin original puede asignar admin)
    if (rol === 'admin' || rol === 'administrador') {
      // Verificar que el usuario que hace la petición sea admin
      const usuarioActual = await obtener_usuario_por_usuario(req.user.usuario);
      if (!usuarioActual || (usuarioActual.rol !== 'admin' && usuarioActual.rol !== 'administrador')) {
        return res.status(403).json({ error: 'No tienes permisos para asignar el rol de administrador' });
      }
    }

    // Verificar que el usuario existe
    const usuarioExistente = await consultar('SELECT id_usuario, usuario, nombre, rol FROM usuarios WHERE id_usuario = $1', [id_usuario]);
    if (usuarioExistente.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const usuarioActual = usuarioExistente.rows[0];
    
    // Actualizar el rol
    const usuarioActualizado = await actualizar_rol_usuario(id_usuario, rol);
    
    if (!usuarioActualizado) {
      return res.status(500).json({ error: 'Error al actualizar el rol del usuario' });
    }

    registrar_transaccion({ 
      modulo: 'autenticacion', 
      accion: 'asignar_rol', 
      estado: 'exito', 
      usuario: req.user?.usuario, 
      mensaje: `Rol cambiado para ${usuarioActual.usuario}: ${usuarioActual.rol} → ${rol}`
    });
    
    res.json({ 
      exito: true, 
      mensaje: `Rol actualizado exitosamente para ${usuarioActual.usuario}`,
      usuario: {
        id_usuario: usuarioActualizado.id_usuario,
        usuario: usuarioActualizado.usuario,
        nombre: usuarioActualizado.nombre,
        rol: usuarioActualizado.rol
      }
    });
    
  } catch (error) {
    log_error('Error en /admin/usuarios/asignar-rol', { 
      error: error.message, 
      usuario: req.user?.usuario,
      body: req.body
    });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Ruta de utilidad para verificar el admin principal (solo para debugging)
router.get('/admin/verificar-admin-principal', authMiddleware, requiere_rol(['admin', 'administrador']), async (req, res) => {
  try {
    const result = await consultar('SELECT id_usuario, usuario, nombre, rol FROM usuarios WHERE rol IN ($1, $2) ORDER BY id_usuario ASC LIMIT 5', ['admin', 'administrador']);
    res.json({ 
      admins: result.rows,
      mensaje: 'El admin principal debería ser el que tenga id_usuario = 1'
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al verificar admins' });
  }
});

// Ruta protegida para asignar roles
router.post('/admin/usuarios/asignar-rol', authMiddleware, requiere_rol(['admin', 'administrador']), asignarRolUsuario);

module.exports = router;

// Ruta de utilidad de desarrollo para resetear contraseña de un usuario (protegida por clave)
if ((process.env.NODE_ENV || 'development') === 'development') {
  router.post('/dev/reset-password', async (req, res) => {
    try {
      const { usuario, nueva_contrasena, key } = req.body || {};
      const expectedKey = process.env.MIGRATION_KEY || 'dev-key';
      if (!usuario || !nueva_contrasena || !key) {
        return res.status(400).json({ error: 'Parámetros inválidos' });
      }
      if (key !== expectedKey) {
        return res.status(401).json({ error: 'Clave inválida' });
      }
      const existente = await obtener_usuario_por_usuario(usuario);
      if (!existente) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      const salt = await bcrypt.genSalt(10);
      const nuevoHash = await bcrypt.hash(nueva_contrasena, salt);
    await consultar(
      'UPDATE usuarios SET password = $1, password_hash = $2, requiere_cambio_contrasena = false, fecha_actualizacion = NOW() WHERE usuario = $3',
      [nueva_contrasena, nuevoHash, existente.usuario]
    );
      res.json({ exito: true, mensaje: 'Contraseña actualizada (dev)' });
    } catch (error) {
      console.error('Error en /dev/reset-password:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });
  // Ruta de prueba de verificación de rol (sólo en desarrollo)
  router.get('/dev/solo_admin', authMiddleware, requiere_rol(['admin', 'administrador']), async (req, res) => {
    try {
      res.json({ exito: true, mensaje: 'Acceso permitido solo para rol admin/administrador' });
    } catch (error) {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });
}

// =============================
// ADMIN: Listado de contraseñas temporales
// =============================
// Nota: Este endpoint expone la columna "password" (texto plano) tal como está en la BD actual.
// Está protegido por autenticación y rol admin. Úselo sólo para compartir la contraseña temporal
// al usuario fuera de la plataforma. Considere en el futuro reemplazarlo por un mecanismo más seguro.
router.get('/admin/contrasenas_temporales', authMiddleware, requiere_rol(['admin', 'administrador']), async (req, res) => {
  try {
    const result = await consultar(
      `SELECT id_usuario, usuario, nombre, password AS contrasena_temporal, requiere_cambio_contrasena, fecha_actualizacion
       FROM usuarios
       WHERE requiere_cambio_contrasena = true
       ORDER BY fecha_actualizacion DESC`
    );
    res.json({ exito: true, usuarios: result.rows });
  } catch (error) {
    log_error('Error en /admin/contrasenas_temporales', { error: error.message, usuario: req.user?.usuario });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// =============================
// ADMIN: Roles y asignación de roles
// =============================
// Lista de roles únicos presentes en la tabla usuarios, excluyendo 'pendiente'
router.get('/admin/roles_unicos', authMiddleware, requiere_rol(['admin', 'administrador']), async (req, res) => {
  try {
    const result = await consultar(
      "SELECT DISTINCT LOWER(TRIM(rol)) AS rol FROM usuarios WHERE rol IS NOT NULL AND TRIM(rol) <> '' AND LOWER(rol) <> 'pendiente' ORDER BY rol"
    );
    const roles = (result.rows || []).map(r => r.rol);
    return res.json({ roles });
  } catch (error) {
    log_error('Error en /admin/roles_unicos', { error: error.message });
    return res.status(500).json({ error: 'Error obteniendo roles únicos', detalle: error.message });
  }
});

router.get('/admin/permisos', authMiddleware, requiere_rol(['admin', 'administrador']), async (req, res) => {
  try {
    const permisos = await listar_permisos_por_rol();
    const r = await consultar('SELECT rol, MAX(alias) AS alias FROM permisos_roles GROUP BY rol');
    const aliases = {};
    for (const row of r.rows || []) {
      const rol = String(row.rol || '').trim().toLowerCase();
      const alias = String(row.alias || '').trim();
      if (!rol || !alias) continue;
      aliases[rol] = alias;
    }
    return res.json({ permisos, aliases });
  } catch (error) {
    return res.status(500).json({ error: 'Error obteniendo permisos', detalle: error.message });
  }
});

router.put('/admin/permisos/:rol', authMiddleware, requiere_rol(['admin', 'administrador']), async (req, res) => {
  try {
    const rol = String(req.params.rol || '').trim().toLowerCase();
    const permisos = Array.isArray(req.body?.permisos) ? req.body.permisos.map(String) : [];
    const alias = typeof req.body?.alias === 'string' ? String(req.body.alias).trim() : null;
    await reemplazar_permisos_de_rol(rol, permisos, alias);
    return res.json({ exito: true });
  } catch (error) {
    return res.status(500).json({ error: 'Error guardando permisos', detalle: error.message });
  }
});

// Permisos del rol actual (acceso general para usuarios autenticados)
router.get('/permisos_mi_rol', authMiddleware, async (req, res) => {
  try {
    let rol = String(req.user?.rol || '').trim().toLowerCase();
    if (!rol) {
      const existente = await obtener_usuario_por_usuario(req.user?.usuario);
      rol = String(existente?.rol || 'pendiente').trim().toLowerCase();
    }
    const lista = await obtener_permisos_de_rol(rol);
    return res.json({ exito: true, rol, permisos: Array.isArray(lista) ? lista : [] });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'Error obteniendo permisos de rol actual', detalle: error.message });
  }
});

router.get('/admin/roles_aliases', authMiddleware, requiere_rol(['admin', 'administrador']), async (req, res) => {
  try {
    const rP = await consultar('SELECT rol, MAX(alias) AS alias FROM permisos_roles GROUP BY rol');
    const aliases = {};
    for (const row of rP.rows || []) {
      const k = String(row.rol || '').trim().toLowerCase();
      const v = String(row.alias || '').trim();
      if (!k || !v) continue;
      aliases[k] = v;
    }
    return res.json({ exito: true, aliases });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'Error obteniendo aliases', detalle: error.message });
  }
});

router.put('/admin/roles_aliases', authMiddleware, requiere_rol(['admin', 'administrador']), async (req, res) => {
  try {
    const rol = String(req.body?.rol || '').trim().toLowerCase();
    const alias = String(req.body?.alias || '').trim();
    if (!rol || !alias) {
      return res.status(400).json({ exito: false, error: 'Parámetros inválidos' });
    }
    await actualizar_alias_de_rol(rol, alias);
    return res.json({ exito: true });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'Error guardando alias', detalle: error.message });
  }
});

router.delete('/admin/usuarios/:id', authMiddleware, requiere_rol(['admin', 'administrador']), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID de usuario inválido' });
    }
    if (id === 1) {
      return res.status(403).json({ error: 'No se puede eliminar el administrador principal' });
    }
    const ok = await eliminar_usuario_por_id(id);
    if (!ok) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    registrar_transaccion({ modulo: 'autenticacion', accion: 'eliminar_usuario', estado: 'exito', usuario: req.user?.usuario, datos: { id_usuario: id } });
    return res.json({ exito: true });
  } catch (error) {
    log_error('Error en DELETE /admin/usuarios/:id', { error: error.message, params: req.params });
    return res.status(500).json({ error: 'Error eliminando usuario', detalle: error.message });
  }
});

// Actualizar datos de usuario (nombre, estatus)
router.put('/admin/usuarios/:id', authMiddleware, requiere_rol(['admin', 'administrador']), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID de usuario inválido' });
    }
    const { nombre, activo, estatus } = req.body || {};
    const estadoFinal = typeof estatus === 'string' ? String(estatus).trim().toLowerCase() : (typeof activo === 'boolean' ? (activo ? 'activo' : 'inactivo') : undefined);
    const actualizado = await actualizar_usuario_campos(id, { nombre, estatus: estadoFinal });
    if (!actualizado) {
      return res.status(400).json({ error: 'Sin cambios o datos inválidos' });
    }
    return res.json({ exito: true, usuario: actualizado });
  } catch (error) {
    return res.status(500).json({ error: 'Error actualizando usuario', detalle: error.message });
  }
});

router.post('/admin/usuarios/eliminar', authMiddleware, requiere_rol(['admin', 'administrador']), async (req, res) => {
  try {
    const id = parseInt(req.body?.id_usuario, 10);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID de usuario inválido' });
    }
    if (id === 1) {
      return res.status(403).json({ error: 'No se puede eliminar el administrador principal' });
    }
    const ok = await eliminar_usuario_por_id(id);
    if (!ok) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    registrar_transaccion({ modulo: 'autenticacion', accion: 'eliminar_usuario', estado: 'exito', usuario: req.user?.usuario, datos: { id_usuario: id } });
    return res.json({ exito: true });
  } catch (error) {
    log_error('Error en POST /admin/usuarios/eliminar', { error: error.message, body: req.body });
    return res.status(500).json({ error: 'Error eliminando usuario', detalle: error.message });
  }
});

// =============================
// ADMIN: Eliminar rol del sistema
// =============================
// Elimina un rol completamente del sistema, pasando todos los usuarios con ese rol a 'pendiente'
router.delete('/admin/roles/:rol', authMiddleware, requiere_rol(['admin', 'administrador']), async (req, res) => {
  try {
    const rolAEliminar = String(req.params.rol || '').trim().toLowerCase();
    
    if (!rolAEliminar) {
      return res.status(400).json({ error: 'Rol no especificado' });
    }
    
    // No permitir eliminar roles críticos del sistema
    if (rolAEliminar === 'admin' || rolAEliminar === 'administrador' || rolAEliminar === 'pendiente') {
      return res.status(403).json({ 
        error: 'No se puede eliminar el rol administrador o pendiente',
        detalle: 'Estos roles son críticos para el funcionamiento del sistema'
      });
    }
    
    // Verificar que el rol existe (que haya usuarios con ese rol)
    const verificarRol = await consultar(
      'SELECT COUNT(*) as total FROM usuarios WHERE LOWER(TRIM(rol)) = $1',
      [rolAEliminar]
    );
    
    if (verificarRol.rows[0].total === 0) {
      return res.status(404).json({ 
        error: 'Rol no encontrado',
        detalle: 'No hay usuarios con ese rol en el sistema'
      });
    }
    
    // Actualizar todos los usuarios con ese rol a 'pendiente'
    const resultado = await consultar(
      'UPDATE usuarios SET rol = $1, fecha_actualizacion = NOW() WHERE LOWER(TRIM(rol)) = $2',
      ['pendiente', rolAEliminar]
    );
    
    // Eliminar también los permisos asociados a ese rol en la tabla permisos_roles
    await consultar(
      'DELETE FROM permisos_roles WHERE LOWER(TRIM(rol)) = $1',
      [rolAEliminar]
    );
    
    registrar_transaccion({ 
      modulo: 'autenticacion', 
      accion: 'eliminar_rol', 
      estado: 'exito', 
      usuario: req.user?.usuario, 
      mensaje: `Rol eliminado: ${rolAEliminar} - ${resultado.rowCount} usuarios afectados`
    });
    
    return res.json({ 
      exito: true, 
      mensaje: `Rol '${rolAEliminar}' eliminado exitosamente. ${resultado.rowCount} usuarios pasaron a estado pendiente.`,
      usuarios_afectados: resultado.rowCount
    });
    
  } catch (error) {
    log_error('Error en DELETE /admin/roles/:rol', { 
      error: error.message, 
      usuario: req.user?.usuario,
      rol: req.params.rol
    });
    return res.status(500).json({ 
      error: 'Error al eliminar el rol',
      detalle: error.message 
    });
  }
});

// Usuarios con rol 'pendiente' (a quienes se les puede asignar un rol)
router.get('/admin/usuarios_pendientes', authMiddleware, requiere_rol(['admin', 'administrador']), async (req, res) => {
  try {
    const result = await consultar(
      "SELECT id_usuario, usuario, nombre, rol FROM usuarios WHERE id_usuario != 1 AND LOWER(COALESCE(rol, 'pendiente')) = 'pendiente' ORDER BY nombre NULLS LAST, usuario"
    );
    return res.json({ usuarios: result.rows || [] });
  } catch (error) {
    log_error('Error en /admin/usuarios_pendientes', { error: error.message });
    return res.status(500).json({ error: 'Error obteniendo usuarios pendientes', detalle: error.message });
  }
});

// Asignar/actualizar el rol de un usuario por id_usuario
router.put('/admin/usuarios/:id/rol', authMiddleware, requiere_rol(['admin', 'administrador']), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rol } = req.body || {};
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID de usuario inválido' });
    }
    
    // PROTECCIÓN ESPECIAL: El admin principal (id_usuario = 1) no puede cambiar de rol
    if (id === 1) {
      return res.status(403).json({ 
        error: 'Acción prohibida',
        detalle: 'El usuario administrador principal (ID: 1) no puede cambiar de rol por seguridad del sistema'
      });
    }
    
    const rol_normalizado = String(rol || '').trim().toLowerCase();
    if (!rol_normalizado || rol_normalizado === 'pendiente') {
      return res.status(400).json({ error: 'Rol inválido. No puede ser "pendiente"' });
    }

    const result = await consultar(
      'UPDATE usuarios SET rol = $1, fecha_actualizacion = NOW() WHERE id_usuario = $2 RETURNING id_usuario, usuario, nombre, rol',
      [rol_normalizado, id]
    );
    const actualizado = result.rows?.[0];
    if (!actualizado) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    registrar_transaccion({ modulo: 'autenticacion', accion: 'asignar_rol', estado: 'exito', usuario: req.user?.usuario, mensaje: `rol asignado: ${rol_normalizado}`, datos: { id_usuario: id } });
    return res.json({ exito: true, usuario: actualizado });
  } catch (error) {
    log_error('Error en /admin/usuarios/:id/rol', { error: error.message, params: req.params });
    return res.status(500).json({ error: 'Error asignando rol', detalle: error.message });
  }
});

// =============================================
// Subida de fotografía de usuario (protegido)
// =============================================
// Guarda la imagen en /public/fotos_usuario y la renombra como id_usuario_nombre.ext
// - Reemplaza espacios por guiones bajos (_)
// - Permite JPEG y PNG, límite 5MB
// - Devuelve la URL pública relativa (para usar desde el frontend)

// Asegurar directorio destino
const DIR_UPLOADS = path.resolve(__dirname, '..', 'archivos');
const DIR_FOTOS = path.join(DIR_UPLOADS, 'fotos_usuario');
const DIR_FOTOS_PREVIEW = path.join(DIR_FOTOS, 'avatar');
try {
  if (!fs.existsSync(DIR_FOTOS)) {
    fs.mkdirSync(DIR_FOTOS, { recursive: true });
  }
  if (!fs.existsSync(DIR_FOTOS_PREVIEW)) {
    fs.mkdirSync(DIR_FOTOS_PREVIEW, { recursive: true });
  }
} catch (e) {
  console.error('No se pudo crear el directorio de fotos:', e.message);
}

// Configuración de Multer
const filtro_archivo = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Formato inválido. Solo se permiten imágenes JPEG y PNG'));
};

const almacenamiento = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const destino = file.fieldname === 'foto_preview' ? DIR_FOTOS_PREVIEW : DIR_FOTOS;
      cb(null, destino);
    } catch (e) {
      cb(null, DIR_FOTOS);
    }
  },
  filename: (req, file, cb) => {
    try {
      const id_usuario = req.info_usuario?.id_usuario || req.user?.id_usuario || 'usuario';
      const nombre_base = (req.info_usuario?.nombre || req.user?.usuario || 'usuario').toString();
      const nombre_normalizado = nombre_base.trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_-]/g, '_');
      // Usar el mimetype para determinar la extensión real del archivo que estamos guardando
      const extension_final = (file.mimetype === 'image/png') ? '.png' : '.jpg';
      // Antes de guardar, eliminar cualquier archivo previo del usuario con extensiones soportadas en el destino correspondiente
      try {
        const baseDir = file.fieldname === 'foto_preview' ? DIR_FOTOS_PREVIEW : DIR_FOTOS;
        ['.jpg', '.jpeg', '.png'].forEach((ext) => {
          const anterior = path.join(baseDir, `${id_usuario}_${nombre_normalizado}${ext}`);
          if (fs.existsSync(anterior) && ext !== extension_final) {
            try { fs.unlinkSync(anterior); } catch (e) {}
          }
        });
      } catch (e) {
        // Continuar aunque falle la eliminación
      }
      const nombre_archivo = `${id_usuario}_${nombre_normalizado}${extension_final}`;
      cb(null, nombre_archivo);
    } catch (e) {
      const fallbackExt = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `foto_${Date.now()}${fallbackExt}`);
    }
  }
});

const cargar_archivo = multer({ storage: almacenamiento, fileFilter: filtro_archivo, limits: { fileSize: 5 * 1024 * 1024 } });

// Middleware para cargar info del usuario (nombre) antes de la subida
const cargar_info_usuario = async (req, res, next) => {
  try {
    const existente = await obtener_usuario_por_usuario(req.user?.usuario);
    req.info_usuario = {
      id_usuario: existente?.id_usuario || req.user?.id_usuario,
      nombre: existente?.nombre || req.user?.usuario,
    };
    return next();
  } catch (error) {
    return next(error);
  }
};

router.post('/subir_foto', authMiddleware, cargar_info_usuario, (req, res) => {
  // Usar .any() para evitar errores de "Unexpected field" si el cliente envía campos adicionales
  cargar_archivo.any()(req, res, (err) => {
    if (err) {
      registrar_transaccion({ modulo: 'autenticacion', accion: 'subir_foto', estado: 'error', usuario: req.user?.usuario, mensaje: err.message });
      return res.status(400).json({ error: err.message });
    }
    try {
      const lista = req.files || [];
      const archivo_principal = lista.find(f => f.fieldname === 'foto')?.filename;
      if (!archivo_principal) {
        return res.status(400).json({ error: 'No se recibió archivo' });
      }
      const url = `/fotos_usuario/${archivo_principal}`;
      let preview_url = null;
      const archivo_preview = lista.find(f => f.fieldname === 'foto_preview')?.filename;
      if (archivo_preview) {
        preview_url = `/fotos_usuario/avatar/${archivo_preview}`;
      }
      registrar_transaccion({ modulo: 'autenticacion', accion: 'subir_foto', estado: 'exito', usuario: req.user?.usuario, datos: { archivo: archivo_principal, preview: archivo_preview || null } });
      return res.json({ exito: true, url, preview_url, nombre_archivo: archivo_principal });
    } catch (error) {
      log_error('Error en /subir_foto', { error: error.message, usuario: req.user?.usuario });
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  });
});

// Obtener URL de la foto actual del usuario (si existe)
router.get('/foto', authMiddleware, async (req, res) => {
  try {
    const id = req.user?.id_usuario;
    if (!id) {
      return res.status(400).json({ exito: false, error: 'ID de usuario no disponible en token' });
    }
    const prefijo = `${id}_`;
    const extensiones = ['.png', '.jpg', '.jpeg'];
    let encontrada = null;
    const archivos = await fs.promises.readdir(DIR_FOTOS);
    for (const nombre of archivos) {
      if (nombre.startsWith(prefijo) && extensiones.some(ext => nombre.toLowerCase().endsWith(ext))) {
        encontrada = nombre;
        break;
      }
    }
    if (!encontrada) {
      return res.status(404).json({ exito: false, error: 'Foto no encontrada' });
    }
  // si existe un preview para el mismo nombre, devolver también su URL
  let previewUrl = null;
  try {
      const archivosPrev = await fs.promises.readdir(DIR_FOTOS_PREVIEW);
      const base = encontrada.replace(/\.(png|jpg|jpeg)$/i, '');
      const posibles = [`${base}.png`, `${base}.jpg`, `${base}.jpeg`];
      const tienePrev = archivosPrev.find(n => posibles.includes(n));
      if (tienePrev) {
        previewUrl = `/fotos_usuario/avatar/${tienePrev}`;
      }
  } catch (e) {}
  return res.json({ exito: true, url: `/fotos_usuario/${encontrada}`, preview_url: previewUrl });
  } catch (error) {
    log_error('Error en /foto', { error: error.message, usuario: req.user?.usuario });
    return res.status(500).json({ exito: false, error: 'Error interno del servidor' });
  }
});
