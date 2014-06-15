var DEBUG_MODE = true;

var w = window,
    d = document,
    e = d.documentElement,
    g = d.getElementsByTagName('body')[0],
    pageWidth = w.innerWidth || e.clientWidth || g.clientWidth,
    pageHeight = w.innerHeight || e.clientHeight || g.clientHeight;

var container = $('#robits');

var width = container.width();
var height = pageHeight - container.offset().top;

var game = new Phaser.Game(1280, height, Phaser.AUTO, 'robits', { preload: preload, create: create, update: update, render: render });

var layer, map;
var cursors;
var widthInTiles, heightInTiles, tileWidth;
var maxPlayers = 8;
var playerId = 0;
//initiate connection to server
var ignoreArrowKeys,
    _players = [];
var socket = io();
var portalTiles, checkpointTiles;
var colorScale = chroma.scale('RdYlBu');

$(function () {
    $('#chat').submit(function (e) {
        socket.emit('chat', $('#chat input').val());
        $('#chat input').val('');
        e.preventDefault();
    });

    $('#plans').submit(function (e) {
        var instructions = _.map($(this).find('.instruction'), function (command) {
            return $(command).val();
        });

        $(this).children(':first').focus();

//        _.each(instructions, function (instruction) {
//            gameData.addInstruction(gameData.localPlayer, instruction);
//        });
        socket.emit('player moves ready', instructions);
        console.log('Emitted player moves');
        e.preventDefault();
    });
});

function directionToAngle(direction) {
    switch (direction) {
        case 'right':
            return 0;
        case 'left':
            return 180;
        case 'down':
            return 90;
        case 'up':
            return 270;
        default:
            return 0;
    }
}

function preload() {
    game.load.tilemap('map', 'assets/map1.json', null, Phaser.Tilemap.TILED_JSON);
    game.load.image('tileset', 'assets/tileset.png');
    game.load.image('robot', 'assets/robot.png');
}

// Doesn't work completely right
function resizeGame() {
    var width = Math.min(map.widthInPixels, game.width);
    var height = Math.min(map.heightInPixels, game.height);

    game.width = width;
    game.height = height;
    game.stage.bounds.width = width;
    game.stage.bounds.height = height;
    game.camera.setSize(width, height);
    if (game.renderType === Phaser.WEBGL) {
        game.renderer.resize(width, height);
    }
}

function create() {
    gameData.game = game;
    window.communication.initializeSocket();

    cursors = game.input.keyboard.createCursorKeys();
    game.stage.backgroundColor = '#787878';

    map = game.add.tilemap('map');
    map.addTilesetImage('tileset');

    map.setCollision(6);
    map.setTileIndexCallback(3, goThroughPortal, this);
    map.setTileIndexCallback(4, hitCheckpoint, this);
    map.setTileIndexCallback(5, fallInHole, this);

    layer = map.createLayer('Tile Layer 1');

    layer.resizeWorld();

    game.physics.startSystem(Phaser.Physics.ARCADE);

    widthInTiles = 16;
    heightInTiles = 12;
    tileWidth = 128;

    startTiles = getTilesOfIndex(2);
    portalTiles = getTilesOfIndex(3);
    checkpointTiles = getTilesOfIndex(4);

    _.each(checkpointTiles, function(tile) {
      tile.playersTouched = [];
    });

    if(DEBUG_MODE) {
        var downButton = game.input.keyboard.addKey(Phaser.Keyboard.DOWN);
        var leftButton = game.input.keyboard.addKey(Phaser.Keyboard.LEFT);
        var upButton = game.input.keyboard.addKey(Phaser.Keyboard.UP);
        var rightButton = game.input.keyboard.addKey(Phaser.Keyboard.RIGHT);

        function proxyQueueMove(direction) {
            queueMove(gameData.localPlayer, direction)
        }

        downButton.onDown.add(_.partial(proxyQueueMove, 'down'), this);
        leftButton.onDown.add(_.partial(proxyQueueMove, 'left'), this);
        upButton.onDown.add(_.partial(proxyQueueMove, 'up'), this);
        rightButton.onDown.add(_.partial(proxyQueueMove, 'right'), this);
    }
}

function chooseStartTile() {
    var unusedTile = _.find(startTiles, function (tile) {
        return !_.some(gameData.getPlayers(), function (player) {
            return player.data.startTile.x === tile.x &&
                player.data.startTile.y === tile.y;
        });
    });

    var randomTile = startTiles[Math.floor(Math.random() * startTiles.length)];

    return unusedTile || randomTile;
}

function addPlayer(data) {

    var startTile = chooseStartTile();

    var player = game.add.sprite(0, 0, 'robot');

    player.data = _.extend({
        startTile: startTile,
        movementQueue: [],
        id: Math.random(),
        isTeleporting: false,
        checkpoints: []
    }, data);

    resetToStart(player);
    game.physics.arcade.enable(player);

    player.body.collideWorldBounds = true;
    player.body.setSize(128, 128);

    player.anchor.setTo(0.5, 0.5);

    var color = colorScale(_.size(gameData.getPlayers()) / maxPlayers);
    player.tint = parseInt(color.hex().replace("#", ""), 16);

    gameData.addPlayer(player);

    return player;
}

