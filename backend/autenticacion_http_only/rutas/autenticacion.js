import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { crear_sesion, validar_sesion, eliminar_sesion, renovar_sesion } from '../middleware/sesion_http_only.js';

export default function crearRouterAutenticacion(pool, opciones = {}) {
  const router = Router();
  const obtener_usuario_por_credenciales = opciones.obtener_usuario_por_credenciales;
  const obtener_usuario_por_id = opciones.obtener_usuario_por_id;

  const esProduccion = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  const getCookieOptions = () => {
    const base = { httpOnly: true, path: '/' };
    const dom = process.env.COOKIE_DOMAIN || undefined;
    if (!esProduccion) {
      return { ...base, secure: false, sameSite: 'none', domain: dom };
    }
    const sameSiteEnv = (process.env.COOKIE_SAMESITE || '').toLowerCase();
    const secureEnv = (process.env.COOKIE_SECURE || '').toLowerCase();
    const sameSite = ['lax','strict','none'].includes(sameSiteEnv) ? sameSiteEnv : 'none';
    const secure = ['true','false'].includes(secureEnv) ? (secureEnv === 'true') : true;
    return { ...base, secure, sameSite, domain: dom };
  };

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

  const leerToken = (req) => {
    try {
      const h = String(req.headers?.authorization || '');
      const t = h.startsWith('Bearer ') ? h.slice(7) : null;
      if (!t) return null;
      const secret = process.env.JWT_SECRET || 'sigecof-dev-secret';
      return jwt.verify(t, secret);
    } catch (_) { return null; }
  };

  router.post('/api/autenticacion/iniciar_sesion', async (req, res) => {
    try {
      const { usuario, password, persistente } = req.body || {};
      const u = await obtener_usuario_por_credenciales(usuario, password);
      if (!u) return res.status(401).json({ exito: false, error: 'Credenciales inválidas' });
      const sid = await crear_sesion(pool, u, !!persistente);
      const opts = getCookieOptions();
      const maxAge = !!persistente ? (1000 * 60 * 60 * 24 * 7) : (1000 * 60 * 60);
      res.cookie('sid', sid, { ...opts, maxAge });
      res.cookie('sigecof_session', sid, { ...opts, maxAge });
      const csrf = (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 32);
      res.cookie('sigecof_csrf', csrf, { ...opts, maxAge });
      const token = crearToken(u);
      return res.json({ exito: true, usuario: { usuario: u.usuario, nombre: u.nombre || u.usuario, rol: u.rol, id_usuario: u.id_usuario }, token });
    } catch (e) {
      return res.status(500).json({ exito: false, error: 'Error de servidor' });
    }
  });

  router.get('/api/autenticacion/yo', async (req, res) => {
    try {
      const sid = req.cookies?.sid || req.cookies?.sigecof_session || null;
      const s = await validar_sesion(pool, sid);
      if (!s) {
        const dec = leerToken(req);
        if (dec?.id_usuario) {
          const u2 = await obtener_usuario_por_id(dec.id_usuario);
          if (!u2) return res.status(401).json({ exito: false, error: 'No autenticado' });
          const token2 = crearToken(u2);
          return res.json({ exito: true, usuario: { usuario: u2.usuario, nombre: u2.nombre || u2.usuario, rol: u2.rol, id_usuario: u2.id_usuario }, token: token2 });
        }
        return res.status(401).json({ exito: false, error: 'No autenticado' });
      }
      const s2 = await renovar_sesion(pool, sid);
      const opts = getCookieOptions();
      const exp = (s2 && s2.expira_en) ? new Date(s2.expira_en).getTime() : (Date.now() + 1000 * 60 * 60);
      const maxAge = Math.max(exp - Date.now(), 1000 * 60 * 10);
      res.cookie('sid', sid, { ...opts, maxAge });
      res.cookie('sigecof_session', sid, { ...opts, maxAge });
      const u = await obtener_usuario_por_id((s2 && s2.id_usuario) || s.id_usuario);
      if (!u) return res.status(401).json({ exito: false, error: 'No autenticado' });
      const token = crearToken(u);
      return res.json({ exito: true, usuario: { usuario: u.usuario, nombre: u.nombre || u.usuario, rol: u.rol, id_usuario: u.id_usuario }, token });
    } catch (e) {
      return res.status(500).json({ exito: false, error: 'Error de servidor' });
    }
  });

  router.post('/api/autenticacion/cerrar_sesion', async (req, res) => {
    try {
      const sid = req.cookies?.sid || req.cookies?.sigecof_session || null;
      if (sid) await eliminar_sesion(pool, sid);
      const opts = getCookieOptions();
      res.clearCookie('sid', { path: opts.path, domain: opts.domain, sameSite: opts.sameSite, secure: opts.secure });
      res.clearCookie('sigecof_session', { path: opts.path, domain: opts.domain, sameSite: opts.sameSite, secure: opts.secure });
      res.clearCookie('sigecof_csrf', { path: opts.path, domain: opts.domain, sameSite: opts.sameSite, secure: opts.secure });
      return res.json({ exito: true });
    } catch (e) {
      return res.status(500).json({ exito: false, error: 'Error de servidor' });
    }
  });

  return router;
}
