const {onCall} = require('firebase-functions/v2/https');
const {logger} = require('firebase-functions');
const admin = require('firebase-admin');

exports.createRoom = onCall((request) => {
  const username = request.data.username;
  const gamemode = 'oddball'; // Change this to pull from request later if we add more gamemodes
  logger.info('Create room with gamemode ' + gamemode + ' called by username: ' + username, {structuredData: true});

  const roomPromise = new Promise((resolve, reject) => {
    // Get constants
    admin.database().ref('constants').once('value', (snapshot) => {

      const constants = snapshot.val();

      // Create random, unused, roomKey
      admin.database().ref('roomKeys').once('value', (snapshot) => {
        const roomKeys = snapshot.val();
        let roomKeyValid = true; // assume roomKey is valid
        let roomKey = '';
        // Generate roomKeys until we get a unique one
        do {
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
        } while (!roomKeyValid);

        const timestamp = Date.now();

        // Set roomKey in DB
        admin.database().ref('roomKeys/' + roomKey).set({
          timestamp: timestamp,
          gameStatus: 'lobby',
          gamemode: gamemode,
        });
        // Set room initial game status & mode
        admin.database().ref(roomKey).set({
          gameStatus: 'lobby',
          gamemode: gamemode,
        });

        // Generate map
        // 1. Initialize empty map
        // 2. Start with four way in the center of the map
        // 3. For each open door that does not already have a connecting tile,
        //    recurse down that path and create a new tile
        // 4. New tile is picked randomly from viable tiles based on weights for tile types (1,2,3,4 door)
        //    (single door rooms can't be picked for first few tiles in a path)
        // 5. When we are in a single door room, return back up the path
        // 6. Format map for database

        // 1.
        const mapWidth = constants.mapWidth;
        const mapHeight = constants.mapHeight;
        const map = [];
        for (let i = 0; i < mapHeight; i++) {
          const row = [];
          for (let j = 0; j < mapWidth; j++) {
            row.push({
              mapKey: '',
              items: [],
              features: [],
            });
          }
          map.push(row);
        }

        // 2.
        const startY = Math.floor(mapHeight / 2);
        const startX = Math.floor(mapWidth / 2);
        map[startY][startX].mapKey = 'NESW';

        // 3.
        traversePath(map, startY, startX, mapHeight, mapWidth, constants.roomTypes, constants.items, 0);

        // 6.
        const dbMap = {};
        const tileData = {};
        for (let i = 0; i < mapHeight; i++) {
          for (let j = 0; j < mapWidth; j++) {
            dbMap[i + '_' + j] = {
              mapKey: map[i][j].mapKey,
              items: {},
              features: {},
            };
            for (let k = 0; k < map[i][j].items.length; k++) {
              const item = map[i][j].items[k];
              dbMap[i + '_' + j].items[item.item] = {
                count: item.count,
              };
            }
            for (let k = 0; k < map[i][j].features.length; k++) {
              const feature = map[i][j].features[k].feature;
              const status = map[i][j].features[k].status;
              dbMap[i + '_' + j].features[feature] = {
                status: status,
              };
            }
            tileData[i + '_' + j] = {
              mapKey: map[i][j].mapKey,
              discovered: false,
            };
          }
        }

        dbMap['tileData'] = tileData;

        // Gamemode setups
        gamemodeSetup(dbMap, mapHeight, mapWidth, constants.gamemodes, gamemode);

        // Save map to DB
        admin.database().ref(roomKey + '/map').set(dbMap);

        // Save player as leader to DB
        admin.database().ref(roomKey + '/players/' + username).set({
          leader: true,
          timestamp: timestamp,
        });

        // Send roomKey back to client
        resolve({
          roomKey: roomKey,
        });
      });
    });
  });

  return roomPromise;
});

