// components/datos_secciones/items_sidebar-titulo.js
import {
  FiHome, FiSettings, FiPieChart, FiBell, FiLock, FiCoffee, FiFeather, FiKey, FiUsers,
} from 'react-icons/fi';
import { FaCashRegister, FaRegSmile  } from "react-icons/fa";
import { FaBullhorn } from "react-icons/fa6";
import { RxComponent1 } from "react-icons/rx";
import { ImHammer2 } from "react-icons/im";
import { TbBuildingCarousel, TbUserHeart, TbPasswordUser } from "react-icons/tb"; //prisma
import { MdOutlineBeachAccess } from "react-icons/md";


// === MENÚ PRINCIPAL ===
export const ItemsSidebar = [
  {
    id: 'rol_pendiente',
    nombre: 'Pendiente',
    icono: FiCoffee,
    titulo: 'Hola!',
    subtitulo: 'Bienvenido al Sistema Integral de Gestión y Control Financiero del FOPESIBAN',
    ruta: 'pendiente' // ruta index dentro de /app (se navega a /app)
  },
  {
    id: 'inicio',
    nombre: 'Inicio',
    icono: FiHome,
    titulo: 'Inicio',
    subtitulo: 'Bienvenido al Sistema Integral de Gestión y Control Financiero del FOPESIBAN',
    ruta: '' // ruta index dentro de /app (se navega a /app)
  },
  {
    id: 'dashboard',
    nombre: 'Dashboard',
    icono: FiPieChart,
    titulo: 'Dashboard',
    subtitulo: 'Resumen general y estadísticas del sistema',
    ruta: 'dashboard'
  },
  {
    id: 'padrón',
    nombre: 'Gestión del Padrón',
    icono: TbUserHeart,
    titulo: 'Gestión de Padrón',
    subtitulo: 'Administra el padrón de usuarios y registros',
    ruta: 'padron'
  },
  
  {
  id: 'vacaciones',
  nombre: 'Vacaciones e Incidencias',
  icono: MdOutlineBeachAccess,
  titulo: 'Gestión de Vacaciones e Incidencias',
  subtitulo: 'Administra las vacaciones e incidencias de los usuarios',
  ruta: 'vacaciones_incidencias'
  },
  {
    id: 'administrar_pantalla_inicial',
    nombre: 'Pantalla Inicial',
    icono: RxComponent1,
    titulo: 'Administrar Pantalla Inicial',
    subtitulo: 'Gestión de componentes en la pantalla inicial',
    submenu: [
      { 
        id: 'carrusel', 
        nombre: 'Carrusel', 
        icono: TbBuildingCarousel,
        titulo: 'Carrusel',
        subtitulo: 'Gestiona el carrusel de imágenes que se muestra en la pantalla principal',
        ruta: 'administrador/carrusel'
      },
      { 
        id: 'normatividad', 
        nombre: 'Normatividad', 
        icono: ImHammer2,
        titulo: 'Normatividad',
        subtitulo: 'Gestiona la normatividad que se muestra en la pantalla principal',
        ruta: 'administrador/normatividad'
      },
      {
        id: 'comunicados',
        nombre: 'Comunicados',
        icono: FaBullhorn,
        titulo: 'Comunicados',
        subtitulo: 'Gestiona los comunicados que se muestran en la pantalla principal',
        ruta: 'administrador/comunicados'
      },
      { 
        id: 'boletines', 
        nombre: 'Boletines', 
        icono: FaCashRegister,
        titulo: 'Boletines',
        subtitulo: 'Gestiona los boletines que se muestran en la pantalla principal',
        ruta: 'administrador/boletines'
      },
    ],
  },
];

