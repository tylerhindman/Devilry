import * as firebaseUtil from "./firebase-util.js";
import * as rooms from "./data/rooms.js";
import * as spells from "./data/spells.js";
import * as utils from "./util.js";
import '../css/main.css';

//#region PROPS
let draggedWindow = null;
let resizedAnchor = null;
let draggedWindowOffsetX = 0;
let draggedWindowOffsetY = 0;
let resizedWindowStartX = 0;
let resizedWindowStartY = 0;
let resizedMouseStartX = 0;
let resizedMouseStartY = 0;

let windowsList = null;
let zIndexCounter = 10;
let currentlyFocusedWindow = null;

const spellRandomChatTimeMin = 5;
const spellRandomChatTimeMax = 25;
const spellRandomCharMin = 8;
const spellRandomCharMax = 16;
const mindCommandsHistoryMax = 20;

const defaultBackgroundColor = '#008080';
const oddballScoreBackgroundColor = '#ff0000';
const oddballScoreBackgroundLerpTimeSeconds = 1.2;
const oddballScoreBackgroundLerpFrameTimeMilliseconds = 17;
//#endregion

//#region USER VARS
let username = null;
let roomKey = null;
let isLeader = false;
let mindCommandsHistoryIndex = -1;
let mindStatusText = '';
let playerOddballScore = 0;
//#endregion

//#region MAP VARS
const mapVoid = '░';
const mapUndiscovered = '▒';
const mapDiscovered = '▓';
const mapPlayer = 'Φ';
let mapMaster = [];
let mapReference = [];
const playerLocation = {y: 0, x: 0};
const mapDetailElements = [];
const mapTheme = 'castle';
//#endregion

//#region GAME PROPS
let gameStatus = null;
let gamemode = null;
let constants = null;
//#endregion

//#region GAMEMODE PROPS
let oddballTargetExists = false;
let oddballScoreGlobalMessageTrigger = 'A PLAYER HAS SCORED';
//#endregion

//#region DATA MODELS
// Data models - global
let playersGlobal = {};
let playersGlobalInventories = {};

// Data models - local
let playersLocal = {};
let itemsLocal = {};

let playerInventory = [];
let playerSpells = [];
let mindCommandHistory = [];
//#endregion

//#region WINDOW REFERENCES
// Chat window references
let globalChatElementRef = null;
let localChatElementRef = null;
let mindChatElementRef = null;

// Map window references
let mapZoomedOutElementRef = null;
let mapZoomedInElementRef = null;

// Chat message log flags
let globalChatFirstLoadFlag = null;
let localChatFirstLoadFlag = null;
let playerLocalFirstLoadFlag = null;
let globalMapFirstLoadFlag = null;

// Login window references
let loginWindowElementRef = null;
let loginWindowCoverElementRef = null;

// Lobby window references
let lobbyWindowElementRef = null;
//#endregion

//#region GAME SETUP
function devilryStart() {
  // ---------- Set listeners for icon buttons
  const globalChatIcon = document.querySelector('#global-chat-icon');
  globalChatIcon.addEventListener('dblclick', (event) => {
    iconClicked(event, 'globalChat');
  });
  const localChatIcon = document.querySelector('#local-chat-icon');
  localChatIcon.addEventListener('dblclick', (event) => {
    iconClicked(event, 'localChat');
  });
  const mindIcon = document.querySelector('#mind-icon');
  mindIcon.addEventListener('dblclick', (event) => {
    iconClicked(event, 'mind');
  });
  const zoomedOutMapIcon = document.querySelector('#zoomed-out-map-icon');
  zoomedOutMapIcon.addEventListener('dblclick', (event) => {
    iconClicked(event, 'map-');
  });
  const zoomedInMapIcon = document.querySelector('#zoomed-in-map-icon');
  zoomedInMapIcon.addEventListener('dblclick', (event) => {
    iconClicked(event, 'map+');
  });
  const logoutIcon = document.querySelector('#logout-icon');
  logoutIcon.addEventListener('dblclick', (event) => {
    logout();
  });


  // ---------- Init window setup
  // Initialize all windows from the start but keep them hidden (closed).
  // They will be opened when user clicks icons.

  // Following windows are chat windows (global, local, mind).
  for (let i = 0; i < 5; i++) {
    const newWindowNode = document.getElementById('draggableWindowTemplate').content.cloneNode(true);
    const newWindowElement = newWindowNode.lastElementChild;
    switch (i) {
      case 0:
        newWindowElement.id = 'chat-window-global';
        newWindowElement.querySelector('.draggable-window-title').textContent = 'GLOBAL_CHAT';
        globalChatElementRef = newWindowElement;
        break;
      case 1:
        newWindowElement.id = 'chat-window-local';
        newWindowElement.querySelector('.draggable-window-title').textContent = 'LOCAL_CHAT';
        localChatElementRef = newWindowElement;
        break;
      case 2:
        newWindowElement.id = 'chat-window-mind';
        newWindowElement.querySelector('.draggable-window-title').textContent = 'MIND';
        mindChatElementRef = newWindowElement;
        setupMindWindow();
        break;
      case 3:
        newWindowElement.id = 'map-window-zoomed-out';
        setupMapWindow(newWindowElement, 'MAP -', 290, 300);
        mapZoomedOutElementRef = newWindowElement;
        break;
      case 4:
        newWindowElement.id = 'map-window-zoomed-in';
        setupMapWindow(newWindowElement, 'MAP +', 535, 230);
        mapZoomedInElementRef = newWindowElement;
        break;
    }

    // Set listeners for terminal buttons
    const minimizeButton = newWindowElement.querySelector('#minimize-button');
    minimizeButton.id += i + 1;
    minimizeButton.addEventListener('click', (event) => {
      minimizeClicked(event);
    });
    const maximizeButton = newWindowElement.querySelector('#maximize-button');
    maximizeButton.id += i + 1;
    maximizeButton.addEventListener('click', (event) => {
      maximizeClicked(event);
    });
    const closeButton = newWindowElement.querySelector('#close-button');
    closeButton.id += i + 1;
    closeButton.addEventListener('click', (event) => {
      closeClicked(event);
    });

    newWindowElement.style.top = (50 + (i * 50)) + 'px';
    newWindowElement.style.left = (50 + (i * 50)) + 'px';
    newWindowElement.style.display = 'none';
    document.body.appendChild(newWindowNode);
  }

  // -------- Draggable window setup
  let draggableWindows = document.querySelectorAll('.draggable-window');
  windowsList = draggableWindows;
  for (let i = 0; i < draggableWindows.length; i++) {
    const currWindow = draggableWindows.item(i).querySelector('.draggable-window-header');
    currWindow.addEventListener('mousedown', function (event) {
      if (draggedWindow == null && resizedAnchor == null) {
        draggedWindow = draggableWindows.item(i);
        const style = window.getComputedStyle(draggedWindow);
        draggedWindowOffsetX = event.clientX - Number(style.left.replace('px', ''));
        draggedWindowOffsetY = event.clientY - Number(style.top.replace('px', ''));
        document.addEventListener('mousemove', draggableWindowMouseMove);
      }
    });

    document.addEventListener('mouseup', function(event) {
      currWindow.removeEventListener('mousemove', draggableWindowMouseMove);
      currWindow.removeEventListener('mousemove', resizeableAnchorMouseMove)
      if (draggedWindow) {
        focusWindow(draggedWindow);
      } else if (resizedAnchor) {
        focusWindow(resizedAnchor.parentElement.parentElement);
      }
      draggedWindow = null;
      resizedAnchor = null;
    });

    const resizeAnchor = draggableWindows.item(i).querySelector('.resize-anchor');
    resizeAnchor.addEventListener('mousedown', function (event) {
      if (draggedWindow == null && resizedAnchor == null) {
        resizedAnchor = resizeAnchor;
        const style = window.getComputedStyle(draggableWindows.item(i));
        resizedWindowStartX = Number(style.width.replace('px', ''));
        resizedWindowStartY = Number(style.height.replace('px', ''));
        resizedMouseStartX = event.clientX;
        resizedMouseStartY = event.clientY;
        document.addEventListener('mousemove', resizeableAnchorMouseMove);
      }
    });
  }

  // -------- Input setup
  let windowInputs = document.querySelectorAll('.draggable-window-input');
  for (let i = 0; i < windowInputs.length; i++) {
    const windowInput = windowInputs.item(i);
    windowInput.addEventListener('keyup', inputTextChat);
  }

  // ----- Pull focused window to the top
  for (let i = 0; i < windowsList.length; i++) {
    const focusedWindow = windowsList.item(i);
    focusedWindow.addEventListener('mousedown', function (event) {
      if (currentlyFocusedWindow == null || currentlyFocusedWindow.id != focusedWindow.id) {
        focusedWindow.style.zIndex = ++zIndexCounter;
      }
    });
    focusedWindow.addEventListener('click', function (event) {
      if (currentlyFocusedWindow == null || currentlyFocusedWindow.id != focusedWindow.id) {
        focusedWindow.querySelector('.draggable-window-input').focus();
        currentlyFocusedWindow = focusedWindow;
      }
    });
  }

  // ----- Get Login window refs + setup
  loginWindowElementRef = document.querySelector('#login-window');
  loginWindowCoverElementRef = document.querySelector('#login-window-desktop-cover');
  // Grab username and roomKey
  username = utils.getCookie('username');
  roomKey = utils.getCookie('roomKey');
  gamemode = utils.getCookie('gamemode');
  // If we are already in a session, hide the login screen
  if (username && roomKey) {
    loginWindowElementRef.style.display = 'none';
    loginWindowCoverElementRef.style.display = 'none';
    initRoomListeners();
  }
  // Set listener on login buttons
  loginWindowElementRef.querySelector('#login-window-button').addEventListener('click', login);
  loginWindowElementRef.querySelector('#create-room-button').addEventListener('click', createRoom);
  // Enter key shortcut on room key input
  loginWindowElementRef.querySelector('#login-window-room-input').addEventListener('keyup', function (event) {
    if ((event.key === 'Enter' || event.keyCode === 13)) {
      login();
    }
  });

  // ------ Get Lobby window refs + setup
  lobbyWindowElementRef = document.querySelector('#lobby-window');
  lobbyWindowElementRef.querySelector('#lobby-window-cancel-button').addEventListener('click', leaveLobby);
  lobbyWindowElementRef.querySelector('#lobby-window-start-button').addEventListener('click', startGame);

  // ------ Get constants
  firebaseUtil.getConstantsDB((snapshot) => {
    if (snapshot.exists()) {
      constants = snapshot.val();
      lobbyWindowElementRef.querySelector('#lobby-players-max').innerHTML = constants.maxPlayers;
    }
  });
}

