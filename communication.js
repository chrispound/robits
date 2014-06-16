window.communication = (function(gameData) {
    console.log("Loading communication module");

    return {
        initializeSocket: setUpSocketReceivers,
        localPlayerReady: function() { return setPlayerReady(gameData.localPlayer); },
        localPlayerDisconnect: function() { return disconnect(gameData.localPlayer); },
        localPlayerDied: function() { return playerDied(gameData.localPlayer); },
        localPlayerWins: function() { 
            return playerWins(gameData.localPlayer.data.id); 
        }
    };

    function setLocalPlayerId(playerId) {
        console.log('Local player is now known as: ' + playerId);

        gameData.localPlayer = addPlayer({id: playerId});
        
        setPlayerReady(gameData.localPlayer);

        gameData.game.camera.follow(gameData.localPlayer);
    }

    function getPlayerBroadcastInfo(player) {
        return {
            id: player.data.id,
            movementQueue: player.data.movementQueue,
            startTile: {
                x: player.data.startTile.x,
                y: player.data.startTile.y
            }
        }
    }

    function setPlayerReady(player) {
        socket.emit("player ready", getPlayerBroadcastInfo(player));
    }

    function disconnect(player) {
        socket.emit("player left", player.data.id);
    }

    function playerDied(player) {
        socket.emit("player died", player.data.id)
    }

    function playerWins(playerId) {
        gameData.restartGame(gameData.getPlayers());
        alert("Game Over: " + playerId + " wins!");
    }

    function fullGame(){
        alert('Game full looking for new room...')
    }


    function syncPlayerList(newPlayerList) {
        _.each(gameData.getPlayers(), function removeIfMissing(player) {
            var playerDisappeared = !_.some(newPlayerList, function (newPlayer) {
                return newPlayer.playerId === player.data.id;
            });

            if (playerDisappeared) {
                removePlayer(player.data.id);
                console.log("Removing player " + player.data.id)
            }
        });

        _.each(newPlayerList, function addIfMissing(newPlayer) {
            var playerIsNew = !_.some(gameData.getPlayers(), function (player) {
                return player.data.id === newPlayer.playerId;
            });

            if (playerIsNew) {
                addPlayer({id: newPlayer.playerId});
                console.log("Adding player " + newPlayer.playerId)
            }
        });
    }

    function removePlayer(id) {
        var player = _.find(gameData.getPlayers(), function (player) {
            return player.data.id === id;
        });

        gameData.removePlayer(player);
    }

    function syncPlayerMoves(serverPlayers){
    //for each user add their move-set then launch the movement part of the round
        console.log('Syncing player moves');
        _.each(gameData.getPlayers(), function(player) {
            _.each(serverPlayers, function(serverPlayer){
                if(player.data.id === serverPlayer.playerId){
                    _.each(serverPlayer.moves, function (instruction) {
                        gameData.addInstruction(player, instruction);
                    });
                }
            });
            console.log('(what does this message mean?) Queue moves after sync: '+ player.data.movementQueue)
        });
        gameData.roundReady = true;
    }

    function logMessage(message) {
        var log = $('#server-log');
        log.append(message + '<br/>').prop('scrollTop', log.prop('scrollHeight'));
    }

    function logChatMessage(message) {
        var log = $('#chat-log');
        log.append(message + '<br/>').prop('scrollTop', log.prop('scrollHeight'));
    }

    function setUpSocketReceivers() {
        socket.on('player won', playerWins);

        socket.on('players changed', syncPlayerList);

        socket.on('player left', removePlayer);

        socket.on('receive id', setLocalPlayerId);

        socket.on('player died', playerDied);

        socket.on('all player moves ready', syncPlayerMoves);

        socket.on('full game', fullGame);

        socket.on('log', logMessage);

        socket.on('chat', logChatMessage);

    }
})(gameData);


