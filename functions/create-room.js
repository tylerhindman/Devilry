const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

exports.createRoom = onRequest((request, response) => {
  logger.info("Create room called...", {structuredData: true});
  response.send("Hello from Firebase!");
});