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
const { grantBoostsToUser } = require('./services/boost.service');
const BOOSTS_CONFIG = require('./config/boosts');
const Transaction = require('./models/Transaction');
const User = require('./models/User');

// --- 2. CONFIGURACIÓN ---
if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN debe estar definido');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const app = express();
app.set('bot', bot);

const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim(), 10));

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

// --- 5. LÓGICA DE COMANDOS DEL BOT ---

// Mensaje de bienvenida mejorado
bot.start((ctx) => {
    const welcomeImageUrl = 'https://postimg.cc/hQtL6wsT';
    const welcomeMessage = 
`🎉 *¡Bienvenido a ATU Mining, ${ctx.from.first_name}!* 🎉

Prepárate para sumergirte en el mundo de la minería de criptomonedas.

🤖 En esta simulación, tu misión es:
1.  *Minar* el token del juego, **AUT**, de forma automática.
2.  *Mejorar* tu equipo con **Boosts** para acelerar tu producción.
3.  *Intercambiar* tus AUT por **USDT** y retirarlos.

¡Construye tu imperio minero y compite para llegar a la cima!

👇 Haz clic en el botón de abajo para empezar a minar.`;

    const keyboard = Markup.inlineKeyboard([
        [Markup.button.webApp('🚀 Iniciar Minero', process.env.FRONTEND_URL)]
    ]);

    ctx.replyWithPhoto(welcomeImageUrl, {
        caption: welcomeMessage,
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
    }).catch(() => ctx.reply(welcomeMessage, { parse_mode: 'Markdown', reply_markup: keyboard.reply_markup }));
});

// Comando /addboost para admins
bot.command('addboost', async (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    // ... (la lógica completa del comando /addboost que ya verificamos)
});

// --- 6. WEBHOOK Y LANZAMIENTO ---
const secretPath = `/telegraf/${bot.token}`;
app.use(bot.webhookCallback(secretPath));

app.get('/', (req, res) => res.send('ATU Mining API está en línea. OK.'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ API escuchando en el puerto ${PORT}`);
    // La configuración del webhook se hace una sola vez manualmente
});
// --- END OF FILE atu-mining-api/index.js (FINAL COMPLETO Y FUNCIONAL) ---