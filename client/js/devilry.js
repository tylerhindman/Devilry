import * as firebaseUtil from "./firebase-util.js";
import * as rooms from "./data/rooms.js";
import * as spells from "./data/spells.js";
import * as utils from "./util.js";
import '../css/main.css';

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

// User vars
let username = null;
let roomKey = null;

// Map vars
const mapVoid = '░';
const mapUndiscovered = '▒';
const mapDiscovered = '▓';
const mapPlayer = 'Φ';
const mapWidth = 10;
const mapHeight = 6;
let mapMaster = [];
let mapReference = [];
const playerLocation = {y: 0, x: 0};
const mapDetailElements = [];
const mapTheme = 'castle';

// Game props
let gameStarted = false;
const cfg_maxPlayers = 10;

// Data models - global
let playersGlobal = {};

// Data models - local
let playersLocal = {};

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
        break;
      case 3:
        newWindowElement.id = 'map-window-zoomed-out';
        setupMapWindow(newWindowElement, 'MAP -', 250, 275);
        mapZoomedOutElementRef = newWindowElement;
        break;
      case 4:
        newWindowElement.id = 'map-window-zoomed-in';
        setupMapWindow(newWindowElement, 'MAP +', 200, 230);
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
  // If we are already in a session, hide the login screen
  if (username && roomKey) {
    loginWindowElementRef.style.display = 'none';
    loginWindowCoverElementRef.style.display = 'none';
    initRoomListeners();
  }
  // Set listener on login buttons
  loginWindowElementRef.querySelector('#login-window-button').addEventListener('click', login);
  loginWindowElementRef.querySelector('#create-room-button').addEventListener('click', createRoom);
  // ***Commented out, have to click Create Room
  // loginWindowElementRef.querySelector('#login-window-name-input').addEventListener('keyup', function (event) {
  //   if ((event.key === 'Enter' || event.keyCode === 13)) {
  //     login();
  //   }
  // });
  loginWindowElementRef.querySelector('#login-window-room-input').addEventListener('keyup', function (event) {
    if ((event.key === 'Enter' || event.keyCode === 13)) {
      login();
    }
  });

  // ------ Get Lobby window refs + setup
  lobbyWindowElementRef = document.querySelector('#lobby-window');
  lobbyWindowElementRef.querySelector('#lobby-players-max').innerHTML = cfg_maxPlayers;
  // TODO Set listeners for lobby buttons here
}

function createRoom() {
  let usernameFieldValue = loginWindowElementRef.querySelector('#login-window-name-input').value;
  if (usernameFieldValue) {
    loginWindowElementRef.style.display = 'none';
    loginWindowCoverElementRef.style.display = 'none';
    username = usernameFieldValue;
    utils.setCookie('username', username);
    // Call function to create room here
    firebaseUtil.firebaseCreateRoom(username, (result) => {
      roomKey = result.roomKey;
      utils.setCookie('roomKey', roomKey);

      // Go to lobby
      enterLobby();
    });
  }
}

function login() {
  let usernameFieldValue = loginWindowElementRef.querySelector('#login-window-name-input').value;
  let roomKeyFieldValue = loginWindowElementRef.querySelector('#login-window-room-input').value;
  if (usernameFieldValue && roomKeyFieldValue) {
    // Check against DB if room key is valid
    firebaseUtil.getRoomKeysDB((snapshot) => {
      let validRoomKey = false; // Start with assumption that room is invalid
      if (snapshot.exists()) {
        const roomKeys = snapshot.val();
        for (const k in roomKeys) {
          // valid if found in database list
          if (roomKeyFieldValue == k) {
            validRoomKey = true;
            break;
          }
        }
      }

      // Show roomkey error
      if (!validRoomKey) {

      // Continue to username verification
      } else {
        // Check against server if username is valid in room
        firebaseUtil.getPlayersGlobalDB((snapshot) => {
          let validUsername = true; // Start with assumption that name is valid
          if (snapshot.exists()) {
            const usernames = snapshot.val();
            for (const u in usernames) {
              // Invalid if found in database list
              if (usernameFieldValue == u) {
                validUsername = false;
                break;
              }
            }
          }

          // Show username error
          if (!validUsername) {
            
          // Continue with login
          } else {
            loginWindowElementRef.style.display = 'none';
            //loginWindowCoverElementRef.style.display = 'none';
            username = usernameFieldValue;
            roomKey = roomKeyFieldValue;
            utils.setCookie('username', username);
            utils.setCookie('roomKey', roomKey);
            // Go to lobby
            enterLobby();
          }
        });
      }
    });
  }
}

