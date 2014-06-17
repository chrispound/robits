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
        id: id
    }
};

var addPlayer = function (socket) {
    var sessionId = socket.id;
    var player = new Player(sessionId);
    players.push(player);

    log("--- THE FOLLOWING PLAYERS ARE CONNECTED ----", socket.room);
    var clientsInRoom = getClientsByRoomId(socket.room);
    for (var i = 0; i < clientsInRoom.length; i++) {
        var existingPlayer = clientsInRoom[i];
        log(existingPlayer.id, socket.room)
    }

    log("--------------------------------------------\n", socket.room);

    socket.emit('assign id', existingPlayer.id);

    emitGameChanged(socket.room);

    return player;
};

var dropUser = function (sessionId, roomId) {
    var removePlayer = players.indexOf(playerById(sessionId));
    players.splice(removePlayer, 1);

    emitGameChanged(roomId);
};

function updatePlayer(clientPlayerData) {
    var player = _.findWhere(players, {id: clientPlayerData.id});

    if(!player) {
        player = new Player(clientPlayerData.id);
    }

    _.extend(player, {
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

        socket.room = roomId;
        socket.join(socket.room);
        console.log('set socket room id to: ' + socket.room, socket.room);
        io.to(socket.room).emit('set room', socket.room);
        log('user connected to room: ' + socket.room, socket.room);
        io.to(socket.room).emit('game info', buildGameInfo());
        var player = addPlayer(socket);

    socket.on('chat', function (message) {
         io.to(socket.room).emit('chat', socket.id + ": " + message);
         log("in chat the room is: " +socket.room, socket.room);
    });

    socket.on('player setup complete', function (playerData) {
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
        if (playerById(socket.id)) {
            dropUser(socket.id, socket.room)
        }
    });

    socket.on('player moves ready', function (player) {
        var moves = player.movementQueue;
        var updatePlayer = playerById(socket.id);
        updatePlayer.moves = moves;

        log("Player " + updatePlayer.id + " is ready", socket.room);

        var clientsInRoom = getClientsByRoomId(socket.room);
        //look through list of players see if any match any of the ids with a client in the room.
             console.log('looking for matching players');
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

var port = Number(process.env.PORT || 3000);
http.listen(port, function () {
//    log('\nlistening on *:'+port+'\n', socket.room);
});

function playerById(id) {
    var i;
    for (i = 0; i < players.length; i++) {
        if (players[i].id === id)
            return players[i];
    }
    return false;
}

function log(message, roomId) {
    io.to(roomId).emit('log', message);
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



