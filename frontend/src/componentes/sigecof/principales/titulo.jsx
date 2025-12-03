// sigecof/principales/titulo.jsx
import { obtenerTituloPorMenu } from '../../utilidades/items';
import { useControlNotificaciones } from '../administrador/administrador_notificaciones.jsx';
import { obtener_ruta_por_id } from '../administrador/roles_permisos';
import { useInicioSesion } from '../../pagina_inicial/inicio_sesion/contexto/inicio_sesion-Context';

const Titulo = ({ sidebarColapsado, menuActivo }) => {
  const { cargando } = useInicioSesion();
  const { titulo, subtitulo } = obtenerTituloPorMenu(menuActivo);

  const {
    cantidad_no_leidas_visibles,
    es_visible_popup,
    ocultar_popup,
    notificaciones_no_leidas_visibles,
  } = useControlNotificaciones();

  const resumen_no_leidas = notificaciones_no_leidas_visibles;

  if (cargando) {
    return (
      <div 
        className={`transition-all duration-700 ease-in-out ${
          sidebarColapsado ? 'ml-16' : 'ml-64'
        }`}
      >
        <div className="bg-white border-gray-200 px-6 py-4">
          <div className="max-w-screen-2xl mx-auto">
            <div className="h-6 w-56 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-96 bg-gray-200 rounded mt-2 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`transition-all duration-700 ease-in-out ${
        sidebarColapsado ? 'ml-16' : 'ml-64'
      }`}
    >
      <div className="bg-white border-gray-200 px-6 py-4">
        <div className="max-w-screen-2xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-800">{titulo}</h1>
          {subtitulo && (
            <p className="text-gray-600 mt-1">{subtitulo}</p>
          )}
        </div>
      </div>

      {/* Popup de notificaciones al iniciar sesión */}
      {es_visible_popup && cantidad_no_leidas_visibles > 0 && (
        <div className="fixed top-20 right-6 z-50 w-80 bg-white border border-gray-200 shadow-lg rounded-lg overflow-hidden">
          <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between">
            <span className="font-semibold">Tienes {cantidad_no_leidas_visibles} notificación(es)</span>
            <button className="text-white/90 hover:text-white" onClick={ocultar_popup} aria-label="Cerrar">
              ✕
            </button>
          </div>
          <div className="p-3 space-y-2">
            {resumen_no_leidas.map((n) => (
              <div key={n.id} className="border rounded p-2">
                <p className="text-sm font-medium text-gray-800">{n.titulo}</p>
                {n.mensaje && <p className="text-xs text-gray-700 mt-0.5">{n.mensaje}</p>}
                {n.ruta_sugerida && (
                  <a href={obtener_ruta_por_id(n.ruta_sugerida)} className="text-xs text-blue-600 hover:text-blue-800 underline">Ir a {n.ruta_sugerida.replace('_',' ')}</a>
                )}
              </div>
            ))}
          </div>
          <div className="px-3 pb-3">
            <a href="/notificaciones" className="block text-center text-sm px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Ver todas</a>
          </div>
        </div>
      )}
    </div>
  );
};

export default Titulo;
