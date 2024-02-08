const {onRequest} = require("firebase-functions/v2/https");
const {logger} = require("firebase-functions");
const admin = require("firebase-admin");

exports.createRoom = onRequest((request, response) => {
  const username = request.data.username;
  logger.info("Create room called by username: " + username, {structuredData: true});

  // Get constants
  admin.database().ref('constants').once('value', (snapshot) => {

    const constants = snapshot.val();

    // Create random, unused, roomKey
    admin.database().ref('roomKeys').once('value', (snapshot) => {
      const roomKeys = snapshot.val();
      let roomKeyValid = true; // assume roomKey is valid
      let roomKey = '';
      // Generate roomKeys until we get a unique one
      while (!roomKeyValid) {
        roomKey = '';
        for (let i = 0; i < 4; i++) {
          roomKey += Math.floor(Math.random() * 36).toString(36).toUpperCase();
        }
        
        for (const k in roomKeys) {
          // Gereated roomkey matches one in database, it is invalid
          if (roomKey == k) {
            roomKeyValid = false;
            break;
          }
        }
      }

      // Generate map
      // 1. Initialize empty map
      // 2. Start with four way in the center of the map
      // 3. For each open door that does not already have a connecting tile, recurse down that path and create a new tile
      // 4. New tile is picked randomly from viable tiles based on weights for tile types (1,2,3,4 door) (single door rooms can't be picked for first 3 tiles in a path)
      // 5. When we are in a single door room, return back up the path

      // 1.
      const mapWidth = constants.mapWidth;
      const mapHeight = constants.mapHeight;
      const map = [];
      for (let i = 0; i < mapHeight; i++) {
        const row = [];
        for (let j = 0; j < mapWidth; j++) {
          row.push('');
        }
        map.push(row);
      }

      // 2.
      let startY = Math.ceil(mapHeight / 2);
      let startX = Math.ceil(mapWidth / 2);
      map[startY][startX] = 'NESW';

      // 3.
      traversePath(map, startY, startX, mapHeight, mapWidth, constants.roomTypes, 0);



      response.send("Hello from Firebase!");
    });
  });
});

function traversePath (map, y, x, mapHeight, mapWidth, roomTypes, iteration) {
  const currentTile = map[y][x];
  iteration++;
  
  // Get available paths
  const paths = currentTile.replace('_','').split('');

  // If we are in single door room, recurse back up
  if (paths.length == 1) {
    return;
  }

  for (var i = paths.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = paths[i];
      paths[i] = paths[j];
      paths[j] = temp;
  }

  for (let i = 0; i < paths.length; i++) {
    let nextY = y;
    let nextX = x;
    switch (paths[i]) {
      case 'N':
        nextY--;
        break;
      case 'E':
        nextX++;
        break;
      case 'S':
        nextY++;
        break;
      case 'W':
        nextX--;
        break;
    }

    // Try and create tile if it doesn't already exist
    if (map[nextY][nextX] != '') {
      let availableTiles = getAvailableTiles(map, nextY, nextX, mapHeight, mapWidth, roomTypes);
      const oneDoorRooms = [];
      const twoDoorRooms = [];
      const threeDoorRooms = [];
      const fourDoorRooms = [];

      if (availableTiles.length > 0) {
        for (let j = 0; j < availableTiles.length; j++) {
          switch(availableTiles[j].replace('_','').length) {
            case 1:
              oneDoorRooms.push(availableTiles[j]);
              break;
            case 2:
              twoDoorRooms.push(availableTiles[j]);
              break;
            case 3:
              threeDoorRooms.push(availableTiles[j]);
              break;
            case 4:
              fourDoorRooms.push(availableTiles[j]);
              break;
          }
        }

        // Distribute random range selection across 0-100 between room types based on initial weights and iterations
        const initialWeight = 12;
        const oneDoorRange = Math.floor(Math.max((iteration * 2) - initialWeight, 0));
        const twoDoorRange = Math.floor(Math.max(Math.min((iteration * 3) - initialWeight, initialWeight), 0));
        const threeDoorRange = Math.floor(Math.max(initialWeight - (iteration * 2), 0));
        const fourDoorRange = Math.floor(Math.max(initialWeight - (iteration * 3), 0));
        const totalRange = oneDoorRange + twoDoorRange + threeDoorRange + fourDoorRange;
        const randomSelection = Math.floor(Math.random() * totalRange);
        let selectedTile = '';
        if (randomSelection < oneDoorRange) {
          selectedTile = oneDoorRooms[Math.floor(Math.random() * oneDoorRooms.length)];
        } else if (randomSelection < (oneDoorRange + twoDoorRange)) {
          selectedTile = twoDoorRooms[Math.floor(Math.random() * oneDoorRooms.length)];
        } else if (randomSelection < (oneDoorRange + twoDoorRange + threeDoorRange)) {
          selectedTile = threeDoorRooms[Math.floor(Math.random() * oneDoorRooms.length)];
        } else {
          selectedTile = fourDoorRooms[Math.floor(Math.random() * oneDoorRooms.length)];
        }

        // Assign tile in map
        map[nextY][nextX] = selectedTile;

        // Recurse down the next tile's path
        traversePath(map, nextY, nextX, mapHeight, mapWidth, roomTypes, iteration);
      }
    }
  }

  // After done recursing all paths for this room, recurse back up
  return;
}

function getAvailableTiles (map, y, x, mapHeight, mapWidth, roomTypes) {
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
  if ((y - 1) >= 0 && map[y - 1][x].includes('S')) {
    hasToHaveNorth = true;
    searchTerms.push('N');
  } else if ((y - 1) >= 0 && (!map[y - 1][x])) {
    searchTerms.push('N');
  } else {
    notSearchTerms.push('N');
  }

  if ((x + 1) < mapWidth && map[y][x + 1].includes('W')) {
    hasToHaveEast = true;
    searchTerms.push('E');
  } else if ((x + 1) < mapWidth && (!map[y][x + 1])) {
    searchTerms.push('E');
  } else {
    notSearchTerms.push('E');
  }
  
  if ((y + 1) < mapHeight && map[y + 1][x].includes('N')) {
    hasToHaveSouth = true;
    searchTerms.push('S');
  } else if ((y + 1) < mapHeight && (!map[y + 1][x])) {
    searchTerms.push('S');
  } else {
    notSearchTerms.push('S');
  }

  if ((x - 1) >= 0 && map[y][x - 1].includes('E')) {
    hasToHaveWest = true;
    searchTerms.push('W');
  } else if ((x - 1) >= 0 && (!map[y][x - 1])) {
    searchTerms.push('W');
  } else {
    notSearchTerms.push('W');
  }
  
  // Use search terms to gather list of tiles to choose from
  const viableTiles = [];
  const allTiles = Object.keys(roomTypes);
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

  return viableTiles;
}