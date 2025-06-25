// En: atu-mining-backend/models/User.js

const mongoose = require('mongoose');

// 1. Definimos el "Schema" (el plano o la estructura) de nuestros datos de usuario.
const userSchema = new mongoose.Schema({
  // --- Datos de Telegram (esenciales) ---
  telegramId: {
    type: Number,
    required: true, // Este campo es obligatorio
    unique: true,   // No puede haber dos usuarios con el mismo ID de Telegram
    index: true,    // Esto hace que las búsquedas por ID sean mucho más rápidas
  },
  username: {
    type: String,
    trim: true, // Elimina espacios en blanco al principio y al final
  },

  // --- Balances del Juego ---
  usdtBalance: {
    type: Number,
    default: 0, // Un nuevo usuario empieza con 0 USDT
  },
  autBalance: {
    type: Number,
    default: 0, // Un nuevo usuario empieza con 0 AUT
  },
  usdtForWithdrawal: {
    type: Number,
    default: 0,
  },

  // --- Datos de Minería ---
  lastClaim: {
    type: Date,
    default: Date.now, // La "última reclamación" es el momento en que se crea el usuario
  },
  boostYieldPerHour: {
    type: Number,
    default: 0, // Un nuevo usuario no tiene boosts comprados
  },

  // --- Estadísticas y Referidos (para el futuro) ---
  totalMinedAUT: {
    type: Number,
    default: 0,
  },
  totalWithdrawnUSDT: {
    type: Number,
    default: 0,
  },
  referrerId: { // Para guardar quién refirió a este usuario
    type: Number,
    default: null,
  },
  
  // Timestamps automáticos
}, { timestamps: true }); // Mongoose añadirá automáticamente los campos createdAt y updatedAt

// 2. Creamos el "Modelo" a partir del Schema.
// El modelo es el objeto que usaremos en nuestro código para interactuar con la colección de "users" en la base de datos.
const User = mongoose.model('User', userSchema);

// 3. Exportamos el modelo para poder usarlo en otros archivos (como en nuestras rutas de API).
module.exports = User;