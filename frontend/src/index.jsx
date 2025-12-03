import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

/* Puedes eliminar cualquier otro estilo que no uses */
import { servicio_notificaciones } from './componentes/sigecof/notificaciones/servicio_notificaciones.js';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ProveedorInicioSesion } from './componentes/pagina_inicial/inicio_sesion/contexto/inicio_sesion-Context';
import { ProveedorNotificaciones } from './componentes/sigecof/administrador/administrador_notificaciones.jsx';
import { ProveedorMensajesConfirmacion } from './componentes/utilidades/comunes/mensajes_confirmacion.jsx';

if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    const m = e && e.message ? String(e.message) : '';
    if (m.includes('ResizeObserver loop') || m.includes('ResizeObserver loop limit exceeded')) {
      e.preventDefault();
    }
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));

Promise.resolve().then(() => {
  try { servicio_notificaciones.inicializar(); } catch (_) {}
});

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <ProveedorInicioSesion>
        <ProveedorNotificaciones>
          <ProveedorMensajesConfirmacion>
            <App />
          </ProveedorMensajesConfirmacion>
        </ProveedorNotificaciones>
      </ProveedorInicioSesion>
    </BrowserRouter>
  </React.StrictMode>
);
