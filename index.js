// En: atu-mining-backend/index.js

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Telegraf, session } = require('telegraf');
const User = require('./models/User');

// --- CONFIGURACIÓN DE EXPRESS ---
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

// --- CONEXIÓN A MONGODB ---
mongoose.connect(process.env.DATABASE_URL)
  .then(() => console.log('✅ Conectado a MongoDB Atlas.'))
  .catch((error) => console.error('❌ Error al conectar a MongoDB:', error.message));

// --- CONFIGURACIÓN DEL BOT DE TELEGRAF ---
const bot = new Telegraf(process.env.BOT_TOKEN);
app.locals.bot = bot; // Hacemos el bot accesible para las rutas
bot.use(session());

// Lógica del bot (start, comandos de admin, etc.)
bot.start((ctx) => {
    const miniAppUrl = process.env.MINI_APP_URL;
    if (!miniAppUrl) {
        return ctx.reply('La aplicación no está configurada. Contacta al administrador.');
    }
    ctx.reply('¡Bienvenido a ATU Mining!', {
        reply_markup: {
            inline_keyboard: [[{ text: '🚀 Abrir App de Minería', web_app: { url: miniAppUrl } }]]
        }
    });
});
// (Aquí irán tus comandos de admin como /approve, /find, etc.)

// --- RUTAS DE LA API ---
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/mining', require('./routes/miningRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/referrals', require('./routes/referralRoutes'));
// (Añade aquí cualquier otra ruta que tengas)

// --- CONFIGURACIÓN DEL WEBHOOK DE TELEGRAF ---
const secretPath = `/telegraf/${bot.token}`;
// Telegraf procesará las actualizaciones de Telegram que lleguen a esta ruta
app.use(bot.webhookCallback(secretPath));

// --- INICIO DEL SERVIDOR ---
app.listen(PORT, () => {
  console.log(`🚀 Servidor Express corriendo en el puerto ${PORT}`);
  const backendUrl = process.env.RENDER_EXTERNAL_URL;

  // Si estamos en producción en Render, configuramos el webhook
  if (backendUrl) {
    const webhookUrl = `${backendUrl}${secretPath}`;
    console.log(`Configurando webhook para Telegram en: ${webhookUrl}`);
    bot.telegram.setWebhook(webhookUrl);
  } else {
    // Si estamos en local, usamos polling (bot.launch())
    console.warn('ADVERTENCIA: RENDER_EXTERNAL_URL no definida. Iniciando bot en modo polling para desarrollo local.');
    bot.launch();
  }
});

// Manejo de errores y cierre limpio
bot.catch((err, ctx) => {
  console.error(`Error procesando update ${ctx.update.update_id}:`, err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// --- INICIO DEL SERVIDOR ---
app.listen(PORT, () => {
  console.log(`🚀 Servidor Express corriendo en el puerto ${PORT}`);
});
