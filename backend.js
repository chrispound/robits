var _ = require('underscore');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var players = [];
var test = true;
var roomId = 0;
var numOfUsersInRoom = 0;

var Player = function (id) {
    var moves;

    return {
        moves: moves,
        id: id,
        getName: function () {
            return this.name || this.id;
        }
    }
};

var addPlayer = function (socket) {
    var player = new Player(socket.id);
    players.push(player);

    io.to(socket.room).emit('assign id', player.id);

    emitGameChanged(socket.room);

    return player;
};

var dropUser = function (sessionId, roomId) {
    var removePlayer = players.indexOf(playerById(sessionId));
    if(removePlayer != -1) {
        players.splice(removePlayer, 1);
    }
    emitGameChanged(roomId);

};

function updatePlayer(clientPlayerData) {
    var player = _.findWhere(players, {id: clientPlayerData.id});

    if (!player) {
        player = new Player(clientPlayerData.id);
    }

  if(player.getName() != clientPlayerData.name && !_.isUndefined(clientPlayerData.name)) {
    log(player.getName() + " is now known as " + clientPlayerData.name);
  }

    _.extend(player, {
        name: clientPlayerData.name,
        startTile: clientPlayerData.startTile,
        moves: clientPlayerData.movementQueue
    });
}

function buildGameInfo() {
    return {
        assignedStartTiles: _.object(_.map(players, function (player) {
                return player.id;
            }),
            _.map(players, function (player) {
                return player.startTile;
            }))

//        room: 'test'
    };
}

app.use(express.static(__dirname));

io.sockets.on('connection', function (socket) {

    console.log('User: connected');
    numOfUsersInRoom++;
    //when more than 4 players have connected make a new room.
    if(numOfUsersInRoom > 4){
        socket.room = roomId++;
        numOfUsersInRoom = 1;
    }


    log('New player connected: ' + socket.id);
    socket.room = roomId;
    socket.join(socket.room);
    io.to(socket.room).emit('set room', socket.room);
    log('user connected to room: ' + socket.room, socket.room);
    io.to(socket.room).emit('game info', buildGameInfo());
    var player = addPlayer(socket);

    socket.on('chat', function (message) {
         io.to(socket.room).emit('chat', socket.id + ": " + message);
         log("in chat the room is: " +socket.room, socket.room);
    });

    socket.on('player setup complete', function (playerData) {
        var commandArr = message.match(/^#(\S+)\s*(.*)/);

        var command = (commandArr && commandArr.length > 0) ? commandArr[1] : undefined;
        var commandArgs = (commandArr && commandArr.length > 1) ? commandArr[2].split(/s+/) : [];
        var useCommand = false;

        if(!_.isUndefined(command)) {
            useCommand = handleCommand(socket, command, commandArgs);
        }

        if(!useCommand) {
            console.log(playerById(socket.id));
            io.to(socket.room).emit('chat', playerById(socket.id).getName() + "> " + message);
        }
    });

    socket.on('player updated', function (playerData) {
        updatePlayer(playerData);
        emitGameChanged(socket.room);
    });

    socket.on('player ready', function (playerData) {
        // use playerData.startTile.x and playerData.startTile.y to track
        // where player's start tile is

        // also has player.id and playerData.movementQueue of commands, but that
        // should be empty at this point
    });

    socket.on('disconnect', function () {
        log('Disconnect: ' + socket.id + '\n', socket.room);
        var player = playerById(socket.id);
        if(player) {
            log('Player ' + player.getName() + ' has disconnected', socket.room);
            if (player) {
                 dropUser(socket.id, socket.room)
            }
        }
    });

    socket.on('player moves ready', function (player) {
        var moves = player.movementQueue;
        var updatePlayer = playerById(socket.id);
        updatePlayer.moves = moves;

        log("Player " + updatePlayer.id + " is ready", socket.room);

        var clientsInRoom = getClientsByRoomId(socket.room);
//        var playersInRoom = _.find(players, function(player){
//           if(_.find(clientsInRoom, function(cleintId){
//               console.log('checking if player ' + player.id + ' matches: '+ clientId);
//               return id === player.id;
//           })){}
//                     
//        });
        console.log('players found: ' + players);
        var playersInRoom = [];
        for(var i =0; i < clientsInRoom.length; i++){
            for(var f=0; f < players.length; f++){
                if(clientsInRoom[i] == players[f].id){
                    playersInRoom.push(players[f]);   
                }
            }
        }
         console.log('players found: ' + playersInRoom);
        //look through list of players
        //check if the are ready.
        var allPlayersReady = !_.some(playersInRoom, function (player) {
        log("Player " + updatePlayer.getName() + " is ready");

            return _.size(player.moves) === 0;
        });

        if (allPlayersReady) {
            log('*** All players are ready ***', socket.room);

            io.to(socket.room).emit('all player moves ready', players);
            _.each(players, clearMoves);

            function clearMoves(player) {
                player.moves = []
            }
        }

    });

    socket.on('player died', function (id) {
        io.to(socket.room).emit('player died', id)
    });

    socket.on('player checkpoint', function (id) {
        console.log('player hit checkpoint. updating clients');
        io.to(socket.room).emit('player checkpoint', id)
    });

    socket.on('player won', function (id) {
        io.to(socket.room).emit('player won', id);
    });

});


function emitGameChanged(roomId) {
    io.to(roomId).emit('game info', buildGameInfo());
    io.to(roomId).emit('players changed', players);
}
        
function handleCommand(socket, command, args) {
    switch(command) {
        case 'kick':
            _.each(args, function(playerToKick) {
                var kickPlayer = _.find(players, function(player) {
                    return player.getName() === playerToKick;
                });
                if(kickPlayer) {
                    var kickPlayerSocket = io.sockets.connected[kickPlayer.id];
                    kickPlayerSocket.emit('kicked', 'Kicked by ' + playerById(socket.id).getName());
                    kickPlayerSocket.disconnect();
                }
            });
            return true;
            break;
        case 'help':
            log('Commands:\n' +
                '#kick <player>', socket);
            return true;
            break;
    }

    return false;
}


var port = Number(process.env.PORT || 3000);
http.listen(port, function () {
});

function playerById(id) {
    for (var i = 0; i < players.length; i++) {
        if (players[i].id === id)
            return players[i];
    }
    return false;
}

function log(message, roomId, socket) {
     (socket || io).to(roomId).emit('log', message);
    console.log(message);
}

function getClientsByRoomId(roomId) {
        var res = [],
        room = io.sockets.adapter.rooms[roomId];
        if(room) {
            for (var id in room){
                res.push(io.sockets.adapter.nsp.connected[id]);
            }
        }
        //Get a list of clients by id
        console.log('list of clients in room: ' + roomId + ' ' + res);
        return res;
}



