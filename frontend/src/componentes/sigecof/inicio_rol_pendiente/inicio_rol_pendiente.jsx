import { useNavigate } from 'react-router-dom';
import { AlertCircle, Shield, Key } from 'lucide-react';

export default function RolPendiente() {
  const navigate = useNavigate();
  const irACambioContrasena = () => {
    navigate('/ajustes/cambio_contrasena');
  };
  return (
    <div className="bg-white flex items-center justify-center py-8">
      <div className="max-w-6xl w-full bg-slate-50 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-white/20 p-3 rounded-full">
              <AlertCircle className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Rol Pendiente</h1>
        </div>

        {/* Main Content */}
        <div className="p-6 space-y-6">
          <div className="text-center space-y-4">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <Shield className="w-12 h-12 text-blue-600 mx-auto mb-3" />
              <p className="text-gray-700 leading-relaxed">
                Su cuenta actualmente tiene un rol <span className="font-semibold text-blue-600">Pendiente</span>, 
                por lo que no tiene acciones disponibles de momento dentro del sistema.
              </p>
            </div>

            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
              <p className="text-gray-700 leading-relaxed">
                Un <span className="font-semibold text-amber-600">rol administrador</span> debe validar su usuario 
                y asignarle un rol correspondiente a su cuenta.
              </p>
            </div>

            <div className="text-sm text-gray-500 italic">
              Mientras tanto, su cuenta permanecerá en estado de espera hasta que se complete este proceso.
            </div>
          </div>

          {/* Change Password Section */}
          <div className="border-t pt-6">
            <div className="flex items-center space-x-3 mb-4">
              <Key className="w-5 h-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-800">Cambio de Contraseña</h3>
            </div>
            <p className="text-gray-600 mb-4">
              Puede cambiar su contraseña si así lo desea, incluso mientras su rol está pendiente.
            </p>
            <button
              type="button"
              onClick={irACambioContrasena}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg"
            >
              Cambiar Contraseña
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 text-center">
          <p className="text-sm text-gray-500">
            Para más información, contacte al administrador del sistema.
          </p>
        </div>
      </div>
    </div>
  );
}