function addRandomPath(player) {
    _.each(_.range(Math.round(Math.random() * 25) + 25), function () {
        player.data.movementQueue.push(_.partial(moveAtAngle, player, 90 * Math.floor(Math.random() * 4)));
    });
}

// These vars are temporary & just for debugging
var firstTime = true;
var timingOut = false;

function clearTeleportFlags() {
  var BOUNDARY = 65;
  _.each(gameData.getPlayers(), function(player) {
    if(!_.some(portalTiles, function(tile) {
      return tile.intersects(player.x - BOUNDARY, player.y - BOUNDARY, player.x + BOUNDARY, player.y + BOUNDARY);
    })) {
      player.data.isTeleporting = false;
    }
  });
}

function update() {
    clearTeleportFlags();
    if (firstTime) {
        firstTime = false;
        gameData.roundReady = true
    }

    if (gameData.roundReady) {
        updateRound();
        tryRoundDone();
    } else {
        //planning stage

        /*_.each(gameData.getPlayers(), function(player) {
         addRandomPath(player);
         });

         gameData.roundReady = true;*/

        if (gameData.localPlayer && DEBUG_MODE) {
            gameData.roundReady = true;
        }
    }
}

function render() {
    if (gameData.localPlayer && DEBUG_MODE) {
        game.debug.body(gameData.localPlayer);
    }
}

function tryRoundDone() {
    var inProgress = _.some(gameData.getPlayers(), function (player) {
        return player.data.stepInProgress || player.data.movementQueue.length > 0;
    });

    if (!inProgress) {
        endRound();
        console.log("***** End of round *****")
    }
}

function updateRound() {
    _.each(gameData.getPlayers(), function (player) {
        game.physics.arcade.collide(player, layer);
        tryMovement(player);
    });
}

function endRound() {
    gameData.roundReady = false;
}

function queueMove(player, direction) {
    if (!_.isUndefined(direction)) {
        var angle = directionToAngle(direction);
        player.data.movementQueue.push(_.partial(moveAtAngle, player, angle));
    }
}

function tryMovement(player) {
    if (!player.data.stepInProgress) {
        var nextStep = player.data.movementQueue.shift();
        if (nextStep) {
            nextStep();
        }
    }
}

function moveAtAngle(player, angle) {
    player.data.stepInProgress = true;

    var distance = 128;
    var speed = 500;
    var time = distance / speed;

    this.target = [player.x + distance, player.y];

    game.physics.arcade.velocityFromAngle(angle || 0, speed, player.body.velocity);

    setTimeout(_.partial(clearSpriteMovement, player), time * 1000);
}

function hitCheckpoint(sprite, tile) {

    // only emit a player checkpoint event if it is the local player 
    // and it is not in the tiles array of players touched
  if (sprite.data.id == gameData.localPlayer.data.id && !_.contains(tile.playersTouched, sprite.data.id)) {
    console.log("player scored a checkpoint");
    tile.playersTouched.push(sprite.data.id);
      if(_.every(checkpointTiles, function(tile) { return _.contains(tile.playersTouched, sprite.data.id); })) {
          console.log("player touched last checkpoint, send win event!");
        socket.emit("player won", sprite.data.id);
      };
      // useful later if we want to update each client with the players checkpoint data
//    socket.emit("player checkpoint", sprite.data.id);
  }
}

function goThroughPortal(sprite, tile) {

  // find a random portal that is not the current portal
  // assign the sprite body x and y to that tile.
  if(!sprite.data.isTeleporting) {

    sprite.data.isTeleporting = true;
    var nextPortal = portalTiles[(portalTiles.indexOf(tile) + 1) % portalTiles.length]
    var newPosition = getTileCenter(nextPortal);
    sprite.body.x = newPosition.x - 64;
    sprite.body.y = newPosition.y - 64;

  }

  return false;
}

/**
  * Called when a sprite collides with a hole tile.
  * The sprite is returned to their starting position
  * and their movement is halted.
  */
function fallInHole(sprite, tile) {
    resetToStart(sprite);
    clearSpriteMovement(sprite);
    return false;
}

function resetToStart(sprite) {
    var position = getTileCenter(sprite.data.startTile);
    sprite.x = position.x;
    sprite.y = position.y
}

function clearSpriteMovement(sprite) {
    sprite.body.velocity.x = 0;
    sprite.body.velocity.y = 0;
    sprite.data.stepInProgress = false;
    centerOnTile(sprite);
}

function centerOnTile(sprite) {
    var tile = map.getTileWorldXY(sprite.x, sprite.y);

    var tileCenter = getTileCenter(tile);

    sprite.x = tileCenter.x;
    sprite.y = tileCenter.y;
}

function getTileCenter(tile) {
    return {x: tile.worldX + (tile.width / 2), y: tile.worldY + (tile.height / 2)};
}

function getTilesOfIndex(tileIndex) {
    return _.filter(_.flatten(layer.layer.data, true), function (tile) {
        return tile.index === tileIndex;
    });
}