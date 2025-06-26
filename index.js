// --- Importaciones de Módulos ---
// Cargamos las variables de entorno desde el archivo .env al inicio de todo.
require('dotenv').config();

const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');

// --- Importaciones de Módulos Locales ---
// Asegúrate de que las rutas a tus archivos locales sean correctas.
const User = require('./models/User.js');
const transactionService = require('./services/transaction.service.js');
const apiRoutes = require('./routes/index.js'); // Asumiendo que usas el unificador de rutas

// --- Configuración de la Aplicación Express ---
const app = express();
app.use(cors()); // Habilita CORS para que tu frontend pueda comunicarse con la API.
app.use(express.json()); // Habilita el parseo de cuerpos de petición en formato JSON.

// --- Conexión a la Base de Datos MongoDB ---
mongoose.connect(process.env.DATABASE_URL)
  .then(() => console.log('✅ MongoDB conectado exitosamente.'))
  .catch(err => console.error('❌ Error de conexión a MongoDB:', err));

// --- Verificación de Variables de Entorno Críticas ---
// Es una buena práctica verificar que las variables necesarias existan al iniciar.
if (!process.env.BOT_TOKEN || !process.env.WEBHOOK_URL) {
    console.error('❌ ERROR CRÍTICO: Las variables de entorno BOT_TOKEN y WEBHOOK_URL son requeridas.');
    process.exit(1); // Detiene la aplicación si faltan variables críticas.
}

// --- Inicialización del Bot de Telegram ---
const bot = new Telegraf(process.env.BOT_TOKEN);

// --- Lógica del Bot (Comandos, Eventos, etc.) ---
// Toda tu lógica para /start, /help, etc., se mantiene exactamente igual.
bot.start(async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const firstName = ctx.from.first_name || 'Usuario';
    const username = ctx.from.username;
    
    let user = await User.findOne({ telegramId });
    if (!user) {
        // Lógica de creación de usuario...
        user = new User({ telegramId, firstName, username });
        await user.save();
    }
    
    const welcomeMessage = `¡Bienvenido a ATU Mining, ${firstName}! 🚀\n\n` +
      `Haz clic en el botón de abajo para empezar a minar.`;

    await ctx.reply(welcomeMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💎 Abrir Minero", web_app: { url: process.env.MINI_APP_URL } }]
        ]
      }
    });
  } catch (error) {
    console.error('Error en el comando /start:', error);
  }
});

// ... aquí irían otros manejadores de bot como bot.on('new_chat_members'), etc.

// --- Configuración de Rutas de la API ---
// Todas las rutas definidas en tu carpeta 'routes' estarán disponibles bajo el prefijo /api
app.use('/api', apiRoutes);


// --- LÓGICA DE WEBHOOK (La nueva implementación) ---

// 1. Creamos una ruta secreta y única para nuestro webhook.
//    Esto evita que cualquiera pueda enviar actualizaciones falsas a nuestro bot.
const secretPath = `/telegraf/${bot.secretPathComponent()}`;

// 2. Le decimos a nuestra aplicación Express que use el middleware de Telegraf.
//    Cualquier petición POST que llegue a nuestra ruta secreta será procesada por Telegraf.
app.use(bot.webhookCallback(secretPath));


// --- Lanzamiento del Servidor ---
const PORT = process.env.PORT || 10000; // Render usa el puerto 10000 por defecto.
app.listen(PORT, async () => {
  console.log(`✅ Servidor Express escuchando en el puerto ${PORT}`);
  
  // 3. Una vez que nuestro servidor está en línea, configuramos el webhook en la API de Telegram.
  //    Le decimos a Telegram: "A partir de ahora, envía todas las actualizaciones a esta URL".
  try {
    const webhookUrl = `${process.env.WEBHOOK_URL}${secretPath}`;
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`✅ Webhook configurado exitosamente en Telegram.`);
    console.log(`   -> URL: ${webhookUrl}`);
  } catch (error) {
    console.error('❌ Error fatal al configurar el webhook:', error);
  }

  // El vigilante de transacciones de BscScan se inicia como siempre.
  transactionService.startCheckingTransactions(bot);
});

// Nota: Ya no existe la línea `bot.launch()`, que era la que causaba el conflicto 409.