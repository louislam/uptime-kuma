import * as fs from "node:fs";
let stats = fs.statSync("/mnt/public/README.md");
console.log(stats);
