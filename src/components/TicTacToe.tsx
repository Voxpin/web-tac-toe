import { useState, useEffect, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

// Types for our game
type Player = 'X' | 'O' | null
type GameStatus = 'playing' | 'won' | 'draw' | 'waiting'
type GameState = {
  board: Player[]
  currentPlayer: number
  winner: Player | number | null
  status: GameStatus
  winningPattern?: number[] | null
}

// Types for multiplayer
type RoomPlayer = {
  username: string
  index: number
  symbol?: string
  color?: string
}

type MultiplayerState = {
  isConnected: boolean
  roomId: string | null
  gameType: string
  isCreator: boolean
  playerIndex: number | null
  playerInfo: any
  opponentName: string | null
  spectators: string[]
}

// Component for an individual square on the board
const Square = ({ value, onClick, highlight = false }: { value: Player; onClick: () => void; highlight?: boolean }) => {
  return (
    <button
      className={`aspect-square border border-gray-400 text-6xl font-bold flex items-center justify-center
                 bg-white text-black hover:bg-gray-100 transition-colors ${highlight ? 'bg-yellow-200' : ''}`}
      onClick={onClick}
    >
      {value}
    </button>
  )
}

// Component for the game board
const Board = ({
  squares,
  onClick,
  winningPattern
}: {
  squares: Player[];
  onClick: (i: number) => void;
  winningPattern?: number[] | null
}) => {
  return (
    <div className="grid grid-cols-3 w-full max-w-sm gap-[5px] mx-auto">
      {squares.map((square, i) => (
        <Square
          key={i}
          value={square}
          onClick={() => onClick(i)}
          highlight={winningPattern?.includes(i)}
        />
      ))}
    </div>
  )
}

export const TicTacToe = () => {
  // Socket connection
  const [socket, setSocket] = useState<Socket | null>(null)

  // Multiplayer state
  const [multiplayerState, setMultiplayerState] = useState<MultiplayerState>({
    isConnected: false,
    roomId: null,
    gameType: 'tic-tac-toe',
    isCreator: false,
    playerIndex: null,
    playerInfo: null,
    opponentName: null,
    spectators: []
  })

  // Local states for username and room ID input
  const [username, setUsername] = useState('')
  const [roomIdInput, setRoomIdInput] = useState('')
  const [showMultiplayer, setShowMultiplayer] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Game state
  const [gameState, setGameState] = useState<GameState>({
    board: Array(9).fill(null),
    currentPlayer: 0,
    winner: null,
    status: 'playing'
  })

  // Player name state
  const [players, setPlayers] = useState<Record<number, string>>({
    0: 'Player 1',
    1: 'Player 2'
  })

  // Game message
  const [gameMessage, setGameMessage] = useState<string>(`${players[0]}'s turn`)

  // Connect to Socket.io server
  useEffect(() => {
    // Only connect if multiplayer mode is enabled
    if (showMultiplayer) {
      const newSocket = io('http://localhost:3001')
      setSocket(newSocket)

      // Socket connection event handlers
      newSocket.on('connect', () => {
        setMultiplayerState(prev => ({ ...prev, isConnected: true }))
        setError(null)
      })

      newSocket.on('connect_error', () => {
        setError('Could not connect to the server. Please try again.')
        setMultiplayerState(prev => ({ ...prev, isConnected: false }))
      })

      // Clean up on unmount
      return () => {
        newSocket.disconnect()
      }
    }
  }, [showMultiplayer])

  // Socket event handlers for multiplayer
  useEffect(() => {
    if (!socket) return

    // Room created event
    socket.on('roomCreated', ({ roomId, gameType, playerIndex, playerInfo, gameState: serverGameState }) => {
      setMultiplayerState(prev => ({
        ...prev,
        roomId,
        gameType,
        playerIndex,
        playerInfo,
        isCreator: true
      }))
      setGameState(serverGameState)
      setGameMessage('Waiting for opponent to join...')
    })

    // Room joined event
    socket.on('roomJoined', ({ roomId, gameType, playerIndex, playerInfo, gameState: serverGameState }) => {
      setMultiplayerState(prev => ({
        ...prev,
        roomId,
        gameType,
        playerIndex,
        playerInfo,
        isCreator: false
      }))
      setGameState(serverGameState)
    })

    // Game start event
    socket.on('gameStart', ({ gameState: serverGameState, players: serverPlayers }) => {
      setGameState(serverGameState)

      // Set player names and find opponent
      const playerMap: Record<number, string> = {};
      let opponentName = null;

      serverPlayers.forEach((player: RoomPlayer) => {
        playerMap[player.index] = player.username;

        if (player.index !== multiplayerState.playerIndex) {
          opponentName = player.username;
        }
      });

      setPlayers(playerMap);
      setMultiplayerState(prev => ({
        ...prev,
        opponentName
      }));

      const currentPlayerName = playerMap[serverGameState.currentPlayer];
      setGameMessage(`${currentPlayerName}'s turn`);
    })

    // Game state update event
    socket.on('gameStateUpdate', ({ gameState: serverGameState }) => {
      setGameState(serverGameState)

      if (serverGameState.status === 'won') {
        const winnerName = players[serverGameState.winner as number];
        setGameMessage(`${winnerName} wins!`)
      } else if (serverGameState.status === 'draw') {
        setGameMessage("It's a draw!")
      } else {
        const currentPlayerName = players[serverGameState.currentPlayer];
        setGameMessage(`${currentPlayerName}'s turn`)
      }
    })

    // Handle errors
    socket.on('error', ({ message }) => {
      setError(message)
    })

    // Player disconnected event
    socket.on('playerDisconnected', ({ username, playerIndex, gameState: serverGameState }) => {
      setGameState(serverGameState)
      setGameMessage(`${username} has disconnected. Waiting for them to rejoin...`)
    })

    // Spectator joined/left events
    socket.on('spectatorJoined', ({ username }) => {
      setMultiplayerState(prev => ({
        ...prev,
        spectators: [...prev.spectators, username]
      }))
    })

    socket.on('spectatorLeft', ({ username }) => {
      setMultiplayerState(prev => ({
        ...prev,
        spectators: prev.spectators.filter(name => name !== username)
      }))
    })

    // Handle joined as spectator
    socket.on('joinedAsSpectator', ({ roomId, gameType, gameState: serverGameState, players: serverPlayers }) => {
      setMultiplayerState(prev => ({
        ...prev,
        roomId,
        gameType,
        playerIndex: null,
        playerInfo: null,
        isCreator: false
      }))

      setGameState(serverGameState);

      // Set player names
      const playerMap: Record<number, string> = {};
      serverPlayers.forEach((player: RoomPlayer) => {
        playerMap[player.index] = player.username;
      });

      setPlayers(playerMap);
      setGameMessage('You joined as a spectator');
    })

    // Game reset event
    socket.on('gameReset', ({ gameState: serverGameState }) => {
      setGameState(serverGameState)
      const currentPlayerName = players[serverGameState.currentPlayer];
      setGameMessage(`${currentPlayerName}'s turn`)
    })

    // Cleanup
    return () => {
      socket.off('roomCreated')
      socket.off('roomJoined')
      socket.off('gameStart')
      socket.off('gameStateUpdate')
      socket.off('error')
      socket.off('playerDisconnected')
      socket.off('spectatorJoined')
      socket.off('spectatorLeft')
      socket.off('joinedAsSpectator')
      socket.off('gameReset')
    }
  }, [socket, players, multiplayerState.playerIndex])

  // Functions for multiplayer
  const createRoom = () => {
    if (!socket || !username) return
    socket.emit('createRoom', { username, gameType: 'tic-tac-toe' })
  }

  const joinRoom = () => {
    if (!socket || !username || !roomIdInput) return
    socket.emit('joinRoom', { roomId: roomIdInput, username })
  }

  // Handle square click
  const handleClick = (i: number) => {
    // Don't allow moves after game is over or on filled squares
    if (gameState.status !== 'playing' || (gameState.board as any)[i]) return

    // In multiplayer mode, only allow clicks if it's your turn and you're a player (not spectator)
    if (socket && multiplayerState.roomId) {
      // Check if it's not your turn
      if (gameState.currentPlayer !== multiplayerState.playerIndex) {
        return
      }

      // Send move to server
      socket.emit('makeMove', {
        roomId: multiplayerState.roomId,
        move: { index: i }  // Format the move based on the game type
      })
      return
    }

    // Local gameplay (no multiplayer)
    const newBoard = [...gameState.board]
    newBoard[i] = gameState.currentPlayer === 0 ? 'X' : 'O'

    setGameState({
      ...gameState,
      board: newBoard,
      currentPlayer: gameState.currentPlayer === 0 ? 1 : 0,
    })

    setGameMessage(`${players[gameState.currentPlayer === 0 ? 1 : 0]}'s turn`)
  }

  // Check if there's a winner (for local play only)
  useEffect(() => {
    if (socket && multiplayerState.roomId) return; // Skip for multiplayer games

    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6]             // diagonals
    ]

    for (const pattern of winPatterns) {
      const [a, b, c] = pattern
      const board = gameState.board

      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        setGameState({
          ...gameState,
          winner: board[a] === 'X' ? 0 : 1,
          status: 'won',
          winningPattern: pattern
        })

        setGameMessage(`${players[board[a] === 'X' ? 0 : 1]} wins!`)
        return
      }
    }

    // Check for draw
    if (!gameState.board.includes(null)) {
      setGameState({
        ...gameState,
        status: 'draw'
      })
      setGameMessage("It's a draw!")
    }
  }, [gameState.board, socket, multiplayerState.roomId])

  // Reset the game
  const resetGame = () => {
    // For multiplayer, send reset event to server
    if (socket && multiplayerState.roomId) {
      socket.emit('resetGame', { roomId: multiplayerState.roomId })
      return
    }

    // Local gameplay reset
    setGameState({
      board: Array(9).fill(null),
      currentPlayer: 0,
      winner: null,
      status: 'playing'
    })
    setGameMessage(`${players[0]}'s turn`)
  }

  // Toggle multiplayer mode
  const toggleMultiplayer = () => {
    setShowMultiplayer(prev => !prev)

    // Reset states when toggling
    if (!showMultiplayer) {
      // Switching to multiplayer mode
      setUsername('')
      setRoomIdInput('')
      setError(null)
    } else {
      // Switching back to local mode
      if (socket) {
        socket.disconnect()
      }
      setSocket(null)
      setMultiplayerState({
        isConnected: false,
        roomId: null,
        gameType: 'tic-tac-toe',
        isCreator: false,
        playerIndex: null,
        playerInfo: null,
        opponentName: null,
        spectators: []
      })
      resetGame()
    }
  }

  // Handle leaving the room
  const leaveRoom = () => {
    if (socket) {
      socket.disconnect()
      setSocket(null)
    }

    setMultiplayerState({
      isConnected: false,
      roomId: null,
      gameType: 'tic-tac-toe',
      isCreator: false,
      playerIndex: null,
      playerInfo: null,
      opponentName: null,
      spectators: []
    })

    resetGame()
    setShowMultiplayer(true) // Keep multiplayer mode enabled, just leave the room
  }

  // Copy room ID to clipboard
  const copyRoomId = () => {
    if (multiplayerState.roomId) {
      navigator.clipboard.writeText(multiplayerState.roomId)
    }
  }

  // Updated function to handle player name change
  const handlePlayerNameChange = (playerIndex: number, name: string) => {
    setPlayers(prev => ({
      ...prev,
      [playerIndex]: name
    }))
  }

  // Convert board data for rendering
  const renderBoard = () => {
    // For multiplayer, we might need to transform the board data
    // based on the game type and player symbols
    if (multiplayerState.roomId && gameState.board) {
      // For Tic-Tac-Toe: convert the numeric player indices to X/O
      return gameState.board.map((cell: any) => {
        if (cell === null) return null;
        return cell === 0 ? 'X' : 'O';
      });
    }

    // For local play, the board already has X/O values
    return gameState.board;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
      {/* Multiplayer Toggle */}
      <div className="mb-4 text-center">
        <button
          onClick={toggleMultiplayer}
          className={`px-4 py-2 ${showMultiplayer ? 'bg-gray-600' : 'bg-green-600'} text-white rounded-md hover:${showMultiplayer ? 'bg-gray-700' : 'bg-green-700'} transition-colors`}
        >
          {showMultiplayer ? 'Local Mode' : 'Multiplayer Mode'}
        </button>
      </div>

      {/* Game Type (currently only for TicTacToe) */}
      {showMultiplayer && !multiplayerState.roomId && (
        <div className="mb-2 text-center">
          <span className="text-sm font-medium">Game: Tic-Tac-Toe</span>
        </div>
      )}

      {/* Multiplayer Options */}
      {showMultiplayer && !multiplayerState.roomId && (
        <div className="mb-6 border border-gray-200 p-4 rounded-md">
          <h3 className="text-lg font-semibold mb-2">Online Multiplayer</h3>

          {/* Username Input */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Create Room Button */}
          <button
            onClick={createRoom}
            disabled={!username || !multiplayerState.isConnected}
            className="w-full px-4 py-2 mb-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
          >
            Create New Game
          </button>

          {/* Join Room Section */}
          <div className="flex mt-3">
            <input
              type="text"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value)}
              placeholder="Enter Room ID"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={joinRoom}
              disabled={!username || !roomIdInput || !multiplayerState.isConnected}
              className="px-4 py-2 bg-purple-600 text-white rounded-r-md hover:bg-purple-700 transition-colors disabled:bg-gray-400"
            >
              Join Game
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-2 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Connection Status */}
          <div className="mt-2 text-sm">
            Status: {multiplayerState.isConnected ? (
              <span className="text-green-600">Connected to server</span>
            ) : (
              <span className="text-red-600">Connecting to server...</span>
            )}
          </div>
        </div>
      )}

      {/* Room Info */}
      {multiplayerState.roomId && (
        <div className="mb-4 border border-gray-200 p-3 rounded-md bg-gray-50">
          <div className="flex justify-between items-center">
            <h3 className="text-md font-semibold">Room: {multiplayerState.roomId}</h3>
            <div>
              <button
                onClick={copyRoomId}
                className="text-xs px-2 py-1 bg-gray-200 rounded mr-1 hover:bg-gray-300"
              >
                Copy ID
              </button>
              <button
                onClick={leaveRoom}
                className="text-xs px-2 py-1 bg-red-200 rounded hover:bg-red-300"
              >
                Leave
              </button>
            </div>
          </div>

          {/* Player Info */}
          <p className="text-sm mt-1">
            You: {username}
            {multiplayerState.playerIndex !== null && multiplayerState.playerInfo && (
              <span className="font-bold"> ({multiplayerState.playerInfo.symbol || ''})</span>
            )}
            {multiplayerState.playerIndex === null && <span> (Spectator)</span>}
          </p>

          {/* Spectators */}
          {multiplayerState.spectators.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              Spectators: {multiplayerState.spectators.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Player Names (Only show in local mode) */}
      {!showMultiplayer && (
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Player X
            </label>
            <input
              type="text"
              value={players[0]}
              onChange={(e) => handlePlayerNameChange(0, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Player O
            </label>
            <input
              type="text"
              value={players[1]}
              onChange={(e) => handlePlayerNameChange(1, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Game Status */}
      <div className="text-center mb-4">
        <p className="text-xl font-semibold">{gameMessage}</p>
      </div>

      {/* Game Board */}
      <Board
        squares={renderBoard() as Player[]}
        onClick={handleClick}
        winningPattern={gameState.winningPattern}
      />

      {/* Reset Button */}
      <div className="mt-6 text-center">
        <button
          onClick={resetGame}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          New Game
        </button>
      </div>

      {/* Help Text for Local Mode */}
      {!showMultiplayer && (
        <div className="text-sm text-gray-600 text-center w-full pb-4 mt-2">
          <p>To play against other users locally, share this screen and take turns.</p>
          <p className="mt-1">Or click "Multiplayer Mode" above to play online!</p>
        </div>
      )}
    </div>
  )
}

export default TicTacToe
