// Sigecof (layout principal del aplicativo)
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ContenidoPorMenu from './utilidades/contenido_por_menu';
import { obtenerIdPorRuta } from './utilidades/items';
import { useInicioSesion } from './pagina_inicial/inicio_sesion/contexto/inicio_sesion-Context';
import { ProveedorPreferenciasUsuario, usePreferenciasUsuario } from './utilidades/preferencias_usuario.jsx';
import { obtener_rol_actual, puede_ver_seccion, obtener_primera_ruta_permitida, permisos_estan_listos } from './sigecof/administrador/roles_permisos';
import OverlayDeCarga from './utilidades/comunes/overlay_de_carga.jsx';
import Header from './sigecof/principales/header.jsx';
import Sidebar from './sigecof/principales/sidebar.jsx';
import Titulo from './sigecof/principales/titulo.jsx';
import Footer from './sigecof/principales/footer.jsx';

const LayoutSigecof = () => {
  const [sidebarColapsado, setSidebarColapsado] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { usuarioAutenticado, token, cargando } = useInicioSesion();
  const { tema } = usePreferenciasUsuario();
  
  // Debug para verificar rutas
  React.useEffect(() => {
    console.log('=== SIGECOF DEBUG ===');
    console.log('location.pathname:', location.pathname);
    console.log('location:', location);
  }, [location]);
  
  const menuActivo = obtenerIdPorRuta(location.pathname);

  const rolActual = obtener_rol_actual(usuarioAutenticado, token);

  const listoPermisos = permisos_estan_listos(rolActual);
  useEffect(() => {
    console.log('🚨 SIGECOF DEBUG - useEffect de permisos ejecutándose');
    console.log('🚨 SIGECOF DEBUG - menuActivo:', menuActivo);
    console.log('🚨 SIGECOF DEBUG - rolActual:', rolActual);
    console.log('🚨 SIGECOF DEBUG - location.pathname:', location.pathname);
    
    if (cargando) {
      return;
    }

    if (!listoPermisos) {
      return;
    }

    const puedeVerSeccion = puede_ver_seccion(menuActivo, rolActual);
    console.log('🚨 SIGECOF DEBUG - puede_ver_seccion resultado:', puedeVerSeccion);
    
    if (!puedeVerSeccion) {
      console.log('🚨 SIGECOF DEBUG - ¡SIN PERMISOS! Redirigiendo...');
      const destino = obtener_primera_ruta_permitida(rolActual);
      console.log('🚨 SIGECOF DEBUG - Destino de redirección:', destino);
      navigate(destino, { replace: true });
    } else {
      console.log('🚨 SIGECOF DEBUG - ✅ Tiene permisos para esta sección');
      
    }
  }, [menuActivo, rolActual, navigate, cargando, listoPermisos]);

  // 🔒 ESCUCHAR CAMBIOS GLOBALES DE PERMISOS Y REDIRIGIR SI ES NECESARIO
  useEffect(() => {
    const handlePermisosActualizadosGlobal = (event) => {
      const { rol_afectado, permisos_quitados, timestamp } = event.detail;
      
      // Si el rol afectado es el rol actual del usuario
      if (rol_afectado === rolActual) {
        console.log(`⚠️ Detectado cambio de permisos para tu rol (${rolActual}):`, permisos_quitados);
        
        // Verificar si la sección actual fue afectada
        if (permisos_quitados.some(permiso => permiso === menuActivo)) {
          console.log(`🚫 La sección actual (${menuActivo}) fue quitada de tus permisos. Redirigiendo...`);
          const destino = obtener_primera_ruta_permitida(rolActual);
          navigate(destino, { replace: true });
        }
      }
    };

    // Escuchar eventos globales de actualización de permisos
    window.addEventListener('permisos_actualizados_global', handlePermisosActualizadosGlobal);
    
    return () => {
      window.removeEventListener('permisos_actualizados_global', handlePermisosActualizadosGlobal);
    };
  }, [menuActivo, rolActual, navigate]);

  // El contenido específico ahora se obtiene desde utilidades/contenido_por_menu

  const puedeVer = listoPermisos ? puede_ver_seccion(menuActivo, rolActual) : false;

  const SkeletonPantalla = () => (
    <div className="p-6 animate-pulse">
      <div className="h-6 w-48 bg-gray-200 rounded mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="h-32 bg-gray-200 rounded" />
        <div className="h-32 bg-gray-200 rounded" />
        <div className="h-32 bg-gray-200 rounded" />
      </div>
      <div className="mt-6 h-64 bg-gray-200 rounded" />
    </div>
  );

  return (
    /* Contenedor principal: bloquea overscroll y gestos del touchpad para evitar saltos de estilo */
    <div className={`flex flex-col min-h-screen overscroll-none bloquear_gestos_tactiles ${tema === 'oscuro' ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <OverlayDeCarga visible={(() => { const ocultarFlag = typeof window !== 'undefined' && window.__ocultar_overlay_carga; return cargando && !ocultarFlag; })()} texto="Recargando…" />
      <Header />
      <div className="flex flex-1">
        <Sidebar 
          sidebarColapsado={sidebarColapsado}
          setSidebarColapsado={setSidebarColapsado}
          menuActivo={menuActivo}
        />

        {/* Contenedor de columna a la derecha del sidebar para colocar el título y el contenido */}
        <div className="flex flex-col flex-1">
          <Titulo 
            sidebarColapsado={sidebarColapsado}
            menuActivo={menuActivo}
          />

          {/* El main también contiene el overscroll para evitar propagación al body */}
          <main 
            className={`flex-1 transition-all duration-700 ease-in-out bg-white bloquear_overscroll ${
              sidebarColapsado ? 'ml-16' : 'ml-64'
            }`}
          >
            {(cargando || !listoPermisos || !puedeVer) ? (
              <SkeletonPantalla />
            ) : (
              ContenidoPorMenu(menuActivo)
            )}
          </main>
        </div>
      </div>
      <Footer sidebarColapsado={sidebarColapsado} />
    </div>
  );
};

const Sigecof = () => (
  <ProveedorPreferenciasUsuario>
    <LayoutSigecof />
  </ProveedorPreferenciasUsuario>
);

export default Sigecof;