function createRoom() {
  let usernameFieldValue = loginWindowElementRef.querySelector('#login-window-name-input').value;
  if (usernameFieldValue) {
    username = usernameFieldValue;
    utils.setCookie('username', username);
    // Call function to create room here
    firebaseUtil.firebaseCreateRoom(username, (result) => {
      loginWindowElementRef.style.display = 'none';
      roomKey = result.roomKey;
      utils.setCookie('roomKey', roomKey);
      // TODO - change this to retrieve from input/server later
      gamemode = 'oddball'
      utils.setCookie('gamemode', gamemode);

      isLeader = true;
      // Go to lobby
      enterLobby();
    });
  }
}

function login() {
  let usernameFieldValue = loginWindowElementRef.querySelector('#login-window-name-input').value;
  let roomKeyFieldValue = loginWindowElementRef.querySelector('#login-window-room-input').value;
  loginWindowElementRef.querySelector('#login-room-key-error').style.display = 'none';
  loginWindowElementRef.querySelector('#login-username-error').style.display = 'none';
  loginWindowElementRef.querySelector('#login-room-full-error').style.display = 'none';
  loginWindowElementRef.querySelector('#login-game-in-progress-error').style.display = 'none';
  if (usernameFieldValue && roomKeyFieldValue) {
    roomKeyFieldValue = roomKeyFieldValue.toUpperCase();
    // Check against DB if room key is valid
    firebaseUtil.getRoomKeysDB((snapshot) => {
      let validRoomKey = false; // Start with assumption that room is invalid
      let gameAvailable = false;
      let roomKeyProps = null;
      if (snapshot.exists()) {
        const roomKeys = snapshot.val();
        for (const k in roomKeys) {
          // valid if found in database list
          if (roomKeyFieldValue == k) {
            validRoomKey = true;
            roomKeyProps = roomKeys[k];
            if (roomKeys[k].gameStatus == 'lobby') {
              gameAvailable = true;
            }
            break;
          }
        }
      }

      // Show roomkey error
      if (!validRoomKey) {
        loginWindowElementRef.querySelector('#login-room-key-error').style.display = 'block';
      // Show game in progress error
      } else if (!gameAvailable) {
        loginWindowElementRef.querySelector('#login-game-in-progress-error').style.display = 'block';
      // Continue to username verification
      } else {
        // Check against server if username is valid in room
        firebaseUtil.getPlayersGlobalDB(roomKeyFieldValue, (snapshot) => {
          let validUsername = true; // Start with assumption that name is valid
          let playersCount = 0;
          if (snapshot.exists()) {
            const usernames = snapshot.val();
            for (const u in usernames) {
              playersCount++;
              // Invalid if found in database list (case insensitive)
              if (usernameFieldValue.toLowerCase() == u.toLowerCase()) {
                validUsername = false;
                break;
              }
            }
          }

          // Check against illegal player names
          for (let illegalName in constants.illegalPlayerNames) {
            if (constants.illegalPlayerNames[illegalName] && usernameFieldValue.toLowerCase() == illegalName.toLowerCase()) {
              validUsername = false;
            }
          }

          // Show username error
          if (!validUsername) {
            loginWindowElementRef.querySelector('#login-username-error').style.display = 'block';
          // Show room full error
          } else if (playersCount == constants.maxPlayers) {
            loginWindowElementRef.querySelector('#login-room-full-error').style.display = 'block';
          // Continue with login
          } else {
            loginWindowElementRef.style.display = 'none';
            //loginWindowCoverElementRef.style.display = 'none';
            username = usernameFieldValue;
            roomKey = roomKeyFieldValue;
            gamemode = roomKeyProps.gamemode;
            utils.setCookie('username', username);
            utils.setCookie('roomKey', roomKey);
            utils.setCookie('gamemode', gamemode);
            // Go to lobby
            enterLobby();
          }
        });
      }
    });
  }
}

function leaveLobby() {
  // firebaseUtil.writePlayersGlobalLeave(username, roomKey);

  // username = null;
  // roomKey = null;
  // utils.deleteCookie('username');
  // utils.deleteCookie('roomKey');

  // // Remove DB listeners
  // firebaseUtil.removeGlobalDBMessageListeners();

  logout();

  // Reinstate login window
  loginWindowElementRef.querySelector('#login-window-room-input').value = roomKey;
  lobbyWindowElementRef.style.display = 'none';
  // loginWindowCoverElementRef.style.display = 'block';
  // loginWindowElementRef.style.display = 'block';
}

function startGame() {
  firebaseUtil.writeGameStatusInprogress(roomKey);
}

function gameStatusUpdate(snapshot) {
  if (snapshot.exists()) {
    gameStatus = snapshot.val();

    switch (gameStatus) {
      case 'inprogress':
        lobbyWindowElementRef.style.display = 'none';
        loginWindowCoverElementRef.style.display = 'none';

        // Set up player default spells for Oddball gamemode
        if (gamemode == 'oddball') {
          playerSpells.push('intercept');
          playerSpells.push('score');
        }

        buildMindText();
        break;
    }
  }
}

function initRoomListeners() {
  // ----- Set message listener for game status
  firebaseUtil.setGameStatusDBMessageListener(roomKey, function (snapshot) {
    gameStatusUpdate(snapshot);
  });
  // ----- Set message listener for players global
  firebaseUtil.setPlayersGlobalDBMessageListener(roomKey, function (snapshot) {
    playersGlobalUpdate(snapshot);
  });
  // ----- Set message listener for global chat window
  firebaseUtil.setGlobalChatDBMessageListener(roomKey, function (snapshot) {
    globalChatUpdate(snapshot);
  });
  // Initialize Map
  initializeMap();
}

function enterLobby() {
  initRoomListeners();
  loginWindowElementRef.style.display = 'none';
  loginWindowElementRef.querySelector('#login-room-key-error').style.display = 'none';
  loginWindowElementRef.querySelector('#login-username-error').style.display = 'none';
  loginWindowElementRef.querySelector('#login-room-full-error').style.display = 'none';
  loginWindowElementRef.querySelector('#login-game-in-progress-error').style.display = 'none';

  lobbyWindowElementRef.style.display = 'block';
  lobbyWindowElementRef.querySelector('#lobby-room-key').innerHTML = roomKey;

  if (isLeader) {
    setupLobbyWindowLeader();
  } else {
    // Add non-leader player to list in db
    firebaseUtil.writePlayersGlobalJoin(username, roomKey);
    setupLobbyWindowNonLeader();
  }
}

function setupLobbyWindowLeader() {
  lobbyWindowElementRef.querySelector('#lobby-window-start-button').style.display = 'inline-block';
  lobbyWindowElementRef.querySelector('#lobby-window-cancel-button').style.left = '85px';
  lobbyWindowElementRef.querySelector('#lobby-window-start-button').style.left = '85px';
}

