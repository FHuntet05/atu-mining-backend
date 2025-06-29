// index.js - VERSIÓN FINAL CON HEALTH CHECK CORRECTO PARA RENDER
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
        if (!origin || allowedOrigins.some(allowedOrigin => (allowedOrigin instanceof RegExp) ? allowedOrigin.test(origin) : allowedOrigin === origin)) {
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
// === RUTA DE HEALTH CHECK (ALINEADA CON LA CONFIGURACIÓN DE RENDER) ===
// =====================================================================
app.get('/healthz', (req, res) => {
    res.status(200).send('API is healthy and running.');
});
// También dejamos la ruta raíz por si quitas la configuración personalizada
app.get('/', (req, res) => {
    res.status(200).send('ATU Mining API is healthy and running.');
});


// --- REGISTRO DE RUTAS DE LA API ---
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

    // --- COMANDOS DEL BOT ---
    bot.command('start', (ctx) => { /* ... */ });
    bot.command('addboost', async (ctx) => { /* ... */ });

    // --- CONFIGURACIÓN DEL WEBHOOK ---
    const secretPath = `/telegraf/${process.env.TELEGRAM_BOT_TOKEN}`;
    app.post(secretPath, (req, res) => { bot.handleUpdate(req.body, res); });
    bot.telegram.setWebhook(`${process.env.RENDER_EXTERNAL_URL}${secretPath}`, { secret_token: process.env.TELEGRAM_SECRET_TOKEN })
        .then(() => { console.log(`✅ Webhook configurado correctamente.`); })
        .catch((err) => { console.error('❌ Error al configurar el webhook:', err); });

} else {
    console.warn("⚠️ ADVERTENCIA: Faltan variables de entorno para el bot.");
}

// --- ARRANQUE FINAL DEL SERVIDOR ---
app.listen(PORT, () => { console.log(`🚀 Servidor Express corriendo en el puerto ${PORT}`); });