const {initializeApp} = require("firebase-admin/database");
const admin = require("firebase-admin");
admin.initializeApp();

const createRoom = require("./create-room");

exports.createRoom = createRoom.createRoom;