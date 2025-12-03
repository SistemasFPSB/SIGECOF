



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
