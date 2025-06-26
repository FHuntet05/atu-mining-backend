// --- Importaciones de Módulos ---
require('dotenv').config();

const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

// --- Importaciones de Módulos Locales ---
const User = require('./models/User.js'); // Importamos el modelo con el nuevo método
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

// --- Lógica del Bot (Comandos, Eventos, etc.) ---

// --- INICIO DE CORRECCIÓN EN EL COMANDO /start ---
bot.start(async (ctx) => {
  try {
    // 1. Usamos nuestro nuevo y robusto método centralizado.
    //    `ctx.from` tiene el mismo formato que `initData.user`, por lo que es compatible.
    const user = await User.findOrCreate(ctx.from);

    // 2. Lógica de Referidos
    //    Procesamos el referido solo si el usuario es realmente nuevo.
    //    El `findOrCreate` NO nos dice si el usuario es nuevo, así que ajustamos la lógica.
    const startPayload = ctx.startPayload;
    if (startPayload && !user.referrerId && user.telegramId.toString() !== startPayload) {
        const referrer = await User.findOne({ telegramId: startPayload });
        if (referrer) {
            // Verificamos que el referido no esté ya en la lista para evitar duplicados
            if (!referrer.referrals.includes(user._id)) {
                user.referrerId = referrer._id;
                await user.save();
                
                referrer.referrals.push(user._id);
                // Aquí iría tu lógica para la misión de invitar a 10 amigos, si es necesario.
                await referrer.save();
            }
        }
    }
    
    // 3. Enviamos el mensaje de bienvenida
    const welcomeMessage = `¡Bienvenido a ATU Mining, ${user.firstName}! 🚀\n\n` +
      `Estás a punto de entrar a nuestro ecosistema de minería gamificada.\n\n` +
      `¡Haz clic en el botón de abajo para empezar a minar ahora! 👇`;

    await ctx.reply(welcomeMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💎 Abrir Minero", web_app: { url: process.env.MINI_APP_URL } }]
        ]
      }
    });

  } catch (error) {
    console.error('Error en el comando /start:', error);
    await ctx.reply('Ocurrió un error al procesar tu inicio. Por favor, intenta de nuevo más tarde.');
  }
});
// --- FIN DE CORRECCIÓN EN EL COMANDO /start ---


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