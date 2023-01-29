const { setupClient } = require("vite-plugin-blocklet");
const { app } = require("./server");

setupClient(app);
