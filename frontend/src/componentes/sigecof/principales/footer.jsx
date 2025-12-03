import React from 'react';
import { BsStars } from 'react-icons/bs';
const Footer = ({ sidebarColapsado }) => {
  return (
    <footer className={`bg-blue-900 text-white border-t border-blue-800 transition-all duration-700 ease-in-out ${
      sidebarColapsado ? 'ml-16' : 'ml-64'
    } px-6 py-4`}>
      <div className="flex flex-col md:flex-row items-center justify-between text-sm">
        {/* Lado izquierdo - Logo e información */}
        <div className="flex items-center space-x-3 mb-2 md:mb-0">
          <div className="flex items-center justify-center">
            {/* Usar ruta absoluta desde /public para evitar ruptura en sub-rutas */}
            <img src="/images/logo_gob_fpsb_blanco.png" alt="Logo SIGECOF" className="w-30 h-10" />
          </div>
          <span className="text-slate-300 text-xs">© 2025 SIGECOF - Sistema Integral de Gestión y Control del FOPESIBAN</span>
        </div>

        {/* Lado derecho - Enlaces */}
        <div className="flex flex-wrap justify-center md:justify-end gap-4 md:gap-6">
          <a href="mailto:sistemas@fopesiban.net?cc=jcolinsa@fopesiban.net&subject=Solicitud%20de%20soporte%20en%20plataforma%20SIGECOF&body=" className="hover:text-blue-200 transition-colors duration-700 flex items-center gap-2">
            <BsStars className="w-4 h-4" />
            <span>Soporte Técnico</span>
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
