import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useInicioSesion } from '../../pagina_inicial/inicio_sesion/contexto/inicio_sesion-Context';
import { obtenerTituloPorMenu, ItemsSidebar, ItemsSidebarInferior } from '../../utilidades/items';
import { useMensajesConfirmacion } from '../../utilidades/comunes/mensajes_confirmacion.jsx';
import { puede_ver_seccion, obtener_primera_ruta_permitida, obtener_rol_actual } from './roles_permisos.jsx';
import { obtenerIdPorRuta } from '../../utilidades/items';
import { cola_eventos } from '../notificaciones/cola_eventos.js';

export const TIPOS_NOTIFICACION = {
  exito: 'exito',
  advertencia: 'advertencia',
  informacion: 'informacion',
  tarea: 'tarea',
  correo: 'correo',
};

const ContextoNotificaciones = createContext(null);

export const ProveedorNotificaciones = ({ children }) => {
  const { usuarioAutenticado, token } = useInicioSesion();
  const API_BASE = process.env.REACT_APP_API_URL;
  const API_URL = (() => {
    if (API_BASE && /^https?:\/\//.test(API_BASE)) return API_BASE;
    try {
      const host = typeof window !== 'undefined' ? (window.location?.hostname || 'localhost') : 'localhost';
      return `http://${host}:5000/api`;
    } catch (_) {
      return 'http://localhost:5000/api';
    }
  })();

  const [notificaciones, set_notificaciones] = useState([]);
  const [es_visible_popup, set_es_visible_popup] = useState(false);
  const [config_notificaciones, set_config_notificaciones] = useState([]);
  const init_ejecutado = React.useRef(false);

  const rol_actual = obtener_rol_actual(usuarioAutenticado, token);
  const headersAuth = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const resolver_nombre_cache_ref = React.useRef(new Map());

  const normalizar_rol_notif = (rawRol) => {
    const v = String(rawRol || '').toLowerCase().trim();
    if (['cualquiera', 'any', 'todos'].includes(v)) return 'cualquiera';
    if (['admin', 'administrator', 'administrador'].includes(v)) return 'admin';
    if (['admin_padron', 'administrador_padron'].includes(v)) return 'admin_padron';
    if (['usuario_padron'].includes(v)) return 'usuario_padron';
    if (['pendiente', 'pending'].includes(v)) return 'pendiente';
    return v || 'pendiente';
  };

  const LS_KEY = 'notificaciones_estado';
  const mapear_backend_a_local = (n) => {
    const datos = n.datos || null;
    return {
      id: n.id_notificacion,
      tipo: n.tipo,
      titulo: n.titulo || '',
      mensaje: n.mensaje || '',
      marca_temporal: n.marca_temporal ? new Date(n.marca_temporal) : new Date(),
      leido: !!n.leido,
      moved_to_history: !!n.leido,
      rol_destinatario: n.rol_destinatario || null,
      ruta_sugerida: n.ruta_sugerida || null,
      datos,
      prioridad: n.prioridad || 'media',
    };
  };
  const listar_backend = React.useCallback(async (rol) => {
    try {
      const r = normalizar_rol_notif(rol);
      const incluir_reglas = r === 'admin' ? '&incluir_reglas=true' : '';
      const urls = [
        `${API_URL}/notificaciones_eventos?rol=${encodeURIComponent(r)}${incluir_reglas}`,
        (typeof window !== 'undefined' ? `${window.location.origin}/api/notificaciones_eventos?rol=${encodeURIComponent(r)}${incluir_reglas}` : null),
      ].filter(Boolean);
      let data = null;
      for (const u of urls) {
        try {
          const res = await fetch(u, { headers: headersAuth, credentials: 'include' });
          if (res.ok) { data = await res.json(); break; }
        } catch (_) {}
      }
      if (!data) return null;
      const arr = Array.isArray(data.notificaciones) ? data.notificaciones : (Array.isArray(data) ? data : []);
      return arr.map(mapear_backend_a_local);
    } catch (_) { return null; }
  }, [API_URL, headersAuth]);
  const set_y_guardar = React.useCallback((updater) => {
    set_notificaciones(prev => {
      const next = (typeof updater === 'function' ? updater(prev) : updater);
      try {
        if (Array.isArray(next) && next.length > 0 && typeof window !== 'undefined') {
          localStorage.setItem(LS_KEY, JSON.stringify(next));
        }
      } catch (_) {}
      return next;
    });
  }, []);

  const listar_config_backend = React.useCallback(async () => {
    try {
      const urls = [
        `${API_URL}/notificaciones_configuracion`,
        (typeof window !== 'undefined' ? `${window.location.origin}/api/notificaciones_configuracion` : null),
      ].filter(Boolean);
      let data = null;
      for (const u of urls) {
        try {
          const res = await fetch(u, { headers: headersAuth, credentials: 'include' });
          if (res.ok) { data = await res.json(); break; }
        } catch (_) {}
      }
      if (!data) return [];
      const reglas = Array.isArray(data.reglas) ? data.reglas : (Array.isArray(data) ? data : []);
      return reglas.map(r => ({
        id: r.id,
        activo: !!r.activo,
        titulo_regla: r.titulo_regla || '',
        mensaje: typeof r.mensaje === 'string' ? r.mensaje : '',
        trigger_id: (r.trigger_id || '').trim(),
        tipo: r.tipo || TIPOS_NOTIFICACION.informacion,
        prioridad: r.prioridad || 'media',
        rol_origen: normalizar_rol_notif(r.rol_origen || 'cualquiera'),
        seccion_accion: (r.seccion_accion || '').trim(),
        roles_destino: Array.isArray(r.roles_destino) ? r.roles_destino.map(normalizar_rol_notif) : [],
        ruta_sugerida: r.ruta_sugerida || null,
      }));
    } catch (_) { return []; }
  }, [API_URL, headersAuth]);
  const set_config_y_guardar = React.useCallback((updater) => {
    set_config_notificaciones(prev => (typeof updater === 'function' ? updater(prev) : updater));
  }, []);

  const existe_duplicado_contenido = React.useCallback((candidato) => {
    const key = (v) => String(v || '').trim();
    const rolFiltro = normalizar_rol_notif(candidato.rol_destinatario || rol_actual);
    const lista = (Array.isArray(notificaciones) ? notificaciones : []).filter(n => {
      const dest = normalizar_rol_notif(n.rol_destinatario);
      return dest === rolFiltro || dest === 'cualquiera' || !n.rol_destinatario;
    });
    return lista.some(n =>
      key(n.tipo) === key(candidato.tipo)
      && key(n.titulo) === key(candidato.titulo)
      && key(n.mensaje) === key(candidato.mensaje)
      && key(n.ruta_sugerida) === key(candidato.ruta_sugerida)
      && key(n.rol_destinatario) === key(candidato.rol_destinatario)
    );
  }, [notificaciones, rol_actual]);

  const envios_en_progreso = React.useRef(new Set());
  const agregar_notificacion = React.useCallback(async (notificacion) => {
    const tipoEntrada = notificacion.tipo;
    const valoresTipos = Object.values(TIPOS_NOTIFICACION);
    const tipoNormalizado =
      TIPOS_NOTIFICACION[tipoEntrada] ||
      (valoresTipos.includes(tipoEntrada) ? tipoEntrada : TIPOS_NOTIFICACION.informacion);
    const payload = {
      tipo: tipoNormalizado,
      titulo: notificacion.titulo || 'Notificación',
      mensaje: notificacion.mensaje || '',
      rol_destinatario: notificacion.rol_destinatario ? normalizar_rol_notif(notificacion.rol_destinatario) : null,
      ruta_sugerida: (notificacion.ruta_sugerida && String(notificacion.ruta_sugerida).trim()) ? String(notificacion.ruta_sugerida).trim() : 'inicio',
      datos: notificacion.datos || null,
      prioridad: notificacion.prioridad || 'media',
    };
    if (existe_duplicado_contenido(payload)) return false;
    const keyCand = [
      String(payload.titulo || '').toLowerCase().trim(),
      String(payload.mensaje || '').toLowerCase().trim(),
      String(payload.ruta_sugerida || '').toLowerCase().trim(),
      String(payload.rol_destinatario || '').toLowerCase().trim(),
      String(payload.tipo || '').toLowerCase().trim(),
    ].join('|');
    if (envios_en_progreso.current.has(keyCand)) return false;
    envios_en_progreso.current.add(keyCand);
    let creado = null;
    try {
      for (let intento = 0; intento < 3 && !creado; intento++) {
        try {
          const es_evento_sistema = payload?.datos && payload.datos.es_evento_sistema === 'inicio_sesion';
          const sin_token = !headersAuth || !headersAuth.Authorization;
          const endpointPrincipal = (sin_token && es_evento_sistema)
            ? `${API_URL}/notificaciones_eventos/sistema/inicio_sesion`
            : `${API_URL}/notificaciones_eventos`;
          const endpointAlterno = (typeof window !== 'undefined') ? (
            (sin_token && es_evento_sistema)
              ? `${window.location.origin}/api/notificaciones_eventos/sistema/inicio_sesion`
              : `${window.location.origin}/api/notificaciones_eventos`
          ) : null;
          const headers = (sin_token && es_evento_sistema)
            ? { 'Content-Type': 'application/json' }
            : { 'Content-Type': 'application/json', ...headersAuth };
          const endpoints = [endpointPrincipal, endpointAlterno].filter(Boolean);
          let ok = false, data = null;
          for (const u of endpoints) {
            const res = await fetch(u, {
              method: 'POST',
              headers,
              credentials: 'include',
              body: JSON.stringify(payload),
            });
            if (res.ok) { data = await res.json(); ok = true; break; }
          }
          if (!ok) { await new Promise(r => setTimeout(r, 400)); continue; }
          creado = data?.notificacion ? mapear_backend_a_local(data.notificacion) : null;
          if (!creado) {
            await new Promise(r => setTimeout(r, 400));
          }
        } catch (_) {
          await new Promise(r => setTimeout(r, 400));
        }
      }
      if (creado) {
        set_y_guardar(prev => [creado, ...prev]);
      }
    } catch (_) { }
    finally {
      envios_en_progreso.current.delete(keyCand);
    }
    return !!creado;
  }, [set_y_guardar, headersAuth, API_URL, existe_duplicado_contenido]);

  const enviar_con_reintento = React.useCallback(async (payload) => {
    for (let intento = 0; intento < 12; intento++) {
      const ok = await agregar_notificacion(payload);
      if (ok) return true;
      await new Promise(r => setTimeout(r, 1000));
    }
    return false;
  }, [agregar_notificacion]);

  const actualizar_notificacion = (id, cambios) => {
    set_y_guardar(prev => prev.map(n => (
      n.id === id ? { ...n, ...cambios } : n
    )));
  };

  const eliminar_notificacion = async (id) => {
    try {
      const res = await fetch(`${API_URL}/notificaciones_eventos/${id}`, { method: 'DELETE', headers: headersAuth, credentials: 'include' });
      if (!res.ok) return;
      set_y_guardar(prev => prev.filter(n => n.id !== id));
    } catch (_) { }
  };

  const marcar_como_leida = async (id) => {
    try {
      const res = await fetch(`${API_URL}/notificaciones_eventos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headersAuth },
        credentials: 'include',
        body: JSON.stringify({ leido: true }),
      });
      if (!res.ok) return;
      set_y_guardar(prev => prev.map(n => (n.id === id ? { ...n, leido: true, moved_to_history: true } : n)));
    } catch (_) { }
  };

  const marcar_todas_como_leidas = React.useCallback(async () => {
    try {
      const r = normalizar_rol_notif(rol_actual);
      const res = await fetch(`${API_URL}/notificaciones_eventos/marcar_todas_como_leidas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({ rol: r }),
      });
      if (!res.ok) return;
      set_y_guardar(prev => prev.map(n => ({ ...n, leido: true, moved_to_history: true })));
    } catch (_) { }
  }, [API_URL, token, rol_actual, set_y_guardar]);

  const listar_configuraciones = () => config_notificaciones;
  const crear_configuracion = React.useCallback(async (regla) => {
    const nueva = {
      activo: true,
      titulo_regla: regla.titulo_regla || 'Regla de notificación',
      mensaje: typeof regla.mensaje === 'string' ? regla.mensaje : '',
      trigger_id: (regla.trigger_id || '').trim(),
      tipo: regla.tipo && (TIPOS_NOTIFICACION[regla.tipo] || Object.values(TIPOS_NOTIFICACION).includes(regla.tipo) ? regla.tipo : TIPOS_NOTIFICACION.informacion),
      prioridad: regla.prioridad || 'media',
      rol_origen: normalizar_rol_notif(regla.rol_origen || rol_actual),
      seccion_accion: (regla.seccion_accion || '').trim(),
      roles_destino: Array.isArray(regla.roles_destino) ? regla.roles_destino.map(normalizar_rol_notif) : [],
      ruta_sugerida: regla.ruta_sugerida || null,
    };
    try {
      const res = await fetch(`${API_URL}/notificaciones_configuracion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headersAuth },
        credentials: 'include',
        body: JSON.stringify(nueva),
      });
      if (res && res.ok) {
        const data = await res.json();
        const id = (data && data.regla && data.regla.id) ? data.regla.id : (Date.now() + Math.floor(Math.random() * 1000));
        set_config_y_guardar(prev => [{ id, ...nueva }, ...prev]);
        return id;
      }
    } catch (_) { }
    const id_local = Date.now() + Math.floor(Math.random() * 1000);
    set_config_y_guardar(prev => [{ id: id_local, ...nueva }, ...prev]);
    return id_local;
  }, [rol_actual, set_config_y_guardar, API_URL, headersAuth]);
  const actualizar_configuracion = React.useCallback(async (id, cambios) => {
    const normalizados = {
      ...cambios,
      rol_origen: cambios.rol_origen ? normalizar_rol_notif(cambios.rol_origen) : undefined,
      roles_destino: cambios.roles_destino ? cambios.roles_destino.map(normalizar_rol_notif) : undefined,
    };
    try {
      await fetch(`${API_URL}/notificaciones_configuracion/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headersAuth },
        body: JSON.stringify(normalizados),
      });
    } catch (_) { }
    set_config_y_guardar(prev => prev.map(r => (
      r.id === id ? { ...r, ...normalizados, rol_origen: normalizados.rol_origen ?? r.rol_origen, roles_destino: normalizados.roles_destino ?? r.roles_destino } : r
    )));
  }, [set_config_y_guardar, API_URL, headersAuth]);
  const eliminar_configuracion = React.useCallback(async (id) => {
    try { await fetch(`${API_URL}/notificaciones_configuracion/${id}`, { method: 'DELETE', headers: headersAuth }); } catch (_) { }
    set_config_y_guardar(prev => prev.filter(r => r.id !== id));
  }, [set_config_y_guardar, API_URL, headersAuth]);

  const obtener_por_rol = React.useCallback((rol) => {
    const r = normalizar_rol_notif(rol);
    const arr = Array.isArray(notificaciones) ? notificaciones : [];
    return arr.filter(n => {
      const rawDest = n.rol_destinatario;
      const dest = normalizar_rol_notif(rawDest);
      const coincideRol = dest === r || dest === 'cualquiera' || !rawDest;
      if (!coincideRol) return false;
      return true;
    });
  }, [notificaciones]);

  const cantidad_no_leidas = useMemo(() => {
    return obtener_por_rol(rol_actual)
      .filter(n => !n.leido)
      .length;
  }, [rol_actual, obtener_por_rol]);

  const ultimo_conteo_ref = React.useRef({ cantidad: 0, ts: 0 });
  React.useEffect(() => {
    if (cantidad_no_leidas > 0) {
      ultimo_conteo_ref.current = { cantidad: cantidad_no_leidas, ts: Date.now() };
    }
  }, [cantidad_no_leidas]);

  const cantidad_no_leidas_visibles = useMemo(() => {
    const ahora = Date.now();
    const { cantidad, ts } = ultimo_conteo_ref.current || { cantidad: 0, ts: 0 };
    const dentro_de_gracia = (ahora - ts) < 5000;
    return cantidad_no_leidas > 0 ? cantidad_no_leidas : (dentro_de_gracia ? cantidad : 0);
  }, [cantidad_no_leidas]);

  const obtener_no_leidas_actual = React.useCallback(() => {
    const lista = obtener_por_rol(rol_actual)
      .filter(n => !n.leido)
      .slice()
      .sort((a, b) => new Date(b.marca_temporal) - new Date(a.marca_temporal));
    const vistos = new Set();
    const out = [];
    for (const n of lista) {
      const k = [String(n.tipo || ''), String(n.titulo || '').trim(), String(n.mensaje || '').trim(), String(n.ruta_sugerida || ''), String(n.rol_destinatario || '')].join('|');
      if (!vistos.has(k)) { vistos.add(k); out.push(n); }
      if (out.length >= 3) break;
    }
    return out;
  }, [rol_actual, obtener_por_rol]);

  const ultimo_no_leidas_ref = React.useRef({ lista: [], ts: 0 });
  React.useEffect(() => {
    const actuales = obtener_no_leidas_actual();
    if (Array.isArray(actuales) && actuales.length > 0) {
      ultimo_no_leidas_ref.current = { lista: actuales, ts: Date.now() };
    }
  }, [obtener_no_leidas_actual]);

  const notificaciones_no_leidas_visibles = useMemo(() => {
    const actuales = obtener_no_leidas_actual();
    if (Array.isArray(actuales) && actuales.length > 0) return actuales;
    const ahora = Date.now();
    const { lista, ts } = ultimo_no_leidas_ref.current || { lista: [], ts: 0 };
    const dentro_de_gracia = (ahora - ts) < 5000;
    return dentro_de_gracia ? lista : [];
  }, [obtener_no_leidas_actual]);


  const POPUP_KEY_PREFIX = 'sigecof_popup_dismissed';
  const obtener_clave_popup = React.useCallback(() => {
    const t = token || '';
    const frag = String(t).slice(0, 12);
    return `${POPUP_KEY_PREFIX}:${frag || 'sin_token'}`;
  }, [token]);

  const popup_dismissed_ref = React.useRef(false);
  React.useEffect(() => {
    try {
      const clave = obtener_clave_popup();
      const v = (typeof window !== 'undefined') ? window.localStorage.getItem(clave) : null;
      popup_dismissed_ref.current = v === '1';
    } catch (_) { popup_dismissed_ref.current = false; }
  }, [obtener_clave_popup]);

  const marcar_popup_descartado = React.useCallback(() => {
    try {
      const clave = obtener_clave_popup();
      if (typeof window !== 'undefined') window.localStorage.setItem(clave, '1');
      popup_dismissed_ref.current = true;
    } catch (_) {}
  }, [obtener_clave_popup]);

  const mostrar_popup = () => set_es_visible_popup(true);
  const ocultar_popup = () => { set_es_visible_popup(false); marcar_popup_descartado(); };

  const popup_mostrado_ref = React.useRef(false);

  useEffect(() => {
  popup_mostrado_ref.current = false;
}, [rol_actual, token]);

