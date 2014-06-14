var w = window,
    d = document,
    e = d.documentElement,
    g = d.getElementsByTagName('body')[0],
    width = w.innerWidth || e.clientWidth || g.clientWidth,
    height = w.innerHeight || e.clientHeight || g.clientHeight;

var game = new Phaser.Game(width, height, Phaser.CANVAS, 'robits', { preload: preload, create: create, update: update, render: render });
var player, board, map;
var cursors;
var widthInTiles, heightInTiles, tileWidth;
var keyboardMovement = true;
var stepInProgress,
    ignoreArrowKeys;
var socket = io();

function preload() {
    game.load.tilemap('map', 'assets/map1.json', null, Phaser.Tilemap.TILED_JSON);
    game.load.image('tileset', 'assets/tileset.png');
    game.load.image('robot', 'assets/robot.png');
}

function create() {
    cursors = game.input.keyboard.createCursorKeys();

    map = game.add.tilemap('map');
    map.addTilesetImage('tileset');

    var layer = map.createLayer('Tile Layer 1');
    layer.resizeWorld();

    game.physics.startSystem(Phaser.Physics.ARCADE);


    player = game.add.sprite(64, 64, 'robot');
    player.data = {
        movementQueue: []
    };
    game.physics.arcade.enable(player);

    player.anchor.setTo(0.5, 0.5);

    game.camera.follow(player);

    widthInTiles = 16;
    heightInTiles = 12;
    tileWidth = 128;
}

function update() {
    tryArrowKeyMovement();
}

function render() {

}

function tryArrowKeyMovement() {
    if(!ignoreArrowKeys) {
        var angle;
        if (cursors.right.isDown) {
            angle = 0;
        } else if (cursors.left.isDown) {
            angle = 180;
        } else if (cursors.down.isDown) {
            angle = 90;
        } else if (cursors.up.isDown) {
            angle = 270;
        }
        if(!_.isUndefined(angle)) {
            player.data.movementQueue.push(_.partial(moveAtAngle, angle));
        }
        ignoreArrowKeys = true;
        setTimeout(function(){
            ignoreArrowKeys = false;
        }, 50);
    }

    if(!stepInProgress) {
        var nextStep = player.data.movementQueue.shift();
        if(nextStep) {
            nextStep();
        }
    }

    function moveAtAngle(angle) {
        stepInProgress = true;

        var distance = 128;
        var speed = 60;
        var time = distance / speed;

        this.target = [player.x + distance, player.y];

        game.physics.arcade.velocityFromAngle(angle || 0, speed, player.body.velocity);

        setTimeout(function() {
            player.body.velocity.x = 0;
            player.body.velocity.y = 0;
            stepInProgress = false;
        }, time * 1000);
    }

}

function moveOverTiles(entity, xTiles, yTiles) {

    if(!map) {
        console.error("No tilemap defined");
        return;
    } else if(!keyboardMovement) {
        return;

    }

    keyboardMovement = false;
    setTimeout(function() {
        keyboardMovement = true;
    }, 100);

    entity.x = Phaser.Math.clamp(entity.x + (xTiles * tileWidth), tileWidth / 2, map.widthInPixels - (tileWidth / 2));
    entity.y = Phaser.Math.clamp(entity.y + (yTiles * tileWidth), tileWidth / 2, map.heightInPixels - (tileWidth / 2));
}