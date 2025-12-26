
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Entity, GameState, Particle, LeaderboardEntry } from './types';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  GROUND_Y, 
  GRAVITY, 
  JUMP_STRENGTH, 
  INITIAL_SPEED, 
  SPEED_INCREMENT,
  SPAWN_MIN_INTERVAL,
  SPAWN_MAX_INTERVAL,
  COLORS,
  GAME_NAME
} from './constants';
import { 
  drawCat, 
  drawHat, 
  drawBook, 
  drawElixir, 
  drawBackground 
} from './components/Renderer';
import { getRitualMessage } from './services/geminiService';

const Footer: React.FC = () => (
  <footer className="w-full py-8 mt-12 flex flex-col items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
    <div className="flex items-center gap-3 group">
      <div className="relative w-10 h-10 rounded-full border-2 border-[#226b48] overflow-hidden shadow-[0_0_15px_rgba(34,107,72,0.4)] group-hover:border-[#76e891] group-hover:shadow-[0_0_20px_rgba(118,232,145,0.6)] transition-all duration-500">
        <img 
          src="https://pbs.twimg.com/profile_images/1801955577763094529/5qtIvl5X_400x400.jpg" 
          alt="aliorbz" 
          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
        />
        <div className="absolute inset-0 bg-[#76e891]/10 pointer-events-none"></div>
      </div>
      <p className="text-green-200/50 text-sm sm:text-lg tracking-[0.2em] uppercase font-mono italic">
        Evoked from the void by{' '}
        <a 
          href="https://x.com/aliorbz" 
          target="_blank" 
          rel="noopener noreferrer"
          className="relative inline-block text-[#76e891] font-bold no-underline group/link lowercase"
        >
          aliorbz
          <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#226b48] group-hover/link:bg-[#76e891] transition-all duration-300"></span>
          <span className="absolute -bottom-1 left-0 w-0 h-[2px] bg-[#76e891] group-hover/link:w-full transition-all duration-500 shadow-[0_0_10px_#76e891]"></span>
          <span className="absolute -top-4 -right-2 opacity-0 group-hover/link:opacity-100 group-hover/link:animate-bounce transition-opacity duration-300">✨</span>
        </a>
      </p>
    </div>
    <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-[#226b48] to-transparent opacity-30"></div>
  </footer>
);

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const [appState, setAppState] = useState<'LANDING' | 'NAME_ENTRY' | 'GAME'>('LANDING');
  const [gameState, setGameState] = useState<GameState>('START');
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('siggy_player_name') || '');
  const [nameInput, setNameInput] = useState('');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => Number(localStorage.getItem('siggy_personal_best')) || 0);
  const [baseLeaderboard, setBaseLeaderboard] = useState<LeaderboardEntry[]>(() => {
    const saved = localStorage.getItem('siggy_global_leaderboard');
    if (saved) return JSON.parse(saved);
    return [
      { name: "Alchemist Azar", score: 5000, date: "Eons Ago" },
      { name: "Grimoire Keeper", score: 4200, date: "Eons Ago" },
      { name: "Nightshade", score: 3500, date: "Eons Ago" },
      { name: "Cinder", score: 2800, date: "Eons Ago" },
      { name: "Void-Walker", score: 2100, date: "Eons Ago" },
      { name: "Rune-Carver", score: 1500, date: "Eons Ago" },
      { name: "Spectral Paw", score: 1200, date: "Eons Ago" },
      { name: "Lunar Whisker", score: 900, date: "Eons Ago" },
      { name: "Dust Bunny", score: 600, date: "Eons Ago" },
      { name: "Apprentice", score: 300, date: "Eons Ago" }
    ];
  });

  const [ritualMessage, setRitualMessage] = useState("The ritual awaits its familiar...");
  const [gameOverCooldown, setGameOverCooldown] = useState(false);
  
  const lastTimeRef = useRef<number>(0);
  const requestRef = useRef<number>(null);

  const gameVars = useRef({
    speed: INITIAL_SPEED,
    frame: 0,
    nextSpawn: 100,
    player: { x: 50, y: GROUND_Y - 35, width: 35, height: 35, type: 'PLAYER' } as Entity,
    playerVelY: 0,
    isJumping: false,
    obstacles: [] as Entity[],
    particles: [] as Particle[],
  });

  // Preload Logo
  useEffect(() => {
    const img = new Image();
    // User provided URL
    img.src = "https://pbs.twimg.com/profile_images/1912582510631858176/-Xbw2AcT_400x400.jpg";
    img.crossOrigin = "anonymous";
    img.onload = () => { logoRef.current = img; };
  }, []);

  const activeLeaderboard = useMemo(() => {
    const currentEntry: LeaderboardEntry = {
      name: playerName || "Mysterious Wanderer",
      score: Math.floor(score),
      date: "Today"
    };
    const others = baseLeaderboard.filter(e => e.name !== playerName);
    const combined = [...others, currentEntry];
    return combined.sort((a, b) => b.score - a.score).slice(0, 10);
  }, [baseLeaderboard, playerName, score]);

  const commitToLeaderboard = useCallback((finalScore: number) => {
    const roundedScore = Math.floor(finalScore);
    const newEntry: LeaderboardEntry = {
      name: playerName || "Mysterious Wanderer",
      score: roundedScore,
      date: new Date().toLocaleDateString()
    };

    setBaseLeaderboard(prev => {
      const existingIdx = prev.findIndex(e => e.name === playerName);
      let updated;
      if (existingIdx !== -1) {
        if (roundedScore > prev[existingIdx].score) {
          updated = [...prev];
          updated[existingIdx] = newEntry;
        } else {
          updated = prev;
        }
      } else {
        updated = [...prev, newEntry];
      }
      const sorted = updated.sort((a, b) => b.score - a.score).slice(0, 10);
      localStorage.setItem('siggy_global_leaderboard', JSON.stringify(sorted));
      return sorted;
    });

    if (roundedScore > highScore) {
      setHighScore(roundedScore);
      localStorage.setItem('siggy_personal_best', roundedScore.toString());
    }
  }, [playerName, highScore]);

  const resetGame = useCallback(() => {
    if (gameOverCooldown) return;
    gameVars.current = {
      speed: INITIAL_SPEED,
      frame: 0,
      nextSpawn: 100,
      player: { x: 50, y: GROUND_Y - 35, width: 35, height: 35, type: 'PLAYER' },
      playerVelY: 0,
      isJumping: false,
      obstacles: [],
      particles: [],
    };
    setScore(0);
    setGameState('PLAYING');
    setRitualMessage("The cycle repeats...");
    lastTimeRef.current = performance.now();
  }, [gameOverCooldown]);

  const createParticles = (x: number, y: number, color: string) => {
    for(let i=0; i<15; i++) {
      gameVars.current.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12,
        life: 1.0,
        color
      });
    }
  };

  const handleGameOver = useCallback(async (finalScore: number) => {
    setGameState('GAMEOVER');
    setGameOverCooldown(true);
    commitToLeaderboard(finalScore);
    setTimeout(() => setGameOverCooldown(false), 800);
    const msg = await getRitualMessage(Math.floor(finalScore), 'LOSS');
    setRitualMessage(msg);
  }, [commitToLeaderboard]);

  const update = useCallback(() => {
    const v = gameVars.current;
    v.frame++;
    v.speed += SPEED_INCREMENT;
    let currentScore = 0;
    setScore(prev => {
      const added = v.speed * 0.015;
      currentScore = prev + added;
      return currentScore;
    });
    if (v.isJumping) {
      v.playerVelY += GRAVITY;
      v.player.y += v.playerVelY;
      if (v.player.y >= GROUND_Y - v.player.height) {
        v.player.y = GROUND_Y - v.player.height;
        v.playerVelY = 0;
        v.isJumping = false;
      }
    }
    if (v.frame >= v.nextSpawn) {
      const types: Array<'HAT' | 'BOOK' | 'ELIXIR'> = ['HAT', 'BOOK', 'ELIXIR'];
      const type = types[Math.floor(Math.random() * types.length)];
      v.obstacles.push({
        x: CANVAS_WIDTH,
        y: GROUND_Y - 35,
        width: type === 'HAT' ? 40 : (type === 'BOOK' ? 35 : 40),
        height: 35,
        type
      });
      v.nextSpawn = v.frame + SPAWN_MIN_INTERVAL + Math.random() * (SPAWN_MAX_INTERVAL - SPAWN_MIN_INTERVAL);
    }
    for (let i = v.obstacles.length - 1; i >= 0; i--) {
      v.obstacles[i].x -= v.speed;
      const p = v.player;
      const o = v.obstacles[i];
      const pad = 8;
      if (p.x + pad < o.x + o.width - pad && p.x + p.width - pad > o.x + pad && p.y + pad < o.y + o.height - pad && p.y + p.height - pad > o.y + pad) {
        createParticles(p.x + p.width/2, p.y + p.height/2, COLORS.ELIXIR);
        handleGameOver(currentScore);
        return false;
      }
      if (v.obstacles[i].x < -100) v.obstacles.splice(i, 1);
    }
    for (let i = v.particles.length - 1; i >= 0; i--) {
      const p = v.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.025;
      if (p.life <= 0) v.particles.splice(i, 1);
    }
    return true;
  }, [handleGameOver]);

  const gameLoop = useCallback((time: number) => {
    if (gameState !== 'PLAYING') return;
    const deltaTime = time - lastTimeRef.current;
    const targetInterval = 1000 / 60;
    let shouldContinue = true;
    if (deltaTime >= targetInterval) {
      const updates = Math.min(Math.floor(deltaTime / targetInterval), 3);
      for (let i = 0; i < updates; i++) {
        if (!update()) {
          shouldContinue = false;
          break;
        }
      }
      lastTimeRef.current = time;
    }
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      const v = gameVars.current;
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawBackground(ctx, v.frame, logoRef.current);
      v.obstacles.forEach(o => {
        if (o.type === 'HAT') drawHat(ctx, o.x, o.y);
        else if (o.type === 'BOOK') drawBook(ctx, o.x, o.y);
        else drawElixir(ctx, o.x, o.y);
      });
      drawCat(ctx, v.player.x, v.player.y, v.frame, v.isJumping);
      v.particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 4, 4);
      });
      ctx.globalAlpha = 1.0;
    }
    if (shouldContinue) {
      requestRef.current = requestAnimationFrame(gameLoop);
    }
  }, [gameState, update]);

  const handleInput = useCallback((e?: React.SyntheticEvent | KeyboardEvent | PointerEvent) => {
    if (e && e.target instanceof HTMLElement) {
      const tagName = e.target.tagName.toLowerCase();
      if (tagName === 'button' || tagName === 'input' || e.target.closest('button')) {
        return;
      }
    }

    if (gameState === 'PLAYING') {
      if (!gameVars.current.isJumping) {
        gameVars.current.playerVelY = JUMP_STRENGTH;
        gameVars.current.isJumping = true;
      }
    } else if (gameState === 'START' || (gameState === 'GAMEOVER' && !gameOverCooldown)) {
      if (appState === 'GAME') {
        resetGame();
      }
    }
  }, [gameState, gameOverCooldown, resetGame, appState]);

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) {
      setPlayerName(nameInput.trim());
      localStorage.setItem('siggy_player_name', nameInput.trim());
      setAppState('GAME');
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') handleInput(e);
    };
    const onPointerDown = (e: PointerEvent) => {
      handleInput(e);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [handleInput]);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      requestRef.current = requestAnimationFrame(gameLoop);
    } else if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [gameState, gameLoop]);

  if (appState === 'LANDING') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[#051611] text-[#76e891] animate-in fade-in duration-1000">
        <div className="max-w-3xl w-full text-center space-y-8 sm:space-y-12">
          <div className="relative inline-block px-4">
            <h1 className="text-6xl sm:text-8xl md:text-[8rem] mb-4 tracking-tighter drop-shadow-[0_0_25px_#76e891] select-none animate-pulse font-bold leading-none">{GAME_NAME}</h1>
            <div className="absolute -top-6 sm:-top-10 -right-2 sm:-right-10 text-2xl sm:text-4xl opacity-40 rotate-12">✨</div>
            <div className="absolute -bottom-6 sm:-bottom-10 -left-2 sm:-left-10 text-2xl sm:text-4xl opacity-40 -rotate-12">🌙</div>
          </div>
          <p className="text-xl sm:text-2xl text-green-200 opacity-80 leading-relaxed italic max-w-xl mx-auto">A familiar awakens... <br/>The cosmic circle calls for your agility. <br/>Will you complete the ritual?</p>
          <button onClick={() => setAppState(playerName ? 'GAME' : 'NAME_ENTRY')} className="group relative inline-block px-8 sm:px-12 py-3 sm:py-5 text-xl sm:text-3xl border-4 border-[#226b48] bg-black hover:bg-[#226b48] hover:text-white transition-all cursor-pointer rounded-sm shadow-[0_0_20px_rgba(34,107,72,0.6)] active:scale-95"><span className="relative z-10 uppercase tracking-widest font-bold">Invoke Magic</span></button>
        </div>
        <Footer />
      </div>
    );
  }

  if (appState === 'NAME_ENTRY') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[#051611] text-[#76e891] animate-in slide-in-from-bottom-8 duration-500">
        <div className="bg-black/80 border-4 border-[#226b48] p-6 sm:p-10 rounded-lg shadow-[0_0_40px_#226b48] max-w-md w-full text-center">
          <h2 className="text-2xl sm:text-4xl mb-4 sm:mb-6 tracking-widest uppercase font-bold">Sacred Identity</h2>
          <p className="mb-6 sm:mb-8 text-green-200 opacity-60 text-base sm:text-lg italic">Who shall traverse the circle today?</p>
          <form onSubmit={handleNameSubmit} className="space-y-6 sm:space-y-8">
            <input autoFocus type="text" maxLength={12} value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="NAME..." className="w-full bg-[#0b2d20] border-b-4 border-[#226b48] p-2 sm:p-3 text-xl sm:text-2xl text-center focus:outline-none focus:border-[#76e891] transition-all placeholder:opacity-20 rounded-t-sm" />
            <button type="submit" disabled={!nameInput.trim()} className="group relative w-full py-3 sm:py-4 text-xl sm:text-2xl border-4 border-[#226b48] bg-black overflow-hidden transition-all disabled:opacity-20 disabled:cursor-not-allowed active:scale-95 shadow-[0_4px_0_#0b2d20]"><div className="absolute inset-0 bg-[#76e891] translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div><span className="relative z-10 group-hover:text-black transition-colors uppercase font-bold tracking-widest">Seal The Pact</span></button>
          </form>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen p-2 sm:p-4 sm:pt-6 overflow-y-auto bg-[#051611]">
      {/* HEADER SECTION - SIGGY RUN TITLE AT TOP */}
      <header className="w-full max-w-[850px] text-center mb-6 sm:mb-10 animate-in fade-in duration-1000">
        <h1 className="text-5xl sm:text-8xl text-[#76e891] tracking-[0.1em] drop-shadow-[0_0_20px_rgba(118,232,145,0.6)] animate-pulse font-bold leading-none select-none">
          {GAME_NAME}
        </h1>
        <p className="text-[10px] sm:text-sm text-green-200 opacity-40 mt-2 sm:mt-3 italic uppercase tracking-[0.3em]">The Eternal Familiar</p>
      </header>

      {/* GAME WINDOW */}
      <div className="w-full max-w-[850px] px-2 sm:px-6 mb-6 sm:mb-10">
        <div className="relative border-4 border-[#226b48] shadow-[0_0_60px_rgba(34,107,72,0.4)] bg-black rounded-lg overflow-hidden select-none touch-none w-full">
          
          {/* Top In-Game HUD - Hidden ritualMessage during START and GAMEOVER screens */}
          <div className="absolute top-0 left-0 right-0 p-2 sm:p-4 flex justify-between items-start z-50 pointer-events-none">
            <div className="max-w-[140px] sm:max-w-[400px] text-[10px] sm:text-base italic text-green-100 drop-shadow-[0_1px_2px_rgba(0,0,0,1)] leading-tight opacity-95">
              {gameState === 'PLAYING' && `"${ritualMessage}"`}
            </div>
            <div className="text-xs sm:text-2xl font-bold font-mono text-[#76e891] drop-shadow-[0_1px_2px_rgba(0,0,0,1)] bg-black/60 px-2 py-0.5 sm:py-1 rounded-sm border border-[#226b48]/30">
              <span className="opacity-50 text-[9px] sm:text-lg uppercase mr-1 sm:mr-2">MANA</span>{Math.floor(score)}
            </div>
          </div>

          <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="cursor-pointer w-full h-auto block" />

          {/* Start Screen Overlay */}
          {gameState === 'START' && (
            <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-center p-4 transition-all z-40">
              <div className="flex flex-col items-center max-w-full">
                <div className="px-8 sm:px-12 py-2 sm:py-4 border-4 border-[#226b48] bg-black hover:bg-[#226b48] hover:text-white transition-all cursor-pointer rounded-sm text-lg sm:text-2xl font-bold tracking-widest uppercase shadow-[0_4px_0_#0b2d20] active:translate-y-1 active:shadow-none">Begin Ritual</div>
                <p className="mt-4 sm:mt-6 text-[8px] sm:text-xs opacity-40 uppercase tracking-[0.2em] font-mono">[ Tap Anywhere to Jump ]</p>
              </div>
            </div>
          )}

          {/* Game Over Screen Overlay - Elements sized to fit frame strictly */}
          {gameState === 'GAMEOVER' && (
            <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center text-center p-3 sm:p-4 z-40 animate-in fade-in zoom-in duration-300">
              <div className="flex flex-col items-center max-w-full space-y-2 sm:space-y-4">
                <h2 className="text-3xl sm:text-5xl text-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.8)] tracking-tighter uppercase font-black italic">Broken</h2>
                <p className="text-sm sm:text-xl text-green-200 opacity-80">Final Essence: <span className="text-[#76e891] font-mono font-bold">{Math.floor(score)}</span></p>
                <div className={`px-5 sm:px-8 py-1.5 sm:py-2.5 border-4 border-[#76e891] bg-black hover:bg-[#76e891] hover:text-black transition-all cursor-pointer rounded-sm text-sm sm:text-xl font-bold tracking-widest uppercase shadow-[0_3px_0_#0b2d20] ${gameOverCooldown ? 'opacity-50 cursor-wait' : 'animate-bounce active:translate-y-1 active:shadow-none'}`}>
                  {gameOverCooldown ? 'Restoring...' : 'Retry Rite'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* LEADERBOARD AND STATS */}
      <div className="w-full max-w-[900px] px-2 sm:px-4 grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-10 mb-10 animate-in slide-in-from-bottom-8 duration-1000">
        
        {/* Leaderboard Card */}
        <div className="lg:col-span-2 bg-[#0b2d20]/30 backdrop-blur-md border-2 border-[#226b48] p-4 sm:p-8 rounded-lg shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#76e891]/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
          <h3 className="text-xl sm:text-4xl mb-6 sm:mb-10 text-center border-b-2 border-[#226b48]/30 pb-4 sm:pb-6 uppercase tracking-[0.2em] font-bold text-[#76e891]">Ancient Familiars</h3>
          <div className="space-y-2 sm:space-y-3">
            {activeLeaderboard.map((entry, i) => (
              <div key={i} className={`group flex justify-between items-center p-3 sm:p-4 rounded-sm transition-all duration-300 ${entry.name === playerName ? 'bg-[#226b48]/40 border-l-4 sm:border-l-8 border-l-[#76e891] shadow-[0_0_15px_rgba(118,232,145,0.2)]' : 'bg-[#051611]/60 border-l-2 border-l-transparent hover:bg-[#0b2d20]/80'}`}>
                <div className="flex items-center gap-3 sm:gap-6">
                  <span className="text-[#76e891] text-xs sm:text-xl w-4 sm:w-8 font-mono opacity-40 font-bold">{i + 1}</span>
                  <span className="text-base sm:text-2xl tracking-wide uppercase truncate max-w-[100px] sm:max-w-none">{entry.name}</span>
                  {entry.name === playerName && gameState === 'PLAYING' && <span className="hidden sm:inline-block text-[9px] text-[#76e891] animate-pulse bg-black/50 px-2 py-0.5 rounded-sm border border-[#76e891]/40 ml-2 font-mono">CHANNELING</span>}
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-xl sm:text-3xl font-bold font-mono text-[#76e891]">{entry.score}</span>
                  <span className="text-[8px] sm:text-[10px] opacity-30 uppercase tracking-widest font-mono">{entry.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* User Stats Card - Optimized Size */}
        <div className="flex flex-col gap-6 sm:gap-10">
          <div className="bg-[#0b2d20]/30 backdrop-blur-md border-2 border-[#226b48] p-6 sm:p-8 rounded-lg flex flex-col shadow-2xl min-h-[320px] justify-between">
            <h3 className="text-xl sm:text-2xl mb-4 sm:mb-6 text-center border-b-2 border-[#226b48]/30 pb-3 sm:pb-4 uppercase tracking-widest font-bold text-[#76e891]">Your Legend</h3>
            
            <div className="bg-black/70 p-6 sm:p-8 rounded-lg text-center border-2 border-[#226b48]/50 relative group overflow-hidden flex flex-col items-center justify-center flex-grow">
              <div className="absolute inset-0 bg-[#76e891]/5 scale-0 group-hover:scale-110 transition-transform duration-700 rounded-full"></div>
              <p className="text-[10px] sm:text-xs opacity-50 uppercase mb-2 sm:mb-4 tracking-[0.2em] font-mono">Peak Mana Essence</p>
              <p className="text-5xl sm:text-7xl text-[#76e891] drop-shadow-[0_0_15px_rgba(118,232,145,0.5)] font-mono font-bold leading-none">
                {Math.floor(highScore)}
              </p>
              <div className="mt-3 sm:mt-4 w-10 h-1 bg-[#226b48] rounded-full group-hover:w-16 transition-all duration-500"></div>
            </div>

            <button 
              onClick={() => { const newName = prompt("Enter your sacred name:", playerName); if (newName && newName.trim()) { setPlayerName(newName.trim()); localStorage.setItem('siggy_player_name', newName.trim()); } }} 
              className="mt-6 sm:mt-8 py-3 text-[10px] sm:text-sm border-2 border-[#226b48] bg-[#051611] hover:bg-[#226b48] hover:text-white transition-all rounded-sm uppercase tracking-[0.3em] font-bold active:scale-95 shadow-[0_3px_0_#0b2d20]"
            >
              Rename Familiar
            </button>
          </div>

          <div className="p-6 sm:p-8 bg-black/50 border-l-4 sm:border-l-8 border-[#226b48] italic text-xs sm:text-lg opacity-60 leading-relaxed text-center rounded-r-lg shadow-xl">
            "The cosmos observes only the swift. Every stride is a sigil etched into eternity."
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default App;
