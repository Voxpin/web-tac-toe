import { useState, useEffect } from 'react'

// Types for our game
type Player = 'X' | 'O' | null
type GameStatus = 'playing' | 'won' | 'draw'
type GameState = {
  board: Player[]
  currentPlayer: Player
  winner: Player
  status: GameStatus
}

// Component for an individual square on the board
const Square = ({ value, onClick }: { value: Player; onClick: () => void }) => {
  return (
    <button
      className="w-20 h-20 border border-gray-400 text-3xl font-bold flex items-center justify-center
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
    <div className="grid grid-cols-3 gap-1 w-fit mx-auto">
      {squares.map((square, i) => (
        <Square key={i} value={square} onClick={() => onClick(i)} />
      ))}
    </div>
  )
}

export const TicTacToe = () => {
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

  // Check for a winner
  useEffect(() => {
    checkWinner()
  }, [gameState.board])

  // Handle square click
  const handleClick = (i: number) => {
    // Don't allow moves after game is over or on filled squares
    if (gameState.status !== 'playing' || gameState.board[i]) return

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
    setGameState({
      board: Array(9).fill(null),
      currentPlayer: 'X',
      winner: null,
      status: 'playing'
    })
    setGameMessage(`${players.X}'s turn`)
  }

  // Handle player name change
  const handlePlayerNameChange = (player: 'X' | 'O', name: string) => {
    setPlayers({
      ...players,
      [player]: name
    })

    if (gameState.status === 'playing' && gameState.currentPlayer === player) {
      setGameMessage(`${name}'s turn`)
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
      {/* Player Names */}
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
    </div>
  )
}

export default TicTacToe
