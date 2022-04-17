console.log("Git Push and Publish the release note on github, then press any key to continue");

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.on("data", process.exit.bind(process, 0));

