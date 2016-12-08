var uuid = require('uuid').v4;

function Lock(client, options){
    this._client = client;
    this._options = options || {};
    this._lockUUID = uuid();
    this._name = this._options.name;
    this._lockName = "lock." + this._name;
    this._timeout = this._options.timeout || 3000;
    this._retryTimeout = this._options.retryTimeout || 50;
}

Lock.prototype.acquireLock = function (callback) {
    var lockVal = this._getLockValue();

    var self = this;
    this._client.set(this._lockName, lockVal, 'PX', this._timeout, 'NX', function(err, res){
        if (err || res === null) return callback(new Error("can't lock"));
        callback(null, self._timeout);
    });
};

Lock.prototype.lock = function (task) {
    var self = this;
    this.acquireLock(function (err) {
        if (err) {
            setTimeout(function(){
                self.lock(task);
            }, self._retryTimeout);
        } else {
            task(function(done){
                done = done || function(){};
                self.unlock(done);
            });
        }
    })
};

Lock.prototype.tryLock = function (callback) {
    var self = this;
    this.acquireLock(function(err, timeout){
        if (err) {
            self._client.get(self._lockName, function(err, res){
                if (err || res === null) return callback(null, false, self._retryTimeout);
                callback(null, false, self._getLockTimeByValue(res) - Date.now() + 1);
            });
        } else {
            callback(null, true, timeout);
        }
    });
};

Lock.prototype.updateLock = function (callback) {
    var self = this;
    this._watchAndCheckOwner(function(err){
        if (err) return callback(err);
        self._client.multi()
            .set(self._lockName, self._getLockValue(), 'PX', self._timeout)
            .exec(function(err, results){
                if (err) return callback(err);
                if (results === null || results[0] === null) return callback(new Error("lock owner changed"));
                callback(null, true, self._timeout);
            });
    });
};

Lock.prototype.unlock = function (callback) {
    var self = this;
    this._watchAndCheckOwner(function(err){
        if (err) {
            if (err.message === "lock owner changed") return callback(null, false);
            return callback(err);
        }
        self._client.multi()
            .del(self._lockName)
            .exec(function(err, results){
                if (err) return callback(err);
                if (results === null || results[0] === null) return callback(null, false);
                callback(null, true);
            });
    });
};

Lock.prototype._watchAndCheckOwner = function (callback) {
    var self = this;
    this._client.watch(this._lockName, function(err){
        if (err) return callback(err);
        self._client.get(self._lockName, function(err, res){
            if (err) return callback(err);
            if (!self._isMyLock(res)) return callback(new Error("lock owner changed"));
            return callback(null);
        });
    });
};

Lock.prototype._getLockValue = function () {
    var lockValTime = Date.now() + this._timeout + 1;
    var lockVal = lockValTime + ":" + this._lockUUID;
    return lockVal;
};

Lock.prototype._getLockTimeByValue = function (res) {
    var res = (res || "").split(":");
    return (+res[0]) || (Date.now() + this._retryTimeout);
};

Lock.prototype._isMyLock = function (res) {
    var res = (res || "").split(":");
    return res[1] === this._lockUUID;
};

module.exports = Lock;