var w = window,
  d = document,
  e = d.documentElement,
  g = d.getElementsByTagName('body')[0],
  width = w.innerWidth || e.clientWidth || g.clientWidth,
  height = w.innerHeight || e.clientHeight || g.clientHeight;

var game = new Phaser.Game(width, height, Phaser.CANVAS, 'robits', { preload: preload, create: create, update: update, render: render });

function preload() {
  game.load.image('background', 'assets/background.png');

}

function create() {

}

function update() {

}

function render() {

}