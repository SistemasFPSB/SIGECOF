import { useEffect, useMemo } from 'react';
import { CheckCircle, AlertTriangle, Info, Clipboard, Mail, RefreshCw } from 'lucide-react';
import { FiEye, FiExternalLink } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useControlNotificaciones } from '../administrador/administrador_notificaciones.jsx';
import { obtener_ruta_por_id, puede_ver_seccion, obtener_primera_ruta_permitida } from '../administrador/roles_permisos';
import { obtenerTituloPorMenu } from '../../utilidades/items';
 

const Notificaciones = () => {
  const navigate = useNavigate();
  const {
    obtener_por_rol,
    rol_actual,
    marcar_como_leida,
    marcar_todas_como_leidas,
    refrescar_notificaciones,
  } = useControlNotificaciones();
 
  
  const reemplazarPlantillas = (texto) => texto;
  const notifs_no_leidas = useMemo(() => {
    return obtener_por_rol(rol_actual)
      .filter(n => !n.leido)
      .slice()
      .sort((a, b) => new Date(b.marca_temporal) - new Date(a.marca_temporal));
  }, [rol_actual, obtener_por_rol]);

  const etiquetaTipo = (t) => {
    const v = String(t || '').toLowerCase();
    if (v === 'exito') return 'Éxito';
    if (v === 'advertencia') return 'Advertencia';
    if (v === 'informacion') return 'Información';
    if (v === 'tarea') return 'Tarea';
    if (v === 'correo') return 'Correo';
    return v || '—';
  };
  const claseBadgeTipo = (t) => {
    const v = String(t || '').toLowerCase();
    if (v === 'exito') return 'bg-green-100 text-green-700';
    if (v === 'advertencia') return 'bg-yellow-100 text-yellow-700';
    if (v === 'informacion') return 'bg-blue-100 text-blue-700';
    if (v === 'tarea') return 'bg-purple-100 text-purple-700';
    if (v === 'correo') return 'bg-gray-100 text-gray-700';
    return 'bg-gray-100 text-gray-700';
  };
  const claseBordePorTipo = (t) => {
    const v = String(t || '').toLowerCase();
    if (v === 'exito') return 'border-green-200 hover:border-green-300 bg-green-50';
    if (v === 'advertencia') return 'border-yellow-200 hover:border-yellow-300 bg-yellow-50';
    if (v === 'informacion') return 'border-blue-200 hover:border-blue-300 bg-blue-50';
    if (v === 'tarea') return 'border-purple-200 hover:border-purple-300 bg-purple-50';
    if (v === 'correo') return 'border-gray-200 hover:border-gray-300 bg-gray-50';
    return 'border-gray-200 hover:border-gray-300 bg-gray-50';
  };
  const IconoTipo = ({ tipo, size = 12 }) => {
    const v = String(tipo || '').toLowerCase();
    if (v === 'exito') return <CheckCircle size={size} className="inline-block" />;
    if (v === 'advertencia') return <AlertTriangle size={size} className="inline-block" />;
    if (v === 'informacion') return <Info size={size} className="inline-block" />;
    if (v === 'tarea') return <Clipboard size={size} className="inline-block" />;
    if (v === 'correo') return <Mail size={size} className="inline-block" />;
    return null;
  };

  const historial_notificaciones = useMemo(() => {
    return obtener_por_rol(rol_actual)
      .filter(n => !!n.leido)
      .slice()
      .sort((a, b) => new Date(b.marca_temporal) - new Date(a.marca_temporal));
  }, [rol_actual, obtener_por_rol]);

  // Refrescar notificaciones cuando cambia el rol
  useEffect(() => {
    if (rol_actual) {
      refrescar_notificaciones();
    }
  }, [rol_actual, refrescar_notificaciones]);

  const ir_a_ruta = (rutaId, notificacionId = null) => {
    if (notificacionId) {
      marcar_como_leida(notificacionId);
    }
    const destinoId = rutaId || 'inicio';
    if (!puede_ver_seccion(destinoId, rol_actual)) {
      const fallback = obtener_primera_ruta_permitida(rol_actual);
      navigate(fallback);
      return;
    }
    const ruta = obtener_ruta_por_id(destinoId);
    if (ruta) {
      navigate(ruta);
    } else {
      const fallback = obtener_primera_ruta_permitida(rol_actual);
      navigate(fallback);
    }
  };

  const parseFecha = (valor) => {
    if (!valor) return null;
    const fecha = valor instanceof Date ? valor : new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  };

  const formatFecha = (valorFecha) => {
    const fecha = parseFecha(valorFecha);
    if (!fecha) return '';
    const ahora = new Date();
    const diferencia = ahora - fecha;
    const unDia = 24 * 60 * 60 * 1000;
    
    if (diferencia < unDia) {
      return `Hoy, ${fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diferencia < 2 * unDia) {
      return `Ayer, ${fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return fecha.toLocaleDateString('es-ES', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const clasePrioridad = (p) => {
    const v = String(p || 'media').toLowerCase();
    if (v === 'alta') return 'bg-red-100 text-red-700';
    if (v === 'baja') return 'bg-green-100 text-green-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  return (
    <div className="mx-auto py-6 px-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={refrescar_notificaciones}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
            title="Actualizar listado"
          >
            <RefreshCw size={18} />
            <span className="font-medium">Actualizar</span>
          </button>
          <button
            onClick={marcar_todas_como_leidas}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all duration-200 shadow-sm hover:shadow-md"
            title="Marcar todas como leídas"
          >
            <FiEye size={18} />
            <span className="font-medium">Marcar todas</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <div className="px-3 py-1.5 bg-purple-50 rounded-full">
          <span className="text-xs font-medium text-purple-700">Total no leídas: {notifs_no_leidas.length}</span>
        </div>
        {historial_notificaciones.length > 0 && (
          <div className="px-3 py-1.5 bg-gray-50 rounded-full">
            <span className="text-xs font-medium text-gray-700">Historial: {historial_notificaciones.length}</span>
          </div>
        )}
      </div>

      {/* Notificaciones actuales (no leídas) */}
      <div className="space-y-4 mb-8">
        {(notifs_no_leidas.length === 0) ? (
          <div className="text-center py-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
            <div className="w-20 h-20 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">¡Todo al día!</h3>
            <p className="text-gray-600 max-w-md mx-auto">No tienes notificaciones pendientes en este momento.</p>
          </div>
        ) : (
          notifs_no_leidas.map((n) => (
            <div 
              key={n.id} 
              className={`bg-white rounded-xl border-2 transition-all duration-200 hover:shadow-lg ${
                n.leido 
                  ? 'border-gray-100 hover:border-gray-200' 
                  : claseBordePorTipo(n.tipo)
              }`}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      {!n.leido && (
                        <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" aria-hidden="true" />
                      )}
                      <h4 className={`text-lg font-semibold ${n.leido ? 'text-gray-800' : 'text-blue-800'}`}>
                        {reemplazarPlantillas(n.titulo)}
                      </h4>
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1 ${claseBadgeTipo(n.tipo)}`}>
                        <IconoTipo tipo={n.tipo} />
                        {etiquetaTipo(n.tipo)}
                      </span>
                    </div>
                    
                    {n.mensaje && (
                      <p className={`text-gray-600 mb-3 leading-relaxed ${n.leido ? '' : 'font-medium'}`}>
                        {reemplazarPlantillas(n.mensaje)}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatFecha(n.marca_temporal)}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        n.leido ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {n.leido ? 'Leída' : 'Nueva'}
                      </span>
                      {n.prioridad && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${clasePrioridad(n.prioridad)}`}>
                          Prioridad: {String(n.prioridad).toLowerCase()}
                        </span>
                      )}
                      {n.datos?.rol && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-gray-700">
                          Rol: {String(n.datos.rol)}
                        </span>
                      )}
                      {n.datos?.nombre && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-gray-700">
                          Nombre: {n.datos.nombre}
                        </span>
                      )}
                      {n.datos?.usuario && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-gray-700">
                          Usuario: {n.datos.usuario}
                        </span>
                      )}
                      {n.datos?.usuario_ejecutor && (
                        <span className="flex items-center gap-1 text-xs text-gray-600">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {n.datos.usuario_ejecutor}
                        </span>
                      )}
                    </div>
                    
                    {n.ruta_sugerida && (
                      <div className="mt-4">
                        <button
                          className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm font-medium shadow-sm hover:shadow-md"
                          onClick={() => ir_a_ruta(n.ruta_sugerida, n.id)}
                        >
                          <FiExternalLink size={16} />
                          {(() => {
                            const info = obtenerTituloPorMenu(n.ruta_sugerida);
                            const titulo = info?.titulo || n.ruta_sugerida.replace('_', ' ');
                            // Ajuste específico para acentos comunes
                            return `Ir a ${titulo}`;
                          })()}
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {!n.leido && (
                      <button
                        className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors duration-200 shadow-sm hover:shadow"
                        onClick={() => marcar_como_leida(n.id)}
                        title="Marcar como leída"
                      >
                        <FiEye size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Historial de notificaciones (leídas) */}
      {historial_notificaciones.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Historial de notificaciones
          </h3>
          <div className="space-y-3">
            {historial_notificaciones.map((n) => (
              <div key={`hist-${n.id}`} className="bg-gray-50 rounded-lg border border-gray-200 p-4 opacity-75">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium text-gray-700">
                        {reemplazarPlantillas(n.titulo)}
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-200 text-gray-600">
                        Leída
                      </span>
                    </div>
                    {n.mensaje && (
                      <p className="text-sm text-gray-600 mb-2">
                        {n.mensaje}
                      </p>
                    )}
                    <div className="text-xs text-gray-500">
                      {formatFecha(n.marca_temporal)}
                      <span className="ml-2 inline-flex items-center gap-2">
                        {n.datos?.rol && (
                          <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">Rol: {String(n.datos.rol)}</span>
                        )}
                        {n.datos?.nombre && (
                          <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">Nombre: {n.datos.nombre}</span>
                        )}
                        {n.datos?.usuario && (
                          <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">Usuario: {n.datos.usuario}</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Notificaciones;
