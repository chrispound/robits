console.log("Loading: game data");

window.gameData = {
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
        player.data.movementQueue.push(_.partial(moveAtAngle, player, directionToAngle(instruction)));
    },
    restartGame: function(players){
        _.each(players, function(player){
              clearSpriteMovement(player)
              resetToStart(player)
              player.data.movementQueue = [];
        });
            _.each(gameData.checkpointTiles, function(tile) {
                tile.playersTouched = [];
            });
    }
};