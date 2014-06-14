var w = window,
  d = document,
  e = d.documentElement,
  g = d.getElementsByTagName('body')[0],
  width = w.innerWidth || e.clientWidth || g.clientWidth,
  height = w.innerHeight || e.clientHeight || g.clientHeight;

var game = new Phaser.Game(width, height, Phaser.CANVAS, 'robits', { preload: preload, create: create, update: update, render: render });
var player, board;

function preload() {
  game.load.image('robot', 'assets/robot.png');
  game.load.image('floor', 'assets/floor.jpg');
}

function create() {
    board = game.add.tileSprite(0, 0, width, height, 'floor');
    player = game.add.sprite(width / 2, height / 2, 'robot');
}

function update() {

}

function render() {

}