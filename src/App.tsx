import React, { useState } from 'react'
import './App.css'
import TicTacToe from './components/TicTacToe'
import Connect4 from './components/Connect4'

function App() {
  const [game, setGame] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold text-center mb-6">Choose a Game</h1>
      <div className="Games">
        {!game && (
          <>
          <button className='Tic-Tac-Toe' onClick={() => setGame('TicTacToe')}>
            Tic Tac Toe
          </button>
          <button className='Connect-4' onClick={() => setGame('Connect4')}>
            Connect 4
          </button>
          </>
          
        )}
        {game === 'TicTacToe' && <TicTacToe />}
        {game === 'Connect4' && <Connect4 />}
      </div>

      {/* <div className=" text-sm text-gray-600 text-center w-full pb-4">
        <p>To play against other users, share this screen and take turns.</p>
        <p className="mt-1">A future version will include online multiplayer!</p>
      </div> */}
    </div>
  )
}

export default App
