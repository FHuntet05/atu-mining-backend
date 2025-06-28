import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    telegramId: { type: Number, required: true, unique: true, index: true },
    firstName: { type: String, required: true },
    username: { type: String, required: false },
    photoUrl: { type: String, required: false },
    
    // Balances
    autBalance: { type: Number, default: 0 },
    usdtBalance: { type: Number, default: 0 }, // SALDO ÚNICO
    
    // Minería y Boosts
    lastClaim: { type: Date, default: Date.now },
    boostYieldPerHour: { type: Number, default: 0 },
    activeBoosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ActiveBoost' }],
    totalMinedAUT: { type: Number, default: 0, index: true },

    // Referidos
    referrerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    referralEarnings: { type: Number, default: 0 },

    // Metadata y Tareas
    lastWithdrawalRequest: { type: Date, default: null },
    completedTasks: [{ type: String }],
    hasSeenWelcome: { type: Boolean, default: false }, // NUEVO FLAG

}, { timestamps: true });

userSchema.statics.findOrCreate = async function(tgUser) {
    if (!tgUser || !tgUser.id) throw new Error("Datos de usuario de Telegram inválidos.");
    let user = await this.findOne({ telegramId: tgUser.id });
    if (!user) {
        user = new this({
            telegramId: tgUser.id,
            firstName: tgUser.first_name || tgUser.firstName || 'Usuario',
            username: tgUser.username,
            photoUrl: tgUser.photo_url || tgUser.photoUrl,
        });
        await user.save();
    }
    return user;
};

const User = mongoose.model('User', userSchema);
export default User;