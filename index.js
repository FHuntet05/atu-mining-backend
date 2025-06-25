// En: atu-mining-backend/index.js

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Telegraf, session } = require('telegraf');

// --- CONFIGURACIÓN DE EXPRESS ---
const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

// --- Middleware de diagnóstico para CADA petición ---
app.use((req, res, next) => {
    console.log(`[INCOMING REQUEST] Method: ${req.method}, URL: ${req.originalUrl}`);
    next();
});

// --- CONEXIÓN A MONGODB ---
mongoose.connect(process.env.DATABASE_URL)
  .then(() => console.log('✅ Conectado a MongoDB Atlas.'))
  .catch((error) => console.error('❌ Error al conectar a MongoDB:', error.message));

// --- BOT DE TELEGRAF ---
// Comentamos la lógica del bot temporalmente para aislar el problema a Express
/*
const bot = new Telegraf(process.env.BOT_TOKEN);
app.locals.bot = bot;
// ... (toda la lógica del bot)
*/

// --- RUTAS DE LA API ---
console.log("Intentando registrar rutas de la API...");
try {
    app.use('/api/users', require('./routes/userRoutes'));
    app.use('/api/mining', require('./routes/miningRoutes'));
    app.use('/api/tasks', require('./routes/taskRoutes'));
    app.use('/api/referrals', require('./routes/referralRoutes'));
    console.log("✅ Rutas de API registradas correctamente.");
} catch (e) {
    console.error("❌ ERROR CRÍTICO AL REGISTRAR RUTAS:", e);
}


// --- RUTA DE PRUEBA ---
app.get("/", (req, res) => {
    res.send("Servidor de ATU Mining API está operativo.");
});

// --- INICIO DEL SERVIDOR ---
app.listen(PORT, () => {
  console.log(`🚀 Servidor Express corriendo en el puerto ${PORT}`);
});
