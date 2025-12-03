import { useMemo, useState, useEffect, useRef } from 'react';
import { useInicioSesion } from '../../pagina_inicial/inicio_sesion/contexto/inicio_sesion-Context';

export default function Perfil() {
  const { usuarioAutenticado, token } = useInicioSesion();
  const api_base = process.env.REACT_APP_API_URL;
  const api_url = (() => {
    if (api_base && /^https?:\/\//.test(api_base)) return api_base;
    try {
      const host = typeof window !== 'undefined' ? (window.location?.hostname || 'localhost') : 'localhost';
      return `http://${host}:5000/api`;
    } catch (_) {
      return 'http://localhost:5000/api';
    }
  })();
  const origen_backend = useMemo(() => {
    try {
      return new URL(api_url).origin;
    } catch (e) {
      return 'http://localhost:5000';
    }
  }, [api_url]);

  const nombre_mostrar = usuarioAutenticado?.nombre || usuarioAutenticado?.nombre_completo || usuarioAutenticado?.usuario || 'Usuario';
  const [archivo, set_archivo] = useState(null);
  const [vista_previa, set_vista_previa] = useState(null);
  const [subiendo, set_subiendo] = useState(false);
  const [mensaje, set_mensaje] = useState('');
  const [mostrar_mensaje, set_mostrar_mensaje] = useState(false);
  const [error, set_error] = useState('');
  // Editor de ajuste manual previo al upload: arrastrar y zoom dentro de un círculo
  const [editor_src, set_editor_src] = useState(null);
  const [editor_natural, set_editor_natural] = useState({ w: 0, h: 0 });
  const [editor_scale, set_editor_scale] = useState(1); // 1 = encajar lado mínimo al contenedor
  const [editor_pos, set_editor_pos] = useState({ x: 0, y: 0 }); // desplazamiento en px relativo al contenedor
  const [dragging, set_dragging] = useState(false);
  const [drag_start, set_drag_start] = useState({ x: 0, y: 0 });
  const EDITOR_BOX = 192; // px del área de edición (círculo)
  const MAX_TAMANO_BYTES = 5 * 1024 * 1024;
  const canvasRef = useRef(null);
  const imgObjRef = useRef(null);
  // Tiempo de visibilidad del mensaje de confirmación (en ms)
  const MENSAJE_TIMEOUT_MS = 8000; // 8 segundos
  const [, set_foto_url_final] = useState(null);
  const [, set_archivo_procesado] = useState(null);
  const nombre_variantes = useMemo(() => {
    const fuentes = [usuarioAutenticado?.nombre, usuarioAutenticado?.nombre_completo, usuarioAutenticado?.usuario].filter(Boolean);
    const normalizar = (s) => s.toString().trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_-]/g, '_');
    const set = new Set(fuentes.map(normalizar));
    return Array.from(set);
  }, [usuarioAutenticado]);

  // Nombre estándar (primera preferencia) para propósitos de visualización
  

  // Mostrar la foto cargada actual al entrar: usar url guardada o construir candidatos por extensión
  const id_usuario = usuarioAutenticado?.id_usuario;
  // Identificadores en memoria por usuario para evitar mezclar fotos entre cuentas
  const MEM_KEY_URL = useMemo(() => id_usuario ? `foto_usuario_url_${id_usuario}` : 'foto_usuario_url', [id_usuario]);
  const MEM_KEY_PREVIEW = useMemo(() => id_usuario ? `foto_usuario_preview_url_${id_usuario}` : 'foto_usuario_preview_url', [id_usuario]);

  const url_guardada_rel = null;
  const url_guardada_abs = useMemo(() => {
    if (!url_guardada_rel) return null;
    const abs = /^https?:\/\//.test(url_guardada_rel) ? url_guardada_rel : `${origen_backend}${url_guardada_rel}`;
    // Normalizar al origen actual
    try {
      const u = new URL(abs);
      const origen_actual = new URL(origen_backend);
      u.protocol = origen_actual.protocol;
      u.host = origen_actual.host;
      return u.toString();
    } catch (e) {
      return abs.replace(':5001', ':5000');
    }
  }, [url_guardada_rel, origen_backend]);
  const candidatos = useMemo(() => {
    if (!id_usuario || !nombre_variantes.length) return [];
    const lista = [];
    nombre_variantes.forEach((nom) => {
      const base = `${origen_backend}/fotos_usuario/avatar/${id_usuario}_${nom}`;
      lista.push(`${base}.jpg`, `${base}.jpeg`, `${base}.png`);
    });
    return lista;
  }, [id_usuario, nombre_variantes, origen_backend]);
  

  // Ajuste manual con transformación (zoom + desplazamiento) para producir un cuadrado final
  const ajustarImagenConTransform = (file, natural, scale, pos, outputSize = 512, previewBox = 192, clipCircular = true) => {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            try {
              const w = natural.w || img.naturalWidth || img.width;
              const h = natural.h || img.naturalHeight || img.height;
              const baseScale = outputSize / Math.min(w, h);
              const S = baseScale * (scale || 1);
              const dWidth = w * S;
              const dHeight = h * S;
              const factor = outputSize / previewBox; // convertir desplazamientos del preview al lienzo final

              const canvas = document.createElement('canvas');
              canvas.width = outputSize;
              canvas.height = outputSize;
              const ctx = canvas.getContext('2d');
              ctx.imageSmoothingQuality = 'high';

              if (clipCircular) {
                // Clip circular para que el resultado coincida visualmente con el editor (vista previa en círculo)
                const center = outputSize / 2;
                ctx.save();
                ctx.beginPath();
                ctx.arc(center, center, center, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
              }
              const center = outputSize / 2;
              const dx = center - dWidth / 2 + (pos?.x || 0) * factor;
              const dy = center - dHeight / 2 + (pos?.y || 0) * factor;
              ctx.drawImage(img, dx, dy, dWidth, dHeight);

              if (clipCircular) {
                ctx.restore();
              }

              // Exportar en PNG para preservar transparencia si usamos clip circular
              const tipo = clipCircular ? 'image/png' : (file.type === 'image/png' ? 'image/png' : 'image/jpeg');
              canvas.toBlob((blob) => {
                if (!blob) return reject(new Error('No se pudo procesar la imagen'));
                const dataUrl = canvas.toDataURL(tipo, 0.92);
                const nombrePrev = (file.name && file.name.toLowerCase().endsWith('.png')) ? file.name : 'preview.png';
                const fileProcesado = new File([blob], nombrePrev, { type: tipo });
                resolve({ file: fileProcesado, dataUrl });
              }, tipo, 0.92);
            } catch (err) {
              reject(err);
            }
          };
          img.onerror = reject;
          img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      } catch (e) {
        reject(e);
      }
    });
  };

  useEffect(() => {
    // Inicializar vista previa: usar la URL guardada; si no existe, intentar obtenerla desde la API y si no, pre-cargar fuera del DOM.
    const init = async () => {
      // Preferir preview desde servidor si existe
      // Omitir almacenamiento local; usar candidatos o API
      if (url_guardada_abs) {
        set_vista_previa(url_guardada_abs);
        return;
      }
      if (!candidatos.length) {
        set_vista_previa(null);
        return;
      }
      // Intentar obtener la URL oficial desde la API
      try {
        if (token) {
          const r = await fetch(`${api_url}/autenticacion/foto`, { headers: { Authorization: `Bearer ${token}` } });
          if (r.ok) {
            const d = await r.json();
            if (d?.exito && (d?.preview_url || d?.url)) {
              const prev = d.preview_url ? (/^https?:\/\//.test(d.preview_url) ? d.preview_url : `${origen_backend}${d.preview_url}`) : null;
              const abs = d.url ? (/^https?:\/\//.test(d.url) ? d.url : `${origen_backend}${d.url}`) : null;
              if (prev) { set_vista_previa(prev); return; }
              if (abs) { set_vista_previa(abs); return; }
            }
          }
        }
      } catch (e) {
        // Ignorar y continuar con precarga
      }
      let cancelado = false;
      const probar = (index) => {
        if (cancelado || index >= candidatos.length) {
          set_vista_previa(null);
          return;
        }
        const img = new Image();
        img.onload = () => {
          if (!cancelado) {
            const url_ok = candidatos[index];
            set_vista_previa(url_ok);
          }
        };
        img.onerror = () => probar(index + 1);
        img.src = candidatos[index];
      };
      probar(0);
      return () => { cancelado = true; };
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url_guardada_abs, id_usuario, nombre_variantes, origen_backend, token]);

  // Al cambiar de usuario, reiniciar vista previa para evitar fugas
  useEffect(() => { set_vista_previa(null); }, [id_usuario]);

  const manejar_error_vista = () => {
    // Evitar más intentos en tiempo de render para no provocar parpadeos.
    set_vista_previa(null);
  };

  // Redibujar la vista previa del editor usando canvas para que coincida con el recorte final
  useEffect(() => {
    try {
      const canvas = canvasRef.current;
      const img = imgObjRef.current;
      if (!canvas || !img || !editor_natural.w || !editor_natural.h || !editor_src) return;
      const ctx = canvas.getContext('2d');
      const outputSize = EDITOR_BOX;
      ctx.clearRect(0, 0, outputSize, outputSize);
      ctx.imageSmoothingQuality = 'high';
      // Clip circular
      ctx.save();
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      const w = editor_natural.w;
      const h = editor_natural.h;
      const baseScale = outputSize / Math.min(w, h);
      const S = baseScale * (editor_scale || 1);
      const dWidth = w * S;
      const dHeight = h * S;
      const factor = outputSize / EDITOR_BOX;
      const center = outputSize / 2;
      const dx = center - dWidth / 2 + (editor_pos?.x || 0) * factor;
      const dy = center - dHeight / 2 + (editor_pos?.y || 0) * factor;
      ctx.drawImage(img, dx, dy, dWidth, dHeight);
      ctx.restore();
    } catch (_) {}
  }, [editor_src, editor_natural, editor_scale, editor_pos]);

  // Mantener el mensaje de confirmación visible por más tiempo
  useEffect(() => {
    if (!mostrar_mensaje || !mensaje) return;
    const t = setTimeout(() => {
      set_mostrar_mensaje(false);
      set_mensaje('');
    }, MENSAJE_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [mostrar_mensaje, mensaje]);

  const manejar_archivo = (e) => {
    const archivo_nuevo = e.target.files?.[0] || null;
    set_archivo(archivo_nuevo);
    set_error('');
    set_mensaje('');
    set_foto_url_final(null);
    if (archivo_nuevo) {
      const valido = ['image/jpeg', 'image/png'].includes(archivo_nuevo.type);
      if (!valido) {
        set_error('Formato no permitido. Usa imágenes JPEG o PNG.');
        set_archivo_procesado(null);
        set_editor_src(null);
        set_editor_natural({ w: 0, h: 0 });
        return;
      }
      if (archivo_nuevo.size > MAX_TAMANO_BYTES) {
        set_error('El archivo seleccionado supera el tamaño máximo permitido (5 MB).');
        set_archivo(null);
        set_archivo_procesado(null);
        set_editor_src(null);
        set_editor_natural({ w: 0, h: 0 });
        set_editor_scale(1);
        set_editor_pos({ x: 0, y: 0 });
        return;
      }
      // Preparar editor manual (preview en círculo con arrastre y zoom)
      const url = URL.createObjectURL(archivo_nuevo);
      set_editor_src(url);
      set_editor_scale(1);
      set_editor_pos({ x: 0, y: 0 });
      set_archivo_procesado(null);
      try {
        const img = new Image();
        img.onload = () => {
          imgObjRef.current = img;
          set_editor_natural({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
        };
        img.src = url;
      } catch (_) {}
    } else {
      set_archivo_procesado(null);
      set_editor_src(null);
      set_editor_natural({ w: 0, h: 0 });
      set_editor_scale(1);
      set_editor_pos({ x: 0, y: 0 });
    }
  };

  const subir_foto = async (e) => {
    e?.preventDefault();
    set_error('');
    set_mensaje('');
    set_foto_url_final(null);

    if (!archivo) {
      set_error('Selecciona una imagen antes de subir.');
      return;
    }
    if (!token) {
      set_error('No autenticado. Inicia sesión nuevamente.');
      return;
    }
    const valido = ['image/jpeg', 'image/png'].includes(archivo.type);
    if (!valido) {
      set_error('Formato no permitido. Usa imágenes JPEG o PNG.');
      return;
    }
    if (archivo.size > MAX_TAMANO_BYTES) {
      set_error('El archivo seleccionado supera el tamaño máximo permitido (5 MB).');
      return;
    }

    set_subiendo(true);
    try {
      // Aplicar el ajuste para la visualización local ANTES de subir, pero conservar SIEMPRE el archivo original en el servidor
      let archivo_preview_para_subir = null;
      if (archivo && editor_src && editor_natural.w && editor_natural.h) {
        try {
          const res_prev = await ajustarImagenConTransform(archivo, editor_natural, editor_scale, editor_pos, 512, EDITOR_BOX, true);
          set_vista_previa(res_prev.dataUrl);
          archivo_preview_para_subir = res_prev.file;
          
        } catch (_) {
          // si falla el ajuste, continuamos sin bloquear la subida
        }
      }
      // Subir SIEMPRE el archivo original para conservarlo sin recortes
      const formulario = new FormData();
      formulario.append('foto', archivo);
      if (archivo_preview_para_subir) {
        formulario.append('foto_preview', archivo_preview_para_subir);
      }
      const respuesta = await fetch(`${api_url}/autenticacion/subir_foto`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formulario,
      });
      const datos = await respuesta.json();
      if (!respuesta.ok || !datos.exito) {
        throw new Error(datos.error || 'Error al subir la foto');
      }
      set_mensaje('¡Foto subida exitosamente!');
      set_mostrar_mensaje(true);
      set_foto_url_final(datos.url);
      // Guardar URLs públicas
      const url_abs = /^https?:\/\//.test(datos.url) ? datos.url : `${origen_backend}${datos.url}`;
      if (datos.preview_url) {
        const prev_abs = /^https?:\/\//.test(datos.preview_url) ? datos.preview_url : `${origen_backend}${datos.preview_url}`;
        set_vista_previa(prev_abs);
      }
      try { setTimeout(() => { if (typeof window !== 'undefined') window.location.reload(); }, 1200); } catch (_) {}
    } catch (err) {
      set_error(err?.message || 'Error al subir la foto');
    } finally {
      set_subiendo(false);
    }
  };

  return (
    <div className="mx-auto py-6 px-10">
      <div className=" mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-800 mb-5">{nombre_mostrar}</h2>

          {/* Vista previa del avatar */}
          <div className="items-center gap-4 mb-6 place-items-center">
            <div className="w-60 h-60 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden ">
              {vista_previa ? (
                <img src={vista_previa} alt="Vista previa" className="w-full h-full object-cover" onError={manejar_error_vista} />
              ) : (
                <FiImage className="text-gray-400" size={28} />
              )}
            </div>
            <div className="text-sm text-gray-500">
              <div>Selecciona una imagen para tu perfil.</div>
            </div>
          </div>

          {/* Selector de archivo */}
          <form onSubmit={subir_foto} className="space-y-4">
            <div>
          <label className="block text-sm font-semibold text-gray-800 mb-2">Foto de perfil</label>
          <input
            type="file"
            accept="image/jpeg,image/png"
            onChange={manejar_archivo}
            className="w-full text-sm border rounded-lg px-3 py-2 cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {/* Editor de ajuste manual */}
          {editor_src && (
            <div className="mt-4 place-items-center">
              <label className="block text-sm font-semibold text-gray-800 mb-2">Ajuste previo al subir</label>
              <div
                className="w-48 h-48 rounded-full overflow-hidden border border-gray-300 bg-gray-100 relative select-none"
                onMouseDown={(e) => { set_dragging(true); set_drag_start({ x: e.clientX - editor_pos.x, y: e.clientY - editor_pos.y }); }}
                onMouseMove={(e) => { if (dragging) set_editor_pos({ x: e.clientX - drag_start.x, y: e.clientY - drag_start.y }); }}
                onMouseUp={() => set_dragging(false)}
                onMouseLeave={() => set_dragging(false)}
              >
                <canvas
                  ref={canvasRef}
                  width={EDITOR_BOX}
                  height={EDITOR_BOX}
                  style={{ position: 'absolute', left: 0, top: 0, width: EDITOR_BOX, height: EDITOR_BOX }}
                />
              </div>
              <div className="mt-3 flex items-center gap-3">
                <label className="text-xs text-gray-700">Zoom</label>
                <input
                  type="range"
                  min={0.8}
                  max={3}
                  step={0.01}
                  value={editor_scale}
                  onChange={(e) => set_editor_scale(parseFloat(e.target.value))}
                />
                <span className="ml-auto text-xs text-gray-500">El ajuste se aplicará al subir</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">Consejo: arrastra la imagen para centrarla y usa el zoom para acercar/alejar.</p>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2 text-center">Formatos permitidos: JPG y PNG. Tamaño máximo: 5MB.</p>
        </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800">
                <FiXCircle />
                <span>{error}</span>
              </div>
            )}

            {mostrar_mensaje && mensaje && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                <FiCheckCircle />
                <span>{mensaje}</span>
              </div>
            )}

            <div className="flex justify-center">
              <button
                type="submit"
                disabled={subiendo || !archivo}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiUploadCloud />
                {subiendo ? 'Subiendo...' : 'Subir Foto'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
