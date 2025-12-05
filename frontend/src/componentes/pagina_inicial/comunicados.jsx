import { useState, useEffect } from 'react';
import { FaFilePdf, FaFileExcel, FaPaperclip, FaFilter, FaCalendarAlt, FaUser, FaTimes, FaExclamationTriangle } from 'react-icons/fa';

/**
 * Componente de la sección Comunicados
 * Muestra comunicados oficiales y noticias importantes
 */
const Comunicados = () => {
  // Estado para controlar el comunicado seleccionado
  const [comunicado_seleccionado, setComunicadoSeleccionado] = useState(null);
  // Estado para filtrar por categoría
  const [categoria_filtro, setCategoriaFiltro] = useState('todos');
  // Estado para comunicados dinámicos
  const [comunicados, setComunicados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
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
  const ORIGEN_BACKEND = (() => {
    try { const u = new URL(API_URL); return `${u.protocol}//${u.hostname}${u.port ? ':' + u.port : ''}`; } catch (_) { return API_URL.replace(/\/api$/, ''); }
  })();
  const a_url_absoluta = (ruta) => {
    try { const r = String(ruta || '').trim(); if (!r) return ''; if (/^https?:\/\//.test(r)) return r; return `${ORIGEN_BACKEND}${r.startsWith('/') ? '' : '/'}${r}`; } catch (_) { return String(ruta || ''); }
  };
  const tipo_adjunto = (url) => {
    const u = String(url || '').toLowerCase();
    if (!u) return 'otro';
    if (u.endsWith('.pdf')) return 'pdf';
    if (u.endsWith('.xlsx') || u.endsWith('.xls')) return 'excel';
    return 'otro';
  };

  const formatear_fecha_amigable = (valor) => {
    if (!valor) return '';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return String(valor);
    return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Cargar comunicados públicos desde la API (sin autenticación), con fallback a caché local
  useEffect(() => {
    const cargarComunicadosPublicos = async () => {
      try {
        setCargando(true);
        setError(null);
        const respuesta = await fetch(`${API_URL}/comunicados/publico/publicaciones`);
        const datos = await respuesta.json().catch(() => ({}));
        if (respuesta.ok && datos?.exito && Array.isArray(datos.comunicados)) {
          const normalizados = datos.comunicados.map((c, idx) => ({
            id: c.id ?? c.id_comunicado ?? (idx + 1),
            titulo: c.titulo ?? '',
            fecha: c.fecha ?? '',
            categoria: c.categoria ?? 'sistema',
            prioridad: c.prioridad ?? 'baja',
            resumen: c.resumen ?? '',
            contenido: c.contenido ?? '',
            autor: c.autor ?? '',
            adjunto_url: c.adjunto_url ? a_url_absoluta(c.adjunto_url) : (c.archivo_url ? a_url_absoluta(c.archivo_url) : ''),
            adjunto_nombre: c.adjunto_nombre ?? c.archivo_nombre ?? ''
          }));
          setComunicados(normalizados);
          try { localStorage.setItem('comunicados_publicos', JSON.stringify(normalizados)); } catch (_) {}
          return;
        }
        const cache = localStorage.getItem('comunicados_publicos');
        const parseados = cache ? JSON.parse(cache) : [];
        setComunicados(Array.isArray(parseados) ? parseados : []);
      } catch (err) {
        try {
          const cache = localStorage.getItem('comunicados_publicos');
          const parseados = cache ? JSON.parse(cache) : [];
          setComunicados(Array.isArray(parseados) ? parseados : []);
        } catch (_) {
          setComunicados([]);
        }
      } finally {
        setCargando(false);
      }
    };
    cargarComunicadosPublicos();
  }, []);

  // Categorías disponibles
  const categorias = [
    { id: 'todos', nombre: 'Todos', icono: '📋' },
    { id: 'sistema', nombre: 'Sistema', icono: '⚙️' },
    { id: 'mantenimiento', nombre: 'Mantenimiento', icono: '🔧' },
    { id: 'seguridad', nombre: 'Seguridad', icono: '🔒' },
    { id: 'capacitacion', nombre: 'Capacitación', icono: '🎓' }
  ];

  // Filtrar comunicados por categoría
  const comunicados_filtrados = categoria_filtro === 'todos' 
    ? comunicados 
    : comunicados.filter(c => c.categoria === categoria_filtro);

  /**
   * Función para obtener las clases según la prioridad
   */
  const obtenerClasesPrioridad = (prioridad) => {
    switch (prioridad) {
      case 'alta': return 'bg-red-500 text-white';
      case 'media': return 'bg-yellow-500 text-white';
      case 'baja': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  /**
   * Función para obtener el color del texto según la prioridad
   */
  const obtenerColorTextoPrioridad = (prioridad) => {
    switch (prioridad) {
      case 'alta': return 'text-red-500';
      case 'media': return 'text-yellow-500';
      case 'baja': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  // Mostrar estado de carga
  if (cargando) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-80vh">
        <div className="text-center py-16">
          <div className="text-6xl mb-6">📢</div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-4">
            Cargando comunicados...
          </h3>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  // Mostrar error
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-80vh">
        <div className="text-center py-16 bg-red-50 rounded-2xl border border-red-200">
          <div className="text-6xl mb-6">❌</div>
          <h3 className="text-2xl font-semibold text-red-900 mb-4">
            Error al cargar comunicados
          </h3>
          <p className="text-red-700 text-lg max-w-md mx-auto">
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-80vh">
      {/* Header de la sección */}
      <div className="text-center mb-12 py-8 bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl border border-gray-200">
        <h1 className="text-4xl font-bold text-gray-900 mb-4 flex items-center justify-center gap-2">
          📢 Comunicados Oficiales
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
          Mantente informado sobre las últimas noticias y actualizaciones del sistema
        </p>
      </div>

      {/* Filtros por categoría */}
      <div className="mb-12 p-8 bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="flex items-center gap-2 mb-6">
          <FaFilter className="text-gray-600" />
          <h3 className="text-xl font-semibold text-gray-900">Filtrar por categoría:</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {categorias.map(categoria => (
            <button
              key={categoria.id}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all duration-300 ease-in-out ${
                categoria_filtro === categoria.id 
                  ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/30' 
                  : 'bg-gray-50 text-gray-600 border-2 border-gray-200 hover:bg-gray-100 hover:border-gray-300 hover:-translate-y-1'
              }`}
              onClick={() => setCategoriaFiltro(categoria.id)}
            >
              <span className="text-lg">{categoria.icono}</span>
              <span>{categoria.nombre}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Lista de comunicados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
        {comunicados_filtrados.map(comunicado => (
          <div 
            key={comunicado.id} 
            className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden transition-all duration-300 ease-in-out hover:-translate-y-2 hover:shadow-2xl animate-fade-in-up"
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${obtenerClasesPrioridad(comunicado.prioridad)}`}>
                  {comunicado.prioridad}
                </span>
                <span className="text-gray-500 text-sm font-medium flex items-center gap-1">
                  <FaCalendarAlt className="text-xs" />
                  {formatear_fecha_amigable(comunicado.fecha)}
                </span>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900 leading-tight">
                  {comunicado.titulo}
                </h3>
                <p className="text-gray-600 leading-relaxed text-sm">
                  {comunicado.resumen}
                </p>
                
                <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <span className="text-gray-500 text-sm italic flex items-center gap-1">
                    <FaUser className="text-xs" />
                    Por: {comunicado.autor}
                  </span>
                  <div className="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center gap-2">
                    {comunicado.adjunto_url && (() => {
                      const t = tipo_adjunto(comunicado.adjunto_url);
                      const base = "w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300";
                      const cls = t === 'pdf'
                        ? `${base} border-2 border-red-500 text-red-500 bg-red-50 hover:bg-red-500 hover:text-white`
                        : t === 'excel'
                          ? `${base} border-2 border-green-500 text-green-500 bg-green-50 hover:bg-green-500 hover:text-white`
                          : `${base} border-2 border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100 hover:border-gray-300`;
                      const Icono = t === 'pdf' ? FaFilePdf : t === 'excel' ? FaFileExcel : FaPaperclip;
                      const texto = t === 'pdf' ? 'Descargar PDF' : t === 'excel' ? 'Descargar Excel' : 'Descargar Archivo';
                      return (
                        <a href={comunicado.adjunto_url} target="_blank" rel="noopener noreferrer" className={cls}>
                          <Icono className="text-sm" />
                          <span>{texto}</span>
                        </a>
                      );
                    })()}
                    <button 
                      className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-1"
                      onClick={() => setComunicadoSeleccionado(comunicado)}
                    >
                      Ver Completo
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal para mostrar comunicado completo */}
      {comunicado_seleccionado && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setComunicadoSeleccionado(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-4xl w-full max-h-90vh overflow-y-auto shadow-2xl animate-modal-slide-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start p-8 border-b border-gray-200">
              <h2 className="text-3xl font-bold text-gray-900 leading-tight pr-4">
                {comunicado_seleccionado.titulo}
              </h2>
              <button 
                className="bg-gray-100 border-none w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out text-gray-500 text-xl hover:bg-gray-200 hover:text-gray-700 flex-shrink-0"
                onClick={() => setComunicadoSeleccionado(null)}
              >
                <FaTimes />
              </button>
            </div>
            
            <div className="p-8 bg-gray-50 border-b border-gray-200">
              <div className="flex flex-wrap gap-8">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                    <FaCalendarAlt />
                    Fecha:
                  </span>
                  <span className="font-medium text-gray-900">{formatear_fecha_amigable(comunicado_seleccionado.fecha)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                    <FaUser />
                    Autor:
                  </span>
                  <span className="font-medium text-gray-900">{comunicado_seleccionado.autor}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                    <FaExclamationTriangle />
                    Prioridad:
                  </span>
                  <span className={`font-bold uppercase tracking-wide ${obtenerColorTextoPrioridad(comunicado_seleccionado.prioridad)}`}>
                    {comunicado_seleccionado.prioridad}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="p-8 prose prose-lg max-w-none">
              <div 
                dangerouslySetInnerHTML={{ __html: comunicado_seleccionado.contenido }}
              />
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button 
                className="bg-gradient-to-r from-gray-500 to-gray-700 text-white px-8 py-3 rounded-lg font-semibold transition-all duration-300 ease-in-out hover:shadow-lg hover:shadow-gray-500/30 hover:-translate-y-1"
                onClick={() => setComunicadoSeleccionado(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje cuando no hay comunicados */}
      {comunicados_filtrados.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl shadow-lg border border-gray-200">
          <div className="text-6xl mb-6">📭</div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-4">
            No hay comunicados en esta categoría
          </h3>
          <p className="text-gray-600 text-lg max-w-md mx-auto">
            Selecciona otra categoría o vuelve más tarde para ver nuevos comunicados.
          </p>
        </div>
      )}
    </div>
  );
};

export default Comunicados;
