const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
const server = http.createServer(app);

// Socket.io setup with CORS
const io = new Server(server, {
  cors: {
    origin: "*", // In production, this should be restricted
    methods: ["GET", "POST"]
  }
});

// Game rooms storage
const rooms = {};

// Socket connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create a new game room
  socket.on('createRoom', ({ username }) => {
    const roomId = uuidv4().substring(0, 6); // Shorter ID for easier sharing

    rooms[roomId] = {
      id: roomId,
      players: [{
        id: socket.id,
        username,
        symbol: 'X'
      }],
      gameState: {
        board: Array(9).fill(null),
        currentPlayer: 'X',
        winner: null,
        status: 'waiting' // waiting for second player
      },
      spectators: []
    };

    socket.join(roomId);
    console.log(`Room created: ${roomId} by ${username}`);
    socket.emit('roomCreated', { roomId, symbol: 'X', gameState: rooms[roomId].gameState });
  });

  // Join an existing game room
  socket.on('joinRoom', ({ roomId, username }) => {
    // Check if room exists
    if (!rooms[roomId]) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const room = rooms[roomId];

    // Check if room is full (for TicTacToe, max 2 players)
    if (room.players.length >= 2) {
      // Add as spectator
      room.spectators.push({
        id: socket.id,
        username
      });
      socket.join(roomId);
      socket.emit('joinedAsSpectator', {
        roomId,
        gameState: room.gameState,
        players: room.players.map(p => ({ username: p.username, symbol: p.symbol }))
      });
      io.to(roomId).emit('spectatorJoined', { username });
      return;
    }

    // Add as second player
    room.players.push({
      id: socket.id,
      username,
      symbol: 'O'
    });

    // Update game status to playing
    room.gameState.status = 'playing';

    socket.join(roomId);
    socket.emit('roomJoined', { roomId, symbol: 'O', gameState: room.gameState });

    // Notify all clients in the room about the new player
    io.to(roomId).emit('gameStart', {
      gameState: room.gameState,
      players: room.players.map(p => ({ username: p.username, symbol: p.symbol }))
    });
  });

  // Handle game moves
  socket.on('makeMove', ({ roomId, index }) => {
    if (!rooms[roomId]) return;

    const room = rooms[roomId];
    const player = room.players.find(p => p.id === socket.id);

    if (!player) return; // Not a player in the room
    if (room.gameState.status !== 'playing') return; // Game not in progress
    if (room.gameState.currentPlayer !== player.symbol) return; // Not this player's turn
    if (room.gameState.board[index] !== null) return; // Square already filled

    // Update the game board
    const newBoard = [...room.gameState.board];
    newBoard[index] = player.symbol;

    // Update game state
    room.gameState.board = newBoard;
    room.gameState.currentPlayer = player.symbol === 'X' ? 'O' : 'X';

    // Check for winner
    const winner = checkWinner(newBoard);
    if (winner) {
      room.gameState.winner = winner;
      room.gameState.status = 'won';
    } else if (!newBoard.includes(null)) {
      room.gameState.status = 'draw';
    }

    // Broadcast updated game state to all players in the room
    io.to(roomId).emit('gameStateUpdate', { gameState: room.gameState });
  });

  // Handle game reset
  socket.on('resetGame', ({ roomId }) => {
    if (!rooms[roomId]) return;

    const room = rooms[roomId];

    // Reset game state
    room.gameState = {
      board: Array(9).fill(null),
      currentPlayer: 'X',
      winner: null,
      status: 'playing'
    };

    // Broadcast reset to all players
    io.to(roomId).emit('gameReset', { gameState: room.gameState });
  });

  // Handle player disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);

    // Find rooms where the player is
    for (const roomId in rooms) {
      const room = rooms[roomId];

      // Check if disconnected user was a player
      const playerIndex = room.players.findIndex(p => p.id === socket.id);

      if (playerIndex !== -1) {
        // Remove the player
        const disconnectedPlayer = room.players[playerIndex];
        room.players.splice(playerIndex, 1);

        // If no players left, remove the room
        if (room.players.length === 0) {
          delete rooms[roomId];
          console.log(`Room ${roomId} deleted (no players left)`);
        } else {
          // Notify remaining users
          io.to(roomId).emit('playerDisconnected', {
            username: disconnectedPlayer.username,
            symbol: disconnectedPlayer.symbol,
            gameState: {
              ...room.gameState,
              status: 'waiting' // Set status back to waiting
            }
          });
        }
        break;
      }

      // Check if disconnected user was a spectator
      const spectatorIndex = room.spectators?.findIndex(s => s.id === socket.id);
      if (spectatorIndex !== -1) {
        const disconnectedSpectator = room.spectators[spectatorIndex];
        room.spectators.splice(spectatorIndex, 1);
        io.to(roomId).emit('spectatorLeft', { username: disconnectedSpectator.username });
      }
    }
  });
});

// Helper function to check for a winner
function checkWinner(board) {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6]             // diagonals
  ];

  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  return null;
}

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
