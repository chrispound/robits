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
    PLAYER_CHILDREN_LABELS: {label: 'label', energy:'energy'},
    localPlayerId: null,
    clientSetup: clientSetupPromise,
    serverSetup: serverSetupPromise,
    gameSetup: gameSetupPromise,
    assignedStartTiles: {},
    game: null,
    localPlayer: null,
    roundReady: false,
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

        label = player.children.length && _.find(player.children, function(child) {
             return child.key ===  gameData.PLAYER_CHILDREN_LABELS.label
        });

        if(label) {
            label.text = newLabel;
        } else if(!_.isUndefined(newLabel)) {
            var label = game.add.text(-21, 30, newLabel, { "font-size": '12px'});
            label.key = gameData.PLAYER_CHILDREN_LABELS.label;
            player.addChild(label);
        }
    },

    isLocalPlayer: function (sprite){
        return sprite.data.id === gameData.localPlayer.data.id;
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
              player.revive(5);
              gameData.updatePlayerHealth(player);
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

            var checkpointsHit = gameData.getCheckpointsTouched(player);

            playerInfo.html(escapeHtml(player.data.name || player.data.id) + ': ' + (((checkpointsHit && checkpointsHit.length) || '0') + '/' + gameData.checkpointTiles.length));
            $('#player-info').append(playerInfo);
        });
    },
    getCheckpointsTouched: function(player) {
        return _.filter(gameData.checkpointTiles, function(tile) {
            return _.contains(tile.playersTouched, player.data.id)
        });
    },
    playerLostEnergy: function(player){
       //find the last child that is an energy and remove it.
       var f = 0;
       while(player.getChildAt(f).key === gameData.PLAYER_CHILDREN_LABELS.energy){
            f++;
       }
       var energy = player.getChildAt(f - 1)
       energy.destroy();
    },

    updatePlayerHealth: function (sprite){
        for(var h = 0; h < sprite.health; h++){
            var energy = this.game.add.sprite( (h * 15) + -40, -65, gameData.PLAYER_CHILDREN_LABELS.energy);
            sprite.addChild(energy, energy.x, energy.y);
        }
    }
};

//Credit: http://shebang.brandonmintern.com/foolproof-html-escaping-in-javascript/
function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}
