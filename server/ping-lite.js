// https://github.com/ben-bradley/ping-lite/blob/master/ping-lite.js
// Fixed on Windows

let spawn = require("child_process").spawn,
    events = require("events"),
    fs = require("fs"),
    WIN = /^win/.test(process.platform),
    LIN = /^linux/.test(process.platform),
    MAC = /^darwin/.test(process.platform);

module.exports = Ping;

function Ping(host, options) {
    if (!host) {
        throw new Error("You must specify a host to ping!");
    }

    this._host = host;
    this._options = options = (options || {});

    events.EventEmitter.call(this);

    if (WIN) {
        this._bin = "c:/windows/system32/ping.exe";
        this._args = (options.args) ? options.args : [ "-n", "1", "-w", "5000", host ];
        this._regmatch = /[><=]([0-9.]+?)ms/;
    } else if (LIN) {
        this._bin = "/bin/ping";
        this._args = (options.args) ? options.args : [ "-n", "-w", "2", "-c", "1", host ];
        this._regmatch = /=([0-9.]+?) ms/; // need to verify this
    } else if (MAC) {
        this._bin = "/sbin/ping";
        this._args = (options.args) ? options.args : [ "-n", "-t", "2", "-c", "1", host ];
        this._regmatch = /=([0-9.]+?) ms/;
    } else {
        throw new Error("Could not detect your ping binary.");
    }

    if (!fs.existsSync(this._bin)) {
        throw new Error("Could not detect " + this._bin + " on your system");
    }

    this._i = 0;

    return this;
}

Ping.prototype.__proto__ = events.EventEmitter.prototype;

// SEND A PING
// ===========
Ping.prototype.send = function(callback) {
    let self = this;
    callback = callback || function(err, ms) {
        if (err) {
            return self.emit("error", err);
        }
        return self.emit("result", ms);
    };

    let _ended, _exited, _errored;

    this._ping = spawn(this._bin, this._args); // spawn the binary

    this._ping.on("error", function(err) { // handle binary errors
        _errored = true;
        callback(err);
    });

    this._ping.stdout.on("data", function(data) { // log stdout
        this._stdout = (this._stdout || "") + data;
    });

    this._ping.stdout.on("end", function() {
        _ended = true;
        if (_exited && !_errored) {
            onEnd.call(self._ping);
        }
    });

    this._ping.stderr.on("data", function(data) { // log stderr
        this._stderr = (this._stderr || "") + data;
    });

    this._ping.on("exit", function(code) { // handle complete
        _exited = true;
        if (_ended && !_errored) {
            onEnd.call(self._ping);
        }
    });

    function onEnd() {
        let stdout = this.stdout._stdout,
            stderr = this.stderr._stderr,
            ms;

        if (stderr) {
            return callback(new Error(stderr));
        }

        if (!stdout) {
            return callback(new Error("No stdout detected"));
        }

        ms = stdout.match(self._regmatch); // parse out the ##ms response
        ms = (ms && ms[1]) ? Number(ms[1]) : ms;

        callback(null, ms);
    }
};

// CALL Ping#send(callback) ON A TIMER
// ===================================
Ping.prototype.start = function(callback) {
    let self = this;
    this._i = setInterval(function() {
        self.send(callback);
    }, (self._options.interval || 5000));
    self.send(callback);
};

// STOP SENDING PINGS
// ==================
Ping.prototype.stop = function() {
    clearInterval(this._i);
};
