import { AgentState, PathfindingMode } from '../../types';
import { RectImpl, Point, findPath } from '../math';
import { Resource } from './Resource';
import { Base, Slot } from './Base';
import { GRID_SIZE } from '../constants';
import type { SimulationEngine } from '../engine';

export class Agent {
    rect: RectImpl;
    lastMove: { x: number; y: number };
    targetResource: Resource | null = null;
    carriedResource: Resource | null = null;
    state: AgentState = AgentState.SEARCH;
    id: string;
    
    // Memory
    lastPickupPos: { x: number; y: number } | null = null;
    hasNearbyResources: boolean = false;
    
    // Pathfinding
    path: Point[] = [];
    pathIndex: number = 0;

    targetSlot: Slot | null = null;
    standPos: { x: number; y: number } | null = null;

    constructor(x: number, y: number, size: number, initialSpeed: number) {
        this.rect = new RectImpl(x, y, size, size);
        const angle = Math.random() * Math.PI * 2;
        this.lastMove = { 
            x: Math.cos(angle) * initialSpeed, 
            y: Math.sin(angle) * initialSpeed 
        };
        this.id = Math.random().toString(36).substr(2, 9);
    }

    _calculateStandPos(slot: Slot, base: Base) {
        let standX = slot.x;
        let standY = slot.y;
        const r = base.resourceSize;
        
        if (slot.y < base.rect.y) { // Top
            standY = slot.y - this.rect.h;
            standX = slot.x + (r - this.rect.w) / 2;
        } else if (slot.y >= base.rect.y + base.rect.h) { // Bottom
            standY = slot.y + r;
            standX = slot.x + (r - this.rect.w) / 2;
        } else if (slot.x < base.rect.x) { // Left
            standX = slot.x - this.rect.w;
            standY = slot.y + (r - this.rect.h) / 2;
        } else if (slot.x >= base.rect.x + base.rect.w) { // Right
            standX = slot.x + r;
            standY = slot.y + (r - this.rect.h) / 2;
        }
        return { x: standX, y: standY };
    }

    _moveTowards(tx: number, ty: number, speed: number, wiggle: number) {
        const dx = tx - this.rect.x;
        const dy = ty - this.rect.y;
        
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        let mx = 0;
        let my = 0;

        if (dist > speed) {
            mx = (dx / dist) * speed;
            my = (dy / dist) * speed;
        } else {
            mx = dx;
            my = dy;
        }

        if (wiggle > 0 && Math.random() < wiggle) {
             const dirs = [
                 {x: speed, y: 0}, {x: -speed, y: 0},
                 {x: 0, y: speed}, {x: 0, y: -speed}
             ];
             const randDir = dirs[Math.floor(Math.random() * dirs.length)];
             mx = randDir.x;
             my = randDir.y;
        }

        this.rect.x += mx;
        this.rect.y += my;
        this.lastMove = { x: mx, y: my };
    }

