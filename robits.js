var w = window,
    d = document,
    e = d.documentElement,
    g = d.getElementsByTagName('body')[0],
    width = w.innerWidth || e.clientWidth || g.clientWidth,
    height = w.innerHeight || e.clientHeight || g.clientHeight;

var game = new Phaser.Game(width, height, Phaser.CANVAS, 'robits', { preload: preload, create: create, update: update, render: render });
var player, board, tilemap;
var cursors;
var widthInTiles, heightInTiles;

function preload() {
    game.load.image('robot', 'assets/robot.png');
    game.load.image('floor', 'assets/floor.jpg');
}

function create() {
    cursors = game.input.keyboard.createCursorKeys();
    board = game.add.tileSprite(0, 0, width, height, 'floor');
    player = game.add.sprite(width / 2, height / 2, 'robot');

    widthInTiles = 16;
    heightInTiles = 12;
}

function update() {
    tryArrowKeyMovement();
}

function render() {

}

function tryArrowKeyMovement() {
    if (cursors.up.isDown) {
        moveOverTiles(player, 0, -1);
    } else if (cursors.down.isDown) {
        moveOverTiles(player, 0, 1);
    } else if (cursors.left.isDown) {
        moveOverTiles(player, -1, 0);
    } else if (cursors.right.isDown) {
        moveOverTiles(player, 1, 0);
    }
}

function moveOverTiles(entity, xTiles, yTiles) {
    if(!tilemap) {
        console.error("No tilemap defined");
        return;
    }
    var currentTile = tilemap.getTile(entity.x, entity.y);
    var tileWidth = currentTile.width;

    entity.x = Phaser.Math.clamp(entity.x + (xTiles * tileWidth), 0, width);
    entity.y = Phaser.Math.clamp(entity.y + (yTiles * tileWidth), 0, height);
}