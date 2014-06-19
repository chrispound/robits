var DEBUG_MODE = false;

var w = window,
    d = document,
    e = d.documentElement,
    g = d.getElementsByTagName('body')[0],
    pageWidth = w.innerWidth || e.clientWidth || g.clientWidth,
    pageHeight = w.innerHeight || e.clientHeight || g.clientHeight;

var container = $('#robits');

var width = container.width();
var height = pageHeight - container.offset().top;

var game = new Phaser.Game(Math.min(width, 1280), Math.min(height, 1280), Phaser.AUTO, 'robits', { preload: preload, create: create, update: update, render: render });

var layer, map;
var cursors;
var widthInTiles, heightInTiles, tileWidth;
var maxPlayers = 8;

var _players = [];
var socket = io();
var portalTiles, startTiles;
var colorScale = chroma.scale('RdYlBu');

window.communication.initializeSocket();

var sound = new Howl({
    autoplay: (settings.musicOn === 'true'),
    buffer: true,
    urls: ['assets/soundtrack.mp3'],
    loop: true,
    volume: 0.5
});

var MOVES_PER_TURN = 5;
var camera_position;

$(function () {
    $('#chat').submit(function (e) {
        var $chat = $('#chat');
        socket.emit('chat', $chat.find('input').val());
        $chat.find('input').val('');
        e.preventDefault();
    });

    if(DEBUG_MODE) {
      $('#possible-moves').hide();
    }

    $('#submit-moves').click(function(e) {
        var instructions = _.map($('#chosen-moves').find('.instruction'), function (command) {
            return $(command).find('img').data().move;
        });
        if(instructions.length != MOVES_PER_TURN) {
          alert('Must select 5 evil moves!');
        } else {
          _.each(instructions, function (instruction) {
            gameData.addInstruction(gameData.localPlayer, instruction);
          });

          communication.localPlayerReady();
        }

        e.preventDefault();
    });

    $('#config').submit(function(e) {
        gameData.localPlayer.data.name = $('#player-name').val();
        settings.updateSetting('localPlayerName', gameData.localPlayer.data.name);

        communication.localPlayerUpdated();

        e.preventDefault();
    });

    //debugger;
    $('#audio')
        .prop('checked', (settings.musicOn === 'true'))
        .change(function(e) {
        if($(this).is(':checked')) {
          sound.play();
          sound.fade(0, 0.5, 1000);
          settings.updateSetting('musicOn', true);
        } else {
          sound.fade(0.5, 0, 1000, function() {
            sound.pause();
          });
          settings.updateSetting('musicOn', false);
        }
    });
});


function displayPossibleMoves() {
    var NUM_MOVES_TO_GENERATE = 10;

    var possibleMovesDiv = $('#possible-moves').empty();
    var chosenMovesDiv = $('#chosen-moves').empty();

    var imgId = 0;

    function getArrow(id, direction) {
      return $("<img id='"+ id +"' data-move='" + direction + "' data-src='assets/arrow-" + direction + ".png' src='assets/arrow-" + direction + ".png' class='img-rounded amove' alt='" + direction + "'>");
    }
    _.each(generateNewMoves(), function(move) {
      imgId++;
      possibleMovesDiv.append(getArrow('move'+imgId, move));
    });

    /**
     * Set the callback for clicking on a move
     */
    $(".amove").click(function (e) {
      var $this = $(this);
      var id = this.getAttribute('id');
      if(chosenMovesDiv.children().length == MOVES_PER_TURN) {
        // cannot add another move but can remove moves
        if($this.hasClass('chosen')) {
          $this.removeClass('chosen');
          $('.instruction[id='+id+']').remove();
        }
      } else {
        // can still add and delete
        if($this.hasClass('chosen')) {
          $this.removeClass('chosen');
          $('.instruction[id='+id+']').remove();
        } else {
          $this.addClass('chosen');
          var instruction = $('<li class="instruction" id="' + id + '"></li>');
          instruction.append(getArrow('chosen-move-'+id, this.dataset.move));
          chosenMovesDiv.append(instruction);
        }
      }
    });

    /**
     * Generate 10 possible moves from the move array
     * Display them in the browser to the player
     */
    function generateNewMoves() {
        var newMoves = [];
        _.times(NUM_MOVES_TO_GENERATE, function() {newMoves.push(_.sample(['left', 'right', 'up', 'down']))});
        return newMoves;
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

function preload() {
    game.load.tilemap('map', 'assets/maps/map2.json', null, Phaser.Tilemap.TILED_JSON);
    game.load.image('standard_tiles', 'assets/standard_tiles.png');
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

    cursors = game.input.keyboard.createCursorKeys();
    game.stage.backgroundColor = '#787878';

    map = game.add.tilemap('map');
    map.addTilesetImage('standard_tiles');

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
    gameData.checkpointTiles = getTilesOfIndex(4);

    _.each(gameData.checkpointTiles, function(tile) {
      tile.playersTouched = [];
    });

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

    var unusedTile = _.find(startTiles, function (tile) {
        return !_.some(gameData.assignedStartTiles, function(assignedTile) {
            return tile.x === assignedTile.x && tile.y === assignedTile.y;
        });
        /*return !_.some(gameData.getPlayers(), function (player) {
            return player.data.startTile.x === tile.x &&
                player.data.startTile.y === tile.y;
        });*/
    });

    var randomTile = startTiles[Math.floor(Math.random() * startTiles.length)];

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

    resetToStart(player);
    game.physics.arcade.enable(player);

    player.body.collideWorldBounds = true;
    player.body.setSize(128, 128);

    player.anchor.setTo(0.5, 0.5);

    var color = colorScale(getLowDiscrepancyNumber(_.size(gameData.getPlayers())));
    player.tint = parseInt(color.hex().replace("#", ""), 16);

    gameData.addPlayer(player);

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

// Borrowed from http://www.html5gamedevs.com/topic/2410-drag-the-camera/?p=39215
function moveCamera(o_pointer) {
    if (!o_pointer.timeDown) { return; }
    if (o_pointer.isDown && !o_pointer.targetObject) {
        if(gameData.game.camera.target) {
            gameData.game.camera.unfollow();
        }

        if (camera_position) {
            game.camera.x += camera_position.x - o_pointer.position.x;
            game.camera.y += camera_position.y - o_pointer.position.y;
        }
        camera_position = o_pointer.position.clone();
    }
    if (o_pointer.isUp) { camera_position = null; }
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

    var distance = 128;
    var speed = 500;
    var time = distance / speed;

    this.target = [player.x + distance, player.y];

    game.physics.arcade.velocityFromAngle(angle || 0, speed, player.body.velocity);

    setTimeout(_.partial(clearSpriteMovement, player), time * 1000);
}

function hitCheckpoint(sprite, tile) {
    if(!_.contains(tile.playersTouched, sprite.data.id)) {

        console.log("Player " + sprite.data.id + " scored a checkpoint");
        tile.playersTouched.push(sprite.data.id);

        var allCheckpointsHit = gameData.getCheckpointsTouched(sprite).length === gameData.checkpointTiles.length;

        if(allCheckpointsHit) {
            if(sprite.data.id === gameData.localPlayer.data.id) {
                communication.localPlayerWins();
                console.log("Player touched last checkpoint, send win event!");
            }
        }

        communication.requestUpdate();

      // useful later if we want to update each client with the players checkpoint data
        // socket.emit("player checkpoint", sprite.data.id);
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
