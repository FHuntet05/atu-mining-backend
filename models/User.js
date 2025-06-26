const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true, index: true },
  firstName: { type: String, required: true },
  username: { type: String, required: false },
  photoUrl: { type: String, required: false },
  autBalance: { type: Number, default: 0 },
  usdtBalance: { type: Number, default: 0 },
  usdtForWithdrawal: { type: Number, default: 0 },
  lastClaim: { type: Date, default: Date.now },
  boostYieldPerHour: { type: Number, default: 350 / 24 },
  storageCapacity: { type: Number, default: (350 / 24) * 8 },
  referrerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  activeReferrals: { type: Number, default: 0 }, // El campo problemático
  lastWithdrawalRequest: { type: Date, default: null },
  missions: {
    joinedGroup: { type: Boolean, default: false },
    firstBoostPurchased: { type: Boolean, default: false },
    invitedUsersCount: { type: Number, default: 0 },
    claimedInviteReward: { type: Boolean, default: false }
  }
}, { timestamps: true });


// --- INICIO DE NUEVA FUNCIONALIDAD: Método centralizado ---
/**
 * Un método estático para encontrar un usuario por su telegramId o crearlo si no existe.
 * Esta es ahora la ÚNICA fuente de verdad para la creación de usuarios.
 * @param {object} tgUser - El objeto de usuario de Telegram (ej. ctx.from o initData.user).
 * @returns {Promise<Document>} El documento de usuario de Mongoose.
 */
userSchema.statics.findOrCreate = async function(tgUser) {
    if (!tgUser || !tgUser.id) {
        throw new Error("Datos de usuario de Telegram inválidos proporcionados a findOrCreate.");
    }

    let user = await this.findOne({ telegramId: tgUser.id });

    if (!user) {
        // Si el usuario no existe, lo creamos con todos los valores por defecto correctos.
        // Aquí centralizamos la lógica de inicialización.
        user = new this({
            telegramId: tgUser.id,
            firstName: tgUser.first_name || tgUser.firstName || 'Usuario',
            username: tgUser.username,
            photoUrl: tgUser.photo_url || tgUser.photoUrl,
            // Todos los demás campos tomarán sus valores `default` del schema.
            // No es necesario definirlos aquí a menos que queramos un valor inicial diferente.
            referrals: [],
            activeReferrals: 0 // Siendo explícitos con el campo problemático.
        });
        await user.save();
        console.log(`✅ Nuevo usuario creado a través de findOrCreate: ${user.telegramId}`);
    }
    
    return user;
};
// --- FIN DE NUEVA FUNCIONALIDAD ---


const User = mongoose.model('User', userSchema);

module.exports = User;