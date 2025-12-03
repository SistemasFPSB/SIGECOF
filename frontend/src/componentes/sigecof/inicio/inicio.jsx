import React from 'react';
import { FiHome, FiPieChart, FiBell, FiSettings } from 'react-icons/fi';
import { TbUserHeart } from 'react-icons/tb';
import { MdOutlineBeachAccess } from 'react-icons/md';
const Inicio = () => {
  return (
    <div className="bg-white">
      <div className="max-w-screen-2xl mx-auto px-6 py-8">
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-8 mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <FiHome className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Sistema Integral de Gestión y Control Financiero</h2>
              <p className="text-gray-700">SIGECOF · FOPESIBAN</p>
            </div>
          </div>
          <p className="text-gray-700 leading-relaxed">
            Organiza, administra y controla la información financiera con una experiencia clara, segura y orientada al trabajo diario.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3 mb-3">
              <TbUserHeart className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">Padrón</h3>
            </div>
            <p className="text-gray-600">Administra el padrón de usuarios y registros de forma centralizada.</p>
          </div>
          <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3 mb-3">
              <MdOutlineBeachAccess className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">Vacaciones e Incidencias</h3>
            </div>
            <p className="text-gray-600">Administra las vacaciones y incidencias de tus colaboradores.</p>
          </div>
          <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3 mb-3">
              <FiPieChart className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">Dashboard</h3>
            </div>
            <p className="text-gray-600">Consulta indicadores generales y el estado del sistema.</p>
          </div>
          <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3 mb-3">
              <FiBell className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">Notificaciones</h3>
            </div>
            <p className="text-gray-600">Mantente al día con avisos relevantes para tu rol.</p>
          </div>
          <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3 mb-3">
              <FiSettings className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">Ajustes</h3>
            </div>
            <p className="text-gray-600">Configura preferencias y gestiona datos de tu perfil.</p>
          </div>
          <div className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3 mb-3">
              <FiHome className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">Página Inicial</h3>
            </div>
            <p className="text-gray-600">Visualiza componentes públicos como carrusel, comunicados y normatividad.</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h4 className="text-lg font-semibold text-gray-800 mb-3">Sugerencias de uso</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
              <p className="text-gray-700">Verifica tu perfil en ajustes para mantener tus datos actualizados.</p>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
              <p className="text-gray-700">Revisa notificaciones al iniciar sesión para conocer novedades.</p>
            </div>
            <div className="bg-sky-50 border border-sky-100 rounded-lg p-4">
              <p className="text-gray-700">Utiliza el menú lateral para acceder rápidamente a cada sección.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Inicio;
