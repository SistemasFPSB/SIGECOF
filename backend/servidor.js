// Servidor principal del backend - Sistema de Gestión de Facturas (SIGECOF)
// Nota: PORT se lee desde .env (por defecto 5001 en desarrollo)
// Importación de dependencias principales
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const https = require('https');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const cookie = require('cookie');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const raizProyecto = path.resolve(__dirname, '..');
const archivoEnv = [
  path.join(raizProyecto, '.env.local'),
  path.join(raizProyecto, `.env.${process.env.NODE_ENV || 'development'}`),
  path.join(raizProyecto, '.env'),
].find((p) => {
  try { return fs.existsSync(p); } catch (_) { return false; }
});
dotenv.config(archivoEnv ? { path: archivoEnv, quiet: true } : { quiet: true });

// Configuración de la aplicación Express
const app = express();
const PORT = process.env.PORT || 5000;
const SERVER_LOG_DETALLE = process.env.SERVER_LOG_DETALLE === 'true';

// Configuración de middleware de seguridad
// Middleware

// Helmet por defecto envía Cross-Origin-Resource-Policy: same-origin,
// lo que bloquea la carga de imágenes desde http://localhost:3000 cuando el backend está en http://localhost:5000.
// Configuramos CORP para permitir recursos estáticos cross-origin.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));


// Configuración de limitación de velocidad
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000,
  // Devolver SIEMPRE JSON para evitar errores de parseo en el cliente
  message: { error: 'Demasiadas solicitudes desde esta IP, intenta de nuevo más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // En desarrollo, no aplicar rate limiting a autenticación ni a salud
    if ((process.env.NODE_ENV || 'development') === 'development') {
      const url = req.originalUrl || req.url || '';
      if (url.startsWith('/api/autenticacion') || url.startsWith('/api/health')) {
        return true;
      }
    }
    return false;
  }
});
// Aplicar el limitador solo al espacio /api (no a archivos estáticos)
app.use('/api', limiter);

// Configuración de CORS (Cross-Origin Resource Sharing)
const ALLOWED_ORIGINS = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const ORIGIN_REGEX = [
  /^https?:\/\/localhost(?::\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?$/,
  /^https?:\/\/192\.168\.[0-9]{1,3}\.[0-9]{1,3}(?::\d+)?$/,
  /^https?:\/\/10\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}(?::\d+)?$/,
  /^https?:\/\/[a-z0-9-]+\.local(?::\d+)?$/,
  /^https?:\/\/[a-z0-9-]+\.lan(?::\d+)?$/,
  /^https?:\/\/[a-z0-9-]+(?::\d+)?$/,
];

