import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const ContextoMensajesConfirmacion = createContext(null);

export const ProveedorMensajesConfirmacion = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [opciones, setOpciones] = useState({});
  const [modo, setModo] = useState('confirmar'); // 'confirmar' | 'informar'
  const resolverRef = useRef(null);

  const confirmar = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setOpciones({
        titulo: opts.titulo || 'Confirmar acción',
        mensaje: opts.mensaje || '¿Desea continuar?',
        tipo: opts.tipo || 'advertencia',
        texto_confirmar: opts.texto_confirmar || 'Confirmar',
        texto_cancelar: opts.texto_cancelar || 'Cancelar',
      });
      setModo('confirmar');
      setVisible(true);
    });
  }, []);

  const informar = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setOpciones({
        titulo: opts.titulo || 'Información',
        mensaje: opts.mensaje || 'Operación realizada',
        tipo: opts.tipo || 'informacion',
        texto_confirmar: opts.texto_confirmar || 'Aceptar',
      });
      setModo('informar');
      setVisible(true);
    });
  }, []);

  const cerrar = useCallback(() => {
    setVisible(false);
    setOpciones({});
    setModo('confirmar');
  }, []);

  const onConfirmar = useCallback(() => {
    const r = resolverRef.current;
    resolverRef.current = null;
    cerrar();
    if (typeof r === 'function') r(true);
  }, [cerrar]);

  const onCancelar = useCallback(() => {
    const r = resolverRef.current;
    resolverRef.current = null;
    cerrar();
    if (typeof r === 'function') r(false);
  }, [cerrar]);

  useEffect(() => {
    const onKey = (e) => {
      if (!visible) return;
      if (e.key === 'Escape') onCancelar();
      if (e.key === 'Enter') onConfirmar();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [visible, onCancelar, onConfirmar]);

  const valor = { confirmar, informar };

  return (
    <ContextoMensajesConfirmacion.Provider value={valor}>
      {children}
      {visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={onCancelar} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 border border-gray-200">
            <div className="flex items-start gap-3 p-4 border-b">
              {opciones.tipo === 'advertencia' ? (
                <FiAlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
              ) : opciones.tipo === 'informacion' ? (
                <FiInfo className="w-6 h-6 text-blue-600 flex-shrink-0" />
              ) : (
                <FiCheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-800">{opciones.titulo}</h3>
                <p className="text-gray-600 mt-1">{opciones.mensaje}</p>
              </div>
              <button aria-label="Cerrar" className="p-2 rounded hover:bg-gray-100" onClick={onCancelar}>
                <FiX className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-end gap-3">
              {modo === 'confirmar' && (
                <button
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-50"
                  onClick={onCancelar}
                >
                  {opciones.texto_cancelar}
                </button>
              )}
              <button
                className={
                  opciones.tipo === 'advertencia'
                    ? 'px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white'
                    : opciones.tipo === 'informacion'
                    ? 'px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white'
                    : 'px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white'
                }
                onClick={onConfirmar}
              >
                {opciones.texto_confirmar}
              </button>
            </div>
          </div>
        </div>
      )}
    </ContextoMensajesConfirmacion.Provider>
  );
};

export const useMensajesConfirmacion = () => {
  const ctx = useContext(ContextoMensajesConfirmacion);
  if (!ctx) throw new Error('useMensajesConfirmacion debe usarse dentro de ProveedorMensajesConfirmacion');
  return ctx;
};