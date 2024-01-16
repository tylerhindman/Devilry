import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, orderByChild, query, off, limitToLast, remove } from "firebase/database";

// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/learn-more#config-object
const firebaseConfig = {
  // ...
  // The value of `databaseURL` depends on the location of the database
  databaseURL: "https://devilry-843c7-default-rtdb.firebaseio.com/",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);


// Initialize Realtime Database and get a reference to the service
const db = getDatabase(app);

let globalListenerList = [];

let localListenerList = [];


//#region GLOBALCHAT
export function writeGlobalChatMessage (name, message, roomName) {
  const db = getDatabase();
  const timestamp = Date.now();
  set(ref(db, roomName + '/globalChat/' + timestamp + '_' + name), {
    username: name,
    message: message,
    timestamp: timestamp
  });
}

export function setGlobalChatDBMessageListener (roomName, listenerFunction) {
  const messageRef = query(ref(db, roomName + '/globalChat'));
  globalListenerList.push(messageRef);
  onValue(messageRef, (snapshot) => {
    listenerFunction(snapshot);
  });
}
//#endregion


//#region MAP
export function writeGlobalMapUpdate (roomName, y, x, mapKey) {
  const db = getDatabase();
  set(ref(db, roomName + '/map/' + y + '_' + x), {
    mapKey: mapKey
  });
}

export function setGlobalMapDBMessageListener (roomName, listenerFunction) {
  const messageRef = query(ref(db, roomName + '/map'));
  globalListenerList.push(messageRef);
  onValue(messageRef, (snapshot) => {
    listenerFunction(snapshot);
  });
}
//#endregion


//#region LOCALCHAT
export function writeLocalChatMessage (roomName, y, x, name, message) {
  const db = getDatabase();
  const timestamp = Date.now();
  set(ref(db, roomName + '/map/' + y + '_' + x + '/localChat/' + timestamp + '_' + name), {
    username: name,
    message: message,
    timestamp: timestamp
  });
}

export function setLocalChatDBMessageListener (roomName, y, x, listenerFunction) {
  const messageRef = query(ref(db, roomName + '/map/' + y + '_' + x + '/localChat'), orderByChild('timestamp'), limitToLast(1));
  localListenerList.push(messageRef);
  onValue(messageRef, (snapshot) => {
    listenerFunction(snapshot);
  });
}
//#endregion


//#region PLAYERS_LOCAL
export function writePlayersLocalMessage (roomName, y, x, name) {
  const db = getDatabase();
  const timestamp = Date.now();
  set(ref(db, roomName + '/map/' + y + '_' + x + '/players/' + name), {
    username: name,
    timestamp: timestamp
  });
}

export function removePlayersLocal (roomName, y, x, name) {
  remove(ref(db, roomName + '/map/' + y + '_' + x + '/players/' + name));
}

export function setPlayersLocalDBMessageListener (roomName, y, x, listenerFunction) {
  const messageRef = query(ref(db, roomName + '/map/' + y + '_' + x + '/players'));
  localListenerList.push(messageRef);
  onValue(messageRef, (snapshot) => {
    listenerFunction(snapshot);
  });
}
//#endregion


//#region CLEANUP
export function removeGlobalDBMessageListeners () {
  globalListenerList.forEach((el) => {
    off(el);
  });
  globalListenerList = [];
}

export function removeLocalDBMessageListeners () {
  localListenerList.forEach((el) => {
    off(el);
  });
  localListenerList = [];
}
//#endregion