function getPublicSessionUser(session) {
  if (!session) return { userId: null, userType: null, fullName: null, adminLogado: false };
  return {
    userId: session.userId || null,
    userType: session.userType || null,
    fullName: session.fullName || null,
    professionalReady: Boolean(session.professionalReady),
    adminLogado: Boolean(session.adminLogado)
  };
}

function clearUserSession(session) {
  if (!session) return;
  delete session.userId;
  delete session.userType;
  delete session.fullName;
  delete session.afterLoginRedirect;
  delete session.professionalReady;
  delete session.passport;
}

function clearAdminSession(session) {
  if (!session) return;
  delete session.adminLogado;
}

function applyUserSession(session, user) {
  if (!session || !user) return;
  clearAdminSession(session);
  session.userId = user.id;
  session.userType = user.user_type;
  session.fullName = user.full_name;
  session.professionalReady = Boolean(user.profile_completed || user.professionalReady);
}

function applyAdminSession(session) {
  if (!session) return;
  clearUserSession(session);
  session.adminLogado = true;
}

module.exports = {
  getPublicSessionUser,
  clearUserSession,
  clearAdminSession,
  applyUserSession,
  applyAdminSession
};
