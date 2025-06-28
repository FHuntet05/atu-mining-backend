// --- START OF FILE atu-mining-api/index.js (FINAL COMPLETO Y FUNCIONAL) ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');

// --- 1. IMPORTACIONES ---
const userController = require('./controllers/userController');
const userRoutes = require('./routes/userRoutes');
const boostRoutes = require('./routes/boostRoutes');
const miningRoutes = require('./routes/miningRoutes');
const exchangeRoutes = require('./routes/exchangeRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const taskRoutes = require('./routes/taskRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const referralRoutes = require('./routes/referralRoutes');
const { startCheckingTransactions } = require('./services/transaction.service');
const { grantBoostsToUser } = require('./services/boost.service'); // <-- Usaremos esta función
const BOOSTS_CONFIG = require('./config/boosts');
const Transaction = require('./models/Transaction');
const User = require('./models/User');

// --- 2. CONFIGURACIÓN ---
if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN debe estar definido');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const app = express();
app.set('bot', bot);

// Carga robusta de IDs de administradores desde .env
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || origin.endsWith('.onrender.com') || origin.startsWith('https://web.telegram.org')) {
            callback(null, true);
        } else {
            callback(new Error('No permitido por CORS'));
        }
    },
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// --- 3. CONEXIÓN A DB ---
mongoose.connect(process.env.DATABASE_URL)
    .then(() => {
        console.log('✅ API: Conectado a MongoDB.');
        startCheckingTransactions(bot);
    })
    .catch(err => console.error('❌ API: Error de conexión a MongoDB:', err));

// --- 4. REGISTRO DE RUTAS API ---
app.post('/api/users/sync', userController.syncUser);
app.use('/api/users', userRoutes);
app.use('/api/boosts', boostRoutes);
app.use('/api/mining', miningRoutes);
app.use('/api/exchange', exchangeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/referrals', referralRoutes);

// =======================================================
// --- 5. LÓGICA DE COMANDOS DEL BOT ---
// =======================================================

// COMANDO /start (Público)
bot.start((ctx) => {
    // URL de la imagen de bienvenida. Puedes cambiarla si quieres.
    const welcomeImageUrl = 'https://i.postimg.cc/k47jVz3D/atu-mining-telegram-banner.png'; 
    const welcomeMessage = 
`🎉 *¡Bienvenido a ATU Mining, ${ctx.from.first_name}!* 🎉

Prepárate para sumergirte en el emocionante mundo de la minería de criptomonedas simulada.

🤖 *Tu Misión:*
1.  *Mina* el token del juego, **AUT**, de forma automática.
2.  *Mejora* tu equipo con **Boosts** para acelerar la producción.
3.  *Intercambia* tus **AUT** por **USDT** reales y retíralos.

¡Construye tu imperio minero y compite para llegar a la cima!

👇 Haz clic en el botón de abajo para lanzar la aplicación y empezar a minar.`;

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.webApp('🚀 Iniciar Minero', process.env.FRONTEND_URL)]
    ]);

    // Intenta enviar con foto, si falla, envía solo el texto.
    ctx.replyWithPhoto({ url: welcomeImageUrl }, {
        caption: welcomeMessage,
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
    }).catch(() => ctx.reply(welcomeMessage, { parse_mode: 'Markdown', reply_markup: keyboard.reply_markup }));
});

// COMANDO /addboost (Solo para Administradores)
bot.command('addboost', async (ctx) => {
    // 1. GUARDIA DE ADMINISTRADOR
    if (!ADMIN_IDS.includes(ctx.from.id)) {
        return ctx.reply('❌ Acceso denegado. Este comando es exclusivo para administradores.');
    }

    // 2. PARSEO Y VALIDACIÓN DE ARGUMENTOS
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length !== 3) {
        return ctx.replyWithHTML(
            '<b>Formato incorrecto.</b>\n' +
            'Uso: <code>/addboost [ID_TELEGRAM_USUARIO] [ID_BOOST] [CANTIDAD]</code>\n\n' +
            '<i>Ejemplo:</i> <code>/addboost 12345678 GOLD 5</code>'
        );
    }
    
    const [targetTelegramId, boostIdInput, quantityStr] = args;
    const quantity = parseInt(quantityStr, 10);
    const boostId = boostIdInput.toUpperCase(); // Normalizar a mayúsculas

    // Validaciones de los datos de entrada
    if (isNaN(parseInt(targetTelegramId, 10))) {
        return ctx.reply('❌ Error: El ID de Telegram del usuario debe ser un número.');
    }
    if (!BOOSTS_CONFIG[boostId]) {
        return ctx.reply(`❌ Error: El ID de Boost "${boostId}" no es válido. Los IDs válidos son: ${Object.keys(BOOSTS_CONFIG).join(', ')}`);
    }
    if (isNaN(quantity) || quantity <= 0) {
        return ctx.reply('❌ Error: La cantidad debe ser un número entero y positivo.');
    }

    // 3. LÓGICA DE NEGOCIO Y FEEDBACK
    try {
        const user = await User.findOne({ telegramId: targetTelegramId });
        if (!user) {
            return ctx.reply(`❌ Error: No se encontró ningún usuario con el ID de Telegram ${targetTelegramId}.`);
        }
        
        // Llamada al servicio para añadir los boosts
        await grantBoostsToUser(user._id, boostId, quantity);
        
        await ctx.reply(`✅ ¡Éxito! Se han añadido ${quantity} boost(s) de tipo "${boostId}" al usuario ${user.username} (ID: ${targetTelegramId}).`);

    } catch (error) {
        console.error(`[ERROR] en /addboost por admin ${ctx.from.id}:`, error);
        await ctx.reply(`❌ Ha ocurrido un error al procesar la solicitud: ${error.message}`);
    }
});


// --- 6. WEBHOOK Y LANZAMIENTO ---
const secretPath = `/telegraf/${bot.token}`;
app.use(bot.webhookCallback(secretPath));

app.get('/', (req, res) => res.send('ATU Mining API está en línea. OK.'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ API escuchando en el puerto ${PORT}`);
    // La configuración del webhook se hace una sola vez manualmente via API call o script
});
// --- END OF FILE atu-mining-api/index.js (FINAL COMPLETO Y FUNCIONAL) ---