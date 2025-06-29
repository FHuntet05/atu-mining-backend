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
const transactionRoutes = require('./routes/transactionRoutes');
const boostService = require('./services/boost.service');
const User = require('./models/User');
const { startVigilante } = require('./services/transaction.service'); 
const configRoutes = require('./routes/configRoutes');
const exchangeRoutes = require('./routes/exchangeRoutes'); // Asegúrate de que la ruta al archivo es correcta
const withdrawalRoutes = require('./routes/withdrawalRoutes'); // Hacemos lo mismo para el retiro, por si acaso

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
app.use('/api/transactions', transactionRoutes);
app.use('/api/config', configRoutes);
app.use('/api/exchange', exchangeRoutes);
app.use('/api/withdrawal', withdrawalRoutes);



// =================================================================
// =========== LÓGICA DEL BOT DE TELEGRAM ==========================
// =================================================================

if (process.env.TELEGRAM_BOT_TOKEN && process.env.RENDER_EXTERNAL_URL && process.env.TELEGRAM_SECRET_TOKEN) {

    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    app.set('bot', bot);
    bot.use(Telegraf.log());
   

// --- COMANDO /start (CON LÓGICA DE REFERIDOS CORREGIDA Y ROBUSTA) ---
bot.command('start', (ctx) => {
    // Obtenemos el payload del comando start (ej: el ID del referente)
    const refCode = ctx.startPayload;
    let finalWebAppUrl = process.env.FRONTEND_URL; // Empezamos con la URL base

    // --- LÓGICA CORREGIDA PARA CONSTRUIR LA URL ---
    if (refCode && refCode.trim() !== '') {
        try {
            // Usamos el constructor de URL para añadir el parámetro de forma segura
            const webAppUrl = new URL(finalWebAppUrl);
            webAppUrl.searchParams.set('ref', refCode.trim());
            finalWebAppUrl = webAppUrl.toString();
            console.log(`[Referral-Debug] Enlace de referido detectado. URL final: ${finalWebAppUrl}`);
        } catch (error) {
            console.error('[Referral-Debug] Error al construir la URL con refCode. Usando URL base.', error);
            // Si hay un error, usamos la URL base para no romper el flujo.
        }
    }

    const userName = ctx.from.first_name || 'minero';
    const photoUrl = 'https://i.postimg.cc/hQtL6wsT/ATU-MINING-USDT-1.png';

    const welcomeMessage = 
`🎉 ¡Bienvenido a ATU Mining, ${userName}! 🎉

Prepárate para sumergirte en el mundo de la minería de criptomonedas.

🤖 *Tu misión es:*
⛏️  Minar el token del juego, AUT, de forma automática.
💎  Mejorar tu equipo con Boosts para acelerar tu producción.
💰  Intercambiar tus AUT por USDT y retirarlos.

¡Construye tu imperio minero y compite para llegar a la cima del ranking!

👇 Haz clic en el botón de abajo para empezar a minar.`;

    // Enviamos la foto con el texto y el botón, usando la URL final
    ctx.replyWithPhoto(photoUrl, {
        caption: welcomeMessage,
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[{ 
                text: '⛏️ Minar Ahora', 
                web_app: { url: finalWebAppUrl } // Usamos la variable con la URL correcta
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
    startVigilante();
    console.log(`🚀 Servidor Express corriendo en el puerto ${PORT}`);
});