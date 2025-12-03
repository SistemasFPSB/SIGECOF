// roles_permisos.jsx - Componente unificado para gestión de roles y permisos
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useInicioSesion } from '../../pagina_inicial/inicio_sesion/contexto/inicio_sesion-Context';
import { actualizar_etiqueta_rol_backend, obtener_etiquetas_roles } from '../../utilidades/estado_persistente.jsx';
import { useControlNotificaciones } from './administrador_notificaciones.jsx';
import { obtenerIdPorRuta, secciones_disponibles, obtener_ruta_por_id as obtenerRutaPorIdItems, es_ruta_conocida as esRutaConocidaItems, obtener_permisos_criticos_base as obtenerPermisosCriticosBaseItems, obtener_permisos_criticos_rol as obtenerPermisosCriticosRolItems, obtener_primera_ruta_permitida_desde_permisos as obtenerPrimeraRutaDesdePermisosItems } from '../../utilidades/items';
import { useMensajesConfirmacion } from '../../utilidades/comunes/mensajes_confirmacion.jsx';

export const roles = {
  administrador: 'admin',
  pendiente: 'pendiente',
};

export const ETIQUETAS_ROL_POR_DEFECTO = {};

let permisos_secciones_por_rol = {};
let etiquetas_roles_sobrescritas = {};

export const actualizar_permisos_rol = (rol, permisos_array) => {
  if (!rol || !Array.isArray(permisos_array)) return;
  const rol_normalizado = normalizar_rol(rol);
  permisos_secciones_por_rol[rol_normalizado] = new Set(permisos_array);
};

const normalizar_rol = (rol) => {
  if (!rol) return roles.pendiente;
  return String(rol).toLowerCase().trim();
};

// Persistencia se delega al backend; se mantiene sólo en memoria en el cliente
const escribir_cache_permisos = () => {};

const permisos_efectivos_por_rol = (rol) => {
  const rol_norm = normalizar_rol(rol);
  const direct = permisos_secciones_por_rol[rol_norm];
  if (direct instanceof Set) return direct;
  const set = permisos_secciones_por_rol[rol_norm] instanceof Set ? permisos_secciones_por_rol[rol_norm] : new Set();
  permisos_secciones_por_rol[rol_norm] = set;
  return set;
};

export const permisos_estan_listos = (rol) => {
  const permisos = permisos_efectivos_por_rol(rol);
  return permisos instanceof Set && permisos.size > 0;
};

const cargar_sobrescrituras_etiquetas_rol = () => ({ ...etiquetas_roles_sobrescritas });

export const obtener_etiquetas_rol = () => ({
  ...ETIQUETAS_ROL_POR_DEFECTO,
  ...cargar_sobrescrituras_etiquetas_rol(),
});

export const etiqueta_rol = (rol) => {
  const etiquetas = obtener_etiquetas_rol();
  return etiquetas[normalizar_rol(rol)] || normalizar_rol(rol);
};

export const establecer_etiquetas_roles = (mapa) => {
  if (mapa && typeof mapa === 'object') {
    const normalizadas = {};
    Object.keys(mapa).forEach((k) => {
      const key = String(k).toLowerCase().trim();
      const val = String(mapa[k] ?? '').trim();
      if (key) normalizadas[key] = val || key;
    });
    etiquetas_roles_sobrescritas = { ...etiquetas_roles_sobrescritas, ...normalizadas };
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('etiquetas_roles_actualizadas'));
  }
};

export const actualizar_etiqueta_rol = async (rol, nueva_etiqueta) => {
  if (!rol || !nueva_etiqueta) return;
  const rol_norm = normalizar_rol(rol);
  try {
    const API_BASE = process.env.REACT_APP_API_URL;
    const API_URL = (() => {
      if (API_BASE && /^https?:\/\//.test(API_BASE)) return String(API_BASE).replace(/\/+$/, '');
      try {
        const host = typeof window !== 'undefined' ? (window.location?.hostname || 'localhost') : 'localhost';
        return `http://${host}:5000/api`;
      } catch (_) {
        return 'http://localhost:5000/api';
      }
    })();
    await fetch(`${API_URL}/preferencias/roles/etiquetas`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rol: rol_norm, etiqueta: nueva_etiqueta })
    });
    const actuales = obtener_etiquetas_rol();
    establecer_etiquetas_roles({ ...actuales, [rol_norm]: nueva_etiqueta });
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('etiquetas_roles_actualizadas'));
  } catch (e) {}
};

export const obtener_rol_actual = (usuarioAutenticado, token) => {
  if (usuarioAutenticado?.rol) {
    return normalizar_rol(usuarioAutenticado.rol);
  }
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const rolPayload = normalizar_rol(payload?.rol);
      return rolPayload || roles.pendiente;
    } catch (e) {
      // ignorar
    }
  }
  return roles.pendiente;
};

export const puede_ver_seccion = (id_seccion, rol) => {
  const permisos = permisos_efectivos_por_rol(rol);
  return permisos.has(id_seccion);
};

export const filtrar_items_sidebar_por_rol = (items, rol) => {
  return (items || [])
    .filter(item => puede_ver_seccion(item.id, rol) || (item.submenu && item.submenu.some(sub => puede_ver_seccion(sub.id, rol))))
    .map(item => {
      if (item.submenu) {
        const submenu_filtrado = item.submenu.filter(sub => puede_ver_seccion(sub.id, rol));
        if (!puede_ver_seccion(item.id, rol) && submenu_filtrado.length === 0) {
          return null;
        }
        return { ...item, submenu: submenu_filtrado };
      }
      return item;
    })
    .filter(Boolean);
};

