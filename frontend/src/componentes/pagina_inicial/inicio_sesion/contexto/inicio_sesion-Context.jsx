import { createContext, useContext, useEffect, useState } from 'react';
import { actualizar_permisos_rol, obtener_rol_actual, establecer_etiquetas_roles } from '../../../sigecof/administrador/roles_permisos';
import { obtener_etiquetas_roles } from '../../../utilidades/estado_persistente.jsx';

// Contexto para manejo de sesión de usuario
const ContextoInicioSesion = createContext({});

export const ProveedorInicioSesion = ({ children }) => {
  const [usuarioAutenticado, setUsuarioAutenticado] = useState(null);
  const [token, setToken] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [requiereCambioContrasena, setRequiereCambioContrasena] = useState(false);

  const API_BASE = process.env.REACT_APP_API_URL;
  const API_URL = (() => {
    try {
      const proto = typeof window !== 'undefined' ? (window.location?.protocol || 'http:') : 'http:';
      const host = typeof window !== 'undefined' ? (window.location?.hostname || 'localhost') : 'localhost';
      if (API_BASE && /^https?:\/\//.test(API_BASE)) {
        const api = new URL(API_BASE);
        const mismoHost = api.hostname === host;
        return mismoHost ? API_BASE.replace(/\/+$/, '') : `${proto}//${host}:5000/api`;
      }
      return `${proto}//${host}:5000/api`;
    } catch (_) {
      try {
        const proto = typeof window !== 'undefined' ? (window.location?.protocol || 'http:') : 'http:';
        const host = typeof window !== 'undefined' ? (window.location?.hostname || 'localhost') : 'localhost';
        return `${proto}//${host}:5000/api`;
      } catch (_) {
        return 'http://localhost:5000/api';
      }
    }
  })();

  const fetch_flexible = async (ruta_o_url, opciones = {}) => {
    const es_absoluta = /^https?:\/\//.test(String(ruta_o_url || ''));
    const url_principal = es_absoluta ? String(ruta_o_url) : `${API_URL}${String(ruta_o_url).startsWith('/') ? '' : '/'}${ruta_o_url}`;
    const controller = new AbortController();
    const externo = opciones.signal;
    if (externo) {
      const onAbort = () => { try { controller.abort(); } catch (_) {} };
      if (externo.aborted) onAbort(); else externo.addEventListener('abort', onAbort, { once: true });
    }
    const timeout = setTimeout(() => { try { controller.abort(); } catch (_) {} }, 15000);
    const opts = { credentials: 'include', ...opciones, signal: controller.signal };
    try {
      const r = await fetch(url_principal, opts);
      try { clearTimeout(timeout); } catch (_) {}
      return r;
    } catch (_) {
      try {
        const base = process.env.REACT_APP_API_URL;
        let origen = null;
        if (base && /^https?:\/\//.test(base)) {
          try { origen = new URL(base).origin; } catch (_) { origen = null; }
        }
        if (!origen) {
          try {
            const proto = typeof window !== 'undefined' ? (window.location?.protocol || 'http:') : 'http:';
            const host = typeof window !== 'undefined' ? (window.location?.hostname || 'localhost') : 'localhost';
            origen = `${proto}//${host}:5000`;
          } catch (_) {
            origen = 'http://localhost:5000';
          }
        }
        const rel = (() => {
          const p = String(ruta_o_url || '');
          if (/^\/api(\b|\/)/.test(p)) return p;
          const limpio = p.startsWith('/') ? p : `/${p}`;
          return `/api${limpio}`;
        })();
        const r2 = await fetch(`${origen}${rel}`, opts);
        try { clearTimeout(timeout); } catch (_) {}
        return r2;
      } catch (e) {
        try { clearTimeout(timeout); } catch (_) {}
        throw e;
      }
    }
  };

  const guardar_en_almacenamiento = (tok, usuario, persistente) => {
    try {
      const datos_usuario = usuario ? {
        ...usuario,
        nombre: usuario.nombre || usuario.nombre_completo || usuario.usuario,
      } : null;
      const storage = persistente ? window.localStorage : window.sessionStorage;
      if (tok) storage.setItem('sigecof_token', tok);
      if (datos_usuario) storage.setItem('sigecof_usuario', JSON.stringify(datos_usuario));
      const otro = persistente ? window.sessionStorage : window.localStorage;
      try { otro.removeItem('sigecof_token'); otro.removeItem('sigecof_usuario'); } catch (_) {}
    } catch (_) {}
  };

  const decodificar_jwt = (tok) => {
    try {
      const partes = String(tok || '').split('.');
      if (partes.length < 2) return null;
      const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = atob(base64);
      return JSON.parse(json);
    } catch (_) { return null; }
  };

  const limpiar_almacenamiento = () => {
    try { window.localStorage.removeItem('sigecof_token'); window.localStorage.removeItem('sigecof_usuario'); } catch (_) {}
    try { window.sessionStorage.removeItem('sigecof_token'); window.sessionStorage.removeItem('sigecof_usuario'); } catch (_) {}
  };

  const obtener_token_guardado = () => {
    try {
      const tLocal = window.localStorage.getItem('sigecof_token');
      const tSess = window.sessionStorage.getItem('sigecof_token');
      return tLocal || tSess || null;
    } catch (_) { return null; }
  };

  const obtener_usuario_guardado = () => {
    try {
      const uLocal = window.localStorage.getItem('sigecof_usuario');
      const uSess = window.sessionStorage.getItem('sigecof_usuario');
      const raw = uLocal || uSess || null;
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  };

  const login = async (usuario, contrasena, persistente = true) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => { try { controller.abort(); } catch (_) {} }, 15000);
      const res = await fetch_flexible('/autenticacion/iniciar_sesion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ usuario, password: contrasena, persistente }),
        signal: controller.signal
      });
      try { clearTimeout(timeout); } catch (_) {}
      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json() : { exito: false, error: (await res.text()) };
      if (!res.ok || !data.exito) {
        throw new Error(data.error || 'Error al iniciar sesión');
      }
      const tok = data.token || null;
      const usuarioCompleto = data?.usuario ? {
        ...data.usuario,
        nombre: data.usuario.nombre || data.usuario.nombre_completo || data.usuario.usuario,
      } : null;
      const estatus_raw = String(usuarioCompleto?.estatus || '').toLowerCase();
      const esta_activo = typeof usuarioCompleto?.activo === 'boolean'
        ? usuarioCompleto.activo
        : (estatus_raw ? estatus_raw === 'activo' : true);
      if (!esta_activo) {
        setRequiereCambioContrasena(false);
        setToken(null);
        setUsuarioAutenticado(null);
        limpiar_almacenamiento();
        throw new Error('Tu cuenta está inactiva. Ponte en contacto con un administrador.');
      }
      const payload = decodificar_jwt(tok);
      if (payload?.requiere_cambio_contrasena) {
        setRequiereCambioContrasena(true);
        setToken(null);
        setUsuarioAutenticado(null);
        limpiar_almacenamiento();
        return { ...data, requiere_cambio_contrasena: true };
      }
      setRequiereCambioContrasena(false);
      setToken(tok);
      setUsuarioAutenticado(usuarioCompleto);
      try { guardar_en_almacenamiento(tok, usuarioCompleto, !!persistente); } catch (_) {}
      try {
        const h = tok ? { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` } : { 'Content-Type': 'application/json' };
        const r = await fetch(`${API_URL}/autenticacion/admin/permisos`, { credentials: 'include', headers: h });
        const d = await r.json().catch(() => ({}));
        const rol_norm = obtener_rol_actual(data.usuario, data.token);
        let lista = [];
        if (Array.isArray(d?.permisos)) lista = d.permisos;
        else if (d && typeof d?.permisos === 'object' && Array.isArray(d.permisos[rol_norm])) lista = d.permisos[rol_norm];
        else if (Array.isArray(d?.data)) lista = d.data;
        else if (Array.isArray(d?.resultado)) lista = d.resultado;
        if (lista.length > 0) {
          actualizar_permisos_rol(rol_norm, lista);
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('actualizar_permisos', { detail: { timestamp: Date.now() } }));
        }
        const etiquetas = await obtener_etiquetas_roles(data.token);
        if (etiquetas && typeof etiquetas === 'object' && Object.keys(etiquetas).length > 0) {
          establecer_etiquetas_roles(etiquetas);
        } else {
          try {
            const raw = typeof window !== 'undefined' ? window.localStorage.getItem('sigecof_alias_roles') : null;
            const obj = raw ? JSON.parse(raw) : {};
            if (obj && typeof obj === 'object' && Object.keys(obj).length > 0) establecer_etiquetas_roles(obj);
          } catch (_) {}
        }
      } catch (_) {}
      return data;
    } catch (e) {
      const msg = (e?.message || '').toLowerCase();
      const legible = (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network error') || msg.includes('aborted'))
        ? 'No se pudo conectar con el servidor. Es posible que la conexión con la base de datos no esté disponible.'
        : (e?.message || 'Error de conexión. Verifique que el servidor esté funcionando.');
      throw new Error(legible);
    }
  };

  const registro = async ({ usuario, contrasena, password, nombre, nombre_completo }) => {
      const res = await fetch(`${API_URL}/autenticacion/registrar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      // Mapear a la nueva API: usar 'password' y 'nombre'; aceptar valores legacy si vienen
      body: JSON.stringify({
        usuario,
        password: password ?? contrasena,
        nombre: nombre ?? nombre_completo,
      })
    });
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : { exito: false, error: (await res.text()) };
    if (!res.ok || !data.exito) {
      throw new Error(data.error || 'Error al registrar usuario');
    }
    setToken(data.token || null);
    setUsuarioAutenticado(data.usuario);
    return data;
  };

  const logout = async () => {
    try { await fetch(`${API_URL}/autenticacion/cerrar_sesion`, { method: 'POST', credentials: 'include' }); } catch (_) {}
    setToken(null);
    setUsuarioAutenticado(null);
    limpiar_almacenamiento();
  };

  const cargarSesion = async () => {
    let intentos = 0;
    const inicioCargaTs = Date.now();
    const minimoOverlayMs = 500;
    const fetch_con_fallback = async (url, opciones = {}) => {
      return fetch_flexible(url, opciones);
    };
    async function intentamos_cookie_fallback() {
      try {
        const r2 = await fetch_con_fallback(`${API_URL}/autenticacion/yo`);
        if (r2.ok) {
          const d2 = await r2.json();
          const nuevoTok2 = d2?.token || null;
          const usuarioCompleto3 = d2?.usuario ? {
            ...d2.usuario,
            nombre: d2.usuario.nombre || d2.usuario.nombre_completo || d2.usuario.usuario,
          } : null;
          const payload2 = decodificar_jwt(nuevoTok2);
          if (payload2?.requiere_cambio_contrasena) {
            setRequiereCambioContrasena(true);
            setToken(null);
            setUsuarioAutenticado(null);
          } else {
            setRequiereCambioContrasena(false);
            setToken(nuevoTok2);
            setUsuarioAutenticado(usuarioCompleto3);
          }
          try {
            const persistente_actual = !!window.localStorage.getItem('sigecof_token');
            guardar_en_almacenamiento(nuevoTok2, usuarioCompleto3, persistente_actual);
          } catch (_) {}
          const elapsed = Date.now() - inicioCargaTs;
          const delay = Math.max(minimoOverlayMs - elapsed, 0);
          if (delay > 0) { setTimeout(() => setCargando(false), delay); } else { setCargando(false); }
          return true;
        }
      } catch (_) {}
      return false;
    }
    const intentar = async () => {
      intentos += 1;
      try {
        let data = null;
        const tokGuardado = obtener_token_guardado();
        const headersAuth = tokGuardado ? { Authorization: `Bearer ${tokGuardado}` } : {};
        let res = await fetch_con_fallback(`${API_URL}/autenticacion/yo`, { headers: headersAuth });
        if (res.ok) {
          data = await res.json();
          const nuevoTok = data?.token || null;
          const usuarioCompleto2 = data?.usuario ? {
            ...data.usuario,
            nombre: data.usuario.nombre || data.usuario.nombre_completo || data.usuario.usuario,
          } : null;
          const payload = decodificar_jwt(nuevoTok || tokGuardado || token);
          if (payload?.requiere_cambio_contrasena) {
            setRequiereCambioContrasena(true);
            setToken(null);
            setUsuarioAutenticado(null);
          } else {
            setRequiereCambioContrasena(false);
            setToken(nuevoTok || tokGuardado || token);
            setUsuarioAutenticado(usuarioCompleto2);
          }
          try {
            const persistente_actual = !!window.localStorage.getItem('sigecof_token');
            guardar_en_almacenamiento(nuevoTok, usuarioCompleto2, persistente_actual);
          } catch (_) {}
          try {
            const tok = nuevoTok || tokGuardado || token;
            const h = tok ? { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` } : { 'Content-Type': 'application/json' };
            const r = await fetch_con_fallback(`${API_URL}/autenticacion/admin/permisos`, { headers: h });
            const d = await r.json().catch(() => ({}));
            const rol_norm = obtener_rol_actual(data.usuario, data.token);
            let lista = [];
            if (Array.isArray(d?.permisos)) lista = d.permisos;
            else if (d && typeof d?.permisos === 'object' && Array.isArray(d.permisos[rol_norm])) lista = d.permisos[rol_norm];
            else if (Array.isArray(d?.data)) lista = d.data;
            else if (Array.isArray(d?.resultado)) lista = d.resultado;
            if (lista.length > 0) {
              actualizar_permisos_rol(rol_norm, lista);
              if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('actualizar_permisos', { detail: { timestamp: Date.now() } }));
            }
            const etiquetas = await obtener_etiquetas_roles(tok);
            if (etiquetas && typeof etiquetas === 'object' && Object.keys(etiquetas).length > 0) {
              establecer_etiquetas_roles(etiquetas);
            } else {
              try {
                const raw = typeof window !== 'undefined' ? window.localStorage.getItem('sigecof_alias_roles') : null;
                const obj = raw ? JSON.parse(raw) : {};
                if (obj && typeof obj === 'object' && Object.keys(obj).length > 0) establecer_etiquetas_roles(obj);
              } catch (_) {}
            }
          } catch (_) {}
          const elapsed = Date.now() - inicioCargaTs;
          const delay = Math.max(minimoOverlayMs - elapsed, 0);
          if (delay > 0) { setTimeout(() => setCargando(false), delay); } else { setCargando(false); }
          return;
        }
      } catch (_) {}
      limpiar_almacenamiento();
      if (await intentamos_cookie_fallback()) return;
      if (intentos < 3) {
        setTimeout(intentar, 800);
      } else {
        const elapsed = Date.now() - inicioCargaTs;
        const delay = Math.max(minimoOverlayMs - elapsed, 0);
        if (delay > 0) { setTimeout(() => setCargando(false), delay); } else { setCargando(false); }
      }
    };
    intentar();
  };

  useEffect(() => {
    const usuarioGuardado = obtener_usuario_guardado();
    const tokGuardado = obtener_token_guardado();
    if (usuarioGuardado) setUsuarioAutenticado(usuarioGuardado);
    if (tokGuardado) setToken(tokGuardado);
    cargarSesion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ContextoInicioSesion.Provider value={{
      usuarioAutenticado,
      token,
      cargando,
      requiereCambioContrasena,
      login,
      registro,
      logout,
    }}>
      {children}
    </ContextoInicioSesion.Provider>
  );
};

export const useInicioSesion = () => useContext(ContextoInicioSesion);

export default ContextoInicioSesion;
