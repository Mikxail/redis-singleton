var Lock = require('./lock');
var PermanentLock = require('./permanent-lock');

function LockManager(client, options){
    this._client = client;
    if (!this._client) {
        throw new Error("You must specify client");
    }
    this._options = options || {};
    this._timeout = this._options.timeout || 3000;
    this._retryTimeout = this._options.retryTimeout || 100;
    this._permanentRelockShift = this._options.permanentRelockShift || this._retryTimeout;
}

LockManager.prototype.lock = function (name, options, callback) {
    if (typeof options == "function") {
        callback = options;
        options = {};
    }
    var lockOpts = Object.assign({
        name: name
    }, this._options, options || {});
    var lock = new Lock(this._client, lockOpts);
    if (typeof callback == 'function') {
        lock.lock(callback);
    }
    return lock;
};

LockManager.prototype.permanentLock = function (name, options, callback) {
    var lock = this.lock(name, options);
    var pLockOpts = Object.assign({
        relockShift: this._permanentRelockShift
    }, options);
    var pLock = new PermanentLock(lock, pLockOpts);
    if (typeof callback == 'function') {
        pLock.start(callback);
    }
    return pLock;
};

module.exports = LockManager;