export const obtener_ruta_por_id = (id) => obtenerRutaPorIdItems(id);

export const obtener_primera_ruta_permitida = (rol) => obtenerPrimeraRutaDesdePermisosItems(permisos_efectivos_por_rol(rol));

export const es_ruta_conocida = (pathname = '/') => esRutaConocidaItems(pathname);

// centralizado en utilidades/items

export const PermisosRuta = ({ allowed_roles = [], children }) => {
  const { token, usuarioAutenticado, cargando } = useInicioSesion();
  const location = useLocation();
  const autenticado = !!token || !!usuarioAutenticado;

  // Mientras se valida sesión, mostrar children para que el overlay cubra la transición
  if (cargando) {
    return children;
  }

  if (!autenticado) {
    const p = location?.pathname || '/';
    if (p.startsWith('/app')) return children;
    return <Navigate to="/" replace />;
  }

  // La verificación de cambio de contraseña se realiza en el flujo de sesión inicial

  const pathnameActual = location?.pathname || '/';
  // Permitir que el cálculo de permisos sobre el id resuelva si se puede ver

  const idRuta = obtenerIdPorRuta(pathnameActual);
  const rol = obtener_rol_actual(usuarioAutenticado, token);

  // Si permisos aún no están listos, mostrar children (overlay activo)
  if (!permisos_estan_listos(rol)) {
    return children;
  }

  const tienePermiso = puede_ver_seccion(idRuta, rol);
  if (!tienePermiso) {
    const destino = obtener_primera_ruta_permitida(rol);
    return <Navigate to={destino} replace />;
  }

  if (allowed_roles.length > 0 && !allowed_roles.includes(rol)) {
    return <Navigate to="/app" replace />;
  }

  return children;
};

export const Permisos_Ruta = PermisosRuta;

