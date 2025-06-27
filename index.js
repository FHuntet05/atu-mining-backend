// --- Importaciones de Módulos ---
require('dotenv').config();

const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

// --- Importaciones de Módulos Locales ---
const User = require('./models/User.js');
const transactionService = require('./services/transaction.service.js');
const apiRoutes = require('./routes/index.js');

// --- Configuración de la Aplicación Express ---
const app = express();
app.use(cors());
app.use(express.json());

// --- Conexión a la Base de Datos MongoDB ---
mongoose.connect(process.env.DATABASE_URL)
  .then(() => console.log('✅ MongoDB conectado exitosamente.'))
  .catch(err => console.error('❌ Error de conexión a MongoDB:', err));

// --- Verificación de Variables de Entorno Críticas ---
if (!process.env.BOT_TOKEN || !process.env.WEBHOOK_URL) {
    console.error('❌ ERROR CRÍTICO: Las variables de entorno BOT_TOKEN y WEBHOOK_URL son requeridas.');
    process.exit(1);
}

// --- Inicialización del Bot de Telegram ---
const bot = new Telegraf(process.env.BOT_TOKEN);
app.locals.bot = bot;
// --- Lógica del Bot (Comandos, Eventos, etc.) ---

// --- INICIO DE LA MODIFICACIÓN: Nuevo Mensaje de Bienvenida ---
bot.start(async (ctx) => {
  try {
    // Usamos el método centralizado para encontrar o crear al usuario.
    const user = await User.findOrCreate(ctx.from);
    
    // Usamos el `firstName` del usuario para el mensaje, ya que el `username` puede no existir.
    const username = user.firstName || 'MINERO'; 

    // Lógica de Referidos (si aplica)
    const startPayload = ctx.startPayload;
    if (startPayload && !user.referrerId && user.telegramId.toString() !== startPayload) {
        const referrer = await User.findOne({ telegramId: startPayload });
        if (referrer) {
            if (!referrer.referrals.includes(user._id)) {
                user.referrerId = referrer._id;
                await user.save();
                referrer.referrals.push(user._id);
                await referrer.save();
            }
        }
    }
    
    // Aquí está tu nuevo mensaje de bienvenida, formateado y listo.
    const welcomeMessage = `⚡️ ¡BIENVENIDO/A, ${username.toUpperCase()}! ⚒️\n\n` +
        `🚀 ¡Prepárate para una aventura de minería legendaria!\n\n` +
        `✅ Completa desafíos diarios y gana recompensas en AUT Coins 💰.\n` +
        `⛏️ Mejora tu equipo de minería para aumentar tus ganancias.\n` +
        `🌐 Forma alianzas con otros mineros y domina el ranking.\n\n` +
        `👇 ¡Haz clic en Minar Ahora! para iniciar!\n` +
        `🕒 Únete antes de que se agoten las bonificaciones.` ;

    // Enviamos el mensaje de bienvenida junto con el botón para abrir la Mini App.
    await ctx.reply(welcomeMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💎 Minar Ahora!", web_app: { url: process.env.MINI_APP_URL } }]
        ]
      }
    });

  } catch (error) {
    console.error('Error en el comando /start:', error);
    await ctx.reply('Ocurrió un error al iniciar. Por favor, intenta de nuevo más tarde.');
  }
});
// --- FIN DE LA MODIFICACIÓN ---


// --- Configuración de Rutas de la API ---
app.use('/api', apiRoutes);

// --- Lógica de Webhook ---
const secretPath = `/telegraf/${bot.secretPathComponent()}`;
app.use(bot.webhookCallback(secretPath));

// --- Lanzamiento del Servidor ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, async () => {
  console.log(`✅ Servidor Express escuchando en el puerto ${PORT}`);
  try {
    const webhookUrl = `${process.env.WEBHOOK_URL}${secretPath}`;
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`✅ Webhook configurado exitosamente en Telegram.`);
  } catch (error) {
    console.error('❌ Error fatal al configurar el webhook:', error);
  }
  transactionService.startCheckingTransactions(bot);
});