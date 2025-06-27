const GameInterface = require('./GameInterface');

class Connect4Game extends GameInterface {
  init() {
    return {
      // Standard Connect 4 board is 7 columns × 6 rows
      board: Array(7).fill().map(() => Array(6).fill(null)),
      currentPlayer: 0, // Index of the player in the players array
      winner: null,
      status: 'waiting', // waiting, playing, won, draw
      winningCells: null // For highlighting winning sequence
    };
  }

  makeMove(gameState, playerIndex, move) {
    if (!this.isValidMove(gameState, playerIndex, move)) {
      return gameState;
    }

    const newGameState = {
      ...gameState,
      board: gameState.board.map(col => [...col]) // Deep clone the board
    };

    // In Connect 4, players choose a column and the piece drops to the lowest empty position
    const column = move.column;
    let row = 0;

    // Find the first empty cell in the column (from bottom to top)
    for (let r = 5; r >= 0; r--) {
      if (newGameState.board[column][r] === null) {
        row = r;
        newGameState.board[column][row] = playerIndex;
        break;
      }
    }

    // Check if the game is over
    const gameOverResult = this.checkGameOver(newGameState, column, row, playerIndex);
    if (gameOverResult.isOver) {
      newGameState.status = gameOverResult.status;
      newGameState.winner = gameOverResult.winner;
      newGameState.winningCells = gameOverResult.winningCells;
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

    // Check if the column exists
    if (move.column < 0 || move.column >= 7) return false;

    // Check if the column is not full
    if (gameState.board[move.column][0] !== null) return false;

    return true;
  }

  getNextPlayer(gameState) {
    return gameState.currentPlayer === 0 ? 1 : 0;
  }

  checkGameOver(gameState, lastColumn, lastRow, playerIndex) {
    // Only check for a win based on the last piece placed
    const board = gameState.board;
    const directions = [
      [1, 0],   // horizontal
      [0, 1],   // vertical
      [1, 1],   // diagonal /
      [1, -1]   // diagonal \
    ];

    for (const [dx, dy] of directions) {
      let winningCells = [[lastColumn, lastRow]];

      // Check in both directions along this line
      for (const multiplier of [1, -1]) {
        let count = 0;
        let x = lastColumn + dx * multiplier;
        let y = lastRow + dy * multiplier;

        while (
          x >= 0 && x < 7 && y >= 0 && y < 6 &&
          board[x][y] === playerIndex &&
          count < 3 // Need to find 3 more to have 4 in a row
        ) {
          winningCells.push([x, y]);
          count++;
          x += dx * multiplier;
          y += dy * multiplier;
        }
      }

      // If we found at least 4 in a row
      if (winningCells.length >= 4) {
        return {
          isOver: true,
          status: 'won',
          winner: playerIndex,
          winningCells
        };
      }
    }

    // Check for draw (full board)
    const isBoardFull = board.every(column => column[0] !== null);
    if (isBoardFull) {
      return {
        isOver: true,
        status: 'draw',
        winner: null,
        winningCells: null
      };
    }

    return {
      isOver: false
    };
  }

  getMaxPlayers() {
    return 2; // Connect 4 is a 2-player game
  }

  getPlayerSetup(playerIndex) {
    // Players are typically Red and Yellow in Connect 4
    return {
      color: playerIndex === 0 ? 'red' : 'yellow'
    };
  }
}

module.exports = Connect4Game;
