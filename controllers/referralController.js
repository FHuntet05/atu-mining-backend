const User = require('../models/User');

const COMMISSIONS = { level1: 0.30, level2: 0.15, level3: 0.075 };

exports.getReferralData = async (req, res) => {
    try {
        const { telegramId } = req.params;
        
        // Usamos populate, que es más fácil de leer y depurar que la agregación compleja.
        // Poblamos 3 niveles de profundidad para contar los miembros.
        const user = await User.findOne({ telegramId: parseInt(telegramId, 10) })
            .populate({
                path: 'referrals', // Nivel 1
                populate: {
                    path: 'referrals', // Nivel 2
                    populate: { path: 'referrals', model: 'User' }, // Nivel 3
                    model: 'User'
                },
                model: 'User'
            });

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const level1Users = user.referrals || [];
        const level2Users = level1Users.flatMap(l1 => l1.referrals || []);
        const level3Users = level2Users.flatMap(l2 => l2.referrals || []);

        // Construimos el objeto que tu frontend `TeamPage.jsx` espera recibir.
        const referralData = {
            code: user.telegramId,
            totalEarnings: user.referralEarnings || 0, // Usamos un valor por defecto
            tiers: [
              { level: 1, title: 'Nivel 1', invites: level1Users.length, earnings: '0.00', color: '#4ef2f7', gainPerReferral: COMMISSIONS.level1 },
              { level: 2, title: 'Nivel 2', invites: level2Users.length, earnings: '0.00', color: '#f7a84e', gainPerReferral: COMMISSIONS.level2 },
              { level: 3, title: 'Nivel 3', invites: level3Users.length, earnings: '0.00', color: '#d84ef7', gainPerReferral: COMMISSIONS.level3 },
            ]
        };

        res.status(200).json(referralData);

    } catch (error) {
        console.error("Error en /api/referrals:", error);
        res.status(500).json({ message: 'Error del servidor al obtener datos de referidos.' });
    }
};