window.map = exports = {
  init: init,
  preload: preload,
  create: create,
  centerOnTile: centerOnTile,
  getTileCenter: getTileCenter,
  getCheckpointsTouched: function(player) {
    return _.filter(map.checkpointTiles, function(tile) {
      return _.contains(tile.playersTouched, player.data.id)
    });
  },
  assignedStartTiles: {},
  getMapScaleAsNumber: getMapScaleAsNumber
};

function init() {
  var w = window,
    d = document,
    e = d.documentElement,
    g = d.getElementsByTagName('body')[0],
    pageWidth = w.innerWidth || e.clientWidth || g.clientWidth,
    pageHeight = w.innerHeight || e.clientHeight || g.clientHeight;

  var container = $('#robits');

  var mapWidth = 1280;
  var mapHeight = 1280;

  map.width = Math.min(pageWidth - container.offset().left, mapWidth);
  map.height = Math.min(pageHeight - container.offset().top, mapHeight);
}

function preload(game) {
  // For maps 1 and 2
  //mapScale = chooseMapScale(1280, 1280);
  // For Map 3
  map.scale = chooseMapScale(3200, 3200);

  game.load.tilemap('map', 'assets/maps/map3_'+map.scale+'.json', null, Phaser.Tilemap.TILED_JSON);
  game.load.image('standard_tiles', 'assets/standard_tiles_'+map.scale+'.png');
}

function create(game) {
  var tilemap = map.tilemap = game.add.tilemap('map');

  tilemap.addTilesetImage('standard_tiles');

  tilemap.setCollision(6);
  // todo is the this still correct?
  tilemap.setTileIndexCallback(3, collisions.goThroughPortal, this);
  tilemap.setTileIndexCallback(4, collisions.hitCheckpoint, this);
  tilemap.setTileIndexCallback(5, collisions.fallInHole, this);


  map.layer = tilemap.createLayer('Tile Layer 1');
  map.layer.resizeWorld();

  map.startTiles = getTilesOfIndex(2);
  map.portalTiles = getTilesOfIndex(3);
  map.checkpointTiles = getTilesOfIndex(4);

  _.each(map.checkpointTiles, function(tile) {
    tile.playersTouched = [];
  });
}

function getTileCenter(tile) {
  return {x: tile.worldX + (tile.width / 2), y: tile.worldY + (tile.height / 2)};
}

function getTilesOfIndex(tileIndex) {
  return _.filter(_.flatten(map.layer.layer.data, true), function (tile) {
    return tile.index === tileIndex;
  });
}

function centerOnTile(sprite, tile) {
  tile = tile || map.tilemap.getTileWorldXY(sprite.x, sprite.y);

  var tileCenter = getTileCenter(tile);

  sprite.x = tileCenter.x;
  sprite.y = tileCenter.y;
}

function getMapScaleAsNumber(mapScale) {
  switch(mapScale) {
    case 'QUARTER': return 0.25;
    case 'HALF': return 0.5;
    default: return 1;
  }
}

function chooseMapScale(mapWidthAtScale, mapHeightAtScale) {
  var screenWidthsAcross = mapWidthAtScale / map.width;
  var screenHeightsAcross = mapHeightAtScale / map.height;
  var meanScreensAcross = (screenHeightsAcross + screenWidthsAcross) / 2;

  if(meanScreensAcross < 1.5) {
    return 'FULL';
  } else if(meanScreensAcross < 3) {
    return 'HALF';
  } else {
    return 'QUARTER';
  }
}