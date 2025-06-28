// --- START OF FILE atu-mining-api/index.js (FINAL Y LIMPIO) ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Telegraf , Markup } = require('telegraf');

// --- 1. IMPORTAMOS RUTAS Y SERVICIOS ---
const userController = require('./controllers/userController');
const userRoutes = require('./routes/userRoutes');
const boostRoutes = require('./routes/boostRoutes');
const miningRoutes = require('./routes/miningRoutes');
const exchangeRoutes = require('./routes/exchangeRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const taskRoutes = require('./routes/taskRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const referralRoutes = require('./routes/referralRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const { startCheckingTransactions } = require('./services/transaction.service');

if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN debe estar definido en .env');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const app = express();
app.set('bot', bot);

// --- 2. MIDDLEWARE ---
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

// --- 3. CONEXIÓN A DB Y SERVICIOS ---
mongoose.connect(process.env.DATABASE_URL)
    .then(() => {
        console.log('✅ API: Conectado a MongoDB.');
        startCheckingTransactions(bot);
    })
    .catch(err => console.error('❌ API: Error de conexión a MongoDB:', err));

// --- 4. REGISTRO DE RUTAS ---
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
app.use('/api/referrals', referralRoutes); // Registramos la ruta de referidos

// --- 5. WEBHOOK Y LANZAMIENTO DEL SERVIDOR ---
const secretPath = `/telegraf/${bot.secret}`;
bot.telegram.setWebhook(`${process.env.WEBHOOK_URL}${secretPath}`);
app.use(bot.webhookCallback(secretPath));


app.get('/', (req, res) => res.send('ATU Mining API está en línea. OK.'));
const PORT = process.env.PORT || 3000;
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
app.listen(PORT, () => {
    console.log(`✅ API: Servidor escuchando en el puerto ${PORT}`);
});

// No se usa bot.launch() en producción con webhooks
// --- END OF FILE atu-mining-api/index.js (FINAL Y LIMPIO) ---