// === MENÚ INFERIOR ===
export const ItemsSidebarInferior = [
    {
    id: 'notificaciones',
    nombre: 'Notificaciones',
    icono: FiBell,
    titulo: 'Notificaciones',
    subtitulo: 'Centro de alertas y notificaciones del sistema',
    ruta: 'notificaciones'
  },
  {
    id: 'administrador',
    nombre: 'Administrador',
    icono: FiFeather,
    titulo: 'Administrador',
    subtitulo: 'Gestión de Usuarios y Permisos',
    submenu: [
        { 
        id: 'contrasenas_temporales', 
        nombre: 'Contraseñas Temporales', 
        icono: TbPasswordUser,
        titulo: 'Contraseñas Temporales',
        subtitulo: 'Gestiona las contraseñas temporales de los usuarios',
        ruta: 'administrador/contrasenas_temporales'
      },
      {
        id: 'gestionar_usuarios',
        nombre: 'Gestionar Usuarios',
        icono: FiUsers,
        titulo: 'Gestionar Usuarios',
        subtitulo: 'Buscar, ver detalle y gestionar usuarios',
        ruta: 'administrador/gestionar_usuarios'
      },
      {
        id: 'roles_permisos',
        nombre: 'Roles y Permisos',
        icono: FiKey,
        titulo: 'Gestión de Roles y Permisos',
        subtitulo: 'Crear roles, asignar permisos y gestionar usuarios pendientes',
        ruta: 'administrador/roles_permisos'
      },
      {
        id: 'administrador_notificaciones',
        nombre: 'Admin de Notificaciones',
        icono: FiBell,
        titulo: 'Administrador de Notificaciones',
        subtitulo: 'Gestiona las notificaciones del sistema',
        ruta: 'administrador/administrador_notificaciones'
      },
    ],
  },
  {
    id: 'ajustes',
    nombre: 'Ajustes',
    icono: FiSettings,
    titulo: 'Configuración General',
    subtitulo: 'Ajustes y preferencias del sistema',
    submenu: [
      { 
        id: 'perfil', 
        nombre: 'Mi Perfil', 
        icono: FaRegSmile,
        titulo: 'Mi Perfil',
        subtitulo: 'Gestiona tu información personal y preferencias',
        ruta: 'ajustes/perfil'
      },
      { 
        id: 'cambio_contrasena', 
        nombre: 'Cambio de Contraseña', 
        icono: FiLock,
        titulo: 'Cambio de Contraseña',
        subtitulo: 'Actualiza tu contraseña de acceso',
        ruta: 'ajustes/cambio_contrasena'
      },
    ],
  },
];

// Función para obtener el título y subtítulo según el menuActivo
export const obtenerTituloPorMenu = (menuActivo) => {
  // Buscar en items principales
  const itemPrincipal = ItemsSidebar.find(item => item.id === menuActivo);
  if (itemPrincipal) {
    return {
      titulo: itemPrincipal.titulo,
      subtitulo: itemPrincipal.subtitulo
    };
  }
  
  // Buscar en items inferiores
  const itemInferior = ItemsSidebarInferior.find(item => item.id === menuActivo);
  if (itemInferior) {
    return {
      titulo: itemInferior.titulo,
      subtitulo: itemInferior.subtitulo
    };
  }
  
  // Buscar en submenús
  for (const item of [...ItemsSidebar, ...ItemsSidebarInferior]) {
    if (item.submenu) {
      const subitem = item.submenu.find(sub => sub.id === menuActivo);
      if (subitem) {
        return {
          titulo: subitem.titulo,
          subtitulo: subitem.subtitulo
        };
      }
    }
  }
  
  // Default si no se encuentra
  return {
    titulo: 'Inicio',
    subtitulo: 'Bienvenido al panel de administración'
  };
};

