import { useState, useEffect, useMemo, useCallback } from 'react';

// Icono para la flecha izquierda del carrusel
const IconChevronLeft = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

// Icono para la flecha derecha del carrusel
const IconChevronRight = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

// Icono de archivo/documento para reemplazar FaFilePdf
const IconFilePdf = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
    </svg>
);
// ------------------------------------------------------------------------

/**
 * Componente de la sección Inicio de la landing page
 * Muestra información principal del sistema SIGECOF
 */
const Inicio = () => {
  const API_BASE = process.env.REACT_APP_API_URL;
  const API_URL = (() => {
    try {
      const proto = typeof window !== 'undefined' ? (window.location?.protocol || 'http:') : 'http:';
      const host = typeof window !== 'undefined' ? (window.location?.hostname || 'localhost') : 'localhost';
      const dinamica = `${proto}//${host}:5000/api`;
      if (API_BASE && /^https?:\/\//.test(API_BASE)) {
        const api = new URL(API_BASE);
        const mismoHost = api.hostname === host;
        return mismoHost ? API_BASE : dinamica;
      }
      return dinamica;
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
  // Configuración de URLs de prueba y color base para banners (se mantiene el camelCase en URLs)
  // RUTA CORREGIDA: Se utiliza una ruta relativa que asume que 'images/' está accesible desde la raíz pública.
  const URL_LOGO_FONDOS = "images/logo_fpsbn_negro.png"; 
  
  // Estado para el carrusel
  const [diapositiva_actual, setDiapositivaActual] = useState(0);
  
  // Banners administrables: se cargan desde backend
  const [banners, setBanners] = useState([]);
  const [mensaje_error, setMensajeError] = useState('');
  
  // Cargar banners desde la API pública; sin fallback local
  useEffect(() => {
    const cargar = async () => {
      try {
        const resp = await fetch(`${API_URL}/carrusel/publico/banners`);
        const data = await resp.json();
        if (resp.ok && data?.exito && Array.isArray(data.banners)) {
          setBanners(data.banners);
          setMensajeError('');
          return;
        }
        setBanners([]);
        setMensajeError('No se pudo cargar los banners desde el servidor. Es posible que la conexión con la base de datos no esté disponible.');
      } catch (e) {
        setMensajeError('No se pudo conectar con el servidor. Es posible que la conexión con la base de datos no esté disponible.');
        setBanners([]);
      }
    };
    cargar();
  }, [API_URL]);

  const banners_visibles = useMemo(() => {
    const ahora = new Date();
    const visibles = (Array.isArray(banners) ? banners : [])
      .filter((b) => {
        if (!b.activo) return false;
        if (b.mostrar_indefinido) return true;
        const fi = b.fecha_inicio ? new Date(b.fecha_inicio) : null;
        const ff = b.fecha_fin ? new Date(b.fecha_fin) : null;
        const dentro = (!fi || ahora >= fi) && (!ff || ahora <= ff);
        return dentro;
      })
      .sort((a, b) => Number(a.prioridad || 0) - Number(b.prioridad || 0));
    return visibles.map((b, idx) => ({
      id: b.id_banner || idx + 1,
      titulo: b.titulo,
      descripcion: b.descripcion,
      url_imagen: a_url_absoluta(b.url_imagen),
      url_pdf: b.url_pdf ? a_url_absoluta(b.url_pdf) : '',
    }));
  }, [banners]);

  // Constante para la cantidad de diapositivas
  const cantidad_banners = banners_visibles.length;
  
  // Funciones del carrusel con desplazamiento infinito
  const siguienteDiapositiva = useCallback(() => {
    setDiapositivaActual((anterior) => (anterior + 1) % cantidad_banners);
  }, [cantidad_banners]);
  
  const diapositivaAnterior = () => {
    setDiapositivaActual((anterior) => (anterior - 1 + cantidad_banners) % cantidad_banners);
  };
  
  const irADiapositiva = (indice) => {
    setDiapositivaActual(indice);
  };
  
  const manejarClicBanner = (url_pdf) => {
    // Solo abrir PDF si existe una URL válida
    if (url_pdf && url_pdf.trim() !== '') {
      window.open(url_pdf, '_blank');
    }
  };
  
  // Auto-play del carrusel (solo si hay más de 1 banner)
  useEffect(() => {
    if (cantidad_banners > 1) {
      const intervalo = setInterval(() => {
        siguienteDiapositiva();
      }, 5000);
      return () => clearInterval(intervalo);
    }
  }, [diapositiva_actual, cantidad_banners, siguienteDiapositiva]);

  return (
    <div className="font-sans bg-gray-50 min-h-screen">
      {/* Sección Logo y Encabezado Principal */}
      <section className="py-8 bg-white shadow-sm">
        <div className="flex flex-col items-center ">
          <img 
            src={URL_LOGO_FONDOS}
            alt="Logo FPSB" 
            className="h-40 w-auto object-contain transition-transform duration-300 ease-in-out hover:scale-[1.02] rounded-lg"
            // Fallback en caso de que la ruta relativa no cargue
            onError={(e) => { e.target.src = "https://placehold.co/300x100/1e3a8a/ffffff?text=Logo+no+cargado+(Ruta+verificada)"; }}
          />
        </div>
      </section>

      {/* Sección Carrusel */}
      <section className="relative bg-white">
          {mensaje_error && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[1244px] max-w-full px-4">
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg shadow-sm text-sm">
                {mensaje_error}
              </div>
            </div>
          )}
          <div className="flex justify-center items-center">
            {/* Contenedor principal centrado con tamaño fijo */}
            <div className="relative w-[1244px] h-[700px] overflow-hidden rounded-3xl shadow-2xl shadow-gray-700 bg-white antialiased mx-auto">
              
              {/* Contenedor de Diapositivas */}
              <div 
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${diapositiva_actual * 100}%)` }}
              >
                {banners_visibles.map((banner, indice) => (
                  <div key={indice} className="relative overflow-hidden flex items-center justify-center flex-shrink-0 basis-full">
                    {/* Contenedor de imagen con dimensiones fijas 16:9 */}
                    <div 
                      className=" relative cursor-pointer flex items-center justify-center w-full h-full"
                      onClick={() => manejarClicBanner(banner.url_pdf)}
                    >
                      <img 
                        src={banner.url_imagen}
                        alt={banner.titulo || 'Banner'}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                      {/* Degradado y Contenido */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent flex items-end">
                        <div className="text-white p-6 sm:p-10 max-w-4xl">
                          <h3 className="text-3xl sm:text-4xl font-extrabold mb-2 transition-all duration-300">
                            {banner.titulo}
                          </h3>
                          <p className="text-base sm:text-lg text-gray-200 mb-6 font-light">
                            {banner.descripcion}
                          </p>
                          {banner.url_pdf && banner.url_pdf.trim() !== '' ? (
                            <button 
                              className="inline-flex items-center bg-indigo-500 hover:bg-indigo-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ease-in-out shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                              onClick={(e) => { e.stopPropagation(); manejarClicBanner(banner.url_pdf); }}
                            >
                              <IconFilePdf className="mr-2 h-4 w-4" />
                              Ver Documento Completo
                            </button>
                          ) : (
                            <span className="inline-block bg-gray-500 text-white px-5 py-2.5 rounded-full text-sm font-medium opacity-90">
                              Solo información
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Mensaje si no hay banners */}
              {cantidad_banners === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <span className="px-4 py-2 rounded-full bg-gray-800/80 text-white text-sm">Sin banners configurados</span>
                </div>
              )}

              {/* Controles del carrusel */}
              {cantidad_banners > 1 && (
              <button 
                className="absolute top-1/2 left-4 -translate-y-1/2 bg-white/30 backdrop-blur-sm w-12 h-12 rounded-full cursor-pointer flex items-center justify-center transition-all duration-300 ease-in-out z-10 hover:bg-white/70 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-md"
                onClick={diapositivaAnterior}
                aria-label="Diapositiva Anterior"
              >
                <IconChevronLeft className="w-5 h-5 text-white drop-shadow-sm" />
              </button>
              )}
              {cantidad_banners > 1 && (
              <button 
                className="absolute top-1/2 right-4 -translate-y-1/2 bg-white/30 backdrop-blur-sm w-12 h-12 rounded-full cursor-pointer flex items-center justify-center transition-all duration-300 ease-in-out z-10 hover:bg-white/70 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-md"
                onClick={siguienteDiapositiva}
                aria-label="Siguiente Diapositiva"
              >
                <IconChevronRight className="w-5 h-5 text-white drop-shadow-sm" />
              </button>
              )}
              
              {/* Indicadores */}
              {cantidad_banners > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                  {banners_visibles.map((_, indice) => (
                    <button
                      key={indice}
                      className={`w-3 h-3 rounded-full border-2 border-white cursor-pointer transition-all duration-300 ease-in-out ${
                        indice === diapositiva_actual 
                          ? 'bg-indigo-500 scale-125' 
                          : 'bg-white/50 hover:bg-white'
                      }`}
                      onClick={() => irADiapositiva(indice)}
                      aria-label={`Ir a diapositiva ${indice + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
      </section>

      {/* Sección Características */}
      <section className="py-20 bg-white">
        <div className="text-center mb-16 max-w-7xl mx-auto px-8">
          <span className="text-sm font-semibold text-indigo-600 uppercase tracking-widest block mb-2">
            NUESTROS PILARES
          </span>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-4">
            Objetivos del Fondo de Pensiones
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Garantizamos la seguridad y el bienestar de nuestros beneficiarios a través de servicios de salud, protección financiera y previsión.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto px-8">
          
          {/* Tarjeta 1 */}
          <div className="bg-white p-10 rounded-2xl shadow-xl border-t-4 border-blue-600 transition-all duration-300 ease-in-out relative overflow-hidden hover:shadow-2xl group hover:scale-[1.02]">
            <div className="text-5xl mb-6 text-indigo-600">💰</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Salvaguardar el pago de pensiones y jubilaciones
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Asegurar que los trabajadores de Banrural reciban sus pagos de jubilación y pensión puntualmente y con total transparencia.
            </p>
          </div>
          
          {/* Tarjeta 2 */}
          <div className="bg-white p-10 rounded-2xl shadow-xl border-t-4 border-blue-600 transition-all duration-300 ease-in-out relative overflow-hidden hover:shadow-2xl group hover:scale-[1.02]">
            <div className="text-5xl mb-6 text-indigo-600">🏥</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Proporcionar atención médica
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Cubrir los gastos médicos, quirúrgicos, farmacéuticos y hospitalarios de los beneficiarios, asegurando una cobertura integral.
            </p>
          </div>
          
          {/* Tarjeta 3 */}
          <div className="bg-white p-10 rounded-2xl shadow-xl border-t-4 border-blue-600 transition-all duration-300 ease-in-out relative overflow-hidden hover:shadow-2xl group hover:scale-[1.02]">
            <div className="text-5xl mb-6 text-indigo-600">❤️‍🩹</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Ofrecer beneficios por fallecimiento
            </h3>
            <p className="text-gray-600 leading-relaxed">
              Cubrir los beneficios por fallecimiento del jubilado o pensionado, brindando tranquilidad financiera a sus familiares.
            </p>
          </div>
        </div>
      </section>

      {/* Sección Estadísticas */}
      <section className="py-16 bg-slate-300 text-white">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-7xl mx-auto px-8">
          
          <div className="text-center p-4 border-r border-gray-700">
            <div className="text-5xl sm:text-6xl font-black text-blue-600 mb-2 transition-transform duration-300 hover:scale-105">5 Mil +</div>
            <div className="text-lg text-slate-600 font-medium">Jubilados Activos</div>
          </div>

          <div className="text-center p-4 border-r border-gray-700">
            <div className="text-5xl sm:text-6xl font-black text-blue-600 mb-2 transition-transform duration-300 hover:scale-105">10M+</div>
            <div className="text-lg text-slate-600 font-medium">Fondos Administrados</div>
          </div>

          <div className="text-center p-4 border-r border-gray-700">
            <div className="text-5xl sm:text-6xl font-black text-blue-600 mb-2 transition-transform duration-300 hover:scale-105">6K+</div>
            <div className="text-lg text-slate-600 font-medium">Transacciones Diarias</div>
          </div>
          
        </div>
      </section>
    </div>
  );
};

export default Inicio;
