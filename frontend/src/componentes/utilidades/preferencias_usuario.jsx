import React from 'react';
import { useInicioSesion } from '../pagina_inicial/inicio_sesion/contexto/inicio_sesion-Context';
import { obtener_preferencias_usuario, guardar_preferencias_usuario, iniciar_ws, on_evento_ws } from './estado_persistente.jsx';

const Ctx = React.createContext(null);

export const ProveedorPreferenciasUsuario = ({ children }) => {
  const { token } = useInicioSesion();
  const [tema, setTema] = React.useState('claro');
  const [idioma, setIdioma] = React.useState('es');
  const [cargando, setCargando] = React.useState(true);

  React.useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const pref = await obtener_preferencias_usuario(token);
        if (!cancelado) {
          if (pref?.tema) setTema(pref.tema);
          if (pref?.idioma) setIdioma(pref.idioma);
        }
      } finally { if (!cancelado) setCargando(false); }
    })();
    try {
      iniciar_ws(token);
      const off = on_evento_ws('preferencias_actualizadas', (data) => {
        if (data?.tema) setTema(data.tema);
        if (data?.idioma) setIdioma(data.idioma);
      });
      return () => { cancelado = true; off && off(); };
    } catch (_) { return () => { cancelado = true; }; }
  }, [token]);

  const actualizar_tema = React.useCallback(async (nuevo) => {
    setTema(nuevo);
    try { await guardar_preferencias_usuario({ tema: nuevo, idioma }, token); } catch (_) {}
  }, [idioma, token]);

  const actualizar_idioma = React.useCallback(async (nuevo) => {
    setIdioma(nuevo);
    try { await guardar_preferencias_usuario({ tema, idioma: nuevo }, token); } catch (_) {}
  }, [tema, token]);

  const valor = React.useMemo(() => ({ tema, idioma, cargando, actualizar_tema, actualizar_idioma }), [tema, idioma, cargando, actualizar_tema, actualizar_idioma]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
};

export const usePreferenciasUsuario = () => {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error('usePreferenciasUsuario debe usarse dentro de ProveedorPreferenciasUsuario');
  return ctx;
};