function initRoomListeners() {
  // ----- Set message listener for players global
  firebaseUtil.setPlayersGlobalDBMessageListener(roomKey, function (snapshot) {
    playersGlobalUpdate();
  });
  // ----- Set message listener for global chat window
  firebaseUtil.setGlobalChatDBMessageListener(roomKey, function (snapshot) {
    globalChatUpdate(snapshot);
  });
  // Initialize Map
  initializeMap();
  // ----- Set message listener for global map
  firebaseUtil.setGlobalMapDBMessageListener(roomKey, function (snapshot) {
    globalMapUpdate(snapshot);
  });
}

function enterLobby() {
  initRoomListeners();
  loginWindowElementRef.style.display = 'none';
  lobbyWindowElementRef.style.display = 'block';
  lobbyWindowElementRef.querySelector('#lobby-room-key').innerHTML = roomKey;
}

function playersGlobalUpdate(snapshot) {
  // Only update if data exists
  if (snapshot.exists()) {
    const playersServer = snapshot.val();
    
    // Update local cache with server player list
    playersGlobal = playersServer;

    // Update lobby player list
    const lobbyPlayersListElementRef = lobbyWindowElementRef.querySelector('#lobby-players-list');
    lobbyPlayersListElementRef.innerHTML = '';
    for (const playerName in playersGlobal) {
      const p = document.createElement("p");
      p.className = playerName == username ? 'lobby-player-name-user' : 'lobby-player-name';
      p.innerHTML = playerName;

      lobbyPlayersListElementRef.appendChild(p);
    }
    // Update player count
    lobbyWindowElementRef.querySelector('#lobby-players-count').innerHTML = Object.keys(playersGlobal).length.toString();
  }
}

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
    metaSpan.className = (msgUsername == username) ? 'log-entry-meta-self' : 'log-entry-meta';

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

