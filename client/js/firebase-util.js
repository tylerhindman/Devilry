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

//#region CONSTANTS
export function getConstantsDB (listenerFunction) {
  get(child(ref(db), 'constants')).then((snapshot) => {
    listenerFunction(snapshot);
  });
}
//#endregion

//#region GAME STATUS
export function setGameStatusDBMessageListener (roomName, listenerFunction) {
  const messageRef = query(ref(db, roomName + '/gameStatus'));
  globalListenerList.push(messageRef);
  onValue(messageRef, (snapshot) => {
    listenerFunction(snapshot);
  });
}

export function writeGameStatusInprogress (roomName) {
  const db = getDatabase();
  set(ref(db, roomName + '/gameStatus'), 'inprogress');
  set(ref(db, 'roomKeys/' + roomName + '/gameStatus'), 'inprogress');
}
//#endregion

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
    leader: false,
    timestamp: timestamp
  });
}

export function writePlayersGlobalNewLeader (name, roomName) {
  const db = getDatabase();
  set(ref(db, roomName + '/players/' + name + '/leader'), true);
}

export function writePlayersGlobalLeave (name, roomName) {
  remove(ref(db, roomName + '/players/' + name));
}

export function writePlayersGlobalInventory(name, roomName, inventory) {
  const db = getDatabase();
  set(ref(db, roomName + '/players/' + name + '/inventory'), inventory);
}

export function getPlayersGlobalDB (roomName, listenerFunction) {
  get(child(ref(db), roomName + '/players')).then((snapshot) => {
    listenerFunction(snapshot);
  });
}

export function setPlayersGlobalDBMessageListener (roomName, listenerFunction) {
  const messageRef = query(ref(db, roomName + '/players'), orderByChild('timestamp'));
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
export function setGlobalMapTileDataDBMessageListener (roomName, listenerFunction) {
  const messageRef = query(ref(db, roomName + '/map/tileData'));
  globalListenerList.push(messageRef);
  onValue(messageRef, (snapshot) => {
    listenerFunction(snapshot);
  });
}

export function writeGlobalMapTileDiscovered (roomName, y, x) {
  const db = getDatabase();
  set(ref(db, roomName + '/map/tileData/' + y + '_' + x + '/discovered'), true);
}

export function writeUpdateGlobalMapTileHasOddball (roomName, prevY, prevX, y, x) {
  const db = getDatabase();
  set(ref(db, roomName + '/map/tileData/' + prevY + '_' + prevX + '/hasOddball'), false);
  set(ref(db, roomName + '/map/tileData/' + y + '_' + x + '/hasOddball'), true);
}

export function writeGlobalMapTileOddballTarget (roomName, y, x) {
  const db = getDatabase();
  set(ref(db, roomName + '/map/tileData/' + y + '_' + x + '/oddballTarget'), true);
}

export function removeGlobalMapTileOddballTarget (roomName, y, x) {
  const db = getDatabase();
  set(ref(db, roomName + '/map/tileData/' + y + '_' + x + '/oddballTarget'), false);
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

//#region ITEMS_LOCAL
export function updateItemsLocal (roomName, y, x, item, count) {
  if (count > 0) {
    set(ref(db, roomName + '/map/' + y + '_' + x + '/items/' + item), {
      count: count
    });
  } else {
    remove(ref(db, roomName + '/map/' + y + '_' + x + '/items/' + item));
  }
}

export function setItemsLocalDBMessageListener (roomName, y, x, listenerFunction) {
  const messageRef = query(ref(db, roomName + '/map/' + y + '_' + x + '/items'));
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