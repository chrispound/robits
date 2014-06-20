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
        requestUpdate: requestUpdate,
        chat: function(message) {
            socket.emit('chat', message);
        },
        localPlayerReady: function() { return setPlayerRoundReady(gameData.localPlayer); },
        localPlayerSetupComplete: function() { return setPlayerUpdated(gameData.localPlayer); },
        localPlayerUpdated: function() { return setPlayerUpdated(gameData.localPlayer); },
        localPlayerDisconnect: function() { return disconnect(gameData.localPlayer); },
        localPlayerDied: function() { return playerDied(gameData.localPlayer); },
        localPlayerWins: function() { 
            return playerWins(gameData.localPlayer);
        }
    };

    function setLocalPlayerId(id) {
        gameData.localPlayerId = id;
        getIdPromise.resolve(id);
    }

    function getPlayerBroadcastInfo(player) {
        return {
            id: player.data.id,
            name: player.data.name,
            movementQueue: _.map(player.data.movementQueue, function(moveFunction) { return moveFunction.instruction; }),
            startTile: {
                x: player.data.startTile.x,
                y: player.data.startTile.y
            }
        }
    }

    function requestUpdate() {
        socket.emit("request update");
    }

    function setPlayerUpdated(player) {
        socket.emit("player updated", getPlayerBroadcastInfo(player));
    }

    function setPlayerRoundReady(player) {
        socket.emit("player moves ready", getPlayerBroadcastInfo(player));
    }

    function disconnect(player) {
        socket.emit("player left", player.data.id);
    }

    function playerDied(player) {
        if(player.data.id === gameData.localPlayer.data.id){
           console.log('player died: ' + player.id )
           gameData.localPlayer.kill();
           socket.emit('player died', gameData.localPlayer.data.id);
        }
        else{
            var deadPlayer = gameData.getPlayer(player.id)
                deadPlayer.kill();
        }
        if(!_.some(gameData.getPlayers(), function(player) {
            return player.alive;
        })) 
        {
          gameData.restartGame(gameData.getPlayers());   
        }
    }

    function playerWins(player) {
        alert("Game Over: " + player.data.name || player.data.id + " wins!");
        gameData.restartGame(gameData.getPlayers());
    }

    function fullGame(){
        alert('Game full looking for new room...')
    }

    function updateGameData(serverGameInfo) {
        gameData.assignedStartTiles = serverGameInfo.assignedStartTiles || {};
        serverStateLoadedPromise.resolve();
    }

    function updatePlayer(serverPlayerData, clientPlayer) {
        if(!clientPlayer) {
            clientPlayer = _.find(gameData.getPlayers(), function(player) {
                return player.data.id === serverPlayerData.id;
            });
        }

        _.extend(clientPlayer.data, {
            name: serverPlayerData.name
            /* TODO add more as needed */
        });

        gameData.updatePlayerLabel(clientPlayer);
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

                updatePlayer(newPlayer);
            });

            gameData.redrawPlayerInfo();
        });
    }

    function removePlayer(id) {
        var player = _.find(gameData.getPlayers(), function (player) {
            return player.data.id === id;
        });

        gameData.removePlayer(player);
    }

    function syncPlayerMoves(serverPlayers){
    //for each player add their move-set then launch the movement part of the round
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
        logChatMessage('server> ' + message);
    }

    function logChatMessage(message) {
        var log = $('#chat-log');
        var escapedMessage = $('<div/>').text(message).html();
        log.html(log.html() + escapedMessage + '<br/>').prop('scrollTop', log.prop('scrollHeight'));
    }

    function alertKicked(message) {
        logMessage(message);
        alert(message);
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

        socket.on('kicked', alertKicked);
    }
})(gameData);


