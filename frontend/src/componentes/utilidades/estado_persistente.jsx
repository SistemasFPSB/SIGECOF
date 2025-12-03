// Servicio de persistencia transversal en backend y sincronización en tiempo real
// Provee funciones para preferencias de usuario, estado del sidebar, etiquetas de roles y utilidades de WebSocket.

const API_BASE = process.env.REACT_APP_API_URL;
let API_URL = 'http://localhost:5000/api';
try {
  const abs = API_BASE && /^https?:\/\//.test(API_BASE);
  if (abs) {
    API_URL = String(API_BASE).replace(/\/+$/, '');
  } else if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'https' : 'http';
    const host = window.location.hostname;
    API_URL = `${proto}://${host}:5000/api`;
  }
} catch (_) {}

const headers = (token) => (
  token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' }
);

// Preferencias de usuario (tema, idioma, opciones de autenticación, etc.)
export const obtener_preferencias_usuario = async (token) => {
  try {
    const res = await fetch(`${API_URL}/preferencias/usuario`, { headers: headers(token), credentials: 'include' });
    if (!res.ok) return {};
    const data = await res.json().catch(() => ({}));
    return data?.preferencias || {};
  } catch (_) {
    return {};
  }
};

export const guardar_preferencias_usuario = async (preferencias, token) => {
  try {
    const res = await fetch(`${API_URL}/preferencias/usuario`, {
      method: 'PUT',
      headers: headers(token),
      credentials: 'include',
      body: JSON.stringify({ preferencias }),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
};

// Estado del sidebar (submenús abiertos, elemento activo, personalizaciones)
export const obtener_sidebar_estado = async (token) => {
  try {
    const res = await fetch(`${API_URL}/preferencias/sidebar`, { headers: headers(token), credentials: 'include' });
    if (!res.ok) return { abiertos: {}, activo: null, personalizado: {} };
    const data = await res.json().catch(() => ({}));
    return data?.estado || { abiertos: {}, activo: null, personalizado: {} };
  } catch (_) {
    return { abiertos: {}, activo: null, personalizado: {} };
  }
};

export const guardar_sidebar_estado = async (estado, token) => {
  try {
    const res = await fetch(`${API_URL}/preferencias/sidebar`, {
      method: 'PUT',
      headers: headers(token),
      credentials: 'include',
      body: JSON.stringify({ estado }),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
};

// Etiquetas de roles (sobrescrituras de nombres de rol)
export const obtener_etiquetas_roles = async (token) => {
  const res = await fetch(`${API_URL}/preferencias/roles/etiquetas`, { headers: headers(token), credentials: 'include' });
  if (!res.ok) return {};
  const data = await res.json().catch(() => ({}));
  return data?.etiquetas || {};
};

export const actualizar_etiqueta_rol_backend = async (rol_norm, etiqueta, token) => {
  const res = await fetch(`${API_URL}/preferencias/roles/etiquetas`, {
    method: 'PUT',
    headers: headers(token),
    credentials: 'include',
    body: JSON.stringify({ rol: rol_norm, etiqueta }),
  });
  return res.ok;
};

// Sincronización en tiempo real (WebSocket)
let ws = null;
const oyentes = new Map();

export const iniciar_ws = (token) => {
  try {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return ws;
    let url = '';
    if (API_URL.startsWith('/')) {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      url = `${proto}://${window.location.host}/ws`;
    } else {
      url = API_URL.replace('http', 'ws').replace('/api', '/ws');
    }
    ws = new WebSocket(url);
    ws.onopen = () => {
      try {
        if (token) ws.send(JSON.stringify({ tipo: 'auth', token }));
      } catch (_) {}
    };
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        const tipo = msg?.tipo;
        const lista = oyentes.get(tipo) || [];
        lista.forEach((fn) => { try { fn(msg?.data); } catch (_) {} });
      } catch (_) {}
    };
    ws.onclose = () => { ws = null; };
    ws.onerror = () => {};
    return ws;
  } catch (_) { return null; }
};

export const on_evento_ws = (tipo, callback) => {
  const key = String(tipo || '').trim();
  const lista = oyentes.get(key) || [];
  oyentes.set(key, [...lista, callback]);
  return () => {
    const actual = oyentes.get(key) || [];
    oyentes.set(key, actual.filter((fn) => fn !== callback));
  };
};

export default {
  obtener_preferencias_usuario,
  guardar_preferencias_usuario,
  obtener_sidebar_estado,
  guardar_sidebar_estado,
  obtener_etiquetas_roles,
  actualizar_etiqueta_rol_backend,
  iniciar_ws,
  on_evento_ws,
};

