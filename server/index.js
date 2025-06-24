const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// Import game implementations
const TicTacToeGame = require('./games/TicTacToeGame');
const Connect4Game = require('./games/Connect4Game');

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

// Game implementations registry
const gameTypes = {
  'tic-tac-toe': TicTacToeGame,
  'connect4': Connect4Game,
};

// Game rooms storage
const rooms = {};

// Socket connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Create a new game room
  socket.on('createRoom', ({ username, gameType = 'tic-tac-toe' }) => {
    // Validate game type
    if (!gameTypes[gameType]) {
      socket.emit('error', { message: `Invalid game type: ${gameType}` });
      return;
    }

    const roomId = uuidv4().substring(0, 6); // Shorter ID for easier sharing
    const GameClass = gameTypes[gameType];
    const gameInstance = new GameClass();

    // Initialize game state
    const initialGameState = gameInstance.init();

    // Setup player with game-specific properties
    const playerSetup = gameInstance.getPlayerSetup(0); // First player (0-indexed)

    rooms[roomId] = {
      id: roomId,
      gameType,
      gameInstance,
      players: [{
        id: socket.id,
        username,
        index: 0, // Player index (0-indexed)
        ...playerSetup
      }],
      gameState: initialGameState,
      spectators: []
    };

    socket.join(roomId);
    console.log(`Room created: ${roomId} by ${username}, game type: ${gameType}`);

    socket.emit('roomCreated', {
      roomId,
      gameType,
      playerIndex: 0,
      playerInfo: playerSetup,
      gameState: initialGameState
    });
  });

  // Join an existing game room
  socket.on('joinRoom', ({ roomId, username }) => {
    // Check if room exists
    if (!rooms[roomId]) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    const room = rooms[roomId];
    const gameInstance = room.gameInstance;
    const maxPlayers = gameInstance.getMaxPlayers();

    // Check if room is full
    if (room.players.length >= maxPlayers) {
      // Add as spectator
      room.spectators.push({
        id: socket.id,
        username
      });
      socket.join(roomId);
      socket.emit('joinedAsSpectator', {
        roomId,
        gameType: room.gameType,
        gameState: room.gameState,
        players: room.players.map(p => ({
          username: p.username,
          index: p.index,
          ...p // Include game-specific player info (like symbol or color)
        }))
      });
      io.to(roomId).emit('spectatorJoined', { username });
      return;
    }

    // Add as player
    const playerIndex = room.players.length;
    const playerSetup = gameInstance.getPlayerSetup(playerIndex);

    room.players.push({
      id: socket.id,
      username,
      index: playerIndex,
      ...playerSetup
    });

    // Update game status to playing if we have enough players
    if (room.players.length >= 2) {
      room.gameState.status = 'playing';
    }

    socket.join(roomId);
    socket.emit('roomJoined', {
      roomId,
      gameType: room.gameType,
      playerIndex,
      playerInfo: playerSetup,
      gameState: room.gameState
    });

    // Notify all clients in the room about the new player
    io.to(roomId).emit('gameStart', {
      gameState: room.gameState,
      players: room.players.map(p => ({
        username: p.username,
        index: p.index,
        ...p // Include game-specific player info
      }))
    });
  });

  // Handle game moves
  socket.on('makeMove', ({ roomId, move }) => {
    if (!rooms[roomId]) return;

    const room = rooms[roomId];
    const player = room.players.find(p => p.id === socket.id);

    if (!player) return; // Not a player in the room

    const gameInstance = room.gameInstance;
    const playerIndex = player.index;

    // Process the move through the game instance
    const updatedGameState = gameInstance.makeMove(room.gameState, playerIndex, move);

    // Only update state if the move was valid and changed the state
    if (updatedGameState !== room.gameState) {
      room.gameState = updatedGameState;

      // Broadcast updated game state to all players in the room
      io.to(roomId).emit('gameStateUpdate', { gameState: room.gameState });
    }
  });

  // Handle game reset
  socket.on('resetGame', ({ roomId }) => {
    if (!rooms[roomId]) return;

    const room = rooms[roomId];
    const gameInstance = room.gameInstance;

    // Reset game state
    room.gameState = gameInstance.init();
    room.gameState.status = 'playing';

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
          // Update game state
          room.gameState.status = 'waiting';

          // Notify remaining users
          io.to(roomId).emit('playerDisconnected', {
            username: disconnectedPlayer.username,
            playerIndex: disconnectedPlayer.index,
            gameState: room.gameState
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

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
