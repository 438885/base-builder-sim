import React, { useState } from 'react';
import { SimulationStats, SimulationConfig, PathfindingMode } from '../types';
import { Activity, Users, Box, Hexagon, Play, Pause, RotateCcw, Zap, Settings, BarChart2, X, ChevronDown } from 'lucide-react';

interface StatsPanelProps {
    stats: SimulationStats;
    config: SimulationConfig;
    isRunning: boolean;
    tickRate: number;
    onTogglePlay: () => void;
    onReset: () => void;
    onSpeedChange: (speed: number) => void;
    onConfigChange: (newConfig: SimulationConfig) => void;
}

const StatsPanel: React.FC<StatsPanelProps> = ({ 
    stats, 
    config,
    isRunning, 
    tickRate, 
    onTogglePlay, 
    onReset, 
    onSpeedChange,
    onConfigChange
}) => {
    const [activeTab, setActiveTab] = useState<'stats' | 'settings'>('stats');
    const [isCollapsed, setIsCollapsed] = useState(true);

    const handleConfigUpdate = (key: keyof SimulationConfig, value: number | PathfindingMode | boolean) => {
        onConfigChange({
            ...config,
            [key]: value
        });
    };

    if (isCollapsed) {
        return (
            <button 
                onClick={() => setIsCollapsed(false)}
                className="absolute top-4 right-4 z-50 p-3 bg-slate-800/90 text-slate-100 rounded-full shadow-lg border border-slate-700 hover:bg-slate-700 hover:text-cyan-400 transition-all active:scale-95"
                title="Open Settings"
            >
                <Settings size={20} />
            </button>
        );
    }

    return (
        <div className="absolute top-4 right-4 z-50 flex flex-col bg-slate-800/95 text-slate-100 rounded-xl shadow-2xl backdrop-blur-md w-[calc(100vw-32px)] md:w-80 max-h-[90vh] border border-slate-700 transition-all duration-300 animate-in fade-in slide-in-from-top-4">
            
            {/* Header */}
            <div className="flex justify-between items-center p-6 pb-2">
                <div>
                    <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                        Base Builder
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Autonomous Gathering Sim</p>
                </div>
                <button 
                    onClick={() => setIsCollapsed(true)}
                    className="p-1.5 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                    <X size={18} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-2">
                {/* Tabs */}
                <div className="flex bg-slate-900/50 p-1 rounded-lg mb-6">
                    <button 
                        onClick={() => setActiveTab('stats')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded text-sm font-medium transition-colors ${
                            activeTab === 'stats' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'
                        }`}
                    >
                        <BarChart2 size={14} /> Stats
                    </button>
                    <button 
                        onClick={() => setActiveTab('settings')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded text-sm font-medium transition-colors ${
                            activeTab === 'settings' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'
                        }`}
                    >
                        <Settings size={14} /> Settings
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex flex-col gap-6">
                    {activeTab === 'stats' ? (
                        <>
                            {/* Controls */}
                            <div className="flex flex-col gap-4">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={onTogglePlay}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-colors ${
                                            isRunning 
                                                ? 'bg-amber-600 hover:bg-amber-500 text-white' 
                                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                        }`}
                                    >
                                        {isRunning ? <Pause size={18} /> : <Play size={18} />}
                                        {isRunning ? 'Pause' : 'Resume'}
                                    </button>
                                    <button 
                                        onClick={onReset}
                                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors"
                                        title="Reset Simulation"
                                    >
                                        <RotateCcw size={18} />
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-slate-400 uppercase tracking-wider font-semibold">
                                        <span>Sim Speed</span>
                                        <span className="text-cyan-400">{tickRate} TPS</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="1" 
                                        max="60" 
                                        step="1"
                                        value={tickRate}
                                        onChange={(e) => onSpeedChange(parseInt(e.target.value))}
                                        className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400"
                                    />
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <StatCard 
                                    icon={<Activity size={18} className="text-blue-400" />} 
                                    label="Ticks" 
                                    value={stats.tickCount.toLocaleString()} 
                                />
                                <StatCard 
                                    icon={<Users size={18} className="text-emerald-400" />} 
                                    label="Agents" 
                                    value={stats.agentCount.toString()} 
                                />
                                <StatCard 
                                    icon={<Hexagon size={18} className="text-purple-400" />} 
                                    label="Base Size" 
                                    value={`${Math.floor(stats.baseSize)}px`} 
                                />
                                <StatCard 
                                    icon={<Box size={18} className="text-amber-400" />} 
                                    label="Resources" 
                                    value={stats.resourceCount.toLocaleString()} 
                                />
                            </div>

                            {/* Total Points Highlight */}
                            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700/50 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Zap size={48} />
                                </div>
                                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">
                                    Total Energy
                                </div>
                                <div className="text-2xl font-mono text-cyan-300">
                                    {stats.totalPoints.toLocaleString()}
                                </div>
                            </div>

                            {/* Legend */}
                            <div className="text-xs text-slate-500 space-y-2 pt-2 border-t border-slate-700">
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-500"></span> Searching
                                    <span className="w-2 h-2 rounded-full bg-yellow-500 ml-2"></span> Approach
                                    <span className="w-2 h-2 rounded-full bg-green-500 ml-2"></span> Return
                                    <span className="w-2 h-2 rounded-full bg-violet-500 ml-2"></span> Revisit
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-6">
                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2">
                                <RotateCcw className="text-amber-500 shrink-0 mt-0.5" size={16} />
                                <p className="text-xs text-amber-200">Some settings require a reset to take effect.</p>
                            </div>

                            <SettingGroup title="Behavior">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-300">Pathfinding Algorithm</span>
                                    </div>
                                    <select 
                                        value={config.PATHFINDING_MODE} 
                                        onChange={(e) => handleConfigUpdate('PATHFINDING_MODE', e.target.value as PathfindingMode)}
                                        className="w-full bg-slate-900 text-slate-200 text-sm rounded-lg p-2 border border-slate-700 focus:ring-1 focus:ring-blue-500 outline-none"
                                    >
                                        <option value={PathfindingMode.DIRECT} title="Fast movement ignoring obstacles.">
                                            Direct (Euclidean)
                                        </option>
                                        <option value={PathfindingMode.A_STAR} title="Smart navigation avoiding the base.">
                                            A* (Avoid Base)
                                        </option>
                                        <option value={PathfindingMode.GREEDY} title="Greedy search, fast but less optimal.">
                                            Greedy Best-First
                                        </option>
                                        <option value={PathfindingMode.DIJKSTRA} title="Guaranteed shortest path, explores more.">
                                            Dijkstra
                                        </option>
                                    </select>
                                    
                                    <div className="flex items-center gap-2 mt-2 pt-1">
                                        <input 
                                            type="checkbox"
                                            id="smoothing"
                                            checked={config.ENABLE_SMOOTHING}
                                            onChange={(e) => handleConfigUpdate('ENABLE_SMOOTHING', e.target.checked)}
                                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-800"
                                        />
                                        <label htmlFor="smoothing" className="text-xs text-slate-300 select-none cursor-pointer">
                                            Enable Path Smoothing
                                        </label>
                                    </div>

                                    <p className="text-[10px] text-slate-400 mt-2 leading-tight">
                                        {config.PATHFINDING_MODE === PathfindingMode.DIRECT 
                                            ? "Agents move in a straight line to targets. Computationally cheap but agents may get stuck on the base."
                                            : config.PATHFINDING_MODE === PathfindingMode.A_STAR 
                                            ? "Agents use A* to intelligently navigate around the base. Slower performance but prevents getting stuck."
                                            : config.PATHFINDING_MODE === PathfindingMode.GREEDY
                                            ? "Agents use Greedy Best-First Search. Faster than A* but path may not be shortest."
                                            : "Dijkstra guarantees the shortest path but explores uniformly, making it slower than A*."}
                                    </p>
                                </div>

                                <RangeInput 
                                    label="Agent Speed" 
                                    value={config.AGENT_SPEED} 
                                    min={1} max={20} 
                                    onChange={(v) => handleConfigUpdate('AGENT_SPEED', v)} 
                                />
                                <RangeInput 
                                    label="Movement Jitter" 
                                    value={config.AGENT_WIGGLE} 
                                    min={0} max={1.0} step={0.05}
                                    format={(v) => Math.round(v * 100) + '%'}
                                    onChange={(v) => handleConfigUpdate('AGENT_WIGGLE', v)} 
                                />
                                <RangeInput 
                                    label="Sensor Range (LOS)" 
                                    value={config.AGENT_LOS} 
                                    min={32} max={512} step={16}
                                    onChange={(v) => handleConfigUpdate('AGENT_LOS', v)} 
                                />
                                <RangeInput 
                                    label="Cluster Chance" 
                                    value={config.RESOURCE_CLUSTER_CHANCE} 
                                    min={0} max={1.0} step={0.05}
                                    format={(v) => Math.round(v * 100) + '%'}
                                    onChange={(v) => handleConfigUpdate('RESOURCE_CLUSTER_CHANCE', v)} 
                                />
                                <RangeInput 
                                    label="Max Cluster Size" 
                                    value={config.RESOURCE_CLUSTER_SIZE} 
                                    min={1} max={50} step={1}
                                    onChange={(v) => handleConfigUpdate('RESOURCE_CLUSTER_SIZE', v)} 
                                />
                                <RangeInput 
                                    label="Cluster Radius" 
                                    value={config.RESOURCE_CLUSTER_RADIUS} 
                                    min={10} max={200} step={10}
                                    onChange={(v) => handleConfigUpdate('RESOURCE_CLUSTER_RADIUS', v)} 
                                />
                                <RangeInput 
                                    label="Agent Cost" 
                                    value={config.AGENT_SPAWN_THRESHOLD} 
                                    min={10000} max={500000} step={5000}
                                    format={(v) => (v / 1000).toFixed(1) + 'k'}
                                    onChange={(v) => handleConfigUpdate('AGENT_SPAWN_THRESHOLD', v)} 
                                />
                                <RangeInput 
                                    label="Base Production" 
                                    value={config.BASE_POINT_MULTIPLIER} 
                                    min={0.1} max={5} step={0.1}
                                    format={(v) => v.toFixed(1) + 'x'}
                                    onChange={(v) => handleConfigUpdate('BASE_POINT_MULTIPLIER', v)} 
                                />
                                <RangeInput 
                                    label="Max Agents" 
                                    value={config.MAX_AGENTS} 
                                    min={10} max={5000} step={10}
                                    onChange={(v) => handleConfigUpdate('MAX_AGENTS', v)} 
                                />
                            </SettingGroup>

                            <SettingGroup title="Initial Conditions (Requires Reset)">
                                <RangeInput 
                                    label="Chunk Size" 
                                    value={config.WORLD_SIZE} 
                                    min={512} max={4096} step={128}
                                    onChange={(v) => handleConfigUpdate('WORLD_SIZE', v)} 
                                />
                                <RangeInput 
                                    label="Start Agents" 
                                    value={config.INITIAL_AGENTS} 
                                    min={1} max={100} 
                                    onChange={(v) => handleConfigUpdate('INITIAL_AGENTS', v)} 
                                />
                                <RangeInput 
                                    label="Start Resources" 
                                    value={config.INITIAL_RESOURCES} 
                                    min={0} max={200} step={10}
                                    onChange={(v) => handleConfigUpdate('INITIAL_RESOURCES', v)} 
                                />
                                <RangeInput 
                                    label="Base Start Size" 
                                    value={config.BASE_START_SIZE} 
                                    min={8} max={512} step={8}
                                    onChange={(v) => handleConfigUpdate('BASE_START_SIZE', v)} 
                                />
                                <RangeInput 
                                    label="Agent Size" 
                                    value={config.AGENT_SIZE} 
                                    min={8} max={64} step={4}
                                    onChange={(v) => handleConfigUpdate('AGENT_SIZE', v)} 
                                />
                                <RangeInput 
                                    label="Resource Size" 
                                    value={config.RESOURCE_SIZE} 
                                    min={4} max={32} step={4}
                                    onChange={(v) => handleConfigUpdate('RESOURCE_SIZE', v)} 
                                />
                            </SettingGroup>
                            
                            <button 
                                onClick={onReset}
                                className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition-colors flex items-center justify-center gap-2"
                            >
                                <RotateCcw size={16} /> Apply & Reset
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
    <div className="bg-slate-700/30 p-3 rounded-lg border border-slate-700/50">
        <div className="flex items-center gap-2 mb-1">
            {icon}
            <span className="text-xs text-slate-400 font-medium uppercase">{label}</span>
        </div>
        <div className="text-lg font-semibold text-slate-200">
            {value}
        </div>
    </div>
);

const SettingGroup: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-700 pb-1">{title}</h3>
        {children}
    </div>
);

const RangeInput: React.FC<{ 
    label: string; 
    value: number; 
    min: number; 
    max: number; 
    step?: number;
    format?: (v: number) => string;
    onChange: (val: number) => void;
}> = ({ label, value, min, max, step = 1, format, onChange }) => (
    <div className="space-y-1">
        <div className="flex justify-between text-xs">
            <span className="text-slate-300">{label}</span>
            <span className="text-cyan-400 font-mono">{format ? format(value) : value}</span>
        </div>
        <input 
            type="range" 
            min={min} 
            max={max} 
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400"
        />
    </div>
);

export default StatsPanel;