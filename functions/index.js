const {initializeApp} = require("firebase-admin/database");
const createRoom = require("./create-room");

initializeApp();

exports.createRoom = createRoom.createRoom;