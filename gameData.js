console.log("Loading: game data");

var clientSetupPromise = $.Deferred(),
    serverSetupPromise = $.Deferred();

var gameSetupPromise = $.when(clientSetupPromise, serverSetupPromise);

clientSetupPromise.then(function() {
    console.log('Setup by client done');
});

serverSetupPromise.then(function() {
    console.log('Setup by server done');
});

gameSetupPromise.then(function() {
    console.log('Game setup complete');
});

window.gameData = {
    localPlayerId: null,
    clientSetup: clientSetupPromise,
    serverSetup: serverSetupPromise,
    gameSetup: gameSetupPromise,
    assignedStartTiles: {},
    game: null,
    localPlayer: null,
    roundReady: false,
    roomId: null,
    checkpointTiles: [],
    getPlayer: function getPlayers(id) {
      return _.find(gameData.getPlayers(), function(player) {
        return player.data.id === id;
      });
    },
    getPlayers: function getPlayers() {
        return _.values(_players);
    },
    addPlayer: function(player) {
        _players[player.data.id] = player;
    },
    removePlayer: function(player) {
        delete _players[player.data.id];
        player.destroy();
    },
    updatePlayerLabel: function(player, text) {
        var newLabel = text || player.data.name || player.data.id;

        if(newLabel.length > 10) {
          newLabel = newLabel.substr(0, 4) + '...';
        }

        label = player.children.length && player.getChildAt(0);

        if(label) {
            label.text = newLabel;
        } else if(!_.isUndefined(newLabel)) {
            var label = game.add.text(-21, 30, newLabel, { "font-size": '12px'});
            player.addChild(label);
        }
    },
    addInstruction: function (player, instruction) {
        var moveFunction = _.partial(moveAtAngle, player, directionToAngle(instruction));
        moveFunction.instruction = instruction;
        player.data.movementQueue.push(moveFunction);
    },
    restartGame: function(players){
        _.each(players, function(player){
              clearSpriteMovement(player);
              resetToStart(player);
              player.data.movementQueue = [];
        });
        _.each(gameData.checkpointTiles, function(tile) {
            tile.playersTouched = [];
        });
    },
    redrawPlayerInfo: function() {
        $('#player-info').empty();
        _.each(gameData.getPlayers(), function(player) {
            var playerInfo = $('<li/>');

            var checkpointsHit = getCheckpointsTouched(player);

            playerInfo.html((player.data.name || player.data.id) + ': ' + ((checkpointsHit && checkpointsHit.length) || 0 + '/' + gameData.checkpointTiles.length));
            $('#player-info').append(playerInfo);
        });
    }
};

function getCheckpointsTouched(player) {
    _.filter(gameData.checkpointTiles, function(tile) {
        return _.contains(tile.playersTouched, player.data.id)
    });
}
