window.hud = {};

$(function () {
    $('#chat').submit(function (e) {
        var $chat = $('#chat');
        communication.chat($chat.find('input').val());
        $chat.find('input').val('');
        e.preventDefault();
    });

    if(DEBUG_MODE) {
        $('#possible-moves').hide();
    }

    $('#submit-moves').click(function(e) {

        var instructions = _.map($('#chosen-moves').find('.instruction'), function (command) {
            return $(command).html();
        });
        if(instructions.length != MOVES_PER_TURN) {
            alert('Must select 5 evil moves!');
        } else {
            _.each(instructions, function (instruction) {
                gameData.addInstruction(gameData.localPlayer, instruction);
            });

            communication.localPlayerReady();
        }

        e.preventDefault();
    });

    $('#player-name').blur(updateConfig);
    $('#config').submit(updateConfig);
    
    function updateConfig(e) {
        gameData.localPlayer.data.name = $('#player-name').val();
        settings.updateSetting('localPlayerName', gameData.localPlayer.data.name);

        communication.localPlayerUpdated();

        e.preventDefault();
    }

    $('#audio')
        .prop('checked', (settings.musicOn === 'true'))
        .change(function(e) {
            if($(this).is(':checked')) {
                sound.play();
                sound.fade(0, 0.5, 1000);
                settings.updateSetting('musicOn', true);
            } else {
                sound.fade(0.5, 0, 1000, function() {
                    sound.pause();
                });
                settings.updateSetting('musicOn', false);
            }
        });

    hud.displayPossibleMoves = function() {
        var NUM_MOVES_TO_GENERATE = 10;

        var possibleMovesDiv = $('#possible-moves').empty();
        var chosenMovesDiv = $('#chosen-moves').empty();

        var imgId = 0;
        _.each(generateNewMoves(), function(move) {
            imgId++;
            possibleMovesDiv.append(
                    "<img id='move"+ imgId +"' data-move='" + move + "' data-src='assets/arrow-" + move + ".png' src='assets/arrow-" + move + ".png' class='img-rounded amove' alt='" + move + "' style='width: 96px; height: 96px;'>"
            );
        });

        /**
         * Set the callback for clicking on a move
         */
        $(".amove").click(function (e) {
            var $this = $(this);
            var id = this.getAttribute('id');
            if(chosenMovesDiv.children().length == MOVES_PER_TURN) {
                // cannot add another move but can remove moves
                if($this.hasClass('chosen')) {
                    $this.removeClass('chosen');
                    $('.instruction[id='+id+']').remove();
                }
            } else {
                // can still add and delete
                if($this.hasClass('chosen')) {
                    $this.removeClass('chosen');
                    $('.instruction[id='+id+']').remove();
                } else {
                    $this.addClass('chosen');
                    chosenMovesDiv.append('<li class="instruction" id="' + id + '">' + this.dataset.move + '</li>');
                }
            }
        });

        /**
         * Generate 10 possible moves from the move array
         * Display them in the browser to the player
         */
        function generateNewMoves() {
            var newMoves = [];
            _.times(NUM_MOVES_TO_GENERATE, function() {newMoves.push(_.sample(['left', 'right', 'up', 'down']))});
            return newMoves;
        }
    }
});