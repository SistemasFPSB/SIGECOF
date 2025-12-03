const { Pool } = require('pg');
require('dotenv').config({ quiet: true });

// Control de nivel de logs (configurable por .env)
const LOG_QUERIES = process.env.DB_LOG_QUERIES === 'true';
const LOG_ERRORS = process.env.DB_LOG_ERRORS !== 'false'; // por defecto true
const LOG_POOL = process.env.DB_LOG_POOL === 'true';

// Configuración de la conexión a PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD),
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT),
  // Configuraciones adicionales para producción
  max: 20, // máximo número de conexiones en el pool
  idleTimeoutMillis: 300000, // 5 minutos antes de cerrar conexiones inactivas
  connectionTimeoutMillis: 5000, // 5 segundos para establecer conexión
  acquireTimeoutMillis: 60000, // 60 segundos para obtener conexión del pool
  ssl: false // Desactivar SSL para desarrollo local
});

// Manejo de eventos del pool
pool.on('connect', (client) => {
  if (LOG_POOL) {
    console.log('✅ Nueva conexión establecida a PostgreSQL');
  }
});

pool.on('error', (err, client) => {
  if (LOG_ERRORS) {
    console.error('❌ Error en la conexión a PostgreSQL:', err.message);
    console.log('🔄 El servidor continuará ejecutándose. Intentando reconectar...');
  }
  
  // Intentar reconectar después de un breve delay
  setTimeout(async () => {
    try {
      await testConnection();
      if (LOG_POOL) {
        console.log('✅ Reconexión exitosa a la base de datos');
      }
    } catch (reconnectErr) {
      if (LOG_ERRORS) {
        console.error('❌ Fallo en reconexión:', reconnectErr.message);
      }
    }
  }, 5000);
});

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  console.log('🔄 Cerrando conexiones de base de datos...');
  await pool.end();
  console.log('✅ Conexiones cerradas correctamente');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🔄 Cerrando conexiones de base de datos...');
  await pool.end();
  console.log('✅ Conexiones cerradas correctamente');
  process.exit(0);
});

// Función para probar la conexión
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    if (LOG_POOL) {
      console.log('🔗 Conexión a base de datos exitosa:', result.rows[0].now);
    }
    client.release();
    return true;
  } catch (err) {
    if (LOG_ERRORS) {
      console.error('❌ Error al conectar con la base de datos:', err.message);
    }
    return false;
  }
};

// Función para ejecutar queries con reintentos
const query = async (text, params, retries = 3) => {
  const start = Date.now();
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      
      // Mostrar queries solo si está habilitado
      if (LOG_QUERIES) {
        console.log('📊 Query ejecutado:', { text: text.substring(0, 100), duration, rows: res.rowCount });
      }
      
      return res;
    } catch (err) {
      if (LOG_ERRORS) {
        console.error(`❌ Error en query (intento ${attempt}/${retries}):`, { 
          text: text.substring(0, 100), 
          error: err.message 
        });
      }
      
      // Evitar reintentos en violaciones de unicidad
      if (err && (err.code === '23505' /* unique_violation */)) {
        throw err;
      }

      // Si es el último intento, lanzar el error
      if (attempt === retries) {
        throw err;
      }
      
      // Esperar antes del siguiente intento
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};

// Función para obtener un cliente del pool
const getClient = async () => {
  return await pool.connect();
};

// Exportar también alias en snake_case y español
module.exports = {
  pool,
  query,
  getClient,
  testConnection,
  consultar: query,
  obtener_cliente: getClient,
  probar_conexion: testConnection
};