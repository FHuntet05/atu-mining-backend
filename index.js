// En: atu-mining-backend/index.js
// VERSIÓN FINAL, COMPLETA Y ROBUSTA

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
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
const transactionRoutes = require('./routes/transactionRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const healthRoutes = require('./routes/healthRoutes'); // Mantenemos la ruta de prueba

// --- INICIALIZACIÓN DE EXPRESS ---
const app = express();
const PORT = process.env.PORT || 10000;

// --- MIDDLEWARES GLOBALES ---
app.use(cors());
app.use(express.json());

// --- CONFIGURACIÓN DE TELEGRAF ---
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = parseInt(process.env.ADMIN_TELEGRAM_ID, 10);
app.locals.bot = bot; // Hacemos el bot accesible para las rutas
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
    if (!miniAppUrl) {
        console.error("MINI_APP_URL no está definida en las variables de entorno.");
        return ctx.reply('La aplicación no está configurada correctamente. Por favor, contacta a soporte.');
    }
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
        reply_markup: {
            inline_keyboard: [[{ 
                text: '🚀 Abrir App de Minería', 
                web_app: { url: miniAppUrl } 
            }]]
        }
    });
});

// Lógica de aprobación/rechazo de depósitos
bot.on('callback_query', async (ctx) => {
    // Solo el admin puede usar estos botones
    if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery('Acción no autorizada.', { show_alert: true });

    const [action, depositId] = ctx.callbackQuery.data.split(':');
    if (!['approve_deposit', 'reject_deposit'].includes(action)) {
        return ctx.answerCbQuery(); // No es una acción que nos interese, la ignoramos.
    }
    
    try {
        const deposit = await PendingDeposit.findById(depositId);
        if (!deposit || deposit.status !== 'pending') {
            return ctx.editMessageText(`Esta acción ya fue procesada.`);
        }
        const user = await User.findOne({ telegramId: deposit.telegramId });
        if (!user) {
            return ctx.editMessageText(`Usuario del depósito no encontrado.`);
        }

        if (action === 'approve_deposit') {
            user.usdtBalance += deposit.amount;
            deposit.status = 'approved';
            const newTransaction = new Transaction({ telegramId: user.telegramId, type: 'deposit', description: 'Depósito USDT (BEP20)', amount: `+${deposit.amount.toFixed(4)} USDT` });
            await newTransaction.save();
            await user.save();
            await deposit.save();
            await ctx.editMessageText(`✅ Depósito de ${deposit.amount.toFixed(4)} USDT para @${user.username} APROBADO.`);
            await bot.telegram.sendMessage(user.telegramId, `🎉 ¡Tu depósito de ${deposit.amount.toFixed(4)} USDT ha sido aprobado!`);
        } else { // 'reject_deposit'
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
// --- FIN DE LÓGICA DEL BOT ---


// --- REGISTRO DE RUTAS DE LA API ---
app.use('/api/users', userRoutes);
app.use('/api/mining', miningRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/boosts', boostRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/health', healthRoutes);

// --- ARRANQUE DEL SERVIDOR Y WEBHOOKS ---
const startServer = async () => {
    try {
        // PASO 1: Conectar a la base de datos
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('✅ Conectado a MongoDB.');

        const backendUrl = process.env.RENDER_EXTERNAL_URL;
        const secretPath = `/telegraf/${bot.token}`;

        // PASO 2: Configurar webhook de Telegraf si estamos en producción
        if (backendUrl) {
            console.log(`Modo Producción: Intentando configurar webhook de Telegraf...`);
            await bot.telegram.setWebhook(`${backendUrl}${secretPath}`);
            console.log(`✅ Webhook de Telegraf configurado en: ${backendUrl}${secretPath}`);
        }
        
        // PASO 3: Registrar el middleware del webhook de Telegraf
        app.use(bot.webhookCallback(secretPath));

        // PASO 4: Iniciar el servidor Express
        app.listen(PORT, () => {
            console.log(`🚀 Servidor Express corriendo y listo para recibir peticiones en el puerto ${PORT}.`);
        });

        // PASO 5: Iniciar el bot en modo polling para desarrollo local
        if (!backendUrl) {
            console.warn('Modo Desarrollo: Iniciando bot en modo polling.');
            bot.launch();
        }

    } catch (error) {
        console.error('❌ FALLO CRÍTICO AL INICIAR EL SERVIDOR:', error);
        process.exit(1);
    }
};

startServer();

// Manejo de errores de Telegraf
bot.catch((err, ctx) => console.error(`Error de Telegraf para ${ctx.updateType}:`, err));

// Manejo de señales de terminación para desarrollo local
if (process.env.NODE_ENV !== 'production') {
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
