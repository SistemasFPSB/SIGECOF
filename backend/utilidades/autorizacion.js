// backend/utilidades/autorizacion.js
// Middleware de autorización por rol para el backend
const { obtener_usuario_por_usuario } = require('../modelos/usuarios');

/**
 * Middleware que verifica que el usuario autenticado tenga alguno de los roles permitidos
 * Uso: router.get('/ruta', authMiddleware, requiere_rol(['admin']), handler)
 * - Si el token incluye el rol en su payload, se usa directamente
 * - Si no incluye rol, se consulta la BD por el usuario actual
 */
const requiere_rol = (roles_permitidos = []) => {
  const permitidos = Array.isArray(roles_permitidos) ? roles_permitidos : [roles_permitidos];
  return async (req, res, next) => {
    try {
      const usuario = req.user?.usuario;
      if (!usuario) {
        return res.status(401).json({ error: 'No autenticado' });
      }

      let rol_actual = req.user?.rol;
      if (!rol_actual) {
        const existente = await obtener_usuario_por_usuario(usuario);
        rol_actual = existente?.rol || 'pendiente';
      }

      if (permitidos.length > 0 && !permitidos.includes(rol_actual)) {
        return res.status(403).json({ 
          error: 'Acceso denegado',
          detalle: `Rol requerido: ${permitidos.join(', ')}, rol actual: ${rol_actual}`
        });
      }
      return next();
    } catch (error) {
      return res.status(500).json({ error: 'Error de autorización', detalle: error.message });
    }
  };
};

module.exports = { requiere_rol };