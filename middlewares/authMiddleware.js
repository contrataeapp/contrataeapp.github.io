/**
 * Middlewares de Autenticação e Autorização
 */

// Garante que o usuário está logado
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    res.redirect('/auth/login');
};

// Garante que o usuário é um Profissional
const requireProfessional = (req, res, next) => {
    if (req.session && req.session.userId && req.session.userType === 'professional') {
        return next();
    }
    res.redirect('/auth/login');
};

// Garante que o usuário é um Administrador
const requireAdmin = (req, res, next) => {
    if (req.session && req.session.adminLogado) {
        return next();
    }
    res.redirect('/admin/login');
};

// Middleware para injetar variáveis globais em todas as views
const injectUserVars = (req, res, next) => {
    res.locals.userId = req.session.userId || null;
    res.locals.userType = req.session.userType || null;
    res.locals.fullName = req.session.fullName || null;
    res.locals.adminLogado = req.session.adminLogado || false;
    next();
};

module.exports = {
    requireAuth,
    requireProfessional,
    requireAdmin,
    injectUserVars
};
