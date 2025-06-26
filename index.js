// En: atu-mining-backend/index.js
// CÓDIGO COMPLETO Y FINAL CON EL VIGILANTE DE TRANSACCIONES

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Telegraf, session } = require('telegraf');

// --- MODELOS ---
const User = require('./models/User');

// --- RUTAS ---
const userRoutes = require('./routes/userRoutes');
const miningRoutes = require('./routes/miningRoutes');
const taskRoutes = require('./routes/taskRoutes');
const referralRoutes = require('./routes/referralRoutes');
const boostRoutes = require('./routes/boostRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');

// --- SERVICIOS ---
const { startTransactionScanner } = require('./services/transaction.service'); // Importamos nuestro vigilante

// --- INICIALIZACIÓN DE EXPRESS ---
const app = express();
const PORT = process.env.PORT || 10000;
app.use(cors());
app.use(express.json());

// --- CONFIGURACIÓN DE TELEGRAF ---
const bot = new Telegraf(process.env.BOT_TOKEN);
app.locals.bot = bot;
bot.use(session());

// --- LÓGICA DEL BOT ---
bot.use(async (ctx, next) => {
    if (ctx.from) {
        try {
            const photos = await ctx.telegram.getUserProfilePhotos(ctx.from.id, 0, 1);
            const photoUrl = photos.total_count > 0 ? await ctx.telegram.getFileLink(photos.photos[0][0].file_id) : null;
            await User.updateOne(
                { telegramId: ctx.from.id }, 
                { $set: { username: ctx.from.username, firstName: ctx.from.first_name, photoUrl: photoUrl ? photoUrl.href : null } }, 
                { upsert: true }
            );
        } catch (e) { console.error("Error en middleware de usuario:", e); }
    }
    return next();
});

bot.start(async (ctx) => {
    const miniAppUrl = process.env.MINI_APP_URL;
    if (!miniAppUrl) return ctx.reply('La aplicación no está configurada correctamente.');
    ctx.reply('¡Bienvenido a ATU Mining!', {
        reply_markup: {
            inline_keyboard: [[{ text: '🚀 Abrir App de Minería', web_app: { url: miniAppUrl } }]]
        }
    });
});
// (Aquí puedes añadir más lógica de bot como bot.on('callback_query'), etc.)


// --- REGISTRO DE RUTAS DE LA API ---
app.use('/api/users', userRoutes);
app.use('/api/mining', miningRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/boosts', boostRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/withdrawal', withdrawalRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// --- ARRANQUE DEL SERVIDOR Y SERVICIOS ---
const startServer = async () => {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('✅ Conectado a MongoDB.');

        // ¡INICIAMOS NUESTRO VIGILANTE DE TRANSACCIONES!
        startTransactionScanner(bot);

        const backendUrl = process.env.RENDER_EXTERNAL_URL;
        const secretPath = `/telegraf/${bot.token}`;

        if (backendUrl) {
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
        console.error('❌ FALLO CRÍTICO AL INICIAR:', error);
        process.exit(1);
    }
};

startServer();

// --- MANEJO DE ERRORES Y SEÑALES ---
bot.catch((err, ctx) => console.error(`Error de Telegraf para ${ctx.updateType}:`, err));
if (process.env.NODE_ENV !== 'production') {
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}