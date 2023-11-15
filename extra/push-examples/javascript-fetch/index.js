// Supports: Node.js >= 18, Deno, Bun
const pushURL = "https://example.com/api/push/key?status=up&msg=OK&ping=";
const interval = 60;

const push = async () => {
    await fetch(pushURL);
    console.log("Pushed!");
};

push();
setInterval(push, interval * 1000);
