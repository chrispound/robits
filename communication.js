window.communication = (function(gameData) {
    console.log("Loading communication module");

    var getIdPromise = $.Deferred(), serverStateLoadedPromise = $.Deferred();

    getIdPromise.then(function(id) {
        console.log('Local player is now known as: ' + id)
    });

    serverStateLoadedPromise.then(function() {
        console.log('Received current stage state')
    });

    $.when(getIdPromise, serverStateLoadedPromise).then(function() {
        gameData.serverSetup.resolve();
    });

    return {
        initializeSocket: setUpSocketReceivers,
        localPlayerReady: function() { return setPlayerRoundReady(gameData.localPlayer); },
        localPlayerSetupComplete: function() { return setPlayerSetupComplete(gameData.localPlayer); },
        localPlayerDisconnect: function() { return disconnect(gameData.localPlayer); },
        localPlayerDied: function() { return playerDied(gameData.localPlayer); },
        localPlayerWins: function() { 
            return playerWins(gameData.localPlayer.data.id); 
        }
    };

    function setLocalPlayerId(id) {
        gameData.localPlayerId = id;
        getIdPromise.resolve(id);
    }

    function getPlayerBroadcastInfo(player) {
        return {
            id: player.data.id,
            movementQueue: _.map(player.data.movementQueue, function(moveFunction) { return moveFunction.instruction; }),
            startTile: {
                x: player.data.startTile.x,
                y: player.data.startTile.y
            }
        }
    }

    function setPlayerSetupComplete(player) {
        socket.emit("player setup complete", getPlayerBroadcastInfo(player));
    }

    function setPlayerRoundReady(player) {
        socket.emit("player moves ready", getPlayerBroadcastInfo(player));
    }

    function disconnect(player) {
        socket.emit("player left", player.data.id);
    }

    function playerDied(player) {
        socket.emit("player died", player.data.id)
    }

    function playerWins(id) {
        gameData.restartGame(gameData.getPlayers());
        alert("Game Over: " + id + " wins!");
    }

    function fullGame(){
        alert('Game full looking for new room...')
    }

    function updateGameData(serverGameInfo) {
        console.log(serverGameInfo);

        console.log(serverGameInfo);
        gameData.assignedStartTiles = serverGameInfo.assignedStartTiles || {};
        serverStateLoadedPromise.resolve();
    }

    function syncPlayerList(newPlayerList) {
        gameData.gameSetup.then(function(){
            _.each(gameData.getPlayers(), function removeIfMissing(player) {
                var playerDisappeared = !_.some(newPlayerList, function (newPlayer) {
                    return newPlayer.id === player.data.id;
                });

                if (playerDisappeared) {
                    removePlayer(player.data.id);
                    console.log("Removing player " + player.data.id)
                }
            });

            _.each(newPlayerList, function addIfMissing(newPlayer) {
                var playerIsNew = !_.some(gameData.getPlayers(), function (player) {
                    return player.data.id === newPlayer.id;
                });

                if (playerIsNew) {
                    addPlayer({id: newPlayer.id});
                    console.log("Adding player " + newPlayer.id)
                }
            });
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

                var localPlayer = (serverPlayer.id === gameData.localPlayer.data.id);

                if(!localPlayer && player.data.id === serverPlayer.id){
                    _.each(serverPlayer.moves, function (instruction) {
                        gameData.addInstruction(player, instruction);
                    });
                }
            });
            //console.log('(what does this message mean?) Queue moves after sync: '+ player.data.movementQueue)
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

        socket.on('assign id', setLocalPlayerId);

        socket.on('player died', playerDied);

        socket.on('all player moves ready', syncPlayerMoves);

        socket.on('full game', fullGame);

        socket.on('log', logMessage);

        socket.on('chat', logChatMessage);

        socket.on('game info', updateGameData);

        socket.on('connect', function() {
            var room = 'abc123';
            socket.emit('room', room);
            console.log('joined room ' + room)
        });

    }
})(gameData);


