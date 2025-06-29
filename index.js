// index.js - VERSIÓN FINAL CON CORRECCIÓN DE URL DE REFERIDO
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Telegraf } = require('telegraf');

// --- IMPORTACIONES ---
const userRoutes = require('./routes/userRoutes');
const boostRoutes = require('./routes/boostRoutes');
const taskRoutes = require('./routes/taskRoutes');
const referralRoutes = require('./routes/referralRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const { startVigilante } = require('./services/transaction.service');

const app = express();
const PORT = process.env.PORT || 10000;

// --- CONFIGURACIÓN (sin cambios) ---
const allowedOrigins = [ 'https://web.telegram.org', /https:\/\/[a-zA-Z0-9-]+\.onrender\.com/ ];
const corsOptions = { /* ... */ };
app.use(cors(corsOptions));
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Successfully connected to MongoDB Atlas'))
    .catch(err => console.error('❌ Error connecting to MongoDB Atlas:', err));

app.get('/', (req, res) => res.status(200).send('ATU Mining API is healthy and running.'));

// --- REGISTRO DE RUTAS ---
app.use('/api/users', userRoutes);
app.use('/api/boosts', boostRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/transactions', transactionRoutes);

// =================================================================
// =========== LÓGICA DEL BOT DE TELEGRAM ==========================
// =================================================================

if (process.env.TELEGRAM_BOT_TOKEN && process.env.RENDER_EXTERNAL_URL) {
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
    app.set('bot', bot);

    // --- COMANDO /start (CON LÓGICA DE REFERIDOS SIMPLIFICADA Y CORREGIDA) ---
    bot.command('start', (ctx) => {
        const refCode = ctx.startPayload;
        let finalWebAppUrl = process.env.FRONTEND_URL;

        // Si hay un código de referido, lo añadimos a la URL de forma simple y segura.
        if (refCode && refCode.trim() !== '') {
            // Este método es más directo y menos propenso a errores.
            finalWebAppUrl += `?ref=${refCode.trim()}`;
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

        ctx.replyWithPhoto(photoUrl, {
            caption: welcomeMessage,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: '⛏️ Minar Ahora', web_app: { url: finalWebAppUrl } }]]
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

    // --- CONFIGURACIÓN DEL WEBHOOK (sin cambios) ---
    const secretPath = `/telegraf/${process.env.TELEGRAM_BOT_TOKEN}`;
    app.post(secretPath, (req, res) => { bot.handleUpdate(req.body, res); });
    bot.telegram.setWebhook(`${process.env.RENDER_EXTERNAL_URL}${secretPath}`, { secret_token: process.env.TELEGRAM_SECRET_TOKEN })
        .then(() => { console.log(`✅ Webhook configurado correctamente.`); })
        .catch((err) => { console.error('❌ Error al configurar el webhook:', err); });
} else {
    console.warn("⚠️ ADVERTENCIA: Faltan variables de entorno para el bot.");
}

// --- ARRANQUE FINAL DEL SERVIDOR ---
app.listen(PORT, () => {
    startVigilante();
    console.log(`🚀 Servidor Express corriendo en el puerto ${PORT}`);
});