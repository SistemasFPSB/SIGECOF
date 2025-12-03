// carrusel.jsx - Administración del carrusel de la página inicial
import { useEffect, useMemo, useRef, useState } from 'react';
import { useInicioSesion } from '../../pagina_inicial/inicio_sesion/contexto/inicio_sesion-Context';
import { useMensajesConfirmacion } from '../../utilidades/comunes/mensajes_confirmacion.jsx';
import { useControlNotificaciones } from '../administrador/administrador_notificaciones.jsx';

// Nota: El nombre del componente usa PascalCase por convención de React.
// Todas las variables, estados y funciones internas usan snake_case y están en español.
const Carrusel = () => {
  const STORAGE_CLAVE = 'carrusel_banners';
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
        // Preferir dinámica si el host no coincide (homologación para IP LAN)
        return mismoHost ? API_BASE : dinamica;
      }
      return dinamica;
    } catch (_) {
      return 'http://localhost:5000/api';
    }
  })();
  const headersAuth = token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  const ORIGEN_BACKEND = (() => {
    try {
      const u = new URL(API_URL);
      return `${u.protocol}//${u.hostname}:${u.port || '5000'}`.replace(/\/$/, '');
    } catch (_) {
      return API_URL.replace(/\/api$/, '');
    }
  })();

  const a_url_absoluta = (ruta) => {
    try {
      const r = String(ruta || '').trim();
      if (!r) return '';
      if (/^https?:\/\//.test(r)) return r;
      return `${ORIGEN_BACKEND}${r.startsWith('/') ? '' : '/'}${r}`;
    } catch (_) { return String(ruta || ''); }
  };

  const a_url_relativa = (url) => {
    try {
      const u = String(url || '').trim();
      if (!u) return '';
      if (/^https?:\/\//.test(u)) {
        const obj = new URL(u);
        const origen = `${obj.protocol}//${obj.hostname}${obj.port ? ':' + obj.port : ''}`;
        if (origen === ORIGEN_BACKEND) return obj.pathname || '/';
        return u; // dejar tal cual si apunta a otro origen
      }
      // ya relativa
      return u.startsWith('/') ? u : `/${u}`;
    } catch (_) { return String(url || ''); }
  };

  // Estados principales
  const [banners, setBanners] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const LS_FORM_KEY = 'carrusel_banner_borrador';
  const LS_FORM_MODE_KEY = 'carrusel_banner_modo_edicion';
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [filtro, setFiltro] = useState('');

  // Estados de formulario
  const [modo_edicion, setModoEdicion] = useState(false);
  const [banner_actual, setBannerActual] = useState(null);

  // Estados de subida diferida (hasta Guardar)
  const [archivo_imagen_pendiente, setArchivoImagenPendiente] = useState(null);
  const [archivo_pdf_pendiente, setArchivoPdfPendiente] = useState(null);
  const [preview_imagen, setPreviewImagen] = useState('');
  const [preview_pdf_nombre, setPreviewPdfNombre] = useState('');
  const [url_pdf_pre_subido, setUrlPdfPreSubido] = useState('');

  // Modelo del banner en snake_case
  const modelo_banner = {
    id_banner: null,
    titulo: '',
    descripcion: '',
    url_imagen: '',
    url_pdf: '',
    mostrar_indefinido: true,
    fecha_inicio: '', // ISO string para datetime-local
    fecha_fin: '',     // ISO string para datetime-local
    activo: true,
    prioridad: 1,
  };

  const generar_id = () => `b_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // Eliminado: siembra local de ejemplos. Ahora los datos se gestionan vía API.

  const cargar_listado = async () => {
    try { if (typeof window !== 'undefined') window.__ocultar_overlay_carga = false; } catch (_) {}
    setCargando(true);
    setError('');
    try {
      const resp = await fetch(`${API_URL}/carrusel/banners`, { headers: { Authorization: token ? `Bearer ${token}` : '' }, credentials: 'include' });
      const data = await resp.json();
      if (resp.ok && data?.exito && Array.isArray(data.banners)) {
        setBanners(data.banners);
        // Actualizar caché local solo si hay banners; evitar sobrescribir con []
        if (data.banners.length > 0) {
          try { localStorage.setItem(STORAGE_CLAVE, JSON.stringify(data.banners)); } catch (_) {}
        }
      } else {
        // Fallback a localStorage si la API falla o no hay autorización
        const datos = localStorage.getItem(STORAGE_CLAVE);
        const parseados = datos ? JSON.parse(datos) : [];
        setBanners(Array.isArray(parseados) ? parseados : []);
        setError(data?.error || 'No se pudo obtener listado desde el servidor; usando datos locales');
      }
    } catch (e) {
      // Fallback a localStorage en caso de error de red
      try {
        const datos = localStorage.getItem(STORAGE_CLAVE);
        const parseados = datos ? JSON.parse(datos) : [];
        setBanners(Array.isArray(parseados) ? parseados : []);
      } catch (_) {
        setBanners([]);
      }
      setError('Error de conexión al cargar listado del carrusel');
    } finally {
      setCargando(false);
      try { if (typeof window !== 'undefined') window.__ocultar_overlay_carga = true; } catch (_) {}
    }
  };

  // Operaciones contra API
  const api_crear_banner = async (b) => {
    const payload = {
      ...b,
      url_imagen: a_url_relativa(b.url_imagen),
      url_pdf: b.url_pdf ? a_url_relativa(b.url_pdf) : ''
    };
    const resp = await fetch(`${API_URL}/carrusel/banners`, {
      method: 'POST',
      headers: headersAuth,
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (!resp.ok || !data?.exito) throw new Error(data?.error || 'Error creando banner');
    try { if (data?.banner?.activo) { procesar_evento({ seccion: 'carrusel', accion: 'activar_item_carrusel', rol_origen: rol_actual }); } } catch (_) {}
    return data.banner;
  };

  const api_actualizar_banner = async (id_banner, b) => {
    const payload = {
      ...b,
      url_imagen: a_url_relativa(b.url_imagen),
      url_pdf: b.url_pdf ? a_url_relativa(b.url_pdf) : ''
    };
    const resp = await fetch(`${API_URL}/carrusel/banners/${id_banner}`, {
      method: 'PUT',
      headers: headersAuth,
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (!resp.ok || !data?.exito) throw new Error(data?.error || 'Error actualizando banner');
    try { const activo = !!(data?.banner?.activo); procesar_evento({ seccion: 'carrusel', accion: activo ? 'activar_item_carrusel' : 'desactivar_item_carrusel', rol_origen: rol_actual }); } catch (_) {}
    return data.banner;
  };

  const api_eliminar_banner = async (id_banner) => {
    const resp = await fetch(`${API_URL}/carrusel/banners/${id_banner}`, { method: 'DELETE', headers: { Authorization: token ? `Bearer ${token}` : '' }, credentials: 'include' });
    const data = await resp.json();
    if (!resp.ok || !data?.exito) throw new Error(data?.error || 'Error eliminando banner');
    try { procesar_evento({ seccion: 'carrusel', accion: 'desactivar_item_carrusel', rol_origen: rol_actual }); } catch (_) {}
    return true;
  };

  const api_reordenar = async (ids_en_orden) => {
    const resp = await fetch(`${API_URL}/carrusel/banners/reordenar`, {
      method: 'PATCH',
      headers: headersAuth,
      credentials: 'include',
      body: JSON.stringify({ ids_en_orden })
    });
    const data = await resp.json();
    if (!resp.ok || !data?.exito) throw new Error(data?.error || 'Error reordenando');
    return data.banners || [];
  };

  useEffect(() => {
    if (token) cargar_listado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const handler = () => {
      if (url_pdf_pre_subido) {
        const rel = a_url_relativa(url_pdf_pre_subido);
        try { fetch(`${API_URL}/archivos/eliminar?url=${encodeURIComponent(rel)}`, { method: 'DELETE', keepalive: true, headers: token ? { Authorization: `Bearer ${token}` } : {} }); } catch (_) {}
      }
    };
    if (typeof window !== 'undefined') window.addEventListener('beforeunload', handler);
    return () => { if (typeof window !== 'undefined') window.removeEventListener('beforeunload', handler); };
  }, [url_pdf_pre_subido, API_URL, token]);

  

  // Persistir borrador mientras el formulario esté abierto
  useEffect(() => {
    try {
      if (banner_actual) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(LS_FORM_KEY, JSON.stringify(banner_actual));
          localStorage.setItem(LS_FORM_MODE_KEY, JSON.stringify(!!modo_edicion));
        }
      } else {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(LS_FORM_KEY);
          localStorage.removeItem(LS_FORM_MODE_KEY);
        }
      }
    } catch (_) {}
  }, [banner_actual, modo_edicion]);

  const banner_visible_estado = (b) => {
    if (!b.activo) return { texto: 'Inactivo', clase: 'bg-gray-100 text-gray-700' };
    if (b.mostrar_indefinido) return { texto: 'Indefinido', clase: 'bg-blue-100 text-blue-800' };
    const ahora = new Date();
    const fi = b.fecha_inicio ? new Date(b.fecha_inicio) : null;
    const ff = b.fecha_fin ? new Date(b.fecha_fin) : null;
    const dentro = (!fi || ahora >= fi) && (!ff || ahora <= ff);
    return dentro
      ? { texto: 'Vigente', clase: 'bg-green-100 text-green-700' }
      : { texto: 'Fuera de periodo', clase: 'bg-yellow-100 text-yellow-800' };
  };

  const banners_filtrados = useMemo(() => {
    const q = filtro.toLowerCase().trim();
    const base = Array.isArray(banners) ? banners.slice() : [];
    const filtrados = q
      ? base.filter(b =>
          String(b.titulo || '').toLowerCase().includes(q) ||
          String(b.descripcion || '').toLowerCase().includes(q)
        )
      : base;
    return filtrados.sort((a, b) => Number(a.prioridad || 0) - Number(b.prioridad || 0));
  }, [banners, filtro]);

  const validar_banner = (b) => {
    if (!b.titulo) {
      return 'Ingrese el título del banner';
    }
    if (!modo_edicion && !archivo_imagen_pendiente) {
      return 'Seleccione un archivo de imagen para el banner';
    }
    if (modo_edicion && !b.url_imagen && !archivo_imagen_pendiente) {
      return 'Proporcione la imagen del banner';
    }
    if (!b.mostrar_indefinido) {
      if (!b.fecha_inicio && !b.fecha_fin) {
        return 'Defina fecha de inicio o fin, o marque "Mostrar indefinido"';
      }
      // Validar orden
      if (b.fecha_inicio && b.fecha_fin) {
        const fi = new Date(b.fecha_inicio);
        const ff = new Date(b.fecha_fin);
        if (fi > ff) return 'La fecha de inicio no puede ser mayor que la fecha fin';
      }
    }
    return '';
  };

  const abrir_formulario_nuevo = () => {
    setModoEdicion(false);
    setBannerActual({ ...modelo_banner, id_banner: null, prioridad: (banners?.length || 0) + 1 });
    // Limpiar estados de subida diferida
    if (preview_imagen) {
      try { URL.revokeObjectURL(preview_imagen); } catch (_) {}
    }
    setArchivoImagenPendiente(null);
    setArchivoPdfPendiente(null);
    setPreviewImagen('');
    setPreviewPdfNombre('');
  };

  const abrir_formulario_editar = (b) => {
    setModoEdicion(true);
    setBannerActual({ ...b });
    // Limpiar estados de subida diferida al iniciar edición
    if (preview_imagen) {
      try { URL.revokeObjectURL(preview_imagen); } catch (_) {}
    }
    setArchivoImagenPendiente(null);
    setArchivoPdfPendiente(null);
    setPreviewImagen('');
    setPreviewPdfNombre('');
  };

  const cancelar_formulario = async () => {
    setBannerActual(null);
    setModoEdicion(false);
    setError('');
    // Limpiar estados y previews locales
    if (preview_imagen) {
      try { URL.revokeObjectURL(preview_imagen); } catch (_) {}
    }
    setArchivoImagenPendiente(null);
    setArchivoPdfPendiente(null);
    setPreviewImagen('');
    setPreviewPdfNombre('');
    if (url_pdf_pre_subido) {
      try { await eliminar_archivo_api(url_pdf_pre_subido); } catch (_) {}
      setUrlPdfPreSubido('');
    }
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(LS_FORM_KEY);
        localStorage.removeItem(LS_FORM_MODE_KEY);
      }
    } catch (_) {}
  };

  const confirmar_formulario = async () => {
    if (!banner_actual) return;
    setError('');
    try { if (typeof window !== 'undefined') window.__ocultar_overlay_carga = false; } catch (_) {}
    // Antes de validar, si hay archivos pendientes, subirlos y completar URLs
    let datos = { ...banner_actual };
    try {
      if (archivo_imagen_pendiente) {
        const ruta_img = await subir_archivo_api('imagen', archivo_imagen_pendiente);
        if (!ruta_img) throw new Error('No se pudo subir la imagen');
        datos.url_imagen = ruta_img;
      }
    } catch (e) {
      setError(e.message || 'Error subiendo imagen');
      return;
    }
    if (url_pdf_pre_subido) {
      datos.url_pdf = url_pdf_pre_subido;
    }

    const err = validar_banner(datos);
    if (err) {
      setError(err);
      return;
    }
    setGuardando(true);
    try {
      const datos_base = { ...datos };
      if (modo_edicion) {
        const actualizado = await api_actualizar_banner(banner_actual.id_banner, datos_base);
        const nuevos = banners.map(b => (b.id_banner === actualizado.id_banner ? { ...actualizado } : b));
        setBanners(nuevos);
        setMensaje('Banner actualizado');
      } else {
        const creado = await api_crear_banner(datos_base);
        const nuevos = [...banners, creado].sort((a, b) => Number(a.prioridad || 0) - Number(b.prioridad || 0));
        setBanners(nuevos);
        setMensaje('Banner agregado');
      }
      setBannerActual(null);
      setModoEdicion(false);
      // Limpiar pendientes y previews después de guardar
      if (preview_imagen) {
        try { URL.revokeObjectURL(preview_imagen); } catch (_) {}
      }
      setArchivoImagenPendiente(null);
      setArchivoPdfPendiente(null);
      setUrlPdfPreSubido('');
      setPreviewImagen('');
      setPreviewPdfNombre('');
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(LS_FORM_KEY);
          localStorage.removeItem(LS_FORM_MODE_KEY);
        }
      } catch (_) {}
    } catch (e) {
      setError(e.message || 'No se pudo guardar el banner');
    } finally {
      setGuardando(false);
      try { if (typeof window !== 'undefined') window.__ocultar_overlay_carga = true; } catch (_) {}
    }
  };

  const { confirmar } = useMensajesConfirmacion();

  const eliminar_banner = async (id_banner) => {
    const ok = await confirmar({
      titulo: 'Confirmar eliminación',
      mensaje: '¿Eliminar este banner? Esta acción no se puede deshacer.',
      tipo: 'advertencia',
      texto_confirmar: 'Eliminar',
      texto_cancelar: 'Cancelar',
    });
    if (!ok) return;
    try {
      await api_eliminar_banner(id_banner);
      const restantes = banners.filter(b => b.id_banner !== id_banner).map((b, i) => ({ ...b, prioridad: i + 1 }));
      setBanners(restantes);
      setMensaje('Banner eliminado');
    } catch (e) {
      setError(e.message || 'No se pudo eliminar el banner');
    }
  };

  const alternar_activo = async (id_banner) => {
    try {
      const actual = banners.find(b => b.id_banner === id_banner);
      if (!actual) return;
      const ok = await confirmar({
        titulo: 'Confirmar cambio de estado',
        mensaje: `¿Desea ${actual.activo ? 'desactivar' : 'activar'} este banner?`,
        tipo: 'informacion',
        texto_confirmar: 'Continuar',
        texto_cancelar: 'Cancelar',
      });
      if (!ok) return;
      const actualizado = await api_actualizar_banner(id_banner, { ...actual, activo: !actual.activo });
      const nuevos = banners.map(b => (b.id_banner === id_banner ? { ...actualizado } : b));
      setBanners(nuevos);
    } catch (e) {
      setError(e.message || 'No se pudo actualizar el estado');
    }
  };

  const mover_prioridad = async (id_banner, direccion) => {
    // direccion: -1 (subir), +1 (bajar)
    const idx = banners.findIndex(b => b.id_banner === id_banner);
    if (idx === -1) return;
    const nueva_lista = banners.slice();
    const nuevo_idx = idx + direccion;
    if (nuevo_idx < 0 || nuevo_idx >= nueva_lista.length) return;
    const temp = nueva_lista[idx];
    nueva_lista[idx] = nueva_lista[nuevo_idx];
    nueva_lista[nuevo_idx] = temp;
    // Reasignar prioridades secuenciales
    const orden_ids = nueva_lista.map((b) => b.id_banner);
    try {
      const desde_api = await api_reordenar(orden_ids);
      setBanners(desde_api);
    } catch (e) {
      // Fallback local si falla API
      const reasignados = nueva_lista.map((b, i) => ({ ...b, prioridad: i + 1 }));
      setBanners(reasignados);
      setError('No se pudo guardar el nuevo orden en el servidor');
    }
  };

  const ver_pdf_banner = (url) => {
    if (!url) return;
    try {
      const abs = a_url_absoluta(url);
      window.open(abs, '_blank', 'noopener');
    } catch (_) {}
  };

  const eliminar_pdf_banner = async (id_banner) => {
    try {
      const actual = banners.find(b => b.id_banner === id_banner);
      if (!actual) return;
      const actualizado = await api_actualizar_banner(id_banner, { ...actual, url_pdf: '' });
      const nuevos = banners.map(b => (b.id_banner === id_banner ? { ...actualizado } : b));
      setBanners(nuevos);
      setMensaje('PDF eliminado');
    } catch (e) {
      setError(e.message || 'No se pudo eliminar el PDF');
    }
  };

  const quitar_pdf_pendiente = () => {
    setArchivoPdfPendiente(null);
    setPreviewPdfNombre('');
  };

  const eliminar_pdf_en_formulario = () => {
    if (!banner_actual) return;
    setBannerActual({ ...banner_actual, url_pdf: '' });
  };

  const agregar_pdf_desde_listado = (b) => {
    abrir_formulario_editar(b);
    setTimeout(() => {
      try {
        if (ref_input_pdf && ref_input_pdf.current) {
          ref_input_pdf.current.focus();
          ref_input_pdf.current.click();
        }
      } catch (_) {}
    }, 100);
  };

  const parse_to_datetime_local = (valor) => {
    if (!valor) return '';
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  };

  // Subida de archivos a backend
  const ref_input_imagen = useRef(null);
  const ref_input_pdf = useRef(null);

  const subir_archivo_api = async (tipo, file, id_banner) => {
    try {
      if (tipo === 'imagen') {
        // Intento 1: carrusel/subir_imagen
        try {
          const fd_img = new FormData();
          fd_img.append('file', file);
          const resp = await fetch(`${API_URL}/carrusel/subir_imagen`, { method: 'POST', body: fd_img, headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' });
          const data = await resp.json();
          if (resp.ok && data?.exito && data?.ruta_publica) return data.ruta_publica;
        } catch (_) {}
        // Intento 2: genérico /archivos/subir
        const fd_gen = new FormData();
        fd_gen.append('archivo', file);
        fd_gen.append('destino', 'carrusel/banners');
        const resp2 = await fetch(`${API_URL}/archivos/subir?destino=carrusel/banners`, { method: 'POST', body: fd_gen, headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' });
        const data2 = await resp2.json();
        if (resp2.ok && data2?.exito && data2?.url_publica) return data2.url_publica;
        throw new Error(data2?.error || 'No se pudo subir la imagen');
      }
      // PDF: Intento 1 carrusel/subir_archivo (permite actualizar banner en backend), Intento 2 genérico
      try {
        const fd_pdf = new FormData();
        fd_pdf.append('file', file);
        if (id_banner) fd_pdf.append('id_banner', String(id_banner));
        const resp = await fetch(`${API_URL}/carrusel/subir_archivo`, { method: 'POST', body: fd_pdf, headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' });
        const data = await resp.json();
        if (resp.ok && data?.exito && (data?.ruta_publica || data?.banner?.url_pdf)) return (data.banner?.url_pdf || data.ruta_publica);
      } catch (_) {}
      const fd_gen = new FormData();
      fd_gen.append('archivo', file);
      fd_gen.append('destino', 'carrusel/archivos');
      const resp2 = await fetch(`${API_URL}/archivos/subir?destino=carrusel/archivos`, { method: 'POST', body: fd_gen, headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' });
      const data2 = await resp2.json();
      if (resp2.ok && data2?.exito && data2?.url_publica) return data2.url_publica;
      throw new Error(data2?.error || 'No se pudo subir el archivo PDF');
    } catch (e) {
      setError(e.message || 'Error subiendo archivo');
      return null;
    }
  };
  const eliminar_archivo_api = async (url) => {
    try {
      const rel = a_url_relativa(url);
      const resp = await fetch(`${API_URL}/archivos/eliminar?url=${encodeURIComponent(rel)}`, { method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {}, credentials: 'include' });
      return resp.ok;
    } catch (_) {
      return false;
    }
  };

  const manejar_subir_imagen = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !banner_actual) return;
    try {
      try { if (typeof window !== 'undefined') window.__ocultar_overlay_carga = false; } catch (_) {}
      setSubiendo(true);
      if (preview_imagen) {
        try { URL.revokeObjectURL(preview_imagen); } catch (_) {}
      }
      const objUrl = URL.createObjectURL(file);
      const dim = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
        img.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada'));
        img.src = objUrl;
      });
      const ratio = dim.w / dim.h;
      const objetivo = 16 / 9;
      const tolerancia = 0.02;
      if (!isFinite(ratio) || Math.abs(ratio - objetivo) > tolerancia) {
        try { URL.revokeObjectURL(objUrl); } catch (_) {}
        setError('La imagen debe tener proporción 16:9');
        setMensaje('');
        setArchivoImagenPendiente(null);
        setPreviewImagen('');
        return;
      }
      setPreviewImagen(objUrl);
      setArchivoImagenPendiente(file);
      setMensaje('Imagen lista para guardar');
      setTimeout(() => setMensaje(''), 2000);
    } catch (err) {
      setError(err.message || 'Error validando imagen');
    } finally {
      e.target.value = '';
      setSubiendo(false);
      try { if (typeof window !== 'undefined') window.__ocultar_overlay_carga = true; } catch (_) {}
    }
  };

  const manejar_subir_pdf = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !banner_actual) return;
    try {
      try { if (typeof window !== 'undefined') window.__ocultar_overlay_carga = false; } catch (_) {}
      setSubiendo(true);
      if (url_pdf_pre_subido) {
        try { await eliminar_archivo_api(url_pdf_pre_subido); } catch (_) {}
        setUrlPdfPreSubido('');
      }
      setPreviewPdfNombre(file.name || 'archivo.pdf');
      const idb = modo_edicion ? banner_actual.id_banner : null;
      const ruta = await subir_archivo_api('archivo', file, idb);
      if (ruta) {
        setUrlPdfPreSubido(ruta);
        setArchivoPdfPendiente(null);
        setMensaje('PDF cargado y listo para guardar');
      } else {
        setArchivoPdfPendiente(file);
        setMensaje('No se pudo cargar; se guardará sin adjunto');
      }
      setTimeout(() => setMensaje(''), 2000);
    } finally {
      e.target.value = '';
      setSubiendo(false);
      try { if (typeof window !== 'undefined') window.__ocultar_overlay_carga = true; } catch (_) {}
    }
  };
  const quitar_pdf_pre_subido = async () => {
    if (!url_pdf_pre_subido) return;
    try { await eliminar_archivo_api(url_pdf_pre_subido); } catch (_) {}
    setUrlPdfPreSubido('');
    setPreviewPdfNombre('');
  };

  return (
    <div className="mx-auto py-6 px-10">
      <OverlayDeCarga visible={guardando || subiendo || cargando} texto={cargando ? 'Cargando…' : (guardando ? 'Guardando…' : 'Subiendo…')} />
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
            title="Agregar nuevo banner"
          >
            <FiPlus size={18} />
            <span className="font-medium">Nuevo banner</span>
          </button>
        </div>

        <div className="relative w-full max-w-md">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar por título o descripción"
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
      {banner_actual && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              {modo_edicion ? 'Editar banner' : 'Nuevo banner'}
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmar_formulario}
                disabled={guardando || subiendo || (!modo_edicion && !archivo_imagen_pendiente)}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm hover:shadow-md"
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={cancelar_formulario}
                disabled={subiendo}
                className="px-4 py-2.5 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
              <input
                type="text"
                value={banner_actual.titulo}
                onChange={(e) => setBannerActual({ ...banner_actual, titulo: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ej. Cuidado de la Salud"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <input
                type="text"
                value={banner_actual.descripcion}
                onChange={(e) => setBannerActual({ ...banner_actual, descripcion: e.target.value })}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Texto breve para el banner"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Banner *</label>
              <div className="flex gap-2">
                <input
                  ref={ref_input_imagen}
                  type="file"
                  accept="image/*,.svg"
                  className="w-full text-sm border rounded-lg px-3 py-2 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  required={!modo_edicion}
                  onChange={manejar_subir_imagen}
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Recomendación: imágenes horizontales 16:9. Tamaño sugerido 1920×1080 o 1600×900. Peso máximo 8MB. La imagen se mostrará completa en el carrusel.
              </p>
              {(preview_imagen || banner_actual.url_imagen) && (
                <div className="mt-2">
                  <div className="w-full h-32 rounded-lg overflow-hidden border bg-black flex items-center justify-center">
                    {/* Mostrar preview local si existe, si no, la URL actual */}
                    <img src={preview_imagen || a_url_absoluta(banner_actual.url_imagen)} alt="Vista previa de imagen" className="max-h-full max-w-full object-contain" />
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Documento PDF</label>
              <div className="flex gap-2">
                <input
                  ref={ref_input_pdf}
                  type="file"
                  accept="application/pdf"
                  className="w-full text-sm border rounded-lg px-3 py-2 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  onChange={manejar_subir_pdf}
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Documentos PDF: tamaño máximo 20MB.
              </p>
              {url_pdf_pre_subido && (
                <div className="mt-2 flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <FiFileText />
                    <button type="button" onClick={() => ver_pdf_banner(url_pdf_pre_subido)} className="underline text-blue-700">Ver PDF adjuntado</button>
                  </div>
                  <button type="button" onClick={quitar_pdf_pre_subido} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm">Quitar</button>
                </div>
              )}
              {archivo_pdf_pendiente && preview_pdf_nombre && (
                <div className="mt-2 flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <FiFileText />
                    <span>PDF pendiente: {preview_pdf_nombre}</span>
                  </div>
                  <button
                    type="button"
                    onClick={quitar_pdf_pendiente}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm"
                  >
                    Quitar
                  </button>
                </div>
              )}
              {!archivo_pdf_pendiente && banner_actual?.url_pdf && (
                <div className="mt-2 flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <FiFileText />
                    <button
                      type="button"
                      onClick={() => ver_pdf_banner(banner_actual.url_pdf)}
                      className="underline text-blue-700"
                    >
                      Ver PDF
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={eliminar_pdf_en_formulario}
                    className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 text-sm"
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mostrar indefinido</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBannerActual({ ...banner_actual, mostrar_indefinido: !banner_actual.mostrar_indefinido })}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${banner_actual.mostrar_indefinido ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    {banner_actual.mostrar_indefinido ? <FiEye size={18} /> : <FiEyeOff size={18} />}
                    <span className="ml-2">{banner_actual.mostrar_indefinido ? 'Indefinido' : 'Por periodo'}</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Activo</label>
                <div>
                  <input
                    type="checkbox"
                    checked={banner_actual.activo}
                    onChange={(e) => setBannerActual({ ...banner_actual, activo: e.target.checked })}
                  />
                  <span className="ml-2 text-sm text-gray-700">Mostrar en la página</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                <input
                  type="number"
                  min={1}
                  value={banner_actual.prioridad}
                  onChange={(e) => setBannerActual({ ...banner_actual, prioridad: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {!banner_actual.mostrar_indefinido && (
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
                  <input
                    type="datetime-local"
                    value={parse_to_datetime_local(banner_actual.fecha_inicio)}
                    onChange={(e) => setBannerActual({ ...banner_actual, fecha_inicio: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
                  <input
                    type="datetime-local"
                    value={parse_to_datetime_local(banner_actual.fecha_fin)}
                    onChange={(e) => setBannerActual({ ...banner_actual, fecha_fin: e.target.value })}
                    className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Consejo eliminado: ya contamos con API de subida y gestión desde el backend */}
        </div>
      )}

      {/* Listado de banners */}
      {cargando ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : banners_filtrados.length === 0 ? (
        <div className="text-center py-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
          <div className="w-20 h-20 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Sin banners configurados</h3>
          <p className="text-gray-600 max-w-md mx-auto">Agrega un nuevo banner para mostrarlo en la landing page.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Título</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Estado</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Periodo</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Prioridad</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Activo</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Documento</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Acciones</th>
                  <th className="px-5 py-3 text-sm font-semibold text-gray-700">Desplazar Banner</th>
                </tr>
              </thead>
              <tbody>
                {banners_filtrados.map((b, i) => {
                  const estado = banner_visible_estado(b);
                  return (
                    <tr key={b.id_banner} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-800 font-medium">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-md overflow-hidden border">
                            <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url(${a_url_absoluta(b.url_imagen)})` }} />
                          </div>
                          <div>
                            <div>{b.titulo}</div>
                            {b.descripcion && (
                              <div className="text-gray-500 text-xs">{b.descripcion}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${estado.clase}`}>{estado.texto}</span>
                      </td>
                      <td className="px-5 py-3 text-gray-700 text-sm">
                        {b.mostrar_indefinido ? (
                          <span>Indefinido</span>
                        ) : (
                          <div className="space-y-1">
                            <div>
                              <span className="text-gray-500">Inicio:</span> {b.fecha_inicio ? new Date(b.fecha_inicio).toLocaleString('es-ES') : '-'}
                            </div>
                            <div>
                              <span className="text-gray-500">Fin:</span> {b.fecha_fin ? new Date(b.fecha_fin).toLocaleString('es-ES') : '-'}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-700">{b.prioridad}</td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => alternar_activo(b.id_banner)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${b.activo ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          {b.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        {b.url_pdf ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => ver_pdf_banner(b.url_pdf)}
                              className="p-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors duration-200 shadow-sm hover:shadow"
                              title="Ver PDF"
                            >
                              <FiFileText size={18} />
                            </button>
                            <button
                              onClick={() => eliminar_pdf_banner(b.id_banner)}
                              className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors duration-200 shadow-sm hover:shadow"
                              title="Eliminar PDF"
                            >
                              <FiTrash2 size={18} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => agregar_pdf_desde_listado(b)}
                              className="px-3 py-1.5 rounded-lg bg-purple-100 text-purple-700 hover:bg-blue-200 text-sm font-medium"
                              title="Agregar PDF"
                            >
                              <span className="inline-flex items-center gap-2">
                                <FiUpload size={16} />
                                Agregar PDF
                              </span>
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => abrir_formulario_editar(b)}
                            className="p-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors duration-200 shadow-sm hover:shadow"
                            title="Editar"
                          >
                            <FiEdit size={18} />
                          </button>
                          <button
                            onClick={() => eliminar_banner(b.id_banner)}
                            className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors duration-200 shadow-sm hover:shadow"
                            title="Eliminar"
                          >
                            <FiTrash2 size={18} />
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => mover_prioridad(b.id_banner, -1)}
                            className="px-2 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs"
                            title="Mover arriba"
                            disabled={i === 0}
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => mover_prioridad(b.id_banner, +1)}
                            className="px-2 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs"
                            title="Mover abajo"
                            disabled={i === banners_filtrados.length - 1}
                          >
                            ↓
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Nota eliminada: la administración utiliza API para persistencia y compartir configuración */}
    </div>
  );
};

export default Carrusel;
