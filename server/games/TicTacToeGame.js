const GameInterface = require('./GameInterface');

class TicTacToeGame extends GameInterface {
  init() {
    return {
      board: Array(9).fill(null),
      currentPlayer: 0, // Index of the player in the players array
      winner: null,
      status: 'waiting', // waiting, playing, won, draw
      winningPattern: null // For highlighting the winning line
    };
  }

  makeMove(gameState, playerIndex, move) {
    if (!this.isValidMove(gameState, playerIndex, move)) {
      return gameState;
    }

    const newGameState = {
      ...gameState,
      board: [...gameState.board]
    };

    // Update the board with the player's symbol
    newGameState.board[move.index] = playerIndex;

    // Check if the game is over
    const gameOverResult = this.checkGameOver(newGameState);
    if (gameOverResult.isOver) {
      newGameState.status = gameOverResult.status;
      newGameState.winner = gameOverResult.winner;
      newGameState.winningPattern = gameOverResult.winningPattern;
    } else {
      // Set the next player's turn
      newGameState.currentPlayer = this.getNextPlayer(newGameState);
    }

    return newGameState;
  }

  isValidMove(gameState, playerIndex, move) {
    // Check if it's the player's turn
    if (gameState.currentPlayer !== playerIndex) return false;

    // Check if the game is still in progress
    if (gameState.status !== 'playing') return false;

    // Check if the cell is empty
    if (gameState.board[move.index] !== null) return false;

    return true;
  }

  getNextPlayer(gameState) {
    return gameState.currentPlayer === 0 ? 1 : 0;
  }

  checkGameOver(gameState) {
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6]             // diagonals
    ];

    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (
        gameState.board[a] !== null &&
        gameState.board[a] === gameState.board[b] &&
        gameState.board[a] === gameState.board[c]
      ) {
        return {
          isOver: true,
          status: 'won',
          winner: gameState.board[a],
          winningPattern: pattern
        };
      }
    }

    // Check for draw
    if (!gameState.board.includes(null)) {
      return {
        isOver: true,
        status: 'draw',
        winner: null,
        winningPattern: null
      };
    }

    return {
      isOver: false
    };
  }

  getMaxPlayers() {
    return 2; // Tic Tac Toe is a 2-player game
  }

  getPlayerSetup(playerIndex) {
    return {
      symbol: playerIndex === 0 ? 'X' : 'O'
    };
  }
}

module.exports = TicTacToeGame;
