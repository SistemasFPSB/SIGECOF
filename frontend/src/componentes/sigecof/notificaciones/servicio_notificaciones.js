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

class ServicioNotificaciones {
  constructor() {
    this.inicializado = false;
    this.eventos_pendientes = [];
    this.configuracion = {};
  }

  async inicializar() {
    const configuracion = await this.cargar_configuracion_notificaciones();
    this.configuracion = configuracion || {};
    this.inicializado = true;
    await this.procesar_eventos_pendientes();
  }

  async disparar_evento(tipo_evento, datos) {
    const evento = {
      tipo: tipo_evento,
      datos,
      marca_tiempo: new Date(),
    };
    if (!this.inicializado) {
      this.eventos_pendientes.push(evento);
      return;
    }
    await this.procesar_evento(evento);
  }

  async procesar_evento(evento) {
    const config = this.configuracion ? this.configuracion[evento.tipo] : null;
    if (config && config.habilitado) {
      await this.enviar_notificacion(evento, config);
    }
  }

  async procesar_eventos_pendientes() {
    for (const evento of this.eventos_pendientes) {
      await this.procesar_evento(evento);
    }
    this.eventos_pendientes = [];
  }

  async cargar_configuracion_notificaciones() {
    const urls = [
      `${API_URL}/notificaciones_configuracion`,
      (typeof window !== 'undefined' ? `${window.location.origin}/api/notificaciones_configuracion` : null),
    ].filter(Boolean);
    for (const u of urls) {
      try {
        const res = await fetch(u, { credentials: 'include' });
        if (res.ok) return await res.json();
      } catch (_) {}
    }
    return {};
  }

  async enviar_notificacion(evento, config) {
    try {
      const urls = [
        `${API_URL}/notificaciones_eventos`,
        (typeof window !== 'undefined' ? `${window.location.origin}/api/notificaciones_eventos` : null),
      ].filter(Boolean);
      for (const u of urls) {
        try {
          const r = await fetch(u, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ tipo: evento.tipo, datos: evento.datos, config }),
          });
          if (r.ok) break;
        } catch (_) {}
      }
      // Si falla, no hacemos fallback a endpoints legacy
    } catch (_) {}
  }
}

export const servicio_notificaciones = new ServicioNotificaciones();
