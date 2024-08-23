#!/usr/bin/env node

const childProcess = require("child_process");
let env = process.env;

let cmd = process.argv[2];
let args = process.argv.slice(3);
let replacedArgs = [];

for (let arg of args) {
    for (let key in env) {
        arg = arg.replaceAll(`$${key}`, env[key]);
    }
    replacedArgs.push(arg);
}

let child = childProcess.spawn(cmd, replacedArgs);
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
