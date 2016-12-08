var util = require('util');
var EventEmitter = require('events').EventEmitter;
var LockManager = require('./lock-manager');

function Singleton(client, options){
    EventEmitter.call(this);
    this._client = client;
    if (!this._client) {
        throw new Error("You must specify client");
    }
    this._options = options || {};
    this._singletonName = this._options.singletonName || this._options.name;
    if (!this._singletonName) {
        throw new Error("You must specify singletonName");
    }
    this._lm = new LockManager(this._client, this._options);
    this._lock = null;
    this._init();
    // this._isMaster = false;
    // this._masterAlive = false;
}

util.inherits(Singleton, EventEmitter);

Singleton.prototype._init = function () {
    this._lock = this._lm.permanentLock(this._singletonName);
    this._lock.on('lock', function(){
        this.emit('master');
    }.bind(this));
    this._lock.on('unlock', function(){
        this.emit('slave');
    }.bind(this));
};

module.exports = Singleton;