useEffect(() => {
  const hay_no_leidas = cantidad_no_leidas > 0;
  if (hay_no_leidas && !popup_mostrado_ref.current && !popup_dismissed_ref.current) {
    set_es_visible_popup(true);
    popup_mostrado_ref.current = true;
  }
}, [cantidad_no_leidas, rol_actual]);

useEffect(() => {
  let cancel = false;
  const cargar = async () => {
    const lista = await listar_backend(rol_actual);
    if (!cancel && Array.isArray(lista)) set_y_guardar(lista);
  };
  cargar();
  return () => { cancel = true; };
}, [rol_actual, listar_backend, set_y_guardar]);

useEffect(() => {
  let cancel = false;
  const cargarConfigs = async () => {
    const arr = await listar_config_backend();
    if (!cancel && Array.isArray(arr) && arr.length > 0) {
      set_config_y_guardar(arr);
    }
  };
  cargarConfigs();
  return () => { cancel = true; };
}, [API_URL, headersAuth, listar_config_backend, set_config_y_guardar]);

useEffect(() => {
  if (!token) return;
  if (!Array.isArray(config_notificaciones) || config_notificaciones.length === 0) return;
  cola_eventos.inicializar(config_notificaciones);
}, [token, config_notificaciones]);


const procesar_evento_interno = React.useCallback(async ({ seccion, accion, rol_origen, titulo, mensaje, tipo, prioridad, ruta_sugerida, datos }) => {
  let reglas_fuente = Array.isArray(config_notificaciones) && config_notificaciones.length > 0 ? config_notificaciones : await listar_config_backend();
  if (!Array.isArray(reglas_fuente) || reglas_fuente.length === 0) { return; }
  const origen = normalizar_rol_notif(rol_origen || rol_actual);
  const accion_id = String(accion || '').trim();
  const clave = `${String(seccion || '').trim()}:${accion_id}`;
  const reglas = (reglas_fuente || []).filter((r) => {
    const sec_acc = String(r.seccion_accion || '');
    const trig = String(r.trigger_id || '');
    const coincide_accion = (
      sec_acc === clave ||
      sec_acc.endsWith(`:${accion_id}`) ||
      trig === `${String(seccion || '').trim()}_${accion_id}` ||
      trig.endsWith(`_${accion_id}`)
    );
    const coincide_rol = (r.rol_origen === origen || r.rol_origen === 'cualquiera' || origen === 'cualquiera');
    return r.activo && coincide_accion && coincide_rol;
  });
  

  const nombreActor = usuarioAutenticado?.nombre || usuarioAutenticado?.nombre_completo || usuarioAutenticado?.email || '';
  const usuarioActor = usuarioAutenticado?.usuario || usuarioAutenticado?.email || '';
  const rolActor = normalizar_rol_notif(rol_origen || rol_actual);
  const cache_nombres = resolver_nombre_cache_ref.current;

  async function resolver_nombre_por_usuario(usuarioId) {
    const key = String(usuarioId || '').toLowerCase().trim();
    if (!key) return '';
    if (cache_nombres.has(key)) return cache_nombres.get(key);
    const headers = { 'Content-Type': 'application/json', ...headersAuth };
    const intentos = [
      `${API_URL}/autenticacion/admin/usuarios/buscar?q=${encodeURIComponent(key)}`,
      `${API_URL}/autenticacion/usuarios/buscar?q=${encodeURIComponent(key)}`,
      `/api/autenticacion/admin/usuarios/buscar?q=${encodeURIComponent(key)}`,
      `/api/autenticacion/usuarios/buscar?q=${encodeURIComponent(key)}`,
    ];
    for (const url of intentos) {
      try {
        const resp = await fetch(url, { method: 'GET', headers, credentials: 'include' });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) continue;
        const lista = Array.isArray(data?.usuarios) ? data.usuarios : (Array.isArray(data) ? data : []);
        const match = lista.find(u => String(u?.usuario || '').toLowerCase().trim() === key);
        const nombre = match?.nombre || match?.nombre_completo || '';
        if (nombre) { cache_nombres.set(key, nombre); return nombre; }
      } catch (_) { /* intentar siguiente */ }
    }
    return '';
  }
  const marcador_evento = (() => {
    const s = String(seccion || '').trim().toLowerCase();
    const a = String(accion || '').trim().toLowerCase();
    if ((s === 'perfil' || s === 'pantalla_inicial' || s === 'inicio_sesion') && a === 'registro_nuevo') return 'registro_usuario';
    if (s === 'recuperar_contrasena' && a === 'solicitar_restablecer_contrasena') return 'olvido_contrasena';
    return null;
  })();
  for (const r of reglas) {
    const destinos = Array.isArray(r.roles_destino) ? r.roles_destino.map(normalizar_rol_notif) : [];
    const tipo_regla = r.tipo || TIPOS_NOTIFICACION.informacion;
    const prioridad_regla = r.prioridad || 'media';
    const ruta_regla = (r.ruta_sugerida && String(r.ruta_sugerida).trim()) || 'inicio';
    let datosFinales;
    if (marcador_evento === 'olvido_contrasena') {
      let nombreSolicitante = datos?.nombre;
      if (!nombreSolicitante && datos?.usuario) {
        try { nombreSolicitante = await resolver_nombre_por_usuario(datos.usuario); } catch (_) { nombreSolicitante = ''; }
      }
      nombreSolicitante = nombreSolicitante || (datos?.usuario ?? '');
      const rolSolicitante = (datos?.rol ?? 'pendiente');
      const usuarioSolicitante = (datos?.usuario ?? '');
      datosFinales = { ...(datos || {}), nombre: nombreSolicitante, usuario: usuarioSolicitante, rol: rolSolicitante, es_evento_sistema: marcador_evento };
    } else {
      let nombreDato = datos?.nombre;
      if (!nombreDato && datos?.usuario) {
        try { nombreDato = await resolver_nombre_por_usuario(datos.usuario); } catch (_) { nombreDato = ''; }
      }
      datosFinales = { ...(datos || {}), nombre: (nombreDato || nombreActor), usuario: (datos?.usuario ?? usuarioActor), rol: (datos?.rol ?? rolActor), ...(marcador_evento ? { es_evento_sistema: marcador_evento } : {}) };
    }
    const datosEvento = datosFinales;
    const version_evento = (datosFinales && typeof datosFinales.version === 'number') ? datosFinales.version : Date.now();
    const tpl = (s) => {
      if (!s) return s;
      let out = s;
      const d = datosFinales || {};
      const rep = {
        '{{nombre}}': d.nombre || '',
        '{{usuario}}': d.usuario || '',
        '{{rol}}': d.rol || '',
      };
      Object.keys(rep).forEach(k => { out = out.split(k).join(rep[k]); });
      return out;
    };
    const titulo_regla = tpl(r.titulo_regla || '');
    const mensaje_regla = tpl(r.mensaje || '');
    if (destinos.length === 0) {
      const candidato = {
        tipo: tipo_regla,
        titulo: titulo_regla,
        mensaje: mensaje_regla,
        rol_destinatario: null,
        ruta_sugerida: ruta_regla,
      };
      if (!existe_duplicado_contenido(candidato)) {
        Promise.resolve(enviar_con_reintento({ ...candidato, prioridad: prioridad_regla, datos: { ...datosEvento, version: version_evento } }));
      }
    } else {
      for (const rol_dest of destinos) {
        const candidato = {
          tipo: tipo_regla,
          titulo: titulo_regla,
          mensaje: mensaje_regla,
          rol_destinatario: rol_dest,
          ruta_sugerida: ruta_regla,
        };
        if (!existe_duplicado_contenido(candidato)) {
          Promise.resolve(enviar_con_reintento({ ...candidato, prioridad: prioridad_regla, datos: { ...datosEvento, version: version_evento } }));
        }
      }
    }
  }
}, [config_notificaciones, listar_config_backend, rol_actual, usuarioAutenticado, enviar_con_reintento, existe_duplicado_contenido]);

