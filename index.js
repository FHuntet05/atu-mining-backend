// En: atu-mining-backend/index.js
// CÓDIGO COMPLETO Y LISTO PARA PRODUCCIÓN

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Telegraf, session } = require('telegraf');

// Importar modelos
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const PendingDeposit = require('./models/PendingDeposit');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

mongoose.connect(process.env.DATABASE_URL).then(() => console.log('✅ Conectado a MongoDB.')).catch(e => console.error('❌ DB Error:', e));

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = parseInt(process.env.ADMIN_TELEGRAM_ID, 10);
app.locals.bot = bot; // Hacemos el bot accesible para las rutas
bot.use(session());

bot.use(async (ctx, next) => {
    if (ctx.from) {
        try {
            await User.updateOne({ telegramId: ctx.from.id }, { $set: { username: ctx.from.username, firstName: ctx.from.first_name } }, { upsert: true });
        } catch (e) { console.error("Error en middleware de usuario:", e); }
    }
    return next();
});

bot.start(async (ctx) => {
    const miniAppUrl = process.env.MINI_APP_URL;
    if (!miniAppUrl) return ctx.reply('Aplicación no configurada.');
    
    const startParam = ctx.startPayload; 
    if (startParam) {
        const referrerId = parseInt(startParam, 10);
        if (!isNaN(referrerId) && referrerId !== ctx.from.id) {
            try {
                await User.updateOne({ telegramId: referrerId }, { $addToSet: { referrals: ctx.from.id } });
                await User.updateOne({ telegramId: ctx.from.id }, { $set: { referrerId: referrerId } }, { upsert: true });
            } catch(e) { console.error("Error procesando referido:", e); }
        }
    }
    
    ctx.reply('¡Bienvenido a ATU Mining!', {
        reply_markup: { inline_keyboard: [[{ text: '🚀 Abrir App de Minería', web_app: { url: miniAppUrl } }]] }
    });
});

const adminOnly = (ctx, next) => {
    if (ctx.from && ctx.from.id === ADMIN_ID) return next();
};

// --- LÓGICA DE APROBACIÓN/RECHAZO DE DEPÓSITOS ---
bot.on('callback_query', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('Acción no autorizada.');

    const [action, depositId] = ctx.callbackQuery.data.split(':');
    if (!['approve_deposit', 'reject_deposit'].includes(action)) {
        // Si no es una acción de depósito, podemos dejar que otros handlers de callback lo procesen
        // Por ahora, solo respondemos para que el cliente de Telegram no se quede esperando.
        return ctx.answerCbQuery();
    }
    
    try {
        const deposit = await PendingDeposit.findById(depositId);
        if (!deposit || deposit.status !== 'pending') {
            await ctx.editMessageText(`Esta acción ya fue procesada para el depósito ${depositId}.`);
            return ctx.answerCbQuery('Acción ya realizada.');
        }
        
        const user = await User.findOne({ telegramId: deposit.telegramId });
        if (!user) {
            await ctx.editMessageText(`Usuario del depósito (${deposit.telegramId}) no encontrado.`);
            return ctx.answerCbQuery('Usuario no encontrado.');
        }

        if (action === 'approve_deposit') {
            user.usdtBalance += deposit.amount;
            deposit.status = 'approved';
            
            const newTransaction = new Transaction({
                telegramId: user.telegramId,
                type: 'deposit',
                description: 'Depósito USDT (BEP20)',
                amount: `+${deposit.amount.toFixed(4)} USDT`,
            });
            await newTransaction.save();
            await user.save();
            await deposit.save();

            await ctx.editMessageText(`✅ Depósito de ${deposit.amount.toFixed(4)} USDT para @${user.username} APROBADO.`);
            await bot.telegram.sendMessage(user.telegramId, `🎉 ¡Tu depósito de ${deposit.amount.toFixed(4)} USDT ha sido aprobado y añadido a tu saldo!`);
        } else { // reject_deposit
            deposit.status = 'rejected';
            await deposit.save();
            await ctx.editMessageText(`❌ Depósito de ${deposit.amount.toFixed(4)} USDT para @${user.username} RECHAZADO.`);
            await bot.telegram.sendMessage(user.telegramId, `⚠️ Tu depósito de ${deposit.amount.toFixed(4)} USDT ha sido rechazado. Contacta a soporte para más información.`);
        }
    } catch (error) {
        console.error("Error procesando callback de depósito:", error);
        await ctx.answerCbQuery('Error al procesar la acción.');
    }
});


// Comandos de Admin (se mantienen por si son necesarios como backup)
bot.command('approve', adminOnly, async (ctx) => { /* ... tu código actual ... */ });
bot.command('find', adminOnly, async (ctx) => { /* ... tu código actual ... */ });


// --- REGISTRO DE RUTAS DE LA API ---
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/mining', require('./routes/miningRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/referrals', require('./routes/referralRoutes'));
app.use('/api/boosts', require('./routes/boostRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/webhooks', require('./routes/webhookRoutes')); // Nuevas rutas para Moralis


// --- ARRANQUE DEL SERVIDOR Y WEBHOOK ---
const secretPath = `/telegraf/${bot.token}`;
app.use(bot.webhookCallback(secretPath));

const backendUrl = process.env.RENDER_EXTERNAL_URL;

app.listen(PORT, () => {
  console.log(`🚀 Servidor Express corriendo en el puerto ${PORT}.`);
  if (backendUrl) {
    console.log(`Modo Producción: Configurando webhook en: ${backendUrl}${secretPath}`);
    bot.telegram.setWebhook(`${backendUrl}${secretPath}`);
  } else { 
    console.warn('Modo Desarrollo: Iniciando en modo polling.'); 
    bot.launch(); 
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }
});

bot.catch((err, ctx) => console.error(`Error de Telegraf para ${ctx.updateType}`, err));
