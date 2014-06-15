var DEBUG_MODE = true;

var w = window,
    d = document,
    e = d.documentElement,
    g = d.getElementsByTagName('body')[0],
    width = w.innerWidth || e.clientWidth || g.clientWidth,
    height = w.innerHeight || e.clientHeight || g.clientHeight;

var game = new Phaser.Game(width, height, Phaser.AUTO, 'robits', { preload: preload, create: create, update: update, render: render });
var localPlayer, layer, map, startTiles;
var cursors;
var widthInTiles, heightInTiles, tileWidth;
var maxPlayers = 8;
var playerId = 0;
//initiate connection to server
var ignoreArrowKeys,
    players = {},
    roundReady;
var socket = io();
var layer, portalLayer;
var colorScale = chroma.scale('RdYlBu');

$(function () {
    $('#plans').submit(function (e) {
        var instructions = _.map($(this).find('.instruction'), function (command) {
            return $(command).val();
        });

        _.each(instructions, function (instruction) {
            addInstruction(localPlayer, instruction);
        });

        roundReady = true;

        e.preventDefault();
    });
});

function addInstruction(player, instruction) {
    player.data.movementQueue.push(_.partial(moveAtAngle, player, directionToAngle(instruction)));
}

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

function getPlayers() {
    return _.values(players);
}

function preload() {
    game.load.tilemap('map', 'assets/map1.json', null, Phaser.Tilemap.TILED_JSON);
    game.load.image('tileset', 'assets/tileset.png');
    game.load.image('robot', 'assets/robot.png');
}

function create() {

    setUpSocketReceivers();
    cursors = game.input.keyboard.createCursorKeys();
    game.stage.backgroundColor = '#787878';

    map = game.add.tilemap('map');
    map.addTilesetImage('tileset');

    map.setCollision(6);
    map.setTileIndexCallback(3, goThroughPortal, this);
    map.setTileIndexCallback(5, fallInHole, this);

    layer = map.createLayer('Tile Layer 1');

    layer.resizeWorld();

    game.world.setBounds(0, 0, map.width, map.height);

    game.physics.startSystem(Phaser.Physics.ARCADE);

    widthInTiles = 16;
    heightInTiles = 12;
    tileWidth = 128;

    startTiles = getTilesOfIndex(2);

    if(DEBUG_MODE) {
        var downButton = game.input.keyboard.addKey(Phaser.Keyboard.DOWN);
        var leftButton = game.input.keyboard.addKey(Phaser.Keyboard.LEFT);
        var upButton = game.input.keyboard.addKey(Phaser.Keyboard.UP);
        var rightButton = game.input.keyboard.addKey(Phaser.Keyboard.RIGHT);

        function proxyQueueMove(direction) {
            queueMove(localPlayer, direction)
        }
        downButton.onDown.add(_.partial(proxyQueueMove, 'down'), this);
        leftButton.onDown.add(_.partial(proxyQueueMove, 'left'), this);
        upButton.onDown.add(_.partial(proxyQueueMove, 'up'), this);
        rightButton.onDown.add(_.partial(proxyQueueMove, 'right'), this);
    }
}

function removePlayer(id) {
    var player = _.find(getPlayers(), function (player) {
        return player.data.id === id;
    });

    delete players[player.data.id];

    player.destroy();
}

function someCallback(sprite, layer) {
    console.log("you collided with a portal");
}

function chooseStartTile() {
    var unusedTile = _.find(startTiles, function(tile) {
        return !_.some(players, function(player) {
            return player.data.startTile.x === tile.x &&
                player.data.startTile.y === tile.y;
        });
    });

    var randomTile = startTiles[Math.floor(Math.random() * startTiles.length)];

    console.log(unusedTile);

    return unusedTile || randomTile;
}

function addPlayer(data) {

    var startTile = chooseStartTile();

    var player = game.add.sprite(0, 0, 'robot');

    player.data = _.extend({
        startTile: startTile,
        movementQueue: [],
        id: Math.random()
    }, data);

    resetToStart(player);
    game.physics.arcade.enable(player);

    player.body.collideWorldBounds = true;
    player.body.setSize(128, 128); //TODO set to 128x128 once we have perfect movement

    player.anchor.setTo(0.5, 0.5);

    var color = colorScale(_.size(getPlayers()) / maxPlayers);
    player.tint = parseInt(color.hex().replace("#", ""), 16);

    players[player.data.id] = player;

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
function update() {
    if (firstTime) {
        firstTime = false;
        roundReady = true
    }

    if (roundReady) {
        updateRound();
        tryRoundDone();
    } else {
        //planning stage

        /*_.each(getPlayers(), function(player) {
         addRandomPath(player);
         });

         roundReady = true;*/

        if (localPlayer && DEBUG_MODE) {
            roundReady = true;
        }
    }
}

function render() {
    if(localPlayer && DEBUG_MODE) {
        game.debug.body(localPlayer);
    }
}

function tryRoundDone() {
    var inProgress = _.some(getPlayers(), function (player) {
        return player.data.stepInProgress || player.data.movementQueue.length > 0;
    });

    if (!inProgress) {
        endRound();
        console.log("***** End of round *****")
    }
}

function updateRound() {
    _.each(getPlayers(), function (player) {
        game.physics.arcade.collide(player, layer);
        tryMovement(player);
    });
}

function endRound() {
    roundReady = false;
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

function setPlayerReady() {
    socket.emit("player ready", localPlayer.data);
}

function disconnect() {
    socket.emit("player left", playerId);
}

function playerMoved() {
    socket.emit("player moved", 0)
}

function playerDied() {
    socket.emit("player died", playerId)
}

function playerConnected(playerId) {
    addPlayer({id: playerId});
}

function playerWins(playerId) {
    alert("Game Over: " + playerId + " wins!");
}

function syncPlayerList(newPlayerList) {
    _.each(getPlayers(), function removeIfMissing(player) {
        var playerDisappeared = !_.some(newPlayerList, function (newPlayer) {
            return newPlayer.playerId === player.data.id;
        });

        if (playerDisappeared) {
            removePlayer(player.data.id);
            console.log("Removing player " + player.data.id)
        }
    });

    _.each(newPlayerList, function addIfMissing(newPlayer) {
        var playerIsNew = !_.some(getPlayers(), function (player) {
            return player.data.id === newPlayer.playerId;
        });

        if (playerIsNew) {
            addPlayer({id: newPlayer.playerId});
            console.log("Adding player " + newPlayer.playerId)
        }
    });
}

function setUpSocketReceivers() {
    socket.on('player won', playerWins);

    socket.on('players changed', syncPlayerList);

    socket.on("update", function () {
        //probably list of all players and current positions.
    });

    socket.on('receive id', function (playerId) {
        console.log('I got my id it is: ' + playerId);

        localPlayer = addPlayer({id: playerId});
        setPlayerReady(localPlayer);

        game.camera.follow(localPlayer);
    });
}

function goThroughPortal(sprite, tile) {
    console.log("going through portal!");
    //teleport to other portal
    return false;
}

function fallInHole(sprite, tile) {
    console.log("fell in hole!");
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
    return _.filter(_.flatten(layer.layer.data, true), function(tile) {
        return tile.index === tileIndex;
    });
}