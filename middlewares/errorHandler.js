/**
 * Middleware Global de Tratamento de Erros
 */

const errorHandler = (err, req, res, next) => {
    console.error('❌ [SERVER ERROR]:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    // Se for uma requisição AJAX/API, retorna JSON
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        return res.status(500).json({
            success: false,
            message: 'Ocorreu um erro interno no servidor. Tente novamente mais tarde.',
            error: process.env.NODE_ENV === 'production' ? null : err.message
        });
    }

    // Caso contrário, renderiza a página 404 ou uma página de erro genérica
    res.status(500).render('404', { 
        mensagem: 'Ops! Algo deu errado no nosso servidor. Nossa equipe já foi notificada.',
        error: process.env.NODE_ENV === 'production' ? null : err.message
    });
};

// Utilitário para envolver rotas assíncronas e capturar erros (evita crash)
const catchAsync = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};

module.exports = {
    errorHandler,
    catchAsync
};
