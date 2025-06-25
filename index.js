// En: atu-mining-backend/index.js
// VERSIÓN FINAL REVISADA Y CORREGIDA

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Corregido: require('cors')
const { Telegraf, session } = require('telegraf');

// --- MODELOS ---
const User = require('./models/User');
const Transaction = require('./models/Transaction');
const PendingDeposit = require('./models/PendingDeposit');

// --- RUTAS ---
const userRoutes = require('./routes/userRoutes');
const miningRoutes = require('./routes/miningRoutes');
const taskRoutes = require('./routes/taskRoutes');
const referralRoutes = require('./routes/referralRoutes');
const boostRoutes = require('./routes/boostRoutes');
const transactionRoutes = require('./routes/transactionRoutes'); // Asegúrate de tener este archivo y ruta
const webhookRoutes = require('./routes/webhookRoutes');

// --- INICIALIZACIÓN DE EXPRESS ---
const app = express();
const PORT = process.env.PORT || 3001;

// --- MIDDLEWARES GLOBALES ---
app.use(cors());
app.use(express.json());

// --- CONFIGURACIÓN DE TELEGRAF ---
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = parseInt(process.env.ADMIN_TELEGRAM_ID, 10);
app.locals.bot = bot;
bot.use(session());

// --- LÓGICA DEL BOT ---

// Middleware para actualizar datos del usuario en cada interacción
bot.use(async (ctx, next) => {
    if (ctx.from) {
        try {
            await User.updateOne({ telegramId: ctx.from.id }, { $set: { username: ctx.from.username, firstName: ctx.from.first_name } }, { upsert: true });
        } catch (e) { console.error("Error en middleware de usuario:", e); }
    }
    return next();
});

// Comando /start
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

// Lógica de aprobación/rechazo de depósitos
bot.on('callback_query', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('Acción no autorizada.');

    const [action, depositId] = ctx.callbackQuery.data.split(':');
    if (!['approve_deposit', 'reject_deposit'].includes(action)) return ctx.answerCbQuery();
    
    try {
        const deposit = await PendingDeposit.findById(depositId);
        if (!deposit || deposit.status !== 'pending') {
            return ctx.editMessageText(`Esta acción ya fue procesada.`);
        }
        const user = await User.findOne({ telegramId: deposit.telegramId });
        if (!user) return ctx.editMessageText(`Usuario no encontrado.`);

        if (action === 'approve_deposit') {
            user.usdtBalance += deposit.amount;
            deposit.status = 'approved';
            const newTransaction = new Transaction({ telegramId: user.telegramId, type: 'deposit', description: 'Depósito USDT (BEP20)', amount: `+${deposit.amount.toFixed(4)} USDT` });
            await newTransaction.save();
            await user.save();
            await deposit.save();
            await ctx.editMessageText(`✅ Depósito de ${deposit.amount.toFixed(4)} USDT para @${user.username} APROBADO.`);
            await bot.telegram.sendMessage(user.telegramId, `🎉 ¡Tu depósito de ${deposit.amount.toFixed(4)} USDT ha sido aprobado!`);
        } else {
            deposit.status = 'rejected';
            await deposit.save();
            await ctx.editMessageText(`❌ Depósito de ${deposit.amount.toFixed(4)} USDT para @${user.username} RECHAZADO.`);
            await bot.telegram.sendMessage(user.telegramId, `⚠️ Tu depósito de ${deposit.amount.toFixed(4)} USDT ha sido rechazado.`);
        }
    } catch (error) {
        console.error("Error procesando callback de depósito:", error);
        await ctx.answerCbQuery('Error al procesar la acción.');
    }
});


// --- REGISTRO DE RUTAS DE LA API ---
app.use('/api/users', userRoutes);
app.use('/api/mining', miningRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/boosts', boostRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/webhooks', webhookRoutes);

// --- ARRANQUE DEL SERVIDOR Y WEBHOOKS ---
const startServer = async () => {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('✅ Conectado a MongoDB.');

        const secretPath = `/telegraf/${bot.token}`;
        app.use(bot.webhookCallback(secretPath));

        app.listen(PORT, () => {
            console.log(`🚀 Servidor Express corriendo en el puerto ${PORT}.`);
            const backendUrl = process.env.RENDER_EXTERNAL_URL;
            if (backendUrl) {
                console.log(`Modo Producción: Configurando webhook de Telegraf en: ${backendUrl}${secretPath}`);
                bot.telegram.setWebhook(`${backendUrl}${secretPath}`);
            } else {
                console.warn('Modo Desarrollo: Iniciando bot en modo polling.');
                bot.launch();
            }
        });
    } catch (error) {
        console.error('❌ FALLO CRÍTICO AL INICIAR EL SERVIDOR:', error);
        process.exit(1);
    }
};

startServer();

// Manejo de errores y señales de terminación
bot.catch((err, ctx) => console.error(`Error de Telegraf para ${ctx.updateType}:`, err));
if (process.env.NODE_ENV !== 'production') {
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
