var _ = require('underscore');

module.exports = function(io) {
    function handleCommand(room, socket, command, args) {
        switch(command) {
            case 'kick':
                _.each(args, function(name) {
                    var player = room.getPlayerByName(name);
                    if(player) {
                        var playerSocket = io.sockets.connected[player.id];
                        playerSocket.emit('kicked', 'Kicked by ' + room.getPlayerById(socket.id).getName());
                        playerSocket.disconnect();
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

    return {
        runCommandOrShareMessage: function (room, socket, message) {
            var commandArr = message.match(/^#(\S+)\s*(.*)/);

            var command = (commandArr && commandArr.length > 0) ? commandArr[1] : undefined;
            var commandArgs = (commandArr && commandArr.length > 1) ? commandArr[2].split(/s+/) : [];
            var useCommand = false;

            if(!_.isUndefined(command)) {
                useCommand = handleCommand(room, socket, command, commandArgs);
            }

            if(!useCommand) {
                io.to(socket.room).emit('chat', room.getPlayerById(socket.id).getName() + "> " + message);
            }
        }
    };
};