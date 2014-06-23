var _ = require('underscore');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var rooms = [];
var chat = require('./chat')(io);

var DEFAULT_PORT = 3000;
var rootPath = __dirname + '/..';
app.use(express.static(rootPath));

var port = Number(process.env.PORT || DEFAULT_PORT);
http.listen(port, function () {
    console.log('\nListening on *:' + port + '\n');
});

var roomPrototype = {
    initialize: function() {
        if(_.isUndefined(this.capacity)) {
            this.capacity = 4;
        }
        this.players = [];
        this.id = _.size(rooms);
        rooms.push(this);
        return this;
    },
    getPlayerData: function() {
        return _.map(this.players, function(player) {
            return player.getData();
        });
    },
    isFull: function() {
        return _.size(this.players) === this.capacity;
    },
    getGameData: function() {
      return {
          assignedStartTiles: _.object(_.map(this.players, function (player) {
                  return player.id;
              }),
              _.map(this.players, function (player) {
                  return player.startTile;
              }))
      };
    },
    getPlayerById: function(id) {
        return _.findWhere(this.players, { id: id });
    },
    getPlayerByName: function(name) {
        return _.find(this.players, function(player) {
            return player.getName() === name;
        });
    },
    dropPlayer: function(socket, message) {
        var player = this.getPlayerById(socket.id);
        var playerIndex = this.players.indexOf(player);

        if(_.isUndefined(player) || playerIndex === -1) {
            console.error('Tried dropping player ' + id + ' who could not be found in room ' + this.id);
            return;
        }

        log('Player ' + player.getName() + ' has disconnected from room ' + this.id + (message ? ' (reason: ' + message + ')' : ''), this.id);
        this.players.splice(playerIndex, 1);
        emitGameChanged(socket);
    }
};

var Player = function (socket) {
    var id = socket.id;

    var player = {
        moves: [],
        alive: true,
        id: id,
        socket: socket,
        getData: function() {
            return _.pick(this, 'moves', 'alive', 'id', 'name');
        },
        getName: function () {
            return this.name || this.id;
        },
        clearMoves: function() {
            this.moves = [];
        },
        getRoom: function() {
            return _.findWhere(rooms, { id: socket.room });
        }
    };

    if(player.getRoom()) {
        player.getRoom().players.push(player);
    }

    return player;
};


io.sockets.on('connection', function (socket) {

    var room = _.find(rooms, function(room) {
       return !room.isFull();
    }) || Object.create(roomPrototype).initialize();

    log('New player connected to room '+room.id+': ' + socket.id, room.id);

    socket.room = room.id;

    socket.join(room.id);

    io.to(room.id).emit('game info', room.getGameData());
    var player = addPlayer(socket);

    var socketEvents = {
        'chat': function(commandOrMessage) {
            chat.runCommandOrShareMessage(room, socket, commandOrMessage);
        },
        'requestUpdate': sendUpdate,
        'player updated': sharePlayerUpdated,
        'disconnect': function(message) {
            room.dropPlayer(socket, message);
        },
        'player moves ready': handlePlayerReady,
        'player died': killPlayer,
        'player checkpoint': shareCheckpointHit,
        'game over': shareGameOver
    };

    _.each(socketEvents, function(handler, event) {
        socket.on(event, handler);
    });

    function sendUpdate() {
        emitGameChanged(socket);
    }

    function sharePlayerUpdated(playerData) {
        updatePlayer(playerData);
        emitGameChanged(socket);
    }

    function updatePlayer(clientPlayerData) {
        var player = room.getPlayerById(clientPlayerData.id);

        if(player.getName() != clientPlayerData.name && !_.isUndefined(clientPlayerData.name)) {
            log(player.getName() + " is now known as " + clientPlayerData.name, room.id);
        }

        _.extend(player, {
            name: clientPlayerData.name,
            startTile: clientPlayerData.startTile,
            moves: clientPlayerData.movementQueue
        });
    }

    function handlePlayerReady(player) {
        var moves = player.movementQueue;
        var updatePlayer = room.getPlayerById(socket.id);
        updatePlayer.moves = moves;

        log("Player " + updatePlayer.getName() + " is ready", room.id);

        //if a player is found alive and without moves all players are not ready.
        var allPlayersReady = !_.find(room.players, function (player) {
            return player.alive && player.moves.length === 0;
        });

        if (allPlayersReady) {
            log('*** All players are ready ***', room.id);

            io.emit('all player moves ready', room.getPlayerData()); // io.emit needs to be room emit

            _.each(room.players, function(player) {
                player.clearMoves();
            });
        }
    }

    function killPlayer(id) {
        var deadPlayer = room.getPlayerById(id);
        deadPlayer.alive = false;
        io.to(room.id).emit('player died', id);
        log(deadPlayer.getName() + ' died!', room.id)
    }

    function shareCheckpointHit(id) {
        console.log('Player ' + id + ' hit checkpoint. Updating room.', room.id);
        io.to(room.id).emit('player checkpoint', id)
    }

    function shareGameOver(message) {
        log(message, room.id);
        io.to(room.id).emit('game over', message);
    }
});

var addPlayer = function (socket) {
    var player = new Player(socket);

    io.to(socket.room).emit('assign id', player.id);

    emitGameChanged(socket);

    return player;
};

function emitGameChanged(socket) {
    var room = rooms[socket.room];
    io.to(socket.room).emit('game info', room.getGameData());
    io.to(socket.room).emit('players changed', room.getPlayerData());
}

function log(message, roomId, socket) {
    var target = socket ? socket : (roomId ? io.to(roomId) : io);
    target.emit('log', message);
    console.log(message);
}