const procesar_evento = async (evento) => {
  await procesar_evento_interno(evento);
};

const refrescar_notificaciones = React.useCallback(async () => {
  try {
    const lista = await listar_backend(rol_actual);
    if (Array.isArray(lista)) {
      set_y_guardar(lista);
      const r = normalizar_rol_notif(rol_actual);
      const count = lista.filter(n => {
        const dest = normalizar_rol_notif(n.rol_destinatario);
        const coincideRol = dest === r || dest === 'cualquiera' || !n.rol_destinatario;
        return coincideRol && !n.leido;
      }).length;
      if (count > 0 && !popup_mostrado_ref.current) {
        set_es_visible_popup(true);
        popup_mostrado_ref.current = true;
      }
    }
  } catch (e) {
    console.warn('[Notificaciones] Error al refrescar desde backend:', e?.message || e);
  }
}, [rol_actual, listar_backend, set_y_guardar]);

// Refrescar automáticamente cuando cambia el token (por ejemplo, tras iniciar sesión)
const ultimo_token_ref = React.useRef(null);
const refresco_en_progreso = React.useRef(false);
const ultimo_refresh_ts = React.useRef(0);
useEffect(() => {
  const t = token || '';
  if (ultimo_token_ref.current === t) return;
  ultimo_token_ref.current = t;
  if (!t) return;
  const ahora = Date.now();
  if (refresco_en_progreso.current) return;
  if (ahora - (ultimo_refresh_ts.current || 0) < 3000) return;
  refresco_en_progreso.current = true;
  ultimo_refresh_ts.current = ahora;
  Promise.resolve()
    .then(async () => {
      await refrescar_notificaciones();
      try {
        await procesar_evento({
          seccion: 'autenticacion',
          accion: 'inicio_sesion',
          rol_origen: rol_actual,
          datos: {
            nombre: usuarioAutenticado?.nombre || usuarioAutenticado?.nombre_completo || usuarioAutenticado?.email || '',
            usuario: usuarioAutenticado?.usuario || usuarioAutenticado?.email || '',
            rol: rol_actual,
            es_evento_sistema: 'inicio_sesion',
          },
        });
      } catch (_) {}
    })
    .finally(() => { refresco_en_progreso.current = false; });
}, [token, rol_actual, refrescar_notificaciones, procesar_evento, marcar_todas_como_leidas, usuarioAutenticado]);

