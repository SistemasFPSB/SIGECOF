import { useEffect, useRef, useState } from 'react';
import { Search, User, X, Edit3, Shield, ToggleLeft, ToggleRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useInicioSesion } from '../../pagina_inicial/inicio_sesion/contexto/inicio_sesion-Context';
import { obtener_primera_ruta_permitida, puede_ver_seccion, etiqueta_rol } from './roles_permisos';
import { useMensajesConfirmacion } from '../../utilidades/comunes/mensajes_confirmacion.jsx';

const GestionarUsuarios = () => {
  const navigate = useNavigate();
  const { token, usuarioAutenticado } = useInicioSesion();

  // Construcción de URLs base para API
  const API_BASE = process.env.REACT_APP_API_URL;
  const BASE_CON_API = (() => {
    if (API_BASE && /^https?:\/\//.test(API_BASE)) return String(API_BASE).replace(/\/+$/, '');
    try {
      const host = typeof window !== 'undefined' ? (window.location?.hostname || 'localhost') : 'localhost';
      return `http://${host}:5000/api`;
    } catch (_) {
      return 'http://localhost:5000/api';
    }
  })();
  const BASE_SIN_API = '/api';

  const headersAuth = token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };

  // Utilidad para intentar con /api y sin /api
  const fetch_flexible = async (ruta_relativa, opciones = {}) => {
    const opcionesFinal = { credentials: 'include', ...opciones };
    const intentos = [
      `${BASE_CON_API}${ruta_relativa}`,
      `${BASE_SIN_API}${ruta_relativa}`,
      `${ruta_relativa}`,
    ];
    let ultimoError = 'Error de solicitud';
    for (const url of intentos) {
      try {
        const resp = await fetch(url, opcionesFinal);
        let data = {};
        try { data = await resp.json(); } catch {}
        if (resp.ok) return { resp, data };
        const es_404 = resp.status === 404 || String(data?.error || '').toLowerCase().includes('ruta no encontrada');
        ultimoError = data?.error || ultimoError;
        if (es_404) continue;
      } catch (e) {
        ultimoError = e.message || ultimoError;
      }
    }
    throw new Error(ultimoError || 'Error de solicitud');
  };

  // Estados de búsqueda y gestión
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [usuarioSel, setUsuarioSel] = useState(null);
  const timeoutRef = useRef(null);
  const [rolesDisponibles, setRolesDisponibles] = useState([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [editandoRol, setEditandoRol] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoRol, setNuevoRol] = useState('');
  const [eliminando_id, setEliminandoId] = useState(null);

  // Verificación de permisos al montar
  useEffect(() => {
    const rolActual = (usuarioAutenticado?.rol || '').toLowerCase();
    if (!puede_ver_seccion('gestionar_usuarios', rolActual)) {
      const destino = obtener_primera_ruta_permitida(rolActual);
      navigate(destino, { replace: true });
    }
  }, [usuarioAutenticado, navigate]);

  // Cargar roles disponibles para asignar en controles inline
  // Se obtienen tanto los roles presentes en usuarios (roles_unicos)
  // como los roles definidos en permisos (tabla permisos_roles),
  // y se construye la unión para mostrar SIEMPRE todos los roles del sistema.
  useEffect(() => {
    const cargarRoles = async () => {
      try {
        const [rUsuarios, rPermisos] = await Promise.all([
          fetch_flexible('/autenticacion/admin/roles_unicos', { method: 'GET', headers: headersAuth }),
          fetch_flexible('/autenticacion/admin/permisos', { method: 'GET', headers: headersAuth }),
        ]);

        const rolesUsuarios = (rUsuarios?.resp?.ok && Array.isArray(rUsuarios?.data?.roles))
          ? rUsuarios.data.roles.map((x) => String(x || '').trim().toLowerCase())
          : [];

        const rolesPermisos = (rPermisos?.resp?.ok && rPermisos?.data && typeof rPermisos.data.permisos === 'object')
          ? Object.keys(rPermisos.data.permisos).map((k) => String(k || '').trim().toLowerCase())
          : [];

        const union = Array.from(new Set(['admin', ...rolesUsuarios, ...rolesPermisos]))
          .filter(Boolean)
          .sort();

        setRolesDisponibles(union);
      } catch (_) {
        // Fallback: mantener roles disponibles vacíos si falla la carga
        setRolesDisponibles((prev) => Array.isArray(prev) ? prev : []);
      }
    };
    cargarRoles();
  }, [headersAuth]);

  // Búsqueda de usuarios
  const buscarUsuarios = async (termino) => {
    const t = String(termino || '').trim();
    if (t.length < 2) { setResultados([]); return; }
    setCargando(true); setError('');
    try {
      const { resp, data } = await fetch_flexible(`/autenticacion/admin/usuarios/buscar?q=${encodeURIComponent(t)}`, { method: 'GET', headers: headersAuth });
      if (!resp.ok) throw new Error(data.error || 'Error buscando usuarios');
      setResultados(Array.isArray(data.usuarios) ? data.usuarios : []);
    } catch (e) {
      setError(e.message || 'Error al buscar usuarios');
      setResultados([]);
    } finally { setCargando(false); }
  };

  const onBusquedaChange = (e) => {
    const v = e.target.value;
    setBusqueda(v);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => buscarUsuarios(v), 300);
  };

  const manejar_seleccion_usuario = (u) => {
    setUsuarioSel(u);
    setNuevoNombre(u.nombre || u.usuario || '');
    setNuevoRol(String(u.rol || 'pendiente').toLowerCase());
    setModalAbierto(true);
    setBusqueda('');
    setResultados([]);
    setEditandoNombre(false);
    setEditandoRol(false);
  };

  const manejar_toggle_activo = async () => {
    if (!usuarioSel) return;
    const id = usuarioSel.id_usuario;
    const nuevoActivo = !usuarioSel.activo;
    const estatus = nuevoActivo ? 'activo' : 'inactivo';
    setMensaje(''); setError('');
    try {
      const { resp, data } = await fetch_flexible(`/autenticacion/admin/usuarios/${id}`, {
        method: 'PUT', headers: headersAuth, body: JSON.stringify({ estatus })
      });
      if (!resp.ok) throw new Error(data?.error || 'Error actualizando estado');
      const actualizado = data?.usuario || {};
      setUsuarioSel(prev => ({ ...prev, activo: actualizado.estatus ? actualizado.estatus === 'activo' : nuevoActivo }));
      setResultados(prev => prev.map(u => (String(u.id_usuario) === String(id) ? { ...u, activo: actualizado.estatus ? actualizado.estatus === 'activo' : nuevoActivo } : u)));
    } catch (e) {
      setError(e.message || 'Error actualizando estado');
    }
  };

  const guardar_nombre = async () => {
    if (!usuarioSel) return;
    const id = usuarioSel.id_usuario;
    setMensaje(''); setError('');
    try {
      const { resp, data } = await fetch_flexible(`/autenticacion/admin/usuarios/${id}`, {
        method: 'PUT', headers: headersAuth, body: JSON.stringify({ nombre: nuevoNombre })
      });
      if (!resp.ok) throw new Error(data?.error || 'Error guardando nombre');
      const actualizado = data?.usuario || {};
      const nombreFinal = actualizado.nombre ?? nuevoNombre;
      setUsuarioSel(prev => ({ ...prev, nombre: nombreFinal }));
      setResultados(prev => prev.map(u => (String(u.id_usuario) === String(id) ? { ...u, nombre: nombreFinal } : u)));
      setEditandoNombre(false);
      setMensaje('Nombre actualizado');
    } catch (e) {
      setError(e.message || 'Error guardando nombre');
    }
  };

  const guardar_rol = async () => {
    if (!usuarioSel) return;
    const id = usuarioSel.id_usuario;
    const rol_nuevo = String(nuevoRol || '').toLowerCase();
    setMensaje(''); setError('');
    try {
      let ok = false; let ultimoError = '';
      try {
        const { resp, data } = await fetch_flexible(`/autenticacion/admin/usuarios/${id}/rol`, {
          method: 'PUT', headers: headersAuth, body: JSON.stringify({ rol: rol_nuevo })
        });
        if (resp.ok && (data?.exito ?? true)) { ok = true; }
        else { ultimoError = data?.error || 'No se pudo asignar rol (PUT)'; }
      } catch (e) { ultimoError = e.message; }
      if (!ok) {
        try {
          const { resp, data } = await fetch_flexible('/autenticacion/admin/usuarios/asignar-rol', {
            method: 'POST', headers: headersAuth, body: JSON.stringify({ id_usuario: id, rol: rol_nuevo })
          });
          if (resp.ok && (data?.exito ?? true)) { ok = true; }
          else { ultimoError = data?.error || 'No se pudo asignar rol (POST)'; }
        } catch (e) { ultimoError = e.message; }
      }
      if (!ok) throw new Error(ultimoError || 'No se pudo actualizar el rol');
      setUsuarioSel(prev => ({ ...prev, rol: rol_nuevo }));
      setResultados(prev => prev.map(u => (String(u.id_usuario) === String(id) ? { ...u, rol: rol_nuevo } : u)));
      setEditandoRol(false);
      setMensaje('Rol actualizado');
    } catch (e) {
      setError(e.message || 'Error guardando rol');
    }
  };

  const cerrar_modal = () => {
    setModalAbierto(false);
    setUsuarioSel(null);
    setEditandoNombre(false);
    setEditandoRol(false);
  };

  // Eliminar usuario (intenta DELETE /usuarios/:id, fallback POST /usuarios/eliminar)
  const { confirmar } = useMensajesConfirmacion();

  const eliminarUsuario = async (id_usuario) => {
    if (!id_usuario) return;
    setMensaje(''); setError('');
    {
      const ok = await confirmar({
        titulo: 'Confirmar eliminación',
        mensaje: '¿Seguro que deseas eliminar este usuario? Esta acción es irreversible.',
        tipo: 'advertencia',
        texto_confirmar: 'Eliminar',
        texto_cancelar: 'Cancelar',
      });
      if (!ok) return;
    }
    try {
      setEliminandoId(id_usuario);
      let ok = false;
      let ultimoError = '';
      // Intento 1: DELETE admin/usuarios/:id (con y sin /api)
      try {
        const { resp, data } = await fetch_flexible(`/autenticacion/admin/usuarios/${id_usuario}`, { method: 'DELETE', headers: headersAuth });
        if (resp.ok) {
          ok = true;
        } else {
          ultimoError = data?.error || 'No se pudo eliminar (DELETE usuarios/:id)';
        }
      } catch (e) { ultimoError = e.message; }

      // Intento 2: POST admin/usuarios/eliminar { id_usuario }
      if (!ok) {
        try {
          const { resp, data } = await fetch_flexible('/autenticacion/admin/usuarios/eliminar', { method: 'POST', headers: headersAuth, body: JSON.stringify({ id_usuario }) });
          if (resp.ok && (data?.exito ?? true)) {
            ok = true;
          } else {
            ultimoError = data?.error || 'No se pudo eliminar (POST usuarios/eliminar)';
          }
        } catch (e) { ultimoError = e.message; }
      }

      // Intento 3: POST admin/usuario/eliminar { id_usuario }
      if (!ok) {
        try {
          const { resp, data } = await fetch_flexible('/autenticacion/admin/usuario/eliminar', { method: 'POST', headers: headersAuth, body: JSON.stringify({ id_usuario }) });
          if (resp.ok && (data?.exito ?? true)) {
            ok = true;
          } else {
            ultimoError = data?.error || 'No se pudo eliminar (POST usuario/eliminar)';
          }
        } catch (e) { ultimoError = e.message; }
      }

      // Intento 4: DELETE autenticacion/usuarios/:id (sin admin)
      if (!ok) {
        try {
          const { resp, data } = await fetch_flexible(`/autenticacion/usuarios/${id_usuario}`, { method: 'DELETE', headers: headersAuth });
          if (resp.ok) {
            ok = true;
          } else {
            ultimoError = data?.error || 'No se pudo eliminar (DELETE autenticacion/usuarios/:id)';
          }
        } catch (e) { ultimoError = e.message; }
      }

      // Intento 5: POST autenticacion/usuarios/eliminar { id_usuario }
      if (!ok) {
        try {
          const { resp, data } = await fetch_flexible('/autenticacion/usuarios/eliminar', { method: 'POST', headers: headersAuth, body: JSON.stringify({ id_usuario }) });
          if (resp.ok && (data?.exito ?? true)) {
            ok = true;
          } else {
            ultimoError = data?.error || 'No se pudo eliminar (POST autenticacion/usuarios/eliminar)';
          }
        } catch (e) { ultimoError = e.message; }
      }

      if (!ok) throw new Error(ultimoError || 'Ruta no encontrada para eliminar usuario');

      setResultados(prev => prev.filter(u => String(u.id_usuario) !== String(id_usuario)));
      if (usuarioSel?.id_usuario === id_usuario) setUsuarioSel(null);
      setMensaje('Usuario eliminado correctamente');
    } catch (e) {
      setError(e.message || 'Error al eliminar usuario');
    } finally {
      setEliminandoId(null);
    }
  };

  

  return (
    <div className="py-12 px-4">
      <div className="mx-auto">
        <div className="relative max-w-screen-xl mx-auto">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={busqueda}
              onChange={onBusquedaChange}
              placeholder="Buscar usuarios por nombre o usuario..."
              className="w-full pl-10 pr-4 py-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-lg transition-all duration-200"
            />
          </div>

          {resultados.length > 0 && (
            <div className="absolute z-10 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
              {resultados.slice(0, 3).map((u) => (
                <div
                  key={u.id_usuario}
                  onClick={() => manejar_seleccion_usuario(u)}
                  className="p-4 hover:bg-blue-50 cursor-pointer transition-colors duration-150 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{u.nombre || u.usuario}</p>
                      <p className="text-sm text-gray-500 truncate">@{u.usuario}</p>
                      <div className="flex items-center mt-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          u.rol === 'administrador' ? 'bg-purple-100 text-purple-800' :
                          u.rol === 'moderador' ? 'bg-green-100 text-green-800' :
                          u.rol === 'admin' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {etiqueta_rol(u.rol)}
                        </span>
                        <span className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          u.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {modalAbierto && usuarioSel && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Gestionar Usuario</h2>
                <button onClick={cerrar_modal} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <User className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    {editandoNombre ? (
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={nuevoNombre}
                          onChange={(e) => setNuevoNombre(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          autoFocus
                        />
                        <button
                          onClick={guardar_nombre}
                          className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
                        >
                          Guardar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-semibold text-gray-800">{usuarioSel.nombre || usuarioSel.usuario}</h3>
                        <button onClick={() => setEditandoNombre(true)} className="text-blue-500 hover:text-blue-700 transition-colors">
                          <Edit3 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <p className="text-gray-600 text-sm mb-2">@{usuarioSel.usuario}</p>
                <div className="flex items-center space-x-3">
                  {editandoRol ? (
                    <div className="flex space-x-2">
                      <select
                        value={nuevoRol}
                        onChange={(e) => setNuevoRol(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        {[...new Set([String(usuarioSel.rol || 'pendiente').toLowerCase(), ...rolesDisponibles])].map(r => (
                          <option key={r} value={r}>{etiqueta_rol(r)}</option>
                        ))}
                      </select>
                      <button
                        onClick={guardar_rol}
                        className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
                      >
                        Guardar
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        usuarioSel.rol === 'administrador' || usuarioSel.rol === 'admin' ? 'bg-purple-100 text-purple-800' :
                        usuarioSel.rol === 'moderador' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        <Shield className="h-4 w-4 mr-1" />
                        {etiqueta_rol(usuarioSel.rol)}
                      </span>
                      <button onClick={() => setEditandoRol(true)} className="text-blue-500 hover:text-blue-700 transition-colors">
                        <Edit3 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    usuarioSel.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {usuarioSel.activo ? 'Activo' : 'Inactivo'}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={manejar_toggle_activo}
                  className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                    usuarioSel.activo
                      ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                      : 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200'
                  }`}
                >
                  {usuarioSel.activo ? (
                    <>
                      <ToggleLeft className="h-5 w-5" />
                      <span>Desactivar Usuario</span>
                    </>
                  ) : (
                    <>
                      <ToggleRight className="h-5 w-5" />
                      <span>Activar Usuario</span>
                    </>
                  )}
                </button>

                {!editandoNombre && (
                  <button onClick={() => setEditandoNombre(true)} className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-white border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    <Edit3 className="h-5 w-5" />
                    <span>Cambiar Nombre</span>
                  </button>
                )}

                {!editandoRol && (
                  <button onClick={() => setEditandoRol(true)} className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-white border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    <Shield className="h-5 w-5" />
                    <span>Cambiar Rol</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GestionarUsuarios;
