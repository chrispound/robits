var _ = require('underscore');
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var players = [];
var currentUser = 0;

var Player = function (playerId) {
    return {
        playerId: playerId
    }
};

var addUser = function (socket) {
    var sessionId = socket.id;
    currentUser = currentUser + 1;
    players.push(new Player(sessionId));

    console.log("---WE HAVE THE FOLLOWING PLAYERS CONNECTED----");

    for (var i = 0; i < players.length; i++) {
        var existingPlayer = players[i];
        console.log('player: ' + existingPlayer.playerId)

    }

    setTimeout(function() {
        console.log('sending player: ' + sessionId + ' their id.');
        socket.emit('receive id', existingPlayer.playerId);
        emitPlayersChanged();
    }, 1500);
};

var dropUser = function (sessionId) {
    currentUser = currentUser - 1;
    var removePlayer = players.indexOf(playerById(sessionId));
    players.splice(removePlayer, 1);

    emitPlayersChanged();
};

app.use(express.static(__dirname));


io.sockets.on('connection', function (socket) {
    console.log('User: connected');
    addUser(socket);

    socket.on('player ready', function(playerData) {
        // use playerData.startTile.x and playerData.startTile.y to track
        // where player's start tile is

        // also has playerData.movementQueue of commands, but that's empty here
    });

    socket.on('disconnect', function () {
        console.log('disconnect: ' + socket.id);
        dropUser(socket.id)
    });

});

function emitPlayersChanged() {
    io.emit('players changed', players);
}

http.listen(3000, function () {
    console.log('listening on *:3000');
});

function playerById(id) {
    var i;
    for (i = 0; i < players.length; i++) {
        if (players[i].playerId == id)
            return players[i];
    }
    return false;
}