import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { Telegraf } from 'telegraf';

// --- IMPORTACIONES (sin cambios) ---
import userRoutes from './routes/userRoutes.js';
import boostRoutes from './routes/boostRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import referralRoutes from './routes/referralRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import * as boostService from './services/boost.service.js';
import User from './models/User.js';

const app = express();
const PORT = process.env.PORT || 3001;

// --- CONFIGURACIÓN DE CORS Y EXPRESS (sin cambios) ---
app.use(cors(/*...opciones...*/));
app.use(express.json());

// --- CONEXIÓN A MONGODB (sin cambios) ---
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Successfully connected to MongoDB Atlas'))
    .catch(err => console.error('Error connecting to MongoDB Atlas:', err));

// --- RUTAS DE LA API (sin cambios) ---
app.use('/api/users', userRoutes);
// ... resto de rutas

// =================================================================
// =========== LÓGICA DEL BOT DE TELEGRAM (MODIFICADA) =============
// =================================================================

if (process.env.TELEGRAM_BOT_TOKEN && process.env.RENDER_EXTERNAL_URL && process.env.TELEGRAM_SECRET_TOKEN) {

    console.log("Inicializando instancia de Telegraf...");
    const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

    // ================== EL ESPÍA ==================
    // Esta línea imprimirá CUALQUIER COSA que el bot reciba de Telegram.
    bot.use(Telegraf.log());
    // ===============================================

    // --- COMANDO /start (con un log extra) ---
    bot.command('start', (ctx) => {
        // Log para ver si el comando se está activando
        console.log(`Comando /start recibido del usuario: ${ctx.from.id}`);
        
        const welcomeMessage = `¡Bienvenido a ATU Mining USDT! 🚀\n\nPresiona el botón de abajo para iniciar la aplicación y comenzar a minar.`;
        ctx.reply(welcomeMessage, {
            reply_markup: {
                inline_keyboard: [[{ 
                    text: '⛏️ Abrir App de Minería', 
                    web_app: { url: process.env.FRONTEND_URL }
                }]]
            }
        });
    });

    // --- COMANDO /addboost (sin cambios) ---
    bot.command('addboost', async (ctx) => {
        // ... (código del comando sin cambios)
    });

    // --- CONFIGURACIÓN DEL WEBHOOK (sin cambios) ---
    const startWebhook = async () => {
        try {
            const secretPath = `/telegraf/${bot.secretPathComponent()}`;
            app.use(await bot.createWebhook({ 
                domain: process.env.RENDER_EXTERNAL_URL,
                secret_token: process.env.TELEGRAM_SECRET_TOKEN 
            }));
            console.log(`Webhook de Telegram configurado correctamente en la ruta secreta.`);
        } catch (e) {
            console.error('Error al crear el webhook de Telegram', e);
        }
    };
    
    startWebhook();

} else {
    console.warn("ADVERTENCIA: Faltan variables de entorno para el bot de Telegram. El bot no se iniciará.");
}

app.listen(PORT, () => {
    console.log(`Servidor Express corriendo en el puerto ${PORT}`);
});