useEffect(() => {
  if (init_ejecutado.current) return;
  init_ejecutado.current = true;
  let cancelado = false;
  const init = async () => {
    let cache = null;
    try { const s = (typeof window !== 'undefined') ? localStorage.getItem(LS_KEY) : null; cache = s ? JSON.parse(s) : null; } catch (_) { cache = null; }
    if (!cancelado && Array.isArray(cache) && cache.length > 0) {
      set_y_guardar(cache);
    }
    const lista = await listar_backend(rol_actual);
    const normalizadas = Array.isArray(lista)
      ? lista.map(n => ({ ...n, rol_destinatario: normalizar_rol_notif(n.rol_destinatario) }))
      : null;
    if (!cancelado && Array.isArray(normalizadas)) {
      set_y_guardar(normalizadas);
    }
    const configs_backend = await listar_config_backend();
    if (!cancelado) {
      const configs = Array.isArray(configs_backend) ? configs_backend : [];
      set_config_y_guardar(prev => (prev && prev.length > 0 ? prev : configs));
      cola_eventos.agregar_escuchador(async (ev) => { const datos = ev?.datos || ev; await procesar_evento_interno(datos); });
    }
    if (!cancelado) {
      const ahora = Date.now();
      if (!refresco_en_progreso.current && (ahora - (ultimo_refresh_ts.current || 0) >= 3000)) {
        refresco_en_progreso.current = true;
        ultimo_refresh_ts.current = ahora;
        try { await refrescar_notificaciones(); } finally { refresco_en_progreso.current = false; }
      }
    }
  };
  init();
  return () => { cancelado = true; };
}, [rol_actual, token, API_URL, set_y_guardar, set_config_y_guardar, crear_configuracion, refrescar_notificaciones, listar_backend, listar_config_backend, procesar_evento_interno]);

