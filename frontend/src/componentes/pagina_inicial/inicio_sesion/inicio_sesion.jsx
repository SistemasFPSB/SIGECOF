import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';


import { useInicioSesion } from './contexto/inicio_sesion-Context';
import { useControlNotificaciones } from '../../sigecof/administrador/administrador_notificaciones.jsx';
import { FaSignInAlt, FaUserPlus, FaKey, FaCheckCircle, FaExclamationTriangle, FaUser, FaLock, FaEyeSlash, FaEye, FaIdCard, FaArrowRight, FaPhoneAlt, FaEnvelope } from 'react-icons/fa';
 

/**
 * Componente de Autenticación Unificado
 * Combina inicio de sesión, registro y recuperación de contraseña
 */
const InicioSesion = ({ modo_inicial = null }) => {
  const navigate = useNavigate();
  const { login, registro, requiereCambioContrasena } = useInicioSesion();
  const { procesar_evento, rol_actual, refrescar_notificaciones, mostrar_popup } = useControlNotificaciones();
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
  // Estado para controlar el modo actual
  const [modo_actual, setModoActual] = useState(modo_inicial || 'login'); // 'login', 'registro', 'recuperar_contrasena', 'cambiar_contrasena', 'exito'
  
  // Estados para los formularios
  const [datos_login, setDatosLogin] = useState({
    usuario: '',
    contrasena: ''
  });
  
  const [datos_registro, setDatosRegistro] = useState({
    nombre_completo: '',
    usuario: '',
    contrasena: '',
    confirmar_contrasena: '',
  });
  
  const [datos_recuperacion, setDatosRecuperacion] = useState({
    usuario: ''
  });
  
  const [datos_cambio_contrasena, setDatosCambioContrasena] = useState({
    contrasena_actual: '',
    nueva_contrasena: '',
    confirmar_nueva_contrasena: ''
  });
  
  // Estados comunes
  const [errores, setErrores] = useState({});
  const [mostrar_contrasena, setMostrarContrasena] = useState(false);
  const [mostrar_confirmar_contrasena, setMostrarConfirmarContrasena] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [mensaje_exito, setMensajeExito] = useState('');
  const [recordarme, setRecordarme] = useState(false);
  const [mostrar_contacto, setMostrarContacto] = useState(false);

  const separarMensajeError = (texto) => {
    const str = String(texto || '');
    const partes = str.split('. ');
    return {
      principal: partes[0],
      detalle: partes.slice(1).join('. '),
    };
  };

  // Verificar si el usuario requiere cambio de contraseña
  useEffect(() => {
    if (!modo_inicial) {
      // Consultar al backend si el usuario requiere cambio de contraseña mediante cookie/sesión
      (async () => {
        try {
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
          const r = await fetch(`${API_URL}/autenticacion/estado_cambio_contrasena`, { credentials: 'include' });
          if (r.ok) {
            const d = await r.json();
            if (d?.requiere_cambio_contrasena) setModoActual('cambiar_contrasena');
          }
        } catch (_) {}
      })();
    }
  }, [modo_inicial]);

  useEffect(() => {
    if (requiereCambioContrasena) setModoActual('cambiar_contrasena');
  }, [requiereCambioContrasena]);

  useEffect(() => { /* Preferencia de 'recordarme' gestionada por backend */ }, []);

  /**
   * Maneja los cambios en los campos del formulario
   */
  const manejarCambioInput = (e, tipo_formulario = modo_actual) => {
    const { name, value } = e.target;
    
    switch (tipo_formulario) {
      case 'login':
        setDatosLogin(prev => ({ ...prev, [name]: value }));
        break;
      case 'registro':
        setDatosRegistro(prev => ({ ...prev, [name]: value }));
        break;
      case 'recuperar_contrasena':
        setDatosRecuperacion(prev => ({ ...prev, [name]: value }));
        break;
      case 'cambiar_contrasena':
        setDatosCambioContrasena(prev => ({ ...prev, [name]: value }));
        break;
      default:
        break;
    }
    
    // Limpiar errores
    if (errores[name]) {
      setErrores(prev => ({ ...prev, [name]: '' }));
    }
  };

  /**
   * Cambia el modo con animación
   */
  const cambiarModo = (nuevo_modo) => {
    setModoActual(nuevo_modo);
    setErrores({});
    setMensajeExito('');
    // Al volver al login, limpiar SOLO el campo contraseña, conservando el usuario
    if (nuevo_modo === 'login') {
      setDatosLogin(prev => ({ ...prev, contrasena: '' }));
    }
  };

  /**
   * Validaciones para login
   */
  const validarLogin = () => {
    const nuevos_errores = {};
    
    if (!datos_login.usuario.trim()) {
      nuevos_errores.usuario = 'El nombre de usuario es requerido';
    }
    
    if (!datos_login.contrasena.trim()) {
      nuevos_errores.contrasena = 'La contraseña es requerida';
    }
    
    setErrores(nuevos_errores);
    return Object.keys(nuevos_errores).length === 0;
  };

  /**
   * Validaciones para registro
   */
  const validarRegistro = () => {
    const nuevos_errores = {};
    
    if (!datos_registro.nombre_completo.trim()) {
      nuevos_errores.nombre_completo = 'El nombre completo es requerido';
    } else if (datos_registro.nombre_completo.length < 3) {
      nuevos_errores.nombre_completo = 'El nombre debe tener al menos 3 caracteres';
    }
    
    if (!datos_registro.usuario.trim()) {
      nuevos_errores.usuario = 'El nombre de usuario es requerido';
    } else if (datos_registro.usuario.length < 3) {
      nuevos_errores.usuario = 'El nombre de usuario debe tener al menos 3 caracteres';
    } else if (!/^[a-zA-Z0-9_]+$/.test(datos_registro.usuario)) {
      nuevos_errores.usuario = 'El usuario solo puede contener letras, números y guiones bajos';
    }
    
    if (!datos_registro.contrasena.trim()) {
      nuevos_errores.contrasena = 'La contraseña es requerida';
    } else if (datos_registro.contrasena.length < 6) {
      nuevos_errores.contrasena = 'La contraseña debe tener al menos 6 caracteres';
    }
    
    if (!datos_registro.confirmar_contrasena.trim()) {
      nuevos_errores.confirmar_contrasena = 'Confirma tu contraseña';
    } else if (datos_registro.contrasena !== datos_registro.confirmar_contrasena) {
      nuevos_errores.confirmar_contrasena = 'Las contraseñas no coinciden';
    }
    
    setErrores(nuevos_errores);
    return Object.keys(nuevos_errores).length === 0;
  };

  /**
   * Validaciones para recuperación de contraseña
   */
  const validarRecuperacion = () => {
    const nuevos_errores = {};
    
    if (!datos_recuperacion.usuario.trim()) {
      nuevos_errores.usuario = 'El nombre de usuario es requerido';
    }
    
    setErrores(nuevos_errores);
    return Object.keys(nuevos_errores).length === 0;
  };

  /**
   * Validaciones para cambio de contraseña
   */
  const validarCambioContrasena = () => {
    const nuevos_errores = {};
    
    if (!datos_cambio_contrasena.contrasena_actual.trim()) {
      nuevos_errores.contrasena_actual = 'La contraseña actual es requerida';
    }
    
    if (!datos_cambio_contrasena.nueva_contrasena.trim()) {
      nuevos_errores.nueva_contrasena = 'La nueva contraseña es requerida';
    } else if (datos_cambio_contrasena.nueva_contrasena.length < 6) {
      nuevos_errores.nueva_contrasena = 'La nueva contraseña debe tener al menos 6 caracteres';
    }
    
    if (!datos_cambio_contrasena.confirmar_nueva_contrasena.trim()) {
      nuevos_errores.confirmar_nueva_contrasena = 'Confirma tu nueva contraseña';
    } else if (datos_cambio_contrasena.nueva_contrasena !== datos_cambio_contrasena.confirmar_nueva_contrasena) {
      nuevos_errores.confirmar_nueva_contrasena = 'Las contraseñas no coinciden';
    }
    
    setErrores(nuevos_errores);
    return Object.keys(nuevos_errores).length === 0;
  };

  /**
   * Maneja el login
   */
  const manejarLogin = async (e) => {
    e.preventDefault();
    
    if (validarLogin()) {
      setCargando(true);
      
      try {
        const resultado = await login(datos_login.usuario, datos_login.contrasena, recordarme);
        
        if (resultado && resultado.exito) {
          const estatus_raw = String(resultado?.usuario?.estatus || '').toLowerCase();
          const esta_activo = typeof resultado?.usuario?.activo === 'boolean'
            ? resultado.usuario.activo
            : (estatus_raw ? estatus_raw === 'activo' : true);
          if (!esta_activo) {
            setErrores({ general: 'Tu cuenta está inactiva. Ponte en contacto con un administrador.' });
            setCargando(false);
            return;
          }
          if (resultado?.requiere_cambio_contrasena) { setModoActual('cambiar_contrasena'); return; }
          // Verificar estado de cambio de contraseña desde backend
          try {
            const r = await fetch(`${API_URL}/autenticacion/estado_cambio_contrasena`, { credentials: 'include' });
            if (r.ok) {
              const d = await r.json();
              if (d?.requiere_cambio_contrasena) { setModoActual('cambiar_contrasena'); return; }
            }
          } catch (_) {}
          
          // Refrescar notificaciones tras iniciar sesión exitosamente
          try {
            await refrescar_notificaciones();
            mostrar_popup();
          } catch (_) {}

          // Redirigir al aplicativo principal
          navigate('/app');
          // Asegurar popup/badge una vez montada la UI de app
          try {
            setTimeout(async () => {
              try { await refrescar_notificaciones(); } catch (_) {}
              try { mostrar_popup(); } catch (_) {}
            }, 200);
          } catch (_) {}
        } else {
          setErrores({ general: (resultado && (resultado.mensaje || resultado.error)) || 'Error al iniciar sesión' });
        }
        
      } catch (error) {
        // Mostrar el mensaje específico del backend si está disponible
        setErrores({ general: error?.message || 'Error inesperado. Intente nuevamente.' });
      } finally {
        setCargando(false);
      }
    }
  };

  /**
   * Maneja el registro
   */
  const manejarRegistro = async (e) => {
    e.preventDefault();
    
    if (validarRegistro()) {
      setCargando(true);
      setErrores({});
      
      try {
        const datos = await registro({
          nombre_completo: datos_registro.nombre_completo,
          usuario: datos_registro.usuario,
          contrasena: datos_registro.contrasena,
        });
        
        if (datos && datos.exito) {
          setMensajeExito(
            'Registro exitoso. Tu cuenta ha sido creada con un rol pendiente. ' +
            'Un administrador debe aprobar y asignar tu rol antes de que puedas acceder al sistema.'
          );
          setModoActual('exito');
          try { mostrar_popup(); } catch (_) {}
          
          
          // Limpiar formulario
          setDatosRegistro({
            nombre_completo: '',
            usuario: '',
            contrasena: '',
            confirmar_contrasena: '',
          });
          
        } else {
          setErrores({ general: (datos && (datos.mensaje || datos.error)) || 'Error al registrar usuario' });
        }
        
      } catch (error) {
        setErrores({ general: error?.message || 'Error de conexión. Verifique que el servidor esté funcionando.' });
      } finally {
        setCargando(false);
      }
    }
  };

  /**
   * Maneja la recuperación de contraseña
   */
  const manejarRecuperacion = async (e) => {
    e.preventDefault();
    
    if (validarRecuperacion()) {
      setCargando(true);
      setErrores({});
      
      try {
        const respuesta = await fetch(`${API_URL}/autenticacion/recuperar_contrasena`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            usuario: datos_recuperacion.usuario
          })
        });
        
        const datos = await respuesta.json();
        
        if (datos.exito) {
          setMensajeExito(
            `Se ha generado una contraseña temporal para el usuario ${datos_recuperacion.usuario}. ` +
            'Contacta al administrador del sistema para obtenerla.'
          );
          setModoActual('exito');
          try { /* no-op */ } catch (_) {}
          
        } else {
          setErrores({ general: datos.message || 'Error al procesar la solicitud' });
        }
        
      } catch (error) {
        setErrores({ general: error?.message || 'Error de conexión. Verifique que el servidor esté funcionando.' });
      } finally {
        setCargando(false);
      }
    }
  };

  /**
   * Maneja el cambio de contraseña obligatorio
   */
  const manejarCambioContrasena = async (e) => {
    e.preventDefault();
    
    if (validarCambioContrasena()) {
      setCargando(true);
      setErrores({});
      
      try {
        // Usar sesión/cookie en backend; evitar token en almacenamiento local
        const token = null;
        const respuesta = await fetch(`${API_URL}/autenticacion/cambiar_contrasena`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          credentials: 'include',
          body: JSON.stringify({
            currentPassword: datos_cambio_contrasena.contrasena_actual,
            newPassword: datos_cambio_contrasena.nueva_contrasena
          })
        });
        
        const datos = await respuesta.json();
        
        if (datos.exito) {
          // Tras cambiar la contraseña exitosamente, limpiar el token para evitar que el
          // guard de rutas siga leyendo el flag antiguo (requiere_cambio_contrasena).
          // Forzar re-autenticación con la nueva contraseña.
          setMensajeExito(
            '¡Contraseña cambiada exitosamente! Por seguridad, inicia sesión nuevamente con tu nueva contraseña.'
          );
          setModoActual('exito');
          // No navegar automáticamente al aplicativo; permitir al usuario volver al login.
          
        } else {
          setErrores({ general: datos.mensaje || datos.error || 'Error al cambiar la contraseña' });
        }
        
      } catch (error) {
        setErrores({ general: error?.message || 'Error de conexión. Verifique que el servidor esté funcionando.' });
      } finally {
        setCargando(false);
      }
    }
  };

  /**
   * Obtiene la configuración del header según el modo
   */
  const obtenerConfiguracionHeader = () => {
    const configuraciones = {
      login: {
        titulo: 'Bienvenido a SIGECOF',
        subtitulo: 'Sistema de Gestión y Control Financiero',
        mensaje: 'Accede a tu cuenta para continuar',
        icono: <FaSignInAlt className="text-3xl" />
      },
      registro: {
        titulo: 'Registro en SIGECOF',
        subtitulo: 'Sistema de Gestión y Control Financiero',
        mensaje: 'Crea tu cuenta para solicitar acceso',
        icono: <FaUserPlus className="text-3xl" />
      },
      recuperar_contrasena: {
        titulo: 'Recuperar Contraseña',
        subtitulo: 'Sistema de Gestión y Control Financiero',
        mensaje: '¿Olvidaste tu contraseña? Te ayudamos a recuperarla',
        icono: <FaKey className="text-3xl" />
      },
      cambiar_contrasena: {
        titulo: 'Cambiar Contraseña',
        subtitulo: 'Sistema de Gestión y Control Financiero',
        mensaje: 'Debes cambiar tu contraseña temporal para continuar',
        icono: <FaKey className="text-3xl" />
      },
      exito: {
        titulo: '¡Proceso Completado!',
        subtitulo: 'Sistema de Gestión y Control Financiero',
        mensaje: 'Tu solicitud ha sido procesada exitosamente',
        icono: <FaCheckCircle className="text-3xl" />
      }
    };
    
    return configuraciones[modo_actual] || configuraciones.login;
  };

  /**
   * Renderiza el formulario de login
   */
  const renderizarFormularioLogin = () => (
    <form onSubmit={manejarLogin} className="space-y-6">
      {/* Error general */}
      {errores.general && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3 text-red-700">
            <FaExclamationTriangle className="text-xl flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium break-words">{separarMensajeError(errores.general).principal}</div>
              {separarMensajeError(errores.general).detalle && (
                <div className="text-sm break-words">{separarMensajeError(errores.general).detalle}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Campo de usuario */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Usuario</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaUser className="text-gray-400" />
          </div>
          <input
            type="text"
            name="usuario"
            value={datos_login.usuario}
            onChange={(e) => manejarCambioInput(e, 'login')}
            className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
              errores.usuario ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Ingresa tu nombre de usuario"
            autoComplete="username"
          />
        </div>
        {errores.usuario && (
          <span className="text-red-600 text-sm flex items-center gap-1">
            <FaExclamationTriangle className="text-xs" />
            {errores.usuario}
          </span>
        )}
      </div>

      {/* Campo de contraseña */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Contraseña</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaLock className="text-gray-400" />
          </div>
          <input
            type={mostrar_contrasena ? 'text' : 'password'}
            name="contrasena"
            value={datos_login.contrasena}
            onChange={(e) => manejarCambioInput(e, 'login')}
            className={`block w-full pl-10 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
              errores.contrasena ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Ingresa tu contraseña"
            autoComplete="current-password"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => setMostrarContrasena(!mostrar_contrasena)}
          >
            {mostrar_contrasena ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
        {errores.contrasena && (
          <span className="text-red-600 text-sm flex items-center gap-1">
            <FaExclamationTriangle className="text-xs" />
            {errores.contrasena}
          </span>
        )}
      </div>

      {/* Opciones adicionales */}
      <div className="flex justify-between items-center">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            name="recordarme"
            checked={recordarme}
            onChange={(e) => setRecordarme(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span>Recordarme</span>
        </label>
        <button
          type="button"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
          onClick={() => cambiarModo('recuperar_contrasena')}
        >
          ¿Olvidaste tu contraseña?
        </button>
      </div>

      {/* Botón de inicio de sesión */}
      <button
        type="submit"
        className={`w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-300 hover:from-blue-700 hover:to-blue-800 hover:shadow-lg flex items-center justify-center gap-2 ${
          cargando ? 'opacity-70 cursor-not-allowed' : ''
        }`}
        disabled={cargando}
      >
        {cargando ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Iniciando sesión...</span>
          </>
        ) : (
          <>
            <FaSignInAlt />
            <span>Iniciar Sesión</span>
          </>
        )}
      </button>

      {/* Cambiar a registro */}
      <div className="text-center">
        <button
          type="button"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
          onClick={() => cambiarModo('registro')}
        >
          ¿No tienes cuenta? Regístrate aquí
        </button>
      </div>
    </form>
  );

  /**
   * Renderiza el formulario de registro
   */
  const renderizarFormularioRegistro = () => (
    <form onSubmit={manejarRegistro} className="space-y-6">
      {/* Error general */}
      {errores.general && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3 text-red-700">
            <FaExclamationTriangle className="text-xl flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium break-words">{separarMensajeError(errores.general).principal}</div>
              {separarMensajeError(errores.general).detalle && (
                <div className="text-sm break-words">{separarMensajeError(errores.general).detalle}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Campo de nombre completo */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Nombre Completo</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaIdCard className="text-gray-400" />
          </div>
          <input
            type="text"
            name="nombre_completo"
            value={datos_registro.nombre_completo}
            onChange={(e) => manejarCambioInput(e, 'registro')}
            className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
              errores.nombre_completo ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Ingresa tu nombre completo"
            autoComplete="name"
          />
        </div>
        {errores.nombre_completo && (
          <span className="text-red-600 text-sm flex items-center gap-1">
            <FaExclamationTriangle className="text-xs" />
            {errores.nombre_completo}
          </span>
        )}
      </div>

      {/* Campo de usuario */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Usuario</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaUser className="text-gray-400" />
          </div>
          <input
            type="text"
            name="usuario"
            value={datos_registro.usuario}
            onChange={(e) => manejarCambioInput(e, 'registro')}
            className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
              errores.usuario ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Elige un nombre de usuario"
            autoComplete="username"
          />
        </div>
        {errores.usuario && (
          <span className="text-red-600 text-sm flex items-center gap-1">
            <FaExclamationTriangle className="text-xs" />
            {errores.usuario}
          </span>
        )}
      </div>



      {/* Campo de contraseña */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Contraseña</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaLock className="text-gray-400" />
          </div>
          <input
            type={mostrar_contrasena ? 'text' : 'password'}
            name="contrasena"
            value={datos_registro.contrasena}
            onChange={(e) => manejarCambioInput(e, 'registro')}
            className={`block w-full pl-10 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
              errores.contrasena ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Crea una contraseña segura"
            autoComplete="new-password"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => setMostrarContrasena(!mostrar_contrasena)}
          >
            {mostrar_contrasena ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
        {errores.contrasena && (
          <span className="text-red-600 text-sm flex items-center gap-1">
            <FaExclamationTriangle className="text-xs" />
            {errores.contrasena}
          </span>
        )}
      </div>

      {/* Campo de confirmar contraseña */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Confirmar Contraseña</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaLock className="text-gray-400" />
          </div>
          <input
            type={mostrar_confirmar_contrasena ? 'text' : 'password'}
            name="confirmar_contrasena"
            value={datos_registro.confirmar_contrasena}
            onChange={(e) => manejarCambioInput(e, 'registro')}
            className={`block w-full pl-10 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
              errores.confirmar_contrasena ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Confirma tu contraseña"
            autoComplete="new-password"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => setMostrarConfirmarContrasena(!mostrar_confirmar_contrasena)}
          >
            {mostrar_confirmar_contrasena ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
        {errores.confirmar_contrasena && (
          <span className="text-red-600 text-sm flex items-center gap-1">
            <FaExclamationTriangle className="text-xs" />
            {errores.confirmar_contrasena}
          </span>
        )}
      </div>

      {/* Información importante */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="font-medium text-blue-800 mb-2">Importante:</p>
        <ul className="text-blue-700 text-sm space-y-1">
          <li>• Tu cuenta será creada con rol pendiente</li>
          <li>• Un administrador debe aprobar tu acceso</li>
          <li>• Recibirás notificación cuando sea aprobada</li>
        </ul>
      </div>

      {/* Botón de registro */}
      <button
        type="submit"
        className={`w-full bg-gradient-to-r from-green-600 to-green-700 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-300 hover:from-green-700 hover:to-green-800 hover:shadow-lg flex items-center justify-center gap-2 ${
          cargando ? 'opacity-70 cursor-not-allowed' : ''
        }`}
        disabled={cargando}
      >
        {cargando ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Registrando...</span>
          </>
        ) : (
          <>
            <FaUserPlus />
            <span>Crear Cuenta</span>
          </>
        )}
      </button>

      {/* Cambiar a login */}
      <div className="text-center">
        <button
          type="button"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
          onClick={() => cambiarModo('login')}
        >
          ¿Ya tienes cuenta? Inicia sesión
        </button>
      </div>
    </form>
  );

  /**
   * Renderiza el formulario de recuperación de contraseña
   */
  const renderizarFormularioRecuperacion = () => (
    <form onSubmit={manejarRecuperacion} className="space-y-6">
      {/* Error general */}
      {errores.general && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3 text-red-700">
            <FaExclamationTriangle className="text-xl flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium break-words">{separarMensajeError(errores.general).principal}</div>
              {separarMensajeError(errores.general).detalle && (
                <div className="text-sm break-words">{separarMensajeError(errores.general).detalle}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Campo de usuario */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Usuario</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaUser className="text-gray-400" />
          </div>
          <input
            type="text"
            name="usuario"
            value={datos_recuperacion.usuario}
            onChange={(e) => manejarCambioInput(e, 'recuperar_contrasena')}
            className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
              errores.usuario ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Ingresa tu nombre de usuario"
            autoComplete="username"
          />
        </div>
        {errores.usuario && (
          <span className="text-red-600 text-sm flex items-center gap-1">
            <FaExclamationTriangle className="text-xs" />
            {errores.usuario}
          </span>
        )}
      </div>

      {/* Información del proceso */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <p className="font-medium text-yellow-800 mb-2">¿Cómo funciona?</p>
        <ul className="text-yellow-700 text-sm space-y-1">
          <li>• Ingresa tu nombre de usuario</li>
          <li>• Se generará una contraseña temporal</li>
          <li>• Contacta al administrador para obtenerla</li>
          <li>• Cambia tu contraseña al iniciar sesión</li>
        </ul>
      </div>

      {/* Botón de envío */}
      <button
        type="submit"
        className={`w-full bg-gradient-to-r from-orange-600 to-orange-700 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-300 hover:from-orange-700 hover:to-orange-800 hover:shadow-lg flex items-center justify-center gap-2 ${
          cargando ? 'opacity-70 cursor-not-allowed' : ''
        }`}
        disabled={cargando}
      >
        {cargando ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Procesando...</span>
          </>
        ) : (
          <>
            <FaKey />
            <span>Solicitar Restablecimiento</span>
          </>
        )}
      </button>

      {/* Volver al login */}
      <div className="text-center">
        <button
          type="button"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
          onClick={() => cambiarModo('login')}
        >
          ← Volver al inicio de sesión
        </button>
      </div>
    </form>
  );

  /**
   * Renderiza el formulario de cambio de contraseña obligatorio
   */
  const renderizarFormularioCambioContrasena = () => (
    <form onSubmit={manejarCambioContrasena} className="space-y-6">
      {/* Error general */}
      {errores.general && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3 text-red-700">
            <FaExclamationTriangle className="text-xl flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium break-words">{separarMensajeError(errores.general).principal}</div>
              {separarMensajeError(errores.general).detalle && (
                <div className="text-sm break-words">{separarMensajeError(errores.general).detalle}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Información importante */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-center gap-2 text-red-800 mb-2">
          <FaExclamationTriangle />
          <p className="font-medium">Cambio de Contraseña Obligatorio</p>
        </div>
        <ul className="text-red-700 text-sm space-y-1">
          <li>• Estás usando una contraseña temporal</li>
          <li>• Debes cambiarla para acceder al sistema</li>
          <li>• Usa una contraseña segura y fácil de recordar</li>
        </ul>
      </div>

      {/* Campo de contraseña actual */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Contraseña Temporal Actual</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaKey className="text-gray-400" />
          </div>
          <input
            type={mostrar_contrasena ? 'text' : 'password'}
            name="contrasena_actual"
            value={datos_cambio_contrasena.contrasena_actual}
            onChange={(e) => manejarCambioInput(e, 'cambiar_contrasena')}
            className={`block w-full pl-10 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
              errores.contrasena_actual ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Ingresa tu contraseña temporal"
            autoComplete="current-password"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => setMostrarContrasena(!mostrar_contrasena)}
          >
            {mostrar_contrasena ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
        {errores.contrasena_actual && (
          <span className="text-red-600 text-sm flex items-center gap-1">
            <FaExclamationTriangle className="text-xs" />
            {errores.contrasena_actual}
          </span>
        )}
      </div>

      {/* Campo de nueva contraseña */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Nueva Contraseña</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaLock className="text-gray-400" />
          </div>
          <input
            type={mostrar_confirmar_contrasena ? 'text' : 'password'}
            name="nueva_contrasena"
            value={datos_cambio_contrasena.nueva_contrasena}
            onChange={(e) => manejarCambioInput(e, 'cambiar_contrasena')}
            className={`block w-full pl-10 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
              errores.nueva_contrasena ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Crea una nueva contraseña segura"
            autoComplete="new-password"
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => setMostrarConfirmarContrasena(!mostrar_confirmar_contrasena)}
          >
            {mostrar_confirmar_contrasena ? <FaEyeSlash /> : <FaEye />}
          </button>
        </div>
        {errores.nueva_contrasena && (
          <span className="text-red-600 text-sm flex items-center gap-1">
            <FaExclamationTriangle className="text-xs" />
            {errores.nueva_contrasena}
          </span>
        )}
      </div>

      {/* Campo de confirmar nueva contraseña */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Confirmar Nueva Contraseña</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaLock className="text-gray-400" />
          </div>
          <input
            type="password"
            name="confirmar_nueva_contrasena"
            value={datos_cambio_contrasena.confirmar_nueva_contrasena}
            onChange={(e) => manejarCambioInput(e, 'cambiar_contrasena')}
            className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
              errores.confirmar_nueva_contrasena ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Confirma tu nueva contraseña"
            autoComplete="new-password"
          />
        </div>
        {errores.confirmar_nueva_contrasena && (
          <span className="text-red-600 text-sm flex items-center gap-1">
            <FaExclamationTriangle className="text-xs" />
            {errores.confirmar_nueva_contrasena}
          </span>
        )}
      </div>

      {/* Requisitos de contraseña */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="font-medium text-gray-800 mb-2">Requisitos de la contraseña:</p>
        <ul className="text-gray-700 text-sm space-y-1">
          <li>• Mínimo 6 caracteres</li>
        </ul>
      </div>

      {/* Botón de cambio */}
      <button
        type="submit"
        className={`w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-300 hover:from-purple-700 hover:to-purple-800 hover:shadow-lg flex items-center justify-center gap-2 ${
          cargando ? 'opacity-70 cursor-not-allowed' : ''
        }`}
        disabled={cargando}
      >
        {cargando ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Cambiando contraseña...</span>
          </>
        ) : (
          <>
            <FaKey />
            <span>Cambiar Contraseña</span>
          </>
        )}
      </button>
    </form>
  );

  /**
   * Renderiza el mensaje de éxito
   */
  const renderizarMensajeExito = () => (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <FaCheckCircle className="text-green-600 text-3xl" />
      </div>
      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">¡Proceso Completado!</h3>
        <p className="text-gray-600 leading-relaxed">{mensaje_exito}</p>
      </div>
      <button 
        onClick={() => cambiarModo('login')}
        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-xl font-semibold transition-all duration-300 hover:from-blue-700 hover:to-blue-800 hover:shadow-lg flex items-center justify-center gap-2"
      >
        <span>Ir al Login</span>
        <FaArrowRight />
      </button>
    </div>
  );

  /**
   * Renderiza el contenido según el modo actual
   */
  const renderizarContenido = () => {
    switch (modo_actual) {
      case 'login':
        return renderizarFormularioLogin();
      case 'registro':
        return renderizarFormularioRegistro();
      case 'recuperar_contrasena':
        return renderizarFormularioRecuperacion();
      case 'cambiar_contrasena':
        return renderizarFormularioCambioContrasena();
      case 'exito':
        return renderizarMensajeExito();
      default:
        return renderizarFormularioLogin();
    }
  };

  const configuracion_header = obtenerConfiguracionHeader();

  return (
    <div className="bg-gradient-to-br from-blue-900 to-black flex items-center justify-center p-24 h-screen w-screen">
      {/* Tarjeta principal con hover */}
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-3xl">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Columna izquierda - Header y branding */}
          <div className="bg-gradient-to-br from-sky-400 to-indigo-700 p-8 lg:p-12 text-white">
            <div className="flex flex-col h-full justify-center">
              <div className="text-center">
                {/* Logo con hover */}
                <div className="flex justify-center lg:justify-center mb-6">
                  <img 
                    src="/images/LOGO.png" 
                    alt="Logo FPSB" 
                    className="h-60 w-auto transition-transform duration-300 hover:scale-105"
                  />
                </div>
                <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
                  <h1 className="text-5xl font-bold">{configuracion_header.titulo}</h1>
                </div>
                <div className="p-2 bg-white/20 rounded-lg place-self-center">
                    {configuracion_header.icono}
                  </div>
                <p className="text-blue-100 text-lg mb-4 py-3">{configuracion_header.subtitulo}</p>
                <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
                  <p className="text-white/90">{configuracion_header.mensaje}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Columna derecha - Contenido dinámico */}
          <div className="p-8 lg:p-12">
            <div className="h-full flex flex-col justify-center">
              <div className="mb-8">
                {renderizarContenido()}
              </div>

              <div className="border-t border-gray-200 pt-6 mt-6">
                <p className="text-center text-gray-600 text-sm">
                  ¿Necesitas ayuda?{' '}
                  <button
                    type="button"
                    className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                    onClick={() => setMostrarContacto(!mostrar_contacto)}
                  >
                    Contacta soporte
                  </button>
                </p>
                {mostrar_contacto && (
                  <div className="bg-gray-50 rounded-xl p-4 mt-4">
                    <h3 className="text-gray-900 font-semibold mb-1">Contacto de Soporte</h3>
                    <p className="text-gray-600 text-sm mb-4">Si necesitas ayuda, comunícate con nosotros.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 py-2">
                        <FaPhoneAlt className="text-green-600" />
                        <div>
                          <div className="text-sm text-gray-700">Teléfono</div>
                          <div className="text-sm text-gray-900 font-medium">+55 5480-6840</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 py-2">
                        <FaEnvelope className="text-purple-600" />
                        <div>
                          <div className="text-sm text-gray-700">Correos </div>
                          <div className="text-sm text-gray-900 font-medium pb-3">sistemas@fopesiban.net</div>
                          <div className="text-sm text-gray-900 font-medium">jcolinsa@fopesiban.net</div>
                        </div>
                      </div>
                    <div className="mt-4 text-xs text-gray-500">Horario de atención: Lun–Vie 9:00–18:00 hrs.</div>
                  </div>
                )}
                <div className="flex items-center justify-center gap-2 text-gray-500 text-xs mt-2">
                  <span>© 2025 SIGECOF</span>
                  <span>•</span>
                  <span>Versión 0.0.1</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InicioSesion;
