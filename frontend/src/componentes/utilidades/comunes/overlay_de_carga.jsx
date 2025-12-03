import React from 'react';

const OverlayDeCarga = ({ visible = false, texto = 'Recargando…', imagen = null }) => {
  const [fallback, setFallback] = React.useState(!imagen);

  const ocultar = (typeof window !== 'undefined') ? !!window.__ocultar_overlay_carga : false;
  if (!visible || ocultar) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 p-6 rounded-lg">
        {fallback ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white/70" />
          </div>
        ) : (
          <img
            src={imagen}
            alt="Cargando"
            className="h-16 w-16 object-contain"
            onError={() => setFallback(true)}
          />
        )}
        <span className="text-white text-sm tracking-wide">{texto}</span>
      </div>
    </div>
  );
};

export default OverlayDeCarga;