const auto_hide_timer_ref = React.useRef(null);
useEffect(() => {
  if (es_visible_popup) {
    try { clearTimeout(auto_hide_timer_ref.current); } catch (_) {}
    auto_hide_timer_ref.current = setTimeout(() => {
      try { set_es_visible_popup(false); marcar_popup_descartado(); } catch (_) {}
    }, 10000); //Tiempo que permanece activo el pop up de notificicaciones
  } else {
    try { clearTimeout(auto_hide_timer_ref.current); } catch (_) {}
    auto_hide_timer_ref.current = null;
  }
  return () => { try { clearTimeout(auto_hide_timer_ref.current); } catch (_) {} };
}, [es_visible_popup]);



  const valor = {
    notificaciones,
    agregar_notificacion,
    actualizar_notificacion,
    eliminar_notificacion,
    marcar_como_leida,
    marcar_todas_como_leidas,
    obtener_por_rol: obtener_por_rol,
    cantidad_no_leidas,
    cantidad_no_leidas_visibles,
    notificaciones_no_leidas_visibles,
    es_visible_popup,
    mostrar_popup,
    ocultar_popup,
    rol_actual,
    refrescar_notificaciones,
  procesar_evento,
  config_notificaciones,
  listar_configuraciones,
  crear_configuracion,
  actualizar_configuracion,
  eliminar_configuracion,
};

return (
  <ContextoNotificaciones.Provider value={valor}>
    {children}
  </ContextoNotificaciones.Provider>
);

};

export const useControlNotificaciones = () => {
  const ctx = useContext(ContextoNotificaciones);
  if (!ctx) {
    throw new Error('useControlNotificaciones debe usarse dentro de ProveedorNotificaciones');
  }
  return ctx;
};
// (importaciones ya están arriba)

// Opciones de prioridad para las notificaciones

const opciones_prioridad = [
  { valor: 'alta', etiqueta: 'Alta' },
  { valor: 'media', etiqueta: 'Media' },
  { valor: 'baja', etiqueta: 'Baja' },
];

// Tipos de notificación disponibles en UI
const opciones_tipo = Object.values(TIPOS_NOTIFICACION);

// Ayuda contextual para cada tipo de notificación
const tipos_info = {
  exito: 'Señala que todo salió bien. Úsalo tras completar una acción.',
  advertencia: 'Advierte que algo requiere atención antes de continuar.',
  informacion: 'Comunica datos relevantes sin urgencia.',
  tarea: 'Indica que hay algo por hacer y sugiere a dónde ir.',
  correo: 'Mensaje tipo correo interno. Redacta título y contenido claros.',
};

// Helpers para mostrar datos amigables en la tabla
const obtener_nombre_seccion = (id) => {
  const s = SECCIONES_AMIGAS.find((x) => x.id === id);
  return s ? s.nombre : (id || '—');
};
const obtener_nombre_accion = (id) => {
  const a = ACCIONES_AMIGAS.find((x) => x.id === id);
  return a ? a.nombre : (id || '—');
};
const obtener_nombre_ruta = (id) => {
  if (!id) return '—';
  try {
    const info = obtenerTituloPorMenu(id);
    return typeof info === 'object' && info?.titulo ? info.titulo : (info || id);
  } catch { return id; }
};