// Obtiene el ID de menú correspondiente a un pathname
export const obtenerIdPorRuta = (pathname = '/') => {
  console.log(`🗺️ OBTENERIDRUTA DEBUG - Entrada: '${pathname}'`);
  
  try {
    // Normalizar y recortar prefijo /app
    let path = String(pathname || '/').trim();
    console.log(`🗺️ OBTENERIDRUTA DEBUG - Después de trim: '${path}'`);
    
    // Quitar query/hash
    path = path.split('?')[0].split('#')[0];
    console.log(`🗺️ OBTENERIDRUTA DEBUG - Después de quitar query/hash: '${path}'`);
    
    // Quitar prefijo /app
    if (path.startsWith('/app')) {
      path = path.slice(4); // elimina '/app'
      console.log(`🗺️ OBTENERIDRUTA DEBUG - Después de quitar /app: '${path}'`);
    }
    // Quitar slashes extremos
    path = path.replace(/^\/+|\/+$/g, '');
    // Normalizar a minúsculas para coincidencias de ruta robustas
    path = path.toLowerCase();
    console.log(`🗺️ OBTENERIDRUTA DEBUG - Después de quitar slashes: '${path}'`);

    // Index route "" corresponde a 'inicio'
    if (!path) {
      console.log(`🗺️ OBTENERIDRUTA DEBUG - Retornando 'inicio' (path vacío)`);
      return 'inicio';
    }

    // Buscar coincidencia por ruta en principales
    const principal = ItemsSidebar.find(item => item.ruta === path);
    console.log(`🗺️ OBTENERIDRUTA DEBUG - Buscando en principales, ruta: '${path}'`);
    console.log(`🗺️ OBTENERIDRUTA DEBUG - ItemsSidebar rutas:`, ItemsSidebar.map(item => ({ id: item.id, ruta: item.ruta })));
    
    if (principal) {
      console.log(`🗺️ OBTENERIDRUTA DEBUG - Encontrado en principales: '${principal.id}'`);
      return principal.id;
    }

    // Buscar coincidencia en submenús de principales
    console.log(`🗺️ OBTENERIDRUTA DEBUG - Buscando en submenús de principales`);
    for (const item of ItemsSidebar) {
      if (item.submenu) {
        console.log(`🗺️ OBTENERIDRUTA DEBUG - Verificando submenú de '${item.id}'`);
        const subPrincipal = item.submenu.find(s => s.ruta === path);
        if (subPrincipal) {
          console.log(`🗺️ OBTENERIDRUTA DEBUG - Encontrado en submenú: '${subPrincipal.id}'`);
          return subPrincipal.id;
        }
      }
    }

    // Buscar coincidencia en inferiores y submenús
    console.log(`🗺️ OBTENERIDRUTA DEBUG - Buscando en ItemsSidebarInferior`);
    for (const item of ItemsSidebarInferior) {
      console.log(`🗺️ OBTENERIDRUTA DEBUG - Verificando item inferior: '${item.id}', ruta: '${item.ruta}'`);
      if (item.ruta === path) {
        console.log(`🗺️ OBTENERIDRUTA DEBUG - Encontrado en inferiores: '${item.id}'`);
        return item.id;
      }
      if (item.submenu) {
        console.log(`🗺️ OBTENERIDRUTA DEBUG - Verificando submenú de item inferior '${item.id}'`);
        const sub = item.submenu.find(s => s.ruta === path);
        if (sub) {
          console.log(`🗺️ OBTENERIDRUTA DEBUG - Encontrado en submenú de inferior: '${sub.id}'`);
          return sub.id;
        }
      }
    }
  } catch (e) {
    console.log(`🗺️ OBTENERIDRUTA DEBUG - ERROR:`, e);
  }
  console.log(`🗺️ OBTENERIDRUTA DEBUG - No se encontró coincidencia, retornando 'inicio'`);
  return 'inicio';
};

// Construcción de secciones disponibles a partir de ItemsSidebar y ItemsSidebarInferior
const categoriaPorId = (id, parentId) => {
  if (id === 'rol_pendiente') return 'Estados';
  if (id === 'administrar_pantalla_inicial' || parentId === 'administrar_pantalla_inicial') return 'Admin Pantalla Inicial';
  if (id === 'administrador' || parentId === 'administrador') return 'Administración';
  return 'Principal';
};

const procesarItemsSecciones = (items) => {
  const res = [];
  for (const item of items || []) {
    if (item && Array.isArray(item.submenu)) {
      res.push({ id: item.id, nombre: item.nombre, categoria: categoriaPorId(item.id), es_menu_padre: true });
      for (const sub of item.submenu) {
        res.push({ id: sub.id, nombre: sub.nombre, categoria: categoriaPorId(sub.id, item.id), menu_padre: item.id });
      }
    } else if (item) {
      res.push({ id: item.id, nombre: item.nombre, categoria: categoriaPorId(item.id) });
    }
  }
  return res;
};

export const secciones_disponibles = (() => {
  const lista = [
    ...procesarItemsSecciones(ItemsSidebar),
    ...procesarItemsSecciones(ItemsSidebarInferior),
  ];
  const vistos = new Set();
  const unicos = [];
  for (const s of lista) {
    if (s && !vistos.has(s.id)) {
      vistos.add(s.id);
      unicos.push(s);
    }
  }
  return unicos;
})();