function setupLobbyWindowNonLeader() {
  lobbyWindowElementRef.querySelector('#lobby-window-start-button').style.display = 'none';
  lobbyWindowElementRef.querySelector('#lobby-window-cancel-button').style.left = '136px';
}
//#endregion

//#region PLAYERS GLOBAL
function playersGlobalUpdate(snapshot) {
  // Only update if data exists
  if (snapshot && snapshot.exists()) {
    const playersServer = snapshot.val();
    const lobbyWindowBaseHeight = 128;
    const lobbyWindowPlayerAddHeight = 22;
    
    // Update local cache with server player list
    playersGlobal = playersServer;

    // Update lobby player list if in lobby
    if (gameStatus == 'lobby') {
      const lobbyPlayersListElementRef = lobbyWindowElementRef.querySelector('#lobby-players-list');
      lobbyPlayersListElementRef.innerHTML = '';
      let lobbyWindowHeight = lobbyWindowBaseHeight;
      let leaderExists = false;
      let firstRun = true;
      let setNewLeader = false;
      snapshot.forEach((childSnapshot) => {
        const playerName = childSnapshot.key;
        
        // Check if there exists no leader, if not, set top player as new leader (if we are top player)
        if (playersGlobal[playerName].leader) {
          leaderExists = true;
        } else if (firstRun && username == playerName && !playersGlobal[playerName].leader) {
          setNewLeader = true;
        }

        const p = document.createElement("p");
        p.className = 'lobby-player-name ' + (playerName == username ? 'lobby-player-name-user' : 'lobby-player-name-other');
        p.innerHTML = playerName;

        lobbyPlayersListElementRef.appendChild(p);
        lobbyWindowHeight += lobbyWindowPlayerAddHeight;

        firstRun = false;
      });
      // Set self as new leader if none exists and we are top of the list
      if (!leaderExists && setNewLeader) {
        isLeader = true;
        firebaseUtil.writePlayersGlobalNewLeader(username, roomKey);
        setupLobbyWindowLeader();
      }

      lobbyWindowElementRef.style.height = lobbyWindowHeight + 'px';
      // Update player count
      lobbyWindowElementRef.querySelector('#lobby-players-count').innerHTML = Object.keys(playersGlobal).length.toString();
    // Update player cache if match is in progress
    } else if (gameStatus == 'inprogress') {
      for (let globalPlayerNameServer in playersGlobal) {
        playersGlobalInventories[globalPlayerNameServer] = [];
        for (let globalPlayerItemServer in playersGlobal[globalPlayerNameServer].inventory) {
          for (let i = 0; i < playersGlobal[globalPlayerNameServer].inventory[globalPlayerItemServer].count; i++) {
            playersGlobalInventories[globalPlayerNameServer].push(globalPlayerItemServer);
          }
        }
        // Refresh current player's inventory
        if (globalPlayerNameServer == username) {
          playerInventory = playersGlobalInventories[globalPlayerNameServer];
          buildMindText();
        }
      }
    }
  }
}
//#endregion

//#region GLOBAL CHAT
function globalChatUpdate(snapshot) {
  // Only update if data exists
  if (snapshot.exists()) {
    const snapshotVal = snapshot.val();
    // Update chat log with new entries only
    if (globalChatFirstLoadFlag) {
      let snapshotObj = snapshotVal[Object.keys(snapshotVal)[Object.keys(snapshotVal).length - 1]];
      let messageVal = snapshotObj.message;

      // Triggers on global server messages
      if (snapshotObj.username.toLowerCase() == 'SERVER'.toLowerCase()) {
        processGlobalChatServerTriggers(messageVal);
      }

      processNewTextElement(globalChatElementRef.querySelector('.draggable-window-body'), messageVal, snapshotObj.username, snapshotObj.timestamp);
    // Loading for first time
    } else {
      for (const log in snapshotVal) {
        let snapshotObj = snapshotVal[log];
        let messageVal = snapshotObj.message;
        processNewTextElement(globalChatElementRef.querySelector('.draggable-window-body'), messageVal, snapshotObj.username, snapshotObj.timestamp);
      }
      // Flip first time loaded flag
      globalChatFirstLoadFlag = true;
    }
  }
}

function processGlobalChatServerTriggers(message) {
  switch (message) {
    // Trigger on oddball score
    case oddballScoreGlobalMessageTrigger:
      // Flash background to oddball score color
      document.body.style.backgroundColor = oddballScoreBackgroundColor;
      // Interpolate from oddball score color to default
      utils.lerpBackground(oddballScoreBackgroundColor, defaultBackgroundColor, oddballScoreBackgroundLerpTimeSeconds, oddballScoreBackgroundLerpFrameTimeMilliseconds);
      break;
  }
}
//#endregion

//#region LOGOUT
function logout() {
  // Clean up server players
  firebaseUtil.removePlayersLocal(roomKey, playerLocation.y, playerLocation.x, username);
  firebaseUtil.writePlayersGlobalLeave(username, roomKey);

  // Clear user vars and cookies
  globalChatFirstLoadFlag = null;
  globalMapFirstLoadFlag = null;
  localChatFirstLoadFlag = null;
  playerLocalFirstLoadFlag = null;
  playersGlobal = {};
  playersGlobalInventories = {};
  playersLocal = {};
  itemsLocal = {};
  playerInventory = [];
  playerSpells = [];
  mindCommandHistory = [];
  mindCommandsHistoryIndex = -1;
  mindStatusText = '';
  playerOddballScore = 0;
  isLeader = false;
  gameStatus = null;
  username = null;
  roomKey = null;
  utils.deleteCookie('username');
  utils.deleteCookie('roomKey');
  utils.deleteCookie('gamemode');

  // Remove DB listeners
  firebaseUtil.removeGlobalDBMessageListeners();
  firebaseUtil.removeLocalDBMessageListeners();

  // Clear and hide windows
  closeWindow(globalChatElementRef);
  closeWindow(localChatElementRef);
  closeWindow(mindChatElementRef);
  closeWindow(mapZoomedInElementRef);
  closeWindow(mapZoomedOutElementRef);
  closeWindow(mindChatElementRef);
  clearChatWindow(globalChatElementRef);
  clearChatWindow(localChatElementRef);
  clearMindWindow();

  // Reinstate login window
  loginWindowCoverElementRef.style.display = 'block';
  loginWindowElementRef.style.display = 'block';
}
//#endregion

//#region WINDOW FUNCTIONS
function focusWindow(focusedWindow) {
  const input = focusedWindow.querySelector('.draggable-window-input');
  if (input) {
    input.focus();
  }
  focusedWindow.style.zIndex = ++zIndexCounter;
  currentlyFocusedWindow = focusedWindow;
}

function draggableWindowMouseMove(event) {
  if (draggedWindow) {
    draggedWindow.style.left = (event.clientX - draggedWindowOffsetX) + 'px';
    draggedWindow.style.top = (event.clientY - draggedWindowOffsetY) + 'px';
  }
}

function resizeableAnchorMouseMove(event) {
  if (resizedAnchor) {
    const parentWindow = resizedAnchor.parentElement.parentElement;
    parentWindow.style.width = (resizedWindowStartX + (event.clientX - resizedMouseStartX)) + 'px';
    parentWindow.style.height = (resizedWindowStartY + (event.clientY - resizedMouseStartY)) + 'px';
  }
}

function processNewTextElement(windowBody, value, msgUsername, timestamp) {
  // Check for spell text triggers first
  // -- Bless
  if (value.trim() == 'spell:bless') {
    spellDelayedAddKickOff(spells.spells.bless, windowBody);
  // -- RoomTest
  } else if (value.trim() == 'spell:room') {
    spellDelayedAddKickOff(rooms[mapTheme].NESW, windowBody);

  // Else, enter into chat normally
  } else {
    const p = document.createElement("p");
    const metaSpan = document.createElement("span");
    const textSpan = document.createElement("span");

    const currentDate = new Date(timestamp);
    let currentHour = new String(currentDate.getHours() > 12 ? currentDate.getHours() - 12 : currentDate.getHours());
    let currentMinute = new String(currentDate.getMinutes());
    const currentTime = (currentHour.length == 1 ? '0' + currentHour : currentHour) + ":"
      + (currentMinute.length == 1 ? '0' + currentMinute : currentMinute)
      + new String(currentDate.getHours() >= 12 ? 'PM' : 'AM');
    const metaNode = document.createTextNode('[' + msgUsername + ' ' + currentTime + '] ');
    metaSpan.appendChild(metaNode);
    metaSpan.className = 'log-entry-meta';
    if (msgUsername == 'SERVER') {
      metaSpan.className = 'log-entry-meta-server';
    } else if (msgUsername == 'username') {
      metaSpan.className = 'log-entry-meta-self';
    }

    const textNode = document.createTextNode(value);
    textSpan.appendChild(textNode);
    textSpan.className = 'log-entry-text';

    p.appendChild(metaSpan);
    p.appendChild(textSpan);
    p.className = 'log-entry-parent';
    windowBody.appendChild(p);
  }

  windowBody.scrollTo(0, windowBody.scrollHeight);
}

