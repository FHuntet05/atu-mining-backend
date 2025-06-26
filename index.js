// En: atu-mining-backend/index.js
// CÓDIGO COMPLETO Y FINAL

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Telegraf, session } = require('telegraf');

const User = require('./models/User');
const userRoutes = require('./routes/userRoutes');
const miningRoutes = require('./routes/miningRoutes');
const taskRoutes = require('./routes/taskRoutes');
const referralRoutes = require('./routes/referralRoutes');
const boostRoutes = require('./routes/boostRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes'); // Nueva ruta
const leaderboardRoutes = require('./routes/leaderboardRoutes'); // Nueva ruta

const app = express();
const PORT = process.env.PORT || 10000;
app.use(cors());
app.use(express.json());

const bot = new Telegraf(process.env.BOT_TOKEN);
app.locals.bot = bot;
bot.use(session());

bot.use(async (ctx, next) => {
    if (ctx.from) {
        try {
            await User.updateOne({ telegramId: ctx.from.id }, { $set: { username: ctx.from.username, firstName: ctx.from.first_name, photoUrl: ctx.from.photo_url } }, { upsert: true });
        } catch (e) { console.error("Error en middleware de usuario:", e); }
    }
    return next();
});

bot.start(async (ctx) => {
    const miniAppUrl = process.env.MINI_APP_URL;
    if (!miniAppUrl) {
        return ctx.reply('La aplicación no está configurada correctamente.');
    }
    ctx.reply('¡Bienvenido a ATU Mining!', {
        reply_markup: {
            inline_keyboard: [[{ text: '🚀 Abrir App de Minería', web_app: { url: miniAppUrl } }]]
        }
    });
});

app.use('/api/users', userRoutes);
app.use('/api/mining', miningRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/boosts', boostRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/withdrawal', withdrawalRoutes); // Registramos la ruta
app.use('/api/leaderboard', leaderboardRoutes); // Registramos la ruta


// --- ARRANQUE DEL SERVIDOR Y WEBHOOK DE TELEGRAF ---
const startServer = async () => {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('✅ Conectado a MongoDB.');

        const backendUrl = process.env.RENDER_EXTERNAL_URL;
        const secretPath = `/telegraf/${bot.token}`;

        if (backendUrl) {
            console.log(`Modo Producción: Configurando webhook de Telegraf...`);
            await bot.telegram.setWebhook(`${backendUrl}${secretPath}`);
            console.log(`✅ Webhook de Telegraf configurado.`);
        }
        
        app.use(bot.webhookCallback(secretPath));

        app.listen(PORT, () => {
            console.log(`🚀 Servidor Express corriendo en el puerto ${PORT}.`);
        });

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

// Manejo de errores globales de Telegraf
bot.catch((err, ctx) => {
    console.error(`Error global de Telegraf capturado para el update tipo ${ctx.updateType}:`, err)
});

// Manejo de señales de terminación para desarrollo local
if (process.env.NODE_ENV !== 'production') {
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
