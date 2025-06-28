// --- START OF FILE atu-mining-api/index.js (COMPLETO Y FINAL) ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Telegraf } = require('telegraf');

// --- 1. IMPORTACIONES ---
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
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim(), 10));

bot.start((ctx) => ctx.reply('Bienvenido a ATU Mining. Accede a la app desde el menú.'));

bot.command('addboost', async (ctx) => {
    try {
        if (!ADMIN_IDS.includes(ctx.from.id)) return;

        const args = ctx.message.text.split(' ').slice(1);
        if (args.length !== 3) {
            return ctx.reply('⚠️ Formato Incorrecto.\nUso: /addboost <telegramId> <boostId> <quantity>');
        }

        const targetTelegramId = parseInt(args[0], 10);
        const boostId = args[1];
        const quantity = parseInt(args[2], 10);
        const boostConfig = BOOSTS_CONFIG.find(b => b.id === boostId);

        if (isNaN(targetTelegramId) || !boostConfig || isNaN(quantity) || quantity <= 0) {
            return ctx.reply('⚠️ Datos inválidos. Verifica el ID del usuario, el ID del boost y la cantidad.');
        }

        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const user = await User.findOne({ telegramId: targetTelegramId }).session(session);
            if (!user) throw new Error(`Usuario con ID ${targetTelegramId} no encontrado.`);

            await grantBoostsToUser({ userId: user._id, boostId, quantity, session });

            await Transaction.create([{
                userId: user._id,
                type: 'purchase', currency: 'USDT', amount: 0,
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
    } catch (e) {
        console.error("Error no manejado en el comando /addboost:", e);
        ctx.reply("Ocurrió un error inesperado al procesar el comando.");
    }
});

// --- 6. WEBHOOK Y LANZAMIENTO ---
const secretPath = `/telegraf/${bot.token}`;
app.use(bot.webhookCallback(secretPath));

app.get('/', (req, res) => res.send('ATU Mining API está en línea. OK.'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ API escuchando en el puerto ${PORT}`);
    console.log(`🤖 Bot listo para recibir updates en la ruta: ${secretPath}`);
});
// --- END OF FILE atu-mining-api/index.js (COMPLETO Y FINAL) ---