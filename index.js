// --- START OF FILE atu-mining-api/index.js (FINAL COMPLETO Y CORREGIDO) ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

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
const referralRoutes = require('./routes/referralRoutes'); // <-- IMPORTACIÓN CORREGIDA
const { startCheckingTransactions } = require('./services/transaction.service');

const app = express();

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

// --- 3. CONEXIÓN A DB Y VIGILANTE ---
mongoose.connect(process.env.DATABASE_URL)
    .then(() => {
        console.log('✅ API: Conectado a MongoDB.');
        // El vigilante ahora funciona de forma autónoma
        startCheckingTransactions();
    })
    .catch(err => console.error('❌ API: Error de conexión a MongoDB:', err));

// --- 4. REGISTRO DE RUTAS API (EXPLÍCITO Y COMPLETO) ---
app.use('/api/users', userRoutes);
app.use('/api/boosts', boostRoutes);
app.use('/api/mining', miningRoutes);
app.use('/api/exchange', exchangeRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/referrals', referralRoutes); // <-- REGISTRO CORREGIDO

// --- 5. ENDPOINT DE SALUD Y LANZAMIENTO ---
app.get('/', (req, res) => {
    res.send('ATU Mining API está en línea. OK.');
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ API Express escuchando en el puerto ${PORT}`);
});
// --- END OF FILE atu-mining-api/index.js (FINAL COMPLETO Y CORREGIDO) ---