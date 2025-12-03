import { useState, useEffect } from 'react';


/**
 * Componente de la sección Boletines
 * Muestra boletines informativos y publicaciones periódicas
 */
const Boletines = () => {
  // Estado para controlar el boletín seleccionado
  const [boletin_seleccionado, setBoletinSeleccionado] = useState(null);
  // Estado para filtrar por año
  const [ano_filtro, setAnoFiltro] = useState('2025');
  // Estado para boletines dinámicos
  const [boletines, setBoletines] = useState([]);
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

  const formatear_fecha_amigable = (valor) => {
    if (!valor) return '';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return String(valor);
    return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  useEffect(() => {
    const cargarBoletinesPublicos = async () => {
      try {
        setCargando(true);
        setError(null);
        const respuesta = await fetch(`${API_URL}/boletines/publico/publicaciones`);
        const datos = await respuesta.json().catch(() => ({}));
        if (respuesta.ok && datos?.exito && Array.isArray(datos.boletines)) {
          const normalizados = datos.boletines.map((b, idx) => ({
            id: b.id ?? b.id_boletin ?? (idx + 1),
            ano: String(b.ano ?? (b.fecha ? new Date(b.fecha).getFullYear() : new Date().getFullYear())),
            tipo: normalizarTipo(b.tipo),
            destacado: Boolean(b.destacado),
            numero: b.numero ?? '',
            titulo: b.titulo ?? '',
            fecha: b.fecha ?? '',
            resumen: b.resumen ?? '',
          contenido: b.contenido ?? '',
            descargas: inferirDescargas(b)
          }));
          setBoletines(normalizados);
        } else {
          setBoletines([]);
        }
      } catch (err) {
        setBoletines([]);
      } finally {
        setCargando(false);
      }
    };
    cargarBoletinesPublicos();
  }, []);

  

  // Años disponibles
  const anos_disponibles = ['2025', '2024', '2023'];
  
  // Tipos de boletín
  const tipos_boletines = {
    mensual: { nombre: 'Mensual', icono: <FaCalendarAlt className="text-sm" />, clases: 'bg-blue-500 text-white' },
    trimestral: { nombre: 'Trimestral', icono: <FaChartBar className="text-sm" />, clases: 'bg-green-500 text-white' },
    especial: { nombre: 'Especial', icono: <FaStar className="text-sm" />, clases: 'bg-yellow-500 text-white' },
    tecnico: { nombre: 'Técnico', icono: <FaEdit className="text-sm" />, clases: 'bg-purple-500 text-white' }
  };
  const TIPO_DEFAULT = 'mensual';
  const normalizarTipo = (tipoRaw) => {
    const t = String(tipoRaw || TIPO_DEFAULT).toLowerCase().trim();
    return tipos_boletines[t] ? t : TIPO_DEFAULT;
  };
  const tipoInfo = (tipoRaw) => tipos_boletines[normalizarTipo(tipoRaw)];
  const obtenerClasesTipo = (tipoRaw) => tipoInfo(tipoRaw).clases;

  const inferirDescargas = (b) => {
    const url = b.archivo_url || b.url_archivo || '';
    const lower = String(url).toLowerCase();
    const pdfCand = lower.endsWith('.pdf') ? url : (b.descargas?.pdf ?? b.url_pdf ?? null);
    const excelExt = lower.endsWith('.xlsx') || lower.endsWith('.xls');
    const excelCand = excelExt ? url : (b.descargas?.excel ?? b.url_excel ?? null);
    const pdf = pdfCand ? a_url_absoluta(pdfCand) : null;
    const excel = excelCand ? a_url_absoluta(excelCand) : null;
    return { pdf, excel };
  };

  // Filtrar boletines por año
  const boletines_filtrados = boletines.filter(b => b.ano === ano_filtro);

  // Mostrar estado de carga
  if (cargando) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-80vh">
        <div className="text-center py-16">
          <div className="text-6xl mb-6">📰</div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-4">
            Cargando boletines...
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
            Error al cargar boletines
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
      <div className="text-center mb-12 py-8 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border border-blue-200">
        <h1 className="text-4xl font-bold text-gray-900 mb-4 flex items-center justify-center gap-2">
          📰 Boletines Informativos
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
          Mantente al día con nuestras publicaciones periódicas y reportes especiales
        </p>
      </div>

      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 mb-8 p-6 bg-white rounded-xl shadow-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <label className="font-semibold text-gray-700 text-sm">Filtrar por año:</label>
          <select 
            value={ano_filtro} 
            onChange={(e) => setAnoFiltro(e.target.value)}
            className="px-4 py-2 border-2 border-gray-200 rounded-lg bg-white text-gray-700 font-medium cursor-pointer transition-all duration-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 min-w-32"
          >
            {anos_disponibles.map(ano => (
              <option key={ano} value={ano}>{ano}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
        {boletines_filtrados.map(boletin => (
          <div 
            key={boletin.id} 
            className={`bg-white rounded-2xl shadow-lg border overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl animate-fade-in-up ${
              boletin.destacado 
                ? 'border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50' 
                : 'border-gray-200'
            }`}
          >
            {boletin.destacado && (
              <div className="absolute top-3 right-3 bg-gradient-to-r from-yellow-500 to-amber-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg shadow-yellow-500/30 z-10">
                <FaStar className="text-xs" />
                <span>Destacado</span>
              </div>
            )}
            
            <div className={`p-6`}>
              <div className={`flex justify-between items-start mb-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <span 
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold tracking-wide ${obtenerClasesTipo(boletin.tipo)}`}
                  >
                    {tipoInfo(boletin.tipo).icono}
                    {tipoInfo(boletin.tipo).nombre}
                  </span>
                </div>
                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-lg text-xs font-mono font-bold">
                  {boletin.numero}
                </span>
              </div>
              
              <div className={`space-y-3`}>
                <h3 className={`font-semibold text-gray-900 leading-tight text-lg`}>
                  {boletin.titulo}
                </h3>
                <p className="text-gray-500 text-sm flex items-center gap-1">
                  <FaCalendarAlt className="text-xs" />
                  {formatear_fecha_amigable(boletin.fecha)}
                </p>
                <p className={`text-gray-600 leading-relaxed text-sm`}>
                  {boletin.resumen}
                </p>
                
                <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button 
                    className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-lg font-medium text-sm transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-1 flex items-center justify-center gap-2"
                    onClick={() => setBoletinSeleccionado(boletin)}
                  >
                    <span>👁️</span>
                    Ver Completo
                  </button>
                  
                  {boletin.descargas && (
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      {boletin.descargas.pdf && (
                        <a 
                          href={boletin.descargas.pdf} 
                          className="w-full sm:w-auto flex items-center justify-center gap-1 px-4 py-2 border-2 border-red-500 text-red-500 bg-red-50 rounded-lg text-sm font-medium transition-all duration-300 hover:bg-red-500 hover:text-white"
                        >
                          <FaFilePdf className="text-sm" />
                          <span>Descargar PDF</span>
                        </a>
                      )}
                      {boletin.descargas.excel && (
                        <a 
                          href={boletin.descargas.excel} 
                          className="w-full sm:w-auto flex items-center justify-center gap-1 px-4 py-2 border-2 border-green-500 text-green-500 bg-green-50 rounded-lg text-sm font-medium transition-all duration-300 hover:bg-green-500 hover:text-white"
                        >
                          <FaFileExcel className="text-sm" />
                          <span>Descargar Excel</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal para mostrar boletín completo */}
      {boletin_seleccionado && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setBoletinSeleccionado(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-4xl w-full max-h-90vh overflow-y-auto shadow-2xl animate-modal-slide-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start p-8 border-b border-gray-200">
              <div className="flex-1 pr-4">
                <h2 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">
                  {boletin_seleccionado.titulo}
                </h2>
                <div className="flex flex-wrap gap-3 items-center">
                  <span 
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold tracking-wide ${obtenerClasesTipo(boletin_seleccionado.tipo)}`}
                  >
                    {tipoInfo(boletin_seleccionado.tipo).icono}
                    {tipoInfo(boletin_seleccionado.tipo).nombre}
                  </span>
                  <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-lg text-xs font-mono font-bold">
                    {boletin_seleccionado.numero}
                  </span>
                  <span className="text-gray-500 text-sm font-medium flex items-center gap-1">
                    <FaCalendarAlt className="text-xs" />
                    {formatear_fecha_amigable(boletin_seleccionado.fecha)}
                  </span>
                </div>
              </div>
              <button 
                className="bg-gray-100 border-none w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 text-gray-500 text-lg hover:bg-gray-200 hover:text-gray-700 flex-shrink-0"
                onClick={() => setBoletinSeleccionado(null)}
              >
                <FaTimes />
              </button>
            </div>
            
            <div className="p-8 prose prose-lg max-w-none">
              <div 
                dangerouslySetInnerHTML={{ __html: boletin_seleccionado.contenido }}
              />
            </div>
            
            <div className="p-6 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                {boletin_seleccionado.descargas && (
                  <>
                    <span className="font-semibold text-gray-700">Descargar:</span>
                    <div className="flex gap-2">
                      {boletin_seleccionado.descargas.pdf && (
                        <a 
                          href={boletin_seleccionado.descargas.pdf} 
                          className="flex items-center gap-2 px-4 py-2 border-2 border-red-500 text-red-500 bg-red-50 rounded-lg font-medium transition-all duration-300 hover:bg-red-500 hover:text-white"
                        >
                          <FaFilePdf />
                          <span>PDF</span>
                        </a>
                      )}
                      {boletin_seleccionado.descargas.excel && (
                        <a 
                          href={boletin_seleccionado.descargas.excel} 
                          className="flex items-center gap-2 px-4 py-2 border-2 border-green-500 text-green-500 bg-green-50 rounded-lg font-medium transition-all duration-300 hover:bg-green-500 hover:text-white"
                        >
                          <FaFileExcel />
                          <span>Excel</span>
                        </a>
                      )}
                    </div>
                  </>
                )}
              </div>
              <button 
                className="bg-gradient-to-r from-gray-500 to-gray-700 text-white px-8 py-3 rounded-lg font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-gray-500/30 hover:-translate-y-1"
                onClick={() => setBoletinSeleccionado(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje cuando no hay boletines */}
      {boletines_filtrados.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl shadow-lg border border-gray-200">
          <div className="text-6xl mb-6">📭</div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-4">
            No hay boletines disponibles para {ano_filtro}
          </h3>
          <p className="text-gray-600 text-lg max-w-md mx-auto">
            Selecciona otro año o vuelve más tarde para ver nuevas publicaciones.
          </p>
        </div>
      )}
    </div>
  );
};

export default Boletines;
