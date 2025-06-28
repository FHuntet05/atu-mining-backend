// --- START OF FILE atu-mining-api/index.js (LA SOLUCIÓN FINAL) ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Telegraf } = require('telegraf');

// --- 1. IMPORTAMOS LOS CONTROLADORES Y RUTAS INDIVIDUALES ---
const userController = require('./controllers/userController'); // Importamos el controlador directamente
const userRoutes = require('./routes/userRoutes');
const boostRoutes = require('./routes/boostRoutes');
const miningRoutes = require('./routes/miningRoutes');
const exchangeRoutes = require('./routes/exchangeRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const taskRoutes = require('./routes/taskRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const { startCheckingTransactions } = require('./services/transaction.service');

// --- 2. CONFIGURACIÓN INICIAL DEL BOT Y EXPRESS ---
if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN debe estar definido en .env');
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const app = express();
app.set('bot', bot);

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

// --- 4. CONEXIÓN A BASE DE DATOS E INICIO DE SERVICIOS ---
mongoose.connect(process.env.DATABASE_URL)
    .then(() => {
        console.log('✅ API: Conectado a MongoDB.');
        startCheckingTransactions(bot);
    })
    .catch(err => console.error('❌ API: Error de conexión a MongoDB:', err));

// =================================================================
// =============== INICIO DE LA ARQUITECTURA FINAL =================
// =================================================================

// 5. REGISTRAMOS CADA RUTA CON SU PREFIJO COMPLETO DIRECTAMENTE EN LA APP.
//    Esto es explícito y elimina cualquier punto de fallo del enrutador.

// Ruta problemática definida DIRECTAMENTE aquí:
app.post('/api/users/sync', userController.syncUser);

// Resto de las rutas:
app.use('/api/users', userRoutes);
app.use('/api/boosts', boostRoutes);
app.use('/api/mining', miningRoutes);
app.use('/api/exchange', exchangeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// =================================================================
// ================= FIN DE LA ARQUITECTURA FINAL ==================
// =================================================================

// --- 6. CONFIGURACIÓN DEL WEBHOOK Y LANZAMIENTO DEL SERVIDOR ---
const secretPath = `/telegraf/${bot.secret}`;
bot.telegram.setWebhook(`${process.env.WEBHOOK_URL}${secretPath}`);
app.use(bot.webhookCallback(secretPath));
bot.start((ctx) => ctx.reply('Bienvenido a ATU Mining.'));

app.get('/', (req, res) => {
    res.send('ATU Mining API está en línea y funcionando. OK.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ API: Servidor escuchando en el puerto ${PORT}`);
    console.log(`🤖 Bot configurado para recibir updates en: ${secretPath}`);
});

// NO se usa bot.launch() en producción con webhooks
// --- END OF FILE atu-mining-api/index.js (LA SOLUCIÓN FINAL) ---