function inputTextChat(event) {
  if ((event.key === 'Enter' || event.keyCode === 13) && event.target.value) {
    // Translate spell values for database
    let message = event.target.value;

    // Clear text field
    event.target.value = '';
    switch(event.target.parentElement.parentElement.parentElement.id) {
      case 'chat-window-global':
        // Write to database - global chat
        firebaseUtil.writeGlobalChatMessage(username, message, roomKey);
        break;
      case 'chat-window-local':
        // Write to database - local chat - specific room
        firebaseUtil.writeLocalChatMessage(roomKey, playerLocation.y, playerLocation.x, username, message);
        break;
      case 'chat-window-mind':
        // Send to mind processing
        processMindCommand(message);
        break;
    }
  }
}

function spellDelayedAddKickOff(spellText, windowBody) {
  const paragraphElement = document.createElement("p");
  paragraphElement.className = 'log-entry-parent log-entry-spell';
  windowBody.appendChild(paragraphElement);
  spellDelayedAdd(spellText, paragraphElement, windowBody);
}

function spellDelayedAdd(spellText, paragraphElement, windowBody) {
  if (spellText.length > 0) {
    let randomCharAmount = spellText.indexOf("<br>") != -1 ? spellText.indexOf("<br>") + 4 : spellText.length;
    randomCharAmount = randomCharAmount <= spellText.length - 1 ? randomCharAmount : spellText.length; 
    paragraphElement.innerHTML += spellText.substring(0, randomCharAmount);
    spellText = spellText.substring(randomCharAmount);
    setTimeout(() => {
      spellDelayedAdd(spellText, paragraphElement, windowBody)
    }, Math.random() * (spellRandomChatTimeMax - spellRandomChatTimeMin));
    windowBody.scrollTo(0, windowBody.scrollHeight);
  }
}

function minimizeClicked(event) {
  const parentWindow = event.target.parentElement.parentElement.parentElement.parentElement;
  if (parentWindow.getAttribute('minimized') == 'false') {
    // Restore from maximize if maximized
    if (parentWindow.getAttribute('maximized') != 'false') {
      maximizeWindow(parentWindow, 'restore');
    }
    minimizeWindow(parentWindow, 'minimize');
  } else {
    minimizeWindow(parentWindow, 'restore');
    // Focus on restore
    focusWindow(parentWindow);
  }
}

function minimizeWindow(minWindow, minOrRestore) {
  if (minOrRestore == 'minimize') {
    minWindow.setAttribute('minimized', minWindow.style.height);
    minWindow.querySelector('.draggable-window-body').style.display = 'none';
    minWindow.querySelector('.draggable-window-footer').style.display = 'none';
    minWindow.querySelector('.resize-anchor').style.display = 'none';
    minWindow.querySelector('.draggable-window-background').style.display = 'none';
    minWindow.style.height = '25px';
  } else {
    minWindow.querySelector('.draggable-window-body').style.display = 'block';
    minWindow.querySelector('.draggable-window-footer').style.display = 'block';
    minWindow.querySelector('.resize-anchor').style.display = 'block';
    minWindow.querySelector('.draggable-window-background').style.display = 'block';
    minWindow.style.height = minWindow.getAttribute('minimized');
    minWindow.setAttribute('minimized', 'false');
  }
}

function maximizeClicked(event) {
  const parentWindow = event.target.parentElement.parentElement.parentElement.parentElement;
  if (parentWindow.getAttribute('maximized') == 'false') {
    // Restore from minimize if minimized
    if (parentWindow.getAttribute('minimized') != 'false') {
      minimizeWindow(parentWindow, 'restore');
    }
    maximizeWindow(parentWindow, 'maximize');
  } else {
    maximizeWindow(parentWindow, 'restore');
  }

  // Focus on maximize or restore
  focusWindow(parentWindow);
}

function maximizeWindow(maxWindow, maxOrRestore) {
  if (maxOrRestore == 'maximize') {
    maxWindow.setAttribute('maximized', maxWindow.style.top + ':' + maxWindow.style.left + ':' + maxWindow.style.width + ':' + maxWindow.style.height);
    maxWindow.style.top = '0px';
    maxWindow.style.left = '0px';
    maxWindow.style.width = '100%';
    maxWindow.style.height = '100%';
    maxWindow.querySelector('.resize-anchor').style.display = 'none';
  } else {
    const restoredProps = maxWindow.getAttribute('maximized').split(':');
    maxWindow.style.top = restoredProps[0];
    maxWindow.style.left = restoredProps[1];
    maxWindow.style.width = restoredProps[2];
    maxWindow.style.height = restoredProps[3];
    maxWindow.querySelector('.resize-anchor').style.display = 'block';
    maxWindow.setAttribute('maximized', 'false');
  }
}

function closeWindow(closeWindow) {
  if (closeWindow != null && closeWindow.getAttribute('closed') == 'false') {
    closeWindow.style.display = 'none';
    closeWindow.setAttribute('closed', 'true');
  }
}

function closeClicked(event) {
  const parentWindow = event.target.parentElement.parentElement.parentElement.parentElement;
  closeWindow(parentWindow);
}

function iconClicked(event, iconName) {
  // Get window reference based on supplied iconName
  let selectedWindow = null;
  switch(iconName) {
    case 'globalChat':
      selectedWindow = document.getElementById('chat-window-global');
      break;
    case 'localChat':
      selectedWindow = document.getElementById('chat-window-local');
      break;
    case 'mind':
      selectedWindow = document.getElementById('chat-window-mind');
      break;
    case 'map-':
      selectedWindow = document.getElementById('map-window-zoomed-out');
      break;
    case 'map+':
      selectedWindow = document.getElementById('map-window-zoomed-in');
      break;
  }

  // Only open the window if it is already closed
  if (selectedWindow != null && selectedWindow.getAttribute('closed') == 'true') {
    selectedWindow.style.display = 'block';
    selectedWindow.setAttribute('closed', 'false');
    const input = selectedWindow.querySelector('.draggable-window-input')
    if (input) {
      input.focus();
    }
    selectedWindow.style.zIndex = ++zIndexCounter;
    currentlyFocusedWindow = selectedWindow;
    if (selectedWindow.getAttribute('minimized') !== 'false') {
      minimizeWindow(selectedWindow, 'restore');
    } else if (selectedWindow.getAttribute('maximized') !== 'false') {
      maximizeWindow(selectedWindow, 'restore');
    }
    const windowBody = selectedWindow.querySelector('.draggable-window-body');
    windowBody.scrollTo(0, windowBody.scrollHeight);
  }
}

function clearChatWindow(clearWindow) {
  const clearBody = clearWindow.querySelector('.draggable-window-body');
  clearBody.innerHTML = '';
}

function clearMindWindow() {
  mindChatElementRef.querySelector('.mind-text').innerHTML = '';
}

function updateWindowTitle(titleWindow, newTitle) {
  const titleWindowElement = titleWindow.querySelector('.draggable-window-title');
  titleWindowElement.textContent = newTitle;
}
//#endregion

//#region PLAYER ACTIONS - MIND
function mindHistoryInput(event) {
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (mindCommandsHistoryIndex < mindCommandHistory.length - 1) {
      mindCommandsHistoryIndex++;
      mindChatElementRef.querySelector('.draggable-window-input').value = mindCommandHistory[mindCommandsHistoryIndex];
    }
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (mindCommandsHistoryIndex >= 0) {
      mindCommandsHistoryIndex--;
      if (mindCommandsHistoryIndex == -1) {
        mindChatElementRef.querySelector('.draggable-window-input').value = '';
      } else {
        mindChatElementRef.querySelector('.draggable-window-input').value = mindCommandHistory[mindCommandsHistoryIndex];
      }
    }
  }
}

function processMindCommand(message) {
  // Manage mind history
  mindCommandsHistoryIndex = -1;
  if (mindCommandHistory.unshift(message) > mindCommandsHistoryMax) {
    mindCommandHistory.pop();
  }

  // Parse command and route it
  const parsedCommand = message.split(' ')[0];
  const args = message.split(' ').length > 1 ? message.split(' ').slice(1) : [];
  switch (parsedCommand) {
    case 'cast':
      if (args.length > 0) {
        castSpell(args)
      }
      break;
    case 'move':
      if (args.length > 0) {
        movePlayer(args[0]);
      }
      break;
    case 'pickup':
    case 'get':
      if (args.length > 0) {
        pickupItem(args[0]);
      }
      break;
    case 'drop':
    case 'leave':
      if (args.length > 0) {
        dropItem(args[0]);
      }
      break;
    case 'help':
      mindStatusText = getHelpText(args.length > 0 ? args[0] : '');
      break;
    default:
      if (parsedCommand) {
        mindStatusText = 'Unkown command \'' + parsedCommand + '\'';
      }
      break;
  }
  buildMindText();
}

