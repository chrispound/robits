var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var users = [];
var currentUser = 0

var addUser = function() {
currentUser = currentUser + 1
}
var dropUser = function() {
  currentUser = currentUser -1
}

app.use(express.static(__dirname));


    io.on('connection', function(socket){
    addUser()
      console.log('User: '+ currentUser + ' connected');
    socket.on('disconnect', function(){
        console.log('User: ' + currentUser + ' disconnected');
           dropUser()
      });
          });

http.listen(3000, function(){
  console.log('listening on *:3000');
});
