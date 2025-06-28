// --- START OF FILE atu-mining-api/index.js (VERSIÓN CON CORS ROBUSTO) ---
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const mainRoutes = require('./routes/index');
const { startCheckingTransactions } = require('./services/transaction.service');

const app = express();

// --- MIDDLEWARE ---

// --- LA CORRECCIÓN DEFINITIVA DE CORS ---
// En lugar de una lista estática, creamos una función que verifica
// si el origen de la petición termina en '.onrender.com' o es 'web.telegram.org'.
// Esto es flexible y seguro.
const whitelist = ['https://web.telegram.org'];
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || whitelist.includes(origin) || origin.endsWith('.onrender.com')) {
            // Si el origen está en la whitelist o es un subdominio de onrender.com, permite la petición.
            callback(null, true);
        } else {
            // Si no, recházala.
            callback(new Error('Not allowed by CORS'));
        }
    },
    optionsSuccessStatus: 200 // para navegadores legacy
};
app.use(cors(corsOptions));
// --- FIN DE LA CORRECCIÓN DE CORS ---

app.use(express.json());

// --- CONEXIÓN A DB Y VIGILANTE ---
mongoose.connect(process.env.DATABASE_URL)
    .then(() => {
        console.log('✅ API: Conectado a MongoDB.');
        startCheckingTransactions();
    })
    .catch(err => console.error('❌ API: Error de conexión a MongoDB:', err));


// --- REGISTRO DE RUTAS ---
// Usamos el enrutador principal con el prefijo /api en las sub-rutas.
app.use(mainRoutes);


// --- Endpoint de salud ---
app.get('/', (req, res) => {
    res.send('ATU Mining API está en línea y funcionando.');
});


// --- LANZAMIENTO DEL SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ API: Servidor escuchando en el puerto ${PORT}`);
});
// --- END OF FILE atu-mining-api/index.js (VERSIÓN CON CORS ROBUSTO) ---