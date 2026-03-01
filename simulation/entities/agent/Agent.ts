import { AgentState } from '../../../types';
import { RectImpl, Point } from '../../math';
import { Resource } from '../Resource';
import { Slot } from '../Base';
import type { SimulationEngine } from '../../engine';
import { updateAgent } from './logic';
import { resolveCollisions } from './physics';

export class Agent {
    rect: RectImpl;
    lastMove: { x: number; y: number };
    targetResource: Resource | null = null;
    carriedResource: Resource | null = null;
    state: AgentState = AgentState.SEARCH;
    id: string;
    stuckTicks: number = 0;
    lastPos: { x: number; y: number } = { x: 0, y: 0 };
    
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

    calculatePriority(world: SimulationEngine, resourcePos: { x: number; y: number }): number {
        const cx = this.rect.x + this.rect.w / 2;
        const cy = this.rect.y + this.rect.h / 2;
        
        // Proximity to resource (higher is better)
        const distToRes = Math.sqrt((cx - resourcePos.x) ** 2 + (cy - resourcePos.y) ** 2);
        const resourceScore = 1000 / (distToRes + 1);

        // Proximity to base (higher is better - closer agents can deliver faster)
        const bcx = world.base.rect.x + world.base.rect.w / 2;
        const bcy = world.base.rect.y + world.base.rect.h / 2;
        const distToBase = Math.sqrt((cx - bcx) ** 2 + (cy - bcy) ** 2);
        const baseScore = 500 / (distToBase + 1);

        // Task urgency
        const urgencyScore = this.state === AgentState.REVISIT ? 300 : 0;

        return resourceScore + baseScore + urgencyScore;
    }

    update(world: SimulationEngine) {
        updateAgent(this, world);
        resolveCollisions(this, world);
    }
}
