import React, { useState } from 'react'
import './App.css'
import TicTacToe from './components/TicTacToe'

function App() {
  const [showGame, setShowGame] = useState(false)

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold text-center mb-6">Choose a Game</h1>
      <div className="Games">
        {!showGame ? (
          <button className='Tic-Tac-Toe' onClick={() => setShowGame(true)}>
            Tic Tac Toe
          </button>
        ) : (
          <TicTacToe />
        )}
      </div>

      <div className="mt-6 text-sm text-gray-600 text-center">
        <p>To play against other users, share this screen and take turns.</p>
        <p className="mt-1">A future version will include online multiplayer!</p>
      </div>
    </div>
  )
}

export default App
