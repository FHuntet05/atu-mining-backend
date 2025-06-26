require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

const User = require('./models/User.js');
const transactionService = require('./services/transaction.service.js');
const apiRoutes = require('./routes'); 

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.DATABASE_URL)
  .then(() => console.log('MongoDB conectado exitosamente.'))
  .catch(err => console.error('Error de conexión a MongoDB:', err));

// --- INICIO DE MODIFICACIÓN DE DEPURACIÓN ---
const botTokenForLaunch = process.env.BOT_TOKEN;
if (!botTokenForLaunch) {
    console.error("¡ERROR CRÍTICO! La variable de entorno BOT_TOKEN no está definida.");
    process.exit(1); // Detener el proceso si el token no existe
}

// Imprimimos una parte del token para verificar que es el correcto.
console.log(`Iniciando bot con token que termina en: ...${botTokenForLaunch.slice(-6)}`);
// --- FIN DE MODIFICACIÓN DE DEPURACIÓN ---

const bot = new Telegraf(botTokenForLaunch);

// ... (El resto de tu código: bot.start, bot.on, etc. va aquí sin cambios) ...
bot.start(async (ctx) => {
    // Tu lógica de start
});
// ...

app.use('/api', apiRoutes);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor Express escuchando en el puerto ${PORT}`);
  transactionService.startCheckingTransactions(bot);
});

bot.launch(() => {
  console.log('Bot de Telegram iniciado.');
}).catch(err => {
    // Añadir un log más detallado en caso de fallo de launch
    console.error("Fallo al lanzar el bot (bot.launch). Razón:", err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));