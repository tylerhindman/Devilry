const {onSchedule} = require('firebase-functions/v2/scheduler');
const {logger} = require('firebase-functions');
const admin = require('firebase-admin');

exports.cleanRooms = onSchedule('0 */8 * * *', async (event) => {
  const inactiveRooms = await getInactiveRooms();

  for (const inactiveRoomKey of inactiveRooms) {
    admin.database().ref('roomKeys/' + inactiveRoomKey).remove();
    admin.database().ref(inactiveRoomKey).remove();
  }

  logger.info('Room cleanup finished - ' + new Date().toLocaleString() +
    ' - rooms: ' + inactiveRooms, {structuredData: true});

  return;
});

async function getInactiveRooms() {
  const roomPromise = new Promise((resolve, reject) => {
    admin.database().ref('roomKeys').once('value', (snapshot) => {
      const inactiveRooms = [];
      if (snapshot.exists()) {
        const rooms = snapshot.val();
        const killTimestamp = new Date();
        killTimestamp.setHours(killTimestamp.getHours() - 8);
        for (const roomKey in rooms) {
          if (rooms[roomKey].timestamp < killTimestamp.valueOf()) {
            inactiveRooms.push(roomKey);
          }
        }
      }

      resolve(inactiveRooms);
    });
  });
  return roomPromise;
}