function castSpell(spellArgs) {
  const spell = spellArgs[0].trim();
  if (playerSpells.includes(spell)) {
    switch (spell) {
      case 'bless':
        // Write spell trigger to specific chat
        firebaseUtil.writeGlobalChatMessage(username, 'spell:bless', roomKey);
        mindStatusText = 'You cast \'bless\'';
        // Spell logic
        break;
      case 'room':
        // Write spell trigger to specific chat
        firebaseUtil.writeGlobalChatMessage(username, 'spell:room', roomKey);
        mindStatusText = 'You cast \'room\'';
        // Spell logic
        break;
      case 'intercept':
        let playerTarget = '';
        // Find player with oddball in room
        for (let playerName in playersLocal) {
          if (playersGlobalInventories[playerName] && playersGlobalInventories[playerName].includes('oddball')) {
            playerTarget = playerName;
          }
        }
        // valid target player (not current player, valid player in game, target player is in room)
        if (playerTarget && playerTarget != username) {
          const interceptRoll = Math.floor(Math.random() * 101);
          const interceptMinChance = constants.gamemodes.oddball.interceptMinChance;
          const interceptMaxChance = constants.gamemodes.oddball.interceptMaxChance;
          const oddballMaxScore = constants.gamemodes.oddball.scoreMax;
          const oddballScorePerScore = constants.gamemodes.oddball.scorePerScore;
          // Decrease intercept success the higher the player's score
          const interceptSuccess = interceptMaxChance - ((interceptMaxChance - interceptMinChance) * (playerOddballScore / (oddballMaxScore - oddballScorePerScore)));
          // intercept successful
          if (interceptRoll < interceptSuccess) {
            // Remove oddball from target player's inventory
            const targetPlayerInventory = playersGlobalInventories[playerTarget];
            targetPlayerInventory.splice(targetPlayerInventory.findIndex((item) => item === 'oddball'), 1);
            // Update target player's inventory on server
            updatePlayerInventoryServer(playerTarget, targetPlayerInventory);
            // Add oddball to current player's inventory
            playerInventory.push('oddball');
            // Update current player's inventory on server
            updatePlayerInventoryServer(username, playerInventory);

            mindStatusText = 'You intercepted the oddball!';

            firebaseUtil.writeGlobalChatMessage('SERVER', 'THE ODDBALL HAS CHANGED HANDS', roomKey);
            firebaseUtil.writeLocalChatMessage(roomKey, playerLocation.y, playerLocation.x, 'SERVER', username + ' HAS INTERCEPTED THE ODDBALL FROM ' + playerTarget);
          // intercept unsuccessful attempt
          } else {
            firebaseUtil.writeLocalChatMessage(roomKey, playerLocation.y, playerLocation.x, 'SERVER', username + ' FAILED TO INTERCEPT THE ODDBALL FROM ' + playerTarget + '...');
            mindStatusText = '\'intercept\' failed...';
          }
        // invalid target player
        } else {
          mindStatusText = 'There\'s no player in the room to intercept the oddball from.';
        }
        break;
      case 'score':
        // Score valid if player has oddball and is in the oddball target room
        if (playerInventory.includes('oddball') && mapReference[playerLocation.y][playerLocation.x].oddballTarget) {
          const scoreRoll = Math.floor(Math.random() * 101);
          const scoreSuccess = constants.gamemodes.oddball.scoreMaxChance;
          // Score successful
          if (scoreRoll < scoreSuccess) {
            // Remove oddball from player inventory
            playerInventory.splice(playerInventory.findIndex((item) => item === 'oddball'), 1);
            // Update player's inventory on server
            updatePlayerInventoryServer(username, playerInventory);
            // Remove oddball target room from server
            firebaseUtil.removeGlobalMapTileOddballTarget(roomKey, playerLocation.y, playerLocation.x);

            // Send global and local messages
            firebaseUtil.writeGlobalChatMessage('SERVER', oddballScoreGlobalMessageTrigger, roomKey);
            firebaseUtil.writeLocalChatMessage(roomKey, playerLocation.y, playerLocation.x, 'SERVER', username + ' HAS SCORED');

            playerOddballScore += constants.gamemodes.oddball.scorePerScore;
            mindStatusText = 'You scored the oddball!';

            // Spawn new oddball (Only if player score is less than max score)
            if (playerOddballScore < constants.gamemodes.oddball.scoreMax) {
              const minimumOddballSpawnDistance = constants.gamemodes.oddball.minimumStartingSpawnDistance;
              let oddballSpawned = false;
              while (!oddballSpawned) {
                const oddballSpawnY = Math.floor(Math.random() * constants.mapHeight);
                const oddballSpawnX = Math.floor(Math.random() * constants.mapWidth);
                const startingSpaceY = playerLocation.y;
                const startingSpaceX = playerLocation.x;
                const oddballDistanceY = Math.abs(startingSpaceY - oddballSpawnY);
                const oddballDistanceX = Math.abs(startingSpaceX - oddballSpawnX);

                // If tile is valid and greater than or equal to the minimum starting spawn distance,
                // Then spawn the oddball and mark tile as having oddball
                if (mapReference[oddballSpawnY][oddballSpawnX].mapKey &&
                    (oddballDistanceY + oddballDistanceX) >= minimumOddballSpawnDistance
                ) {
                  oddballSpawned = true;
                  console.log('Oddball new spawn: ' + oddballSpawnY + ', ' + oddballSpawnX);
                  firebaseUtil.updateItemsLocal(roomKey, oddballSpawnY, oddballSpawnX, 'oddball', 1);
                  firebaseUtil.writeUpdateGlobalMapTileHasOddball(roomKey, playerLocation.y, playerLocation.x, oddballSpawnY, oddballSpawnX);
                }
              }
            // Player won, game over
            } else {
              firebaseUtil.removeGlobalMapTileHasOddball(roomKey, playerLocation.y, playerLocation.x);
              firebaseUtil.writeGlobalChatMessage('SERVER', username + ' WINS', roomKey);
              mindStatusText = 'You won!';
            }
          // Score unsuccessful
          } else {
            mindStatusText = '\'score\' failed...';
          }
        // Invalid usage
        } else {
          mindStatusText = 'Invalid usage of spell \'score\'';
          mindStatusText += '\r\n';
          mindStatusText += getHelpText('score');
        }
        break;
    }
  // You don't know that spell
  } else {
    mindStatusText = 'You don\'t know that spell...';
  }
}

function getHelpText(helpTarget) {
  let helpText = '';
  switch (helpTarget) {
    case 'cast':
      helpText += 'Usage: cast [spell] [arg1] [arg2]...';
      helpText += '\r\n';
      helpText += 'Description: Use to activate a learned spell.'
      break;
    case 'move':
      helpText += 'Usage: move [direction]';
      helpText += '\r\n';
      helpText += 'Description: Use to move to an adjacent room in the given direction.';
      helpText += ' Door must be available and open. Valid directions: up, north, right, east, down, south, left, west';
      break;
    case 'pickup':
    case 'get':
      helpText += 'Usage: ' + helpTarget + ' [item]';
      helpText += '\r\n';
      helpText += 'Description: Use to obtain an item from the list of items in the room.';
      helpText += ' Same as ' + (helpTarget == 'pickup' ? 'get' : 'pickup');
      break;
    case 'drop':
    case 'leave':
      helpText += 'Usage: ' + helpTarget + ' [item]';
      helpText += '\r\n';
      helpText += 'Description: Use to leave an item from your inventory in the room.';
      helpText += ' Same as ' + (helpTarget == 'drop' ? 'leave' : 'drop');
      break;
    case 'bless':
      helpText += 'Usage: cast bless';
      helpText += '\r\n';
      helpText += 'Description: Use to send a fiendish symbol to all players.';
      break;
    case 'intercept':
      helpText += 'Usage: cast intercept';
      helpText += '\r\n';
      helpText += 'Description: Use to steal the oddball from another player in the same room.';
      break;
    case 'score':
      helpText += 'Usage: cast score';
      helpText += '\r\n';
      helpText += 'Description: Use to score the oddball in the target room.';
      helpText += ' Must have the oddball and be in the target room.';
      break;
  }

  // Build help for item
  if (!helpText) {
    if (constants.items[helpTarget]) {
      // Add item description
      helpText += 'Description: ' + constants.items[helpTarget].description;
      // If item deals damage, add damage
      if (constants.items[helpTarget]['damage']) {
        helpText += '\r\n';
        helpText += 'Damage: ' + constants.items[helpTarget].damage;
      }
    }
  }

  // Default help error
  if (!helpText) {
    helpText += 'Invalid command.';
  }

  return helpText;
}

