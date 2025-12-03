import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInicioSesion } from '../../pagina_inicial/inicio_sesion/contexto/inicio_sesion-Context';
import { etiqueta_rol } from '../administrador/roles_permisos';

// Intenta extraer el rol del token si no está en el contexto
const rolDesdeToken = (token) => {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return String(payload?.rol || '').toLowerCase();
  } catch (e) {
    return null;
  }
};

const nombreDesdeToken = (token) => {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.nombre || null;
  } catch (e) {
    return null;
  }
};

const Header = () => {
  const navigate = useNavigate();
  const { usuarioAutenticado, cargando, logout, token } = useInicioSesion();

  // Preferir 'nombre'; si no, usar 'nombre_completo' o 'usuario'
  const nombre_mostrar = cargando ? 'Cargando…' : (usuarioAutenticado?.nombre || usuarioAutenticado?.nombre_completo || nombreDesdeToken(token) || usuarioAutenticado?.usuario || 'Usuario');
  // Mostrar el rol del usuario enmascarado. Si no está, intentar desde el token; default 'pendiente'.
  const rol_raw = cargando ? null : (usuarioAutenticado?.rol || rolDesdeToken(token) || 'pendiente');
  const etiqueta_rol_usuario = rol_raw ? etiqueta_rol(rol_raw) : 'Validando sesión…';

  // API base y origen del backend para recursos estáticos
  const api_base = process.env.REACT_APP_API_URL;
  const api_url = (() => {
    if (api_base && /^https?:\/\//.test(api_base)) return api_base;
    try {
      const host = typeof window !== 'undefined' ? (window.location?.hostname || 'localhost') : 'localhost';
      return `http://${host}:5000/api`;
    } catch (_) {
      return 'http://localhost:5000/api';
    }
  })();
  const origen_backend = useMemo(() => {
    try {
      if (api_url.startsWith('/')) return window.location.origin;
      return new URL(api_url).origin;
    } catch (e) {
      return window.location.origin;
    }
  }, [api_url]);

  // Normalizar variantes de nombre para el patrón de archivo id_usuario_nombre.ext
  const id_usuario = usuarioAutenticado?.id_usuario;
  // Identificadores en memoria para evitar mezclar fotos entre cuentas
  const MEM_KEY_PREVIEW = useMemo(() => id_usuario ? `foto_usuario_preview_url_${id_usuario}` : 'foto_usuario_preview_url', [id_usuario]);
  const MEM_KEY_URL = useMemo(() => id_usuario ? `foto_usuario_url_${id_usuario}` : 'foto_usuario_url', [id_usuario]);
  const nombre_variantes = useMemo(() => {
    const fuentes = [usuarioAutenticado?.nombre, usuarioAutenticado?.nombre_completo, usuarioAutenticado?.usuario].filter(Boolean);
    const normalizar = (s) => s.toString().trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_-]/g, '_');
    const set = new Set(fuentes.map(normalizar));
    return Array.from(set);
  }, [usuarioAutenticado]);

  // Preferir preview en memoria si se ha cargado previamente desde la API
  const preview_guardado_rel = null;
  const url_guardada_rel = null;
  const preview_guardada_abs = useMemo(() => {
    if (!preview_guardado_rel) return null;
    const abs = /^https?:\/\//.test(preview_guardado_rel) ? preview_guardado_rel : `${origen_backend}${preview_guardado_rel}`;
    // Normalizar al origen actual (p.ej. si quedó guardada en 5001 en el pasado)
    try {
      const u = new URL(abs);
      const origen_actual = new URL(origen_backend);
      u.protocol = origen_actual.protocol;
      u.host = origen_actual.host;
      return u.toString();
    } catch (e) {
      return abs.replace(':5001', ':5000');
    }
  }, [preview_guardado_rel, origen_backend]);

  const url_guardada_abs = useMemo(() => {
    if (!url_guardada_rel) return null;
    const abs = /^https?:\/\//.test(url_guardada_rel) ? url_guardada_rel : `${origen_backend}${url_guardada_rel}`;
    try {
      const u = new URL(abs);
      const origen_actual = new URL(origen_backend);
      u.protocol = origen_actual.protocol;
      u.host = origen_actual.host;
      return u.toString();
    } catch (e) {
      return abs.replace(':5001', ':5000');
    }
  }, [url_guardada_rel, origen_backend]);

  // Candidatos por extensión (coincide con backend .jpg/.jpeg/.png)
  // Nota: ahora evitamos probar puertos alternos y sólo usamos el origen estable
  // para reducir el parpadeo; además, verificaremos con HEAD antes de mostrar.
  const candidatos = useMemo(() => {
    if (!id_usuario || !nombre_variantes.length) return [];
    const lista = [];
    nombre_variantes.forEach((nom) => {
      const base = `${origen_backend}/fotos_usuario/${id_usuario}_${nom}`;
      lista.push(`${base}.jpg`, `${base}.jpeg`, `${base}.png`);
    });
    return lista;
  }, [id_usuario, nombre_variantes, origen_backend]);

  const [avatar_url, set_avatar_url] = useState(preview_guardada_abs || url_guardada_abs || null);

  // Al cambiar de usuario, reiniciar vista para evitar fugas entre sesiones
  useEffect(() => { set_avatar_url(null); }, [id_usuario]);

  // Inicializar avatar: si hay url guardada úsala; si no, pre-cargar imágenes fuera del DOM para evitar parpadeos.
  useEffect(() => {
    const init = async () => {
      // Preferir preview persistido del servidor si existe
      if (preview_guardada_abs) {
        set_avatar_url(preview_guardada_abs);
        return;
      }
      // En su defecto, si existe previsualización en memoria usarla (omitido almacenamiento local)
      if (url_guardada_abs) {
        set_avatar_url(url_guardada_abs);
        return;
      }
      if (!candidatos.length) {
        set_avatar_url(null);
        return;
      }
      // Intentar obtener la URL oficial desde la API
      try {
          const r = await fetch(`${api_url}/autenticacion/foto`, { headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' });
          if (r.ok) {
            const d = await r.json();
            if (d?.exito && (d?.preview_url || d?.url)) {
              const prev = d.preview_url ? (/^https?:\/\//.test(d.preview_url) ? d.preview_url : `${origen_backend}${d.preview_url}`) : null;
              const abs = d.url ? (/^https?:\/\//.test(d.url) ? d.url : `${origen_backend}${d.url}`) : null;
              if (prev) { set_avatar_url(prev); return; }
              if (abs) {
                set_avatar_url(abs); return;
              }
            }
          }
      } catch (e) {
        // Ignorar y continuar con precarga
      }
      // Pre-cargar cada candidato con Image() y usar el primero que cargue
      let cancelado = false;
      const probar = (index) => {
        if (cancelado || index >= candidatos.length) {
          set_avatar_url(null);
          return;
        }
        const img = new Image();
        img.onload = () => {
          if (!cancelado) {
            const url_ok = candidatos[index];
            set_avatar_url(url_ok);
          }
        };
        img.onerror = () => probar(index + 1);
        img.src = candidatos[index];
      };
      probar(0);
      return () => { cancelado = true; };
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url_guardada_abs, id_usuario, nombre_variantes, origen_backend]);

  // Si la imagen falla en tiempo de render, no hagamos más intentos para evitar parpadeos.
  const manejar_error_imagen = () => {
    set_avatar_url(null);
  };

  const inicial = (nombre_mostrar || 'U').trim().charAt(0).toUpperCase();

  const handleLogout = () => {
    try { logout?.(); } catch (e) {}
    if (typeof window !== 'undefined') {
      window.location.assign('/login');
    } else {
      navigate('/login', { replace: true });
    }
  };
  return (
    <header className="bg-blue-900 text-white p-4 sm:p-8 sticky top-0 z-50 h-16 flex items-center">
      <div className="flex justify-between items-center w-full max-w-screen-2xl mx-auto pl-8">
        {/* Lado izquierdo */}
        <div className=" flex">
          {/* Usar ruta absoluta desde /public para evitar ruptura en sub-rutas */}
          <img src="/images/logo_sin_fondo_blanco.png" alt="Logo SIGECOF" className="w-10 h-10" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight pl-3 text-white">
            SIGECOF
          </h1>
          {/* <p className="text-xs opacity-20 font-normal hidden sm:block pl-3 content-end py-1.5">
            Sistema de Gestión y Control del FOPESIBAN
          </p> */}
        </div>

        {/* Lado derecho - Usuario */}
        <div className="flex items-center">
          <div className="flex items-center gap-4 p-2 rounded-lg transition-colors hover:bg-white/10 cursor-pointer">
            {/* Avatar dinámico */}
            {avatar_url ? (
              <img
                src={avatar_url}
                alt={`Foto de ${nombre_mostrar}`}
                className="w-9 h-9 rounded-full object-cover border border-white/20"
                onError={manejar_error_imagen}
              />
            ) : (
              <div className="w-9 h-9 flex items-center justify-center bg-white/10 rounded-full text-white">
                <span>{inicial}</span>
              </div>
            )}
            {/* Datos de usuario */}
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-tight text-white">
                {nombre_mostrar}
              </span>
              <span className="text-xs text-white/80 leading-tight">
                {etiqueta_rol_usuario}
              </span>
            </div>
          </div>
          
          <button 
            className="ml-2 bg-white/10 border border-white/20 rounded-lg p-2 text-white cursor-pointer transition-all hover:bg-white/20 hover:border-white/30 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center"
            title="Cerrar sesión"
            onClick={handleLogout}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
