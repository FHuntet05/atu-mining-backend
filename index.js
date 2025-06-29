// index.js - VERSIÓN FINAL Y ROBUSTA
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Telegraf } = require('telegraf');

const userRoutes = require('./routes/userRoutes');
const boostRoutes = require('./routes/boostRoutes');
const taskRoutes = require('./routes/taskRoutes');
const referralRoutes = require('./routes/referralRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const boostService = require('./services/boost.service');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 10000;

const allowedOrigins = [
    'https://web.telegram.org',
    /https:\/\/[a-zA-Z0-9-]+\.onrender\.com/ 
];
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.some(allowedOrigin => (allowedOrigin instanceof RegExp) ? allowedOrigin.test(origin) : allowedOrigin === origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Successfully connected to MongoDB Atlas'))
    .catch(err => console.error('❌ Error connecting to MongoDB Atlas:', err));

app.get('/', (req, res) => {
    res.status(200).send('ATU Mining API is healthy and running.');
});

app.use('/api/users', userRoutes);
app.use('/api/boosts', boostRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/payments', paymentRoutes);

if (process.env.TELEGRAM_BOT_TOKEN && process.env.RENDER_EXTERNAL_URL && process.env.TELEGRAM_SECRET_TOKEN) {

    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    
    bot.command('start', (ctx) => {
        const welcomeMessage = `¡Bienvenido a ATU Mining USDT! 🚀\n\nPresiona el botón de abajo para iniciar la aplicación y comenzar a minar.`;
        ctx.reply(welcomeMessage, {
            reply_markup: { inline_keyboard: [[{ text: '⛏️ Abrir App de Minería', web_app: { url: process.env.FRONTEND_URL } }]] }
        });
    });

    bot.command('addboost', async (ctx) => {
        let initialMessage;
        try {
            initialMessage = await ctx.reply('⏳ Procesando solicitud...');

            const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',');
            if (!adminIds.includes(ctx.from.id.toString())) {
                throw new Error('❌ Acceso denegado. Este comando es solo para administradores.');
            }

            const parts = ctx.message.text.split(' ');
            if (parts.length !== 4) {
                throw new Error('Formato incorrecto. Uso: /addboost <ID_TELEGRAM_USUARIO> <ID_BOOST> <CANTIDAD>');
            }
    
            const targetUserIdNum = parseInt(parts[1], 10);
            const quantity = parseInt(parts[3], 10);
            const boostId = parts[2];
            
            if (isNaN(targetUserIdNum) || isNaN(quantity) || quantity <= 0) {
                throw new Error('El ID de usuario y la cantidad deben ser números válidos.');
            }
    
            const targetUser = await User.findOne({ $or: [{ telegramId: targetUserIdNum }, { telegramId: String(targetUserIdNum) }] });
            if (!targetUser) {
                throw new Error(`❌ Usuario con ID ${targetUserIdNum} no encontrado.`);
            }

            await boostService.grantBoostsToUser({ userId: targetUser._id, boostId: boostId, quantity: quantity, session: null });
            
            const successMessage = `✅ ¡Éxito! Se añadieron ${quantity} boost(s) de tipo "${boostId}" al usuario con ID ${targetUserIdNum}.`;
            await ctx.telegram.editMessageText(ctx.chat.id, initialMessage.message_id, undefined, successMessage);

        } catch (error) {
            console.error(`❌ Error en comando /addboost:`, error);
            const errorMessage = error.message || 'Ocurrió un error inesperado.';
            if (initialMessage) {
                await ctx.telegram.editMessageText(ctx.chat.id, initialMessage.message_id, undefined, errorMessage);
            } else {
                ctx.reply(errorMessage);
            }
        }
    });

    const secretPath = `/telegraf/${process.env.TELEGRAM_BOT_TOKEN}`;
    app.post(secretPath, (req, res) => { bot.handleUpdate(req.body, res); });
    bot.telegram.setWebhook(`${process.env.RENDER_EXTERNAL_URL}${secretPath}`, { secret_token: process.env.TELEGRAM_SECRET_TOKEN })
        .then(() => { console.log(`✅ Webhook configurado correctamente.`); })
        .catch((err) => { console.error('❌ Error al configurar el webhook:', err); });

} else {
    console.warn("⚠️ ADVERTENCIA: Faltan variables de entorno para el bot.");
}

app.listen(PORT, () => { console.log(`🚀 Servidor Express corriendo en el puerto ${PORT}`); });