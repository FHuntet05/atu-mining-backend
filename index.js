// index.js - VERSIÓN FINAL CON SOLUCIÓN PARA DEPLOY CHECK DE RENDER
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Telegraf } = require('telegraf');

// --- IMPORTACIÓN DE RUTAS, SERVICIOS Y MODELOS ---
const userRoutes = require('./routes/userRoutes');
const boostRoutes = require('./routes/boostRoutes');
const taskRoutes = require('./routes/taskRoutes');
const referralRoutes = require('./routes/referralRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const boostService = require('./services/boost.service');
const User = require('./models/User');

const app = express();
const PORT = process.env.PORT || 10000;

// --- CONFIGURACIÓN DE CORS ---
const allowedOrigins = [
    'https://web.telegram.org',
    /https:\/\/[a-zA-Z0-9-]+\.onrender\.com/ 
];
const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.some(allowedOrigin => 
            (allowedOrigin instanceof RegExp) ? allowedOrigin.test(origin) : allowedOrigin === origin
        )) {
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

// --- CONEXIÓN A MONGODB ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Successfully connected to MongoDB Atlas'))
    .catch(err => console.error('❌ Error connecting to MongoDB Atlas:', err));

// =====================================================================
// === RUTA DE HEALTH CHECK (SOLUCIÓN PARA EL DEPLOY CHECK DE RENDER) ===
// =====================================================================
app.get('/', (req, res) => {
    res.status(200).send('ATU Mining API is healthy and running.');
});

// --- REGISTRO EXPLÍCITO DE RUTAS DE LA API ---
app.use('/api/users', userRoutes);
app.use('/api/boosts', boostRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/payments', paymentRoutes);


// =================================================================
// =========== LÓGICA DEL BOT DE TELEGRAM ==========================
// =================================================================

if (process.env.TELEGRAM_BOT_TOKEN && process.env.RENDER_EXTERNAL_URL && process.env.TELEGRAM_SECRET_TOKEN) {

    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    
    bot.use(Telegraf.log());

    // --- COMANDO /start ---
    bot.command('start', (ctx) => {
        const welcomeMessage = `¡Bienvenido a ATU Mining USDT! 🚀\n\nPresiona el botón de abajo para iniciar la aplicación y comenzar a minar.`;
        ctx.reply(welcomeMessage, {
            reply_markup: {
                inline_keyboard: [[{ 
                    text: '⛏️ Abrir App de Minería', 
                    web_app: { url: process.env.FRONTEND_URL }
                }]]
            }
        });
    });

    // --- COMANDO /addboost ---
    bot.command('addboost', async (ctx) => {
        const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',');
        const userId = ctx.from.id.toString();

        if (!adminIds.includes(userId)) {
            return ctx.reply('❌ Acceso denegado. Este comando es solo para administradores.');
        }

        const parts = ctx.message.text.split(' ');
        if (parts.length !== 4) {
            return ctx.reply('Formato incorrecto. Uso: /addboost <ID_TELEGRAM_USUARIO> <ID_BOOST> <CANTIDAD>');
        }
    
        const targetUserIdNum = parseInt(parts[1], 10);
        const quantity = parseInt(parts[3], 10);
        const boostId = parts[2];
        
        if (isNaN(targetUserIdNum)) {
            return ctx.reply('El ID de Telegram del usuario debe ser un número válido.');
        }
        if (isNaN(quantity) || quantity <= 0) {
            return ctx.reply('La cantidad debe ser un número positivo.');
        }
    
        try {
            const targetUser = await User.findOne({ 
                $or: [
                    { telegramId: targetUserIdNum }, 
                    { telegramId: String(targetUserIdNum) }
                ] 
            });
            
            if (!targetUser) {
                return ctx.reply(`❌ Error: Usuario con ID ${targetUserIdNum} no encontrado en la base de datos.`);
            }

            await boostService.grantBoostsToUser({ userId: targetUser._id, boostId: boostId, quantity: quantity, session: null });
            
            ctx.reply(`✅ ¡Éxito! Se añadieron ${quantity} boost(s) de tipo "${boostId}" al usuario con ID de Telegram ${targetUserIdNum}.`);

        } catch (error) {
            console.error(`❌ Error en comando /addboost:`, error);
            ctx.reply(error.message || 'Ocurrió un error inesperado al procesar el comando.');
        }
    });

    // --- CONFIGURACIÓN DEL WEBHOOK ---
    const secretPath = `/telegraf/${process.env.TELEGRAM_BOT_TOKEN}`;
    app.post(secretPath, (req, res) => {
        bot.handleUpdate(req.body, res);
    });
    bot.telegram.setWebhook(`${process.env.RENDER_EXTERNAL_URL}${secretPath}`, {
        secret_token: process.env.TELEGRAM_SECRET_TOKEN
    }).then(() => {
        console.log(`✅ Webhook configurado correctamente en la ruta: ${secretPath}`);
    }).catch((err) => {
        console.error('❌ Error al configurar el webhook:', err);
    });

} else {
    console.warn("⚠️ ADVERTENCIA: Faltan variables de entorno para el bot de Telegram.");
}

// --- ARRANQUE FINAL DEL SERVIDOR ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor Express corriendo en el puerto ${PORT}`);
});