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
    console.log(gameData.assignedStartTiles);
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
    checkpointTiles: [],
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
    }
};