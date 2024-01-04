import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, orderByChild, query } from "firebase/database";

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

export function writeMessage (name, message, roomName) {
  const db = getDatabase();
  const timestamp = Date.now();
  set(ref(db, 'messages/' + roomName + '/' + timestamp + '_' + name), {
    username: name,
    message: message,
    timestamp: timestamp
  });
}

export function setDBMessageListener (roomName, listenerFunction) {
  const messageRef = query(ref(db, 'messages/' + roomName));
  onValue(messageRef, (snapshot) => {
    listenerFunction(snapshot);
  });
}