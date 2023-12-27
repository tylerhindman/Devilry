import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";

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

var globalMessageNumber = 1;

export function writeMessage (name, message, messageNumber) {
  const db = getDatabase();
  set(ref(db, 'messages/one/m' + globalMessageNumber++), {
    username: name,
    message: message
  });
}

export function setDBMessageListener (roomName, listenerFunction) {
  const messageRef = ref(db, 'messages/one');
  onValue(messageRef, (snapshot) => {
    listenerFunction(snapshot);
  });
}