function movePlayer(direction) {
  direction = direction.trim().toUpperCase();
  // Valid directions only...
  if ((direction == 'NORTH' || direction == 'UP') && playerLocation.y > 0
        && mapReference[playerLocation.y][playerLocation.x].mapKey.includes('N')) {
    playerEnterRoom(playerLocation.y - 1, playerLocation.x);
    mindStatusText = 'You moved ' + direction.trim().toLowerCase() + '.';
  } else if ((direction == 'EAST' || direction == 'RIGHT') && playerLocation.x < (constants.mapWidth - 1)
                && mapReference[playerLocation.y][playerLocation.x].mapKey.includes('E')) {
    playerEnterRoom(playerLocation.y, playerLocation.x + 1);
    mindStatusText = 'You moved ' + direction.trim().toLowerCase() + '.';
  } else if ((direction == 'SOUTH' || direction == 'DOWN') && playerLocation.y < (constants.mapHeight - 1)
                && mapReference[playerLocation.y][playerLocation.x].mapKey.includes('S')) {
    playerEnterRoom(playerLocation.y + 1, playerLocation.x);
    mindStatusText = 'You moved ' + direction.trim().toLowerCase() + '.';
  } else if ((direction == 'WEST' || direction == 'LEFT') && playerLocation.x > 0
                && mapReference[playerLocation.y][playerLocation.x].mapKey.includes('W')) {
    playerEnterRoom(playerLocation.y, playerLocation.x - 1);
    mindStatusText = 'You moved ' + direction.trim().toLowerCase() + '.';
  } else {
    mindStatusText = 'You can\'t move that way...';
  }
}

function pickupItem(item) {
  const serverItem = itemsLocal[item];
  if (serverItem) {
    if (constants.items[item].class == 'spellbook') {
      if (!playerSpells.includes(constants.items[item].spell)) {
        const count = serverItem.count - 1;
        playerSpells.push(constants.items[item].spell);
        firebaseUtil.updateItemsLocal(roomKey, playerLocation.y, playerLocation.x, item, count);
        mindStatusText = 'You learned the spell \'' + constants.items[item].spell + '\'.';
      } else {
        mindStatusText = 'You already know the spell \'' + constants.items[item].spell + '\'.';
      }
    } else {
      const count = serverItem.count - 1;
      playerInventory.push(item);
      firebaseUtil.updateItemsLocal(roomKey, playerLocation.y, playerLocation.x, item, count);
      if (constants.items[item].class == 'special') {
        switch (item) {
          case 'oddball':
            // Triggers on oddball pickup
            oddballPickupTrigger();
            mindStatusText = 'You obtained the oddball.';
            break;
        }
      } else {
        mindStatusText = 'You obtained a' + (utils.isVowel(item.charAt(0)) ? 'n' : '') + ' ' + item + '.';
      }
    }

    updatePlayerInventoryServer(username, playerInventory);
  } else {
    mindStatusText = 'A' + (utils.isVowel(item.charAt(0)) ? 'n' : '') + ' ' + item + ' isn\'t in the room.';
  }
}

function oddballPickupTrigger() {
  // Only create new target if it doesn't already exist
  if (!oddballTargetExists) {
    // Generate new target tile, update tile data in server
    const minimumTargetTileDistance = constants.gamemodes.oddball.minimumTargetTileDistance;
    let oddballSpawned = false;
    while (!oddballSpawned) {
      const oddballTargetY = Math.floor(Math.random() * constants.mapHeight);
      const oddballTargetX = Math.floor(Math.random() * constants.mapWidth);
      const pickupSpaceY = playerLocation.y;
      const pickupSpaceX = playerLocation.x;
      const oddballDistanceY = Math.abs(pickupSpaceY - oddballTargetY);
      const oddballDistanceX = Math.abs(pickupSpaceX - oddballTargetX);

      // If tile is valid and greater than or equal to the minimum starting spawn distance,
      // Then spawn the oddball and mark tile as having oddball
      if (mapReference[oddballTargetY][oddballTargetX].mapKey &&
          (oddballDistanceY + oddballDistanceX) >= minimumTargetTileDistance
      ) {
        oddballSpawned = true;
        console.log('Oddball new target: ' + oddballTargetY + ', ' + oddballTargetX);
        firebaseUtil.writeGlobalMapTileOddballTarget(roomKey, oddballTargetY, oddballTargetX);
        firebaseUtil.writeGlobalChatMessage('SERVER', 'THE ODDBALL HAS BEEN OBTAINED', roomKey);
      }
    }
    oddballTargetExists = true;
  }
}

function hasOddball() {
  return playerInventory.find((item) => item == 'oddball');
}

function dropItem(item) {
  if (playerInventory.includes(item)) {
    const serverItem = itemsLocal[item];
    let count = 1;
    if (serverItem) {
      count += serverItem.count;
    }
    playerInventory.splice(playerInventory.findIndex((i) => i == item), 1);
    firebaseUtil.updateItemsLocal(roomKey, playerLocation.y, playerLocation.x, item, count);
    updatePlayerInventoryServer(username, playerInventory);
    mindStatusText = 'You left a' + (utils.isVowel(item.charAt(0)) ? 'n' : '') + ' ' + item + ' in the room.';
  } else {
    mindStatusText = 'You don\'t have a' + (utils.isVowel(item.charAt(0)) ? 'n' : '') + ' ' + item + ' to drop.';
  }
}

function updatePlayerInventoryServer(playerName, inventory) {
  // Build DB format of player inventory and save it to players global
  const playerInventoryDB = {};
  for (let item of inventory) {
    if (playerInventoryDB[item]) {
      playerInventoryDB[item].count++;
    } else {
      playerInventoryDB[item] = {
        count: 1
      };
    }
  }
  firebaseUtil.writePlayersGlobalInventory(playerName, roomKey, playerInventoryDB);
}

function setupMindWindow() {
  mindChatElementRef.addEventListener('keyup', mindHistoryInput);
  mindChatElementRef.querySelector('.draggable-window-body').classList.add('mind-body');
  const paragraphElement = document.createElement("p");
  paragraphElement.className = 'mind-text';
  mindChatElementRef.querySelector('.draggable-window-body').appendChild(paragraphElement);

  buildMindText();
}

function buildMindText() {
  let mindText = '';
  const itemColumnWidth = 15;
  const spellsColumnWidth = 15;
  const inventoryHeader = 'INVENTORY';
  const spellHeader = 'SPELLS';
  // Set up column headers for Inventory and Spells
  mindText += '<span class="mind-header">';
  mindText += inventoryHeader;
  for (let i = 0 ; i < (itemColumnWidth - inventoryHeader.length); i++) {
    mindText += ' ';
  }
  mindText += '|';
  mindText += spellHeader;
  for (let i = 0; i < (spellsColumnWidth - spellHeader.length); i++) {
    mindText += ' ';
  }
  mindText += '\r\n'
  for (let i = 0; i < itemColumnWidth; i++) {
    mindText += '_';
  }
  mindText += '|';
  for (let i = 0; i < spellsColumnWidth; i++) {
    mindText += '_';
  }
  mindText += '\r\n';
  for (let i = 0; i < itemColumnWidth; i++) {
    mindText += ' ';
  }
  mindText += '|';
  for (let i = 0; i < spellsColumnWidth; i++) {
    mindText += ' ';
  }
  mindText += '</span>';
  
  // Set up rows
  const maxRows = Math.max(playerInventory.length, playerSpells.length);
  //const itemAndSpellRows = new Array(maxRows).fill('');
  for (let i = 0; i < maxRows; i++) {
    let itemAndSpellRow = '';
    // Process inventory first
    // If we have an item for this row, populate and fill with space
    if (i < playerInventory.length) {
      const item = playerInventory[i]
      itemAndSpellRow += item == 'oddball' ? '<span class="item-oddball">' + item + '</span>' : item;
      for (let j = 0; j < (itemColumnWidth - item.length); j++) {
        itemAndSpellRow += ' ';
      }
    // If no item, fill with space
    } else {
      for (let j = 0; j < itemColumnWidth; j++) {
        itemAndSpellRow += ' ';
      }
    }

    // Add column separator
    itemAndSpellRow += '<span class="mind-header">|</span>';

    // Process spells next
    if (i < playerSpells.length) {
      itemAndSpellRow += playerSpells[i];
      for (let j = 0; j < (spellsColumnWidth - playerSpells[i].length); j++) {
        itemAndSpellRow += ' ';
      }
    // If no item, fill with space
    } else {
      for (let j = 0; j < spellsColumnWidth; j++) {
        itemAndSpellRow += ' ';
      }
    }

    mindText += '\r\n' + itemAndSpellRow;
  }

  // Oddball Score
  if (gamemode == 'oddball') {
    // Two line spacer
    mindText += '\r\n\r\n';
    // Display player score
    mindText += 'ODDBALL SCORE: ' + playerOddballScore;
  }

  // Display mind status
  if (mindText) {
    // Two line spacer
    mindText += '\r\n\r\n';
    // Display mind text
    mindText += '<span class="mind-status">' + mindStatusText + '</span>';
  }

  mindChatElementRef.querySelector('.mind-text').innerHTML = mindText;
}
//#endregion

