import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#1a2e35] bg-blend-overlay bg-cover bg-center"
         style={{ backgroundImage: "url('/placeholder.svg')" }}>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full mx-auto space-y-8 bg-[#e8d7b9] bg-opacity-90 p-6 rounded-sm border-2 border-[#8b3a3a]/40 shadow-lg relative overflow-hidden">
          {/* Parchment texture overlay */}
          <div className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
               style={{ backgroundImage: "url('/parchment-texture.svg')" }}></div>

          <div className="text-center space-y-2 relative">
            <div className="flex justify-center">
              <img src="/game-logo.svg" alt="Guild Clash Logo" className="h-20 w-20" />
            </div>
            <h1 className="text-4xl font-bold tracking-tighter text-[#8b3a3a]">GUILD CLASH</h1>
            <p className="text-[#5a3e2a]">Prove your worth in battle</p>
          </div>
          
          <div className="space-y-3 text-[#5a3e2a] text-sm relative">
            <p className="text-center">
              A browser-based isometric multiplayer game featuring intense 1v1 tournaments and 40-player battle royales.
            </p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-[#8b3a3a]/10 rounded">
                <div className="font-bold text-[#8b3a3a]">Clerk</div>
                <div>Magic & Speed</div>
              </div>
              <div className="p-2 bg-[#8b3a3a]/10 rounded">
                <div className="font-bold text-[#8b3a3a]">Warrior</div>
                <div>Strength & Health</div>
              </div>
              <div className="p-2 bg-[#8b3a3a]/10 rounded">
                <div className="font-bold text-[#8b3a3a]">Ranger</div>
                <div>Balance & Range</div>
              </div>
            </div>
          </div>
          
          <div className="space-y-4 relative">
            <div className="space-y-2">
              <Link to="/login" className="block">
                <button className="w-full bg-[#8b3a3a] hover:bg-[#6e2e2e] text-[#e8d7b9] border border-[#8b3a3a]/50 py-2 px-4 rounded">
                  Login
                </button>
              </Link>
            </div>
            <div className="space-y-2">
              <Link to="/register" className="block">
                <button className="w-full border-[#8b3a3a]/50 text-[#8b3a3a] hover:bg-[#8b3a3a]/10 bg-transparent py-2 px-4 rounded border">
                  Create Account
                </button>
              </Link>
            </div>
          </div>
          <div className="text-center text-xs text-[#5a3e2a] relative">
            <p>Version 0.1.0 | &copy; {new Date().getFullYear()} Guild Clash</p>
          </div>
        </div>
      </div>
    </div>
  );
} 