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
    
    boostYieldPerHour: { type: Number, default: 0 }, // El aumento por boosts empieza en 0
    
    storageCapacity: { type: Number, default: (350 / 24) * 8 },
    referrerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    activeReferrals: { type: Number, default: 0 },
    lastWithdrawalRequest: { type: Date, default: null },
    missions: {
        joinedGroup: { type: Boolean, default: false },
        firstBoostPurchased: { type: Boolean, default: false },
        invitedUsersCount: { type: Number, default: 0 },
        claimedInviteReward: { type: Boolean, default: false }
    },
    // Añadimos un campo para las ganancias por referidos para que la consulta no falle
    referralEarnings: { type: Number, default: 0 }
}, { timestamps: true });

// Método estático centralizado para encontrar o crear un usuario
userSchema.statics.findOrCreate = async function(tgUser) {
    if (!tgUser || !tgUser.id) {
        throw new Error("Datos de usuario de Telegram inválidos proporcionados a findOrCreate.");
    }
    let user = await this.findOne({ telegramId: tgUser.id });
    if (!user) {
        console.log(`✅ Creando nuevo usuario: ${tgUser.id}. Asignando valores iniciales explícitos.`);
        user = new this({
            telegramId: tgUser.id,
            firstName: tgUser.first_name || tgUser.firstName || 'Usuario',
            username: tgUser.username,
            photoUrl: tgUser.photo_url || tgUser.photoUrl,
            // Asignación explícita para evitar errores de cálculo y de `default`
            autBalance: 0,
            boostYieldPerHour: 0,
            storageCapacity: (350 / 24) * 8,
            lastClaim: new Date()
        });
        await user.save();
    }
    return user;
};

const User = mongoose.model('User', userSchema);
module.exports = User;