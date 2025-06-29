// index.js - VERSIÓN DE DIAGNÓSTICO FINAL (v3)
console.log("--- [v3] Ejecutando index.js ---");

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Telegraf } = require('telegraf');

// --- IMPORTACIÓN DE RUTAS, SERVICIOS Y MODELOS (Sintaxis CommonJS) ---
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

    // --- COMANDO /start (Público para todos los usuarios) ---
    bot.command('start', (ctx) => {
        console.log(`➡️ [v3] Comando /start recibido del usuario: ${ctx.from.id}`);
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

    // --- COMANDO /addboost (Solo para Administradores) - VERSIÓN FINAL CON TELEMETRÍA ---
    bot.command('addboost', async (ctx) => {
        console.log(`➡️ [v3] Comando /addboost recibido del admin: ${ctx.from.id}`);
        const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',');
        const userId = ctx.from.id.toString();

        if (!adminIds.includes(userId)) {
            return ctx.reply('❌ Acceso denegado. Este comando es solo para administradores.');
        }

        const parts = ctx.message.text.split(' ');
        if (parts.length !== 4) {
            return ctx.reply('Formato incorrecto. Uso: /addboost <ID_TELEGRAM_USUARIO> <ID_BOOST> <CANTIDAD>');
        }
    
        const targetUserId = parseInt(parts[1], 10);
        const quantity = parseInt(parts[3], 10);
        
        // LÍNEA CRÍTICA: No convertimos a mayúsculas
        const boostId = parts[2];
        
        if (isNaN(targetUserId)) {
            return ctx.reply('El ID de Telegram del usuario debe ser un número válido.');
        }
        if (isNaN(quantity) || quantity <= 0) {
            return ctx.reply('La cantidad debe ser un número positivo.');
        }
    
        try {
            const targetUser = await User.findOne({ telegramId: targetUserId });
            if (!targetUser) {
                return ctx.reply(`❌ Error: No se encontró un usuario con el ID de Telegram ${targetUserId}. Asegúrate de que el usuario ha iniciado la app al menos una vez.`);
            }

            // Usamos 'null' para la sesión porque el comando se ejecuta fuera de una transacción.
            await boostService.grantBoostsToUser({ userId: targetUser._id, boostId: boostId, quantity: quantity, session: null });
            
            ctx.reply(`✅ ¡Éxito! Se añadieron ${quantity} boost(s) de tipo "${boostId}" al usuario con ID de Telegram ${targetUserId}.`);

        } catch (error) {
            console.error(`❌ [v3] Error en comando /addboost:`, error);
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
        console.log(`✅ Webhook configurado en la ruta: ${secretPath}`);
    }).catch((err) => {
        console.error('❌ Error al configurar el webhook:', err);
    });

} else {
    console.warn("⚠️ ADVERTENCIA: Faltan variables de entorno para el bot de Telegram (TOKEN, URL o SECRET). El bot no se iniciará.");
}

// --- ARRANQUE FINAL DEL SERVIDOR ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor Express corriendo en el puerto ${PORT}`);
});