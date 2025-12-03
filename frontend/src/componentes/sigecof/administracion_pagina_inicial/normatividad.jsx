import { useEffect, useMemo, useState } from 'react';
import { useInicioSesion } from '../../pagina_inicial/inicio_sesion/contexto/inicio_sesion-Context';
import { useMensajesConfirmacion } from '../../utilidades/comunes/mensajes_confirmacion.jsx';
import { useControlNotificaciones } from '../administrador/administrador_notificaciones.jsx';


const NormatividadAdmin = () => {
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
  const [documentos, setDocumentos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [subiendo_archivo, setSubiendoArchivo] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [filtro, setFiltro] = useState('');

  // Estados de formulario
  const [modo_edicion, setModoEdicion] = useState(false);
  const [documento_actual, setDocumentoActual] = useState(null);
  const [pdf_pendiente, setPdfPendiente] = useState(null);
  const [pdf_preview_nombre, setPdfPreviewNombre] = useState('');
  const [enlace_pre_subido_url, setEnlacePreSubidoUrl] = useState('');
  const [documento_previo_url, setDocumentoPrevioUrl] = useState('');

  // Modelo del documento en snake_case
  const modelo_documento = {
    id_documento: null,
    titulo: '',
    categoria: 'ley',
    fecha_publicacion: '',
    fecha_actualizacion: '',
    numero_oficial: '',
    resumen: '',
    contenido: '',
    enlace_oficial: '',
    vigencia: 'vigente',
    ambito: 'federal',
    activo: true
  };

  const generar_id = () => `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // Categorías disponibles
  const categorias = [
    { id: 'ley', nombre: 'Ley', icono: '⚖️' },
    { id: 'reglamento', nombre: 'Reglamento', icono: '📋' },
    { id: 'norma', nombre: 'Norma', icono: '📊' },
    { id: 'lineamiento', nombre: 'Lineamiento', icono: '✏️' }
  ];

  const cargar_listado = async () => {
    setCargando(true);
    setError('');
    try {
      const resp = await fetch(`${API_URL}/normatividad/documentos`, { 
        headers: { Authorization: token ? `Bearer ${token}` : '' } 
      });
      const data = await resp.json();
      if (resp.ok && data?.exito && Array.isArray(data.documentos)) {
        setDocumentos(data.documentos);
      } else {
        setError(data?.error || 'No se pudo obtener el listado de documentos');
        setDocumentos([]);
      }
    } catch (e) {
      setError('Error de conexión al cargar listado de normatividad');
      setDocumentos([]);
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
      if (enlace_pre_subido_url) {
        const rel = a_url_relativa(enlace_pre_subido_url);
        try { fetch(`${API_URL}/archivos/eliminar?url=${encodeURIComponent(rel)}`, { method: 'DELETE', keepalive: true, headers: token ? { Authorization: `Bearer ${token}` } : {} }); } catch (_) {}
      }
    };
    if (typeof window !== 'undefined') window.addEventListener('beforeunload', handler);
    return () => { if (typeof window !== 'undefined') window.removeEventListener('beforeunload', handler); };
  }, [enlace_pre_subido_url, API_URL, token]);

  // Operaciones contra API
  const api_crear_documento = async (doc) => {
    const payload = {
      ...doc,
      fecha_publicacion: doc.fecha_publicacion && String(doc.fecha_publicacion).trim() ? doc.fecha_publicacion : null,
      fecha_actualizacion: doc.fecha_actualizacion && String(doc.fecha_actualizacion).trim() ? doc.fecha_actualizacion : null,
      enlace_oficial: doc.enlace_oficial ? a_url_relativa(doc.enlace_oficial) : '',
      documento_url: doc.documento_url ? a_url_relativa(doc.documento_url) : '',
      documento_nombre: doc.documento_nombre || '',
      documento_tipo: doc.documento_tipo || '',
      tamano_documento: doc.tamano_documento || 0
    };
    const resp = await fetch(`${API_URL}/normatividad/documentos`, {
      method: 'POST',
      headers: headersAuth,
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (!resp.ok || !data?.exito) throw new Error(data?.error || 'Error creando documento');
    try { procesar_evento({ seccion: 'normatividad', accion: 'subir_normatividad', rol_origen: rol_actual }); } catch (_) {}
    return data.documento;
  };

  const api_actualizar_documento = async (id_documento, doc) => {
    const payload = {
      ...doc,
      fecha_publicacion: doc.fecha_publicacion && String(doc.fecha_publicacion).trim() ? doc.fecha_publicacion : null,
      fecha_actualizacion: doc.fecha_actualizacion && String(doc.fecha_actualizacion).trim() ? doc.fecha_actualizacion : null,
      enlace_oficial: doc.enlace_oficial ? a_url_relativa(doc.enlace_oficial) : '',
      documento_url: doc.documento_url ? a_url_relativa(doc.documento_url) : '',
      documento_nombre: doc.documento_nombre || '',
      documento_tipo: doc.documento_tipo || '',
      tamano_documento: doc.tamano_documento || 0
    };
    const resp = await fetch(`${API_URL}/normatividad/documentos/${id_documento}`, {
      method: 'PUT',
      headers: headersAuth,
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (!resp.ok || !data?.exito) throw new Error(data?.error || 'Error actualizando documento');
    try { procesar_evento({ seccion: 'normatividad', accion: 'actualizar_normatividad', rol_origen: rol_actual }); } catch (_) {}
    return data.documento;
  };

  const api_eliminar_documento = async (id_documento) => {
    const resp = await fetch(`${API_URL}/normatividad/documentos/${id_documento}`, { 
      method: 'DELETE', 
      headers: { Authorization: token ? `Bearer ${token}` : '' } 
    });
    const data = await resp.json();
    if (!resp.ok || !data?.exito) throw new Error(data?.error || 'Error eliminando documento');
    try { procesar_evento({ seccion: 'normatividad', accion: 'eliminar_normatividad', rol_origen: rol_actual }); } catch (_) {}
    return true;
  };

  const documentos_filtrados = useMemo(() => {
    const q = filtro.toLowerCase().trim();
    const base = Array.isArray(documentos) ? documentos.slice() : [];
    return q
      ? base.filter(doc =>
          String(doc.titulo || '').toLowerCase().includes(q) ||
          String(doc.resumen || '').toLowerCase().includes(q) ||
          String(doc.numero_oficial || '').toLowerCase().includes(q)
        )
      : base;
  }, [documentos, filtro]);

  const validar_documento = (doc) => {
    if (!doc.titulo || !doc.numero_oficial || !doc.resumen) {
      return 'Ingrese al menos título, número oficial y resumen';
    }
    if (!doc.fecha_publicacion) {
      return 'Ingrese la fecha de publicación';
    }
    return '';
  };

  const abrir_formulario_nuevo = () => {
    setModoEdicion(false);
    setDocumentoActual({ ...modelo_documento, id_documento: generar_id() });
    setPdfPendiente(null);
    setPdfPreviewNombre('');
    setDocumentoPrevioUrl('');
  };

  const subir_pdf_api = async (file) => {
    try {
      const fd = new FormData();
      fd.append('destino', 'pantalla_inicial/normatividad');
      fd.append('archivo', file);
      const headersUpload = token ? { Authorization: `Bearer ${token}` } : undefined;
      const resp = await fetch(`${API_URL}/archivos/subir?destino=pantalla_inicial/normatividad`, { method: 'POST', headers: headersUpload, body: fd, credentials: 'include' });
      const data = await resp.json();
      if (!resp.ok || !data?.exito || !data?.url_publica) throw new Error(data?.error || 'No se pudo subir el documento');
      return data;
    } catch (e) {
      setError(e.message || 'Error subiendo documento');
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

  const manejar_subir_pdf = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !documento_actual) return;
    setPdfPreviewNombre(file.name || 'documento.pdf');
    if (file.size > 40 * 1024 * 1024) {
      setError('El documento excede el límite de 40MB');
      e.target.value = '';
      return;
    }
    setSubiendoArchivo(true);
    if (enlace_pre_subido_url) {
      try { await eliminar_archivo_api(enlace_pre_subido_url); } catch (_) {}
      setEnlacePreSubidoUrl('');
    }
    const subido = await subir_pdf_api(file);
    setSubiendoArchivo(false);
    if (subido && subido.url_publica) {
      setDocumentoActual({
        ...documento_actual,
        documento_url: a_url_absoluta(subido.url_publica),
        documento_nombre: subido.nombre || file.name,
        documento_tipo: subido.tipo || file.type,
        tamano_documento: subido.tamano || file.size
      });
      if (modo_edicion && documento_actual?.id_documento) {
        const nueva_url = a_url_absoluta(subido.url_publica);
        setDocumentos(prev => prev.map(d => (
          d.id_documento === documento_actual.id_documento
            ? { ...d, documento_url: nueva_url, documento_nombre: subido.nombre || file.name, documento_tipo: subido.tipo || file.type, tamano_documento: subido.tamano || file.size }
            : d
        )));
      }
      setEnlacePreSubidoUrl(subido.url_publica);
      setPdfPendiente(null);
      setMensaje('PDF cargado y listo para guardar');
      setTimeout(() => setMensaje(''), 2000);
    } else {
      setPdfPendiente(file);
      setMensaje('No se pudo cargar; se guardará sin adjunto');
      setTimeout(() => setMensaje(''), 2000);
    }
    e.target.value = '';
  };

  const abrir_formulario_editar = (doc) => {
    setModoEdicion(true);
    setDocumentoActual({ ...doc });
    setPdfPendiente(null);
    setPdfPreviewNombre('');
    setDocumentoPrevioUrl(doc?.documento_url || '');
  };

  const cancelar_formulario = async () => {
    setDocumentoActual(null);
    setModoEdicion(false);
    setError('');
    setPdfPendiente(null);
    setPdfPreviewNombre('');
    if (enlace_pre_subido_url) {
      try { await eliminar_archivo_api(enlace_pre_subido_url); } catch (_) {}
      setEnlacePreSubidoUrl('');
    }
    if (modo_edicion && documento_previo_url && documento_actual?.id_documento) {
      const url_revertida = documento_previo_url;
      setDocumentos(prev => prev.map(d => (
        d.id_documento === documento_actual.id_documento
          ? { ...d, documento_url: url_revertida }
          : d
      )));
    }
    setDocumentoPrevioUrl('');
  };

  const confirmar_formulario = async () => {
    if (!documento_actual) return;
    setError('');
    
    const err = validar_documento(documento_actual);
    if (err) {
      setError(err);
      return;
    }
    
    if (pdf_pendiente) {
      if (pdf_pendiente.size > 40 * 1024 * 1024) {
        setError('El documento excede el límite de 40MB');
        return;
      }
      setSubiendoArchivo(true);
      const subido = await subir_pdf_api(pdf_pendiente);
      setSubiendoArchivo(false);
      if (!subido) return;
      setDocumentoActual({
        ...documento_actual,
        documento_url: a_url_absoluta(subido.url_publica),
        documento_nombre: subido.nombre || pdf_pendiente.name,
        documento_tipo: subido.tipo || pdf_pendiente.type,
        tamano_documento: subido.tamano || pdf_pendiente.size
      });
    }

    setGuardando(true);
    try {
      if (modo_edicion) {
        const actualizado = await api_actualizar_documento(documento_actual.id_documento, pdf_pendiente ? { ...documento_actual, documento_url: a_url_relativa(documento_actual.documento_url) } : documento_actual);
        const nuevos = documentos.map(doc => (doc.id_documento === actualizado.id_documento ? { ...actualizado } : doc));
        setDocumentos(nuevos);
        setMensaje('Documento actualizado exitosamente');
      } else {
        const creado = await api_crear_documento(pdf_pendiente ? { ...documento_actual, documento_url: a_url_relativa(documento_actual.documento_url) } : documento_actual);
        const nuevos = [...documentos, creado];
        setDocumentos(nuevos);
        setMensaje('Documento creado exitosamente');
      }
      setDocumentoActual(null);
      setModoEdicion(false);
      setPdfPendiente(null);
      setPdfPreviewNombre('');
      setEnlacePreSubidoUrl('');
      setDocumentoPrevioUrl('');
    } catch (e) {
      setError(e.message || 'No se pudo guardar el documento');
    } finally {
      setGuardando(false);
    }
  };

  const { confirmar } = useMensajesConfirmacion();

  const eliminar_documento = async (id_documento) => {
    const ok = await confirmar({
      titulo: 'Confirmar eliminación',
      mensaje: '¿Eliminar este documento normativo? Esta acción no se puede deshacer.',
      tipo: 'advertencia',
      texto_confirmar: 'Eliminar',
      texto_cancelar: 'Cancelar',
    });
    if (!ok) return;
    
    try {
      await api_eliminar_documento(id_documento);
      const restantes = documentos.filter(doc => doc.id_documento !== id_documento);
      setDocumentos(restantes);
      setMensaje('Documento eliminado exitosamente');
    } catch (e) {
      setError(e.message || 'No se pudo eliminar el documento');
    }
  };

  const alternar_activo = async (id_documento) => {
    try {
      const actual = documentos.find(doc => doc.id_documento === id_documento);
      if (!actual) return;
      const ok = await confirmar({
        titulo: 'Confirmar cambio de estado',
        mensaje: `¿Desea ${actual.activo ? 'desactivar' : 'activar'} este documento?`,
        tipo: 'informacion',
        texto_confirmar: 'Continuar',
        texto_cancelar: 'Cancelar',
      });
      if (!ok) return;
      const actualizado = await api_actualizar_documento(id_documento, { ...actual, activo: !actual.activo });
      const nuevos = documentos.map(doc => (doc.id_documento === id_documento ? { ...actualizado } : doc));
      setDocumentos(nuevos);
    } catch (e) {
      setError(e.message || 'No se pudo actualizar el estado');
    }
  };

  const obtener_clases_categoria = (categoria) => {
    switch (categoria) {
      case 'ley': return 'bg-red-100 text-red-800';
      case 'reglamento': return 'bg-blue-100 text-blue-800';
      case 'norma': return 'bg-green-100 text-green-800';
      case 'lineamiento': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const obtener_icono_categoria = (categoria) => {
    const cat = categorias.find(c => c.id === categoria);
    return cat ? cat.icono : '📄';
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
            title="Agregar nuevo documento"
          >
            <FiPlus size={18} />
            <span className="font-medium">Nuevo documento</span>
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
      {documento_actual && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              {modo_edicion ? 'Editar documento normativo' : 'Nuevo documento normativo'}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={confirmar_formulario}
                disabled={guardando || subiendo_archivo}
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
                value={documento_actual.titulo}
                onChange={(e) => setDocumentoActual({ ...documento_actual, titulo: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej. Ley Federal de Presupuesto y Responsabilidad Hacendaria"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <select
                value={documento_actual.categoria}
                onChange={(e) => setDocumentoActual({ ...documento_actual, categoria: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {categorias.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icono} {cat.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número Oficial *</label>
              <input
                type="text"
                value={documento_actual.numero_oficial}
                onChange={(e) => setDocumentoActual({ ...documento_actual, numero_oficial: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej. DOF 30-03-2006"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Publicación *</label>
              <input
                type="date"
                value={documento_actual.fecha_publicacion}
                onChange={(e) => setDocumentoActual({ ...documento_actual, fecha_publicacion: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Actualización</label>
              <input
                type="date"
                value={documento_actual.fecha_actualizacion}
                onChange={(e) => setDocumentoActual({ ...documento_actual, fecha_actualizacion: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vigencia</label>
              <select
                value={documento_actual.vigencia}
                onChange={(e) => setDocumentoActual({ ...documento_actual, vigencia: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="vigente">✅ Vigente</option>
                <option value="derogado">❌ Derogado</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ámbito</label>
              <select
                value={documento_actual.ambito}
                onChange={(e) => setDocumentoActual({ ...documento_actual, ambito: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="federal">🏛️ Federal</option>
                <option value="estatal">🏢 Estatal</option>
                <option value="municipal">🏘️ Municipal</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Enlace Oficial</label>
              <input
                type="url"
                value={documento_actual.enlace_oficial}
                onChange={(e) => setDocumentoActual({ ...documento_actual, enlace_oficial: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://www.diputados.gob.mx/LeyesBiblio/pdf/..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Documento (PDF) adjunto</label>
              <input
                type="file"
                accept=".pdf"
                onChange={manejar_subir_pdf}
                className="w-full text-sm border rounded-lg px-3 py-2 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {(pdf_pendiente || enlace_pre_subido_url || (documento_actual?.documento_url && !documento_actual.documento_url.startsWith('blob:'))) && (
                <div className="mt-2 flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <FiFileText />
                    <a href={a_url_absoluta(enlace_pre_subido_url || documento_actual.documento_url)} target="_blank" rel="noopener noreferrer" className="underline text-blue-700">Ver adjuntado</a>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (enlace_pre_subido_url) {
                        try { await eliminar_archivo_api(enlace_pre_subido_url); } catch (_) {}
                        setEnlacePreSubidoUrl('');
                      }
                      setPdfPendiente(null);
                      setPdfPreviewNombre('');
                      setDocumentoActual({ ...documento_actual, documento_url: '', documento_nombre: '', documento_tipo: '', tamano_documento: 0 });
                      if (modo_edicion && documento_actual?.id_documento) {
                        const url_revertida = documento_previo_url || '';
                        setDocumentos(prev => prev.map(d => (
                          d.id_documento === documento_actual.id_documento
                            ? { ...d, documento_url: url_revertida, documento_nombre: '', documento_tipo: '', tamano_documento: 0 }
                            : d
                        )));
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm"
                  >
                    Quitar
                  </button>
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Resumen *</label>
              <textarea
                value={documento_actual.resumen}
                onChange={(e) => setDocumentoActual({ ...documento_actual, resumen: e.target.value })}
                rows={3}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Breve descripción del documento normativo..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Contenido Detallado</label>
              <textarea
                value={documento_actual.contenido}
                onChange={(e) => setDocumentoActual({ ...documento_actual, contenido: e.target.value })}
                rows={6}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Contenido HTML del documento..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Activo</label>
              <div>
                <input
                  type="checkbox"
                  checked={documento_actual.activo}
                  onChange={(e) => setDocumentoActual({ ...documento_actual, activo: e.target.checked })}
                />
                <span className="ml-2 text-sm text-gray-700">Mostrar en la sección pública</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Listado de documentos */}
      {cargando ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : documentos_filtrados.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
          <div className="w-20 h-20 mx-auto mb-4 bg-orange-100 rounded-full flex items-center justify-center">
            <ImHammer2 className="w-10 h-10 text-orange-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Sin documentos normativos</h3>
          <p className="text-gray-600 max-w-md mx-auto">Agrega documentos normativos para mostrarlos en la sección pública.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Documento</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Categoría</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Número Oficial</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Vigencia</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Estado</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Adjunto</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {documentos_filtrados.map((doc) => (
                  <tr key={doc.id_documento} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-800 font-medium">
                      <div>
                        <div className="font-semibold">{doc.titulo}</div>
                        {doc.resumen && (
                          <div className="text-gray-500 text-xs mt-1 max-w-md truncate">{doc.resumen}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${obtener_clases_categoria(doc.categoria)}`}>
                        {obtener_icono_categoria(doc.categoria)} {doc.categoria}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-700 text-sm font-mono">{doc.numero_oficial}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        doc.vigencia === 'vigente' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {doc.vigencia === 'vigente' ? '✅ Vigente' : '❌ Derogado'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => alternar_activo(doc.id_documento)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${doc.activo ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        {doc.activo ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      {doc.documento_url ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => window.open(a_url_absoluta(doc.documento_url), '_blank')}
                            className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors duration-200 shadow-sm hover:shadow"
                            title="Ver documento adjunto"
                          >
                            <FiFileText size={18} />
                          </button>
                          <button
                            onClick={async () => {
                              const actualizado = await api_actualizar_documento(doc.id_documento, { ...doc, documento_url: '', documento_nombre: '', documento_tipo: '', tamano_documento: 0 });
                              setDocumentos(documentos.map(d => d.id_documento === actualizado.id_documento ? actualizado : d));
                            }}
                            className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors duration-200 shadow-sm hover:shadow"
                            title="Eliminar documento adjunto"
                          >
                            <FiTrash2 size={18} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => abrir_formulario_editar(doc)}
                          className="px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 hover:bg-blue-200 text-sm font-medium"
                          title="Agregar documento adjunto"
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
                          onClick={() => abrir_formulario_editar(doc)}
                          className="p-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors duration-200 shadow-sm hover:shadow"
                          title="Editar"
                        >
                          <FiEdit size={18} />
                        </button>
                        <button
                          onClick={() => eliminar_documento(doc.id_documento)}
                          className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors duration-200 shadow-sm hover:shadow"
                          title="Eliminar"
                        >
                          <FiTrash2 size={18} />
                        </button>
                        {doc.enlace_oficial && (
                          <a
                            href={a_url_absoluta(doc.enlace_oficial)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors duration-200 shadow-sm hover:shadow"
                            title="Ver enlace oficial"
                          >
                            <FaExternalLinkAlt size={16} />
                          </a>
                        )}
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

export default NormatividadAdmin;
