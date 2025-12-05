import { useEffect, useMemo, useState } from 'react';
import { FiRefreshCw, FiPlus, FiSearch, FiAlertTriangle, FiCheckCircle, FiFileText, FiUpload, FiEdit, FiTrash2 } from 'react-icons/fi';
import { FaExclamationTriangle } from 'react-icons/fa';
import { useInicioSesion } from '../../pagina_inicial/inicio_sesion/contexto/inicio_sesion-Context';
import { useMensajesConfirmacion } from '../../utilidades/comunes/mensajes_confirmacion.jsx';
import { useControlNotificaciones } from '../administrador/administrador_notificaciones.jsx';

const ComunicadosAdmin = () => {
  const { token } = useInicioSesion();
  const { procesar_evento, rol_actual } = useControlNotificaciones();
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
  const a_url_relativa = (url) => {
    try { const u = String(url || '').trim(); if (!u) return ''; if (/^https?:\/\//.test(u)) { const obj = new URL(u); const origen = `${obj.protocol}//${obj.hostname}${obj.port ? ':' + obj.port : ''}`; if (origen === ORIGEN_BACKEND) return obj.pathname || '/'; return u; } return u.startsWith('/') ? u : `/${u}`; } catch (_) { return String(url || ''); }
  };
  const headersAuth = token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };

  // Estados principales
  const [comunicados, setComunicados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [subiendo_adjunto, setSubiendoAdjunto] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [filtro, setFiltro] = useState('');

  // Estados de formulario
  const [modo_edicion, setModoEdicion] = useState(false);
  const [comunicado_actual, setComunicadoActual] = useState(null);
  const [adjunto_pendiente, setAdjuntoPendiente] = useState(null);
  const [adjunto_preview_nombre, setAdjuntoPreviewNombre] = useState('');
  const [adjunto_url_pre_subido, setAdjuntoUrlPreSubido] = useState('');

  // Modelo del comunicado en snake_case
  const modelo_comunicado = {
    id_comunicado: null,
    titulo: '',
    fecha: '',
    categoria: 'sistema',
    prioridad: 'baja',
    resumen: '',
    contenido: '',
    autor: '',
    imagen: '',
    adjunto_url: '',
    adjunto_nombre: '',
    adjunto_tipo: '',
    adjunto_tamano: 0,
    activo: true
  };

  const generar_id = () => `com_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // Categorías disponibles
  const categorias = [
    { id: 'sistema', nombre: 'Sistema', icono: '⚙️' },
    { id: 'mantenimiento', nombre: 'Mantenimiento', icono: '🔧' },
    { id: 'seguridad', nombre: 'Seguridad', icono: '🔒' },
    { id: 'capacitacion', nombre: 'Capacitación', icono: '🎓' },
    { id: 'actualizacion', nombre: 'Actualización', icono: '🔄' },
    { id: 'anuncio', nombre: 'Anuncio', icono: '📢' }
  ];

  // Prioridades disponibles
  const prioridades = [
    { id: 'baja', nombre: 'Baja', color: 'bg-green-100 text-green-800', icono: '✅' },
    { id: 'media', nombre: 'Media', color: 'bg-yellow-100 text-yellow-800', icono: '⚠️' },
    { id: 'alta', nombre: 'Alta', color: 'bg-red-100 text-red-800', icono: '🚨' }
  ];

  const cargar_listado = async () => {
    setCargando(true);
    setError('');
    try {
      const resp = await fetch(`${API_URL}/comunicados/publicaciones`, { 
        headers: { Authorization: token ? `Bearer ${token}` : '' } 
      });
      const data = await resp.json();
      if (resp.ok && data?.exito && Array.isArray(data.comunicados)) {
        setComunicados(data.comunicados);
      } else {
        setError(data?.error || 'No se pudo obtener el listado de comunicados');
        setComunicados([]);
      }
    } catch (e) {
      setError('Error de conexión al cargar listado de comunicados');
      setComunicados([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (token) cargar_listado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const handler = () => {
      if (adjunto_url_pre_subido) {
        const rel = a_url_relativa(adjunto_url_pre_subido);
        try { fetch(`${API_URL}/archivos/eliminar?url=${encodeURIComponent(rel)}`, { method: 'DELETE', keepalive: true, headers: token ? { Authorization: `Bearer ${token}` } : {} }); } catch (_) {}
      }
    };
    if (typeof window !== 'undefined') window.addEventListener('beforeunload', handler);
    return () => { if (typeof window !== 'undefined') window.removeEventListener('beforeunload', handler); };
  }, [adjunto_url_pre_subido, API_URL, token]);

  // Operaciones contra API
  const api_crear_comunicado = async (com) => {
    const resp = await fetch(`${API_URL}/comunicados/publicaciones`, {
      method: 'POST',
      headers: headersAuth,
      body: JSON.stringify({ ...com, adjunto_url: com.adjunto_url ? a_url_relativa(com.adjunto_url) : '' })
    });
    const data = await resp.json();
    if (!resp.ok || !data?.exito) throw new Error(data?.error || 'Error creando comunicado');
    try { procesar_evento({ seccion: 'comunicados', accion: 'publicar_comunicado', rol_origen: rol_actual, datos: { usuario: (com?.autor || ''), rol: rol_actual } }); } catch (_) {}
    return data.comunicado;
  };

  const api_actualizar_comunicado = async (id_comunicado, com) => {
    const resp = await fetch(`${API_URL}/comunicados/publicaciones/${id_comunicado}`, {
      method: 'PUT',
      headers: headersAuth,
      body: JSON.stringify({ ...com, adjunto_url: com.adjunto_url ? a_url_relativa(com.adjunto_url) : '' })
    });
    const data = await resp.json();
    if (!resp.ok || !data?.exito) throw new Error(data?.error || 'Error actualizando comunicado');
    try { procesar_evento({ seccion: 'comunicados', accion: 'actualizar_comunicado', rol_origen: rol_actual, datos: { usuario: (com?.autor || ''), rol: rol_actual } }); } catch (_) {}
    return data.comunicado;
  };

  const api_eliminar_comunicado = async (id_comunicado) => {
    const resp = await fetch(`${API_URL}/comunicados/publicaciones/${id_comunicado}`, { 
      method: 'DELETE', 
      headers: { Authorization: token ? `Bearer ${token}` : '' } 
    });
    const data = await resp.json();
    if (!resp.ok || !data?.exito) throw new Error(data?.error || 'Error eliminando comunicado');
    try { procesar_evento({ seccion: 'comunicados', accion: 'eliminar_comunicado', rol_origen: rol_actual }); } catch (_) {}
    return true;
  };

  const subir_adjunto_api = async (file) => {
    try {
      const fd = new FormData();
      fd.append('destino', 'pantalla_inicial/comunicados');
      fd.append('archivo', file);
      const headersUpload = token ? { Authorization: `Bearer ${token}` } : undefined;
      const resp = await fetch(`${API_URL}/archivos/subir?destino=pantalla_inicial/comunicados`, { method: 'POST', headers: headersUpload, body: fd, credentials: 'include' });
      const data = await resp.json();
      if (!resp.ok || !data?.exito || !data?.url_publica) throw new Error(data?.error || 'No se pudo subir el adjunto');
      return data;
    } catch (e) {
      setError(e.message || 'Error subiendo adjunto');
      return null;
    }
  };

  const eliminar_archivo_api = async (url) => {
    try {
      const rel = a_url_relativa(url);
      const resp = await fetch(`${API_URL}/archivos/eliminar?url=${encodeURIComponent(rel)}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      return resp.ok;
    } catch (_) { return false; }
  };

  const manejar_subir_adjunto = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !comunicado_actual) return;
    setAdjuntoPreviewNombre(file.name || 'archivo');
    if (file.size > 40 * 1024 * 1024) {
      setError('El adjunto excede el límite de 40MB');
      e.target.value = '';
      return;
    }
    setSubiendoAdjunto(true);
    if (adjunto_url_pre_subido) {
      try { await eliminar_archivo_api(adjunto_url_pre_subido); } catch (_) {}
      setAdjuntoUrlPreSubido('');
    }
    const subido = await subir_adjunto_api(file);
    setSubiendoAdjunto(false);
    if (subido && subido.url_publica) {
      setComunicadoActual({
        ...comunicado_actual,
        adjunto_url: a_url_absoluta(subido.url_publica),
        adjunto_nombre: subido.nombre || file.name,
        adjunto_tipo: subido.tipo || file.type,
        adjunto_tamano: subido.tamano || file.size
      });
      setAdjuntoPendiente(null);
      setAdjuntoUrlPreSubido(subido.url_publica);
      setMensaje('Adjunto cargado y listo para guardar');
      setTimeout(() => setMensaje(''), 2000);
    } else {
      setAdjuntoPendiente(file);
      setMensaje('No se pudo cargar; se guardará sin adjunto');
      setTimeout(() => setMensaje(''), 2000);
    }
    e.target.value = '';
  };

  const comunicados_filtrados = useMemo(() => {
    const q = filtro.toLowerCase().trim();
    const base = Array.isArray(comunicados) ? comunicados.slice() : [];
    return q
      ? base.filter(com =>
          String(com.titulo || '').toLowerCase().includes(q) ||
          String(com.resumen || '').toLowerCase().includes(q) ||
          String(com.autor || '').toLowerCase().includes(q)
        )
      : base;
  }, [comunicados, filtro]);

  const validar_comunicado = (com) => {
    if (!com.titulo || !com.resumen || !com.autor) {
      return 'Ingrese al menos título, resumen y autor';
    }
    if (!com.fecha) {
      return 'Ingrese la fecha del comunicado';
    }
    return '';
  };

  const abrir_formulario_nuevo = () => {
    setModoEdicion(false);
    setComunicadoActual({ ...modelo_comunicado, id_comunicado: generar_id() });
    setAdjuntoPendiente(null);
    setAdjuntoPreviewNombre('');
  };

  const abrir_formulario_editar = (com) => {
    setModoEdicion(true);
    setComunicadoActual({ ...com });
    setAdjuntoPendiente(null);
    setAdjuntoPreviewNombre('');
  };

  const cancelar_formulario = async () => {
    setComunicadoActual(null);
    setModoEdicion(false);
    setError('');
    setAdjuntoPendiente(null);
    setAdjuntoPreviewNombre('');
    if (adjunto_url_pre_subido) {
      try { await eliminar_archivo_api(adjunto_url_pre_subido); } catch (_) {}
      setAdjuntoUrlPreSubido('');
    }
  };

  const confirmar_formulario = async () => {
    if (!comunicado_actual) return;
    setError('');
    
    const err = validar_comunicado(comunicado_actual);
    if (err) {
      setError(err);
      return;
    }
    
    if (adjunto_pendiente) {
      if (adjunto_pendiente.size > 40 * 1024 * 1024) {
        setError('El adjunto excede el límite de 40MB');
        return;
      }
      setSubiendoAdjunto(true);
      const subido = await subir_adjunto_api(adjunto_pendiente);
      setSubiendoAdjunto(false);
      if (!subido) return;
      setComunicadoActual({
        ...comunicado_actual,
        adjunto_url: a_url_absoluta(subido.url_publica),
        adjunto_nombre: subido.nombre || adjunto_pendiente.name,
        adjunto_tipo: subido.tipo || adjunto_pendiente.type,
        adjunto_tamano: subido.tamano || adjunto_pendiente.size
      });
    }

    setGuardando(true);
    try {
      if (modo_edicion) {
        const actualizado = await api_actualizar_comunicado(comunicado_actual.id_comunicado, adjunto_pendiente ? { ...comunicado_actual, adjunto_url: a_url_relativa(comunicado_actual.adjunto_url) } : comunicado_actual);
        const nuevos = comunicados.map(com => (com.id_comunicado === actualizado.id_comunicado ? { ...actualizado } : com));
        setComunicados(nuevos);
        setMensaje('Comunicado actualizado exitosamente');
      } else {
        const creado = await api_crear_comunicado(adjunto_pendiente ? { ...comunicado_actual, adjunto_url: a_url_relativa(comunicado_actual.adjunto_url) } : comunicado_actual);
        const nuevos = [...comunicados, creado];
        setComunicados(nuevos);
        setMensaje('Comunicado creado exitosamente');
      }
      setComunicadoActual(null);
      setModoEdicion(false);
      setAdjuntoPendiente(null);
      setAdjuntoPreviewNombre('');
      setAdjuntoUrlPreSubido('');
    } catch (e) {
      setError(e.message || 'No se pudo guardar el comunicado');
    } finally {
      setGuardando(false);
    }
  };

  const { confirmar } = useMensajesConfirmacion();

  const eliminar_comunicado = async (id_comunicado) => {
    const ok = await confirmar({
      titulo: 'Confirmar eliminación',
      mensaje: '¿Eliminar este comunicado? Esta acción no se puede deshacer.',
      tipo: 'advertencia',
      texto_confirmar: 'Eliminar',
      texto_cancelar: 'Cancelar',
    });
    if (!ok) return;
    
    try {
      await api_eliminar_comunicado(id_comunicado);
      const restantes = comunicados.filter(com => com.id_comunicado !== id_comunicado);
      setComunicados(restantes);
      setMensaje('Comunicado eliminado exitosamente');
    } catch (e) {
      setError(e.message || 'No se pudo eliminar el comunicado');
    }
  };

  const alternar_activo = async (id_comunicado) => {
    try {
      const actual = comunicados.find(com => com.id_comunicado === id_comunicado);
      if (!actual) return;
      const ok = await confirmar({
        titulo: 'Confirmar cambio de estado',
        mensaje: `¿Desea ${actual.activo ? 'desactivar' : 'activar'} este comunicado?`,
        tipo: 'informacion',
        texto_confirmar: 'Continuar',
        texto_cancelar: 'Cancelar',
      });
      if (!ok) return;
      const actualizado = await api_actualizar_comunicado(id_comunicado, { ...actual, activo: !actual.activo });
      const nuevos = comunicados.map(com => (com.id_comunicado === id_comunicado ? { ...actualizado } : com));
      setComunicados(nuevos);
    } catch (e) {
      setError(e.message || 'No se pudo actualizar el estado');
    }
  };

  const obtener_clases_prioridad = (prioridad) => {
    switch (prioridad) {
      case 'alta': return 'bg-red-100 text-red-800';
      case 'media': return 'bg-yellow-100 text-yellow-800';
      case 'baja': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const obtener_clases_categoria = (categoria) => {
    switch (categoria) {
      case 'seguridad': return 'bg-red-100 text-red-800';
      case 'mantenimiento': return 'bg-blue-100 text-blue-800';
      case 'sistema': return 'bg-purple-100 text-purple-800';
      case 'capacitacion': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const obtener_icono_categoria = (categoria) => {
    const cat = categorias.find(c => c.id === categoria);
    return cat ? cat.icono : '📢';
  };

  const obtener_icono_prioridad = (prioridad) => {
    const pri = prioridades.find(p => p.id === prioridad);
    return pri ? pri.icono : '📌';
  };

  return (
    <div className="mx-auto py-6 px-10">
      {/* Barra de acciones */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={cargar_listado}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
            title="Actualizar listado"
          >
            <FiRefreshCw size={18} />
            <span className="font-medium">Actualizar</span>
          </button>
          <button
            onClick={abrir_formulario_nuevo}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 transition-all duration-200 shadow-sm hover:shadow-md"
            title="Agregar nuevo comunicado"
          >
            <FiPlus size={18} />
            <span className="font-medium">Nuevo comunicado</span>
          </button>
        </div>

        <div className="relative w-full max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por título, resumen o autor"
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

      {mensaje && (
        <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-green-700">
          <div className="flex items-center">
            <FiCheckCircle className="mr-2" />
            {mensaje}
          </div>
        </div>
      )}

      {/* Formulario de creación/edición */}
      {comunicado_actual && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              {modo_edicion ? 'Editar comunicado' : 'Nuevo comunicado'}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={confirmar_formulario}
                disabled={guardando || subiendo_adjunto}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm hover:shadow-md"
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                onClick={cancelar_formulario}
                className="px-4 py-2.5 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 transition-colors font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
              <input
                type="text"
                value={comunicado_actual.titulo}
                onChange={(e) => setComunicadoActual({ ...comunicado_actual, titulo: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej. Actualización Mayor del Sistema SIGECOF v1.1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha *</label>
              <input
                type="date"
                value={comunicado_actual.fecha}
                onChange={(e) => setComunicadoActual({ ...comunicado_actual, fecha: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <select
                value={comunicado_actual.categoria}
                onChange={(e) => setComunicadoActual({ ...comunicado_actual, categoria: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {categorias.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icono} {cat.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
              <select
                value={comunicado_actual.prioridad}
                onChange={(e) => setComunicadoActual({ ...comunicado_actual, prioridad: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {prioridades.map(pri => (
                  <option key={pri.id} value={pri.id}>{pri.icono} {pri.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Autor *</label>
              <input
                type="text"
                value={comunicado_actual.autor}
                onChange={(e) => setComunicadoActual({ ...comunicado_actual, autor: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej. Equipo de Desarrollo SIGECOF"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Imagen (URL opcional)</label>
              <input
                type="url"
                value={comunicado_actual.imagen}
                onChange={(e) => setComunicadoActual({ ...comunicado_actual, imagen: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://ejemplo.com/imagen.jpg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Documento adjunto</label>
          <input
            type="file"
            accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.zip,.png,.jpg,.jpeg"
            onChange={manejar_subir_adjunto}
            className="w-full text-sm border rounded-lg px-3 py-2 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {(adjunto_pendiente || adjunto_url_pre_subido || comunicado_actual?.adjunto_url) && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-700">
              <FiFileText className="text-gray-600" />
              <span className="font-medium">{adjunto_pendiente ? adjunto_preview_nombre : (comunicado_actual.adjunto_nombre || adjunto_preview_nombre)}</span>
              {!adjunto_pendiente && (adjunto_url_pre_subido || comunicado_actual?.adjunto_url) && (
                <a href={a_url_absoluta(adjunto_url_pre_subido || comunicado_actual.adjunto_url)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">Ver adjuntado</a>
              )}
              <button
                type="button"
                onClick={async () => {
                  if (adjunto_url_pre_subido) { try { await eliminar_archivo_api(adjunto_url_pre_subido); } catch (_) {} setAdjuntoUrlPreSubido(''); }
                  setAdjuntoPendiente(null);
                  setAdjuntoPreviewNombre('');
                  setComunicadoActual({ ...comunicado_actual, adjunto_url: '', adjunto_nombre: '', adjunto_tipo: '', adjunto_tamano: 0 });
                }}
                className="px-2 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Quitar
              </button>
            </div>
          )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Resumen *</label>
              <textarea
                value={comunicado_actual.resumen}
                onChange={(e) => setComunicadoActual({ ...comunicado_actual, resumen: e.target.value })}
                rows={3}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Breve descripción del comunicado..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Contenido Detallado</label>
              <textarea
                value={comunicado_actual.contenido}
                onChange={(e) => setComunicadoActual({ ...comunicado_actual, contenido: e.target.value })}
                rows={6}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Contenido HTML del comunicado..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Activo</label>
              <div>
                <input
                  type="checkbox"
                  checked={comunicado_actual.activo}
                  onChange={(e) => setComunicadoActual({ ...comunicado_actual, activo: e.target.checked })}
                />
                <span className="ml-2 text-sm text-gray-700">Mostrar en la sección pública</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Listado de comunicados */}
      {cargando ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : comunicados_filtrados.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
          <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <FaExclamationTriangle className="w-10 h-10 text-gray-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Sin comunicados</h3>
          <p className="text-gray-600 max-w-md mx-auto">Agrega comunicados para mostrarlos en la sección pública.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Comunicado</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Categoría</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Prioridad</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Fecha</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Estado</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Documento</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {comunicados_filtrados.map((com) => (
                  <tr key={com.id_comunicado} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-800 font-medium">
                      <div>
                        <div className="font-semibold">{com.titulo}</div>
                        {com.resumen && (
                          <div className="text-gray-500 text-xs mt-1 max-w-md truncate">{com.resumen}</div>
                        )}
                        {com.autor && (
                          <div className="text-gray-400 text-xs mt-1">Por: {com.autor}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${obtener_clases_categoria(com.categoria)}`}>
                        {obtener_icono_categoria(com.categoria)} {com.categoria}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${obtener_clases_prioridad(com.prioridad)}`}>
                        {obtener_icono_prioridad(com.prioridad)} {com.prioridad}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-700 text-sm">
                      {com.fecha ? new Date(com.fecha).toLocaleDateString('es-ES') : '-'}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => alternar_activo(com.id_comunicado)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${com.activo ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        {com.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      {com.adjunto_url ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => window.open(a_url_absoluta(com.adjunto_url), '_blank')}
                            className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors duration-200 shadow-sm hover:shadow"
                            title="Ver documento"
                          >
                            <FiFileText size={18} />
                          </button>
                          <button
                            onClick={async () => {
                              const actualizado = await api_actualizar_comunicado(com.id_comunicado, { ...com, adjunto_url: '' , adjunto_nombre: '', adjunto_tipo: '', adjunto_tamano: 0 });
                              setComunicados(comunicados.map(c => c.id_comunicado === actualizado.id_comunicado ? actualizado : c));
                            }}
                            className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors duration-200 shadow-sm hover:shadow"
                            title="Eliminar documento"
                          >
                            <FiTrash2 size={18} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => abrir_formulario_editar(com)}
                          className="px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 hover:bg-blue-200 text-sm font-medium"
                          title="Agregar documento"
                        >
                          <span className="inline-flex items-center gap-2">
                            <FiUpload size={16} />
                            Agregar Documento
                          </span>
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => abrir_formulario_editar(com)}
                          className="p-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors duration-200 shadow-sm hover:shadow"
                          title="Editar"
                        >
                          <FiEdit size={18} />
                        </button>
                        <button
                          onClick={() => eliminar_comunicado(com.id_comunicado)}
                          className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors duration-200 shadow-sm hover:shadow"
                          title="Eliminar"
                        >
                          <FiTrash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComunicadosAdmin;
