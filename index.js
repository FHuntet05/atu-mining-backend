require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const User = require('./models/User');
const transactionService = require('./services/transaction.service');
const { setupRoutes } = require('./routes');
const express = require('express');
const cors = require('cors');

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

// --- INICIO DE MODIFICACIÓN: Comando /start y lógica de referidos ---
bot.start(async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const firstName = ctx.from.first_name || 'Usuario';
    const username = ctx.from.username;
    
    let user = await User.findOne({ telegramId });
    const startPayload = ctx.startPayload;

    // Lógica para crear nuevo usuario y manejar referidos
    if (!user) {
      let referrer = null;
      if (startPayload) {
        referrer = await User.findOne({ telegramId: startPayload });
        if (referrer) {
          // --- Lógica para Misión #3: Invitar a 10 usuarios ---
          referrer.missions.invitedUsersCount = (referrer.missions.invitedUsersCount || 0) + 1;
          
          // Verificar si alcanzó la meta y no ha reclamado la recompensa
          if (referrer.missions.invitedUsersCount === 10 && !referrer.missions.claimedInviteReward) {
            const rewardAmount = 5000; // Recompensa por invitar a 10 usuarios
            referrer.autBalance += rewardAmount;
            referrer.missions.claimedInviteReward = true;
            await bot.telegram.sendMessage(referrer.telegramId, 
              `🎉 ¡Felicidades! Has invitado a 10 usuarios y ganaste una recompensa de ${rewardAmount} AUT.`
            ).catch(e => console.error(`No se pudo notificar al referente ${referrer.telegramId}:`, e));
          }
          await referrer.save();
        }
      }

      user = new User({
        telegramId,
        firstName,
        username,
        referrerId: referrer ? referrer._id : null
      });
      await user.save();
      
      if(referrer) {
        referrer.referrals.push(user._id);
        await referrer.save();
      }
    }
    
    // Mensaje de bienvenida profesional
    const welcomeMessage = `¡Bienvenido a ATU Mining, ${firstName}! 🚀\n\n` +
      `Estás a punto de entrar a nuestro ecosistema de minería gamificada.\n\n` +
      `🔹 Mina nuestro token interno: AUT.\n` +
      `🔹 Intercámbialo por dinero real: 10,000 AUT = 1 USDT.\n` +
      `🔹 Acelera tu producción con Boosts.\n\n` +
      `💰 **Retiros:** El monto mínimo de retiro es de 1 USDT (red BEP20). Puedes solicitar un retiro cada 24 horas.\n\n` +
      `¡Haz clic abajo para empezar a minar ahora! 👇`;

    await ctx.reply(welcomeMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💎 Abrir Minero", web_app: { url: process.env.MINI_APP_URL } }]
        ]
      }
    });

  } catch (error) {
    console.error('Error en el comando /start:', error);
    ctx.reply('Ocurrió un error al procesar tu solicitud. Por favor, intenta de nuevo.');
  }
});
// --- FIN DE MODIFICACIÓN ---

// --- INICIO DE NUEVA FUNCIONALIDAD: Misión #1 - Unirse al grupo ---
bot.on('new_chat_members', async (ctx) => {
  const groupId = process.env.TELEGRAM_GROUP_ID || '-1002278930402';
  
  // Salir si el evento no es del grupo configurado
  if (ctx.chat.id.toString() !== groupId) {
    return;
  }

  try {
    for (const member of ctx.message.new_chat_members) {
      // Ignorar si el nuevo miembro es el propio bot
      if (member.is_bot) continue;

      const user = await User.findOne({ telegramId: member.id });

      // Si el usuario existe en nuestra DB y no ha completado la misión
      if (user && !user.missions.joinedGroup) {
        const rewardAmount = 500; // Recompensa por unirse
        user.autBalance = (user.autBalance || 0) + rewardAmount;
        user.missions.joinedGroup = true;
        await user.save();
        
        // Notificar al usuario en privado (con manejo de errores)
        await bot.telegram.sendMessage(member.id, 
          `🎉 ¡Gracias por unirte a nuestra comunidad! Has sido recompensado con ${rewardAmount} AUT.`
        ).catch(e => console.error(`No se pudo notificar al usuario ${member.id} sobre la recompensa del grupo:`, e));
      }
    }
  } catch (error) {
    console.error('Error al procesar nuevos miembros del grupo:', error);
  }
});
// --- FIN DE NUEVA FUNCIONALIDAD ---

// --- Rutas de la API y Lanzamiento ---
setupRoutes(app);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor Express escuchando en el puerto ${PORT}`);
  transactionService.startCheckingTransactions(bot); // Inicia el vigilante de BscScan
});

bot.launch(() => {
  console.log('Bot de Telegram iniciado.');
});

// Habilitar cierre gradual
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));