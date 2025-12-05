import { useEffect, useMemo, useState } from 'react';
import { FiRefreshCw, FiEyeOff, FiEye, FiSearch, FiAlertTriangle, FiCheckCircle, FiClipboard } from 'react-icons/fi';
import { useInicioSesion } from '../../pagina_inicial/inicio_sesion/contexto/inicio_sesion-Context';
import { useMensajesConfirmacion } from '../../utilidades/comunes/mensajes_confirmacion.jsx';

const ContrasenasTemporales = () => {
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

  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('');
  const [mostrar_passwords, setMostrarPasswords] = useState(false);
  const [copiado_usuario, setCopiadoUsuario] = useState(null);

  const cargar_listado = async () => {
    setCargando(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/autenticacion/admin/contrasenas_temporales`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.exito) {
        throw new Error(data.error || 'No se pudo obtener el listado');
      }
      setUsuarios(Array.isArray(data.usuarios) ? data.usuarios : []);
    } catch (e) {
      setError(e.message || 'Error al cargar contraseñas temporales');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (token) cargar_listado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const usuarios_filtrados = useMemo(() => {
    const q = filtro.toLowerCase().trim();
    if (!q) return usuarios;
    return usuarios.filter(u =>
      String(u.usuario || '').toLowerCase().includes(q) ||
      String(u.nombre || '').toLowerCase().includes(q)
    );
  }, [usuarios, filtro]);

  const { confirmar } = useMensajesConfirmacion();

  const copiar_password = async (usuario, contrasena) => {
    const ok = await confirmar({
      titulo: 'Confirmar copia de contraseña',
      mensaje: `¿Copiar la contraseña temporal del usuario "${usuario}" al portapapeles?`,
      tipo: 'informacion',
      texto_confirmar: 'Copiar',
      texto_cancelar: 'Cancelar',
    });
    if (!ok) return;
    const texto = String(contrasena || '');
    const intentarExecCommand = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = texto;
        ta.style.position = 'fixed';
        ta.style.top = '0';
        ta.style.left = '0';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (_) {
        return false;
      }
    };
    try {
      const esSeguro = typeof window !== 'undefined' && (window.isSecureContext || window.location.protocol === 'https:');
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && esSeguro) {
        await navigator.clipboard.writeText(texto);
      } else {
        const okLocal = intentarExecCommand();
        if (!okLocal) throw new Error('copy_fallback_failed');
      }
      setCopiadoUsuario(usuario);
      setTimeout(() => setCopiadoUsuario(null), 1500);
    } catch (e) {
      setError('No se pudo copiar la contraseña al portapapeles');
    }
  };

  return (
    <div className="mx-auto py-6 px-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={cargar_listado}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
            title="Actualizar listado"
          >
            <FiRefreshCw size={18} />
            <span className="font-medium">Actualizar</span>
          </button>
          <button
            onClick={() => setMostrarPasswords(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-800 hover:bg-gray-200 transition-all duration-200 shadow-sm hover:shadow-md"
            title={mostrar_passwords ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
          >
            {mostrar_passwords ? <FiEyeOff size={18} /> : <FiEye size={18} />}
            <span className="font-medium">{mostrar_passwords ? 'Ocultar' : 'Mostrar'}</span>
          </button>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative w-full max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            placeholder="Buscar por usuario o nombre"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 mb-6 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-800">
          <FiAlertTriangle />
          <span>{error}</span>
        </div>
      )}

      {cargando ? (
        <div className="flex justify-center items-center h-64 bg-white rounded-xl border border-gray-200">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : usuarios_filtrados.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
          <div className="w-20 h-20 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Sin contraseñas pendientes</h3>
          <p className="text-gray-600 max-w-md mx-auto">No hay usuarios con contraseña temporal.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Usuario</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Nombre</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Contraseña Temporal</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Actualizada</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios_filtrados.map((u) => (
                  <tr key={u.id_usuario} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-800 font-medium">{u.usuario}</td>
                    <td className="px-5 py-3 text-gray-700">{u.nombre || '-'}</td>
                    <td className="px-5 py-3 text-gray-700 font-mono">
                      {mostrar_passwords ? (u.contrasena_temporal || '') : '••••••••'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 text-sm">
                      {u.fecha_actualizacion ? new Date(u.fecha_actualizacion).toLocaleString('es-ES') : '-'}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => copiar_password(u.usuario, u.contrasena_temporal)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium"
                        title="Copiar contraseña"
                      >
                        {copiado_usuario === u.usuario ? <FiCheckCircle className="text-green-600" size={16} /> : <FiClipboard size={16} />}
                        {copiado_usuario === u.usuario ? 'Copiado' : 'Copiar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 text-sm text-gray-500">
        <p>
          Nota: Estas contraseñas se regeneran cuando el usuario solicita recuperación y permanecen activas hasta que el usuario cambie su contraseña.
        </p>
      </div>
    </div>
  );

}


export default ContrasenasTemporales;
