import { useState } from 'react';
import { FiEye, FiEyeOff, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { useInicioSesion } from '../../pagina_inicial/inicio_sesion/contexto/inicio_sesion-Context';
import { useControlNotificaciones } from '../administrador/administrador_notificaciones.jsx';

export default function CambioContrasena() {
  const { procesar_evento, rol_actual } = useControlNotificaciones();
  const { token } = useInicioSesion();
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

  const [contrasena_nueva, setContrasenaNueva] = useState('');
  const [repetir_contrasena_nueva, setRepetirContrasenaNueva] = useState('');
  const [mostrar_contrasena, setMostrarContrasena] = useState(false);
  const [mostrar_repetir_contrasena, setMostrarRepetirContrasena] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setExito(false);

    if (contrasena_nueva.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (contrasena_nueva !== repetir_contrasena_nueva) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setCargando(true);
    try {
      const tokenHeader = token || null;
      const respuesta = await fetch(`${API_URL}/autenticacion/cambiar_contrasena`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tokenHeader ? { 'Authorization': `Bearer ${tokenHeader}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ newPassword: contrasena_nueva })
      });

      const datos = await respuesta.json();
      if (!respuesta.ok || !datos.exito) {
        setError(datos.error || datos.mensaje || 'Ocurrió un error al cambiar la contraseña.');
        return;
      }

      setExito(true);
      setContrasenaNueva('');
      setRepetirContrasenaNueva('');
      try {
        procesar_evento({
          seccion: 'cambio_contrasena',
          accion: 'actualizar_contrasena',
          rol_origen: rol_actual,
        });
      } catch (_) {}
      
    } catch (err) {
      setError(err?.message || 'Ocurrió un error al cambiar la contraseña.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="mx-auto py-6 px-10">
      <div className="max-w-screen-md mx-auto">
        {exito ? (
          <div className="text-center py-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
            <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <FiCheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Contraseña actualizada!</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              Tu contraseña ha sido cambiada exitosamente.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-800 mb-5">Cambiar contraseña</h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="contrasena_nueva" className="block text-sm font-semibold text-gray-800 mb-2">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    id="contrasena_nueva"
                    type={mostrar_contrasena ? 'text' : 'password'}
                    required
                    value={contrasena_nueva}
                    onChange={(e) => setContrasenaNueva(e.target.value)}
                    className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Ingresa tu nueva contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarContrasena(!mostrar_contrasena)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                  >
                    {mostrar_contrasena ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="repetir_contrasena_nueva" className="block text-sm font-semibold text-gray-800 mb-2">
                  Repetir nueva contraseña
                </label>
                <div className="relative">
                  <input
                    id="repetir_contrasena_nueva"
                    type={mostrar_repetir_contrasena ? 'text' : 'password'}
                    required
                    value={repetir_contrasena_nueva}
                    onChange={(e) => setRepetirContrasenaNueva(e.target.value)}
                    className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Repite tu nueva contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarRepetirContrasena(!mostrar_repetir_contrasena)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                  >
                    {mostrar_repetir_contrasena ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800">
                  <FiXCircle />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={cargando}
                className="w-full px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                {cargando ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Cambiando contraseña...
                  </div>
                ) : (
                  'Cambiar Contraseña'
                )}
              </button>
            </form>
          </div>
        )}

        {!exito && (
          <div className="mt-6 flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-full text-sm font-medium border border-emerald-200">
              <FiCheckCircle size={16} />
              <span>La contraseña debe tener al menos 6 caracteres</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
