var _ = require('underscore');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var players = [];
var currentUser = 0;

var Player = function (playerId) {
    var moves;

    return {
        moves: moves,
        playerId: playerId
    }
};

var addPlayer = function (socket) {
    var sessionId = socket.id;
    currentUser = currentUser + 1;
    var player = new Player(sessionId);
    players.push(player);

    log("--- THE FOLLOWING PLAYERS ARE CONNECTED ----");

    for (var i = 0; i < players.length; i++) {
        var existingPlayer = players[i];
        log(existingPlayer.playerId)
    }

    log("--------------------------------------------\n");

    setTimeout(function () {
        io.emit('receive id', existingPlayer.playerId);
        emitPlayersChanged();
    }, 1500);

    return player;
};

var dropUser = function (sessionId) {
    currentUser = currentUser - 1;
    var removePlayer = players.indexOf(playerById(sessionId));
    players.splice(removePlayer, 1);

    emitPlayersChanged();
};

app.use(express.static(__dirname));

io.sockets.on('connection', function (socket) {
    var player = addPlayer(socket);

    socket.on('player ready', function (playerData) {
        // use playerData.startTile.x and playerData.startTile.y to track
        // where player's start tile is

        // also has player.id and playerData.movementQueue of commands, but that
        // should be empty at this point
    });

    socket.on('disconnect', function () {
        log('Disconnect: ' + socket.id + '\n');
        dropUser(socket.id)
    });

    socket.on('player moves ready', function (moves) {
        var updatePlayer = playerById(socket.id);
        updatePlayer.moves = moves;

        log("Player " + updatePlayer.playerId + " is ready");

        var allPlayersReady = !_.some(players, function (player) {
            return _.size(player.moves) === 0;
        });

        if(allPlayersReady) {
            log('*** All players are ready ***');

            io.emit('all player moves ready', players);
            _.each(players, clearMoves);

            function clearMoves(player) {
                player.moves = []
            }
        }

    });
    socket.on('player died', function (playerId) {
        io.emit('player died', playerId)
    });

});

function emitPlayersChanged() {
    io.emit('players changed', players);
}

http.listen(3000, function () {
    log('\nlistening on *:3000\n');
});

function playerById(id) {
    var i;
    for (i = 0; i < players.length; i++) {
        if (players[i].playerId == id)
            return players[i];
    }
    return false;
}

function log(message) {
    io.emit('log', message);
    console.log(message);
}


