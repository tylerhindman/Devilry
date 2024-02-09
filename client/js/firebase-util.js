import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, orderByChild, query, off, limitToLast, remove, get, child } from "firebase/database";
import { getFunctions, httpsCallable } from "firebase/functions";

// TODO: Replace the following with your app's Firebase project configuration
// See: https://firebase.google.com/docs/web/learn-more#config-object
const firebaseConfig = {
  apiKey: "AIzaSyDY4581_Qw9L49C6nhPrmM5Gq_Cc3fMwnQ",
  authDomain: "devilry-843c7.firebaseapp.com",
  databaseURL: "https://devilry-843c7-default-rtdb.firebaseio.com",
  projectId: "devilry-843c7",
  storageBucket: "devilry-843c7.appspot.com",
  messagingSenderId: "327098131189",
  appId: "1:327098131189:web:40824ac5c086d812129bbc",
  measurementId: "G-MBZJ4NN376"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);


// Initialize Realtime Database and get a reference to the service
const db = getDatabase(app);

let globalListenerList = [];

let localListenerList = [];

//#region ROOM KEYS
export function writeRoomDestroy (roomName) {
  remove(ref(db, 'roomKeys/' + roomName));
}

export function getRoomKeysDB (listenerFunction) {
  get(child(ref(db), 'roomKeys')).then((snapshot) => {
    listenerFunction(snapshot);
  });
}
//#endregion

//#region PLAYERS GLOBAL
export function writePlayersGlobalJoin (name, roomName) {
  const db = getDatabase();
  const timestamp = Date.now();
  set(ref(db, roomName + '/players/' + name), {
    leader: false, // Leader only gets set true from room creation
    timestamp: timestamp
  });
}

export function writePlayersGlobalLeave (name, roomName) {
  remove(ref(db, roomName + '/players/' + name));
}

export function getPlayersGlobalDB (roomName, listenerFunction) {
  get(child(ref(db), roomName + '/players')).then((snapshot) => {
    listenerFunction(snapshot);
  });
}

export function setPlayersGlobalDBMessageListener (roomName, listenerFunction) {
  const messageRef = query(ref(db, roomName + '/players'));
  globalListenerList.push(messageRef);
  onValue(messageRef, (snapshot) => {
    listenerFunction(snapshot);
  });
}
//#endregion

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

//#region FUNCTIONS
const functions = getFunctions();

export function firebaseCreateRoom(name, callback) {
  const createRoom = httpsCallable(functions, 'createRoom');
  createRoom({username: name})
    .then((result) => {
      callback(result.data);
    }).catch((error) => {
      console.log(error);
    });
}
//#endregion