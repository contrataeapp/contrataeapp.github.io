const { getPublicSessionUser } = require('../lib/sessionState');

/**
 * Middlewares de Autenticação e Autorização
 */

// Garante que o usuário está logado
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) return next();
    const nextUrl = encodeURIComponent(req.originalUrl || '/');
    res.redirect(`/auth/login?next=${nextUrl}`);
};

// Garante que o usuário é um Profissional
const requireProfessional = (req, res, next) => {
    if (req.session && req.session.userId && req.session.userType === 'professional') return next();
    if (req.session && req.session.userId && req.session.userType === 'client') return res.redirect('/cliente/dashboard');
    const nextUrl = encodeURIComponent(req.originalUrl || '/profissional/dashboard');
    res.redirect(`/auth/login?next=${nextUrl}`);
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
    const state = getPublicSessionUser(req.session);
    res.locals.userId = state.userId;
    res.locals.userType = state.userType;
    res.locals.fullName = state.fullName;
    res.locals.adminLogado = state.adminLogado;
    next();
};

module.exports = {
    requireAuth,
    requireProfessional,
    requireAdmin,
    injectUserVars
};
