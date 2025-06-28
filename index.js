// =================================================================
// =========== INICIO DE LA LÓGICA DEL BOT DE TELEGRAM =============
// =================================================================

// ... (todo el código de los comandos /start y /addboost se queda igual)

// =================================================================
// === CONFIGURACIÓN DEL WEBHOOK Y ARRANQUE DEL SERVIDOR (MODIFICADO) ==
// =================================================================

// --- DIAGNÓSTICO DE VARIABLES DE ENTORNO ---
console.log("--- DIAGNOSTICANDO VARIABLES DE TELEGRAM ---");
console.log(`RENDER_EXTERNAL_URL: ${process.env.RENDER_EXTERNAL_URL}`);
console.log(`TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? 'Presente (Oculto por seguridad)' : '!!! AUSENTE !!!'}`);
console.log(`TELEGRAM_SECRET_TOKEN: ${process.env.TELEGRAM_SECRET_TOKEN ? process.env.TELEGRAM_SECRET_TOKEN : '!!! AUSENTE !!!'}`);
console.log("-----------------------------------------");

// --- Lógica de arranque robusta ---
const startServer = async () => {
    try {
        // Asegurémonos de que las variables críticas existan antes de continuar
        if (!process.env.RENDER_EXTERNAL_URL || !process.env.TELEGRAM_SECRET_TOKEN || !process.env.TELEGRAM_BOT_TOKEN) {
            console.error("!!! ERROR CRÍTICO: Faltan una o más variables de entorno de Telegram (URL, TOKEN o SECRET_TOKEN). Abortando arranque del webhook.");
            // Aún así arrancamos el servidor de API, pero el bot no funcionará.
            app.listen(PORT, () => {
                console.log(`Servidor API arrancado en el puerto ${PORT}, pero el BOT ESTÁ INACTIVO por falta de variables.`);
            });
            return;
        }

        const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

        // ... (Pega aquí los handlers bot.command('start', ...) y bot.command('addboost', ...) que ya tenías)
        // ...
        
        // --- COMANDO /start (Público para todos los usuarios) ---
        bot.command('start', (ctx) => {
            const welcomeMessage = `¡Bienvenido a ATU Mining USDT! 🚀\n\nPresiona el botón de abajo para iniciar la aplicación y comenzar a minar.`;
            ctx.reply(welcomeMessage, {
                reply_markup: {
                    inline_keyboard: [[{ text: '⛏️ Abrir App de Minería', web_app: { url: process.env.FRONTEND_URL } }]]
                }
            });
        });

        // --- COMANDO /addboost (Solo para Administradores) ---
        bot.command('addboost', async (ctx) => {
            const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',');
            const userId = ctx.from.id.toString();
            if (!adminIds.includes(userId)) {
                return ctx.reply('❌ Acceso denegado. Este comando es solo para administradores.');
            }
            const parts = ctx.message.text.split(' ');
            if (parts.length !== 4) {
                return ctx.reply('Formato incorrecto. Uso: /addboost <ID_TELEGRAM_USUARIO> <ID_BOOST> <CANTIDAD>');
            }
            const targetUserId = parts[1];
            const boostId = parts[2].toUpperCase();
            const quantity = parseInt(parts[3], 10);
            if (isNaN(quantity) || quantity <= 0) {
                return ctx.reply('La cantidad debe ser un número positivo.');
            }
            try {
                const targetUser = await User.findOne({ telegramId: targetUserId });
                if (!targetUser) {
                    return ctx.reply(`❌ Error: No se encontró un usuario con el ID de Telegram ${targetUserId}.`);
                }
                await boostService.addBoostToUser(targetUser._id, boostId, quantity);
                ctx.reply(`✅ ¡Éxito! Se añadieron ${quantity} boost(s) de tipo "${boostId}" al usuario con ID de Telegram ${targetUserId}.`);
            } catch (error) {
                console.error(`Error en comando /addboost:`, error);
                ctx.reply(`❌ Error al procesar el comando. Razón: ${error.message}`);
            }
        });

        const secretPath = `/telegraf/${bot.secretPathComponent()}`;
        
        // El middleware del webhook. Express lo usará para las peticiones de Telegram.
        app.use(await bot.createWebhook({ 
            domain: process.env.RENDER_EXTERNAL_URL,
            // Fallback por si la variable no se lee correctamente
            secret_token: process.env.TELEGRAM_SECRET_TOKEN 
        }));

        app.listen(PORT, () => {
            console.log(`Servidor corriendo en el puerto ${PORT}`);
            console.log(`Webhook configurado en el dominio: ${process.env.RENDER_EXTERNAL_URL}`);
            // NOTA: No podemos imprimir el secretPath final aquí porque se genera dentro de `createWebhook`
            // pero podemos estar seguros de que si las variables están presentes, funcionará.
        });

    } catch (error) {
        console.error("Error catastrófico durante el arranque del servidor:", error);
    }
};

startServer();