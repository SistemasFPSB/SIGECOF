import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pkg from 'pg';
import crearRouterAutenticacion from './rutas/autenticacion.js';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';

const { Pool } = pkg;

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cookieParser());
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const FRONTEND_ORIGINS = process.env.FRONTEND_ORIGINS || '';
const CORS_DEV_ALLOW_ANY = String(process.env.CORS_DEV_ALLOW_ANY || 'false').toLowerCase() === 'true';

const normalizarOrigen = (o) => {
  try { return new URL(o).origin; } catch (_) { return String(o || '').trim().replace(/\/$/, ''); }
};
const listaEnv = FRONTEND_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
const allowedOrigins = [
  normalizarOrigen(FRONTEND_URL),
  ...listaEnv.map(normalizarOrigen),
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3030',
  'http://127.0.0.1:3030',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
];
const puertosPermitidosDev = new Set(['3000', '3030']);
const esOrigenDevIpPermitida = (o) => {
  try {
    const u = new URL(o);
    const host = u.hostname || '';
    const port = (u.port || (u.protocol === 'http:' ? '80' : '443'));
    if (!puertosPermitidosDev.has(port)) return false;
    if (/^(localhost|127\.0\.0\.1)$/i.test(host)) return true;
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(host)) return true;
    return false;
  } catch (_) {
    return false;
  }
};
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const origenNorm = normalizarOrigen(origin);
    const ok = CORS_DEV_ALLOW_ANY || allowedOrigins.includes(origenNorm) || esOrigenDevIpPermitida(origin);
    callback(ok ? null : new Error('Origen no permitido'), ok);
  },
  credentials: true,
}));
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  next();
});

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'sigecof',
});