//#region LOCAL - ROOM
function exitLocalRoomServer () {
  // Remove player from old room local chat list
  firebaseUtil.removePlayersLocal(roomKey, playerLocation.y, playerLocation.x, username);
}

function enterLocalRoomServer (prevY, prevX) {
  // First, remove all local listeners from old room (if any)
  firebaseUtil.removeLocalDBMessageListeners();
  // Reset first load flags
  localChatFirstLoadFlag = null;
  playerLocalFirstLoadFlag = null;
  playersLocal = {};
  // Clear local chat window
  clearChatWindow(localChatElementRef);
  // Update local chat and map + window titles
  updateWindowTitle(localChatElementRef, 'LOCAL_CHAT ' + (playerLocation.y + 1) + '-' + (playerLocation.x + 1));
  updateWindowTitle(mapZoomedInElementRef, 'MAP + ' + (playerLocation.y + 1) + '-' + (playerLocation.x + 1));
  // Add player to local chat list
  firebaseUtil.writePlayersLocalMessage(roomKey, playerLocation.y, playerLocation.x, username);
  // Then, add listeners for new room
  firebaseUtil.setLocalChatDBMessageListener(roomKey, playerLocation.y, playerLocation.x, function (snapshot) {
    localChatUpdate(snapshot);
  });
  firebaseUtil.setPlayersLocalDBMessageListener(roomKey, playerLocation.y, playerLocation.x, function (snapshot) {
    playerLocalUpdate(snapshot);
  });
  firebaseUtil.setItemsLocalDBMessageListener(roomKey, playerLocation.y, playerLocation.x, function (snapshot) {
    itemsLocalUpdate(snapshot);
  });
  // Update server map with oddball location
  if (hasOddball()) {
    firebaseUtil.writeUpdateGlobalMapTileHasOddball(roomKey, prevY, prevX, playerLocation.y, playerLocation.x);
  }
}

function localChatUpdate (snapshot) {
  // Ignore first message always (comes from subscribing)
  if (localChatFirstLoadFlag) {
    // Only update if data exists
    if (snapshot.exists()) {
      const snapshotVal = snapshot.val();
      let snapshotObj = snapshotVal[Object.keys(snapshotVal)[Object.keys(snapshotVal).length - 1]];
      processNewTextElement(localChatElementRef.querySelector('.draggable-window-body'), snapshotObj.message, snapshotObj.username, snapshotObj.timestamp);
    }
  } else {
    localChatFirstLoadFlag = true;
  }
}

function playerLocalUpdate(snapshot) {
  // Only update if data exists
  if (snapshot.exists()) {
    // Ignore first message always (comes from subscribing)
    if (playerLocalFirstLoadFlag) {
      const playersServer = snapshot.val();

      // Check if any player entered compared to local cache
      const playerEnteredList = [];
      for (const playerServer in playersServer) {
        let playerFound = false;
        for (const playerLocal in playersLocal) {
          if (playerServer == playerLocal) {
            playerFound = true;
            break;
          }
        }
        if (!playerFound) {
          playerEnteredList.push(playerServer);
        }
      }
      // Check if any player left compared to local cache
      const playerExitedList = [];
      for (const playerLocal in playersLocal) {
        let playerFound = false;
        for (const playerServer in playersServer) {
          if (playerServer == playerLocal) {
            playerFound = true;
            break;
          }
        }
        if (!playerFound) {
          playerExitedList.push(playerLocal);
        }
      }

      // Add text logs to local chat
      for (const playerEnteredIndex in playerEnteredList) {
        addLocalPlayerEnteredExitedLog(playerEnteredList[playerEnteredIndex], 'entered');
      }
      for (const playerExitedIndex in playerExitedList) {
        addLocalPlayerEnteredExitedLog(playerExitedList[playerExitedIndex], 'exited');
      }
      
      // Update local cache with server player list
      playersLocal = playersServer;
    } else {
      // Set local cache of player room snapshot
      playersLocal = snapshot.val();
      playerLocalFirstLoadFlag = true;
    }

    buildMapDetailText();
  }
}

function itemsLocalUpdate(snapshot) {
  itemsLocal = {};
  if (snapshot.exists()) {
    const snapshotVal = snapshot.val();
    itemsLocal = snapshotVal;
  }
  buildMapDetailText();
}

function addLocalPlayerEnteredExitedLog(msgUsername, enteredOrExited) {
  // Add new text log element to chat window
  const p = document.createElement("p");
  const playerNameSpan = document.createElement("span");
  const preTextSpan = document.createElement("span");
  const playerEnteredExitedSpan = document.createElement("span");
  const postTextSpan = document.createElement("span");

  const metaNode = document.createTextNode(msgUsername);
  playerNameSpan.appendChild(metaNode);
  playerNameSpan.className = 'log-entry-meta';

  const preTextNode = document.createTextNode(' has ');
  preTextSpan.appendChild(preTextNode);
  preTextSpan.className = 'log-entry-text';
  
  const playerEnteredExitedNode = document.createTextNode(enteredOrExited);
  playerEnteredExitedSpan.appendChild(playerEnteredExitedNode);
  playerEnteredExitedSpan.className = enteredOrExited == 'entered' ? 'log-entry-entered' : 'log-entry-exited';

  const postTextNode = document.createTextNode(' the room...');
  postTextSpan.appendChild(postTextNode);
  postTextSpan.className = 'log-entry-text';

  p.appendChild(playerNameSpan);
  p.appendChild(preTextSpan);
  p.appendChild(playerEnteredExitedSpan);
  p.appendChild(postTextSpan);
  p.className = 'log-entry-parent';
  localChatElementRef.querySelector('.draggable-window-body').appendChild(p);
}
//#endregion

//#region MAP
function setupMapWindow(windowRef, name, width, height) {
  windowRef.style.width = width + 'px';
  windowRef.style.height = height + 'px';
  windowRef.querySelector('.draggable-window-title').textContent = name;
  windowRef.querySelector('.draggable-window-footer').remove();
  windowRef.querySelector('.draggable-window-body').style.height = 'calc(100% - 42px)';
  const paragraphElement = document.createElement("p");
  paragraphElement.className = 'map-text';
  windowRef.querySelector('.draggable-window-body').appendChild(paragraphElement);

  if (name == 'MAP +') {
    windowRef.querySelector('.draggable-window-body').classList.add('map-zoomed-in-body');
  }
}

function initializeMap() {
  mapMaster = [];
  mapReference = [];
  for (let i = 0; i < constants.mapHeight; i++) {
    const row = [];
    const referenceRow = [];
    for (let j = 0; j < constants.mapWidth; j++) {
      row.push('');
      referenceRow.push({
        mapKey: '',
        discovered: false
      });
    }
    mapMaster.push(row);
    mapReference.push(referenceRow);
  }

  firebaseUtil.setGlobalMapTileDataDBMessageListener(roomKey, (snapshot) => {
    if (snapshot.exists()) {
      // Iterate through all rooms on server
      const snapshotVal = snapshot.val();
      const serverRooms = Object.keys(snapshotVal);
      oddballTargetExists = false;
      let refreshMap = false;
      for (let i = 0; i < serverRooms.length; i++) {
        // Grab coordinate and split it to y and x values
        const serverCoord = serverRooms[i];
        const y = Number(serverCoord.split('_')[0]);
        const x = Number(serverCoord.split('_')[1]);
        mapReference[y][x].mapKey = snapshotVal[serverCoord].mapKey;
        mapReference[y][x].discovered = snapshotVal[serverCoord].discovered;
        mapReference[y][x].hasOddball = false;
        mapReference[y][x].oddballTarget = false;

        // Mark map as having oddball
        if (snapshotVal[serverCoord]?.hasOddball) {
          mapReference[y][x].hasOddball = true;
          refreshMap = true;
        }
        // Mark map as being oddball target
        if (snapshotVal[serverCoord]?.oddballTarget) {
          mapReference[y][x].oddballTarget = true;
          oddballTargetExists = true;
          refreshMap = true;
        }
      }

      if (refreshMap) {
        buildMapText();
      }
      
      if (!globalMapFirstLoadFlag) {
        globalMapFirstLoadFlag = true;
        // Set player to center of map
        // TODO change spawn points here later?
        playerEnterRoom(Math.floor(constants.mapHeight / 2), Math.floor(constants.mapWidth / 2));
      }
    }
  });
}

