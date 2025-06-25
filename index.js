// En: atu-mining-backend/index.js

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Telegraf } = require('telegraf');
const User = require('./models/User'); // Importamos User para usarlo en /start

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

mongoose.connect(process.env.DATABASE_URL).then(() => console.log('✅ Conectado a MongoDB.')).catch(e => console.error('❌ DB Error:', e));

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start(async (ctx) => {
    const miniAppUrl = process.env.MINI_APP_URL;
    const startParam = ctx.startPayload; 
    
    try {
        const user = await User.findOne({ telegramId: ctx.from.id });
        if (!user && startParam) {
            const referrerId = parseInt(startParam, 10);
            if (!isNaN(referrerId) && referrerId !== ctx.from.id) {
                await User.updateOne({ telegramId: referrerId }, { $addToSet: { referrals: ctx.from.id } });
            }
        }
    } catch (e) { console.error("Error al procesar referido en /start:", e); }

    ctx.reply('¡Bienvenido a ATU Mining!', {
        reply_markup: {
            inline_keyboard: [[{ text: '🚀 Abrir App de Minería', web_app: { url: miniAppUrl } }]]
        }
    });
});
// (Aquí van tus comandos de admin)

// Rutas de la API
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/mining', require('./routes/miningRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/referrals', require('./routes/referralRoutes'));

// Webhook de Telegraf
const secretPath = `/telegraf/${bot.token}`;
app.use(bot.webhookCallback(secretPath));

app.listen(PORT, () => {
  console.log(`🚀 Servidor Express corriendo.`);
  const backendUrl = process.env.RENDER_EXTERNAL_URL;
  if (backendUrl) {
    console.log(`Configurando webhook en: ${backendUrl}${secretPath}`);
    bot.telegram.setWebhook(`${backendUrl}${secretPath}`);
  } else { console.warn('RENDER_EXTERNAL_URL no definida.'); }
});
