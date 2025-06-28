// --- START OF FILE atu-mining-api/index.js (VERSIÓN FINAL CORREGIDA CON BOT) ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { Telegraf } = require('telegraf');

// Importamos el enrutador principal para el RESTO de las rutas
const mainRoutes = require('./routes/index'); 

// Importamos el userController directamente
const userController = require('./controllers/userController');

const { startCheckingTransactions } = require('./services/transaction.service');

const app = express();

// --- MIDDLEWARE ---
const corsOptions = {
    origin: function (origin, callback) {
        // Permite peticiones sin 'origin' (como las de Postman o scripts locales) y desde dominios de confianza
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


// ===================================================================
// ============ INICIALIZACIÓN DEL BOT DE TELEGRAM (CLAVE) ===========
// ===================================================================

// 1. Creamos la instancia del bot con el TOKEN desde .env
const bot = new Telegraf(process.env.BOT_TOKEN);

// 2. ¡ESTA LÍNEA ES LA CLAVE! Hace que 'bot' esté disponible en toda la app.
//    Ahora, `req.app.get('bot')` funcionará en los controladores.
app.set('bot', bot);

// 3. Configuramos el Webhook para recibir actualizaciones de Telegram en Render
//    Express escuchará en esta ruta secreta las peticiones de Telegram.
const secretPath = `/telegraf/${bot.secretPathComponent()}`;
app.use(bot.webhookCallback(secretPath));

// NOTA: Recuerda establecer la URL del webhook en Telegram para que apunte a tu servicio.
// Puedes hacerlo una vez con una petición cURL o un script. Ejemplo:
// curl -F "url=https://TU_APP_API.onrender.com${secretPath}" https://api.telegram.org/botTOKEN/setWebhook
// Reemplaza TU_APP_API con el nombre de tu servicio web en Render y botTOKEN con tu token.
bot.telegram.getWebhookInfo().then(info => {
  console.log('Webhook Info:', info);
});

// Puedes añadir aquí comandos básicos del bot si lo necesitas
bot.start((ctx) => ctx.reply('¡Hola! Soy el bot de ATU Mining. Abre la app para empezar a minar.'));

// ===================================================================
// ===================== FIN DE LA CONFIGURACIÓN DEL BOT ==============
// ===================================================================


// --- CONEXIÓN A LA BASE DE DATOS ---
mongoose.connect(process.env.DATABASE_URL)
    .then(() => {
        console.log('✅ API: Conectado a MongoDB.');
        // Inicia el vigilante de transacciones DESPUÉS de conectar a la DB
        startCheckingTransactions();
    })
    .catch(err => console.error('❌ API: Error de conexión a MongoDB:', err));


// --- RUTAS DE LA APLICACIÓN ---

// Ruta explícita para /api/users/sync
app.post('/api/users/sync', userController.syncUser);

// Usamos el enrutador principal para todas las demás rutas bajo /api
// (Ej: /api/tasks, /api/boosts, etc.)
app.use('/api', mainRoutes);


// --- Endpoint de salud ---
app.get('/', (req, res) => {
    res.send('ATU Mining API está en línea y funcionando.');
});


// --- LANZAMIENTO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ API: Servidor escuchando en el puerto ${PORT}`);
});

// --- END OF FILE atu-mining-api/index.js ---