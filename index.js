// En: atu-mining-backend/index.js
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
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');

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

app.use('/api/users', userRoutes);
app.use('/api/mining', miningRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/boosts', boostRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/withdrawal', withdrawalRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

const startServer = async () => {
    try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('✅ Conectado a MongoDB.');
        const backendUrl = process.env.RENDER_EXTERNAL_URL;
        const secretPath = `/telegraf/${bot.token}`;
        if (backendUrl) {
            await bot.telegram.setWebhook(`${backendUrl}${secretPath}`);
            console.log(`✅ Webhook de Telegraf configurado.`);
        }
        app.use(bot.webhookCallback(secretPath));
        app.listen(PORT, () => console.log(`🚀 Servidor Express corriendo en el puerto ${PORT}.`));
        if (!backendUrl) bot.launch();
    } catch (error) {
        console.error('❌ FALLO CRÍTICO AL INICIAR:', error);
        process.exit(1);
    }
};
startServer();
bot.catch((err, ctx) => console.error(`Error de Telegraf para ${ctx.updateType}:`, err));
if (process.env.NODE_ENV !== 'production') {
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}