    update(world: SimulationEngine) {
        const { AGENT_SPEED, AGENT_LOS, WORLD_SIZE, AGENT_WIGGLE, PATHFINDING_MODE, ENABLE_SMOOTHING } = world.config;

        const currentSpeedSq = this.lastMove.x ** 2 + this.lastMove.y ** 2;
        if (currentSpeedSq > 0 && Math.abs(currentSpeedSq - AGENT_SPEED ** 2) > 0.1) {
            const scale = AGENT_SPEED / Math.sqrt(currentSpeedSq);
            this.lastMove.x *= scale;
            this.lastMove.y *= scale;
        }

        if (this.state === AgentState.SEARCH || this.state === AgentState.REVISIT) {
            if (this.state === AgentState.SEARCH) {
                this.path = [];
                
                this.rect.x += this.lastMove.x;
                this.rect.y += this.lastMove.y;

                if (AGENT_WIGGLE > 0 && Math.random() < AGENT_WIGGLE * 0.05) {
                    const angleChange = (Math.random() - 0.5) * Math.PI / 2;
                    const cos = Math.cos(angleChange);
                    const sin = Math.sin(angleChange);
                    const nx = this.lastMove.x * cos - this.lastMove.y * sin;
                    const ny = this.lastMove.x * sin + this.lastMove.y * cos;
                    this.lastMove.x = nx;
                    this.lastMove.y = ny;
                }
            } else {
                if (!this.lastPickupPos) {
                    this.state = AgentState.SEARCH;
                } else {
                    const targetX = this.lastPickupPos.x;
                    const targetY = this.lastPickupPos.y;

                    if (PATHFINDING_MODE === PathfindingMode.DIRECT) {
                        this._moveTowards(targetX, targetY, AGENT_SPEED, 0);
                    } else {
                        if (this.path.length === 0) {
                            this.path = findPath(this.rect, {x: targetX + this.rect.w/2, y: targetY + this.rect.h/2}, world.base.rect, PATHFINDING_MODE, ENABLE_SMOOTHING);
                            this.pathIndex = 0;
                        }
                        
                        if (this.pathIndex < this.path.length) {
                            const nextPoint = this.path[this.pathIndex];
                            this._moveTowards(nextPoint.x - this.rect.w/2, nextPoint.y - this.rect.h/2, AGENT_SPEED, 0);
                            
                            if (Math.abs(this.rect.x + this.rect.w/2 - nextPoint.x) < AGENT_SPEED && Math.abs(this.rect.y + this.rect.h/2 - nextPoint.y) < AGENT_SPEED) {
                                this.pathIndex++;
                            }
                        } else {
                            this._moveTowards(targetX, targetY, AGENT_SPEED, 0);
                        }
                    }

                    const distToTarget = Math.sqrt(Math.pow(this.rect.x - targetX, 2) + Math.pow(this.rect.y - targetY, 2));
                    if (distToTarget < AGENT_SPEED * 2) {
                        this.state = AgentState.SEARCH;
                        this.hasNearbyResources = false;
                        this.path = [];
                    }
                }
            }

            const cx = this.rect.x + this.rect.w / 2;
            const cy = this.rect.y + this.rect.h / 2;
            const losSq = AGENT_LOS * AGENT_LOS;
            
            const chunkSize = world.config.WORLD_SIZE;
            const chunkX = Math.floor(this.rect.x / chunkSize);
            const chunkY = Math.floor(this.rect.y / chunkSize);
            
            let foundTarget = false;

            for (let y = chunkY - 1; y <= chunkY + 1; y++) {
                for (let x = chunkX - 1; x <= chunkX + 1; x++) {
                    const key = `${x},${y}`;
                    const chunkResources = world.resourceChunks.get(key);
                    if (!chunkResources) continue;

                    for (const res of chunkResources) {
                        if (!res.isCarried && !res.isDeposited) {
                            const rcx = res.rect.x + res.rect.w / 2;
                            const rcy = res.rect.y + res.rect.h / 2;
                            
                            const distSq = (cx - rcx) ** 2 + (cy - rcy) ** 2;

                            if (distSq <= losSq) {
                                let isClaimedByNeighbor = false;

                                if (res.claimedBy && res.claimedBy !== this) {
                                    const ocx = res.claimedBy.rect.x + res.claimedBy.rect.w / 2;
                                    const ocy = res.claimedBy.rect.y + res.claimedBy.rect.h / 2;
                                    const distToAgentSq = (cx - ocx) ** 2 + (cy - ocy) ** 2;

                                    if (distToAgentSq <= losSq) {
                                        isClaimedByNeighbor = true;
                                    }
                                }

                                if (!isClaimedByNeighbor) {
                                    this.targetResource = res;
                                    res.claimedBy = this;
                                    this.state = AgentState.APPROACH;
                                    this.path = [];
                                    foundTarget = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (foundTarget) break;
                }
                if (foundTarget) break;
            }
        } else if (this.state === AgentState.APPROACH) {
            if (!this.targetResource || this.targetResource.isCarried || this.targetResource.isDeposited) {
                if (this.targetResource && this.targetResource.claimedBy === this) {
                    this.targetResource.claimedBy = null;
                }
                this.targetResource = null;
                this.state = AgentState.SEARCH;
                this.path = [];
                return;
            }

            if (PATHFINDING_MODE === PathfindingMode.DIRECT) {
                 this._moveTowards(this.targetResource.rect.x, this.targetResource.rect.y, AGENT_SPEED, AGENT_WIGGLE);
            } else {
                if (this.path.length === 0) {
                    this.path = findPath(this.rect, this.targetResource.rect, world.base.rect, PATHFINDING_MODE, ENABLE_SMOOTHING);
                    this.pathIndex = 0;
                }
                
                if (this.pathIndex < this.path.length) {
                    const nextPoint = this.path[this.pathIndex];
                    this._moveTowards(nextPoint.x, nextPoint.y, AGENT_SPEED, 0);
                    
                    if (Math.abs(this.rect.x - nextPoint.x) < AGENT_SPEED && Math.abs(this.rect.y - nextPoint.y) < AGENT_SPEED) {
                        this.pathIndex++;
                    }
                } else {
                     this._moveTowards(this.targetResource.rect.x, this.targetResource.rect.y, AGENT_SPEED, 0);
                }
            }

            if (this.rect.collidesWith(this.targetResource.rect)) {
                this.lastPickupPos = { x: this.targetResource.rect.x, y: this.targetResource.rect.y };
                
                this.hasNearbyResources = false;
                const losSq = AGENT_LOS * AGENT_LOS;
                const chunkSize = world.config.WORLD_SIZE;
                const chunkX = Math.floor(this.rect.x / chunkSize);
                const chunkY = Math.floor(this.rect.y / chunkSize);
                
                outer: for (let y = chunkY - 1; y <= chunkY + 1; y++) {
                    for (let x = chunkX - 1; x <= chunkX + 1; x++) {
                        const key = `${x},${y}`;
                        const chunkResources = world.resourceChunks.get(key);
                        if (!chunkResources) continue;
                        for (const res of chunkResources) {
                            if (res !== this.targetResource && !res.isCarried && !res.isDeposited) {
                                const distSq = (this.rect.x - res.rect.x) ** 2 + (this.rect.y - res.rect.y) ** 2;
                                if (distSq <= losSq) {
                                    this.hasNearbyResources = true;
                                    break outer;
                                }
                            }
                        }
                    }
                }

                this.carriedResource = this.targetResource;
                this.carriedResource.isCarried = true;
                if (this.targetResource.claimedBy === this) {
                    this.targetResource.claimedBy = null;
                }
                this.targetResource = null;
                this.state = AgentState.RETURN;
                this.path = [];
                this.targetSlot = world.base.reserveSlot({ x: this.rect.x, y: this.rect.y });
                if (this.targetSlot) {
                    this.standPos = this._calculateStandPos(this.targetSlot, world.base);
                }
            }
        } else if (this.state === AgentState.RETURN) {
            if (!this.carriedResource) {
                this.state = AgentState.SEARCH;
                this.path = [];
                if (this.targetSlot) {
                    this.targetSlot.reserved = false;
                    this.targetSlot = null;
                    this.standPos = null;
                }
                return;
            }

            if (!this.targetSlot) {
                this.targetSlot = world.base.reserveSlot({ x: this.rect.x, y: this.rect.y });
                if (this.targetSlot) {
                    this.standPos = this._calculateStandPos(this.targetSlot, world.base);
                }
            }

            let targetX = world.base.rect.center.x - this.rect.w / 2;
            let targetY = world.base.rect.center.y - this.rect.h / 2;

            if (this.standPos) {
                targetX = this.standPos.x;
                targetY = this.standPos.y;
            }

            const distToBase = Math.sqrt(
                Math.pow(this.rect.center.x - world.base.rect.center.x, 2) +
                Math.pow(this.rect.center.y - world.base.rect.center.y, 2)
            );
            const withinLOS = distToBase <= AGENT_LOS;
            
            const effectiveMode = (withinLOS && PATHFINDING_MODE === PathfindingMode.DIRECT) ? PathfindingMode.A_STAR : PATHFINDING_MODE;

            if (effectiveMode === PathfindingMode.DIRECT || !this.standPos) {
                this._moveTowards(targetX, targetY, AGENT_SPEED, 0);
            } else {
                if (this.path.length === 0) {
                    this.path = findPath(this.rect, {x: targetX + this.rect.w/2, y: targetY + this.rect.h/2}, world.base.rect, effectiveMode, ENABLE_SMOOTHING);
                    this.pathIndex = 0;
                }
                
                if (this.pathIndex < this.path.length) {
                    const nextPoint = this.path[this.pathIndex];
                    this._moveTowards(nextPoint.x - this.rect.w/2, nextPoint.y - this.rect.h/2, AGENT_SPEED, 0);
                    
                    if (Math.abs(this.rect.x + this.rect.w/2 - nextPoint.x) < AGENT_SPEED && Math.abs(this.rect.y + this.rect.h/2 - nextPoint.y) < AGENT_SPEED) {
                        this.pathIndex++;
                    }
                } else {
                    this._moveTowards(targetX, targetY, AGENT_SPEED, 0);
                }
            }

            if (Math.abs(this.lastMove.y) > Math.abs(this.lastMove.x)) {
                if (this.lastMove.y < 0) { // Up
                    this.carriedResource!.rect.x = this.rect.x + (this.rect.w - this.carriedResource!.rect.w) / 2;
                    this.carriedResource!.rect.y = this.rect.y - this.carriedResource!.rect.h;
                } else { // Down
                    this.carriedResource!.rect.x = this.rect.x + (this.rect.w - this.carriedResource!.rect.w) / 2;
                    this.carriedResource!.rect.y = this.rect.y + this.rect.h;
                }
            } else {
                if (this.lastMove.x < 0) { // Left
                    this.carriedResource!.rect.x = this.rect.x - this.carriedResource!.rect.w;
                    this.carriedResource!.rect.y = this.rect.y + (this.rect.h - this.carriedResource!.rect.h) / 2;
                } else { // Right
                    this.carriedResource!.rect.x = this.rect.x + this.rect.w;
                    this.carriedResource!.rect.y = this.rect.y + (this.rect.h - this.carriedResource!.rect.h) / 2;
                }
            }

            if (this.standPos) {
                const distToStand = Math.sqrt(Math.pow(this.rect.x - this.standPos.x, 2) + Math.pow(this.rect.y - this.standPos.y, 2));
                if (distToStand <= AGENT_SPEED) {
                    const finalPath = findPath(this.rect, {x: targetX + this.rect.w/2, y: targetY + this.rect.h/2}, world.base.rect, PathfindingMode.A_STAR, ENABLE_SMOOTHING);
                    const lastPoint = finalPath[finalPath.length - 1];
                    const reachedDest = lastPoint && Math.abs(lastPoint.x - (targetX + this.rect.w/2)) < GRID_SIZE && Math.abs(lastPoint.y - (targetY + this.rect.h/2)) < GRID_SIZE;
                    const slotStillValid = world.base.slots.includes(this.targetSlot!);

                    if (reachedDest && slotStillValid) {
                        this.rect.x = this.standPos.x;
                        this.rect.y = this.standPos.y;
                        
                        world.base.deposit(this.carriedResource!, this.targetSlot!);
                        this.carriedResource = null;
                        this.targetSlot = null;
                        this.standPos = null;
                        
                        if (this.hasNearbyResources && this.lastPickupPos) {
                            this.state = AgentState.REVISIT;
                        } else {
                            this.state = AgentState.SEARCH;
                        }
                        
                        this.path = [];
                        
                        let dx = this.rect.x + this.rect.w/2 - world.base.rect.center.x;
                        let dy = this.rect.y + this.rect.h/2 - world.base.rect.center.y;
                        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
                        this.lastMove.x = (dx / dist) * AGENT_SPEED;
                        this.lastMove.y = (dy / dist) * AGENT_SPEED;
                    } else {
                        if (this.targetSlot) this.targetSlot.reserved = false;
                        this.targetSlot = null;
                        this.standPos = null;
                        this.path = [];
                        return;
                    }
                }
            }
        }
        
        this._resolveCollisions(world);
    }

    _resolveCollisions(world: SimulationEngine) {
        const GRID_CELL = 32;
        
        const cx = Math.floor((this.rect.x + this.rect.w/2) / GRID_CELL);
        const cy = Math.floor((this.rect.y + this.rect.h/2) / GRID_CELL);

        for (let y = cy - 1; y <= cy + 1; y++) {
            for (let x = cx - 1; x <= cx + 1; x++) {
                const key = `${x},${y}`;
                const cell = world.agentGrid.get(key);
                if (cell) {
                    for (const other of cell) {
                        if (other === this) continue;
                        if (this.rect.collidesWith(other.rect)) {
                            const dx = (this.rect.x + this.rect.w/2) - (other.rect.x + other.rect.w/2);
                            const dy = (this.rect.y + this.rect.h/2) - (other.rect.y + other.rect.h/2);
                            const dist = Math.sqrt(dx*dx + dy*dy) || 0.001;
                            
                            const pushForce = 0.5;
                            this.rect.x += (dx / dist) * pushForce;
                            this.rect.y += (dy / dist) * pushForce;
                        }
                    }
                }
            }
        }

        if (this.rect.collidesWith(world.base.rect)) {
            const br = world.base.rect;
            const distL = Math.abs((this.rect.x + this.rect.w) - br.x);
            const distR = Math.abs(this.rect.x - (br.x + br.w));
            const distT = Math.abs((this.rect.y + this.rect.h) - br.y);
            const distB = Math.abs(this.rect.y - (br.y + br.h));

            const minDist = Math.min(distL, distR, distT, distB);

            if (minDist === distL) this.rect.x = br.x - this.rect.w;
            else if (minDist === distR) this.rect.x = br.x + br.w;
            else if (minDist === distT) this.rect.y = br.y - this.rect.h;
            else if (minDist === distB) this.rect.y = br.y + br.h;
        }
    }
}
