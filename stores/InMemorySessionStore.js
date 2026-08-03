const session = require('express-session');

class InMemorySessionStore extends session.Store {
  constructor(options = {}) {
    super();
    this.sessions = new Map();
    this.ttlMs = Number(options.ttlMs || 1000 * 60 * 60 * 24 * 7);
    this.pruneIntervalMs = Number(options.pruneIntervalMs || 1000 * 60 * 30);
    this.timer = setInterval(() => this.prune(), this.pruneIntervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  _expiresAt(sess) {
    const cookieExpires = sess?.cookie?.expires ? new Date(sess.cookie.expires).getTime() : null;
    return cookieExpires && Number.isFinite(cookieExpires) ? cookieExpires : Date.now() + this.ttlMs;
  }

  get(sid, cb) {
    try {
      const entry = this.sessions.get(sid);
      if (!entry) return cb(null, null);
      if (entry.expiresAt <= Date.now()) {
        this.sessions.delete(sid);
        return cb(null, null);
      }
      return cb(null, entry.session);
    } catch (err) {
      return cb(err);
    }
  }

  set(sid, sess, cb = () => {}) {
    try {
      this.sessions.set(sid, { session: sess, expiresAt: this._expiresAt(sess) });
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  destroy(sid, cb = () => {}) {
    this.sessions.delete(sid);
    cb(null);
  }

  touch(sid, sess, cb = () => {}) {
    if (this.sessions.has(sid)) {
      this.sessions.set(sid, { session: sess, expiresAt: this._expiresAt(sess) });
    }
    cb(null);
  }

  prune() {
    const now = Date.now();
    for (const [sid, entry] of this.sessions.entries()) {
      if (entry.expiresAt <= now) this.sessions.delete(sid);
    }
  }
}

module.exports = InMemorySessionStore;