function playerEnterRoom(y, x) {
  // Events on leave room
  exitLocalRoomServer();

  const prevY = playerLocation.y;
  const prevX = playerLocation.x;
  playerLocation.y = y;
  playerLocation.x = x;
  const referenceTile = mapReference[y][x].mapKey;
  const discovered = mapReference[y][x].discovered;

  // If we haven't discovered the tile yet, put it in local master
  if (!mapMaster[y][x]) {
    mapMaster[y][x] = referenceTile;
  }

  // Tile has not been discovered in server, run discovery triggers (items, totems, etc.)
  // And update discovery status in server
  if (!discovered) {
    firebaseUtil.writeGlobalMapTileDiscovered(roomKey, playerLocation.y, playerLocation.x);
  }

  // Events on enter room
  enterLocalRoomServer(prevY, prevX);

  // Redraw map
  buildMapText();
  buildMapDetailText();
}

function buildMapText() {
  let mapText = '';
  for (let i = 0; i < constants.mapHeight; i++) {
    for (let j = 0; j < constants.mapWidth; j++) {
      let tile = '';
      if (!mapMaster[i][j]) {
        tile = mapVoid;
        // Determine if nearby room is undiscovered but available based on room detail key
        if ((i - 1) >= 0 && mapMaster[i - 1][j].includes('S') ||
              (j + 1) < constants.mapWidth && mapMaster[i][j + 1].includes('W') ||
              (i + 1) < constants.mapHeight && mapMaster[i + 1][j].includes('N') ||
              (j - 1) >= 0 && mapMaster[i][j - 1].includes('E')) {
          tile = mapUndiscovered;
        }
      } else {
        tile = mapDiscovered;
      }
      // Override with player location
      if (playerLocation.y == i && playerLocation.x == j) {
        tile = '<span class="map-player">' + mapPlayer + '</span>';
      // Override with oddball target marking
      } else if (mapReference[i][j].oddballTarget) {
        tile = '<span class="map-room-oddball-target">' + tile + '</span>';
      // Override with has oddball marking
      } else if (mapReference[i][j].hasOddball) {
        tile = '<span class="map-room-has-oddball">' + tile + '</span>';
      }
      mapText += tile;
      if (j < (constants.mapWidth - 1)) {
        mapText += '  ';
      }
    }
    if (i < (constants.mapHeight - 1)) {
      mapText += '<br>\r\n<br>\r\n';
    }
  }
  mapZoomedOutElementRef.querySelector('.map-text').innerHTML = mapText;
}

function buildMapDetailText() {
  let mapText = '';
  let mapLines = [];
  const roomTextLineWidth = 9;
  const roomTextLineWidthPastRoom = 18;
  const startingColumnBufferWidth = 5;
  const playerColumnWidth = 15;
  const itemColumnWidth = 15;
  const playersHeader = 'PLAYERS';
  const itemsHeader = 'ITEMS';
  try {
    let baseMapText = rooms[mapTheme][mapMaster[playerLocation.y][playerLocation.x]];
    mapLines = baseMapText.split(/\r?\n/);

    // Player header
    for (let i = 0; i < startingColumnBufferWidth; i++) {
      mapLines[0] += ' ';
    }
    mapLines[0] += `<span class="map-column-header">${playersHeader}</span>`;
    for (let i = 0; i < playerColumnWidth - playersHeader.length; i++) {
      mapLines[0] += ' ';
    }

    mapLines[0] += '<span class="map-column-header">|</span>';

    // Items header
    mapLines[0] += `<span class="map-column-header">${itemsHeader}</span>`;
    for (let i = 0; i < itemColumnWidth - itemsHeader.length; i++) {
      mapLines[0] += ' ';
    }

    // Add table separator
    for (let i = 0; i < startingColumnBufferWidth; i++) {
      mapLines[1] += ' ';
    }
    mapLines[1] += '<span class="map-column-header">';
    for (let i = 0; i < playerColumnWidth; i++) {
      mapLines[1] += '_'
    }
    mapLines[1] += '|'
    for (let i = 0; i < itemColumnWidth; i++) {
      mapLines[1] += '_';
    }
    mapLines[1] += '</span>';
    for (let i = 0; i < (startingColumnBufferWidth + itemColumnWidth); i++) {
      mapLines[2] += ' ';
    }
    mapLines[2] += '<span class="map-column-header">|</span>';

    const startingRowIndex = 3;
    const players = Object.keys(playersLocal);
    const items = [];
    for (const item in itemsLocal) {
      for (let i = 0; i < itemsLocal[item].count; i++) {
        items.push(item);
      }
    }
    const maxRows = Math.max(players.length, items.length);
    for (let i = 0; i < maxRows; i++) {
      let mapLineIndex = i + startingRowIndex;
      // Insert new row if we went past 
      if ((mapLines.length - 1) < mapLineIndex) {
        mapLines.push('<br>');
        for (let j = 0; j < roomTextLineWidthPastRoom; j++) {
          mapLines[mapLineIndex] += ' ';
        }
      }
      // Player list
      for (let j = 0; j < startingColumnBufferWidth; j++) {
        mapLines[mapLineIndex] += ' ';
      }
      if (i < players.length) {
        let p = players[i];
        mapLines[mapLineIndex] += '<span class="' + (username == p ? 'map-user' : 'map-player') + '">' + p + '</span>';
        for (let j = 0; j < playerColumnWidth - p.length; j++) {
          mapLines[mapLineIndex] += ' ';
        }
      } else {
        for (let j = 0; j < playerColumnWidth; j++) {
          mapLines[mapLineIndex] += ' ';
        }
      }
      mapLines[mapLineIndex] += '<span class="map-column-header">|</span>';

      // Item list
      if (i < items.length) {
        let item = items[i];
        mapLines[mapLineIndex] += (item == 'oddball' ? '<span class="item-oddball">' : '<span class="map-item">') + item + '</span>';
        for (let j = 0; j < itemColumnWidth - item.length; j++) {
          mapLines[mapLineIndex] += ' ';
        }
      }
    }

    // Add in player 'characters'
    // X: 9-18, Y: 2-5
    const playerPositions = [];
    for (let i = 0; i < players.length; i++) {
      let newPlayerPosition = {x: 0, y: 0};
      let uniquePosition = true;
      do {
        uniquePosition = true;
        // Calculate new random position
        newPlayerPosition.x = Math.floor(Math.random() * 10) + 10;
        newPlayerPosition.y = Math.floor(Math.random() * 4) + 2;
        // Check against previously decided positions to make sure new position is unique
        for (let j = 0; j < i; j++) {
          if (playerPositions[j].x == newPlayerPosition.x && playerPositions[j].y == newPlayerPosition.y) {
            uniquePosition = false;
            break;
          }
        }
      } while (!uniquePosition)
      playerPositions.push(newPlayerPosition);
    }

    // Reformat positions to room lines
    let playerPositionsFormatted = [];
    for (let i = 0; i < 4; i++) {
      playerPositionsFormatted.push(new Array());
    }
    for (let i = 0; i < players.length; i++) {
      playerPositionsFormatted[playerPositions[i].y - 2].push(playerPositions[i]);
    }
    for (let i = 0; i < playerPositionsFormatted.length; i++) {
      playerPositionsFormatted[i].sort((a, b) => a.x - b.x);
    }

    // Write player characters to text
    let firstPlayer = true;
    for (let i = 0; i < playerPositionsFormatted.length; i++) {
      let spanAddition = 0;
      for (let j = 0; j < playerPositionsFormatted[i].length; j++) {
        let pos = playerPositionsFormatted[i][j];
        let lineIndex = pos.y;
        let sliceIndex = pos.x + spanAddition;
        let spanText = '<span class="' + (firstPlayer ? 'map-user' : 'map-player') + '">' + mapPlayer + '</span>';
        mapLines[lineIndex] = mapLines[lineIndex].slice(0, sliceIndex) + spanText + mapLines[lineIndex].slice(sliceIndex + 1);
        spanAddition += spanText.length;
        firstPlayer = false;
      }
    }

    // Build full text
    for (let i = 0; i < mapLines.length; i++) {
      mapText += mapLines[i];
    }

    mapZoomedInElementRef.querySelector('.map-text').innerHTML = mapText;
  } catch (error) {
    console.log(error);
  }
}
//#endregion

//------------ Run start function
devilryStart();