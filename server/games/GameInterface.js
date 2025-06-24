// Interface for game implementations
class GameInterface {
  constructor() {
    if (this.constructor === GameInterface) {
      throw new Error("Abstract class 'GameInterface' cannot be instantiated directly");
    }
  }

  // Initialize a new game state
  init() {
    throw new Error("Method 'init' must be implemented");
  }

  // Process a player's move
  makeMove(gameState, playerId, move) {
    throw new Error("Method 'makeMove' must be implemented");
  }

  // Check if the game is over and determine the winner
  checkGameOver(gameState) {
    throw new Error("Method 'checkGameOver' must be implemented");
  }

  // Get the next player
  getNextPlayer(gameState) {
    throw new Error("Method 'getNextPlayer' must be implemented");
  }

  // Validate a move
  isValidMove(gameState, playerId, move) {
    throw new Error("Method 'isValidMove' must be implemented");
  }

  // Return the maximum number of players allowed
  getMaxPlayers() {
    throw new Error("Method 'getMaxPlayers' must be implemented");
  }

  // Get game-specific player setup
  getPlayerSetup(playerIndex) {
    throw new Error("Method 'getPlayerSetup' must be implemented");
  }
}

module.exports = GameInterface;
