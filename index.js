// En: atu-mining-backend/index.js
// CÓDIGO COMPLETO Y CORREGIDO

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Telegraf, session } = require('telegraf');
const User = require('./models/User');
const Transaction = require('./models/Transaction');

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

mongoose.connect(process.env.DATABASE_URL).then(() => console.log('✅ Conectado a MongoDB.')).catch(e => console.error('❌ DB Error:', e));

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = parseInt(process.env.ADMIN_TELEGRAM_ID, 10);
app.locals.bot = bot;
bot.use(session());

bot.use(async (ctx, next) => {
    if (ctx.from) {
        try {
            await User.updateOne({ telegramId: ctx.from.id }, { $set: { username: ctx.from.username, firstName: ctx.from.first_name } }, { upsert: true });
        } catch (e) { console.error("Error en middleware de usuario:", e); }
    }
    return next();
});

bot.start(async (ctx) => {
    const miniAppUrl = process.env.MINI_APP_URL;
    if (!miniAppUrl) return ctx.reply('Aplicación no configurada.');
    
    const startParam = ctx.startPayload; 
    if (startParam) {
        const referrerId = parseInt(startParam, 10);
        if (!isNaN(referrerId) && referrerId !== ctx.from.id) {
            try {
                await User.updateOne({ telegramId: referrerId }, { $addToSet: { referrals: ctx.from.id } });
                await User.updateOne({ telegramId: ctx.from.id }, { $set: { referrerId: referrerId } }, { upsert: true });
            } catch(e) { console.error("Error procesando referido:", e); }
        }
    }
    
    ctx.reply('¡Bienvenido a ATU Mining!', {
        reply_markup: { inline_keyboard: [[{ text: '🚀 Abrir App de Minería', web_app: { url: miniAppUrl } }]] }
    });
});

const adminOnly = (ctx, next) => {
    if (ctx.from && ctx.from.id === ADMIN_ID) return next();
};

bot.command('approve', adminOnly, async (ctx) => {
    try {
        const parts = ctx.message.text.split(' ');
        if (parts.length < 5) return ctx.reply('Formato: /approve <ID> <Cant> <Moneda> <Descrip_con_guiones>');
        
        const telegramId = parseInt(parts[1], 10);
        const amount = parseFloat(parts[2]);
        const currency = parts[3].toUpperCase();
        const description = parts.slice(4).join(' ').replace(/_/g, ' ');

        let updateField = {};
        if (currency === 'USDT') updateField = { $inc: { usdtBalance: amount } };
        else if (currency === 'AUT') updateField = { $inc: { autBalance: amount } };
        else return ctx.reply('Moneda no válida: USA o AUT.');

        const user = await User.findOneAndUpdate({ telegramId }, updateField, { new: true });
        if (!user) return ctx.reply(`❌ Usuario ${telegramId} no encontrado.`);

        const newTransaction = new Transaction({ telegramId, type: 'deposit', description, amount: `+${amount.toFixed(2)} ${currency}` });
        await newTransaction.save();
        ctx.reply(`✅ Saldo acreditado a @${user.username || telegramId}.`);
        
        try {
            await ctx.telegram.sendMessage(telegramId, `🎉 ¡Has recibido ${amount.toFixed(2)} ${currency}! Razón: ${description}.`);
        } catch (e) { ctx.reply('ℹ️ No se pudo notificar al usuario.'); }
    } catch (error) { ctx.reply('❌ Error en /approve.'); }
});

bot.command('find', adminOnly, async (ctx) => {
    const query = ctx.message.text.split(' ')[1];
    if (!query) return ctx.reply('Uso: /find <ID o @username>');
    try {
        const searchField = query.startsWith('@') ? { username: query.substring(1) } : { telegramId: parseInt(query, 10) };
        const user = await User.findOne(searchField);
        if (!user) return ctx.reply('Usuario no encontrado.');
        const userInfo = `*ID:* \`${user.telegramId}\`\n*Username:* @${user.username || 'N/A'}\n*Nombre:* ${user.firstName || 'N/A'}\n*Saldo AUT:* ${user.autBalance.toLocaleString()}\n*Saldo Retiro:* ${user.usdtForWithdrawal.toFixed(2)} USDT\n*Referidos:* ${user.referrals.length}`;
        ctx.replyWithMarkdown(userInfo);
    } catch (error) { ctx.reply('Error al buscar.'); }
});

app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/mining', require('./routes/miningRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api/referrals', require('./routes/referralRoutes'));
app.use('/api/boosts', require('./routes/boostRoutes'));

const secretPath = `/telegraf/${bot.token}`;
app.use(bot.webhookCallback(secretPath));

// --- LA CORRECCIÓN ESTÁ AQUÍ ---
const backendUrl = process.env.RENDER_EXTERNAL_URL;

app.listen(PORT, () => {
  console.log(`🚀 Servidor Express corriendo en el puerto ${PORT}.`);
  if (backendUrl) {
    console.log(`Modo Producción: Configurando webhook en: ${backendUrl}${secretPath}`);
    bot.telegram.setWebhook(`${backendUrl}${secretPath}`);
  } else { 
    console.warn('Modo Desarrollo: Iniciando en modo polling.'); 
    bot.launch(); 
    // Aseguramos que el bot se detenga limpiamente SOLO en modo desarrollo (polling).
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }
});

bot.catch((err, ctx) => console.error(`Error de Telegraf para ${ctx.updateType}`, err));

// Ya no necesitamos las llamadas a process.once aquí fuera, las hemos movido
// dentro de la condición del modo desarrollo.
