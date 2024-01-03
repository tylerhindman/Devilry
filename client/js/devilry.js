import * as firebaseUtil from "./firebase-util.js";
import * as rooms from "./data/rooms.js";
import * as spells from "./data/spells.js";
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

// Chat window references
let globalChatElementRef = null;
let localChatElementRef = null;
let mindChatElementRef = null;

// Chat message log snapshots
let globalChatFirstLoadFlag = null;
let localChatFirstLoadFlag = null;
let mindChatFirstLoadFlag = null;

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

  // ---------- Init window setup
  // Initialize all windows from the start but keep them hidden (closed).
  // They will be opened when user clicks icons.

  // Following windows are chat windows (global, local, mind).
  for (let i = 0; i < 3; i++) {
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

  // ----- Set message listener for global chat window
  firebaseUtil.setDBMessageListener('12345', function (snapshot) {
    globalChatUpdate(snapshot);
  });
}

function focusWindow(focusedWindow) {
  focusedWindow.querySelector('.draggable-window-input').focus();
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

function processNewTextElement(windowBody, value) {
  // Check for spell triggers first
  // -- Bless
  if (value.trim().includes('cast bless')) {
    const p = document.createElement("p");
    p.className = 'log-entry-parent log-entry-spell';
    windowBody.appendChild(p);
    spellDelayedAdd({spell: spells.spells.bless}, p, windowBody);

  // -- RoomTest
  } else if (value.trim().includes('cast room')) {
    const p = document.createElement("p");
    p.className = 'log-entry-parent log-entry-spell';
    windowBody.appendChild(p);
    spellDelayedAdd({spell: rooms.rooms.castle_NESW}, p, windowBody);

  // Else, enter into chat normally
  } else {
    const p = document.createElement("p");
    const metaSpan = document.createElement("span");
    const textSpan = document.createElement("span");

    const currentDate = new Date();
    let currentHour = new String(currentDate.getHours() > 12 ? currentDate.getHours() - 12 : currentDate.getHours());
    let currentMinute = new String(currentDate.getMinutes());
    const currentTime = (currentHour.length == 1 ? '0' + currentHour : currentHour) + ":"
      + (currentMinute.length == 1 ? '0' + currentMinute : currentMinute)
      + new String(currentDate.getHours() >= 12 ? 'PM' : 'AM');
    const metaNode = document.createTextNode('[Dumbpants ' + currentTime + '] ');
    metaSpan.appendChild(metaNode);
    metaSpan.className = 'log-entry-meta';

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
    if (event.target.value.trim().includes('cast bless')) {
      message = 'spell:bless';
    } else if (event.target.value.trim().includes('cast room')) {
      message = 'spell:room';
    }

    // Clear text field
    event.target.value = '';
    // Write to database
    firebaseUtil.writeMessage('Dumbpants', message, '12345');
  }
}

function spellDelayedAdd(textObj, paragraphElement, windowBody) {
  let text = textObj.spell;
  if (text.length > 0) {
    let randomCharAmount = text.indexOf("<br>") != -1 ? text.indexOf("<br>") + 4 : text.length;
    randomCharAmount = randomCharAmount <= text.length - 1 ? randomCharAmount : text.length; 
    paragraphElement.innerHTML += text.substring(0, randomCharAmount);
    textObj.spell = text.substring(randomCharAmount);
    setTimeout(() => {
      spellDelayedAdd(textObj, paragraphElement, windowBody)
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

function closeClicked(event) {
  const parentWindow = event.target.parentElement.parentElement.parentElement.parentElement;
  if (parentWindow != null && parentWindow.getAttribute('closed') == 'false') {
    parentWindow.style.display = 'none';
    parentWindow.setAttribute('closed', 'true');
  }
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
  }

  // Only open the window if it is already closed
  if (selectedWindow != null && selectedWindow.getAttribute('closed') == 'true') {
    selectedWindow.style.display = 'block';
    selectedWindow.setAttribute('closed', 'false');
    selectedWindow.querySelector('.draggable-window-input').focus();
    selectedWindow.style.zIndex = ++zIndexCounter;
    currentlyFocusedWindow = selectedWindow;
    if (selectedWindow.getAttribute('minimized') !== 'false') {
      minimizeWindow(selectedWindow, 'restore');
    } else if (selectedWindow.getAttribute('maximized') !== 'false') {
      maximizeWindow(selectedWindow, 'restore');
    }
  }
}

function globalChatUpdate(snapshot) {
  // Only update if data exists
  if (snapshot.exists()) {
    const snapshotVal = snapshot.val();
    // Update chat log with new entries only
    if (globalChatFirstLoadFlag) {
      let messageVal = snapshotVal[Object.keys(snapshotVal)[Object.keys(snapshotVal).length - 1]].message;
      switch(messageVal) {
        case 'spell:bless':
          messageVal = 'cast bless';
          break;
        case 'spell:room':
          messageVal = 'cast room';
          break;
      }
      processNewTextElement(globalChatElementRef.querySelector('.draggable-window-body'), messageVal);
    // Loading for first time
    } else {
      for (const log in snapshotVal) {
        let messageVal = snapshotVal[log].message;
        switch(messageVal) {
          case 'spell:bless':
            messageVal = 'cast bless';
            break;
          case 'spell:room':
            messageVal = 'cast room';
            break;
        }
        processNewTextElement(globalChatElementRef.querySelector('.draggable-window-body'), messageVal);
      }
      // Flip first time loaded flag
      globalChatFirstLoadFlag = true;
    }
  }
}

//------------ Run start function
devilryStart();
//document.body.addEventListener('load', devilryStart);