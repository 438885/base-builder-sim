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
    stuckPos: { x: number; y: number } | null = null;
    
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

    update(world: SimulationEngine) {
        updateAgent(this, world);
        resolveCollisions(this, world);
    }
}
