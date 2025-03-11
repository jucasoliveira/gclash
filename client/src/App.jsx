import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Lobby from './pages/Lobby';
import CharacterSelection from './pages/CharacterSelection';
import Settings from './pages/Settings';
import GameCanvas from './game/GameCanvas';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/character-selection" element={<CharacterSelection />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/game" element={<GameCanvas />} />
      </Routes>
    </Router>
  );
}

export default App; 