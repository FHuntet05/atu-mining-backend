// En: atu-mining-backend/index.js

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Telegraf } = require('telegraf');

// --- CONFIGURACIÓN DE EXPRESS ---
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

// --- CONEXIÓN A MONGODB ---
mongoose.connect(process.env.DATABASE_URL)
  .then(() => console.log('✅ Conectado a MongoDB Atlas.'))
  .catch((error) => console.error('❌ Error al conectar a MongoDB:', error.message));

// --- CONFIGURACIÓN DEL BOT ---
const bot = new Telegraf(process.env.BOT_TOKEN);

// --- LÓGICA DE COMANDOS DEL BOT ---
bot.start((ctx) => {
    const miniAppUrl = process.env.MINI_APP_URL;
    if (!miniAppUrl) {
        return ctx.reply('La aplicación no está configurada. Contacta al administrador.');
    }
    ctx.reply('¡Bienvenido a ATU Mining! Haz clic abajo para empezar.', {
        reply_markup: {
            inline_keyboard: [[{ text: '🚀 Abrir App de Minería', web_app: { url: miniAppUrl } }]]
        }
    });
});
// (Aquí irán tus comandos de admin en el futuro)

// --- CONFIGURACIÓN DEL WEBHOOK ---
// --- ¡AQUÍ ESTÁ LA CORRECCIÓN! ---
// Usamos backticks () para crear un template string correctamente.
    const secretPath = `/telegraf/${bot.token}`;

app.use(bot.webhookCallback(secretPath));

// --- RUTAS DE LA API ---
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);
// (Aquí irán tus otras rutas de la API)

// --- INICIO DEL SERVIDOR ---
app.listen(PORT, () => {
  console.log(`🚀 Servidor Express corriendo en el puerto ${PORT}`);
  
  const backendUrl = process.env.RENDER_EXTERNAL_URL;
  if (backendUrl) {
      console.log(Configurando webhook para Telegram en: ${backendUrl}${secretPath});
      bot.telegram.setWebhook(${backendUrl}${secretPath});
  } else {
      console.warn('Advertencia: RENDER_EXTERNAL_URL no está definida. No se pudo configurar el webhook. El bot no funcionará en producción.');
  }
});

// Manejo de errores del bot
bot.catch((err, ctx) => {
  console.error(Error para ${ctx.updateType}`, err);
});

// Aseguramos que el proceso no termine por errores inesperados
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
