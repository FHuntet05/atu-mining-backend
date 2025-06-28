// --- START OF FILE atu-mining-api/index.js (COMPLETO Y FINAL) ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Telegraf } = require('telegraf');

const mainRoutes = require('./routes/index'); 
const { startCheckingTransactions } = require('./services/transaction.service');

// Validamos que el token del bot exista
if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN debe estar definido en .env');
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

// Configuración de Webhook
const secretPath = `/telegraf/${bot.secret}`;
bot.telegram.setWebhook(`${process.env.WEBHOOK_URL}${secretPath}`);
app.use(bot.webhookCallback(secretPath));

app.get('/', (req, res) => res.send('ATU Mining API está en línea y funcionando.'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ API: Servidor escuchando en el puerto ${PORT}`));

// Comando /start básico en el bot
bot.start((ctx) => ctx.reply('¡Bienvenido a ATU Mining! Accede a la app a través del botón del menú.'));

// Lanzamos el bot (solo escuchará vía webhook)
bot.launch();
// --- END OF FILE atu-mining-api/index.js (COMPLETO Y FINAL) ---