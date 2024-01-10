import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, orderByChild, query, off } from "firebase/database";

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

export function setLocalChatDBMessageListener (roomName, listenerFunction) {
  const messageRef = query(ref(db, roomName + '/globalChat'));
  localListenerList.push(messageRef);
  onValue(messageRef, (snapshot) => {
    listenerFunction(snapshot);
  });
}

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