var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var players = [];
var currentUser = 0;
var player = function(value) {
   var playerId = value

   return {
     playerId: playerId
   }
}
var addUser = function(sessionId) {
currentUser = currentUser + 1
players.push( new player(sessionId))
console.log("---WE HAVE THE FOLLOWING PLAYERS CONNECTED----")
for(i = 0; i < players.length; i++){
     var existingPlayer = players[i]
    console.log('player: ' + existingPlayer.playerId)
    
}
if(io.sockets.connected[sessionId]) {
    console.log('sending player: ' + sessionId + ' their id.' )
    io.sockets.connected[sessionId].emit('receive id', existingPlayer.playerId)
    }
    io.emit('player joined', existingPlayer.playerId);
    console.log('player joined broadcast sent')
}
var dropUser = function() {
  currentUser = currentUser -1
players.splice(players.indexOf(currentUser), 1);
}

app.use(express.static(__dirname));


    io.on('connection', function(socket){
      console.log('User: connected');
    addUser(socket.id)
    socket.on('disconnect', function(){
        console.log('User: ' + currentUser + ' disconnected');
           dropUser()
      });
    
          });

http.listen(3000, function(){
  console.log('listening on *:3000');
});
