class ColaEventos {
  constructor() {
    this.cola = [];
    this.esta_listo = false;
    this.escuchadores = [];
    this.configuracion = null;
  }

  inicializar(configuracion) {
    this.configuracion = configuracion || null;
    this.esta_listo = true;
    this.procesar_cola();
  }

  agregar_escuchador(fn) {
    if (typeof fn === 'function') {
      this.escuchadores.push(fn);
    }
  }

  agregar_evento(tipo_evento, datos) {
    const evento = {
      tipo_evento,
      datos,
      marca_tiempo: new Date(),
    };
    if (this.esta_listo) {
      this.procesar_evento(evento);
    } else {
      this.cola.push(evento);
    }
  }

  procesar_cola() {
    while (this.cola.length > 0) {
      const evento = this.cola.shift();
      this.procesar_evento(evento);
    }
  }

  async procesar_evento(evento) {
    for (const fn of this.escuchadores) {
      try {
        await Promise.resolve(fn(evento));
      } catch (_) {}
    }
  }
}

export const cola_eventos = new ColaEventos();

