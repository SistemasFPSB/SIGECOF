import { useState } from 'react';
import Inicio from './pagina_inicial/inicio.jsx';
import Comunicados from './pagina_inicial/comunicados.jsx';
import Boletines from './pagina_inicial/boletines.jsx';
import Normatividad from './pagina_inicial/normatividad.jsx';
import AvisoPrivacidad from './pagina_inicial/aviso_privacidad.jsx';


// ====================================================================
// Componente Principal de la Aplicación (LandingPage)
// ====================================================================

const PaginaInicial = () => {
  // Estado para controlar qué sección está activa
  const [seccion_activa, establecer_seccion_activa] = useState('inicio');
  // Estado para controlar si el menú móvil está abierto
  const [menu_movil_abierto, establecer_menu_movil_abierto] = useState(false);

  

  // Constante para la configuración de las secciones del menú
  const secciones_menu = [
    { id: 'inicio', nombre: 'Inicio', icono: '🏠' },
    { id: 'comunicados', nombre: 'Comunicados', icono: '📢' },
    { id: 'boletines', nombre: 'Boletines', icono: '📰' },
    { id: 'normatividad', nombre: 'Normatividad', icono: '📋' },
    { id: 'aviso-privacidad', nombre: 'Aviso de Privacidad', icono: '🔒' }
  ];

  /**
   * Función para cambiar de sección
   */
  const cambiar_seccion = (seccion) => {
    establecer_seccion_activa(seccion);
    establecer_menu_movil_abierto(false); // Cerrar menú móvil al seleccionar
  };

  /**
   * Función para renderizar el contenido según la sección activa
   */
  const renderizar_contenido = () => {
    switch (seccion_activa) {
      case 'inicio':
        return <Inicio />;
      case 'comunicados':
        return <Comunicados />;
      case 'boletines':
        return <Boletines />;
      case 'normatividad':
        return <Normatividad />;
      case 'aviso-privacidad':
        return <AvisoPrivacidad />;
      default:
        return <Inicio />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br to-gray-200 font-sans overflow-x-hidden relative">
      {/* Header con navegación */}
      <header className="sticky top-0 z-10 bg-gray-900 shadow-xl">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-20 relative">
          
          {/* Logo y título */}
          <div className="flex items-center space-x-4 mr-6">
            <img 
              src="images/logo_sin_fondo_blanco.png" 
              alt="Logo FOPESIBAN" 
              className="h-12 w-12 rounded-full transition duration-300 hover:scale-105 filter brightness-110 shadow-lg"
            />
            <div className="hidden sm:block">
              <h1 className="text-xl sm:text-2xl font-bold m-0 text-white tracking-tight">FOPESIBAN</h1>            </div>
          </div>

          {/* Navegación desktop */}
          <nav className="hidden lg:flex items-center space-x-1">
            {secciones_menu.map((seccion) => (
              <button
                key={seccion.id}
                className={`
                  flex items-center space-x-2 px-3 py-2 rounded-xl text-sm font-medium transition duration-300 cursor-pointer relative overflow-hidden group
                  ${seccion_activa === seccion.id 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/50 hover:bg-blue-700' 
                    : 'text-gray-300 hover:text-white hover:bg-gray-700'
                  }
                `}
                onClick={() => cambiar_seccion(seccion.id)}
              >
                <span className="text-lg">{seccion.icono}</span>
                <span className="whitespace-nowrap">{seccion.nombre}</span>
                {/* Underline effect */}
                <div className={`absolute bottom-0 left-16 w-0 h-0.5 bg-blue-400 transition-all duration-300 transform -translate-x-1/2 ${seccion_activa === seccion.id ? 'w-60 bg-white' : 'group-hover:w-60'}`}></div>
              </button>
            ))}
          </nav>

          {/* Botón menú móvil */}
          <button 
            className="lg:hidden flex flex-col space-y-1 p-2 rounded-lg transition duration-200 hover:bg-gray-700"
            onClick={() => establecer_menu_movil_abierto(!menu_movil_abierto)}
            aria-expanded={menu_movil_abierto}
            aria-controls="mobile-menu"
          >
            <span className={`block w-6 h-0.5 bg-white rounded transition duration-300 ${menu_movil_abierto ? 'rotate-45 translate-y-1.5' : ''}`}></span>
            <span className={`block w-6 h-0.5 bg-white rounded transition duration-300 ${menu_movil_abierto ? 'opacity-0' : ''}`}></span>
            <span className={`block w-6 h-0.5 bg-white rounded transition duration-300 ${menu_movil_abierto ? '-rotate-45 -translate-y-1.5' : ''}`}></span>
          </button>
        </div>

        {/* Menú móvil */}
        <nav 
          id="mobile-menu"
          className={`lg:hidden flex flex-col bg-gray-900/95 backdrop-blur-md absolute top-20 left-0 w-full overflow-hidden transition-all duration-300 ease-in-out ${
            menu_movil_abierto ? 'max-h-screen border-t border-gray-700' : 'max-h-0'
          }`}
        >
          {secciones_menu.map((seccion) => (
            <button
              key={seccion.id}
              className={`
                flex items-center space-x-3 px-6 py-4 text-base font-medium transition duration-200 justify-start
                ${seccion_activa === seccion.id 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }
              `}
              onClick={() => cambiar_seccion(seccion.id)}
            >
              <span className="text-xl">{seccion.icono}</span>
              <span>{seccion.nombre}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 overflow-hidden relative">
        <div className="w-full mx-auto">
          <div className="animate-fadeIn">
            {renderizar_contenido()}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 mt-auto border-t-4 border-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          
          <div className="flex gap-4 items-center">
            <img 
              src="images/gob_blanco.png" 
              alt="Logo Gobierno" 
              className="h-28 w-fit transition duration-300 hover:scale-110" 
            />
          </div>
          
          <div className="text-center md:text-right">
            <p className="m-0 text-gray-400 text-base">&copy; 2025 SIGECOF - Sistema Integral de Gestión y Control Financiero</p>
            <p className="m-0 text-gray-500 text-sm mt-1">Todos los derechos reservados</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PaginaInicial;
