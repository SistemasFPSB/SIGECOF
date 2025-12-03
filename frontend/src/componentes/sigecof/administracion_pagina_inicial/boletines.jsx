import React, { useEffect, useMemo, useState } from 'react';
import { FiRefreshCw, FiPlus, FiEdit, FiTrash2, FiSearch, FiAlertTriangle, FiCheckCircle, FiFileText } from 'react-icons/fi';
import { FaFilePdf, FaFileImage, FaFileArchive } from "react-icons/fa";
import { useInicioSesion } from '../../pagina_inicial/inicio_sesion/contexto/inicio_sesion-Context';
import { useMensajesConfirmacion } from '../../utilidades/comunes/mensajes_confirmacion.jsx';
import { useControlNotificaciones } from '../administrador/administrador_notificaciones.jsx';

const BoletinesAdmin = () => {
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
  const [boletines, setBoletines] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [filtro, setFiltro] = useState('');

  // Estados de formulario
  const [modo_edicion, setModoEdicion] = useState(false);
  const [boletin_actual, setBoletinActual] = useState(null);
  const [archivo_pendiente, setArchivoPendiente] = useState(null);
  const [archivo_preview_nombre, setArchivoPreviewNombre] = useState('');
  const [archivo_url_pre_subido, setArchivoUrlPreSubido] = useState('');

  // Modelo del boletín en snake_case
  const modelo_boletin = {
    id_boletin: null,
    titulo: '',
    numero_boletin: '',
    fecha_publicacion: '',
    fecha_vigencia: '',
    categoria: 'general',
    tipo: 'informativo',
    resumen: '',
    contenido: '',
    autor: '',
    archivo_url: '',
    archivo_nombre: '',
    archivo_tipo: '',
    tamano_archivo: 0,
    etiquetas: '',
    estado: 'borrador',
    activo: true
  };

  const generar_id = () => `bol_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // Categorías disponibles
  const categorias = [
    { id: 'general', nombre: 'General', color: 'bg-blue-100 text-blue-800', icono: '📰' },
    { id: 'financiero', nombre: 'Financiero', color: 'bg-green-100 text-green-800', icono: '💰' },
    { id: 'administrativo', nombre: 'Administrativo', color: 'bg-purple-100 text-purple-800', icono: '🗂️' },
    { id: 'tecnico', nombre: 'Técnico', color: 'bg-orange-100 text-orange-800', icono: '🛠️' },
    { id: 'legal', nombre: 'Legal', color: 'bg-red-100 text-red-800', icono: '⚖️' }
  ];

  // Tipos de boletín
  const tipos_boletin = [
    { id: 'informativo', nombre: 'Informativo', icono: 'ℹ️' },
    { id: 'urgente', nombre: 'Urgente', icono: '🚨' },
    { id: 'mensual', nombre: 'Mensual', icono: '🗓️' },
    { id: 'trimestral', nombre: 'Trimestral', icono: '📅' },
    { id: 'anual', nombre: 'Anual', icono: '📆' }
  ];

  // Estados de boletín
  const estados_boletin = [
    { id: 'borrador', nombre: 'Borrador', color: 'bg-gray-100 text-gray-800', icono: '📝' },
    { id: 'revision', nombre: 'En Revisión', color: 'bg-yellow-100 text-yellow-800', icono: '🔍' },
    { id: 'aprobado', nombre: 'Aprobado', color: 'bg-blue-100 text-blue-800', icono: '✅' },
    { id: 'publicado', nombre: 'Publicado', color: 'bg-green-100 text-green-800', icono: '📢' },
    { id: 'archivado', nombre: 'Archivado', color: 'bg-red-100 text-red-800', icono: '🗄️' }
  ];

  // Funciones de API
  const api_obtener_boletines = async () => {
    try {
      const resp = await fetch(`${API_URL}/boletines`, {
        method: 'GET',
        headers: headersAuth
      });
      const data = await resp.json();
      if (!resp.ok || !data?.exito) throw new Error(data?.error || 'Error obteniendo boletines');
      return data.boletines;
    } catch (err) {
      throw new Error(err.message || 'Error de conexión');
    }
  };

  const api_crear_boletin = async (boletin) => {
    try {
      const payload = {
        ...boletin,
        archivo_url: boletin.archivo_url ? a_url_relativa(boletin.archivo_url) : '',
        fecha_publicacion: boletin.fecha_publicacion && String(boletin.fecha_publicacion).trim() ? boletin.fecha_publicacion : null,
        fecha_vigencia: boletin.fecha_vigencia && String(boletin.fecha_vigencia).trim() ? boletin.fecha_vigencia : null
      };
      const resp = await fetch(`${API_URL}/boletines`, {
        method: 'POST',
        headers: headersAuth,
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (!resp.ok || !data?.exito) throw new Error(data?.error || 'Error creando boletín');
      try { procesar_evento({ seccion: 'boletines', accion: 'publicar_boletin', rol_origen: rol_actual, datos: { usuario: (boletin?.autor || ''), rol: rol_actual } }); } catch (_) {}
      return data.boletin;
    } catch (err) {
      throw new Error(err.message || 'Error de conexión');
    }
  };

  const api_actualizar_boletin = async (id, boletin) => {
    try {
      const payload = {
        ...boletin,
        archivo_url: boletin.archivo_url ? a_url_relativa(boletin.archivo_url) : '',
        fecha_publicacion: boletin.fecha_publicacion && String(boletin.fecha_publicacion).trim() ? boletin.fecha_publicacion : null,
        fecha_vigencia: boletin.fecha_vigencia && String(boletin.fecha_vigencia).trim() ? boletin.fecha_vigencia : null
      };
      const resp = await fetch(`${API_URL}/boletines/${id}`, {
        method: 'PUT',
        headers: headersAuth,
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (!resp.ok || !data?.exito) throw new Error(data?.error || 'Error actualizando boletín');
      try { procesar_evento({ seccion: 'boletines', accion: 'actualizar_boletin', rol_origen: rol_actual, datos: { usuario: (boletin?.autor || ''), rol: rol_actual } }); } catch (_) {}
      return data.boletin;
    } catch (err) {
      throw new Error(err.message || 'Error de conexión');
    }
  };

  const api_eliminar_boletin = async (id) => {
    try {
      const resp = await fetch(`${API_URL}/boletines/${id}`, {
        method: 'DELETE',
        headers: headersAuth
      });
      const data = await resp.json();
      if (!resp.ok || !data?.exito) throw new Error(data?.error || 'Error eliminando boletín');
      try { procesar_evento({ seccion: 'boletines', accion: 'eliminar_boletin', rol_origen: rol_actual }); } catch (_) {}
      return true;
    } catch (err) {
      throw new Error(err.message || 'Error de conexión');
    }
  };

  const subir_archivo_api = async (file) => {
    try {
      const fd = new FormData();
      fd.append('destino', 'pantalla_inicial/boletines');
      fd.append('archivo', file);
      const headersUpload = token ? { Authorization: `Bearer ${token}` } : undefined;
      const resp = await fetch(`${API_URL}/archivos/subir?destino=pantalla_inicial/boletines`, { method: 'POST', headers: headersUpload, body: fd, credentials: 'include' });
      const data = await resp.json();
      if (!resp.ok || !data?.exito || !data?.url_publica) throw new Error(data?.error || 'No se pudo subir el archivo');
      return data;
    } catch (e) {
      setError(e.message || 'Error subiendo archivo');
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

  const manejar_subir_archivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !boletin_actual) return;
    setArchivoPreviewNombre(file.name || 'archivo');
    if (file.size > 40 * 1024 * 1024) {
      setError('El archivo excede el límite de 40MB');
      e.target.value = '';
      return;
    }
    setSubiendo(true);
    if (archivo_url_pre_subido) {
      try { await eliminar_archivo_api(archivo_url_pre_subido); } catch (_) {}
      setArchivoUrlPreSubido('');
    }
    const subido = await subir_archivo_api(file);
    setSubiendo(false);
    if (subido && subido.url_publica) {
      setBoletinActual({
        ...boletin_actual,
        archivo_url: a_url_absoluta(subido.url_publica),
        archivo_nombre: subido.nombre || file.name,
        archivo_tipo: subido.tipo || file.type,
        tamano_archivo: subido.tamano || file.size
      });
      setArchivoPendiente(null);
      setArchivoUrlPreSubido(subido.url_publica);
      setMensaje('Archivo cargado y listo para guardar');
      setTimeout(() => setMensaje(''), 2000);
    } else {
      setArchivoPendiente(file);
      setMensaje('No se pudo cargar; se guardará sin adjunto');
      setTimeout(() => setMensaje(''), 2000);
    }
    e.target.value = '';
  };

  // Funciones de manejo de estado
  const cargar_boletines = async () => {
    setCargando(true);
    setError('');
    try {
      const data = await api_obtener_boletines();
      setBoletines(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const manejar_envio = async (e) => {
    e.preventDefault();
    if (!boletin_actual?.titulo?.trim()) {
      setError('El título es requerido');
      return;
    }
    if (!boletin_actual?.numero_boletin?.trim()) {
      setError('El número de boletín es requerido');
      return;
    }
    if (!boletin_actual?.fecha_publicacion) {
      setError('La fecha de publicación es requerida');
      return;
    }

    // Subida diferida: si hay archivo pendiente, subir primero
    if (archivo_pendiente) {
      if (archivo_pendiente.size > 40 * 1024 * 1024) {
        setError('El archivo excede el límite de 40MB');
        return;
      }
      setSubiendo(true);
      const subido = await subir_archivo_api(archivo_pendiente);
      setSubiendo(false);
      if (!subido) return;
      setBoletinActual({
        ...boletin_actual,
        archivo_url: a_url_absoluta(subido.url_publica),
        archivo_nombre: subido.nombre || archivo_pendiente.name,
        archivo_tipo: subido.tipo || archivo_pendiente.type,
        tamano_archivo: subido.tamano || archivo_pendiente.size
      });
    }

    setGuardando(true);
    setError('');
    try {
      let resultado;
      if (modo_edicion) {
        resultado = await api_actualizar_boletin(boletin_actual.id_boletin, archivo_pendiente ? { ...boletin_actual, archivo_url: a_url_relativa(boletin_actual.archivo_url) } : boletin_actual);
      } else {
        const nuevo_boletin = { ...boletin_actual, id_boletin: generar_id() };
        resultado = await api_crear_boletin(archivo_pendiente ? { ...nuevo_boletin, archivo_url: a_url_relativa(nuevo_boletin.archivo_url) } : nuevo_boletin);
      }
      
      await cargar_boletines();
      setMensaje(modo_edicion ? 'Boletín actualizado exitosamente' : 'Boletín creado exitosamente');
      setTimeout(() => setMensaje(''), 3000);
      resetear_formulario();
      setArchivoPendiente(null);
      setArchivoPreviewNombre('');
      setArchivoUrlPreSubido('');
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const { confirmar } = useMensajesConfirmacion();

  const manejar_eliminar = async (id) => {
    const ok = await confirmar({
      titulo: 'Confirmar eliminación',
      mensaje: '¿Está seguro de eliminar este boletín?',
      tipo: 'advertencia',
      texto_confirmar: 'Eliminar',
      texto_cancelar: 'Cancelar',
    });
    if (!ok) return;
    
    try {
      await api_eliminar_boletin(id);
      await cargar_boletines();
      setMensaje('Boletín eliminado exitosamente');
      setTimeout(() => setMensaje(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const manejar_edicion = (boletin) => {
    setBoletinActual(boletin);
    setModoEdicion(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetear_formulario = () => {
    setBoletinActual(null);
    setModoEdicion(false);
  };

  // Filtrado y búsqueda
  const boletines_filtrados = useMemo(() => {
    if (!filtro.trim()) return boletines;
    const termino = filtro.toLowerCase();
    return boletines.filter(bol => 
      bol.titulo.toLowerCase().includes(termino) ||
      bol.numero_boletin.toLowerCase().includes(termino) ||
      bol.resumen.toLowerCase().includes(termino) ||
      bol.autor.toLowerCase().includes(termino) ||
      bol.etiquetas.toLowerCase().includes(termino)
    );
  }, [boletines, filtro]);

  // Efectos
  useEffect(() => {
    cargar_boletines();
  }, []);

  useEffect(() => {
    const handler = () => {
      if (archivo_url_pre_subido) {
        const rel = a_url_relativa(archivo_url_pre_subido);
        try { fetch(`${API_URL}/archivos/eliminar?url=${encodeURIComponent(rel)}`, { method: 'DELETE', keepalive: true, headers: token ? { Authorization: `Bearer ${token}` } : {} }); } catch (_) {}
      }
    };
    if (typeof window !== 'undefined') window.addEventListener('beforeunload', handler);
    return () => { if (typeof window !== 'undefined') window.removeEventListener('beforeunload', handler); };
  }, [archivo_url_pre_subido, API_URL, token]);

  const abrir_formulario_nuevo = () => {
    setModoEdicion(false);
    setBoletinActual({ ...modelo_boletin });
  };

  const cancelar_formulario = async () => {
    setBoletinActual(null);
    setModoEdicion(false);
    setError('');
    if (archivo_url_pre_subido) {
      try { await eliminar_archivo_api(archivo_url_pre_subido); } catch (_) {}
      setArchivoUrlPreSubido('');
    }
  };

  const alternar_activo = async (id) => {
    try {
      const actual = boletines.find(b => b.id_boletin === id);
      if (!actual) return;
      const ok = await confirmar({
        titulo: 'Confirmar cambio de estado',
        mensaje: `¿Desea ${actual.activo ? 'desactivar' : 'activar'} este boletín?`,
        tipo: 'informacion',
        texto_confirmar: 'Continuar',
        texto_cancelar: 'Cancelar',
      });
      if (!ok) return;
      const actualizado = await api_actualizar_boletin(id, { ...actual, activo: !actual.activo });
      const nuevos = boletines.map(b => (b.id_boletin === id ? { ...actualizado } : b));
      setBoletines(nuevos);
    } catch (e) {
      setError(e.message || 'No se pudo actualizar el estado');
    }
  };

  // Función auxiliar para obtener el icono del archivo
  const obtener_icono_archivo = (tipo) => {
    switch (tipo) {
      case 'application/pdf': return <FaFilePdf className="text-red-600" />;
      case 'image/jpeg':
      case 'image/png':
      case 'image/gif': return <FaFileImage className="text-green-600" />;
      case 'application/zip':
      case 'application/x-rar-compressed': return <FaFileArchive className="text-purple-600" />;
      default: return <FiFileText className="text-gray-600" />;
    }
  };

  // Función auxiliar para formatear tamaño de archivo
  const formatear_tamano_archivo = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="mx-auto py-6 px-10">
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

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={cargar_boletines}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200 shadow-sm hover:shadow-md"
            title="Actualizar listado"
          >
            <FiRefreshCw size={18} />
            <span className="font-medium">Actualizar</span>
          </button>
          <button
            onClick={abrir_formulario_nuevo}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white hover:bg-green-700 transition-all duration-200 shadow-sm hover:shadow-md"
            title="Agregar nuevo boletín"
          >
            <FiPlus size={18} />
            <span className="font-medium">Nuevo boletín</span>
          </button>
        </div>
        <div className="relative w-full max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por título, número o resumen"
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

        {/* Formulario de creación/edición */}
        {boletin_actual && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              {modo_edicion ? 'Editar boletín' : 'Nuevo boletín'}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={manejar_envio}
                disabled={guardando || subiendo}
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
          <form onSubmit={manejar_envio} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título del Boletín *
                </label>
                <input
                  type="text"
                  value={boletin_actual?.titulo || ''}
                  onChange={(e) => setBoletinActual({...boletin_actual, titulo: e.target.value})}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ingrese el título del boletín"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Boletín *
                </label>
                <input
                  type="text"
                  value={boletin_actual?.numero_boletin || ''}
                  onChange={(e) => setBoletinActual({...boletin_actual, numero_boletin: e.target.value})}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: BOL-2024-001"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Publicación *</label>
                <input
                  type="date"
                  value={boletin_actual?.fecha_publicacion || ''}
                  onChange={(e) => setBoletinActual({...boletin_actual, fecha_publicacion: e.target.value})}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de Vigencia
                </label>
                <input
                  type="date"
                  value={boletin_actual?.fecha_vigencia || ''}
                  onChange={(e) => setBoletinActual({...boletin_actual, fecha_vigencia: e.target.value})}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Autor</label>
                <input
                  type="text"
                  value={boletin_actual?.autor || ''}
                  onChange={(e) => setBoletinActual({...boletin_actual, autor: e.target.value})}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nombre del autor"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select
                  value={boletin_actual?.categoria || 'general'}
                  onChange={(e) => setBoletinActual({...boletin_actual, categoria: e.target.value})}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.icono} {cat.nombre}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Boletín</label>
                <select
                  value={boletin_actual?.tipo || 'informativo'}
                  onChange={(e) => setBoletinActual({...boletin_actual, tipo: e.target.value})}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {tipos_boletin.map(tipo => (
                    <option key={tipo.id} value={tipo.id}>{tipo.icono} {tipo.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resumen
              </label>
              <textarea
                value={boletin_actual?.resumen || ''}
                onChange={(e) => setBoletinActual({...boletin_actual, resumen: e.target.value})}
                rows={3}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Breve resumen del contenido del boletín"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contenido Completo
              </label>
              <textarea
                value={boletin_actual?.contenido || ''}
                onChange={(e) => setBoletinActual({...boletin_actual, contenido: e.target.value})}
                rows={6}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Contenido completo del boletín"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Documento adjunto</label>
          <input
            type="file"
            accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.zip,.png,.jpg,.jpeg"
            onChange={manejar_subir_archivo}
            className="w-full text-sm border rounded-lg px-3 py-2 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {(archivo_pendiente || archivo_url_pre_subido || boletin_actual?.archivo_url) && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-700">
              {obtener_icono_archivo(archivo_pendiente ? archivo_pendiente.type : boletin_actual.archivo_tipo)}
              <span className="font-medium">{archivo_pendiente ? archivo_preview_nombre : (boletin_actual.archivo_nombre || archivo_preview_nombre)}</span>
              {(!archivo_pendiente && boletin_actual?.tamano_archivo) && (
                <span className="text-gray-500">({formatear_tamano_archivo(boletin_actual.tamano_archivo)})</span>
              )}
              {!archivo_pendiente && (archivo_url_pre_subido || boletin_actual?.archivo_url) && (
                <a href={a_url_absoluta(archivo_url_pre_subido || boletin_actual.archivo_url)} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">Ver adjuntado</a>
              )}
              <button
                type="button"
                onClick={async () => {
                  if (archivo_url_pre_subido) { try { await eliminar_archivo_api(archivo_url_pre_subido); } catch (_) {} setArchivoUrlPreSubido(''); }
                  setArchivoPendiente(null);
                  setArchivoPreviewNombre('');
                  setBoletinActual({ ...boletin_actual, archivo_url: '', archivo_nombre: '', archivo_tipo: '', tamano_archivo: 0 });
                }}
                className="px-2 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Quitar
              </button>
            </div>
          )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Etiquetas (separadas por comas)</label>
              <input
                type="text"
                value={boletin_actual?.etiquetas || ''}
                onChange={(e) => setBoletinActual({...boletin_actual, etiquetas: e.target.value})}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej: finanzas, presupuesto, 2024"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select
                  value={boletin_actual?.estado || 'borrador'}
                  onChange={(e) => setBoletinActual({...boletin_actual, estado: e.target.value})}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {estados_boletin.map(estado => (
                    <option key={estado.id} value={estado.id}>{estado.icono} {estado.nombre}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center pt-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={boletin_actual?.activo || false}
                    onChange={(e) => setBoletinActual({...boletin_actual, activo: e.target.checked})}
                    className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Activo</span>
                </label>
              </div>
            </div>
          </form>
        </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {cargando ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : boletines_filtrados.length === 0 ? (
            <div className="text-center py-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 m-6">
              <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <FiFileText className="w-10 h-10 text-gray-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Sin boletines</h3>
              <p className="text-gray-600 max-w-md mx-auto">Agrega boletines para mostrarlos en la sección pública.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-5 py-3 text-sm font-semibold text-gray-700">Boletín</th>
                    <th className="px-5 py-3 text-sm font-semibold text-gray-700">Categoría</th>
                    <th className="px-5 py-3 text-sm font-semibold text-gray-700">Tipo</th>
                    <th className="px-5 py-3 text-sm font-semibold text-gray-700">Número</th>
                    <th className="px-5 py-3 text-sm font-semibold text-gray-700">Publicación</th>
                    <th className="px-5 py-3 text-sm font-semibold text-gray-700">Estado</th>
                    <th className="px-5 py-3 text-sm font-semibold text-gray-700">Documento</th>
                    <th className="px-5 py-3 text-sm font-semibold text-gray-700">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {boletines_filtrados.map((boletin) => (
                    <tr key={boletin.id_boletin} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-800 font-medium">
                        <div>
                          <div className="font-semibold">{boletin.titulo}</div>
                          {boletin.resumen && (
                            <div className="text-sm text-gray-600">{boletin.resumen}</div>
                          )}

                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          categorias.find(c => c.id === boletin.categoria)?.color || 'bg-gray-100 text-gray-800'
                        }`}>
                          {categorias.find(c => c.id === boletin.categoria)?.nombre || boletin.categoria}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-700">
                        {tipos_boletin.find(t => t.id === boletin.tipo)?.nombre || boletin.tipo}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-700">{boletin.numero_boletin}</td>
                      <td className="px-5 py-3 text-sm text-gray-700">{new Date(boletin.fecha_publicacion).toLocaleDateString()}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          estados_boletin.find(e => e.id === boletin.estado)?.color || 'bg-gray-100 text-gray-800'
                        }`}>
                          {estados_boletin.find(e => e.id === boletin.estado)?.nombre || boletin.estado}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {boletin.archivo_url ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => window.open(a_url_absoluta(boletin.archivo_url), '_blank')}
                              className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors duration-200 shadow-sm hover:shadow"
                              title="Ver documento"
                            >
                              <FiFileText size={18} />
                            </button>
                            <button
                              onClick={async () => {
                                const actualizado = await api_actualizar_boletin(boletin.id_boletin, { ...boletin, archivo_url: '', archivo_nombre: '', archivo_tipo: '', tamano_archivo: 0 });
                                setBoletines(boletines.map(b => b.id_boletin === actualizado.id_boletin ? actualizado : b));
                              }}
                              className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors duration-200 shadow-sm hover:shadow"
                              title="Eliminar documento"
                            >
                              <FiTrash2 size={18} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => manejar_edicion(boletin)}
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
                            onClick={() => manejar_edicion(boletin)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            title="Editar"
                          >
                            <FiEdit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => manejar_eliminar(boletin.id_boletin)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                            title="Eliminar"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
    </div>
  );
};

export default BoletinesAdmin;
