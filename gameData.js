console.log("Loading: game data");

window.gameData = {
    game: null,
    localPlayer: null,
    roundReady: false,
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
    }
};