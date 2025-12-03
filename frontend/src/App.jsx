import { Routes, Route, Navigate } from 'react-router-dom';
import PaginaInicial from './componentes/pagina_inicial.jsx';
import InicioSesion from './componentes/pagina_inicial/inicio_sesion/inicio_sesion.jsx';
import Sigecof from './componentes/sigecof.jsx';
import { PermisosRuta } from './componentes/sigecof/administrador/roles_permisos.jsx';

function App() {
  const esLanding = (typeof window !== 'undefined') && window.location && window.location.port === '3030';

  if (esLanding) {
    return (
      <Routes>
        <Route path="/" element={<PaginaInicial />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<InicioSesion />} />
      <Route
        path="/:seccion/*"
        element={
          <PermisosRuta>
            <Sigecof />
          </PermisosRuta>
        }
      />
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

export default App;
