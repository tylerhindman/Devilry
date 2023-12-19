let draggedWindow = null;
let resizedAnchor = null;
let draggedWindowOffsetX = 0;
let draggedWindowOffsetY = 0;
let resizedWindowStartX = 0;
let resizedWindowStartY = 0;
let resizedMouseStartX = 0;
let resizedMouseStartY = 0;

let windowsList = null;
let zIndexCounter = 0;
let currentlyFocusedWindow = null;

const initWindows = 4;

function devilryStart(startEvent) {
  // ---------- Init window setup
  for (let i = 0; i < initWindows; i++) {
    const newWindowNode = document.getElementById('draggableWindowTemplate').content.cloneNode(true);
    const newWindowElement = newWindowNode.lastElementChild;
    newWindowElement.id = 'draggableWindow-' + i;
    newWindowElement.style.top = (50 + (i * 50)) + 'px';
    newWindowElement.style.left = (50 + (i * 50)) + 'px';
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
    windowInput.addEventListener('keyup', function(event) {
      if ((event.key === 'Enter' || event.keyCode === 13) && event.target.value) {
        const windowBody = windowInput.parentElement.parentElement.querySelector('.draggable-window-body');
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

        const textNode = document.createTextNode(event.target.value);
        textSpan.appendChild(textNode);
        textSpan.className = 'log-entry-text';

        p.appendChild(metaSpan);
        p.appendChild(textSpan);
        p.className = 'log-entry-parent';
        windowBody.appendChild(p);
        windowInput.value = '';
      }
    });
  }

  // ----- Pull focused window to the top
  for (var i = 0; i < windowsList.length; i++) {
    const focusedWindow = windowsList.item(i);
    focusedWindow.addEventListener('click', function (event) {
      if (currentlyFocusedWindow == null || currentlyFocusedWindow.id != focusedWindow.id) {
        focusedWindow.style.zIndex = ++zIndexCounter;
        focusedWindow.querySelector('.draggable-window-input').focus();
        currentlyFocusedWindow = focusedWindow;
      }
    });
  }
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