// ✨ TOGGLE SWITCH JERÁRQUICO
const ToggleSwitch = ({ checked, onChange, disabled = false, size = 'md', variant = 'default' }) => {
  const sizeConfig = {
    sm: { width: 'w-10', height: 'h-5', circle: 'w-4 h-4', translate: checked ? 'translate-x-5' : 'translate-x-0' },
    md: { width: 'w-12', height: 'h-6', circle: 'w-5 h-5', translate: checked ? 'translate-x-6' : 'translate-x-0' },
  };
  const { width, height, circle, translate } = sizeConfig[size] || sizeConfig.md;
  const bgColor = disabled
    ? 'bg-gray-200'
    : variant === 'parent'
    ? (checked ? 'bg-indigo-600' : 'bg-gray-300')
    : (checked ? 'bg-blue-600' : 'bg-gray-300');
  const focusRing = variant === 'parent'
    ? 'focus:ring-indigo-500'
    : 'focus:ring-blue-500';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange()}
      disabled={disabled}
      className={`
        relative rounded-full transition-colors duration-200 ease-in-out
        focus:outline-none focus:ring-2 ${focusRing} focus:ring-offset-2
        ${bgColor} ${width} ${height} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <span className={`absolute top-0.5 left-0.5 bg-white rounded-full shadow ${circle} ${translate} transition-transform duration-200 ease-in-out`} />
    </button>
  );
};

const RolesPermisos = () => {
  const { token, usuarioAutenticado } = useInicioSesion();
  const { procesar_evento, rol_actual } = useControlNotificaciones();
  const API_BASE = process.env.REACT_APP_API_URL;
  const BASE_CON_API = (API_BASE && /^https?:\/\//.test(API_BASE))
    ? String(API_BASE).replace(/\/+$/, '')
    : 'http://127.0.0.1:5000/api';

  const fetch_flexible = React.useCallback(async (ruta_relativa, opciones = {}) => {
    const url = `${BASE_CON_API}${ruta_relativa}`;
    try {
      const resp = await fetch(url, { credentials: 'include', ...opciones });
      let data = {};
      try { data = await resp.json(); } catch {}
      return { resp, data };
    } catch (error) {
      return { resp: { ok: false, status: 0 }, data: { error: error.message } };
    }
  }, [BASE_CON_API]);

  const headersAuth = useMemo(() => (
    token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
  ), [token]);

  const [roles_sistema, setRolesSistema] = useState([]);
  const [permisos_actuales, setPermisosActuales] = useState({});
  const [usuarios_pendientes, setUsuariosPendientes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [pestaña_activa, setPestañaActiva] = useState('permisos');

  const rol_actual_usuario = usuarioAutenticado?.rol ? normalizar_rol(usuarioAutenticado.rol) : '';

  const permisos_criticos = useMemo(() => obtenerPermisosCriticosBaseItems(rol_actual_usuario), [rol_actual_usuario]);

  const [rol_seleccionado, setRolSeleccionado] = useState('');
  const [permisos_seleccionados, setPermisosSeleccionados] = useState(new Set());
  const [modo_edicion_permisos, setModoEdicionPermisos] = useState(false);
  const [filtro_rol, setFiltroRol] = useState('');

  const [usuario_seleccionado, setUsuarioSeleccionado] = useState(null);
  const { confirmar } = useMensajesConfirmacion();
  const [rol_nuevo, setRolNuevo] = useState('');
  const [alias_nuevo, setAliasNuevo] = useState('');
  const [rol_seleccionado_asignar, setRolSeleccionadoAsignar] = useState('');
  const [alias_seleccionado, setAliasSeleccionado] = useState('');
  const [rol_alias_editando, setRolAliasEditando] = useState(null);
  const [alias_valor_editar, setAliasValorEditar] = useState('');

  // Estados de búsqueda movidos al componente "gestionar_usuarios"

  

  const cargar_datos = React.useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [{ data: dataRoles }, { data: dataPermisos }, { data: dataUsuarios }] = await Promise.all([
        fetch_flexible('/autenticacion/admin/roles_unicos', { headers: headersAuth }),
        fetch_flexible('/autenticacion/admin/permisos', { headers: headersAuth }),
        fetch_flexible('/autenticacion/admin/usuarios_pendientes', { headers: headersAuth })
      ]);

      const rolesBackend = Array.isArray(dataRoles.roles) ? dataRoles.roles.map(r => normalizar_rol(r)) : [];
      const permisosBackend = dataPermisos.permisos || {};
      const rolesDesdePermisos = Object.keys(permisosBackend).map(r => normalizar_rol(r));
      let rolesDesdeAliases = [];
      try {
        const { resp: rAliasesKeys, data: dAliasesKeys } = await fetch_flexible('/autenticacion/admin/roles_aliases', { headers: headersAuth });
        if (rAliasesKeys && rAliasesKeys.ok && dAliasesKeys && typeof dAliasesKeys.aliases === 'object') {
          rolesDesdeAliases = Object.keys(dAliasesKeys.aliases).map(normalizar_rol);
        }
      } catch (_) {}
      const rolesSistemaCompletos = [...new Set([...Object.values(roles || {}), ...rolesBackend, ...rolesDesdePermisos, ...rolesDesdeAliases])].sort();

      const permisosLimpios = {};
      Object.keys(permisosBackend).forEach(rol => {
        const rol_norm = normalizar_rol(rol);
        let permisos_rol = [...permisosBackend[rol]];
        if (rol_norm !== 'admin' && rol_norm !== 'administrador') {
          const permisos_admin = ['administrador', 'gestionar_usuarios', 'contrasenas_temporales', 'roles_permisos', 'administrador_ayuda'];
          permisos_rol = permisos_rol.filter(permiso => !permisos_admin.includes(permiso));
        }
        const existentes = new Set(permisosLimpios[rol_norm] || []);
        permisos_rol.forEach(p => existentes.add(p));
        permisosLimpios[rol_norm] = Array.from(existentes);
      });

      setRolesSistema(rolesSistemaCompletos);
      setPermisosActuales(permisosLimpios);
      permisos_secciones_por_rol = {};
      Object.keys(permisosLimpios).forEach(r => { permisos_secciones_por_rol[r] = new Set(permisosLimpios[r]); });
      escribir_cache_permisos(permisosLimpios);
      setUsuariosPendientes(Array.isArray(dataUsuarios.usuarios) ? dataUsuarios.usuarios : []);

      let aliases_mapa = {};
      if (dataPermisos && typeof dataPermisos.aliases === 'object') {
        aliases_mapa = dataPermisos.aliases || {};
      } else {
        try {
          const { resp: rAliases, data: dAliases } = await fetch_flexible('/autenticacion/admin/roles_aliases', { headers: headersAuth });
          if (rAliases && rAliases.ok && dAliases && typeof dAliases.aliases === 'object') {
            aliases_mapa = dAliases.aliases || {};
          }
        } catch {}
      }
      if (!aliases_mapa || Object.keys(aliases_mapa).length === 0) {
        try {
          const etiquetas = await obtener_etiquetas_roles(token);
          if (etiquetas && typeof etiquetas === 'object') {
            aliases_mapa = etiquetas;
          }
        } catch {}
      }
      if (aliases_mapa && typeof aliases_mapa === 'object' && Object.keys(aliases_mapa).length > 0) {
        establecer_etiquetas_roles(aliases_mapa);
      }
    } catch (e) {
      const roles_locales = Object.values(roles || {}).sort();
      const permisos_locales = {};
      roles_locales.forEach(r => {
        let lista = secciones_disponibles.map(s => s.id).filter(id => puede_ver_seccion(id, r));
        if (r !== 'admin' && r !== 'administrador') {
          const permisos_admin = ['administrador', 'gestionar_usuarios', 'contrasenas_temporales', 'roles_permisos', 'administrador_ayuda'];
          lista = lista.filter(permiso => !permisos_admin.includes(permiso));
        }
        permisos_locales[r] = lista;
      });
      setRolesSistema(roles_locales);
      setPermisosActuales(permisos_locales);
      permisos_secciones_por_rol = {};
      Object.keys(permisos_locales).forEach(r => { permisos_secciones_por_rol[r] = new Set(permisos_locales[r]); });
      escribir_cache_permisos(permisos_locales);
      setUsuariosPendientes([]);
      setMensaje('Usando datos locales');
    } finally {
      setCargando(false);
    }
  }, [headersAuth, secciones_disponibles, fetch_flexible]);

  useEffect(() => {
    if (token) cargar_datos();
  }, [token, cargar_datos]);

  const guardar_alias_backend_flexible = async (rol_norm, alias) => {
    try {
      const res = await fetch(`${BASE_CON_API}/autenticacion/admin/roles_aliases`, {
        method: 'PUT',
        headers: headersAuth,
        body: JSON.stringify({ rol: rol_norm, alias })
      });
      if (res && res.ok) return true;
    } catch {}
    try {
      await actualizar_etiqueta_rol_backend(rol_norm, alias, token);
      return true;
    } catch {}
    return false;
  };

  const [version_etiquetas, setVersionEtiquetas] = useState(0);
  useEffect(() => {
    const handler = () => setVersionEtiquetas((v) => v + 1);
    try { window.addEventListener('etiquetas_roles_actualizadas', handler); } catch (_) {}
    return () => { try { window.removeEventListener('etiquetas_roles_actualizadas', handler); } catch (_) {} };
  }, []);

  const roles_filtrados = useMemo(() => {
    if (!filtro_rol.trim()) return roles_sistema;
    const etiquetas = obtener_etiquetas_rol();
    return roles_sistema.filter(rol => {
      const k = String(rol).toLowerCase().trim();
      const etiqueta = etiquetas[k] || k;
      return etiqueta.toLowerCase().includes(filtro_rol.toLowerCase());
    });
  }, [roles_sistema, filtro_rol, version_etiquetas]);

  const iniciar_edicion_alias = (rol) => {
    setRolAliasEditando(rol);
    setAliasValorEditar(obtener_etiqueta_rol(rol));
  };

  const cancelar_edicion_alias = () => {
    setRolAliasEditando(null);
    setAliasValorEditar('');
  };

  const guardar_alias = async () => {
    const r = rol_alias_editando;
    const alias = String(alias_valor_editar || '').trim();
    if (!r || !alias || alias.length > ALIAS_MAX || alias === obtener_etiqueta_rol(r)) return;
    try {
      const k = String(r).toLowerCase().trim();
      const ok = await guardar_alias_backend_flexible(k, alias);
      if (!ok) return;
      const actuales = obtener_etiquetas_rol();
      establecer_etiquetas_roles({ ...actuales, [k]: alias });
      try { window.dispatchEvent(new CustomEvent('etiquetas_roles_actualizadas')); } catch (_) {}
      cancelar_edicion_alias();
    } catch (_) {}
  };

  const ALIAS_MAX = 30;
  const alias_actual_editando = rol_alias_editando ? obtener_etiqueta_rol(rol_alias_editando) : '';
  const alias_trim = String(alias_valor_editar || '').trim();
  const alias_invalido = !alias_trim || alias_trim.length > ALIAS_MAX;
  const alias_sin_cambios = rol_alias_editando ? alias_trim === alias_actual_editando : true;

  const obtener_menus_padres = (id_seccion) => {
    const seccion = secciones_disponibles.find(s => s.id === id_seccion);
    if (!seccion || !seccion.menu_padre) return [];
    const menus_padres = [];
    let padre_actual = seccion.menu_padre;
    while (padre_actual) {
      const actual = padre_actual;
      menus_padres.push(actual);
      const seccion_padre = secciones_disponibles.find(s => s.id === actual);
      padre_actual = seccion_padre && seccion_padre.menu_padre ? seccion_padre.menu_padre : null;
    }
    return menus_padres;
  };

  const obtener_permisos_criticos_rol = (rol) => obtenerPermisosCriticosRolItems(rol, rol_actual_usuario);

  const toggle_permiso = (id_seccion) => {
    const nuevos_permisos = new Set(permisos_seleccionados);
    const criticos_actuales = obtener_permisos_criticos_rol(rol_seleccionado);
    if (nuevos_permisos.has(id_seccion)) {
      if (criticos_actuales.has(id_seccion)) {
        const msg = rol_seleccionado === 'pendiente'
          ? 'No puedes desactivar permisos críticos de este rol'
          : (rol_seleccionado === rol_actual_usuario ? 'No puedes desactivar permisos críticos para tu propio rol' : '');
        if (msg) {
          setError(msg);
          setTimeout(() => setError(''), 3000);
        }
        return;
      }
      nuevos_permisos.delete(id_seccion);
    } else {
      nuevos_permisos.add(id_seccion);
      const menus_padres = obtener_menus_padres(id_seccion);
      menus_padres.forEach(padre => {
        nuevos_permisos.add(padre);
      });
    }
    setPermisosSeleccionados(nuevos_permisos);
  };

  const seleccionar_todos = () => {
    const todas_las_secciones_filtradas = [];
    Object.values(secciones_por_categoria).forEach(secciones => {
      secciones.forEach(seccion => {
        todas_las_secciones_filtradas.push(seccion.id);
      });
    });
    if (rol_seleccionado === rol_actual_usuario) {
      const todos_los_permisos = new Set(todas_las_secciones_filtradas);
      const criticos_actuales = obtener_permisos_criticos_rol(rol_seleccionado);
      criticos_actuales.forEach(permiso => {
        todos_los_permisos.add(permiso);
      });
      setPermisosSeleccionados(todos_los_permisos);
    } else {
      const todos_los_permisos = new Set(todas_las_secciones_filtradas);
      if (rol_seleccionado === 'pendiente') {
        const criticos_actuales = obtener_permisos_criticos_rol(rol_seleccionado);
        criticos_actuales.forEach(permiso => {
          todos_los_permisos.add(permiso);
        });
      }
      setPermisosSeleccionados(todos_los_permisos);
    }
  };

  const deseleccionar_todos = () => {
    if (rol_seleccionado === rol_actual_usuario) {
      const criticos_actuales = obtener_permisos_criticos_rol(rol_seleccionado);
      const permisos_minimos = new Set(criticos_actuales);
      setPermisosSeleccionados(permisos_minimos);
    } else {
      if (rol_seleccionado === 'pendiente') {
        const criticos_actuales = obtener_permisos_criticos_rol(rol_seleccionado);
        const permisos_minimos = new Set(criticos_actuales);
        setPermisosSeleccionados(permisos_minimos);
      } else {
        setPermisosSeleccionados(new Set());
      }
    }
  };

  const seleccionar_rol_permisos = (rol) => {
    setRolSeleccionado(rol);
    setModoEdicionPermisos(true);
    if (rol === 'pendiente') {
      const permisos_del_rol = permisos_actuales[rol] || [];
      if (Array.isArray(permisos_del_rol) && permisos_del_rol.length > 0) {
        setPermisosSeleccionados(new Set(permisos_del_rol));
      } else {
        setPermisosSeleccionados(new Set(['rol_pendiente']));
      }
    } else {
      const permisos_del_rol = permisos_actuales[rol] || [];
      setPermisosSeleccionados(new Set(permisos_del_rol));
    }
  };

  const guardar_permisos = async () => {
    if (!rol_seleccionado) return;
    {
      const ok = await confirmar({
        titulo: 'Confirmar guardado de permisos',
        mensaje: `¿Guardar cambios de permisos para el rol "${rol_seleccionado}"?`,
        tipo: 'informacion',
        texto_confirmar: 'Guardar',
        texto_cancelar: 'Cancelar',
      });
      if (!ok) return;
    }
    setGuardando(true);
    setError('');
    try {
      let permisos_array = Array.from(permisos_seleccionados);
      if (rol_seleccionado !== 'admin' && rol_seleccionado !== 'administrador') {
        const permisos_admin = ['administrador', 'gestionar_usuarios', 'contrasenas_temporales', 'roles_permisos'];
        permisos_array = permisos_array.filter(permiso => !permisos_admin.includes(permiso));
      }
      if (rol_seleccionado === 'pendiente') {
        const criticos = ['rol_pendiente'];
        criticos.forEach(p => { if (!permisos_array.includes(p)) permisos_array.push(p); });
      }
      if (rol_seleccionado === 'admin' || rol_seleccionado === 'administrador') {
        if (!permisos_array.includes('roles_permisos')) permisos_array.push('roles_permisos');
        if (!permisos_array.includes('gestionar_usuarios')) permisos_array.push('gestionar_usuarios');
      }

      const alias_actual = obtener_etiqueta_rol(rol_seleccionado);
      const { resp, data } = await fetch_flexible(`/autenticacion/admin/permisos/${rol_seleccionado}`, {
        method: 'PUT',
        headers: headersAuth,
        body: JSON.stringify({ permisos: permisos_array, alias: alias_actual })
      });

      if (!resp.ok || !data.exito) throw new Error(data.error || 'Error guardando permisos');

      setPermisosActuales(prev => {
        const nuevo = { ...prev, [rol_seleccionado]: permisos_array };
        actualizar_permisos_rol(rol_seleccionado, permisos_array);
        permisos_secciones_por_rol[rol_seleccionado] = new Set(permisos_array);
        escribir_cache_permisos(nuevo);
        return nuevo;
      });

      if (rol_seleccionado === rol_actual_usuario) {
        window.dispatchEvent(new CustomEvent('actualizar_permisos', { detail: { timestamp: Date.now() } }));
        setTimeout(() => cargar_datos(), 300);
      }

      setMensaje('Permisos guardados exitosamente');
      setTimeout(() => setMensaje(''), 3000);
      setTimeout(() => cancelar_edicion_permisos(), 1500);
    } catch (e) {
      setError(e.message || 'Error al guardar permisos');
      setTimeout(() => setError(''), 3000);
    } finally {
      setGuardando(false);
    }
  };

  const cancelar_edicion_permisos = () => {
    setRolSeleccionado('');
    setPermisosSeleccionados(new Set());
    setModoEdicionPermisos(false);
  };

  const eliminar_rol = async (rolAEliminar) => {
    if (!rolAEliminar || ['admin', 'administrador', 'pendiente'].includes(rolAEliminar)) return;
    {
      const ok = await confirmar({
        titulo: 'Confirmar eliminación de rol',
        mensaje: `¿Estás seguro de eliminar el rol "${obtener_etiqueta_rol(rolAEliminar)}"?`,
        tipo: 'advertencia',
        texto_confirmar: 'Eliminar',
        texto_cancelar: 'Cancelar',
      });
      if (!ok) return;
    }
    setEliminando(true);
    setError('');
    try {
      const { resp, data } = await fetch_flexible(`/autenticacion/admin/roles/${rolAEliminar}`, {
        method: 'DELETE',
        headers: headersAuth
      });
      if (!resp.ok || !data.exito) throw new Error(data.error || 'Error eliminando rol');
      setRolesSistema(prev => prev.filter(rol => rol !== rolAEliminar));
      setPermisosActuales(prev => {
        const nuevosPermisos = { ...prev };
        delete nuevosPermisos[rolAEliminar];
        return nuevosPermisos;
      });
      if (rol_seleccionado === rolAEliminar) cancelar_edicion_permisos();
      setMensaje('Rol eliminado exitosamente');
      setTimeout(() => setMensaje(''), 5000);
      setTimeout(() => cargar_datos(), 300);
    } catch (e) {
      setError(e.message || 'Error al eliminar el rol');
      setTimeout(() => setError(''), 3000);
    } finally {
      setEliminando(false);
    }
  };

  const normalizar_rol_entrada = (str) => {
    if (!str) return '';
    const s = String(str).trim().toLowerCase();
    const base = s.replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
    return base;
  };

  // Lógica de búsqueda movida a "gestionar_usuarios"

  // Manejador de búsqueda movido a "gestionar_usuarios"

  const crear_rol_nuevo = async () => {
    setError(null);
    const normalizado = normalizar_rol_entrada(rol_nuevo);
    if (!normalizado) {
      setError('Ingrese un nombre de rol válido (solo letras, números y guiones bajos).');
      return;
    }
    if (normalizado === 'pendiente') {
      setError('"pendiente" no es un rol asignable. Elija otro nombre.');
      return;
    }
    if (roles_sistema.includes(normalizado)) {
      setMensaje('Ese rol ya existe en el sistema.');
      return;
    }
    const alias_visible = (alias_nuevo && alias_nuevo.trim())
      ? alias_nuevo.trim()
      : normalizado.charAt(0).toUpperCase() + normalizado.slice(1);
    await guardar_alias_backend_flexible(normalizado, alias_visible);
    const actuales = obtener_etiquetas_rol();
    establecer_etiquetas_roles({ ...actuales, [normalizado]: alias_visible });
    try { window.dispatchEvent(new CustomEvent('etiquetas_roles_actualizadas')); } catch (_) {}
    setRolesSistema(prev => [...prev, normalizado]);
    setMensaje(`Rol "${alias_visible}" creado.`);
    setRolNuevo('');
    setAliasNuevo('');
  };

  const asignar_rol = async (usuario_id, rol, alias_visible) => {
    const ok = await confirmar({
      titulo: 'Confirmar asignación de rol',
      mensaje: `¿Asignar el rol "${obtener_etiqueta_rol(rol)}" al usuario seleccionado?`,
      tipo: 'informacion',
      texto_confirmar: 'Asignar',
      texto_cancelar: 'Cancelar',
    });
    if (!ok) return;
    setGuardando(true);
    setMensaje(null);
    setError(null);
    try {
      if (!usuario_id || !rol) throw new Error('Seleccione usuario y rol');
      const alias_a_postear = String(alias_visible || obtener_etiqueta_rol(rol) || '').trim();
      const res = await fetch(`${BASE_CON_API}/autenticacion/admin/usuarios/asignar-rol`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headersAuth },
        body: JSON.stringify({ id_usuario: usuario_id, rol }),
      });
      const data = await res.json();
      if (!res.ok || !data.exito) throw new Error(data.error || 'No se pudo asignar el rol');
      setUsuariosPendientes(prev => prev.filter(u => String(u.id_usuario) !== String(usuario_id)));
      if (alias_a_postear) {
        const k = String(rol).toLowerCase().trim();
        await guardar_alias_backend_flexible(k, alias_a_postear);
        const actuales = obtener_etiquetas_rol();
        establecer_etiquetas_roles({ ...actuales, [k]: alias_a_postear });
        try { window.dispatchEvent(new CustomEvent('etiquetas_roles_actualizadas')); } catch (_) {}
      }
      setMensaje(`Rol asignado correctamente.`);
      try { procesar_evento({ seccion: 'roles_permisos', accion: 'asignar_rol', rol_origen: rol_actual, datos: { usuario: data?.usuario || '', rol: rol } }); } catch (_) {}
    } catch (e) {
      if (e.message.includes('administrador principal')) {
        setError('⚠️ El usuario administrador principal no puede cambiar de rol');
      } else {
        setError(e.message);
      }
    } finally {
      setGuardando(false);
    }
  };

  

  function obtener_etiqueta_rol(rol) {
    const etiquetas = obtener_etiquetas_rol();
    const k = String(rol).toLowerCase().trim();
    return etiquetas[k] || k;
  }

  const secciones_por_categoria = useMemo(() => {
    const agrupadas = {};
    secciones_disponibles.forEach(seccion => {
      if (seccion.id === 'rol_pendiente' && rol_seleccionado !== 'pendiente' && rol_seleccionado !== 'admin' && rol_seleccionado !== 'administrador') return;
      if (seccion.categoria === 'Administración' && rol_seleccionado !== 'admin' && rol_seleccionado !== 'administrador') return;
      if (!agrupadas[seccion.categoria]) agrupadas[seccion.categoria] = [];
      agrupadas[seccion.categoria].push(seccion);
    });
    return agrupadas;
  }, [secciones_disponibles, rol_seleccionado]);

  const total_secciones_visibles = useMemo(() => {
    let total = 0;
    Object.values(secciones_por_categoria).forEach(secciones => total += secciones.length);
    return total;
  }, [secciones_por_categoria]);

  return (
    <div className="mx-auto py-4 px-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={cargar_datos}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow"
            title="Actualizar listado"
          >
            <FiRefreshCw size={16} />
            <span className="font-medium text-sm">Actualizar</span>
          </button>
        </div>
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setPestañaActiva('permisos')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                pestaña_activa === 'permisos'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <FiKey size={16} />
                Gestionar Permisos
              </div>
            </button>
            <button
              onClick={() => setPestañaActiva('asignacion')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                pestaña_activa === 'asignacion'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <FiUsers size={16} />
                Asignar Roles
                {usuarios_pendientes.length > 0 && (
                  <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-0.5 rounded-full">
                    {usuarios_pendientes.length}
                  </span>
                )}
              </div>
            </button>
          </nav>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
          <FiAlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}
      {mensaje && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
          <div className="flex items-center">
            <FiCheckCircle className="mr-2" size={16} />
            {mensaje}
          </div>
        </div>
      )}

      {pestaña_activa === 'permisos' && (
        <div>
          {!modo_edicion_permisos && (
            <div className="mb-4">
              <div className="relative w-full max-w-sm">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input
                  type="text"
                  value={filtro_rol}
                  onChange={(e) => setFiltroRol(e.target.value)}
                  placeholder="Buscar rol..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {!modo_edicion_permisos && (
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FiPlus size={20} />
                Crear nuevo rol
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  value={rol_nuevo}
                  onChange={(e) => setRolNuevo(e.target.value)}
                  placeholder="Nombre de rol (ej. operador_externo)"
                  className="flex-1 min-w-[220px] px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="text"
                  value={alias_nuevo}
                  onChange={(e) => setAliasNuevo(e.target.value)}
                  placeholder="Alias visible (ej. Operador Externo)"
                  className="flex-1 min-w-[220px] px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={crear_rol_nuevo}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    rol_nuevo ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md' : 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  }`}
                  disabled={!rol_nuevo}
                >
                  Crear rol
                </button>
              </div>
              {rol_nuevo && (
                <p className="mt-2 text-xs text-gray-500">
                  Se guardará como clave: <strong>{normalizar_rol_entrada(rol_nuevo) || '...'}</strong>
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Nota: Los roles nuevos no tienen permisos definidos automáticamente.
              </p>
            </div>
          )}

          {!modo_edicion_permisos ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              {cargando ? (
                <div className="flex justify-center items-center h-48">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : roles_filtrados.length === 0 ? (
                <div className="text-center py-12 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 m-4 rounded-lg">
                  <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                    <FiEdit3 className="w-8 h-8 text-gray-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-1">Sin roles</h3>
                  <p className="text-gray-600 text-sm max-w-sm mx-auto">No hay roles disponibles para gestionar permisos.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-4 py-2 text-xs font-semibold text-gray-700">Rol</th>
                        <th className="px-4 py-2 text-xs font-semibold text-gray-700">Clave</th>
                        <th className="px-4 py-2 text-xs font-semibold text-gray-700">Permisos</th>
                        <th className="px-4 py-2 text-xs font-semibold text-gray-700">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roles_filtrados.map((rol) => (
                        <tr key={rol} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-800 font-medium text-sm">
                            {rol_alias_editando === rol ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  maxLength={ALIAS_MAX}
                                  className={`px-2 py-1 border rounded text-sm ${alias_invalido ? 'border-red-500' : 'border-gray-300'}`}
                                  value={alias_valor_editar}
                                  onChange={(e) => setAliasValorEditar(e.target.value)}
                                />
                                <span className="text-xs text-gray-500">{alias_trim.length}/{ALIAS_MAX}</span>
                                {alias_invalido ? (
                                  <span className="text-xs text-red-600">{!alias_trim ? 'Alias requerido' : 'Máximo ' + ALIAS_MAX + ' caracteres'}</span>
                                ) : alias_sin_cambios ? (
                                  <span className="text-xs text-gray-500">Sin cambios</span>
                                ) : null}
                                <button onClick={guardar_alias} disabled={alias_invalido || alias_sin_cambios} className={`px-2 py-1 ${alias_invalido || alias_sin_cambios ? 'bg-green-300 cursor-not-allowed' : 'bg-green-600'} text-white rounded text-xs`}>Guardar</button>
                                <button onClick={cancelar_edicion_alias} className="px-2 py-1 bg-gray-200 text-gray-800 rounded text-xs">Cancelar</button>
                              </div>
                            ) : (
                              obtener_etiqueta_rol(rol)
                            )}
                            {rol === 'pendiente' && (
                              <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                                Limitado
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-gray-600 text-xs font-mono">{rol}</td>
                          <td className="px-4 py-2 text-gray-700">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              {(permisos_actuales[rol] || []).length}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex gap-2">
                              <button
                                onClick={() => seleccionar_rol_permisos(rol)}
                                className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors duration-200 text-xs font-medium"
                              >
                                <FiEdit3 size={14} />
                                Gestionar
                              </button>
                              <button
                                onClick={() => iniciar_edicion_alias(rol)}
                                className="flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors duration-200 text-xs font-medium"
                              >
                                Alias
                              </button>
                              {rol !== 'admin' && rol !== 'administrador' && rol !== 'pendiente' && (
                                <button
                                  onClick={() => eliminar_rol(rol)}
                                  disabled={eliminando}
                                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-100 text-red-700 hover:bg-red-200 transition-colors duration-200 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <FiTrash2 size={14} />
                                  Eliminar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    Gestionar Permisos — <span className="text-indigo-700">{obtener_etiqueta_rol(rol_seleccionado)}</span>
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {rol_seleccionado === 'pendiente'
                      ? 'Este rol es pendiente; puedes habilitar más secciones sin desactivar las críticas.'
                      : 'Activa las secciones a las que este rol tendrá acceso.'
                    }
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={guardar_permisos}
                    disabled={guardando}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed font-medium shadow-sm"
                  >
                    <FiSave size={18} />
                    {guardando ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                  <button
                    onClick={cancelar_edicion_permisos}
                    className="px-4 py-2.5 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mb-6">
                <button
                  onClick={seleccionar_todos}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Seleccionar Todos
                </button>
                <button
                  onClick={deseleccionar_todos}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Deseleccionar Todos
                </button>
              </div>

              {/* ✨ NUEVO DISEÑO DE PERMISOS ✨ */}
              <div className="space-y-5">
                {Object.entries(secciones_por_categoria).map(([categoria, secciones]) => (
                  <div key={categoria} className="border border-gray-200 rounded-xl p-5 bg-gray-50">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <span className="w-2 h-2 bg-indigo-500 rounded-full mr-3"></span>
                      {categoria}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {secciones.map((seccion) => {
                        const criticos_actuales = obtener_permisos_criticos_rol(rol_seleccionado);
                        const es_critico = criticos_actuales.has(seccion.id) && rol_seleccionado === rol_actual_usuario;
                        const es_menu_padre = seccion.es_menu_padre;
                        const tiene_menu_padre = seccion.menu_padre;
                        const menu_padre_activo = tiene_menu_padre && permisos_seleccionados.has(seccion.menu_padre);
                        const esta_activo = permisos_seleccionados.has(seccion.id);
                        const disabled = es_critico || (rol_seleccionado === 'pendiente' && criticos_actuales.has(seccion.id));

                        let contenedorClass = "p-4 bg-white rounded-lg border transition-all duration-200";
                        if (es_menu_padre) {
                          contenedorClass += esta_activo ? " border-indigo-300 shadow-sm" : " border-gray-200";
                        } else if (tiene_menu_padre) {
                          contenedorClass += menu_padre_activo ? " border-gray-200" : " border-gray-200 opacity-70";
                        } else {
                          contenedorClass += " border-gray-200";
                        }

                        return (
                          <div key={seccion.id} className={contenedorClass}>
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0 pr-3">
                                <div className={`text-sm font-medium ${
                                  es_critico ? 'text-yellow-700' :
                                  es_menu_padre ? 'text-indigo-800' : 'text-gray-800'
                                }`}>
                                  {seccion.nombre}
                                  {es_critico && (
                                    <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full font-medium">
                                      Crítico
                                    </span>
                                  )}
                                </div>
                                {tiene_menu_padre && (
                                  <div className="flex items-center mt-2 text-xs text-gray-500">
                                    <FiChevronRight size={12} className="mr-1 text-indigo-500" />
                                    <span>Depende de: <span className="font-medium text-indigo-600">
                                      {secciones_disponibles.find(s => s.id === seccion.menu_padre)?.nombre}
                                    </span></span>
                                  </div>
                                )}
                              </div>
                              <ToggleSwitch
                                checked={esta_activo}
                                onChange={() => toggle_permiso(seccion.id)}
                                disabled={disabled}
                                variant={es_menu_padre ? 'parent' : 'default'}
                                size="sm"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <p className="text-blue-800 font-medium">
                  ✅ Secciones seleccionadas: <span className="font-bold">{permisos_seleccionados.size}</span> de <span className="font-bold">{total_secciones_visibles}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {pestaña_activa === 'asignacion' && (
        <div className="space-y-6">
          {/* Se eliminó la búsqueda aquí; ahora está en 'Gestionar usuarios' */}

          {usuarios_pendientes.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <FiUsers size={20} />
                  Usuarios Pendientes
                </h2>
                <span className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                  {usuarios_pendientes.length} usuario{usuarios_pendientes.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="space-y-5">
                {usuarios_pendientes.map((usuario) => (
                  <div 
                    key={usuario.id_usuario}
                    className={`border rounded-xl p-5 transition-all duration-200 hover:shadow-md ${
                      usuario_seleccionado?.id_usuario === usuario.id_usuario 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {usuario.nombre || usuario.usuario}
                            </h3>
                            <p className="text-gray-600 text-sm">@{usuario.usuario}</p>
                          </div>
                        </div>
                        <div className="mb-4">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            Rol pendiente
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {roles_sistema.map((rol) => (
                            <button
                              key={rol}
                              onClick={() => {
                                setUsuarioSeleccionado(usuario);
                                setRolSeleccionadoAsignar(rol);
                                setAliasSeleccionado(obtener_etiqueta_rol(rol));
                              }}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                rol_seleccionado_asignar === rol && usuario_seleccionado?.id_usuario === usuario.id_usuario
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {obtener_etiqueta_rol(rol)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 ml-4">
                        {rol_seleccionado_asignar && usuario_seleccionado?.id_usuario === usuario.id_usuario && (
                          <button
                            onClick={() => asignar_rol(
                              usuario.id_usuario,
                              rol_seleccionado_asignar,
                              alias_seleccionado && alias_seleccionado.trim() ? alias_seleccionado.trim() : obtener_etiqueta_rol(rol_seleccionado_asignar)
                            )}
                            disabled={guardando}
                            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm hover:shadow-md"
                          >
                            {guardando ? 'Asignando...' : 'Asignar Rol'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {usuarios_pendientes.length === 0 && (
            <div className="text-center py-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
              <div className="w-20 h-20 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                <FiUsers className="w-10 h-10 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">No hay usuarios pendientes</h3>
              <p className="text-gray-600 max-w-md mx-auto">Todos los usuarios han sido asignados a roles.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RolesPermisos;
