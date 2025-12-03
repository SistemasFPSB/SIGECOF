// Servidor de notificaciones (Express)
const express = require('express');
const cors = require('cors');
const eventosRouter = require('./rutas/notificaciones_eventos');
const configuracionRouter = require('./rutas/notificaciones_configuracion');

const app = express();
app.use(cors());
app.use(express.json());

app.use(eventosRouter);
app.use(configuracionRouter);

const puerto = process.env.PORT || 5000;
if (require.main === module) {
  app.listen(puerto, () => {
    console.log(`API notificaciones escuchando en puerto ${puerto}`);
  });
}

module.exports = { app };

