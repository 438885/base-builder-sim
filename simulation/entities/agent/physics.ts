import { AgentState, PathfindingMode } from '../../../types';
import { RectImpl, Point, findPath } from '../../math';
import { Resource } from '../Resource';
import { Base, Slot } from '../Base';
import { GRID_SIZE } from '../../constants';
import type { SimulationEngine } from '../../engine';
import type { Agent } from './Agent';

export function calculateStandPos(agent: Agent, slot: Slot, base: Base) {
    let standX = slot.x;
    let standY = slot.y;
    const r = base.resourceSize;
    
    const GAP = 1;
    if (slot.y < base.rect.y) { // Top
        standY = slot.y - agent.rect.h - GAP;
        standX = slot.x + (r - agent.rect.w) / 2;
    } else if (slot.y >= base.rect.y + base.rect.h) { // Bottom
        standY = slot.y + r + GAP;
        standX = slot.x + (r - agent.rect.w) / 2;
    } else if (slot.x < base.rect.x) { // Left
        standX = slot.x - agent.rect.w - GAP;
        standY = slot.y + (r - agent.rect.h) / 2;
    } else if (slot.x >= base.rect.x + base.rect.w) { // Right
        standX = slot.x + r + GAP;
        standY = slot.y + (r - agent.rect.h) / 2;
    }
    return { x: standX, y: standY };
}

export function moveTowards(agent: Agent, tx: number, ty: number, speed: number, wiggle: number) {
    const dx = tx - agent.rect.x;
    const dy = ty - agent.rect.y;
    
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

    agent.rect.x += mx;
    agent.rect.y += my;
    agent.lastMove = { x: mx, y: my };
}

export function resolveCollisions(agent: Agent, world: SimulationEngine) {
    const GRID_CELL = 32;
    
    const cx = Math.floor((agent.rect.x + agent.rect.w/2) / GRID_CELL);
    const cy = Math.floor((agent.rect.y + agent.rect.h/2) / GRID_CELL);

    for (let y = cy - 1; y <= cy + 1; y++) {
        for (let x = cx - 1; x <= cx + 1; x++) {
            const key = `${x},${y}`;
            const cell = world.agentGrid.get(key);
            if (cell) {
                for (const other of cell) {
                    if (other === agent) continue;
                    if (agent.rect.collidesWith(other.rect)) {
                        const dx = (agent.rect.x + agent.rect.w/2) - (other.rect.x + other.rect.w/2);
                        const dy = (agent.rect.y + agent.rect.h/2) - (other.rect.y + other.rect.h/2);
                        const dist = Math.sqrt(dx*dx + dy*dy) || 0.001;
                        
                        // Proportional push force to avoid extreme jitter
                        const overlap = (agent.rect.w + other.rect.w) / 2 - dist;
                        const pushForce = Math.max(0.1, overlap * 0.5); 
                        
                        agent.rect.x += (dx / dist) * pushForce;
                        agent.rect.y += (dy / dist) * pushForce;
                    }
                }
            }
        }
    }

    if (agent.rect.collidesWith(world.base.rect)) {
        const br = world.base.rect;
        const distL = Math.abs((agent.rect.x + agent.rect.w) - br.x);
        const distR = Math.abs(agent.rect.x - (br.x + br.w));
        const distT = Math.abs((agent.rect.y + agent.rect.h) - br.y);
        const distB = Math.abs(agent.rect.y - (br.y + br.h));

        const minDist = Math.min(distL, distR, distT, distB);

        if (minDist === distL) {
            agent.rect.x = br.x - agent.rect.w - 1;
            if (agent.lastMove.x > 0) agent.lastMove.x = 0;
        }
        else if (minDist === distR) {
            agent.rect.x = br.x + br.w + 1;
            if (agent.lastMove.x < 0) agent.lastMove.x = 0;
        }
        else if (minDist === distT) {
            agent.rect.y = br.y - agent.rect.h - 1;
            if (agent.lastMove.y > 0) agent.lastMove.y = 0;
        }
        else if (minDist === distB) {
            agent.rect.y = br.y + br.h + 1;
            if (agent.lastMove.y < 0) agent.lastMove.y = 0;
        }
        
        if (agent.state === AgentState.SEARCH) {
            const angle = (Math.random() - 0.5) * Math.PI;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const nx = agent.lastMove.x * cos - agent.lastMove.y * sin;
            const ny = agent.lastMove.x * sin + agent.lastMove.y * cos;
            agent.lastMove.x = nx;
            agent.lastMove.y = ny;
        }
    }
}
