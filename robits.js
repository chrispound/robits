var DEBUG_MODE = false;

map.init();

var game = new Phaser.Game(map.width, map.height, Phaser.AUTO, 'robits', { preload: preload, create: create, update: update, render: render });

var _players = [];
var socket = io();
var colorScale = chroma.scale('RdYlBu');

window.communication.initializeSocket();

var sound = new Howl({
    autoplay: (settings.musicOn === 'true'),
    buffer: false,
    urls: ['assets/soundtrack.mp3'],
    loop: true,
    volume: 0.5
});

var camera_position;

function preload() {
    map.preload(game);

    game.load.image('robot', 'assets/robot_'+map.scale+'.png');
    game.load.image('energy', 'assets/ic_battery_mockup.png');
}


function create() {
    map.create(game);

    gameData.game = game;

    game.stage.backgroundColor = '#787878';

    game.physics.startSystem(Phaser.Physics.ARCADE);

    var localPlayerSetup = $.Deferred();

    gameData.serverSetup.then(function() {
        $('#player-name').val(settings.localPlayerName || gameData.localPlayerId);
        gameData.localPlayer = addPlayer({id: gameData.localPlayerId, name: settings.localPlayerName});
        gameData.game.camera.follow(gameData.localPlayer);
        gameData.localPlayer.inputEnabled = true;
        gameData.localPlayer.events.onInputDown.add(function(){
            if(gameData.game.camera.target === gameData.localPlayer) {
                gameData.game.camera.unfollow();
            } else {
                gameData.game.camera.follow(gameData.localPlayer);
            }
        }, this);

        localPlayerSetup.resolve();
    });

    localPlayerSetup.then(function(){
        communication.localPlayerSetupComplete();
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

    localPlayerSetup.then(function() {
        gameData.clientSetup.resolve();
    });

}

function update() {
    moveCamera(game.input.mousePointer);
    moveCamera(game.input.pointer1);

    clearTeleportFlags();
    if (firstTime) {
        firstTime = false;
        gameData.roundReady = true
    }

    if (gameData.roundReady) {
        if(gameData.roundPending) {
            gameData.game.camera.follow(gameData.localPlayer);
            gameData.roundPending = false;
        }
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

function chooseStartTile(playerId) {
    var alreadyDefinedTile = gameData.assignedStartTiles[playerId];
    if(alreadyDefinedTile) {
        return map.getTile(alreadyDefinedTile.x, alreadyDefinedTile.y);
    }

    var unusedTile = _.find(map.startTiles, function (tile) {
        return !_.some(gameData.assignedStartTiles, function(assignedTile) {
            return tile.x === assignedTile.x && tile.y === assignedTile.y;
        });
        /*return !_.some(gameData.getPlayers(), function (player) {
            return player.data.startTile.x === tile.x &&
                player.data.startTile.y === tile.y;
        });*/
    });

    var randomTile = map.startTiles[Math.floor(Math.random() * map.startTiles.length)];

    return unusedTile || randomTile;
}

function addPlayer(overwriteData) {

    var player = game.add.sprite(0, 0, 'robot');

    player.data = _.extend({
        movementQueue: [],
        id: Math.random(),
        isTeleporting: false,
        checkpoints: []
    }, overwriteData);

    player.data.startTile = chooseStartTile(player.data.id);
    player.health = 5;

    resetToStart(player);
    game.physics.arcade.enable(player);

    player.body.collideWorldBounds = true;
    var firstTile = map.tilemap.getTile(0, 0);
    player.body.setSize(firstTile.width, firstTile.height);

    player.anchor.setTo(0.5, 0.5);

    var color = colorScale(getLowDiscrepancyNumber(_.size(gameData.getPlayers())));
    player.tint = parseInt(color.hex().replace("#", ""), 16);

    gameData.addPlayer(player);
    gameData.updatePlayerHealth(player);
    return player;
}

/* Generates the sequence 0, 1, 1/2, 1/4, 3/4, 1/8, 3/8, ... */
function getLowDiscrepancyNumber(n) {
    if(n === 0 || n === 1) {
        return n;
    }
    var accountedFor = [0, 1];

    var lastResult;
    while(accountedFor.length - 1 < n) {
        lastResult = getNext(accountedFor.length);
        accountedFor.push(lastResult);
        accountedFor.sort();
    }

    return lastResult;

    function getNext(n) {
        var maxDist = 0, winner;
        for(var i = 0; i < accountedFor.length - 1; i++) {
            var distFromHereToNext = accountedFor[i+1] - accountedFor[i];

            if(distFromHereToNext > maxDist) {
                maxDist = distFromHereToNext;
                winner = i;
            }
        }

        return (accountedFor[winner + 1] + accountedFor[winner]) / 2;
    }
}

function addRandomPath(player) {
    _.each(_.range(Math.round(Math.random() * 25) + 25), function () {
        player.data.movementQueue.push(_.partial(moveAtAngle, player, 90 * Math.floor(Math.random() * 4)));
    });
}

// These vars are temporary & just for debugging
var firstTime = true;

function clearTeleportFlags() {
  var BOUNDARY = 65;
  _.each(gameData.getPlayers(), function(player) {
    if(!_.some(map.portalTiles, function(tile) {
      return tile.intersects(player.x - BOUNDARY, player.y - BOUNDARY, player.x + BOUNDARY, player.y + BOUNDARY);
    })) {
      player.data.isTeleporting = false;
    }
  });
}

// Borrowed from http://www.html5gamedevs.com/topic/2410-drag-the-camera/?p=39215
function moveCamera(cursor) {
    if (!cursor.timeDown) { return; }
    if (cursor.isDown && !cursor.targetObject) {
        if(gameData.game.camera.target) {
            gameData.game.camera.unfollow();
        }

        if (camera_position) {
            game.camera.x += camera_position.x - cursor.position.x;
            game.camera.y += camera_position.y - cursor.position.y;
        }
        camera_position = cursor.position.clone();
    }
    if (cursor.isUp) { camera_position = null; }
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
        game.physics.arcade.collide(player, map.layer);
        tryMovement(player);
    });
}

function endRound() {
    gameData.roundReady = false;
    gameData.roundPending = true;
    hud.displayPossibleMoves();
}

function queueMove(player, direction) {
    if (!_.isUndefined(direction)) {
        var angle = directionToAngle(direction);
        player.data.movementQueue.push(_.partial(moveAtAngle, player, angle));
    }
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

    var distance = map.tilemap.getTile(0, 0).width;
    var speed = 350 * map.getMapScaleAsNumber();
    var time = distance / speed;

    this.target = [player.x + distance, player.y];

    game.physics.arcade.velocityFromAngle(angle || 0, speed, player.body.velocity);

    setTimeout(_.partial(clearSpriteMovement, player), time * 1000);
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
    if(!sprite.alive){
        sprite.data.movementQueue = [];
    }
    centerOnTile(sprite);
}