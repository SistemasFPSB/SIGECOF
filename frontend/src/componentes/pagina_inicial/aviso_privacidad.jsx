import { useState } from 'react';


import { useInicioSesion as useSesion } from './inicio_sesion/contexto/inicio_sesion-Context';
import { FaCalendarAlt, FaCompress, FaExpand, FaBuilding, FaChevronDown, FaChevronRight, FaBullseye, FaClipboardList, FaBalanceScale, FaEye, FaEdit, FaTrash, FaBan, FaExchangeAlt, FaPhoneAlt } from 'react-icons/fa';

/**
 * Componente de la sección Aviso de Privacidad
 * Muestra información sobre el tratamiento de datos personales
 */
const AvisoPrivacidad = () => {
  // Estado para controlar las secciones expandidas
  const [secciones_expandidas, setSeccionesExpandidas] = useState({
    identidad: false,
    finalidades: false,
    datos: false,
    derechos: false,
    transferencias: false,
    contacto: false
  });
  // Estado para datos dinámicos del aviso de privacidad
  const [aviso_privacidad, setAvisoPrivacidad] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  // Obtener token de autenticación
  const { token } = useSesion();

  /**
   * Función para alternar la expansión de una sección
   */
  const alternarSeccion = (seccion) => {
    setSeccionesExpandidas(prev => ({
      ...prev,
      [seccion]: !prev[seccion]
    }));
  };

  /**
   * Función para expandir todas las secciones
   */
  const expandirTodas = () => {
    const todas_expandidas = Object.values(secciones_expandidas).every(Boolean);
    const nuevo_estado = !todas_expandidas;
    
    setSeccionesExpandidas({
      identidad: nuevo_estado,
      finalidades: nuevo_estado,
      datos: nuevo_estado,
      derechos: nuevo_estado,
      transferencias: nuevo_estado,
      contacto: nuevo_estado
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-80vh">
      {/* Header de la sección */}
      <div className="text-center mb-8 py-8 bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl border border-red-200">
        <h1 className="text-4xl font-bold text-gray-900 mb-4 flex items-center justify-center gap-2">
          🔒 Aviso de Privacidad
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed mb-6">
          Información sobre el tratamiento de sus datos personales en SIGECOF
        </p>
        <div className="flex items-center justify-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 max-w-fit mx-auto">
          <FaCalendarAlt className="text-gray-500 text-sm" />
          <span className="text-gray-700 font-medium">Última actualización: 30 de julio, 2025</span>
        </div>
      </div>

      {/* Controles */}
      <div className="flex justify-center mb-8">
        <button 
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-full font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-1"
          onClick={expandirTodas}
        >
          {Object.values(secciones_expandidas).every(Boolean) ? (
            <>
              <FaCompress className="text-sm" />
              <span>Contraer Todas</span>
            </>
          ) : (
            <>
              <FaExpand className="text-sm" />
              <span>Expandir Todas</span>
            </>
          )}
        </button>
      </div>

      {/* Contenido del aviso */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Introducción */}
        <div className="p-8 bg-gray-50 border-b border-gray-200">
          <p className="text-lg text-gray-700 leading-relaxed text-justify">
            En cumplimiento con la <strong className="text-gray-900">Ley Federal de Protección de Datos Personales en Posesión de los Particulares</strong> 
            y demás normatividad aplicable en materia de protección de datos personales, el presente Aviso de Privacidad 
            tiene por objeto informarle sobre el tratamiento que se dará a sus datos personales en el 
            <strong className="text-gray-900"> Sistema Integral de Gestión y Control Financiero (SIGECOF)</strong>.
          </p>
        </div>

        {/* Secciones expandibles */}
        <div className="divide-y divide-gray-200">
          
          {/* Identidad del Responsable */}
          <div className="border-b border-gray-200">
            <button 
              className={`w-full p-6 text-left transition-all duration-300 ${
                secciones_expandidas.identidad ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
              }`}
              onClick={() => alternarSeccion('identidad')}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white">
                    <FaBuilding className="text-lg" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Identidad y Domicilio del Responsable</h3>
                </div>
                {secciones_expandidas.identidad ? (
                  <FaChevronDown className="text-gray-500 text-lg" />
                ) : (
                  <FaChevronRight className="text-gray-500 text-lg" />
                )}
              </div>
            </button>
            
            {secciones_expandidas.identidad && (
              <div className="px-6 pb-6 bg-blue-50 animate-slide-down">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-6 rounded-xl border border-gray-200">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Denominación:</span>
                    <p className="text-gray-900 font-medium">Sistema Integral de Gestión y Control Financiero (SIGECOF)</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Domicilio:</span>
                    <p className="text-gray-900 font-medium">Av. México Coyoacán 318, Gral Anaya, Coyoacán, 03340 Ciudad de México, CDMX.</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Teléfono:</span>
                    <p className="text-gray-900 font-medium">+52 (55) 5555-0000 (PENDIENTE)</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Correo electrónico:</span>
                    <p className="text-gray-900 font-medium">sistemas@fopesiban.net</p>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Página web:</span>
                    <p className="text-gray-900 font-medium">www.fopesiban.net</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Finalidades del Tratamiento */}
          <div className="border-b border-gray-200">
            <button 
              className={`w-full p-6 text-left transition-all duration-300 ${
                secciones_expandidas.finalidades ? 'bg-green-50' : 'bg-white hover:bg-gray-50'
              }`}
              onClick={() => alternarSeccion('finalidades')}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-700 rounded-full flex items-center justify-center text-white">
                    <FaBullseye className="text-lg" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Finalidades del Tratamiento</h3>
                </div>
                {secciones_expandidas.finalidades ? (
                  <FaChevronDown className="text-gray-500 text-lg" />
                ) : (
                  <FaChevronRight className="text-gray-500 text-lg" />
                )}
              </div>
            </button>
            
            {secciones_expandidas.finalidades && (
              <div className="px-6 pb-6 bg-green-50 animate-slide-down">
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3 border-l-4 border-green-500 pl-3">Finalidades Primarias (Necesarias para el servicio):</h4>
                    <ul className="bg-white p-4 rounded-lg border border-gray-200 space-y-2">
                      <li className="flex items-start gap-2 text-gray-700">
                        <span className="text-green-500 mt-1">•</span>
                        Identificación y autenticación de usuarios del sistema
                      </li>
                      <li className="flex items-start gap-2 text-gray-700">
                        <span className="text-green-500 mt-1">•</span>
                        Gestión y control de accesos a las funcionalidades del sistema
                      </li>
                      <li className="flex items-start gap-2 text-gray-700">
                        <span className="text-green-500 mt-1">•</span>
                        Procesamiento de transacciones financieras y contables
                      </li>
                      <li className="flex items-start gap-2 text-gray-700">
                        <span className="text-green-500 mt-1">•</span>
                        Generación de reportes y estados financieros
                      </li>
                      <li className="flex items-start gap-2 text-gray-700">
                        <span className="text-green-500 mt-1">•</span>
                        Control y seguimiento de inventarios
                      </li>
                      <li className="flex items-start gap-2 text-gray-700">
                        <span className="text-green-500 mt-1">•</span>
                        Cumplimiento de obligaciones fiscales y regulatorias
                      </li>
                      <li className="flex items-start gap-2 text-gray-700">
                        <span className="text-green-500 mt-1">•</span>
                        Auditoría y control interno de operaciones
                      </li>
                      <li className="flex items-start gap-2 text-gray-700">
                        <span className="text-green-500 mt-1">•</span>
                        Respaldo y recuperación de información
                      </li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3 border-l-4 border-yellow-500 pl-3">Finalidades Secundarias (No necesarias para el servicio):</h4>
                    <ul className="bg-white p-4 rounded-lg border border-gray-200 space-y-2">
                      <li className="flex items-start gap-2 text-gray-700">
                        <span className="text-yellow-500 mt-1">•</span>
                        Envío de comunicados y boletines informativos
                      </li>
                      <li className="flex items-start gap-2 text-gray-700">
                        <span className="text-yellow-500 mt-1">•</span>
                        Realización de encuestas de satisfacción
                      </li>
                      <li className="flex items-start gap-2 text-gray-700">
                        <span className="text-yellow-500 mt-1">•</span>
                        Análisis estadístico para mejora del servicio
                      </li>
                      <li className="flex items-start gap-2 text-gray-700">
                        <span className="text-yellow-500 mt-1">•</span>
                        Capacitación y soporte técnico personalizado
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-yellow-800 font-medium">
                      <strong>Nota:</strong> Para las finalidades secundarias, usted puede manifestar su negativa 
                      enviando un correo a privacidad@sigecof.gob.mx
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Datos Personales */}
          <div className="border-b border-gray-200">
            <button 
              className={`w-full p-6 text-left transition-all duration-300 ${
                secciones_expandidas.datos ? 'bg-purple-50' : 'bg-white hover:bg-gray-50'
              }`}
              onClick={() => alternarSeccion('datos')}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-purple-700 rounded-full flex items-center justify-center text-white">
                    <FaClipboardList className="text-lg" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Datos Personales que se Recaban</h3>
                </div>
                {secciones_expandidas.datos ? (
                  <FaChevronDown className="text-gray-500 text-lg" />
                ) : (
                  <FaChevronRight className="text-gray-500 text-lg" />
                )}
              </div>
            </button>
            
            {secciones_expandidas.datos && (
              <div className="px-6 pb-6 bg-purple-50 animate-slide-down">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">📝 Datos de Identificación</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-1">•</span>
                        Nombre completo
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-1">•</span>
                        RFC (Registro Federal de Contribuyentes)
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-1">•</span>
                        CURP (Clave Única de Registro de Población)
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-1">•</span>
                        Número de empleado o identificación institucional
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-1">•</span>
                        Fotografía (para identificación en el sistema)
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">📞 Datos de Contacto</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-1">•</span>
                        Correo electrónico institucional
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-1">•</span>
                        Teléfono de oficina
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-1">•</span>
                        Extensión telefónica
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-1">•</span>
                        Área o departamento de adscripción
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">💼 Datos Laborales</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-1">•</span>
                        Puesto o cargo
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-1">•</span>
                        Nivel jerárquico
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-1">•</span>
                        Fecha de ingreso
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-1">•</span>
                        Permisos y roles en el sistema
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-1">•</span>
                        Firma electrónica
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">🔐 Datos Técnicos</h4>
                    <ul className="space-y-2 text-gray-700">
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-1">•</span>
                        Dirección IP
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-1">•</span>
                        Logs de acceso al sistema
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-1">•</span>
                        Historial de transacciones
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-1">•</span>
                        Configuraciones de usuario
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-500 mt-1">•</span>
                        Cookies y datos de sesión
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Derechos ARCO */}
          <div className="border-b border-gray-200">
            <button 
              className={`w-full p-6 text-left transition-all duration-300 ${
                secciones_expandidas.derechos ? 'bg-indigo-50' : 'bg-white hover:bg-gray-50'
              }`}
              onClick={() => alternarSeccion('derechos')}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-indigo-700 rounded-full flex items-center justify-center text-white">
                    <FaBalanceScale className="text-lg" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Derechos ARCO</h3>
                </div>
                {secciones_expandidas.derechos ? (
                  <FaChevronDown className="text-gray-500 text-lg" />
                ) : (
                  <FaChevronRight className="text-gray-500 text-lg" />
                )}
              </div>
            </button>
            
            {secciones_expandidas.derechos && (
              <div className="px-6 pb-6 bg-indigo-50 animate-slide-down">
                <div className="space-y-6">
                  <p className="text-gray-700 font-medium">Usted tiene derecho a:</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white">
                          <FaEye className="text-sm" />
                        </div>
                        <h4 className="font-semibold text-gray-900">Acceso</h4>
                      </div>
                      <p className="text-gray-600 text-sm">
                        Conocer qué datos personales tenemos de usted, para qué los utilizamos y las condiciones del uso que les damos.
                      </p>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white">
                          <FaEdit className="text-sm" />
                        </div>
                        <h4 className="font-semibold text-gray-900">Rectificación</h4>
                      </div>
                      <p className="text-gray-600 text-sm">
                        Solicitar la corrección de su información personal en caso de que esté desactualizada, sea inexacta o incompleta.
                      </p>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white">
                          <FaTrash className="text-sm" />
                        </div>
                        <h4 className="font-semibold text-gray-900">Cancelación</h4>
                      </div>
                      <p className="text-gray-600 text-sm">
                        Solicitar que se elimine su información personal de nuestros registros cuando considere que no está siendo utilizada adecuadamente.
                      </p>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-white">
                          <FaBan className="text-sm" />
                        </div>
                        <h4 className="font-semibold text-gray-900">Oposición</h4>
                      </div>
                      <p className="text-gray-600 text-sm">
                        Oponerse al uso de sus datos personales para finalidades específicas.
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-xl border border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">¿Cómo ejercer sus derechos?</h4>
                    <ol className="space-y-3 text-gray-700">
                      <li className="flex items-start gap-2">
                        <span className="font-semibold text-indigo-600">1.</span>
                        <span>Envíe su solicitud por escrito a: <strong className="text-gray-900">jcolinsa@fopesiban.net</strong> y a <strong className="text-gray-900">sistemas@fopesiban.net</strong></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-semibold text-indigo-600">2.</span>
                        <span>
                          Incluya los siguientes datos:
                          <ul className="mt-2 ml-4 space-y-1">
                            <li className="flex items-start gap-2">
                              <span className="text-indigo-500 mt-1">•</span>
                              Nombre completo y firma
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-indigo-500 mt-1">•</span>
                              Descripción clara de los datos sobre los que busca ejercer algún derecho
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-indigo-500 mt-1">•</span>
                              Cualquier elemento que facilite la localización de sus datos
                            </li>
                          </ul>
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-semibold text-indigo-600">3.</span>
                        <span>Recibirá respuesta en un plazo máximo de <strong className="text-gray-900">5 días hábiles</strong></span>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Transferencias */}
          <div className="border-b border-gray-200">
            <button 
              className={`w-full p-6 text-left transition-all duration-300 ${
                secciones_expandidas.transferencias ? 'bg-teal-50' : 'bg-white hover:bg-gray-50'
              }`}
              onClick={() => alternarSeccion('transferencias')}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-teal-500 to-teal-700 rounded-full flex items-center justify-center text-white">
                    <FaExchangeAlt className="text-lg" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Transferencias de Datos</h3>
                </div>
                {secciones_expandidas.transferencias ? (
                  <FaChevronDown className="text-gray-500 text-lg" />
                ) : (
                  <FaChevronRight className="text-gray-500 text-lg" />
                )}
              </div>
            </button>
            
            {secciones_expandidas.transferencias && (
              <div className="px-6 pb-6 bg-teal-50 animate-slide-down">
                <div className="space-y-6">
                  <p className="text-gray-700">Sus datos personales pueden ser transferidos y tratados dentro y fuera del país, por las siguientes entidades:</p>
                  
                  <div className="space-y-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">🏛️ Entidades Gubernamentales</h4>
                      <ul className="space-y-2 text-gray-700 mb-3">
                        <li className="flex items-start gap-2">
                          <span className="text-teal-500 mt-1">•</span>
                          Secretaría de Hacienda y Crédito Público (SHCP)
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-teal-500 mt-1">•</span>
                          Servicio de Administración Tributaria (SAT)
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-teal-500 mt-1">•</span>
                          Auditoría Superior de la Federación (ASF)
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-teal-500 mt-1">•</span>
                          Instituto Nacional de Transparencia (INAI)
                        </li>
                      </ul>
                      <p className="text-gray-600 text-sm italic">
                        <strong>Finalidad:</strong> Cumplimiento de obligaciones fiscales y regulatorias
                      </p>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl border border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">🔧 Proveedores de Servicios</h4>
                      <ul className="space-y-2 text-gray-700 mb-3">
                        <li className="flex items-start gap-2">
                          <span className="text-teal-500 mt-1">•</span>
                          Proveedores de servicios de nube y hosting
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-teal-500 mt-1">•</span>
                          Empresas de soporte técnico y mantenimiento
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-teal-500 mt-1">•</span>
                          Servicios de respaldo y recuperación de datos
                        </li>
                      </ul>
                      <p className="text-gray-600 text-sm italic">
                        <strong>Finalidad:</strong> Operación y mantenimiento del sistema
                      </p>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl border border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">🔍 Entidades de Auditoría</h4>
                      <ul className="space-y-2 text-gray-700 mb-3">
                        <li className="flex items-start gap-2">
                          <span className="text-teal-500 mt-1">•</span>
                          Despachos de auditoría externa
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-teal-500 mt-1">•</span>
                          Organismos de control interno
                        </li>
                      </ul>
                      <p className="text-gray-600 text-sm italic">
                        <strong>Finalidad:</strong> Auditoría y control de operaciones
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-800 font-medium">
                      <strong>Importante:</strong> Todas las transferencias se realizan bajo estrictas medidas de seguridad 
                      y confidencialidad, garantizando la protección de sus datos personales.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Contacto */}
          <div className="border-b border-gray-200">
            <button 
              className={`w-full p-6 text-left transition-all duration-300 ${
                secciones_expandidas.contacto ? 'bg-orange-50' : 'bg-white hover:bg-gray-50'
              }`}
              onClick={() => alternarSeccion('contacto')}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-700 rounded-full flex items-center justify-center text-white">
                    <FaPhoneAlt className="text-lg" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">Contacto y Más Información</h3>
                </div>
                {secciones_expandidas.contacto ? (
                  <FaChevronDown className="text-gray-500 text-lg" />
                ) : (
                  <FaChevronRight className="text-gray-500 text-lg" />
                )}
              </div>
            </button>
            
            {secciones_expandidas.contacto && (
              <div className="px-6 pb-6 bg-orange-50 animate-slide-down">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">📧 Oficial de Protección de Datos</h4>
                      <div className="space-y-2 text-gray-700">
                        <p><strong>Correo:</strong> sistemas@fopesiban.net y jcolinsa@fopesiban.net</p>
                        <p><strong>Teléfono:</strong> +52 (55) 5555-0001 ext. 1234 (CAMBIAR NÚMERO)</p>
                      </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl border border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">🏢 Domicilio para Notificaciones</h4>
                      <p className="text-gray-700">
                        Av. México Coyoacán 318, Gral Anaya, Coyoacán<br/>
                        C.P. 03340 Ciudad de México, CDMX.<br/>
                        Atención: Área de Sistemas del FOPESIBAN
                      </p>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl border border-gray-200 md:col-span-2">
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">⏰ Horario de Atención</h4>
                      <p className="text-gray-700">
                        Lunes a Viernes: 9:00 a 18:00 hrs<br/>
                        Tiempo del Centro de México
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-xl border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">📚 Recursos Adicionales</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <a href="#" className="text-blue-600 hover:text-blue-800 hover:underline transition-colors">
                        Ley Federal de Protección de Datos Personales
                      </a>
                      <a href="#" className="text-blue-600 hover:text-blue-800 hover:underline transition-colors">
                        Reglamento de la LFPDPPP
                      </a>
                      <a href="#" className="text-blue-600 hover:text-blue-800 hover:underline transition-colors">
                        Guía para el ejercicio de derechos ARCO
                      </a>
                      <a href="#" className="text-blue-600 hover:text-blue-800 hover:underline transition-colors">
                        Portal del INAI
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pie del aviso */}
        <div className="p-8 bg-gray-50 border-t border-gray-200">
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FaCalendarAlt />
                Actualizaciones del Aviso
              </h4>
              <div className="space-y-3 text-gray-700">
                <p>
                  Nos reservamos el derecho de efectuar modificaciones o actualizaciones al presente Aviso de Privacidad 
                  en cualquier momento, derivado de nuevas disposiciones legales, políticas internas, nuevos requerimientos 
                  para la prestación u ofrecimiento de servicios o por otras causas.
                </p>
                <p>
                  Las modificaciones se harán del conocimiento de los titulares de los datos a través de la página web 
                  <strong className="text-gray-900"> www.fopesiban.net</strong> y/o mediante comunicación directa.
                </p>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <p className="text-gray-700">
                  <strong>Fecha de última actualización:</strong> 01 de Noviembre, 2025
                </p>
                <p className="text-gray-700">
                  <strong>Fecha de vigencia:</strong> Indefinida
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvisoPrivacidad;