// Badge de tipo
const clase_badge_tipo = (t) => {
  switch (t) {
    case TIPOS_NOTIFICACION.exito:
      return 'bg-green-100 text-green-700 border-green-200';
    case TIPOS_NOTIFICACION.advertencia:
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case TIPOS_NOTIFICACION.informacion:
      return 'bg-blue-100 text-blue-700 border-blue-200';
    case TIPOS_NOTIFICACION.tarea:
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case TIPOS_NOTIFICACION.correo:
      return 'bg-gray-100 text-gray-700 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};
const etiqueta_tipo = (t) => {
  switch (t) {
    case TIPOS_NOTIFICACION.exito: return 'Éxito';
    case TIPOS_NOTIFICACION.advertencia: return 'Advertencia';
    case TIPOS_NOTIFICACION.informacion: return 'Información';
    case TIPOS_NOTIFICACION.tarea: return 'Tarea';
    case TIPOS_NOTIFICACION.correo: return 'Correo';
    default: return t || '—';
  }
};

const IconoTipo = ({ tipo }) => {
  switch (tipo) {
    case TIPOS_NOTIFICACION.exito:
      return <FiCheckCircle className="inline-block" size={12} />;
    case TIPOS_NOTIFICACION.advertencia:
      return <FiAlertTriangle className="inline-block" size={12} />;
    case TIPOS_NOTIFICACION.informacion:
      return <FiInfo className="inline-block" size={12} />;
    case TIPOS_NOTIFICACION.tarea:
      return <FiClipboard className="inline-block" size={12} />;
    case TIPOS_NOTIFICACION.correo:
      return <FiMail className="inline-block" size={12} />;
    default:
      return null;
  }
};

const SECCIONES_AMIGAS = (() => {
  const lista = [];
  [...(ItemsSidebar || []), ...(ItemsSidebarInferior || [])].forEach(item => {
    if (item && item.id && item.nombre) {
      lista.push({ id: item.id, nombre: item.nombre });
    }
    if (item && Array.isArray(item.submenu)) {
      item.submenu.forEach(sub => {
        if (sub && sub.id && sub.nombre) {
          lista.push({ id: sub.id, nombre: sub.nombre });
        }
      });
    }
  });
  lista.push({ id: 'inicio_sesion', nombre: 'Inicio sesión' });
  return lista;
})();
const ACCIONES_AMIGAS = [
  { id: 'registro_nuevo', nombre: 'Registro nuevo' },
  { id: 'actualizar_contrasena', nombre: 'Actualizar contraseña' },
  { id: 'solicitar_restablecer_contrasena', nombre: 'Solicitar restablecer contraseña' },
  // Administración de usuarios
  { id: 'asignar_rol', nombre: 'Asignar rol' },
  { id: 'aprobar_usuario', nombre: 'Aprobar usuario' },
  { id: 'rechazar_usuario', nombre: 'Rechazar usuario' },
  // Comunicados
  { id: 'publicar_comunicado', nombre: 'Publicar comunicado' },
  { id: 'actualizar_comunicado', nombre: 'Actualizar comunicado' },
  { id: 'eliminar_comunicado', nombre: 'Eliminar comunicado' },
  // Boletines
  { id: 'publicar_boletin', nombre: 'Publicar boletín' },
  { id: 'actualizar_boletin', nombre: 'Actualizar boletín' },
  { id: 'eliminar_boletin', nombre: 'Eliminar boletín' },
  // Carrusel
  { id: 'activar_item_carrusel', nombre: 'Activar elemento del carrusel' },
  { id: 'desactivar_item_carrusel', nombre: 'Desactivar elemento del carrusel' },
  // Normatividad
  { id: 'subir_normatividad', nombre: 'Subir normatividad' },
  { id: 'actualizar_normatividad', nombre: 'Actualizar normatividad' },
  { id: 'eliminar_normatividad', nombre: 'Eliminar normatividad' },
];
const normalizar = (v) => String(v || '').toLowerCase().trim();

const AdministradorNotificaciones = () => {
  const {
    agregar_notificacion,
    refrescar_notificaciones,
    config_notificaciones,
    crear_configuracion,
    actualizar_configuracion,
    eliminar_configuracion,
  } = useControlNotificaciones();
  const { confirmar } = useMensajesConfirmacion();
  const { token } = useInicioSesion();
  const API_BASE = process.env.REACT_APP_API_URL;
  const API_URL = (() => {
    if (API_BASE && /^https?:\/\//.test(API_BASE)) return API_BASE;
    try {
      const host = typeof window !== 'undefined' ? (window.location?.hostname || 'localhost') : 'localhost';
      return `http://${host}:5000/api`;
    } catch (_) {
      return 'http://localhost:5000/api';
    }
  })();
  

  const [roles_disponibles, setRolesDisponibles] = useState([]);
  useEffect(() => {
    let cancel = false;
    const cargarRoles = async () => {
      try {
        const hdrs = token ? { Authorization: `Bearer ${token}` } : {};
        const [rRoles, rPermisos] = await Promise.all([
          fetch(`${API_URL}/autenticacion/admin/roles_unicos`, { headers: hdrs }),
          fetch(`${API_URL}/autenticacion/admin/permisos`, { headers: hdrs }),
        ]);
        if (!rRoles.ok && !rPermisos.ok) return;
        const dataRoles = rRoles.ok ? await rRoles.json() : { roles: [] };
        const dataPermisos = rPermisos.ok ? await rPermisos.json() : { permisos: {} };
        const lista_roles_usuarios = Array.isArray(dataRoles.roles) ? dataRoles.roles.map(normalizar) : [];
        const lista_roles_permisos = Object.keys(dataPermisos.permisos || {}).map(normalizar);
        const union = Array.from(new Set(['admin', ...lista_roles_usuarios, ...lista_roles_permisos]));
        if (!cancel) setRolesDisponibles(union);
      } catch (_) { }
    };
    cargarRoles();
    return () => { cancel = true; };
  }, [API_URL, token]);

  const [pestana_activa, setPestanaActiva] = useState('reglas');
  const [editando_regla_id, setEditandoReglaId] = useState(null);

  const [form_manual, setFormManual] = useState({
    titulo: '',
    mensaje: '',
    tipo: TIPOS_NOTIFICACION.informacion,
    prioridad: 'media',
    roles_destino: [],
    ruta_sugerida: '',
  });

  const [buscando, setBuscando] = useState(false);
  const reglas = config_notificaciones || [];
  const [mostrar_form_regla, setMostrarFormRegla] = useState(false);
  const [error_form_regla, setErrorFormRegla] = useState('');
  const estado_inicial_asistente = {
    rol_origen: 'cualquiera',
    seccion_origen: 'perfil',
    accion: 'registro_nuevo',
    roles_destino: [],
    prioridad: 'media',
    tipo: TIPOS_NOTIFICACION.informacion,
    titulo: '',
    mensaje: '',
    ruta_sugerida: '',
  };
  const [asistente, setAsistente] = useState(estado_inicial_asistente);

  // Manejo de formularios
  const onChangeManual = (e) => {
    const { name, value } = e.target;
    setFormManual(prev => ({ ...prev, [name]: value }));
  };

  const remover_rol_destino_asistente = (rol) => {
    setAsistente(prev => ({ ...prev, roles_destino: (prev.roles_destino || []).filter(r => normalizar(r) !== normalizar(rol)) }));
  };
  const [rol_destino_asistente_sel, setRolDestinoAsistenteSel] = useState('');
  const agregar_rol_destino_asistente = () => {
    const v = normalizar(rol_destino_asistente_sel);
    if (!v) return;
    setAsistente(prev => ({ ...prev, roles_destino: Array.from(new Set([...(prev.roles_destino || []), v])) }));
    setRolDestinoAsistenteSel('');
  };
  const remover_rol_destino_manual = (rol) => {
    setFormManual(prev => ({ ...prev, roles_destino: (prev.roles_destino || []).filter(r => normalizar(r) !== normalizar(rol)) }));
  };
  const [rol_destino_manual_sel, setRolDestinoManualSel] = useState('');
  const agregar_rol_destino_manual = () => {
    const v = normalizar(rol_destino_manual_sel);
    if (!v) return;
    setFormManual(prev => ({ ...prev, roles_destino: Array.from(new Set([...(prev.roles_destino || []), v])) }));
    setRolDestinoManualSel('');
  };

  // Crear o actualizar regla

  const editar_regla = (regla) => {
    setEditandoReglaId(regla.id);
    setPestanaActiva('reglas');
    setMostrarFormRegla(true);
    const [sec, acc] = String(regla.seccion_accion || '').split(':');
    setAsistente({
      rol_origen: regla.rol_origen || 'admin',
      seccion_origen: sec || 'roles_permisos',
      accion: acc || 'crear',
      roles_destino: Array.isArray(regla.roles_destino) ? regla.roles_destino : [],
      prioridad: regla.prioridad || 'media',
      tipo: regla.tipo || TIPOS_NOTIFICACION.informacion,
      titulo: regla.titulo_regla || '',
      mensaje: typeof regla.mensaje === 'string' ? regla.mensaje : '',
      ruta_sugerida: regla.ruta_sugerida || '',
    });
  };

  const cancelar_edicion_regla = () => {
    setEditandoReglaId(null);
    setAsistente(estado_inicial_asistente);
    setMostrarFormRegla(false);
  };

  const guardar_regla_asistente = () => {
    const seccion_sel = SECCIONES_AMIGAS.find(s => s.id === asistente.seccion_origen);
    const accion_sel = ACCIONES_AMIGAS.find(a => a.id === asistente.accion);
    const titulo = asistente.titulo?.trim() || `Aviso: ${accion_sel?.nombre || 'Acción'} en ${seccion_sel?.nombre || 'sección'}`;
    const rutaFinal = asistente.ruta_sugerida || 'inicio';
    if (!Array.isArray(asistente.roles_destino) || asistente.roles_destino.length === 0) { setErrorFormRegla('Agrega al menos un rol destinatario'); return; }
    const payload = {
      titulo_regla: titulo,
      trigger_id: `${asistente.seccion_origen}_${asistente.accion}`,
      tipo: asistente.tipo,
      prioridad: asistente.prioridad,
      rol_origen: asistente.rol_origen,
      seccion_accion: `${asistente.seccion_origen}:${asistente.accion}`,
      roles_destino: asistente.roles_destino,
      mensaje: asistente.mensaje || '',
      ruta_sugerida: rutaFinal,
    };
    if (editando_regla_id) {
      actualizar_configuracion(editando_regla_id, payload);
    } else {
      crear_configuracion(payload);
    }
    setMostrarFormRegla(false);
    setAsistente(estado_inicial_asistente);
    setErrorFormRegla('');
  };

  // Crear notificación manual para roles seleccionados
  const [error_form_manual, setErrorFormManual] = useState('');
  const crear_notificacion_manual = () => {
    const roles_destino_lista = Array.isArray(form_manual.roles_destino) ? form_manual.roles_destino : [];
    const rutaSeleccionada = (form_manual.ruta_sugerida || '').trim();
    const datos_base = { usuario_ejecutor: 'Administrador', nombre: asistente.nombre || '', usuario: asistente.usuario || '', rol: asistente.rol || '' };
    if (roles_destino_lista.length === 0) { setErrorFormManual('Selecciona al menos un rol destinatario'); return; }
    if (!rutaSeleccionada) { setErrorFormManual('Selecciona la ruta donde se mandará al usuario'); return; }
    roles_destino_lista.forEach(rol_dest => {
      let rutaId = rutaSeleccionada || null;
      if (rutaId && !puede_ver_seccion(rutaId, rol_dest)) {
        const fallback = obtener_primera_ruta_permitida(rol_dest);
        rutaId = obtenerIdPorRuta(fallback);
      }
      agregar_notificacion({
        tipo: form_manual.tipo,
        titulo: form_manual.titulo || 'Notificación',
        mensaje: form_manual.mensaje || '',
        rol_destinatario: rol_dest,
        ruta_sugerida: rutaId,
        prioridad: form_manual.prioridad || 'media',
        datos: datos_base,
        forzar: true,
      });
    });
    setFormManual({ titulo: '', mensaje: '', tipo: TIPOS_NOTIFICACION.informacion, prioridad: 'media', roles_destino: [], ruta_sugerida: '' });
    setErrorFormManual('');
  };

  // Refrescar notificaciones usando reglas configuradas
  const ejecutar_refresco = async () => {
    setBuscando(true);
    try { await refrescar_notificaciones(); } finally { setBuscando(false); }
  };



  const secciones_filtradas_asistente = useMemo(() => {
    const rolesSel = asistente.roles_destino || [];
    if (!Array.isArray(rolesSel) || rolesSel.length === 0) return SECCIONES_AMIGAS;
    return SECCIONES_AMIGAS.filter(s => s.id === 'inicio_sesion' || rolesSel.every(r => puede_ver_seccion(s.id, normalizar(r))));
  }, [asistente.roles_destino]);
  const secciones_filtradas_manual = useMemo(() => {
    const rolesSel = form_manual.roles_destino || [];
    if (!Array.isArray(rolesSel) || rolesSel.length === 0) return SECCIONES_AMIGAS;
    return SECCIONES_AMIGAS.filter(s => s.id === 'inicio_sesion' || rolesSel.every(r => puede_ver_seccion(s.id, normalizar(r))));
  }, [form_manual.roles_destino]);
  return (
    <PermisosRuta allowed_roles={['admin']}>
      <div className="mx-auto py-6 px-10">
        {/* Encabezado */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={ejecutar_refresco}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
              title="Refrescar desde servidor"
            >
              <FiRefreshCw size={18} />
              {buscando ? 'Actualizando...' : 'Refrescar'}
            </button>
            <button
              onClick={() => {
                setPestanaActiva('reglas');
                setEditandoReglaId(null);
                setAsistente(estado_inicial_asistente);
                setMostrarFormRegla(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 transition-all shadow-sm hover:shadow-md"
              title="Crear nueva regla"
            >
              <FiPlus size={18} />
              Crear nueva regla
            </button>
          </div>
        </div>
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              type="button"
              onClick={() => setPestanaActiva('reglas')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors cursor-pointer ${pestana_activa === 'reglas'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <span className="flex items-center gap-2"><FiEdit3 size={16} />Reglas Configuradas</span>
            </button>
            <button
              type="button"
              onClick={() => setPestanaActiva('manual')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors cursor-pointer ${pestana_activa === 'manual'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <span className="flex items-center gap-2"><FiBell size={16} />Notificación Manual</span>
            </button>
          </nav>
        </div>

        {pestana_activa === 'reglas' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Reglas configuradas</h2>
            <p className="text-sm text-gray-600 mb-4">Lista de reglas que generan notificaciones automáticas.</p>
            {mostrar_form_regla ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">¿Quién hace la acción?</label>
                    <select value={asistente.rol_origen} onChange={(e) => setAsistente(prev => ({ ...prev, rol_origen: normalizar(e.target.value) }))} className="w-full border rounded-lg px-3 py-2">
                      <option value="cualquiera">cualquiera</option>
                      {roles_disponibles.map(r => (<option key={r} value={r}>{r}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">¿Dónde ocurre?</label>
                    <select value={asistente.seccion_origen} onChange={(e) => setAsistente(prev => ({ ...prev, seccion_origen: e.target.value }))} className="w-full border rounded-lg px-3 py-2">
                      {SECCIONES_AMIGAS.map(s => (<option key={s.id} value={s.id}>{s.nombre}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">¿Qué pasó?</label>
                    <select value={asistente.accion} onChange={(e) => setAsistente(prev => ({ ...prev, accion: e.target.value }))} className="w-full border rounded-lg px-3 py-2">
                      {ACCIONES_AMIGAS.map(a => (<option key={a.id} value={a.id}>{a.nombre}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Prioridad</label>
                    <select value={asistente.prioridad} onChange={(e) => setAsistente(prev => ({ ...prev, prioridad: e.target.value }))} className="w-full border rounded-lg px-3 py-2">
                      {opciones_prioridad.map(op => (<option key={op.valor} value={op.valor}>{op.etiqueta}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Tipo</label>
                    <select value={asistente.tipo} onChange={(e) => setAsistente(prev => ({ ...prev, tipo: e.target.value }))} className="w-full border rounded-lg px-3 py-2">
                      {opciones_tipo.map(t => (<option key={t} value={t}>{t}</option>))}
                    </select>
                    {/* Ayuda contextual según el tipo seleccionado */}
                    <div className="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded-md border border-gray-200">
                      {tipos_info[asistente.tipo] || 'Selecciona un tipo para ver su descripción.'}
                    </div>
                    {/* Campos condicionales mínimos por tipo */}
                    {asistente.tipo === TIPOS_NOTIFICACION.correo ? (
                      <div className="mt-2 text-xs text-gray-600">
                        Se enviará como correo interno. Usa un título descriptivo y redacta el contenido en "Mensaje".
                      </div>
                    ) : null}
                    {asistente.tipo === TIPOS_NOTIFICACION.tarea ? (
                      <div className="mt-2 text-xs text-gray-600">
                        Se creará una tarea y el botón "Ir a…" enviará a la ruta seleccionada en "Ruta donde se mandará al usuario".
                      </div>
                    ) : null}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-700 mb-1">¿A quién avisar?</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 w-1/2">
                        <select value={rol_destino_asistente_sel} onChange={(e) => setRolDestinoAsistenteSel(normalizar(e.target.value))} className="border rounded-lg px-3 py-2 w-1/2">
                          <option value="">Selecciona rol</option>
                          {roles_disponibles.map(r => (<option key={r} value={r}>{r}</option>))}
                        </select>
                        <button type="button" onClick={agregar_rol_destino_asistente} className="px-3 py-2 rounded-lg bg-blue-600 text-white">Agregar</button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(asistente.roles_destino || []).map(r => (
                          <span key={`chip-a-${r}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200 text-xs">
                            {r}
                            <button type="button" onClick={() => remover_rol_destino_asistente(r)} className="ml-1 rounded-full bg-blue-200 text-blue-700 px-1">×</button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Título</label>
                    <input value={asistente.titulo} onChange={(e) => setAsistente(prev => ({ ...prev, titulo: e.target.value }))} className="w-full border rounded-lg px-3 py-2" placeholder="Ej: Aviso de cambios" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-700 mb-1">Mensaje (opcional)</label>
                    <textarea value={asistente.mensaje} onChange={(e) => setAsistente(prev => ({ ...prev, mensaje: e.target.value }))} className="w-full border rounded-lg px-3 py-2" rows={2} placeholder={`Se ${asistente.accion} en ${SECCIONES_AMIGAS.find(s => s.id === asistente.seccion_origen)?.nombre || 'sección'}`} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Ruta donde se mandará al usuario</label>
                    <select value={asistente.ruta_sugerida} onChange={(e) => setAsistente(prev => ({ ...prev, ruta_sugerida: e.target.value }))} className="w-full border rounded-lg px-3 py-2">
                      {secciones_filtradas_asistente.map(s => (<option key={s.id} value={s.id}>{s.nombre}</option>))}
                    </select>
                  </div>
                </div>
                {error_form_regla ? (<div className="text-xs text-red-600 mt-1">{error_form_regla}</div>) : null}
                <div className="flex gap-2 mb-6">
                  <button onClick={guardar_regla_asistente} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700">
                    <FiPlus size={18} /> {editando_regla_id ? 'Guardar cambios' : 'Guardar regla'}
                  </button>
                  <button onClick={cancelar_edicion_regla} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300">Cancelar</button>
                </div>
              </>
            ) : null}
            {reglas.length === 0 ? (
              <p className="text-sm text-gray-600">No hay reglas configuradas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Título</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Mensaje</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">¿Dónde ocurre?</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">¿Qué pasó?</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Tipo</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Prioridad</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Origen</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Destinos</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Ruta sugerida</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Estado</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reglas.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-800">{r.titulo_regla}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{r.mensaje || '—'}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{obtener_nombre_seccion(String(r.seccion_accion || '').split(':')[0])}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{obtener_nombre_accion(String(r.seccion_accion || '').split(':')[1])}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${clase_badge_tipo(r.tipo)}`}>
                            <IconoTipo tipo={r.tipo} />
                            {etiqueta_tipo(r.tipo)}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${clase_badge_prioridad(r.prioridad)}`}>
                            <IconoPrioridad prioridad={r.prioridad} />
                            {etiqueta_prioridad_texto(r.prioridad || 'media')}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">{r.rol_origen}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {(r.roles_destino || []).join(', ')}
                          {Array.isArray(r.roles_destino) && r.roles_destino.some(rd => !roles_disponibles.includes(normalizar(rd))) && (
                            <span className="ml-2 inline-block px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs">Rol eliminado</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">{obtener_nombre_ruta(r.ruta_sugerida)}</td>
                        <td className="px-4 py-2">{r.activo ? (<span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Activa</span>) : (<span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">Inactiva</span>)}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="inline-flex gap-2">
                            <button onClick={async () => { const ok = await confirmar({ titulo: 'Confirmar cambio de estado', mensaje: `¿Desea ${r.activo ? 'desactivar' : 'activar'} esta regla?`, tipo: 'informacion', texto_confirmar: 'Continuar', texto_cancelar: 'Cancelar' }); if (!ok) return; actualizar_configuracion(r.id, { activo: !r.activo }); }} className="px-3 py-1 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200">{r.activo ? 'Desactivar' : 'Activar'}</button>
                            <button onClick={() => editar_regla(r)} className="px-3 py-1 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 inline-flex items-center gap-1"><FiEdit3 size={16} />Editar</button>
                            <button onClick={async () => { const ok = await confirmar({ titulo: 'Confirmar eliminación', mensaje: '¿Eliminar esta regla de notificación?', tipo: 'advertencia', texto_confirmar: 'Eliminar', texto_cancelar: 'Cancelar' }); if (!ok) return; eliminar_configuracion(r.id); }} className="px-3 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 inline-flex items-center gap-1"><FiTrash2 size={16} />Eliminar</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {pestana_activa === 'manual' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">Crear notificación manual</h2>
            <p className="text-sm text-gray-600 mb-4">Envía una notificación inmediata a los roles seleccionados.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Tipo</label>
                <select value={form_manual.tipo} onChange={(e) => onChangeManual({ target: { name: 'tipo', value: e.target.value } })} className="w-full border rounded-lg px-3 py-2">
                  {opciones_tipo.map(t => (<option key={t} value={t}>{t}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Prioridad</label>
                <select value={form_manual.prioridad} onChange={(e) => onChangeManual({ target: { name: 'prioridad', value: e.target.value } })} className="w-full border rounded-lg px-3 py-2">
                  {opciones_prioridad.map(op => (<option key={op.valor} value={op.valor}>{op.etiqueta}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Título</label>
                <input name="titulo" value={form_manual.titulo} onChange={onChangeManual} className="w-full border rounded-lg px-3 py-2" placeholder="Ej: Aviso importante" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-700 mb-1">Mensaje</label>
                <textarea name="mensaje" value={form_manual.mensaje} onChange={onChangeManual} className="w-full border rounded-lg px-3 py-2" rows={3} placeholder="Contenido del aviso" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-700 mb-1">¿A quién avisar?</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <select value={rol_destino_manual_sel} onChange={(e) => setRolDestinoManualSel(normalizar(e.target.value))} className="border rounded-lg px-3 py-2 w-1/3">
                      <option value="">Selecciona rol</option>
                      {roles_disponibles.map(r => (<option key={r} value={r}>{r}</option>))}
                    </select>
                    <button type="button" onClick={agregar_rol_destino_manual} className="px-3 py-2 rounded-lg bg-indigo-600 text-white">Agregar</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(form_manual.roles_destino || []).map(r => (
                      <span key={`chip-m-${r}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs">
                        {r}
                        <button type="button" onClick={() => remover_rol_destino_manual(r)} className="ml-1 rounded-full bg-indigo-200 text-indigo-700 px-1">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Ruta donde se mandará al usuario</label>
                <select value={form_manual.ruta_sugerida} onChange={(e) => onChangeManual({ target: { name: 'ruta_sugerida', value: e.target.value } })} className="w-full border rounded-lg px-3 py-2">
                  <option value="">Selecciona…</option>
                  {secciones_filtradas_manual.map(s => (<option key={s.id} value={s.id}>{s.nombre}</option>))}
                </select>
                {error_form_manual ? (<div className="text-xs text-red-600 mt-1">{error_form_manual}</div>) : null}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={crear_notificacion_manual} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"><FiBell size={18} />Crear notificación</button>
              <button onClick={() => setFormManual({ titulo: '', mensaje: '', tipo: TIPOS_NOTIFICACION.informacion, prioridad: 'media', roles_destino: [], ruta_sugerida: '' })} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300">Limpiar</button>
            </div>
          </div>
        )}



      </div>
    </PermisosRuta>
  );
};

export default AdministradorNotificaciones;
const clase_badge_prioridad = (p) => {
  switch (p) {
    case 'alta':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'media':
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    default:
      return 'bg-green-100 text-green-700 border-green-200';
  }
};
const etiqueta_prioridad_texto = (p) => {
  switch (p) {
    case 'alta': return 'Alta';
    case 'media': return 'Media';
    default: return 'Baja';
  }
};
const IconoPrioridad = ({ prioridad }) => {
  switch (prioridad) {
    case 'alta':
      return <FiAlertTriangle className="inline-block" size={12} />;
    case 'media':
      return <FiInfo className="inline-block" size={12} />;
    default:
      return <FiCheckCircle className="inline-block" size={12} />;
  }
};
