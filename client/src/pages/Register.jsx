import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Store user data in localStorage
      localStorage.setItem('guildClashUser', JSON.stringify(data));

      // Set the player's username and ID in the window object for compatibility
      window.playerUsername = data.username;
      window.playerId = data.id;

      // Navigate to character selection
      navigate('/character-selection');
    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#1a2e35] bg-blend-overlay bg-cover bg-center"
         style={{ backgroundImage: "url('/placeholder.svg')" }}>
      <div className="p-4">
        <Link to="/">
          <button className="text-[#e8d7b9] hover:text-[#d6c5a7] hover:bg-transparent bg-transparent p-2 rounded-full">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </button>
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full mx-auto space-y-8 bg-[#e8d7b9] bg-opacity-90 p-6 rounded-sm border-2 border-[#8b3a3a]/40 shadow-lg relative overflow-hidden">
          {/* Parchment texture overlay */}
          <div className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
               style={{ backgroundImage: "url('/parchment-texture.svg')" }}></div>

          <div className="text-center space-y-2 relative">
            <div className="flex justify-center">
              <img src="/game-logo.svg" alt="Guild Clash Logo" className="h-16 w-16" />
            </div>
            <h1 className="text-2xl font-bold text-[#8b3a3a]">Create an Account</h1>
          </div>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          
          <form onSubmit={handleRegister} className="space-y-6 relative">
            <div className="space-y-2">
              <label htmlFor="username" className="block text-[#5a3e2a]">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                required
                className="w-full bg-[#e8d7b9]/60 border border-[#8b3a3a]/30 text-[#5a3e2a] focus:ring-[#8b3a3a] focus:border-[#8b3a3a] p-2 rounded"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="block text-[#5a3e2a]">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="w-full bg-[#e8d7b9]/60 border border-[#8b3a3a]/30 text-[#5a3e2a] focus:ring-[#8b3a3a] focus:border-[#8b3a3a] p-2 rounded"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="block text-[#5a3e2a]">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                required
                className="w-full bg-[#e8d7b9]/60 border border-[#8b3a3a]/30 text-[#5a3e2a] focus:ring-[#8b3a3a] focus:border-[#8b3a3a] p-2 rounded"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-[#5a3e2a]">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                className="w-full bg-[#e8d7b9]/60 border border-[#8b3a3a]/30 text-[#5a3e2a] focus:ring-[#8b3a3a] focus:border-[#8b3a3a] p-2 rounded"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#8b3a3a] hover:bg-[#6e2e2e] text-[#e8d7b9] border border-[#8b3a3a]/50 py-2 px-4 rounded"
              disabled={isLoading}
            >
              {isLoading ? "Creating Account..." : "Create Account"}
            </button>
          </form>
          <div className="text-center text-sm relative">
            <p className="text-[#5a3e2a]">
              Already have an account?{" "}
              <Link to="/login" className="text-[#8b3a3a] hover:text-[#6e2e2e]">
                Login
              </Link>
            </p>
          </div>
          <div className="text-center mt-4">
            <Link to="/" className="text-[#8b3a3a] hover:text-[#6e2e2e]">Back to Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register; 