app.use(cors({
  origin: (origin, callback) => {
    const isDev = ((process.env.NODE_ENV || 'development') === 'development');
    if (isDev) return callback(null, true);
    if (!origin) return callback(null, true);
    const permitidoLista = ALLOWED_ORIGINS.includes(origin);
    const permitidoRegex = ORIGIN_REGEX.some(rx => rx.test(origin));
    if (permitidoLista || permitidoRegex) return callback(null, true);
    return callback(new Error('Origen no permitido: ' + origin), false);
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Authorization','Content-Type','Accept','Origin','X-Requested-With'],
  exposedHeaders: ['Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Middleware para procesamiento de datos JSON y URL
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Servir archivos estáticos desde la carpeta /public en la raíz del proyecto
// Esto garantiza que las imágenes guardadas en d:\00_CODING\00_PYTHON\00_DEV\sigecof\public\fotos_usuario estén disponibles
// Nota: __dirname apunta a .../sigecof/backend, por lo que subir un nivel llega a .../sigecof
// Usar solo '..' para que el directorio público sea .../sigecof/public
const PROJECT_PUBLIC_DIR = path.resolve(__dirname, '..', 'frontend', 'public');
app.use(express.static(PROJECT_PUBLIC_DIR));
// Servir archivos migrados fuera de /public
const ARCHIVOS_DIR = path.resolve(__dirname, 'archivos');
app.use('/archivos', express.static(ARCHIVOS_DIR));
// Alias de compatibilidad para rutas antiguas
app.use('/fotos_usuario', express.static(path.join(ARCHIVOS_DIR, 'fotos_usuario')));
app.use('/carrusel', express.static(path.join(ARCHIVOS_DIR, 'carrusel')));
app.use('/pantalla_inicial', express.static(path.join(ARCHIVOS_DIR, 'pantalla_inicial')));
 // Rutas de gestión de proveedores

// Importación de configuración de base de datos
const { probar_conexion, consultar } = require('./configuracion/base_datos');
const { asegurar_tabla_usuarios, migrar_contrasenas } = require('./modelos/usuarios');
const { asegurar_tabla_carrusel } = require('./modelos/carrusel');
const { asegurar_tabla_comunicados } = require('./modelos/comunicados');
const autenticacionRouter = require('./rutas/autenticacion');
const carruselRouter = require('./rutas/carrusel');
const comunicadosRouter = require('./rutas/comunicados');
const archivosRouter = require('./rutas/archivos');
const notificacionesEventosRouter = require('./rutas/notificaciones_eventos');
const notificacionesConfiguracionRouter = require('./rutas/notificaciones_configuracion');
const boletinesRouter = require('./rutas/boletines');
const normatividadRouter = require('./rutas/normatividad');
const { asegurar_tabla_boletines } = require('./modelos/boletines');
const { asegurar_tabla_normatividad } = require('./modelos/normatividad');


// Ruta de verificación de estado del servidor (health check)
app.get('/api/health', async (req, res) => {
  try {
    // Usar la función alias en español ya importada
    const dbStatus = await probar_conexion();
    
    res.json({ 
      status: 'OK', 
      message: 'SIGECOF API funcionando correctamente',
      database: dbStatus ? 'Conectada' : 'Desconectada',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      message: 'Problemas de conectividad',
      database: 'Error de conexión',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/_debug/cookies', async (req, res) => {
  try {
    const raw = req.headers.cookie || '';
    const parsed = cookie.parse(raw || '');
    res.json({
      cookies: parsed,
      headers: {
        origin: req.headers.origin || null,
        cookie: req.headers.cookie || null,
        host: req.headers.host || null,
        authorization: req.headers.authorization || null,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'debug cookies error', detalle: error.message });
  }
});

app.get('/api/_debug/sesion', async (req, res) => {
  try {
    const raw = req.headers.cookie || '';
    const parsed = cookie.parse(raw || '');
    const sid = parsed.sid || parsed.sigecof_session || null;
    let sesion = null;
    let usuario = null;
    if (sid) {
      const r = await consultar('SELECT sid, id_usuario, rol, expira_en, creado_en FROM sesiones WHERE sid = $1 LIMIT 1', [sid]);
      sesion = r.rows?.[0] || null;
      if (sesion?.id_usuario) {
        const u = await consultar('SELECT id_usuario, usuario, rol FROM usuarios WHERE id_usuario = $1 LIMIT 1', [sesion.id_usuario]);
        usuario = u.rows?.[0] || null;
      }
    }
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    let token_decod = null;
    if (token) {
      try { token_decod = jwt.verify(token, process.env.JWT_SECRET || 'sigecof-dev-secret'); } catch (_) {}
    }
    res.json({ sid, sesion, usuario, token_presente: !!token, token_decod });
  } catch (error) {
    res.status(500).json({ error: 'debug sesion error', detalle: error.message });
  }
});

app.get('/api/preferencias/roles/etiquetas', async (req, res) => {
  try {
    const rP = await consultar('SELECT rol, MAX(alias) AS alias FROM permisos_roles GROUP BY rol');
    const etiquetas = {};
    for (const row of rP.rows || []) {
      const k = String(row.rol || '').trim().toLowerCase();
      const v = String(row.alias || '').trim();
      if (!k || !v) continue;
      etiquetas[k] = v;
    }
    return res.json({ etiquetas });
  } catch (error) {
    return res.status(500).json({ error: 'Error obteniendo etiquetas', detalle: error.message });
  }
});

app.put('/api/preferencias/roles/etiquetas', async (req, res) => {
  const rol = String(req.body?.rol || '').trim().toLowerCase();
  const etiqueta = String(req.body?.etiqueta || '').trim();
  if (!rol || !etiqueta) return res.status(400).json({ exito: false, error: 'Datos inválidos' });
  try {
    const { actualizar_alias_de_rol } = require('./modelos/permisos_roles');
    await actualizar_alias_de_rol(rol, etiqueta);
    const rP = await consultar('SELECT rol, MAX(alias) AS alias FROM permisos_roles GROUP BY rol');
    const etiquetas = {};
    for (const row of rP.rows || []) {
      const k = String(row.rol || '').trim().toLowerCase();
      const v = String(row.alias || '').trim();
      if (!k || !v) continue;
      etiquetas[k] = v;
    }
    return res.json({ exito: true, etiquetas });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'Error guardando etiqueta', detalle: error.message });
  }
});

// Rutas de autenticación (solo español, snake_case)
app.use('/api/autenticacion', autenticacionRouter);
// Rutas del carrusel (subida de imágenes y archivos)
app.use('/api/carrusel', carruselRouter);
app.use('/api/archivos', archivosRouter);
app.use('/api/comunicados', comunicadosRouter);
app.use(notificacionesEventosRouter);
app.use(notificacionesConfiguracionRouter);
app.use('/api/boletines', boletinesRouter);
app.use('/api/normatividad', normatividadRouter);


// Manejo de rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Ruta no encontrada',
    message: `La ruta ${req.originalUrl} no existe en esta API`
  });
});

// Manejo global de errores del servidor
app.use((err, req, res, next) => {
  console.error('❌ Error del servidor:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  // No cerrar el servidor por errores de aplicación
  res.status(err.status || 500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo salió mal',
    timestamp: new Date().toISOString()
  });
});

const intentar_conexion_inicial = async (reintentos = 8, intervalo_ms = 2000) => {
  for (let intento = 1; intento <= reintentos; intento++) {
    const ok = await probar_conexion();
    if (ok) return true;
    await new Promise(r => setTimeout(r, intervalo_ms * intento));
  }
  return false;
};

const USE_HTTPS = String(process.env.HTTPS_ENABLED || '').toLowerCase() === 'true';
const HTTPS_PORT = process.env.HTTPS_PORT || PORT;
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || '';
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || '';

const onStart = async () => {
  const actualPort = (server && server.address && server.address().port) ? server.address().port : (USE_HTTPS ? HTTPS_PORT : PORT);
  console.log(`🚀 Servidor SIGECOF ejecutándose en puerto ${actualPort}`);
  console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
  const DB_NAME_SHOW = process.env.DB_NAME || process.env.PGDATABASE || 'sigecof';
  const DB_HOST_SHOW = process.env.DB_HOST || process.env.PGHOST || 'localhost';
  const DB_PORT_SHOW = process.env.DB_PORT || process.env.PGPORT || '5432';
  console.log(`📊 Base de datos: ${DB_NAME_SHOW}@${DB_HOST_SHOW}:${DB_PORT_SHOW}`);

  try {
    const conectado = await intentar_conexion_inicial(8, 2000);
    if (!conectado) {
      throw new Error('No disponible');
    }
    console.log('✅ Conexión inicial a base de datos exitosa');
    await asegurar_tabla_usuarios();
    if (SERVER_LOG_DETALLE) { console.log('✅ Tabla "usuarios" verificada/creada correctamente'); }
    await asegurar_tabla_carrusel();
    if (SERVER_LOG_DETALLE) { console.log('✅ Tabla "carrusel_banners" verificada/creada correctamente'); }
    await asegurar_tabla_comunicados();
    if (SERVER_LOG_DETALLE) { console.log('✅ Tabla "comunicados" verificada/creada correctamente'); }
    await asegurar_tabla_boletines();
    if (SERVER_LOG_DETALLE) { console.log('✅ Tabla "boletines" verificada/creada correctamente'); }
    await asegurar_tabla_normatividad();

    await consultar(`
      CREATE TABLE IF NOT EXISTS sesiones (
        sid VARCHAR(64) PRIMARY KEY,
        id_usuario INTEGER NOT NULL,
        rol VARCHAR(64) NOT NULL,
        expira_en TIMESTAMP NOT NULL,
        creado_en TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await consultar(`
      CREATE TABLE IF NOT EXISTS notificaciones_eventos (
        id_evento SERIAL PRIMARY KEY,
        tipo VARCHAR(32) NOT NULL,
        titulo TEXT,
        mensaje TEXT,
        marca_temporal TIMESTAMP NOT NULL DEFAULT NOW(),
        leido BOOLEAN NOT NULL DEFAULT FALSE,
        rol_destinatario VARCHAR(64),
        ruta_sugerida VARCHAR(128),
        datos JSONB,
        prioridad VARCHAR(16) NOT NULL DEFAULT 'media'
      )
    `);
    await consultar(`
      CREATE TABLE IF NOT EXISTS notificaciones_configuracion (
        id SERIAL PRIMARY KEY,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        titulo_regla TEXT,
        mensaje TEXT,
        trigger_id TEXT,
        tipo VARCHAR(32) NOT NULL DEFAULT 'informacion',
        prioridad VARCHAR(16) NOT NULL DEFAULT 'media',
        rol_origen VARCHAR(64) NOT NULL DEFAULT 'cualquiera',
        seccion_accion TEXT,
        roles_destino TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
        ruta_sugerida TEXT
      )
    `);
    const { asegurar_tabla_permisos_roles } = require('./modelos/permisos_roles');
    await asegurar_tabla_permisos_roles();
    const existeAdmin = await consultar('SELECT COUNT(*) AS total FROM permisos_roles WHERE rol = $1', ['admin']);
    const totalAdmin = Number(existeAdmin.rows?.[0]?.total || 0);
    if (totalAdmin === 0) {
      const minimos = ['inicio','administrador','gestionar_usuarios','contrasenas_temporales','roles_permisos'];
      for (const id of minimos) {
        try { await consultar('INSERT INTO permisos_roles (rol, alias, id_seccion) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', ['admin', 'Administrador del Sistema', id]); } catch (_) {}
      }
      if (SERVER_LOG_DETALLE) { console.log('✅ Sembrados permisos mínimos para admin'); }
    }
    if (SERVER_LOG_DETALLE) { console.log('✅ Tabla "normatividad" verificada/creada correctamente'); }
    const mig = await migrar_contrasenas();
    if (mig?.migrated || mig?.copied) {
      if (SERVER_LOG_DETALLE) { console.log(`🔄 Resumen migración: hashed=${mig.migrated || 0}, copied=${mig.copied || 0}`); }
    }

    try {
      const rAdminUsr = await consultar('SELECT COUNT(*) AS total FROM usuarios WHERE LOWER(TRIM(usuario)) = $1', ['admin']);
      const tAdminUsr = Number(rAdminUsr.rows?.[0]?.total || 0);
      if (tAdminUsr === 0) {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash('admin', salt);
        await consultar(
          'INSERT INTO usuarios (nombre, usuario, password, password_hash, rol, estatus, requiere_cambio_contrasena, fecha_registro, fecha_actualizacion) VALUES ($1,$2,$3,$4,$5,$6,FALSE,NOW(),NOW())',
          ['Administrador del Sistema','admin','admin',hash,'admin','activo']
        );
      }
    } catch (_) {}
  } catch (error) {
    console.error('⚠️ Advertencia: No se pudo conectar a la base de datos al inicio');
    console.error('   El servidor continuará ejecutándose, pero algunas funciones pueden no estar disponibles');
    if (error && error.message) { console.error(`   Detalle: ${error.message}`); }
  }
};

let server;
if (USE_HTTPS) {
  try {
    if (!SSL_KEY_PATH || !SSL_CERT_PATH) {
      throw new Error('HTTPS habilitado pero faltan rutas de certificados');
    }
    const key = fs.readFileSync(SSL_KEY_PATH);
    const cert = fs.readFileSync(SSL_CERT_PATH);
    server = https.createServer({ key, cert }, app).listen(HTTPS_PORT, '0.0.0.0', onStart);
  } catch (e) {
    console.error('❌ No se pudieron cargar certificados SSL, iniciando en HTTP');
    server = app.listen(PORT, '0.0.0.0', onStart);
  }
} else {
  server = app.listen(PORT, '0.0.0.0', onStart);
}

// Manejo de errores específicos del servidor
server.on('error', (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Puerto ' + PORT;

  switch (error.code) {
    case 'EACCES':
      console.error(`❌ ${bind} requiere privilegios elevados`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`❌ ${bind} ya está en uso`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

// Manejo de cierre elegante del servidor (graceful shutdown)
process.on('SIGINT', () => {
  console.log('\n🔄 Cerrando servidor gracefully...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('🔄 Cerrando servidor cuidadosamente...');
  server.close(() => {
    console.log('✅ Servidor cerrado correctamente');
    process.exit(0);
  });
});

module.exports = app;
// Endpoint administrativo para recrear tablas de permisos y aliases
const authAdminMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });
    const secret = process.env.JWT_SECRET || 'sigecof-dev-secret';
    const dec = jwt.verify(token, secret);
    if (!['admin','administrador'].includes(String(dec?.rol || ''))) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    req.user = dec;
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

app.post('/api/autenticacion/admin/recrear_tablas_permisos', authAdminMiddleware, async (req, res) => {
  try {
    const { asegurar_tabla_permisos_roles } = require('./modelos/permisos_roles');
    await asegurar_tabla_permisos_roles();
    const minimos = ['inicio','roles_permisos'];
    for (const id of minimos) {
      try { await consultar('INSERT INTO permisos_roles (rol, alias, id_seccion) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', ['admin', 'Administrador del Sistema', id]); } catch (_) {}
    }
    return res.json({ exito: true });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'No se pudo recrear tablas', detalle: error.message });
  }
});
