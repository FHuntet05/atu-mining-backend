// --- START OF FILE atu-mining-api/index.js (VERSIÓN FINAL Y ROBUSTA) ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Telegraf } = require('telegraf');

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
const { grantBoostsToUser } = require('./services/boost.service');
const BOOSTS_CONFIG = require('./config/boosts');
const Transaction = require('./models/Transaction');
const User = require('./models/User');

// --- 2. CONFIGURACIÓN INICIAL ---
if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN debe estar definido');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const app = express();
app.set('bot', bot);

// Se define UNA SOLA VEZ y de forma global en este archivo.
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim(), 10));

// --- 3. MIDDLEWARE ---
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

// --- 4. CONEXIÓN A DB ---
mongoose.connect(process.env.DATABASE_URL)
    .then(() => {
        console.log('✅ API: Conectado a MongoDB.');
        startCheckingTransactions(bot);
    })
    .catch(err => console.error('❌ API: Error de conexión a MongoDB:', err));

// --- 5. REGISTRO DE RUTAS API ---
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
app.use('/api/referral', referralRoutes);

bot.start((ctx) => {
    // URL de una imagen de bienvenida. Puedes crear una y subirla a un host como Imgur o Postimages.
    const welcomeImageUrl = 'https://postimg.cc/hQtL6wsT'; // URL de ejemplo, ¡cámbiala!

    // Mensaje de bienvenida con formato Markdown
    const welcomeMessage = 
`🎉 *¡Bienvenido a ATU Mining, ${ctx.from.first_name}!* 🎉

Prepárate para sumergirte en el mundo de la minería de criptomonedas.

🤖 Tu misión es:
⛏️  *Minar* el token del juego, **AUT**, de forma automática.
💎  *Mejorar* tu equipo con **Boosts** para acelerar tu producción.
💰  *Intercambiar* tus AUT por **USDT** y retirarlos.

¡Construye tu imperio minero y compite para llegar a la cima del ranking!

👇 Haz clic en el botón de abajo para empezar a minar.`;

    // Botón que abre la Mini App
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.webApp('🚀 Iniciar Minero', process.env.FRONTEND_URL)] // Asegúrate de tener FRONTEND_URL en .env
    ]);

    // Enviamos la foto con el texto y el botón
    ctx.replyWithPhoto(welcomeImageUrl, {
        caption: welcomeMessage,
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
    }).catch(async (e) => {
        // Fallback por si la imagen falla o el cliente no la soporta
        console.error("Error al enviar foto de bienvenida, enviando solo texto:", e.message);
        await ctx.reply(welcomeMessage, {
            parse_mode: 'Markdown',
            reply_markup: keyboard.reply_markup
        });
    });
});

bot.command('addboost', async (ctx) => {
    // Verificamos si el que envía el comando es un admin
    if (!ADMIN_IDS.includes(ctx.from.id)) {
        return ctx.reply('Este comando es solo para administradores.');
    }

    const args = ctx.message.text.split(' ').slice(1);
    if (args.length !== 3) {
        return ctx.reply('⚠️ Formato incorrecto.\nUso: /addboost <telegramId> <boostId> <quantity>');
    }

    const [telegramId, boostId, quantityStr] = args;
    const quantity = parseInt(quantityStr, 10);
    const boostConfig = BOOSTS_CONFIG.find(b => b.id === boostId);

    if (isNaN(parseInt(telegramId)) || !boostConfig || isNaN(quantity) || quantity <= 0) {
        return ctx.reply('⚠️ Datos inválidos. Verifica el ID, boostId y cantidad.');
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const user = await User.findOne({ telegramId: parseInt(telegramId) }).session(session);
        if (!user) throw new Error(`Usuario con ID ${telegramId} no encontrado.`);

        await grantBoostsToUser({ userId: user._id, boostId, quantity, session });

        await Transaction.create([{
            userId: user._id, type: 'purchase', currency: 'USDT', amount: 0,
            status: 'completed',
            details: `Asignación manual de ${quantity}x ${boostConfig.title} por Admin ID: ${ctx.from.id}`
        }], { session });

        await session.commitTransaction();

        ctx.reply(`✅ Éxito! Se asignó ${quantity}x ${boostConfig.title} a ${user.firstName} (${user.telegramId}).`);
        
        bot.telegram.sendMessage(user.telegramId, `🎉 Un administrador ha procesado tu compra y te ha asignado ${quantity}x ${boostConfig.title}. ¡Ya está activo!`).catch(()=>{});
 } catch (error) {
        await session.abortTransaction();
        ctx.reply(`❌ Error al asignar el boost: ${error.message}`);
    } finally {
        session.endSession();
    }
});

// --- 5. WEBHOOK Y LANZAMIENTO DEL SERVIDOR ---
// 1. Define el path secreto donde la app escuchará.
const secretPath = `/telegraf/${bot.token}`; // Usar el token completo es más seguro

// 2. Usa el middleware para que Telegraf procese los mensajes que lleguen a esa ruta.
app.use(bot.webhookCallback(secretPath));

app.get('/', (req, res) => res.send('ATU Mining API está en línea. OK.'));
const PORT = process.env.PORT || 3000;



app.listen(PORT, () => {
    console.log(`✅ API: Servidor escuchando en el puerto ${PORT}`);
});

// No se usa bot.launch() en producción con webhooks
// --- END OF FILE atu-mining-api/index.js (FINAL Y LIMPIO) ---