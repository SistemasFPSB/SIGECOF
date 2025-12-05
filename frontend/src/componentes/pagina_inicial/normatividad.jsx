import { useState, useEffect } from 'react';
import { FaList, FaGavel, FaFileAlt, FaChartBar, FaEdit, FaSearch, FaCheckCircle, FaCalendarAlt, FaGlobeAmericas, FaFilePdf, FaFileExcel, FaExternalLinkAlt, FaTimes } from 'react-icons/fa';


/**
 * Componente de la sección Normatividad
 * Muestra documentos normativos, leyes y regulaciones aplicables
 */
const Normatividad = () => {
  // Estado para controlar el documento seleccionado
  const [documento_seleccionado, setDocumentoSeleccionado] = useState(null);
  // Estado para filtrar por categoría
  const [categoria_filtro, setCategoriaFiltro] = useState('todas');
  // Estado para búsqueda
  const [termino_busqueda, setTerminoBusqueda] = useState('');
  // Estado para documentos dinámicos
  const [documentos, setDocumentos] = useState([]);
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
  const tipo_documento = (url) => {
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

  useEffect(() => {
    const cargarDocumentosPublicos = async () => {
      try {
        setCargando(true);
        setError(null);
        const respuesta = await fetch(`${API_URL}/normatividad/publico/documentos`);
        const datos = await respuesta.json().catch(() => ({}));
        if (respuesta.ok && datos?.exito && Array.isArray(datos.documentos)) {
          const normalizados = datos.documentos.map((d, idx) => ({
            id: d.id ?? d.id_documento ?? (idx + 1),
            titulo: d.titulo ?? '',
            categoria: d.categoria ?? 'ley',
            numero_oficial: d.numero_oficial ?? '',
            fecha_publicacion: d.fecha_publicacion ?? d.fecha ?? '',
            fecha_actualizacion: d.fecha_actualizacion ?? '',
            ambito: d.ambito ?? 'nacional',
            vigencia: d.vigencia ?? 'vigente',
            resumen: d.resumen ?? '',
            contenido: d.contenido ?? '',
            enlace_oficial: d.enlace_oficial ? a_url_absoluta(d.enlace_oficial) : (d.url ? a_url_absoluta(d.url) : ''),
            documento_url: d.documento_url ? a_url_absoluta(d.documento_url) : ''
          }));
          setDocumentos(normalizados);
          try { localStorage.setItem('normatividad_publica', JSON.stringify(normalizados)); } catch (_) {}
        } else {
          const cache = localStorage.getItem('normatividad_publica');
          const parseados = cache ? JSON.parse(cache) : [];
          setDocumentos(Array.isArray(parseados) ? parseados : []);
        }
      } catch (err) {
        try {
          const cache = localStorage.getItem('normatividad_publica');
          const parseados = cache ? JSON.parse(cache) : [];
          setDocumentos(Array.isArray(parseados) ? parseados : []);
        } catch (_) {
          setDocumentos([]);
        }
      } finally {
        setCargando(false);
      }
    };
    cargarDocumentosPublicos();
  }, []);

  // Categorías disponibles
  const categorias = [
    { id: 'todas', nombre: 'Todas', icono: <FaList /> },
    { id: 'ley', nombre: 'Leyes', icono: <FaGavel /> },
    { id: 'reglamento', nombre: 'Reglamentos', icono: <FaFileAlt /> },
    { id: 'norma', nombre: 'Normas', icono: <FaChartBar /> },
    { id: 'lineamiento', nombre: 'Lineamientos', icono: <FaEdit /> }
  ];

  // Filtrar documentos
  const documentos_filtrados = documentos.filter(doc => {
    const cumple_categoria = categoria_filtro === 'todas' || doc.categoria === categoria_filtro;
    const cumple_busqueda = termino_busqueda === '' || 
      doc.titulo.toLowerCase().includes(termino_busqueda.toLowerCase()) ||
      doc.resumen.toLowerCase().includes(termino_busqueda.toLowerCase());
    return cumple_categoria && cumple_busqueda;
  });

  /**
   * Función para obtener las clases según la categoría
   */
  const obtenerClasesCategoria = (categoria) => {
    switch (categoria) {
      case 'ley': return 'bg-red-500 text-white';
      case 'reglamento': return 'bg-blue-500 text-white';
      case 'norma': return 'bg-green-500 text-white';
      case 'lineamiento': return 'bg-purple-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  /**
   * Función para obtener el icono según la categoría
   */
  const obtenerIconoCategoria = (categoria) => {
    switch (categoria) {
      case 'ley': return <FaGavel className="text-sm" />;
      case 'reglamento': return <FaFileAlt className="text-sm" />;
      case 'norma': return <FaChartBar className="text-sm" />;
      case 'lineamiento': return <FaEdit className="text-sm" />;
      default: return <FaList className="text-sm" />;
    }
  };

  // Mostrar estado de carga
  if (cargando) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-80vh">
        <div className="text-center py-16">
          <div className="text-6xl mb-6">📋</div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-4">
            Cargando documentos normativos...
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
            Error al cargar documentos
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
      <div className="text-center mb-12 py-8 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border border-orange-200">
        <h1 className="text-4xl font-bold text-gray-900 mb-4 flex items-center justify-center gap-2">
          📋 Marco Normativo
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
          Consulta las leyes, reglamentos y normas que rigen el sistema de gestión financiera gubernamental
        </p>
      </div>

      {/* Controles de búsqueda y filtros */}
      <div className="space-y-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <div className="relative max-w-2xl mx-auto">
            <FaSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 text-lg" />
            <input
              type="text"
              placeholder="Buscar en documentos normativos..."
              value={termino_busqueda}
              onChange={(e) => setTerminoBusqueda(e.target.value)}
              className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-700 placeholder-gray-500 transition-all duration-300 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FaList className="text-gray-600" />
            Filtrar por tipo:
          </h3>
          <div className="flex flex-wrap gap-3">
            {categorias.map(categoria => (
              <button
                key={categoria.id}
                className={`flex items-center gap-2 px-5 py-3 rounded-full font-medium transition-all duration-300 ${
                  categoria_filtro === categoria.id 
                    ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/30' 
                    : 'bg-gray-50 text-gray-600 border-2 border-gray-200 hover:bg-gray-100 hover:border-gray-300 hover:-translate-y-1'
                }`}
                onClick={() => setCategoriaFiltro(categoria.id)}
              >
                {categoria.icono}
                <span>{categoria.nombre}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de documentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-12">
        {documentos_filtrados.map(documento => (
          <div 
            key={documento.id} 
            className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl animate-fade-in-up"
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold tracking-wide ${obtenerClasesCategoria(documento.categoria)}`}>
                    {obtenerIconoCategoria(documento.categoria)}
                    {documento.categoria.toUpperCase()}
                  </span>
                </div>
                <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${
                  documento.vigencia === 'vigente' 
                    ? 'bg-green-100 text-green-800 border border-green-200' 
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}>
                  {documento.vigencia === 'vigente' ? <FaCheckCircle className="text-xs" /> : '❌'}
                  {documento.vigencia === 'vigente' ? 'VIGENTE' : 'DEROGADO'}
                </span>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-4 leading-tight">
                {documento.titulo}
              </h3>
              
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-4">
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Número Oficial:</span>
                    <span className="text-sm font-mono font-semibold text-gray-700">{documento.numero_oficial}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      <FaCalendarAlt className="text-xs" />
                      Publicación:
                    </span>
                    <span className="text-sm font-medium text-gray-700">{formatear_fecha_amigable(documento.fecha_publicacion)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Actualización:</span>
                    <span className="text-sm font-medium text-gray-700">{formatear_fecha_amigable(documento.fecha_actualizacion)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
                      <FaGlobeAmericas className="text-xs" />
                      Ámbito:
                    </span>
                    <span className="text-sm font-medium text-gray-700 uppercase">{documento.ambito}</span>
                  </div>
                </div>
              </div>
              
              <p className="text-gray-600 leading-relaxed text-sm mb-6">
                {documento.resumen}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  className="w-full sm:flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-lg font-medium text-sm transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-1 flex items-center justify-center gap-2"
                  onClick={() => setDocumentoSeleccionado(documento)}
                >
                  <span>👁️</span>
                  Ver Completo
                </button>
                {documento.documento_url && (
                  <a 
                    href={documento.documento_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={(function(){ const t=tipo_documento(documento.documento_url); const base="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-300"; return t==='pdf'?`${base} border-2 border-red-500 text-red-500 bg-red-50 hover:bg-red-500 hover:text-white`: t==='excel'?`${base} border-2 border-green-500 text-green-500 bg-green-50 hover:bg-green-500 hover:text-white`:`${base} border-2 border-gray-200 text-gray-600 bg-gray-50 hover:bg-gray-100 hover:text-gray-800 hover:border-gray-300`; })()}
                  >
                    {(function(){ const t=tipo_documento(documento.documento_url); return t==='pdf'?<FaFilePdf className="text-xs" />: t==='excel'?<FaFileExcel className="text-xs" />:<FaFileAlt className="text-xs" />; })()}
                    {(function(){ const t=tipo_documento(documento.documento_url); return t==='pdf'?'Descargar PDF': t==='excel'?'Descargar Excel':'Descargar Archivo'; })()}
                  </a>
                )}
                {documento.enlace_oficial && (
                  <a 
                    href={documento.enlace_oficial}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:flex-1 bg-gray-50 text-gray-600 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-300 hover:bg-gray-100 hover:text-gray-800 border-2 border-gray-200 hover:border-gray-300 flex items-center justify-center gap-2"
                  >
                    <FaExternalLinkAlt className="text-xs" />
                    Ver Texto Oficial
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal para mostrar documento completo */}
      {documento_seleccionado && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setDocumentoSeleccionado(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-4xl w-full max-h-90vh overflow-y-auto shadow-2xl animate-modal-slide-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start p-8 border-b border-gray-200">
              <div className="flex-1 pr-4">
                <h2 className="text-3xl font-bold text-gray-900 mb-4 leading-tight">
                  {documento_seleccionado.titulo}
                </h2>
                <div className="flex flex-wrap gap-3 items-center">
                  <span className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-bold tracking-wide ${obtenerClasesCategoria(documento_seleccionado.categoria)}`}>
                    {obtenerIconoCategoria(documento_seleccionado.categoria)}
                    {documento_seleccionado.categoria.toUpperCase()}
                  </span>
                  <span className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-mono font-bold border border-gray-200">
                    {documento_seleccionado.numero_oficial}
                  </span>
                </div>
              </div>
              <button 
                className="bg-gray-100 border-none w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 text-gray-500 text-lg hover:bg-gray-200 hover:text-gray-700 flex-shrink-0"
                onClick={() => setDocumentoSeleccionado(null)}
              >
                <FaTimes />
              </button>
            </div>
            
            <div className="p-6 bg-gray-50 border-b border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Fecha de Publicación:</span>
                  <span className="text-sm font-medium text-gray-900">{formatear_fecha_amigable(documento_seleccionado.fecha_publicacion)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Última Actualización:</span>
                  <span className="text-sm font-medium text-gray-900">{formatear_fecha_amigable(documento_seleccionado.fecha_actualizacion)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Ámbito de Aplicación:</span>
                  <span className="text-sm font-medium text-gray-900 uppercase">{documento_seleccionado.ambito}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Estado:</span>
                  <span className={`text-sm font-bold ${
                    documento_seleccionado.vigencia === 'vigente' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {documento_seleccionado.vigencia === 'vigente' ? '✅ VIGENTE' : '❌ DEROGADO'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="p-8 prose prose-lg max-w-none">
              <div 
                dangerouslySetInnerHTML={{ __html: documento_seleccionado.contenido }}
              />
            </div>
            
            <div className="p-6 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                {documento_seleccionado.documento_url && (
                  <a 
                    href={documento_seleccionado.documento_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={(function(){ const t=tipo_documento(documento_seleccionado.documento_url); const base="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all duration-300"; return t==='pdf'?`${base} border-2 border-red-500 text-red-500 bg-red-50 hover:bg-red-500 hover:text-white`: t==='excel'?`${base} border-2 border-green-500 text-green-500 bg-green-50 hover:bg-green-500 hover:text-white`:`${base} border-2 border-gray-200 text-gray-700 bg-gray-50 hover:bg-gray-100 hover:border-gray-300`; })()}
                  >
                    {(function(){ const t=tipo_documento(documento_seleccionado.documento_url); return t==='pdf'?<FaFilePdf />: t==='excel'?<FaFileExcel />:<FaFileAlt />; })()}
                    {(function(){ const t=tipo_documento(documento_seleccionado.documento_url); return t==='pdf'?'Descargar PDF': t==='excel'?'Descargar Excel':'Descargar Archivo'; })()}
                  </a>
                )}
                {documento_seleccionado.enlace_oficial && (
                  <a 
                    href={documento_seleccionado.enlace_oficial}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-green-500/30 hover:-translate-y-1 flex items-center gap-2 justify-center"
                  >
                    <FaExternalLinkAlt />
                    Ver Texto Oficial
                  </a>
                )}
              </div>
              <button 
                className="bg-gradient-to-r from-gray-500 to-gray-700 text-white px-8 py-3 rounded-lg font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-gray-500/30 hover:-translate-y-1"
                onClick={() => setDocumentoSeleccionado(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje cuando no hay documentos */}
      {documentos_filtrados.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl shadow-lg border border-gray-200">
          <div className="text-6xl mb-6">📭</div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-4">
            No se encontraron documentos
          </h3>
          <p className="text-gray-600 text-lg max-w-md mx-auto">
            Intenta con otros términos de búsqueda o selecciona una categoría diferente.
          </p>
        </div>
      )}
    </div>
  );
};

export default Normatividad;
