window.hud = {};

hud.defaultSettings = {
    hud: {
        panels: {
            'chat-panel': {
                position: [0, 0]
            },
            'help': {
                visible: false
            },
            'settings': {
                visible: false
            }
        }

    }
};

var panels = ['plan', 'settings', 'help', 'chat-panel', 'scoreboard'];

$(function () {
    /* The hud container (#robits) should stretch to the full size of the
     * visible window to maximize the use of space */
    $('#robits').width($('body').width()).height(gameData.height);

    $( ".draggable").draggable({
        stop: function() {
            var name = $(this).attr('id');

            var panelOverwrite = {};
            panelOverwrite[name] = {
                position: [$(this).css('left'), $(this).css('top')]
            };

            _.merge(settings.hud.panels, panelOverwrite);
            settings.save();
        }
    });

    $('#chat').submit(function (e) {
        var $chat = $('#chat');
        communication.chat($chat.find('input').val());
        $chat.find('input').val('');
        e.preventDefault();
    });

    // Apply panel settings and behavior
    _.each(panels, function(name) {
        var $panel = $('#'+name);
        $('#toggle-'+name).click(function() {

            $panel.fadeToggle(400, function() {
                var panelOverwrite = {};
                panelOverwrite[name] = {
                    visible: !($panel.css('display') === 'none')
                };

                _.merge(settings.hud.panels, panelOverwrite);
                settings.save();
            });
        });

        var panelSettings = settings.hud.panels[name];

        if(panelSettings && panelSettings.position) {
            $panel.css('left', panelSettings.position[0])
                    .css('top', panelSettings.position[1]);
        }

        if(panelSettings && !_.isUndefined(panelSettings.visible)) {
            $panel.css('display', panelSettings.visible ? 'inherit' : 'none');
        }
    });

    $('#toggle-plan-contents').click(function() {
       $(this).toggleClass('glyphicon-chevron-down').toggleClass('glyphicon-chevron-right');
    });

    $('#submit-moves').click(function (e) {

        var instructions = _.map($('#chosen-moves').find('.instruction'), function (command) {
            return $(command).find('img').data().move;
        });
        if (instructions.length != MOVES_PER_TURN) {
            alert('Must select 5 evil moves!');
        } else {
            _.each(instructions, function (instruction) {
                gameData.addInstruction(gameData.localPlayer, instruction);
            });

            communication.localPlayerReady();
        }

        e.preventDefault();
    });

    $('#player-name').blur(updateSettings);
    $('#config').submit(updateSettings);

    function updateSettings(e) {
        var rawName = $('#player-name').val();
        gameData.localPlayer.data.name = rawName;
        settings.updateSetting('localPlayerName', rawName);

        communication.localPlayerUpdated();

        if(e) {
            e.preventDefault();
        }
    }

    $('#audio')
        .prop('checked', (settings.musicOn === 'true'))
        .change(function (e) {
            if ($(this).is(':checked')) {
                sound.play();
                sound.fade(0, 0.5, 1000);
                settings.musicOn = true;
            } else {
                sound.fade(0.5, 0, 1000, function () {
                    sound.pause();
                });
                settings.musicOn = false;
            }
            settings.save();
        });

    hud.displayPossibleMoves = function () {
        var NUM_MOVES_TO_GENERATE = 10;

        var possibleMovesDiv = $('#possible-moves').empty();
        var chosenMovesDiv = $('#chosen-moves').empty();

        var imgId = 0;

        function getMoveImage(id, direction) {
            return $("<img id='"+ id +"' data-do-not-drag='true' data-move='" + direction + "' data-src='assets/arrow-" + direction + ".png' src='assets/arrow-" + direction + ".png' class='img-rounded amove' alt='" + direction + "'>");
        }

        _.each(generateNewMoves(), function (move) {
            imgId++;
            possibleMovesDiv.append(getMoveImage(imgId, move));
        });

        /**
         * Set the callback for clicking on a move
         */
        $(".amove").click(function (e) {
            var $this = $(this);
            var id = this.getAttribute('id');
            if (chosenMovesDiv.children().length == MOVES_PER_TURN) {
                // cannot add another move but can remove moves
                if ($this.hasClass('chosen')) {
                    $this.removeClass('chosen');
                    $('.instruction[id=' + id + ']').remove();
                }
            } else {
                // can still add and delete
                if ($this.hasClass('chosen')) {
                    $this.removeClass('chosen');
                    $('.instruction[id=' + id + ']').remove();
                } else {

                    $this.addClass('chosen');
                    var instruction = $('<li class="instruction" id="' + id + '"></li>');
                    instruction.append(getMoveImage('chosen-move-' + id, this.dataset.move));
                    chosenMovesDiv.append(instruction);
                }
            }
        });

        /**
         * Generate 10 possible moves from the move array
         * Display them in the browser to the player
         */
        function generateNewMoves() {
            var newMoves = [];
            _.times(NUM_MOVES_TO_GENERATE, function () {
                newMoves.push(_.sample(['left', 'right', 'up', 'down']))
            });
            return newMoves;
        }
    }
});