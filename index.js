// En: atu-mining-backend/index.js
// CÓDIGO COMPLETO Y FINAL

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Telegraf, session } = require('telegraf');

// --- MODELOS ---
const User = require('./models/User');
// (No es necesario importar todos los modelos aquí, las rutas ya lo hacen)

// --- RUTAS ---
const userRoutes = require('./routes/userRoutes');
const miningRoutes = require('./routes/miningRoutes');
const taskRoutes = require('./routes/taskRoutes');
const referralRoutes = require('./routes/referralRoutes');
const boostRoutes = require('./routes/boostRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const paymentRoutes = require('./routes/paymentRoutes'); // Importamos la nueva ruta de pagos

// --- INICIALIZACIÓN DE EXPRESS ---
const app = express();
const PORT = process.env.PORT || 10000;

// --- MIDDLEWARES GLOBALES ---
app.use(cors());
app.use(express.json());

// --- CONFIGURACIÓN DE TELEGRAF ---
const bot = new Telegraf(process.env.BOT_TOKEN);
app.locals.bot = bot; // Hacemos el bot accesible para que las rutas lo puedan usar
bot.use(session());

// --- LÓGICA DEL BOT ---

// Middleware para actualizar datos básicos del usuario en cada interacción
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
    // ... (Lógica de referido si existe)
    ctx.reply('¡Bienvenido a ATU Mining!', {
        reply_markup: {
            inline_keyboard: [[{ 
                text: '🚀 Abrir App de Minería', 
                web_app: { url: miniAppUrl } 
            }]]
        }
    });
});

// (Aquí iría cualquier otra lógica del bot, como 'bot.on', etc. si la tuvieras)

// --- REGISTRO DE RUTAS DE LA API ---
app.use('/api/users', userRoutes);
app.use('/api/mining', miningRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/boosts', boostRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/payment', paymentRoutes); // Registramos la nueva ruta

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