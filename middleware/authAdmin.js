// --- START OF FILE atu-mining-api/middleware/authAdmin.js ---

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

if (!INTERNAL_API_KEY) {
    throw new Error("INTERNAL_API_KEY no está definida en las variables de entorno.");
}

const authAdmin = (req, res, next) => {
    const providedKey = req.headers['x-internal-api-key'];
    
    if (!providedKey || providedKey !== INTERNAL_API_KEY) {
        return res.status(403).json({ message: "Acceso no autorizado: clave de API interna inválida." });
    }
    
    next();
};

module.exports = authAdmin;
// --- END OF FILE atu-mining-api/middleware/authAdmin.js ---