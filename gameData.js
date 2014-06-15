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
    restartGame: function(player){
        player.x =0;
        player.y = 0;
        resetToStart(player)
        player.data.movementQueue = [];
        _.each(gameData.checkpointTiles, function(tile) {
            tile.playersTouched = [];
        });
    },
};