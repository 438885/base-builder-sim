import React, { useRef, useEffect } from 'react';
import { SimulationEngine } from '../simulation/engine';
import { PathfindingMode } from '../types';

interface GameCanvasProps {
    engine: SimulationEngine;
    width: number;
    height: number;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ engine, width, height }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // View State stored in Ref to be accessible in render loop and event handlers without re-renders
    const viewRef = useRef({ x: 0, y: 0, scale: 1 });
    const isDragging = useRef(false);
    const lastPos = useRef({ x: 0, y: 0 });
    const lastPinchDist = useRef<number | null>(null);

    // Initialize View to Center
    useEffect(() => {
        const padding = 40;
        const availableW = width - padding;
        const availableH = height - padding;
        const worldSize = engine.config.WORLD_SIZE;
        
        // Calculate scale to fit world in screen
        const scale = Math.min(availableW / worldSize, availableH / worldSize);
        // Ensure some minimum scale so it doesn't look broken on huge worlds
        const safeScale = Math.max(scale, 0.05);

        viewRef.current = {
            scale: safeScale,
            x: (width - worldSize * safeScale) / 2,
            y: (height - worldSize * safeScale) / 2
        };
    }, [width, height, engine.config.WORLD_SIZE]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const render = () => {
            const { x, y, scale } = viewRef.current;
            
            ctx.fillStyle = '#020617'; // slate-950
            ctx.fillRect(0, 0, width, height);

            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);

            // Draw Background Grid (Optional, helps visualising space)
            // ctx.strokeStyle = '#1e293b';
            // ctx.lineWidth = 1 / scale;
            // ctx.strokeRect(0, 0, engine.config.WORLD_SIZE, engine.config.WORLD_SIZE);

            // Draw Base Area
            ctx.fillStyle = '#64748b'; // slate-500
            ctx.fillRect(engine.base.rect.x, engine.base.rect.y, engine.base.rect.w, engine.base.rect.h);

            // Draw Resources
            engine.resources.forEach(res => {
                ctx.fillStyle = res.color;
                ctx.fillRect(res.rect.x, res.rect.y, res.rect.w, res.rect.h);
            });

            // Draw Agent Paths (APPROACH state)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1; // Keeping 1 looks nicer when zoomed out, effectively invisible
            // To make it visible when zoomed out, maybe 1/scale but clamped
            
            ctx.setLineDash([4, 4]); // Dashed line
            
            ctx.beginPath();
            engine.agents.forEach(agent => {
                if (agent.state === 'APPROACH' && agent.targetResource) {
                    const ax = agent.rect.x + agent.rect.w / 2;
                    const ay = agent.rect.y + agent.rect.h / 2;

                    if (engine.config.PATHFINDING_MODE === PathfindingMode.A_STAR && agent.path && agent.path.length > 0) {
                        ctx.moveTo(ax, ay);
                        for(let i = agent.pathIndex; i < agent.path.length; i++) {
                            ctx.lineTo(agent.path[i].x, agent.path[i].y);
                        }
                        const tx = agent.targetResource.rect.x + agent.targetResource.rect.w / 2;
                        const ty = agent.targetResource.rect.y + agent.targetResource.rect.h / 2;
                        ctx.lineTo(tx, ty);
                    } 
                    else {
                        const tx = agent.targetResource.rect.x + agent.targetResource.rect.w / 2;
                        const ty = agent.targetResource.rect.y + agent.targetResource.rect.h / 2;
                        ctx.moveTo(ax, ay);
                        ctx.lineTo(tx, ty);
                    }
                }
            });
            ctx.stroke();
            ctx.setLineDash([]); 

            // Draw Agents
            engine.agents.forEach(agent => {
                switch (agent.state) {
                    case 'SEARCH': ctx.fillStyle = '#ef4444'; break;
                    case 'APPROACH': ctx.fillStyle = '#eab308'; break;
                    case 'RETURN': ctx.fillStyle = '#10b981'; break;
                }
                
                ctx.beginPath();
                ctx.roundRect(agent.rect.x, agent.rect.y, agent.rect.w, agent.rect.h, 2);
                ctx.fill();

                // Direction Indicator
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                const centerX = agent.rect.x + agent.rect.w / 2;
                const centerY = agent.rect.y + agent.rect.h / 2;
                const dx = Math.sign(agent.lastMove.x) * (agent.rect.w * 0.3);
                const dy = Math.sign(agent.lastMove.y) * (agent.rect.h * 0.3);
                
                ctx.beginPath();
                ctx.arc(centerX + dx, centerY + dy, agent.rect.w * 0.2, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.restore();
            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [engine, width, height]);

    // --- Interaction Handlers ---

    const handleWheel = (e: React.WheelEvent) => {
        // Prevent default only if we are consuming the event (usually good for canvas)
        // e.preventDefault(); // React's SyntheticEvent might not support this easily for passive listeners.
        
        const zoomSpeed = 0.1;
        const delta = -Math.sign(e.deltaY) * zoomSpeed;
        const newScale = viewRef.current.scale * (1 + delta);
        const safeNewScale = Math.max(0.01, Math.min(newScale, 10));

        // Calculate world point under mouse before zoom
        const rect = canvasRef.current!.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        
        const worldX = (mx - viewRef.current.x) / viewRef.current.scale;
        const worldY = (my - viewRef.current.y) / viewRef.current.scale;

        // Apply new zoom
        viewRef.current.scale = safeNewScale;
        
        // Adjust position so world point under mouse remains stable
        viewRef.current.x = mx - worldX * safeNewScale;
        viewRef.current.y = my - worldY * safeNewScale;
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        isDragging.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        
        const dx = e.clientX - lastPos.current.x;
        const dy = e.clientY - lastPos.current.y;
        
        viewRef.current.x += dx;
        viewRef.current.y += dy;
        
        lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDragging.current = false;
        lastPinchDist.current = null; // Reset pinch
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    };

    // Touch specific for pinch zoom
    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const dist = Math.sqrt(Math.pow(t2.clientX - t1.clientX, 2) + Math.pow(t2.clientY - t1.clientY, 2));

            if (lastPinchDist.current !== null) {
                const center = {
                    x: (t1.clientX + t2.clientX) / 2,
                    y: (t1.clientY + t2.clientY) / 2
                };

                const ratio = dist / lastPinchDist.current;
                const newScale = Math.max(0.01, Math.min(viewRef.current.scale * ratio, 10));
                
                // Pivot around center
                const rect = canvasRef.current!.getBoundingClientRect();
                const mx = center.x - rect.left;
                const my = center.y - rect.top;
                
                const worldX = (mx - viewRef.current.x) / viewRef.current.scale;
                const worldY = (my - viewRef.current.y) / viewRef.current.scale;

                viewRef.current.scale = newScale;
                viewRef.current.x = mx - worldX * newScale;
                viewRef.current.y = my - worldY * newScale;
            }
            
            lastPinchDist.current = dist;
        }
    };

    const handleTouchEnd = () => {
        lastPinchDist.current = null;
    };

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="block touch-none cursor-grab active:cursor-grabbing outline-none"
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        />
    );
};

export default GameCanvas;