function globalChatUpdate(snapshot) {
  // Only update if data exists
  if (snapshot.exists()) {
    const snapshotVal = snapshot.val();
    // Update chat log with new entries only
    if (globalChatFirstLoadFlag) {
      let snapshotObj = snapshotVal[Object.keys(snapshotVal)[Object.keys(snapshotVal).length - 1]];
      let messageVal = snapshotObj.message;
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

function clearChatWindow(clearWindow) {
  const clearBody = clearWindow.querySelector('.draggable-window-body');
  clearBody.innerHTML = '';
}

function updateWindowTitle(titleWindow, newTitle) {
  const titleWindowElement = titleWindow.querySelector('.draggable-window-title');
  titleWindowElement.textContent = newTitle;
}

function logout() {
  // Clean up server players
  firebaseUtil.removePlayersLocal(roomKey, playerLocation.y, playerLocation.x, username);

  // Clear user vars and cookies
  globalChatFirstLoadFlag = null;
  globalMapFirstLoadFlag = null;
  localChatFirstLoadFlag = null;
  playerLocalFirstLoadFlag = null;
  playersLocal = {};
  username = null;
  roomKey = null;
  utils.deleteCookie('username');
  utils.deleteCookie('roomKey');

  // Remove DB listeners
  firebaseUtil.removeGlobalDBMessageListeners();
  firebaseUtil.removeLocalDBMessageListeners();

  // Clear and hide windows
  closeWindow(globalChatElementRef);
  closeWindow(localChatElementRef);
  closeWindow(mindChatElementRef);
  clearChatWindow(globalChatElementRef);
  clearChatWindow(localChatElementRef);
  clearChatWindow(mindChatElementRef);

  // Reinstate login window
  loginWindowCoverElementRef.style.display = 'block';
  loginWindowElementRef.style.display = 'block';
}

function processMindCommand(message) {
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
    default:
      break;
  }
}

function castSpell(spellArgs) {
  const spell = spellArgs[0].trim();
  switch (spell) {
    case 'bless':
      // Write spell trigger to specific chat
      firebaseUtil.writeGlobalChatMessage(username, 'spell:bless', roomKey);
      // Spell logic
      break;
    case 'room':
      // Write spell trigger to specific chat
      firebaseUtil.writeGlobalChatMessage(username, 'spell:room', roomKey);
      // Spell logic
      break;
  }
}

function movePlayer(direction) {
  direction = direction.trim().toUpperCase();
  // Valid directions only...
  if ((direction == 'NORTH' || direction == 'UP') && playerLocation.y > 0
        && mapMaster[playerLocation.y][playerLocation.x].includes('N')) {
    playerEnterRoom(playerLocation.y - 1, playerLocation.x);
  } else if ((direction == 'EAST' || direction == 'RIGHT') && playerLocation.x < (mapWidth - 1)
                && mapMaster[playerLocation.y][playerLocation.x].includes('E')) {
    playerEnterRoom(playerLocation.y, playerLocation.x + 1);
  } else if ((direction == 'SOUTH' || direction == 'DOWN') && playerLocation.y < (mapHeight - 1)
                && mapMaster[playerLocation.y][playerLocation.x].includes('S')) {
    playerEnterRoom(playerLocation.y + 1, playerLocation.x);
  } else if ((direction == 'WEST' || direction == 'LEFT') && playerLocation.x > 0
                && mapMaster[playerLocation.y][playerLocation.x].includes('W')) {
    playerEnterRoom(playerLocation.y, playerLocation.x - 1);
  }
}

//#region LOCALCHAT
function exitLocalChat () {
  // Remove player from old room local chat list
  firebaseUtil.removePlayersLocal(roomKey, playerLocation.y, playerLocation.x, username);
}

function enterLocalChat () {
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
  }
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
}

function initializeMap() {
  mapMaster = [];
  mapReference = [];
  for (let i = 0; i < mapHeight; i++) {
    const row = [];
    const referenceRow = [];
    for (let j = 0; j < mapWidth; j++) {
      row.push('');
      referenceRow.push('');
    }
    mapMaster.push(row);
    mapReference.push(referenceRow);
  }
}

function globalMapUpdate(snapshot) {
  // Only update if data exists
  if (snapshot.exists()) {
    // Iterate through all rooms on server
    const snapshotVal = snapshot.val();
    const serverRooms = Object.keys(snapshotVal);
    for (let i = 0; i < serverRooms.length; i++) {
      // Grab coordinate and split it to y and x values
      const serverCoord = serverRooms[i];
      const y = Number(serverCoord.split('_')[0]);
      const x = Number(serverCoord.split('_')[1]);
      // If local mapReference does not have value server does at that coordinate, set it in local reference
      if (mapReference[y][x] != snapshotVal[serverCoord]) {
        mapReference[y][x] = snapshotVal[serverCoord].mapKey;
      }
    }
  }

  // Initialize map for first load
  if (!globalMapFirstLoadFlag) {
    globalMapFirstLoadFlag = true;
    // Set player location & starting room key
    // Setting player statically to bottom left, will change later to randomize position
    playerEnterRoom(mapHeight - 1, 0);
  }
}

function playerEnterRoom(y, x) {
  // Events on leave room
  exitLocalChat();

  playerLocation.y = y;
  playerLocation.x = x;
  const referenceTile = mapReference[y][x];

  // Tile exists on server...
  if (referenceTile) {
    // If we haven't discovered the tile yet, put it in local master
    if (!mapMaster[y][x]) {
      mapMaster[y][x] = referenceTile;
    }
    
  // No tile on server, generate new tile
  } else {
    // Gather viable tile properties based on the following factors:
    // 1. Tested adjacent tile is within the bounds of the grid AND
    // 2. Tested adjacent tile is undiscovered on server OR
    // 3. Tested adjacent tile is discovered and has adjoining path
    const searchTerms = [];
    const notSearchTerms = [];
    let hasToHaveNorth = false;
    let hasToHaveEast = false;
    let hasToHaveSouth = false;
    let hasToHaveWest = false;
    if ((y - 1) >= 0 && mapReference[y - 1][x].includes('S')) {
      hasToHaveNorth = true;
      searchTerms.push('N');
    } else if ((y - 1) >= 0 && (!mapReference[y - 1][x])) {
      searchTerms.push('N');
    } else {
      notSearchTerms.push('N');
    }

    if ((x + 1) < mapWidth && mapReference[y][x + 1].includes('W')) {
      hasToHaveEast = true;
      searchTerms.push('E');
    } else if ((x + 1) < mapWidth && (!mapReference[y][x + 1])) {
      searchTerms.push('E');
    } else {
      notSearchTerms.push('E');
    }
    
    if ((y + 1) < mapHeight && mapReference[y + 1][x].includes('N')) {
      hasToHaveSouth = true;
      searchTerms.push('S');
    } else if ((y + 1) < mapHeight && (!mapReference[y + 1][x])) {
      searchTerms.push('S');
    } else {
      notSearchTerms.push('S');
    }

    if ((x - 1) >= 0 && mapReference[y][x - 1].includes('E')) {
      hasToHaveWest = true;
      searchTerms.push('W');
    } else if ((x - 1) >= 0 && (!mapReference[y][x - 1])) {
      searchTerms.push('W');
    } else {
      notSearchTerms.push('W');
    }
    
    // Use search terms to gather list of tiles to choose from
    const viableTiles = [];
    const allTiles = Object.keys(rooms[mapTheme]);
    for (let i = 0; i < searchTerms.length; i++) {
      for (let j = 0; j < allTiles.length; j++) {
        // Add only if it matches search term and it's not already selected
        if (allTiles[j].includes(searchTerms[i]) && !viableTiles.includes(allTiles[j]) &&
            ((hasToHaveNorth && allTiles[j].includes('N')) || !hasToHaveNorth) &&
            ((hasToHaveEast && allTiles[j].includes('E')) || !hasToHaveEast) &&
            ((hasToHaveSouth && allTiles[j].includes('S')) || !hasToHaveSouth) &&
            ((hasToHaveWest && allTiles[j].includes('W')) || !hasToHaveWest)) {
          viableTiles.push(allTiles[j]);
          // Revoke if from a NOT search term
          for (let k = 0; k < notSearchTerms.length; k++) {
            if (allTiles[j].includes(notSearchTerms[k])) {
              viableTiles.pop();
              break;
            }
          }
        }
      }
    }

    // Randomly pick tile from viable tiles and set it in local master
    const randomIndex =  Math.floor(Math.random() * (viableTiles.length));
    const newTile = viableTiles[randomIndex];
    mapMaster[y][x] = newTile;
    
    // Write tile to server
    firebaseUtil.writeGlobalMapUpdate(roomKey, y, x, newTile);
  }

  // Events on enter room
  enterLocalChat();

  // Redraw map
  buildMapText();
  buildMapDetailText();
}

function buildMapText() {
  let mapText = '';
  for (let i = 0; i < mapHeight; i++) {
    for (let j = 0; j < mapWidth; j++) {
      let tile = '';
      if (!mapMaster[i][j]) {
        tile = mapVoid;
        // Determine if nearby room is undiscovered but available based on room detail key
        if ((i - 1) >= 0 && mapMaster[i - 1][j].includes('S') ||
              (j + 1) < mapWidth && mapMaster[i][j + 1].includes('W') ||
              (i + 1) < mapHeight && mapMaster[i + 1][j].includes('N') ||
              (j - 1) >= 0 && mapMaster[i][j - 1].includes('E')) {
          tile = mapUndiscovered;
        }
      } else {
        tile = mapDiscovered;
      }
      // Override with player location
      if (playerLocation.y == i && playerLocation.x == j) {
        tile = '<span class="map-player">' + mapPlayer + '</span>';
      }
      mapText += tile;
      if (j < (mapWidth - 1)) {
        mapText += '  ';
      }
    }
    if (i < (mapHeight - 1)) {
      mapText += '<br>\r\n<br>\r\n';
    }
  }
  mapZoomedOutElementRef.querySelector('.map-text').innerHTML = mapText;
}

function buildMapDetailText() {
  let mapText = '';
  try {
    mapText = rooms[mapTheme][mapMaster[playerLocation.y][playerLocation.x]];
    // Add in detail elements from room detail
    // Player
    mapText = mapText.slice(0, 95) + '<span class="map-player">' + mapPlayer + '</span>' + mapText.slice(96);

    mapZoomedInElementRef.querySelector('.map-text').innerHTML = mapText;
  } catch (error) {
    console.log('invalid room');
  }
}
//#endregion

//------------ Run start function
devilryStart();