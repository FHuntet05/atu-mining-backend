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
    activeBoosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ActiveBoost' }],
    storageCapacity: { type: Number, default: (350 / 24) * 8 },
    referrerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    lastWithdrawalRequest: { type: Date, default: null },
    hasMadeDeposit: { type: Boolean, default: false },
    referralEarnings: { type: Number, default: 0 },
    completedTasks: [{ type: String }]
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
module.exports = User;