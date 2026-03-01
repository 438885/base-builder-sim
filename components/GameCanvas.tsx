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
    
    // Particle System for "Juice"
    const particles = useRef<{x: number, y: number, vx: number, vy: number, life: number, color: string, size?: number}[]>([]);
    const floatingTexts = useRef<{x: number, y: number, text: string, life: number, color: string}[]>([]);
    const lastDepositCount = useRef<number>(0);
    const basePulse = useRef<number>(0);

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

        const render = (time: number) => {
            const { x, y, scale } = viewRef.current;
            
            ctx.fillStyle = '#020617'; // slate-950
            ctx.fillRect(0, 0, width, height);

            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);

            // Update Particles
            particles.current = particles.current.filter(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.life -= 0.02;
                return p.life > 0;
            });

            // Update Floating Texts
            floatingTexts.current = floatingTexts.current.filter(t => {
                t.y -= 0.5;
                t.life -= 0.015;
                return t.life > 0;
            });

            // Update Base Pulse
            if (basePulse.current > 0) {
                basePulse.current -= 0.05;
            }

            // Detect new deposits for particles and pulse
            if (engine.totalPoints > lastDepositCount.current) {
                const pointsGained = engine.totalPoints - lastDepositCount.current;
                const br = engine.base.rect;
                
                // Trigger Pulse
                basePulse.current = 1.0;

                // Floating Text
                floatingTexts.current.push({
                    x: br.x + br.w / 2,
                    y: br.y - 10,
                    text: `+${Math.floor(pointsGained)}`,
                    life: 1.0,
                    color: '#22d3ee'
                });

                // Spawn some particles at the base perimeter
                for (let i = 0; i < 8; i++) {
                    const edge = Math.floor(Math.random() * 4);
                    let px = br.x, py = br.y;
                    if (edge === 0) { px += Math.random() * br.w; } // Top
                    else if (edge === 1) { px += Math.random() * br.w; py += br.h; } // Bottom
                    else if (edge === 2) { py += Math.random() * br.h; } // Left
                    else { px += br.w; py += Math.random() * br.h; } // Right

                    particles.current.push({
                        x: px,
                        y: py,
                        vx: (Math.random() - 0.5) * 3,
                        vy: (Math.random() - 0.5) * 3,
                        life: 1.0,
                        color: '#22d3ee',
                        size: Math.random() * 3 + 1
                    });
                }
                lastDepositCount.current = engine.totalPoints;
            }

            // Draw Base Area (Individual Blocks)
            const rSize = engine.config.RESOURCE_SIZE;
            const br = engine.base.rect;
            
            // Base Glow & Pulse
            const pulseScale = 1 + basePulse.current * 0.05;
            ctx.shadowBlur = (15 + basePulse.current * 20) / scale;
            ctx.shadowColor = basePulse.current > 0 
                ? `rgba(34, 211, 238, ${0.2 + basePulse.current * 0.5})` 
                : 'rgba(34, 211, 238, 0.2)';
            
            ctx.strokeStyle = '#020617'; // slate-950 (black-ish)
            ctx.lineWidth = 1 / scale; 
            
            if (basePulse.current > 0) {
                ctx.save();
                const centerX = br.x + br.w / 2;
                const centerY = br.y + br.h / 2;
                ctx.translate(centerX, centerY);
                ctx.scale(pulseScale, pulseScale);
                ctx.translate(-centerX, -centerY);
            }

            for (let bx = Math.floor(br.x); bx < Math.floor(br.x + br.w); bx += rSize) {
                for (let by = Math.floor(br.y); by < Math.floor(br.y + br.h); by += rSize) {
                    const gridX = Math.floor(bx / rSize);
                    const gridY = Math.floor(by / rSize);
                    const hue = 180 + (Math.abs(gridX * 13 + gridY * 7) % 60);
                    ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
                    ctx.fillRect(bx, by, rSize, rSize);
                    ctx.strokeRect(bx, by, rSize, rSize);
                }
            }

            if (basePulse.current > 0) {
                ctx.restore();
            }
            ctx.shadowBlur = 0;

            // Draw Slots (Faint outlines)
            ctx.strokeStyle = 'rgba(34, 211, 238, 0.1)';
            ctx.lineWidth = 0.5 / scale;
            engine.base.slots.forEach(slot => {
                if (!slot.reserved) {
                    ctx.strokeRect(slot.x, slot.y, rSize, rSize);
                }
            });

            // Draw Resources
            ctx.strokeStyle = '#020617'; // slate-950
            ctx.lineWidth = 1 / scale;
            engine.resources.forEach(res => {
                if (res.isCarried || res.isDeposited) return;
                ctx.fillStyle = res.color;
                ctx.fillRect(res.rect.x, res.rect.y, res.rect.w, res.rect.h);
                ctx.strokeRect(res.rect.x, res.rect.y, res.rect.w, res.rect.h);
            });

            // Draw Particles
            particles.current.forEach(p => {
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.life;
                const s = (p.size || 2) / scale;
                ctx.fillRect(p.x - s/2, p.y - s/2, s, s);
            });
            ctx.globalAlpha = 1.0;

            // Draw Floating Texts
            ctx.font = `${Math.max(10, 14 / scale)}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            floatingTexts.current.forEach(t => {
                ctx.fillStyle = t.color;
                ctx.globalAlpha = t.life;
                ctx.fillText(t.text, t.x, t.y);
            });
            ctx.globalAlpha = 1.0;

            // Draw Agent Paths (APPROACH, RETURN, and REVISIT states)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 1 / scale; 
            
            ctx.setLineDash([4, 4]); // Dashed line
            
            ctx.beginPath();
            engine.agents.forEach(agent => {
                const isApproaching = agent.state === 'APPROACH' && agent.targetResource;
                const isReturning = agent.state === 'RETURN' && agent.standPos;
                const isRevisiting = agent.state === 'REVISIT' && agent.lastPickupPos;

                if (isApproaching || isReturning || isRevisiting) {
                    const ax = agent.rect.x + agent.rect.w / 2;
                    const ay = agent.rect.y + agent.rect.h / 2;

                    if (agent.path && agent.path.length > 0) {
                        ctx.moveTo(ax, ay);
                        for(let i = agent.pathIndex; i < agent.path.length; i++) {
                            ctx.lineTo(agent.path[i].x, agent.path[i].y);
                        }
                        
                        // Final segment to target
                        let tx, ty;
                        if (isApproaching && agent.targetResource) {
                            tx = agent.targetResource.rect.x + agent.targetResource.rect.w / 2;
                            ty = agent.targetResource.rect.y + agent.targetResource.rect.h / 2;
                        } else if (isReturning && agent.standPos) {
                            tx = agent.standPos.x + agent.rect.w / 2;
                            ty = agent.standPos.y + agent.rect.h / 2;
                        } else if (isRevisiting && agent.lastPickupPos) {
                            tx = agent.lastPickupPos.x + agent.rect.w / 2;
                            ty = agent.lastPickupPos.y + agent.rect.h / 2;
                        }
                        
                        if (tx !== undefined && ty !== undefined) {
                            ctx.lineTo(tx, ty);
                        }
                    } 
                    else if (engine.config.PATHFINDING_MODE === PathfindingMode.DIRECT) {
                        // Direct line for non-pathfinding modes
                        let tx, ty;
                        if (isApproaching && agent.targetResource) {
                            tx = agent.targetResource.rect.x + agent.targetResource.rect.w / 2;
                            ty = agent.targetResource.rect.y + agent.targetResource.rect.h / 2;
                        } else if (isReturning && agent.standPos) {
                            tx = agent.standPos.x + agent.rect.w / 2;
                            ty = agent.standPos.y + agent.rect.h / 2;
                        } else if (isRevisiting && agent.lastPickupPos) {
                            tx = agent.lastPickupPos.x + agent.rect.w / 2;
                            ty = agent.lastPickupPos.y + agent.rect.h / 2;
                        }

                        if (tx !== undefined && ty !== undefined) {
                            ctx.moveTo(ax, ay);
                            ctx.lineTo(tx, ty);
                        }
                    }
                }
            });
            ctx.stroke();
            ctx.setLineDash([]); 

            // Draw Agents
            engine.agents.forEach(agent => {
                let agentColor = '#ef4444';
                switch (agent.state) {
                    case 'SEARCH': agentColor = '#ef4444'; break;
                    case 'APPROACH': agentColor = '#eab308'; break;
                    case 'RETURN': agentColor = '#10b981'; break;
                    case 'REVISIT': agentColor = '#8b5cf6'; break;
                }
                
                // Bobbing animation
                const bobOffset = Math.sin(time * 0.01 + parseInt(agent.id, 36)) * 1.5;
                
                ctx.fillStyle = agentColor;
                ctx.beginPath();
                ctx.roundRect(agent.rect.x, agent.rect.y + bobOffset, agent.rect.w, agent.rect.h, 2);
                ctx.fill();

                // Carried Resource
                if (agent.carriedResource) {
                    ctx.fillStyle = agent.carriedResource.color;
                    const resSize = agent.rect.w * 0.6;
                    ctx.fillRect(
                        agent.rect.x + (agent.rect.w - resSize) / 2,
                        agent.rect.y + (agent.rect.h - resSize) / 2 + bobOffset,
                        resSize,
                        resSize
                    );
                    ctx.strokeStyle = '#020617';
                    ctx.lineWidth = 0.5 / scale;
                    ctx.strokeRect(
                        agent.rect.x + (agent.rect.w - resSize) / 2,
                        agent.rect.y + (agent.rect.h - resSize) / 2 + bobOffset,
                        resSize,
                        resSize
                    );
                }

                // Direction Indicator
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                const centerX = agent.rect.x + agent.rect.w / 2;
                const centerY = agent.rect.y + agent.rect.h / 2 + bobOffset;
                const dx = Math.sign(agent.lastMove.x) * (agent.rect.w * 0.3);
                const dy = Math.sign(agent.lastMove.y) * (agent.rect.h * 0.3);
                
                ctx.beginPath();
                ctx.arc(centerX + dx, centerY + dy, agent.rect.w * 0.15, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.restore();
            animationFrameId = requestAnimationFrame(render);
        };

        animationFrameId = requestAnimationFrame(render);

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