// --- START OF FILE atu-mining-api/index.js (SOLUCIÓN DEFINITIVA DE WEBHOOK) ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Telegraf } = require('telegraf');

const mainRoutes = require('./routes/index'); 
const { startCheckingTransactions } = require('./services/transaction.service');

if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN debe estar definido en .env');
}
if (!process.env.WEBHOOK_URL) {
    throw new Error('WEBHOOK_URL debe estar definido en .env (ej: https://tu-api.onrender.com)');
}

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

mongoose.connect(process.env.DATABASE_URL)
    .then(() => {
        console.log('✅ API: Conectado a MongoDB.');
        startCheckingTransactions(bot);
    })
    .catch(err => console.error('❌ API: Error de conexión a MongoDB:', err));

app.use('/api', mainRoutes);


// =================================================================
// =============== INICIO DE LA SOLUCIÓN DE WEBHOOK ================
// =================================================================

// 1. Define el path secreto para el webhook.
//    Usa una parte del token para que sea único pero no el token completo.
const secretPath = `/telegraf/${bot.token.substring(bot.token.indexOf(':') + 1)}`;

// 2. Configura el webhook en la API de Telegram.
//    Esto se hace una sola vez al iniciar el servidor.
bot.telegram.setWebhook(`${process.env.WEBHOOK_URL}${secretPath}`);

// 3. Usa el middleware de Express para manejar las actualizaciones que lleguen a esa ruta.
//    Telegraf se encargará de procesar los mensajes que lleguen aquí.
app.use(bot.webhookCallback(secretPath));

// =================================================================
// ================= FIN DE LA SOLUCIÓN DE WEBHOOK ==================
// =================================================================


// --- Endpoint de salud ---
app.get('/', (req, res) => {
    res.send('ATU Mining API está en línea y funcionando. OK.');
});


// Comando /start básico en el bot
bot.start((ctx) => ctx.reply('¡Bienvenido a ATU Mining! Accede a la app a través del botón del menú.'));


// --- LANZAMIENTO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ API: Servidor escuchando en el puerto ${PORT}`);
    console.log(`🤖 Bot configurado para recibir updates en la ruta: ${secretPath}`);
});


// ¡IMPORTANTE! YA NO USAMOS bot.launch() EN PRODUCCIÓN CON WEBHOOKS
// La línea `app.listen` ya se encarga de mantener el servidor vivo.

// --- END OF FILE atu-mining-api/index.js (SOLUCIÓN DEFINITIVA DE WEBHOOK) ---