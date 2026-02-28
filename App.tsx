import React, { useEffect, useRef, useState, useCallback } from 'react';
import GameCanvas from './components/GameCanvas';
import StatsPanel from './components/StatsPanel';
import { SimulationEngine, DefaultConfig } from './simulation/engine';
import { SimulationStats, SimulationConfig } from './types';

function App() {
  // Config State
  const [config, setConfig] = useState<SimulationConfig>(DefaultConfig);

  const engineRef = useRef<SimulationEngine>(new SimulationEngine(config));
  const [stats, setStats] = useState<SimulationStats>({
    tickCount: 0,
    totalPoints: 0,
    agentCount: 0,
    resourceCount: 0,
    baseSize: 0,
    baseSlotsFree: 0,
  });
  
  const [isRunning, setIsRunning] = useState(true);
  const [tickRate, setTickRate] = useState(60); 
  const requestRef = useRef<number>();
  const lastTickTimeRef = useRef<number>(0);

  // Sync config updates to engine
  useEffect(() => {
    engineRef.current.config = config;
  }, [config]);

  // Main Loop
  const loop = useCallback((time: number) => {
    if (isRunning) {
      const msPerTick = 1000 / tickRate;
      const elapsed = time - lastTickTimeRef.current;

      if (elapsed > msPerTick) {
        engineRef.current.tick();
        lastTickTimeRef.current = time;
        
        // Sync Stats to UI
        setStats({
            tickCount: engineRef.current.tickCount,
            totalPoints: engineRef.current.totalPoints,
            agentCount: engineRef.current.agents.length,
            resourceCount: engineRef.current.resources.length,
            baseSize: engineRef.current.base.rect.w,
            baseSlotsFree: engineRef.current.base.slots.filter(s => !s.reserved).length,
        });
      }
    }
    requestRef.current = requestAnimationFrame(loop);
  }, [isRunning, tickRate]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop]);

  const handleReset = () => {
    // Reset creates a new engine with the CURRENT config
    engineRef.current = new SimulationEngine(config);
    setStats({
      tickCount: 0,
      totalPoints: 0,
      agentCount: 0,
      resourceCount: 0,
      baseSize: 0,
      baseSlotsFree: 0,
    });
    lastTickTimeRef.current = performance.now();
  };

  const handleConfigChange = (newConfig: SimulationConfig) => {
      setConfig(newConfig);
  };

  // Screen Dimensions
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  
  useEffect(() => {
    const handleResize = () => {
        setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="relative w-screen h-screen bg-slate-950 overflow-hidden">
        {/* Full Screen Canvas */}
        <GameCanvas 
            engine={engineRef.current} 
            width={dimensions.width} 
            height={dimensions.height} 
        />

        {/* Floating UI */}
        <StatsPanel 
            stats={stats}
            config={config}
            isRunning={isRunning}
            tickRate={tickRate}
            onTogglePlay={() => setIsRunning(prev => !prev)}
            onReset={handleReset}
            onSpeedChange={setTickRate}
            onConfigChange={handleConfigChange}
        />
    </div>
  );
}

export default App;