import { useState, useEffect, useMemo, useRef } from 'react';
import { FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { ItemsSidebar, ItemsSidebarInferior } from '../../utilidades/items';
import { obtener_sidebar_estado, guardar_sidebar_estado, iniciar_ws, on_evento_ws } from '../../utilidades/estado_persistente.jsx';
import { useInicioSesion } from '../../pagina_inicial/inicio_sesion/contexto/inicio_sesion-Context';
import { filtrar_items_sidebar_por_rol, puede_ver_seccion, permisos_estan_listos, actualizar_permisos_rol } from '../../sigecof/administrador/roles_permisos';
import { useControlNotificaciones } from '../administrador/administrador_notificaciones.jsx';

const Sidebar = ({ sidebarColapsado, setSidebarColapsado, menuActivo }) => {
  const [submenusManuales, setSubmenusManuales] = useState({});
  const [actualizadorPermisos, setActualizadorPermisos] = useState(0);
  const timeoutRef = useRef(null);
  const { usuarioAutenticado, cargando, token } = useInicioSesion();
  const rolActual = usuarioAutenticado?.rol || 'pendiente';
  const { cantidad_no_leidas_visibles, refrescar_notificaciones } = useControlNotificaciones();
  const navigate = useNavigate();

  const [itemsFiltradosSuperior, setItemsFiltradosSuperior] = useState([]);
  const [itemsFiltradosInferior, setItemsFiltradosInferior] = useState([]);
  useEffect(() => {
    if (cargando) return;
    let cancelado = false;
    const aplicarFiltrado = () => {
      if (cancelado) return;
      setItemsFiltradosSuperior(filtrar_items_sidebar_por_rol(ItemsSidebar, rolActual));
      setItemsFiltradosInferior(filtrar_items_sidebar_por_rol(ItemsSidebarInferior, rolActual));
    };
    if (!permisos_estan_listos(rolActual)) {
      (async () => {
        try {
          const API_BASE = process.env.REACT_APP_API_URL;
          const API_URL = (() => {
            if (API_BASE && /^https?:\/\//.test(API_BASE)) return API_BASE;
            try {
              const host = typeof window !== 'undefined' ? (window.location?.hostname || 'localhost') : 'localhost';
              const proto = typeof window !== 'undefined' ? (window.location?.protocol || 'http:') : 'http:';
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
          const hdrs = token ? { Authorization: `Bearer ${token}` } : {};
          const rol_norm = String(rolActual || '').toLowerCase();
          let lista = [];
          if (rol_norm === 'admin' || rol_norm === 'administrador') {
            const r = await fetch(`${API_URL}/autenticacion/admin/permisos`, { headers: hdrs, credentials: 'include' });
            const d = await r.json().catch(() => ({}));
            if (d && typeof d?.permisos === 'object' && Array.isArray(d.permisos[rol_norm])) {
              lista = d.permisos[rol_norm];
            }
          } else {
            const r = await fetch(`${API_URL}/autenticacion/permisos_mi_rol`, { headers: hdrs, credentials: 'include' });
            const d = await r.json().catch(() => ({}));
            if (Array.isArray(d?.permisos)) lista = d.permisos;
            if (lista.length === 0) {
              const r2 = await fetch(`${API_URL}/autenticacion/admin/permisos`, { headers: hdrs, credentials: 'include' });
              const d2 = await r2.json().catch(() => ({}));
              if (d2 && typeof d2?.permisos === 'object' && Array.isArray(d2.permisos[rol_norm])) {
                lista = d2.permisos[rol_norm];
              }
            }
          }
          if (!Array.isArray(lista)) lista = [];
          if (lista.length === 0 && rol_norm === 'pendiente') {
            lista = ['rol_pendiente'];
          }
          if (lista.length > 0) actualizar_permisos_rol(rol_norm, lista);
        } catch (_) {}
        aplicarFiltrado();
      })();
    } else {
      aplicarFiltrado();
    }
    return () => { cancelado = true; };
  }, [rolActual, actualizadorPermisos, cargando]);

  const todosItems = useMemo(() => [...itemsFiltradosSuperior, ...itemsFiltradosInferior], [itemsFiltradosSuperior, itemsFiltradosInferior]);

  const submenusActivos = useMemo(() => {
    const activos = {};
    todosItems.forEach(item => {
      if (item.submenu?.some(sub => sub.id === menuActivo)) {
        activos[item.id] = true;
      }
    });
    return activos;
  }, [menuActivo, todosItems]);

  const submenusAbiertos = useMemo(() => {
    if (sidebarColapsado) return submenusActivos;
    return { ...submenusManuales, ...submenusActivos };
  }, [submenusManuales, submenusActivos, sidebarColapsado]);

  const toggleSubmenu = (menuId) => {
    if (sidebarColapsado) return;
    setSubmenusManuales(prev => ({
      ...prev,
      [menuId]: !prev[menuId]
    }));
    try {
      guardar_sidebar_estado({ abiertos: { ...submenusManuales, [menuId]: !submenusManuales[menuId] }, activo: menuActivo, colapsado: sidebarColapsado }, token);
    } catch (_) {}
  };

  const getRutaById = (id) => {
    const principal = ItemsSidebar.find(i => i.id === id);
    if (principal && typeof principal.ruta !== 'undefined') return principal.ruta;
    for (const item of ItemsSidebar) {
      if (item.submenu) {
        const sub = item.submenu.find(s => s.id === id);
        if (sub && typeof sub.ruta !== 'undefined') return sub.ruta;
      }
    }
    for (const item of ItemsSidebarInferior) {
      if (item.id === id && typeof item.ruta !== 'undefined') return item.ruta;
      if (item.submenu) {
        const sub = item.submenu.find(s => s.id === id);
        if (sub && typeof sub.ruta !== 'undefined') return sub.ruta;
      }
    }
    return '';
  };

  const handleMenuClick = (menuId, submenuId = null) => {
    const goToRuta = (id) => {
      const ruta = getRutaById(id);
      if (!ruta) {
        navigate('/app');
      } else {
        navigate(`/${ruta}`);
      }
    };

    if (submenuId) {
      goToRuta(submenuId);
    } else {
      const item = todosItems.find(i => i.id === menuId);
      if (item?.submenu) {
        toggleSubmenu(menuId);
      } else {
        goToRuta(menuId);
      }
    }
  };

  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
    setSidebarColapsado(false);
  };

  const handleMouseLeave = () => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setSidebarColapsado(true);
      setSubmenusManuales({});
      try { guardar_sidebar_estado({ abiertos: {}, activo: menuActivo, colapsado: true }, token); } catch (_) {}
    }, 600);
  };

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => {
    // Cargar estado persistido del sidebar
    (async () => {
      try {
        const estado = await obtener_sidebar_estado(token);
        if (estado?.abiertos && typeof estado.abiertos === 'object') {
          setSubmenusManuales(estado.abiertos);
        }
        if (typeof estado.colapsado === 'boolean') {
          setSidebarColapsado(Boolean(estado.colapsado));
        }
      } catch (_) {}
    })();

    const handleActualizarPermisos = (event) => {
      if (event.detail?.timestamp) {
        setActualizadorPermisos(event.detail.timestamp);
      } else {
        setActualizadorPermisos(prev => prev + 1);
      }
      setSubmenusManuales(prev => ({ ...prev }));
    };

    window.addEventListener('actualizar_permisos', handleActualizarPermisos);
    // Suscripción a WS para reflejar cambios remotos
    try {
      iniciar_ws(token);
      const off = on_evento_ws('sidebar_actualizado', (data) => {
        if (data?.abiertos && typeof data.abiertos === 'object') setSubmenusManuales(data.abiertos);
        if (typeof data?.colapsado === 'boolean') setSidebarColapsado(Boolean(data.colapsado));
      });
      return () => { window.removeEventListener('actualizar_permisos', handleActualizarPermisos); off && off(); };
    } catch (_) {
      return () => window.removeEventListener('actualizar_permisos', handleActualizarPermisos);
    }
  }, []);

  useEffect(() => {
    if (cargando) return;
    if (!permisos_estan_listos(rolActual)) return;
    if (!puede_ver_seccion(menuActivo, rolActual)) {
      const primero = (itemsFiltradosSuperior[0]?.id) ||
        (itemsFiltradosInferior[0]?.submenu?.[0]?.id) ||
        (itemsFiltradosInferior[0]?.id) || 'inicio';
      const ruta = getRutaById(primero);
      navigate(ruta ? `/${ruta}` : '/app', { replace: true });
    }
    try { guardar_sidebar_estado({ abiertos: submenusManuales, activo: menuActivo, colapsado: sidebarColapsado }, token); } catch (_) {}
  }, [rolActual, menuActivo, itemsFiltradosSuperior, itemsFiltradosInferior, navigate, cargando]);

  useEffect(() => {
    if (cargando) return;
    if (!token) return;
    (async () => {
      try { await refrescar_notificaciones(); } catch (_) {}
    })();
  }, [token, cargando, refrescar_notificaciones]);

  

  // --- Componente interno: MenuItem ---
  const MenuItem = ({ item }) => {
    const Icon = item.icono;
    const isActive = menuActivo === item.id || 
      (item.submenu && item.submenu.some(sub => sub.id === menuActivo));
    const isSubmenuOpen = submenusAbiertos[item.id] || false;
    const es_notificaciones = item.id === 'notificaciones';

    return (
      <li key={item.id}>
        <button
          onClick={() => item.submenu ? toggleSubmenu(item.id) : handleMenuClick(item.id)}
          className={`group relative w-full h-10 flex items-center rounded-lg transition-all duration-700 ease-in-out px-3 ${
            isActive
              ? 'bg-blue-600 text-white border-r-4 border-blue-100'
              : 'text-slate-100 hover:bg-blue-950 hover:text-blue-400'
          }`}
          disabled={sidebarColapsado && item.submenu}
        >
          <div className="absolute left-3 w-5 h-5 flex items-center justify-center">
            <Icon className="w-5 h-5 group-hover:scale-110 transition-transform duration-700" />
          </div>

          {/* Badge de notificaciones en la esquina superior derecha del botón */}
          {es_notificaciones && cantidad_no_leidas_visibles > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center shadow-sm transition-all duration-700"> 
              {cantidad_no_leidas_visibles}
            </span>
          )}

          {!sidebarColapsado && (
            <span className="ml-10 flex-1 text-left pl-1 whitespace-nowrap transition-all duration-700">
              {item.nombre}
            </span>
          )}

          {item.submenu && !sidebarColapsado && (
            <span className="absolute right-3">
              {isSubmenuOpen ? (
                <FiChevronUp className={`w-4 h-4 transition-transform duration-700 ${isActive ? 'text-blue-400 scale-110' : ''}`} />
              ) : (
                <FiChevronDown className={`w-4 h-4 transition-transform duration-700 ${isActive ? 'text-blue-400' : ''}`} />
              )}
            </span>
          )}
        </button>

        {item.submenu && (
          <div className={`transition-all duration-700 ease-in-out overflow-hidden ${
            sidebarColapsado || !isSubmenuOpen ? 'max-h-0 opacity-0 invisible' : 'max-h-96 opacity-100 visible mt-2'
          }`}>
            {/* NUEVO ESTILO SOLO PARA SUBMENÚS - AJUSTADO */}
            <div className="pl-4 border-l border-slate-700 ml-1 space-y-1">
              {item.submenu.map(subitem => {
                const SubIcon = subitem.icono;
                return (
                  <button
                    key={subitem.id}
                    onClick={() => handleMenuClick(item.id, subitem.id)}
                    className={`flex items-center py-2.5 px-3 text-sm rounded-lg transition-all duration-700 ease-in-out relative whitespace-nowrap w-full text-left ${
                      menuActivo === subitem.id
                        ? 'text-yellow-400 font-medium'
                        : 'text-slate-100 hover:text-white hover:bg-blue-950/50'
                    }`}
                    disabled={sidebarColapsado}
                  >
                    {/* Indicador de sub-sección activa */}
                    {menuActivo === subitem.id && (
                      <div className="absolute left-0 w-1 h-full bg-yellow-400 rounded-r-sm transition-all duration-700"></div>
                    )}

                    {SubIcon ? (
                      <span className="w-6 h-6 mr-2.5 flex items-center justify-center">
                        <SubIcon className="w-5 h-5 flex-shrink-0 transition-transform duration-700" />
                      </span>
                    ) : (
                      <span className="w-6 mr-2.5" />
                    )}
                    <span className={`text-[15px] transition-all duration-700 ${!sidebarColapsado ? 'opacity-100' : 'opacity-0 absolute -z-10'}`}>
                      {subitem.nombre}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <div
      className="fixed left-0 top-16 z-30 h-[calc(100vh-4rem)]"
      style={{
        width: sidebarColapsado ? '4rem' : '16rem',
        paddingRight: sidebarColapsado ? 0 : '1.25rem',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <aside
        className={`bg-white shadow-lg h-full transition-all duration-700 ease-in-out ${
          sidebarColapsado ? 'w-16' : 'w-64'
        }`}
      >
        <nav className="h-full flex flex-col bg-slate-900 overflow-hidden transition-all duration-700">
          <div className="overflow-y-auto py-4 flex-1 no-scrollbar transition-all duration-700">
            <ul className="space-y-1 px-2 transition-all duration-700">
              {itemsFiltradosSuperior.map(item => (
                <MenuItem key={item.id} item={item} />
              ))}
            </ul>
          </div>

          <div className="shrink-0 py-2 transition-all duration-700">
            <div className="h-px bg-slate-700 mx-2 my-1 transition-all duration-700"></div>
            <ul className="space-y-1 px-2 transition-all duration-700">
              {itemsFiltradosInferior.map(item => (
                <MenuItem key={item.id} item={item} />
              ))}
            </ul>
          </div>
        </nav>
      </aside>
    </div>
  );
};

export default Sidebar;
