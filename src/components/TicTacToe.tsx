import { useState, useEffect, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

// Types for our game
type Player = 'X' | 'O' | null
type GameStatus = 'playing' | 'won' | 'draw' | 'waiting'
type GameState = {
  board: Player[]
  currentPlayer: Player
  winner: Player
  status: GameStatus
}

// Types for multiplayer
type RoomPlayer = {
  username: string
  symbol: 'X' | 'O'
}

type MultiplayerState = {
  isConnected: boolean
  roomId: string | null
  isCreator: boolean
  playerSymbol: 'X' | 'O' | null
  opponentName: string | null
  spectators: string[]
}

// Component for an individual square on the board
const Square = ({ value, onClick }: { value: Player; onClick: () => void }) => {
  return (
    <button
      className="aspect-square  border border-gray-400 text-6xl font-bold flex items-center justify-center
                 bg-white text-black hover:bg-gray-100 transition-colors"
      onClick={onClick}
    >
      {value}
    </button>
  )
}

// Component for the game board
const Board = ({ squares, onClick }: { squares: Player[]; onClick: (i: number) => void }) => {
  return (
    <div className="grid grid-cols-3 w-full max-w-sm gap-[5px] mx-auto">
      {squares.map((square, i) => (
        <Square key={i} value={square} onClick={() => onClick(i)} />
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
    isCreator: false,
    playerSymbol: null,
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
    currentPlayer: 'X',
    winner: null,
    status: 'playing'
  })

  // Player name state
  const [players, setPlayers] = useState({
    X: 'Player 1',
    O: 'Player 2'
  })

  // Game message
  const [gameMessage, setGameMessage] = useState<string>(`${players.X}'s turn`)

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
    socket.on('roomCreated', ({ roomId, symbol, gameState: serverGameState }) => {
      setMultiplayerState(prev => ({
        ...prev,
        roomId,
        playerSymbol: symbol,
        isCreator: true
      }))
      setGameState(serverGameState)
      setGameMessage('Waiting for opponent to join...')
    })

    // Room joined event
    socket.on('roomJoined', ({ roomId, symbol, gameState: serverGameState }) => {
      setMultiplayerState(prev => ({
        ...prev,
        roomId,
        playerSymbol: symbol,
        isCreator: false
      }))
      setGameState(serverGameState)
    })

    // Game start event
    socket.on('gameStart', ({ gameState: serverGameState, players }) => {
      setGameState(serverGameState)

      // Set player names based on server data
      const opponentPlayer = players.find(p =>
        p.symbol !== multiplayerState.playerSymbol
      )

      if (opponentPlayer) {
        setMultiplayerState(prev => ({
          ...prev,
          opponentName: opponentPlayer.username
        }))

        setPlayers(prev => ({
          ...prev,
          X: players.find(p => p.symbol === 'X')?.username || 'Player X',
          O: players.find(p => p.symbol === 'O')?.username || 'Player O'
        }))
      }

      setGameMessage(`${serverGameState.currentPlayer === 'X' ? players.find(p => p.symbol === 'X')?.username : players.find(p => p.symbol === 'O')?.username}'s turn`)
    })

    // Game state update event
    socket.on('gameStateUpdate', ({ gameState: serverGameState }) => {
      setGameState(serverGameState)

      if (serverGameState.status === 'won') {
        const winnerName = serverGameState.winner === 'X' ? players.X : players.O
        setGameMessage(`${winnerName} wins!`)
      } else if (serverGameState.status === 'draw') {
        setGameMessage("It's a draw!")
      } else {
        const currentPlayerName = serverGameState.currentPlayer === 'X' ? players.X : players.O
        setGameMessage(`${currentPlayerName}'s turn`)
      }
    })

    // Handle errors
    socket.on('error', ({ message }) => {
      setError(message)
    })

    // Player disconnected event
    socket.on('playerDisconnected', ({ username, gameState: serverGameState }) => {
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
    socket.on('joinedAsSpectator', ({ roomId, gameState: serverGameState, players }) => {
      setMultiplayerState(prev => ({
        ...prev,
        roomId,
        playerSymbol: null,
        isCreator: false
      }))

      setGameState(serverGameState)
      setPlayers({
        X: players.find(p => p.symbol === 'X')?.username || 'Player X',
        O: players.find(p => p.symbol === 'O')?.username || 'Player O'
      })

      setGameMessage('You joined as a spectator')
    })

    // Game reset event
    socket.on('gameReset', ({ gameState: serverGameState }) => {
      setGameState(serverGameState)
      setGameMessage(`${players.X}'s turn`)
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
  }, [socket, players, multiplayerState.playerSymbol])

  // Functions for multiplayer
  const createRoom = () => {
    if (!socket || !username) return
    socket.emit('createRoom', { username })
  }

  const joinRoom = () => {
    if (!socket || !username || !roomIdInput) return
    socket.emit('joinRoom', { roomId: roomIdInput, username })
  }

  // Check for a winner
  useEffect(() => {
    checkWinner()
  }, [gameState.board])

  // Handle square click
  const handleClick = (i: number) => {
    // Don't allow moves after game is over or on filled squares
    if (gameState.status !== 'playing' || gameState.board[i]) return

    // In multiplayer mode, only allow clicks if it's your turn and you're a player (not spectator)
    if (socket && multiplayerState.roomId) {
      // Check if it's not your turn
      if (gameState.currentPlayer !== multiplayerState.playerSymbol) {
        return
      }

      // Send move to server
      socket.emit('makeMove', { roomId: multiplayerState.roomId, index: i })
      return
    }

    // Local gameplay (no multiplayer)
    const newBoard = [...gameState.board]
    newBoard[i] = gameState.currentPlayer

    setGameState({
      ...gameState,
      board: newBoard,
      currentPlayer: gameState.currentPlayer === 'X' ? 'O' : 'X',
    })

    setGameMessage(`${gameState.currentPlayer === 'X' ? players.O : players.X}'s turn`)
  }

  // Check if there's a winner
  const checkWinner = () => {
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
          winner: board[a],
          status: 'won'
        })

        setGameMessage(`${board[a] === 'X' ? players.X : players.O} wins!`)
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
  }

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
      currentPlayer: 'X',
      winner: null,
      status: 'playing'
    })
    setGameMessage(`${players.X}'s turn`)
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
        isCreator: false,
        playerSymbol: null,
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
      isCreator: false,
      playerSymbol: null,
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
            {multiplayerState.playerSymbol && (
              <span className="font-bold"> ({multiplayerState.playerSymbol})</span>
            )}
            {!multiplayerState.playerSymbol && <span> (Spectator)</span>}
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
              value={players.X}
              onChange={(e) => handlePlayerNameChange('X', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Player O
            </label>
            <input
              type="text"
              value={players.O}
              onChange={(e) => handlePlayerNameChange('O', e.target.value)}
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
      <Board squares={gameState.board} onClick={handleClick} />

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
