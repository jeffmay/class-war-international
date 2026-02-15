/**
 * Main App component - Integrates boardgame.io with React
 */

import { Client } from 'boardgame.io/react';
import { ClassWarGame } from './game/ClassWarGame';
import { ClassWarBoard } from './Board';
import './App.css';

// Create the boardgame.io client with our game and board
const ClassWarClient = Client({
  game: ClassWarGame,
  board: ClassWarBoard,
  numPlayers: 2,
  debug: true, // Enable debug panel during development
});

function App() {
  return (
    <div className="App">
      <ClassWarClient />
    </div>
  );
}

export default App;
