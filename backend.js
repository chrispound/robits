var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var players = [];
var currentUser = 0;
var player = function(id) {
   var id = id
   
   function getId(){
       return id;
   }
}
var addUser = function() {
currentUser = currentUser + 1
players.push( new player(currentUser))
console.log("---WE HAVE THE FOLLOWING PLAYERS CONNECTED----")
for(i = 0; i < players.length; i++){
    console.log(players[i].id)
    
}

    io.emit('player joined', currentUser);
    console.log('player joined broadcast sent')
}
var dropUser = function() {
  currentUser = currentUser -1
players.splice(players.indexOf(currentUser), 1);
}

app.use(express.static(__dirname));


    io.on('connection', function(socket){
      console.log('User: connected');
                
    socket.on('disconnect', function(){
        console.log('User: ' + currentUser + ' disconnected');
           dropUser()
      });
        socket.on('player joined', addUser());
          });

http.listen(3000, function(){
  console.log('listening on *:3000');
});
