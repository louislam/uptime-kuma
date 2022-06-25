/* npm run swagger-autogen */

const swaggerAutogen = require("swagger-autogen")();

const doc = {
    info: {
        title: "Uptime Kuma API",
        description: "Autogen by swagger-autogen",
    },
    host: "localhost:3001",
    schemes: [ "http" ],
};

// The working directory is root
const outputFile = "./swagger.json";

const endpointsFiles = [
    "./server/routers/api-router.js",
];

/* NOTE: if you use the express Router, you must pass in the
   'endpointsFiles' only the root file where the route starts,
   such as index.js, app.js, routes.js, ... */

swaggerAutogen(outputFile, endpointsFiles, doc);
