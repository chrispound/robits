var _ = require('underscore');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var players = [];

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

    socket.emit('assign id', player.id);

    emitGameChanged();

    return player;
};

var dropUser = function (sessionId) {
    var removePlayer = players.indexOf(playerById(sessionId));
    players.splice(removePlayer, 1);

    emitGameChanged();
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
    };
}

app.use(express.static(__dirname));

io.sockets.on('connection', function (socket) {

    log('New player connected: ' + socket.id);

    socket.emit('game info', buildGameInfo());

    if (players.length === 4) {
        tooManyPlayersInGame(socket.id);
    } else {
        var player = addPlayer(socket);
    }

    socket.on('chat', function (message) {
        io.emit('chat', playerById(socket.id).getName() + "> " + message);
    });

    socket.on('player updated', function (playerData) {
        updatePlayer(playerData);
        emitGameChanged();
    });

    socket.on('player ready', function (playerData) {
        // use playerData.startTile.x and playerData.startTile.y to track
        // where player's start tile is

        // also has player.id and playerData.movementQueue of commands, but that
        // should be empty at this point
    });

    socket.on('disconnect', function () {
        var player = playerById(socket.id);
        log('Disconnect: ' + player.getName() + '\n');
        if (player) {
            dropUser(socket.id)
        }
    });

    socket.on('player moves ready', function (player) {
        var moves = player.movementQueue;
        var updatePlayer = playerById(socket.id);
        updatePlayer.moves = moves;

        log("Player " + updatePlayer.getName() + " is ready");

        var allPlayersReady = !_.some(players, function (player) {
            return _.size(player.moves) === 0;
        });

        if (allPlayersReady) {
            log('*** All players are ready ***');

            io.emit('all player moves ready', players);
            _.each(players, clearMoves);

            function clearMoves(player) {
                player.moves = []
            }
        }

    });

    socket.on('player died', function (id) {
        io.emit('player died', id)
    });

    socket.on('player checkpoint', function (id) {
        console.log('player hit checkpoint. updating clients');
        io.emit('player checkpoint', id)
    });

    socket.on('player won', function (id) {
        io.emit('player won', id);
    });

});

function emitGameChanged() {
    io.emit('game info', buildGameInfo());
    io.emit('players changed', players);
}

var port = Number(process.env.PORT || 3000);
http.listen(port, function () {
    log('\nlistening on *:' + port + '\n');
});

function playerById(id) {
    for (var i = 0; i < players.length; i++) {
        if (players[i].id === id)
            return players[i];
    }
    return false;
}

function log(message) {
    io.emit('log', message);
    console.log(message);
}


