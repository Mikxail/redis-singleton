var util = require('util');
var EventEmitter = require('events').EventEmitter;

function PermanentLock(lock, options){
    EventEmitter.call(this);
    this._lock = lock;
    this._options = options || {};
    this._isCallbackCalled = false;
    this._relockShift = this._options.relockShift || 100;

    this._timer = null;

    this._hasLock = false;
}

util.inherits(PermanentLock, EventEmitter);

PermanentLock.prototype.start = function (callback) {
    var self = this;
    callback = callback || function(){};
    this._tryLockAndEmit(function(err, isSuccess, timeout){
        if (err || !isSuccess) {
            callback(null, false);
        } else {
            callback(null, true);
        }
        self._startTimer(timeout);
    });
};

PermanentLock.prototype.stop = function (callback) {
    var self = this;
    callback = callback || function(){};
    if (!this._hasLock) {
        this._clearTimer();
        return callback(null, true);
    }
    this._lock.unlock(function(err, isSuccess){
        if (err) return callback(err);
        self._clearTimer();
        if (isSuccess) {
            self._hasLock = false;
            self.emit('unlock');
        }
    });
};

PermanentLock.prototype._tryLock = function (callback) {
    if (this._hasLock) {
        this._lock.updateLock(callback);
    } else {
        this._lock.tryLock(callback);
    }
};

PermanentLock.prototype._tryLockAndEmit = function (callback) {
    var self = this;
    this._tryLock(function(err, isSuccess, timeout){
        if (err || !isSuccess) {
            if (self._hasLock) {
                self._hasLock = false;
                self.emit('unlock');
            }
        } else {
            timeout -= self._relockShift;
            if (!self._hasLock) {
                self._hasLock = true;
                self.emit('lock', timeout);
            }
        }
        callback(null, isSuccess, timeout);
    });
};

PermanentLock.prototype._startTimer = function (timeout) {
    var self = this;
    this._clearTimer();
    this._timer = setTimeout(function(){
        self._tryLockAndEmit(function(err, isSuccess, timeout2){
            self._startTimer(timeout2);
        });
    }, timeout);
};

PermanentLock.prototype._clearTimer = function () {
    if (this._timer) clearTimeout(this._timer);
    this._timer = null;
};

module.exports = PermanentLock;