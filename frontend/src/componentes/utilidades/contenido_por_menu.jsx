import React from 'react';
import Inicio from '../sigecof/inicio/inicio.jsx';
import ContrasenasTemporales from '../sigecof/administrador/contrasenas_temporales.jsx';
import RolesPermisos from '../sigecof/administrador/roles_permisos.jsx';
import GestionarUsuarios from '../sigecof/administrador/gestionar_usuarios.jsx';
import AdministradorNotificaciones from '../sigecof/administrador/administrador_notificaciones.jsx';
import Notificaciones from '../sigecof/notificaciones/notificaciones.jsx';
import Carrusel from '../sigecof/administracion_pagina_inicial/carrusel.jsx';
import Normatividad from '../sigecof/administracion_pagina_inicial/normatividad.jsx';
import Comunicados from '../sigecof/administracion_pagina_inicial/comunicados.jsx';
import Boletines from '../sigecof/administracion_pagina_inicial/boletines.jsx';
import RolPendiente from '../sigecof/inicio_rol_pendiente/inicio_rol_pendiente.jsx';
import CambioContrasena from '../sigecof/ajustes/cambio_contrasena.jsx';
import Perfil from '../sigecof/ajustes/perfil.jsx';
export const ContenidoPorMenu = (menuActivo) => {
  console.log('menuActivo recibido:', menuActivo);
  
  switch (menuActivo) {
    case 'inicio':
      return <Inicio />;
    // Secciones de administrador
    case 'contrasenas_temporales':
      return <ContrasenasTemporales />;
    case 'roles_permisos':
      return <RolesPermisos />;
    case 'gestionar_usuarios':
      return <GestionarUsuarios />;
    case 'administrador_notificaciones':
      return <AdministradorNotificaciones />;
    case 'notificaciones':
      return <Notificaciones />;
    case 'carrusel':
      return <Carrusel />;
    case 'normatividad':
      return <Normatividad />;
    case 'comunicados':
      return <Comunicados />;
    case 'boletines':
      return <Boletines />;


    // Secciones comunes
    case 'rol_pendiente':
      return <RolPendiente />;
    case 'cambio_contrasena':
      return <CambioContrasena />;
    case 'perfil':
      return <Perfil />;

    default:
      return null;
  }
};

export default ContenidoPorMenu;
