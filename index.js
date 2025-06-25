// En: atu-mining-backend/index.js

// --- CONFIGURACIÓN DEL BOT DE TELEGRAF ---
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = parseInt(process.env.ADMIN_TELEGRAM_ID, 10);

// Middleware para registrar el ID de todos los que interactúan con el bot
bot.use(async (ctx, next) => {
    try {
        // Guardamos o actualizamos al usuario cada vez que interactúa
        await User.updateOne(
            { telegramId: ctx.from.id },
            { $set: { username: ctx.from.username, firstName: ctx.from.first_name } },
            { upsert: true } // Si el usuario no existe, lo crea
        );
    } catch (e) {
        console.error("Error al registrar usuario en middleware:", e);
    }
    return next();
});

// Comando /start para usuarios normales
bot.start(async (ctx) => {
    const miniAppUrl = process.env.MINI_APP_URL;
    const startParam = ctx.startPayload; 
    
    try {
        // La lógica de referido ya está en tu ruta /sync, pero podemos pre-registrarla aquí también
        if (startParam) {
            const referrerId = parseInt(startParam, 10);
            if (!isNaN(referrerId) && referrerId !== ctx.from.id) {
                // Añade este usuario a la lista de referidos de su referente
                await User.updateOne({ telegramId: referrerId }, { $addToSet: { referrals: ctx.from.id } });
                // Guarda quién lo refirió
                await User.updateOne({ telegramId: ctx.from.id }, { $set: { referrerId: referrerId } });
            }
        }
    } catch (e) { console.error("Error al procesar referido en /start:", e); }

    ctx.reply('¡Bienvenido a ATU Mining! Haz clic abajo para empezar a minar.', {
        reply_markup: {
            inline_keyboard: [[{ text: '🚀 Abrir App de Minería', web_app: { url: miniAppUrl } }]]
        }
    });
});

// --- COMANDOS EXCLUSIVOS PARA EL ADMINISTRADOR ---

// Middleware para filtrar comandos de admin
const adminOnly = (ctx, next) => {
    if (ctx.from.id === ADMIN_ID) {
        return next();
    }
    console.log(`Intento de acceso no autorizado por ID: ${ctx.from.id}`);
};

// Comando para acreditar saldo: /approve <ID> <Cantidad> <Moneda> <Descripción>
// Ejemplo: /approve 12345678 10 USDT Compra_Manual
// Ejemplo: /approve 12345678 50000 AUT Bono_Bienvenida
bot.command('approve', adminOnly, async (ctx) => {
    try {
        const parts = ctx.message.text.split(' ');
        if (parts.length < 5) {
            return ctx.reply('Formato: /approve <ID> <Cant> <Moneda> <Descrip_con_guiones>');
        }

        const telegramId = parseInt(parts[1], 10);
        const amount = parseFloat(parts[2]);
        const currency = parts[3].toUpperCase();
        const description = parts.slice(4).join(' ').replace(/_/g, ' ');

        let updateField = {};
        if (currency === 'USDT') {
            updateField = { $inc: { usdtBalance: amount } };
        } else if (currency === 'AUT') {
            updateField = { $inc: { autBalance: amount } };
        } else {
            return ctx.reply('Moneda no válida. Usa "USDT" o "AUT".');
        }

        const user = await User.findOneAndUpdate({ telegramId }, updateField, { new: true });
        if (!user) return ctx.reply(`❌ Usuario con ID ${telegramId} no encontrado.`);

        const newTransaction = new Transaction({ telegramId, type: 'deposit', description, amount: `+${amount.toFixed(2)} ${currency}` });
        await newTransaction.save();

        ctx.reply(`✅ Saldo acreditado a @${user.username || telegramId}. Nuevo balance: ${amount.toFixed(2)} ${currency}`);
        
        try {
            await ctx.telegram.sendMessage(telegramId, `🎉 ¡Has recibido ${amount.toFixed(2)} ${currency}! Razón: ${description}.`);
        } catch (e) {
            ctx.reply('ℹ️ No se pudo notificar al usuario.');
        }
    } catch (error) {
        ctx.reply('❌ Error en el comando /approve.');
    }
});

// Comando para buscar un usuario: /find <ID o @username>
bot.command('find', adminOnly, async (ctx) => {
    const query = ctx.message.text.split(' ')[1];
    if (!query) return ctx.reply('Uso: /find <ID o @username>');
    
    try {
        const searchField = query.startsWith('@') 
            ? { username: query.substring(1) } 
            : { telegramId: parseInt(query, 10) };
        
        const user = await User.findOne(searchField);
        if (!user) return ctx.reply('Usuario no encontrado.');
        
        const userInfo = `
*--- Perfil de Usuario ---*
*ID:* \`${user.telegramId}\`
*Username:* @${user.username || 'N/A'}
*Nombre:* ${user.firstName || 'N/A'}
*Saldo AUT:* ${user.autBalance.toLocaleString()}
*Saldo USDT (retiro):* ${user.usdtForWithdrawal.toFixed(2)}
*Referidos:* ${user.referrals.length}
*Se unió:* ${user.createdAt.toLocaleDateString()}
        `;
        ctx.replyWithMarkdown(userInfo);
    } catch (error) {
        ctx.reply('Error al buscar usuario.');
    }
});

// Comando para enviar un mensaje a todos los usuarios: /broadcast <mensaje>
bot.command('broadcast', adminOnly, async (ctx) => {
    const message = ctx.message.text.substring(ctx.message.text.indexOf(" ") + 1);
    if (message === '/broadcast') return ctx.reply('Uso: /broadcast <Tu mensaje aquí>');
    
    const allUsers = await User.find({}, 'telegramId');
    ctx.reply(`📣 Empezando a enviar mensaje a ${allUsers.length} usuarios...`);
    
    let sentCount = 0;
    for (const user of allUsers) {
        try {
            await ctx.telegram.sendMessage(user.telegramId, message);
            sentCount++;
            // Pausa para no sobrecargar la API de Telegram
            await new Promise(resolve => setTimeout(resolve, 100)); 
        } catch (e) {
            console.log(`No se pudo enviar mensaje a ${user.telegramId}`);
        }
    }
    ctx.reply(`✅ Mensaje enviado a ${sentCount} de ${allUsers.length} usuarios.`);
});

// Webhook de Telegraf...
const secretPath = `/telegraf/${bot.token}`;
app.use(bot.webhookCallback(secretPath));

// Iniciar servidor y bot...
