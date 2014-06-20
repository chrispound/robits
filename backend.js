var _ = require('underscore');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var players = [];
var roomId = 0;
var numOfUsersInRoom = 0;

var Player = function (id) {
    var moves;
    var alive;

    return {
        moves: moves,
        alive: alive,
        id: id,
        getName: function () {
            return this.name || this.id;
        }
    }
};

var addPlayer = function (socket) {
    var player = new Player(socket.id);
    player.alive = true;
    players.push(player);

    io.to(socket.room).emit('assign id', player.id);

    emitGameChanged(socket);

    return player;
};

var dropUser = function (sessionId, socket) {
    var removePlayer = players.indexOf(getPlayerById(sessionId));
    if(removePlayer != -1) {
        players.splice(removePlayer, 1);

        emitGameChanged(socket);
    }
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

function buildGameInfo(room) {
    return {
        assignedStartTiles: _.object(_.map(getAllPlayersInRoom(room), function (player) {
                return player.id;
            }),
            _.map(getAllPlayersInRoom(room), function (player) {
                return player.startTile;
            }))
    };
}

app.use(express.static(__dirname));

io.sockets.on('connection', function (socket) {

    numOfUsersInRoom++;
    if(numOfUsersInRoom > 4){
        roomId++;
        numOfUsersInRoom = 1;
    }

    log('New player connected to room '+roomId+': ' + socket.id, roomId);

    socket.room = roomId;
    socket.join(socket.room);
    io.to(socket.room).emit('game info', buildGameInfo(socket.room));
    var player = addPlayer(socket);

    socket.on('chat', function (message) {
        var commandArr = message.match(/^#(\S+)\s*(.*)/);

        var command = (commandArr && commandArr.length > 0) ? commandArr[1] : undefined;
        var commandArgs = (commandArr && commandArr.length > 1) ? commandArr[2].split(/s+/) : [];
        var useCommand = false;

        if(!_.isUndefined(command)) {
            useCommand = handleCommand(socket, command, commandArgs);
        }

        if(!useCommand) {
            console.log(getPlayerById(socket.id));
            io.to(socket.room).emit('chat', getPlayerById(socket.id).getName() + "> " + message);
        }
    });

    socket.on('request update', function() {
        emitGameChanged(socket);
    });

    socket.on('player updated', function (playerData) {
        updatePlayer(playerData);
        emitGameChanged(socket);
    });

    socket.on('player ready', function (playerData) {
        // use playerData.startTile.x and playerData.startTile.y to track
        // where player's start tile is

        // also has player.id and playerData.movementQueue of commands, but that
        // should be empty at this point
    });

    socket.on('disconnect', function () {
        var player = getPlayerById(socket.id);
        if(player) {
            log('Player ' + player.getName() + ' has disconnected');
            if (player) {
                dropUser(socket.id, socket)
            }
        }
    });

    socket.on('player moves ready', function (player) {
        var moves = player.movementQueue;
        var updatePlayer = getPlayerById(socket.id);
        updatePlayer.moves = moves;

        log("Player " + updatePlayer.getName() + " is ready", socket.room);

            //if a player is found alive and without moves all players are not ready.
        var allPlayersReady = !_.find(getAllPlayersInRoom(socket.room), function (player) {
            console.log(player.alive);
            console.log(player.moves.length)
            return  player.alive && player.moves.length === 0;
        });

        if (allPlayersReady) {
            log('*** All players are ready ***', socket.room);

            io.emit('all player moves ready', getAllPlayersInRoom(socket.room));
            _.each(getAllPlayersInRoom(socket.room), clearMoves);

            function clearMoves(player) {
                player.moves = []
            }
        }

    });

    socket.on('player died', function (id) {
        var deadPlayer = getPlayerById(id);
        deadPlayer.alive = false;
        io.to(socket.room).emit('player died', id);
        log(deadPlayer.getName() + ' died!')
    });

    socket.on('player checkpoint', function (id) {
        console.log('player hit checkpoint. updating clients', socket.room);
        io.to(socket.room).emit('player checkpoint', id)
    });

    socket.on('player won', function (id) {
        io.to(socket.room).emit('player won', id);
    });

});

function handleCommand(socket, command, args) {
    switch(command) {
        case 'kick':
            _.each(args, function(playerToKick) {
                var kickPlayer = _.find(getAllPlayersInRoom(socket.room), function(player) {
                    return player.getName() === playerToKick;
                });
                if(kickPlayer) {
                    var kickPlayerSocket = io.sockets.connected[kickPlayer.id];
                    kickPlayerSocket.emit('kicked', 'Kicked by ' + getPlayerById(socket.id).getName());
                    kickPlayerSocket.disconnect();
                }
            });
            return true;
            break;
        case 'help':
            log('Commands:\n' +
                '#kick <player>', socket.room, socket);
            return true;
            break;
    }

    return false;
}

function emitGameChanged(socket) {
    io.to(socket.room).emit('game info', buildGameInfo(socket.room));
    io.to(socket.room).emit('players changed', getAllPlayersInRoom(socket.room));
}

var port = Number(process.env.PORT || 3000);
http.listen(port, function () {
    console.log('\nlistening on *:' + port + '\n');
});

function getPlayerById(id) {
    for (var i = 0; i < players.length; i++) {
        if (players[i].id === id)
            return players[i];
    }
    return false;
}

function log(message, room, socket) {
    var target = socket ? socket : (room ? io.to(room) : io);
    target.emit('log', message);
    console.log(message);
}

//todo in socket.io v 1.1 this can be replaced with (socket || io).clients(namespace,room)
function getAllPlayersInRoom(roomId){
  var namespace = '/';
  var clientsIdInRoom = [];
  var playersInRoom = [];
  for (var socketId in io.nsps[namespace].adapter.rooms[roomId]) {
      clientsIdInRoom.push(socketId);
  }
  for(var i=0; i < clientsIdInRoom.length; i++){
      for(var f = 0; f < players.length; f++){
        if(clientsIdInRoom[i] == players[f].id){
           playersInRoom.push(players[f]);
        }
      }
  }
  return playersInRoom;
}