function traversePath(map, y, x, mapHeight, mapWidth, roomTypes, items, iteration) {
  const currentTile = map[y][x].mapKey;
  iteration++;

  // Get available paths
  const paths = currentTile.replace(/_/g, '').split('');

  // 5. If we are in single door room, recurse back up
  if (paths.length == 1) {
    return;
  }

  for (let i = paths.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = paths[i];
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

    // 4. Try and create tile if it doesn't already exist and is inside the map
    if (nextY >= 0 && nextY < mapHeight && nextX >= 0 && nextX < mapWidth && map[nextY][nextX].mapKey == '') {
      const availableTiles = getAvailableTiles(map, nextY, nextX, mapHeight, mapWidth, roomTypes);
      const oneDoorRooms = [];
      const twoDoorRooms = [];
      const threeDoorRooms = [];
      const fourDoorRooms = [];

      if (availableTiles.length > 0) {
        for (let j = 0; j < availableTiles.length; j++) {
          switch (availableTiles[j].replace(/_/g, '').length) {
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
        const oneDoorRange = Math.floor(Math.max((iteration * 2) - initialWeight, 0)) *
          Math.min(oneDoorRooms.length, 1);
        const twoDoorRange = Math.floor(Math.max(Math.min((iteration * 3) - initialWeight, initialWeight), 0)) *
          Math.min(twoDoorRooms.length, 1);
        const threeDoorRange = Math.floor(Math.max(initialWeight - (iteration * 2), 0)) *
          Math.min(threeDoorRooms.length, 1);
        const fourDoorRange = Math.floor(Math.max(initialWeight - (iteration * 3), 0)) *
          Math.min(fourDoorRooms.length, 1);
        const totalRange = oneDoorRange + twoDoorRange + threeDoorRange + fourDoorRange;
        let selectedTile = '';
        // Fix for if iterations are too low and not very many room options
        // Pick random from room options favoring lower door rooms first
        if (totalRange == 0) {
          if (oneDoorRooms.length > 0) {
            selectedTile = oneDoorRooms[Math.floor(Math.random() * oneDoorRooms.length)];
          } else if (twoDoorRooms.length > 0) {
            selectedTile = twoDoorRooms[Math.floor(Math.random() * oneDoorRooms.length)];
          } else if (threeDoorRooms.length > 0) {
            selectedTile = threeDoorRooms[Math.floor(Math.random() * oneDoorRooms.length)];
          } else if (fourDoorRooms.length > 0) {
            selectedTile = fourDoorRooms[Math.floor(Math.random() * oneDoorRooms.length)];
          }
        } else {
          const randomSelection = Math.floor(Math.random() * totalRange);
          if (randomSelection < oneDoorRange) {
            selectedTile = oneDoorRooms[Math.floor(Math.random() * oneDoorRooms.length)];
          } else if (randomSelection < (oneDoorRange + twoDoorRange)) {
            selectedTile = twoDoorRooms[Math.floor(Math.random() * oneDoorRooms.length)];
          } else if (randomSelection < (oneDoorRange + twoDoorRange + threeDoorRange)) {
            selectedTile = threeDoorRooms[Math.floor(Math.random() * oneDoorRooms.length)];
          } else {
            selectedTile = fourDoorRooms[Math.floor(Math.random() * oneDoorRooms.length)];
          }
        }

        // Assign tile in map
        map[nextY][nextX].mapKey = selectedTile;

        // Room feature generation
        featureGeneration(map, nextY, nextX, mapHeight, mapWidth, iteration);

        // Item generation
        itemGeneration(map, nextY, nextX, mapHeight, mapWidth, items, iteration);

        // Recurse down the next tile's path
        traversePath(map, nextY, nextX, mapHeight, mapWidth, roomTypes, items, iteration);
      }
    }
  }

  // After done recursing all paths for this room, recurse back up
  return;
}

function getAvailableTiles(map, y, x, mapHeight, mapWidth, roomTypes) {
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
  if ((y - 1) >= 0 && map[y - 1][x].mapKey.includes('S')) {
    hasToHaveNorth = true;
    searchTerms.push('N');
  } else if ((y - 1) >= 0 && (!map[y - 1][x].mapKey)) {
    searchTerms.push('N');
  } else {
    notSearchTerms.push('N');
  }

  if ((x + 1) < mapWidth && map[y][x + 1].mapKey.includes('W')) {
    hasToHaveEast = true;
    searchTerms.push('E');
  } else if ((x + 1) < mapWidth && (!map[y][x + 1].mapKey)) {
    searchTerms.push('E');
  } else {
    notSearchTerms.push('E');
  }

  if ((y + 1) < mapHeight && map[y + 1][x].mapKey.includes('N')) {
    hasToHaveSouth = true;
    searchTerms.push('S');
  } else if ((y + 1) < mapHeight && (!map[y + 1][x].mapKey)) {
    searchTerms.push('S');
  } else {
    notSearchTerms.push('S');
  }

  if ((x - 1) >= 0 && map[y][x - 1].mapKey.includes('E')) {
    hasToHaveWest = true;
    searchTerms.push('W');
  } else if ((x - 1) >= 0 && (!map[y][x - 1].mapKey)) {
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

function featureGeneration(map, y, x, mapHeight, mapWidth, iteration) {

}

function itemGeneration(map, y, x, mapHeight, mapWidth, items, iteration) {
  // For each type of item, roll for spawn based on rarity chance.
  // Multiple rolls based on tryCount
  for (const item in items) {
    if (!items[item]['noSpawn']) {
      const rarity = items[item].rarity;
      const rollCount = ('rollCount' in items[item]) ? items[item].rollCount : 1;
      let spawnCount = 0;
      for (let i = 0; i < rollCount; i++) {
        // Roll 0-100
        const roll = Math.floor(Math.random() * 101);
        // If rarity is greater than the roll, spawn the item in that tile
        if (rarity >= roll) {
          spawnCount++;
        }
      }
      if (spawnCount > 0) {
        map[y][x].items.push({
          item: item,
          count: spawnCount,
        });
      }
    }
  }
}

function gamemodeSetup(dbMap, mapHeight, mapWidth, gamemodeConstants, gamemode) {
  switch (gamemode) {
    case 'oddball':
      const oddballConstants = gamemodeConstants.oddball;
      let oddballSpawned = false;
      while (!oddballSpawned) {
        const oddballSpawnY = Math.floor(Math.random() * mapHeight);
        const oddballSpawnX = Math.floor(Math.random() * mapWidth);
        const startingSpaceY = Math.floor(mapHeight / 2);
        const startingSpaceX = Math.floor(mapWidth / 2);
        const oddballDistanceY = Math.abs(startingSpaceY - oddballSpawnY);
        const oddballDistanceX = Math.abs(startingSpaceX - oddballSpawnX);

        // If tile is valid and greater than or equal to the minimum starting spawn distance,
        // Then spawn the oddball and mark tile as having oddball
        if (dbMap['tileData'][oddballSpawnY + '_' + oddballSpawnX].mapKey &&
            (oddballDistanceY + oddballDistanceX) >= oddballConstants.minimumStartingSpawnDistance
        ) {
          dbMap[oddballSpawnY + '_' + oddballSpawnX]['items']['oddball'] = {
            count: 1,
          };
          dbMap['tileData'][oddballSpawnY + '_' + oddballSpawnX]['hasOddball'] = true;
          oddballSpawned = true;
        }
      }
      break;
  }
}
