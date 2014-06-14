var DEBUG_MODE = true;

var w = window,
    d = document,
    e = d.documentElement,
    g = d.getElementsByTagName('body')[0],
    width = w.innerWidth || e.clientWidth || g.clientWidth,
    height = w.innerHeight || e.clientHeight || g.clientHeight;

var game = new Phaser.Game(width, height, Phaser.AUTO, 'robits', { preload: preload, create: create, update: update, render: render });
var localPlayer, board, map;
var cursors;
var widthInTiles, heightInTiles, tileWidth;
var maxPlayers = 8;
var playerId = 0;
//initiate connection to server
var ignoreArrowKeys,
    players = [],
    roundReady;
var socket = io();
var layer, portalLayer;
var colorScale = chroma.scale('RdYlBu');

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
}

function removePlayer(id) {
    var player = _.find(players, function (player) {
        return player.data.id = id;
    });

    player.destroy();
}

function someCallback(sprite, layer) {
  console.log("you collided with a portal");
}

function addPlayer(data) {
    var player = game.add.sprite(64 + 64 * Math.round(Math.random() * 3), 64 + 64 * Math.round(Math.random() * 3), 'robot');
    game.physics.arcade.enable(player);

    player.data = _.extend({
        movementQueue: [],
        id: Math.random()
    }, data);

    _.each(_.range(Math.round(Math.random() * 25) + 25), function () {
        player.data.movementQueue.push(_.partial(moveAtAngle, player, 90 * Math.floor(Math.random() * 4)));
    });

    player.body.collideWorldBounds = true;
    player.body.setSize(100, 100); //TODO set to 128x128 once we have perfect movement

    player.anchor.setTo(0.5, 0.5);

    var color = colorScale(players.length / maxPlayers);
    player.tint = parseInt(color.hex().replace("#", ""), 16);

    players.push(player);

    return player;
}

// These vars are temporary & just for debugging
var firstTime = true;
var timingOut = false;
function update() {
    if(firstTime) {
        firstTime = false;
        roundReady = true
    }

    if(roundReady) {
        updateRound();
        tryRoundDone();
    } else {
        //planning stage

        if (localPlayer && DEBUG_MODE) {
            queueMovesWithArrowKeys(localPlayer);

            if(!timingOut) {
                timingOut = true;
                setTimeout(function() {
                    timingOut = false;
                    if(localPlayer.data.movementQueue.length > 0) {
                        roundReady = true;
                    }
                }, 3000);
            }
        }
    }
}

function render() {
    if(localPlayer && DEBUG_MODE) {
        game.debug.body(localPlayer);
    }
}

function tryRoundDone() {
    var inProgress = _.some(players, function(player) {
        return player.data.stepInProgress || player.data.movementQueue.length > 0;
    });

    if(!inProgress) {
        endRound();
    }
}

function updateRound() {
    _.each(players, function (player) {
        game.physics.arcade.collide(player, layer);
        tryMovement(player);
    });
}

function endRound() {
    roundReady = false;
}

function queueMovesWithArrowKeys(player) {
    if (!ignoreArrowKeys) {
        var angle;
        if (cursors.right.isDown) {
            angle = 0;
        } else if (cursors.left.isDown) {
            angle = 180;
        } else if (cursors.down.isDown) {
            angle = 90;
        } else if (cursors.up.isDown) {
            angle = 270;
        }
        if (!_.isUndefined(angle)) {
            player.data.movementQueue.push(_.partial(moveAtAngle, player, angle));
        }
        ignoreArrowKeys = true;
        setTimeout(function () {
            ignoreArrowKeys = false;
        }, 50);
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

function setUpSocketReceivers() {
    socket.on('player won', playerWins);

    socket.on('player joined', playerConnected);

    socket.on('player left', removePlayer);

    socket.on("update", function () {
        //probably list of all players and current positions.
    });

    socket.on('receive id', function (playerId) {
        console.log('I got my id it is: ' + playerId)

        localPlayer = addPlayer({id: playerId});

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
  // player reset
  sprite.body.x = 0;
  sprite.body.y = 0;
  clearSpriteMovement(sprite);
  return false;
}

function clearSpriteMovement(sprite) {
  sprite.body.velocity.x = 0;
  sprite.body.velocity.y = 0;
  sprite.data.stepInProgress = false;
}