const actualizarAliasRol = async (rol, alias) => {
  const rol_norm = String(rol || '').trim().toLowerCase();
  const alias_norm = String(alias || '').trim();
  if (!rol_norm || !alias_norm) return false;
  const existe = await pool.query('SELECT COUNT(*) AS total FROM permisos_roles WHERE rol = $1', [rol_norm]);
  const total = Number(existe.rows?.[0]?.total || 0);
  if (total === 0) {
    try { await pool.query('INSERT INTO permisos_roles(rol, alias, id_seccion) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [rol_norm, alias_norm, 'inicio']); } catch (_) {}
  }
  const rUpd = await pool.query('UPDATE permisos_roles SET alias = $2 WHERE rol = $1', [rol_norm, alias_norm]);
  return (rUpd.rowCount || 0) > 0;
};

const inicializarTablas = async () => {
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS permisos_roles (
        rol VARCHAR(50) NOT NULL,
        alias VARCHAR(50) NOT NULL,
        id_seccion VARCHAR(100) NOT NULL,
        creado_en TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (rol, id_seccion)
      )`
    );
    await pool.query(
      `CREATE TABLE IF NOT EXISTS roles_aliases (
        rol TEXT PRIMARY KEY,
        alias TEXT NOT NULL,
        actualizado_en TIMESTAMP DEFAULT NOW()
      )`
    );
    const r = await pool.query('SELECT COUNT(*) AS total FROM permisos_roles WHERE rol = $1', ['admin']);
    const hayAdmin = Number(r.rows?.[0]?.total || 0) > 0;
    if (!hayAdmin) {
      const minimos = ['inicio','roles_permisos'];
      for (const id of minimos) {
        try { await pool.query('INSERT INTO permisos_roles (rol, alias, id_seccion) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', ['admin', 'Administrador del Sistema', id]); } catch (_) {}
      }
    }
  } catch (_) {
  }
};
inicializarTablas();

const obtener_usuario_por_credenciales = async (usuario, password) => {
  const r = await pool.query('SELECT id_usuario, usuario, rol, nombre FROM usuarios WHERE usuario=$1 AND password=$2 LIMIT 1', [usuario, password]);
  if (r.rowCount === 0) return null;
  return r.rows[0];
};

const obtener_usuario_por_id = async (id_usuario) => {
  const r = await pool.query('SELECT id_usuario, usuario, rol, nombre FROM usuarios WHERE id_usuario=$1 LIMIT 1', [id_usuario]);
  if (r.rowCount === 0) return null;
  return r.rows[0];
};

app.use(
  crearRouterAutenticacion(pool, {
    obtener_usuario_por_credenciales,
    obtener_usuario_por_id,
  })
);

app.get('/api/_debug/cookies', (req, res) => {
  res.json({
    cookies: req.cookies || {},
    headers: {
      origin: req.headers.origin || null,
      cookie: req.headers.cookie || null,
      host: req.headers.host || null,
    },
  });
});

app.post('/api/autenticacion/prueba_cookie', async (req, res) => {
  const esProduccion = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const base = { httpOnly: true, path: '/' };
  const opts = esProduccion ? { ...base, secure: true, sameSite: 'none', domain: process.env.COOKIE_DOMAIN || undefined } : { ...base, secure: false, sameSite: 'lax' };
  res.cookie('sid_test', 'ok', opts);
  res.json({ exito: true });
});

app.get('/api/_debug/sesion', async (req, res) => {
  try {
    const raw = req.headers.cookie || '';
    const parsed = cookie.parse(raw || '');
    const sid = parsed.sid || parsed.sigecof_session || null;
    let sesion = null;
    let usuario = null;
    if (sid) {
      const r = await pool.query('SELECT sid, id_usuario, rol, expira_en, creado_en FROM sesiones WHERE sid = $1 LIMIT 1', [sid]);
      sesion = r.rows?.[0] || null;
      if (sesion?.id_usuario) {
        const u = await pool.query('SELECT id_usuario, usuario, rol FROM usuarios WHERE id_usuario = $1 LIMIT 1', [sesion.id_usuario]);
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

app.get('/api/autenticacion/admin/permisos', async (req, res) => {
  try {
    const rPerms = await pool.query('SELECT rol, id_seccion FROM permisos_roles');
    const filas = rPerms.rows || [];
    if (filas.length === 0) {
      const permisos = {
        admin: ['inicio', 'roles_permisos'],
        administrador: ['inicio', 'roles_permisos'],
        pendiente: ['rol_pendiente']
      };
      const aliases = {
        admin: 'Administrador del Sistema',
        administrador: 'Administrador del Sistema',
        pendiente: 'Pendiente'
      };
      return res.json({ exito: true, permisos, aliases });
    }

    const mapa = {};
    for (const row of filas) {
      const rol = String(row.rol || '').toLowerCase();
      const perm = String(row.id_seccion || '').trim();
      if (!rol || !perm) continue;
      if (!mapa[rol]) mapa[rol] = new Set();
      mapa[rol].add(perm);
    }
    const permisos = Object.fromEntries(Object.entries(mapa).map(([k, v]) => [k, Array.from(v)]));

    const rAliases = await pool.query('SELECT rol, MAX(alias) AS alias FROM permisos_roles GROUP BY rol');
    const aliases = {};
    for (const row of rAliases.rows || []) {
      const rol = String(row.rol || '').toLowerCase();
      const alias = String(row.alias || '').trim();
      if (!rol || !alias) continue;
      aliases[rol] = alias;
    }
    res.json({ exito: true, permisos, aliases });
  } catch (error) {
    res.status(200).json({ exito: true, permisos: {}, aliases: {} });
  }
});

app.get('/api/autenticacion/permisos_mi_rol', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    let rol = 'pendiente';
    if (token) {
      try {
        const dec = jwt.verify(token, process.env.JWT_SECRET || 'sigecof-dev-secret');
        rol = String(dec?.rol || 'pendiente').trim().toLowerCase();
      } catch (_) {}
    }
    const r = await pool.query('SELECT id_seccion FROM permisos_roles WHERE LOWER(TRIM(rol)) = $1 ORDER BY id_seccion', [rol]);
    const permisos = (r.rows || []).map(x => String(x.id_seccion).trim()).filter(Boolean);
    return res.json({ exito: true, rol, permisos });
  } catch (error) {
    return res.status(500).json({ exito: false, error: 'Error obteniendo permisos de rol actual', detalle: error.message });
  }
});

const estado_sidebar_por_usuario = new Map();

const leerToken = (req) => {
  try {
    const h = String(req.headers?.authorization || '');
    const t = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!t) return null;
    const secret = process.env.JWT_SECRET || 'sigecof-dev-secret';
    return jwt.verify(t, secret);
  } catch (_) { return null; }
};
const requiereRol = (rolesPermitidos = []) => (req, res, next) => {
  try {
    const dec = leerToken(req);
    const rol = dec?.rol || 'pendiente';
    const lista = Array.isArray(rolesPermitidos) ? rolesPermitidos : [rolesPermitidos];
    if (lista.length > 0 && !lista.includes(rol)) {
      return res.status(403).json({ error: 'Acceso denegado', detalle: `Rol requerido: ${lista.join(', ')}` });
    }
    next();
  } catch (e) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

export default app;
