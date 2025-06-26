require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

// --- Importaciones de Módulos Locales ---
const User = require('./models/User.js');
const transactionService = require('./services/transaction.service.js');
const apiRoutes = require('./routes'); // <-- MODIFICACIÓN CLAVE: Esto ahora importará 'routes/index.js'

// --- Configuración de la App Express ---
const app = express();
app.use(cors());
app.use(express.json());

// --- Conexión a la Base de Datos ---
mongoose.connect(process.env.DATABASE_URL)
  .then(() => console.log('MongoDB conectado exitosamente.'))
  .catch(err => console.error('Error de conexión a MongoDB:', err));

// --- Inicialización del Bot de Telegram ---
const bot = new Telegraf(process.env.BOT_TOKEN);

// --- Lógica del Bot (Comandos, Eventos, etc.) ---
// ... (Toda tu lógica de bot.start, bot.on('new_chat_members'), etc. va aquí sin cambios) ...
bot.start(async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const firstName = ctx.from.first_name || 'Usuario';
    const username = ctx.from.username;
    
    let user = await User.findOne({ telegramId });
    const startPayload = ctx.startPayload;

    if (!user) {
      // ... (Lógica de creación de usuario y referido) ...
      user = new User({
        telegramId,
        firstName,
        username,
        // ... otros campos
      });
      await user.save();
    }
    
    // ... (Mensaje de bienvenida) ...
    const welcomeMessage = `¡Bienvenido a ATU Mining, ${firstName}! 🚀\n...`;
    await ctx.reply(welcomeMessage, {
      reply_markup: {
        inline_keyboard: [[{ text: "💎 Abrir Minero", web_app: { url: process.env.MINI_APP_URL } }]]
      }
    });
  } catch (error) {
    console.error('Error en /start:', error);
  }
});


// --- Montar las rutas de la API ---
// Todas las rutas definidas en la carpeta 'routes' estarán bajo el prefijo /api
app.use('/api', apiRoutes);

// --- Lanzamiento del Servidor y Bot ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor Express escuchando en el puerto ${PORT}`);
  transactionService.startCheckingTransactions(bot);
});

bot.launch(() => {
  console.log('Bot de Telegram iniciado.');
});

// Habilitar cierre gradual
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));