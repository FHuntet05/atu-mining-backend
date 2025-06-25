// En: atu-mining-backend/index.js

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Telegraf } = require('telegraf');
const User = require('./models/User');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

mongoose.connect(process.env.DATABASE_URL)
  .then(() => console.log('✅ Conectado a MongoDB Atlas.'))
  .catch((error) => console.error('❌ Error al conectar a MongoDB:', error.message));

// --- CONFIGURACIÓN CENTRALIZADA DEL BOT ---
const bot = new Telegraf(process.env.BOT_TOKEN);

// --- ¡INYECCIÓN DE DEPENDENCIAS! ---
// Hacemos que la instancia del bot sea accesible en todas las rutas a través de `req.app.locals.bot`
app.locals.bot = bot;

// Lógica del Bot (start y comandos de admin)
bot.start(async (ctx) => { /* ... (código de /start sin cambios) ... */ });
// (Aquí van tus comandos de admin como /approve, /find, etc.)

// --- RUTAS DE LA API ---
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/mining', require('./routes/miningRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes')); // Ahora tendrá acceso al bot
app.use('/api/referrals', require('./routes/referralRoutes'));

// --- CONFIGURACIÓN DEL WEBHOOK ---
const secretPath = `/telegraf/${bot.token}`;
app.use(bot.webhookCallback(secretPath));

// --- INICIO DEL SERVIDOR Y BOT ---
app.listen(PORT, () => {
  console.log(`🚀 Servidor Express corriendo.`);
  const backendUrl = process.env.RENDER_EXTERNAL_URL;
  if (backendUrl) {
    console.log(`Configurando webhook en: ${backendUrl}${secretPath}`);
    bot.telegram.setWebhook(`${backendUrl}${secretPath}`);
  } else {
    console.warn('RENDER_EXTERNAL_URL no definida.');
  }
});

bot.catch((err, ctx) => {
  console.error(`Error para ${ctx.updateType}`, err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