export const obtener_ruta_por_id = (id) => {
  if (!id) return '/app';
  if (id === 'inicio') return '/app';
  const principal = (ItemsSidebar || []).find(i => (i && (i.id === id || (typeof i.ruta === 'string' && i.ruta.endsWith(id)))));
  if (principal && typeof principal.ruta === 'string' && principal.ruta) return `/${principal.ruta}`;
  for (const item of (ItemsSidebar || [])) {
    if (item.submenu) {
      const sub = item.submenu.find(s => s && (s.id === id || (typeof s.ruta === 'string' && s.ruta.endsWith(id))));
      if (sub && typeof sub.ruta === 'string' && sub.ruta) return `/${sub.ruta}`;
    }
  }
  for (const item of (ItemsSidebarInferior || [])) {
    if ((item && (item.id === id || (typeof item.ruta === 'string' && item.ruta.endsWith(id)))) && typeof item.ruta === 'string' && item.ruta) return `/${item.ruta}`;
    if (item.submenu) {
      const sub = item.submenu.find(s => s && (s.id === id || (typeof s.ruta === 'string' && s.ruta.endsWith(id))));
      if (sub && typeof sub.ruta === 'string' && sub.ruta) return `/${sub.ruta}`;
    }
  }
  return '/app';
};

const normalizar_pathname = (pathname = '/') => {
  let path = String(pathname || '/').trim();
  path = path.split('?')[0].split('#')[0];
  if (path === '/app') return '/app';
  if (path.startsWith('/app')) {
    path = path.slice(4);
  }
  return path.replace(/^\/+|\/+$/g, '');
};

export const es_ruta_conocida = (pathname = '/') => {
  const norm = normalizar_pathname(pathname);
  if (pathname === '/app' || norm === '') return true;
  if ((ItemsSidebar || []).some(item => item.ruta === norm)) return true;
  for (const item of (ItemsSidebar || [])) {
    if (item.submenu && item.submenu.some(sub => sub.ruta === norm)) return true;
  }
  for (const item of (ItemsSidebarInferior || [])) {
    if (item.ruta === norm) return true;
    if (item.submenu && item.submenu.some(sub => sub.ruta === norm)) return true;
  }
  return false;
};

export const obtener_permisos_criticos_base = (rol_actual_usuario) => {
  const criticos = new Set();
  criticos.add('inicio');
  if (rol_actual_usuario === 'admin' || rol_actual_usuario === 'administrador') {
    criticos.add('roles_permisos');
  }
  return criticos;
};

export const obtener_permisos_criticos_rol = (rol, rol_actual_usuario) => {
  const base = obtener_permisos_criticos_base(rol_actual_usuario);
  if (rol === 'pendiente') base.add('rol_pendiente');
  return base;
};

export const obtener_primera_ruta_permitida_desde_permisos = (permisos) => {
  if (!(permisos instanceof Set)) return '/app';
  if (permisos.has('inicio')) return '/app';
  for (const item of (ItemsSidebar || [])) {
    if (permisos.has(item.id) && typeof item.ruta !== 'undefined' && item.ruta) {
      return `/${item.ruta}`;
    }
    if (item.submenu) {
      for (const sub of item.submenu) {
        if (permisos.has(sub.id) && typeof sub.ruta !== 'undefined' && sub.ruta) {
          return `/${sub.ruta}`;
        }
      }
    }
  }
  for (const item of (ItemsSidebarInferior || [])) {
    if (item.submenu) {
      for (const sub of item.submenu) {
        if (permisos.has(sub.id) && typeof sub.ruta !== 'undefined' && sub.ruta) {
          return `/${sub.ruta}`;
        }
      }
    }
    if (permisos.has(item.id) && typeof item.ruta !== 'undefined' && item.ruta) {
      return `/${item.ruta}`;
    }
  }
  return '/app';
};

const itemsExport = { ItemsSidebar, ItemsSidebarInferior, obtenerTituloPorMenu, obtenerIdPorRuta };
export default itemsExport;
