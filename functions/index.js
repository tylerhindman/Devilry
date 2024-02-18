const admin = require('firebase-admin');
admin.initializeApp();

const createRoom = require('./create-room');
const cleanRooms = require('./clean-rooms-cron');

exports.createRoom = createRoom.createRoom;
exports.cleanRooms = cleanRooms.cleanRooms;
