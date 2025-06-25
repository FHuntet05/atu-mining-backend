// En: atu-mining-backend/index.js

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

mongoose.connect(process.env.DATABASE_URL)
  .then(() => console.log('✅ Conectado a MongoDB Atlas.'))
  .catch((error) => console.error('❌ Error al conectar a MongoDB:', error.message));

app.get('/api', (req, res) => {
  res.json({ message: 'API de ATU Mining funcionando.' });
});

// Rutas existentes
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);
const miningRoutes = require('./routes/miningRoutes');
app.use('/api/mining', miningRoutes);

// --- NUEVA RUTA DE TRANSACCIONES ---
const transactionRoutes = require('./routes/transactionRoutes');
app.use('/api/transactions', transactionRoutes);
// ---------------------------------

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});
