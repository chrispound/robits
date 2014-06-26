// TODO decouple from other modules

window.collisions = {
  hitCheckpoint: function(sprite, tile) {
    if(!_.contains(tile.playersTouched, sprite.data.id)) {

      console.log("Player " + sprite.data.id + " scored a checkpoint");
      tile.playersTouched.push(sprite.data.id);

      var allCheckpointsHit = map.getCheckpointsTouched(sprite).length === map.checkpointTiles.length;

      if(allCheckpointsHit) {
          clearSpriteMovement(sprite);
        if(sprite.data.id === gameData.localPlayer.data.id) {
          communication.localPlayerWins();
          console.log("Player touched last checkpoint, send win event!");
        }
      }

      communication.requestUpdate();

      // useful later if we want to update each client with the players checkpoint data
      // socket.emit("player checkpoint", sprite.data.id);
    }
  },

  goThroughPortal: function(sprite, tile) {

    // find a random portal that is not the current portal
    // assign the sprite body x and y to that tile.
    if(!sprite.data.isTeleporting) {

      sprite.data.isTeleporting = true;
      var nextPortal = map.portalTiles[(map.portalTiles.indexOf(tile) + 1) % map.portalTiles.length];
      var newPosition = getTileCenter(nextPortal);
      sprite.body.x = newPosition.x - (nextPortal.width / 2);
      sprite.body.y = newPosition.y - (nextPortal.height / 2);
    }

    return false;
  },

  /**
   * Called when a sprite collides with a hole tile.
   * The sprite is returned to their starting position
   * and their movement is halted.
   */
  fallInHole: function(sprite, tile) {
    sprite.damage(1);
    gameData.playerLostEnergy(sprite);
    if(sprite.health <= 0 && sprite.data.id === gameData.localPlayer.data.id) {
      console.log('the local player has died');
      communication.localPlayerDied();
    }
    sprite.data.movementQueue = [];
    clearSpriteMovement(sprite);
    resetToStart(sprite);
    return false;
  }
};