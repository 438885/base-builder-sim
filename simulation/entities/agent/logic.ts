import { AgentState, PathfindingMode } from '../../../types';
import { findPath } from '../../math';
import { GRID_SIZE } from '../../constants';
import type { SimulationEngine } from '../../engine';
import type { Agent } from './Agent';
import { moveTowards, calculateStandPos } from './physics';

export function updateAgent(agent: Agent, world: SimulationEngine) {
    const { AGENT_SPEED, AGENT_LOS, WORLD_SIZE, AGENT_WIGGLE, PATHFINDING_MODE, ENABLE_SMOOTHING } = world.config;

    // Stuck detection
    if (!agent.stuckPos) {
        agent.stuckPos = { x: agent.rect.x, y: agent.rect.y };
    }
    const netDistMoved = Math.sqrt(Math.pow(agent.rect.x - agent.stuckPos.x, 2) + Math.pow(agent.rect.y - agent.stuckPos.y, 2));
    
    let isWaitingForSlot = false;
    if (agent.state === AgentState.RETURN && !agent.targetSlot) {
        const distToBase = Math.sqrt(
            Math.pow(agent.rect.center.x - world.base.rect.center.x, 2) +
            Math.pow(agent.rect.center.y - world.base.rect.center.y, 2)
        );
        const safeDistance = Math.max(world.base.rect.w, world.base.rect.h) / 2 + 32;
        if (distToBase < safeDistance) {
            isWaitingForSlot = true;
        }
    }

    if (netDistMoved < AGENT_SPEED * 1.5 && !isWaitingForSlot) {
        agent.stuckTicks++;
    } else {
        agent.stuckTicks = 0;
        agent.stuckPos = { x: agent.rect.x, y: agent.rect.y };
    }
    agent.lastPos = { x: agent.rect.x, y: agent.rect.y };

    if (agent.stuckTicks > 30) {
        const angle = Math.random() * Math.PI * 2;
        agent.rect.x += Math.cos(angle) * AGENT_SPEED * 2;
        agent.rect.y += Math.sin(angle) * AGENT_SPEED * 2;
        agent.stuckTicks = 0;
        agent.stuckPos = { x: agent.rect.x, y: agent.rect.y };
        agent.path = []; 
    }

    const currentSpeedSq = agent.lastMove.x ** 2 + agent.lastMove.y ** 2;
    if (currentSpeedSq > 0 && Math.abs(currentSpeedSq - AGENT_SPEED ** 2) > 0.1) {
        const scale = AGENT_SPEED / Math.sqrt(currentSpeedSq);
        agent.lastMove.x *= scale;
        agent.lastMove.y *= scale;
    }

    if (agent.state === AgentState.SEARCH || agent.state === AgentState.REVISIT) {
        if (agent.state === AgentState.SEARCH) {
            agent.path = [];
            
            agent.rect.x += agent.lastMove.x;
            agent.rect.y += agent.lastMove.y;

            if (AGENT_WIGGLE > 0 && Math.random() < AGENT_WIGGLE * 0.05) {
                const angleChange = (Math.random() - 0.5) * Math.PI / 2;
                const cos = Math.cos(angleChange);
                const sin = Math.sin(angleChange);
                const nx = agent.lastMove.x * cos - agent.lastMove.y * sin;
                const ny = agent.lastMove.x * sin + agent.lastMove.y * cos;
                agent.lastMove.x = nx;
                agent.lastMove.y = ny;
            }
        } else {
            if (!agent.lastPickupPos) {
                agent.state = AgentState.SEARCH;
            } else {
                const targetX = agent.lastPickupPos.x;
                const targetY = agent.lastPickupPos.y;

                if (PATHFINDING_MODE === PathfindingMode.DIRECT) {
                    moveTowards(agent, targetX, targetY, AGENT_SPEED, 0);
                } else {
                    if (agent.path.length === 0) {
                        agent.path = findPath(agent.rect, {x: targetX + agent.rect.w/2, y: targetY + agent.rect.h/2}, world.base.rect, PATHFINDING_MODE, ENABLE_SMOOTHING);
                        agent.pathIndex = 0;
                    }
                    
                    if (agent.pathIndex < agent.path.length) {
                        const nextPoint = agent.path[agent.pathIndex];
                        moveTowards(agent, nextPoint.x - agent.rect.w/2, nextPoint.y - agent.rect.h/2, AGENT_SPEED, 0);
                        
                        if (Math.abs(agent.rect.x + agent.rect.w/2 - nextPoint.x) < AGENT_SPEED && Math.abs(agent.rect.y + agent.rect.h/2 - nextPoint.y) < AGENT_SPEED) {
                            agent.pathIndex++;
                        }
                    } else {
                        moveTowards(agent, targetX, targetY, AGENT_SPEED, 0);
                    }
                }

                const distToTarget = Math.sqrt(Math.pow(agent.rect.x - targetX, 2) + Math.pow(agent.rect.y - targetY, 2));
                if (distToTarget < AGENT_SPEED * 2) {
                    agent.state = AgentState.SEARCH;
                    agent.hasNearbyResources = false;
                    agent.path = [];
                }
            }
        }

        const cx = agent.rect.x + agent.rect.w / 2;
        const cy = agent.rect.y + agent.rect.h / 2;
        const losSq = AGENT_LOS * AGENT_LOS;
        
        const chunkSize = world.config.WORLD_SIZE;
        const chunkX = Math.floor(agent.rect.x / chunkSize);
        const chunkY = Math.floor(agent.rect.y / chunkSize);
        
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
                            const currentTick = world.tickCount;

                            if (res.claimedBy && res.claimedBy !== agent) {
                                // Expiration check: if claimed more than 300 ticks ago, it expires
                                if (currentTick - res.claimTime > 300) {
                                    res.claimedBy.targetResource = null;
                                    res.claimedBy.state = AgentState.SEARCH;
                                    res.claimedBy = null;
                                } else {
                                    const ocx = res.claimedBy.rect.x + res.claimedBy.rect.w / 2;
                                    const ocy = res.claimedBy.rect.y + res.claimedBy.rect.h / 2;
                                    const distToAgentSq = (cx - ocx) ** 2 + (cy - ocy) ** 2;

                                    if (distToAgentSq <= losSq) {
                                        // Priority check: Steal if we are significantly closer
                                        const otherDistToResSq = (ocx - rcx) ** 2 + (ocy - rcy) ** 2;
                                        if (distSq < otherDistToResSq * 0.5) { // We are much closer
                                            res.claimedBy.targetResource = null;
                                            res.claimedBy.state = AgentState.SEARCH;
                                            res.claimedBy = null;
                                        } else {
                                            isClaimedByNeighbor = true;
                                        }
                                    }
                                }
                            }

                            if (!isClaimedByNeighbor) {
                                agent.targetResource = res;
                                res.claimedBy = agent;
                                res.claimTime = currentTick;
                                agent.state = AgentState.APPROACH;
                                agent.path = [];
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
    } else if (agent.state === AgentState.APPROACH) {
        if (!agent.targetResource || agent.targetResource.isCarried || agent.targetResource.isDeposited) {
            if (agent.targetResource && agent.targetResource.claimedBy === agent) {
                agent.targetResource.claimedBy = null;
            }
            agent.targetResource = null;
            agent.state = AgentState.SEARCH;
            agent.path = [];
            return;
        }

        // Check if we lost our claim (stolen or expired)
        if (agent.targetResource.claimedBy !== agent) {
            agent.targetResource = null;
            agent.state = AgentState.SEARCH;
            agent.path = [];
            return;
        }

        // Expiration check
        const currentTick = world.tickCount;
        if (currentTick - agent.targetResource.claimTime > 300) {
            agent.targetResource.claimedBy = null;
            agent.targetResource = null;
            agent.state = AgentState.SEARCH;
            agent.path = [];
            return;
        }

        if (PATHFINDING_MODE === PathfindingMode.DIRECT) {
             moveTowards(agent, agent.targetResource.rect.x, agent.targetResource.rect.y, AGENT_SPEED, AGENT_WIGGLE);
        } else {
            if (agent.path.length === 0) {
                agent.path = findPath(agent.rect, agent.targetResource.rect, world.base.rect, PATHFINDING_MODE, ENABLE_SMOOTHING);
                agent.pathIndex = 0;
            }
            
            if (agent.pathIndex < agent.path.length) {
                const nextPoint = agent.path[agent.pathIndex];
                moveTowards(agent, nextPoint.x, nextPoint.y, AGENT_SPEED, 0);
                
                if (Math.abs(agent.rect.x - nextPoint.x) < AGENT_SPEED && Math.abs(agent.rect.y - nextPoint.y) < AGENT_SPEED) {
                    agent.pathIndex++;
                }
            } else {
                 moveTowards(agent, agent.targetResource.rect.x, agent.targetResource.rect.y, AGENT_SPEED, 0);
            }
        }

        if (agent.rect.collidesWith(agent.targetResource.rect)) {
            agent.lastPickupPos = { x: agent.targetResource.rect.x, y: agent.targetResource.rect.y };
            
            agent.hasNearbyResources = false;
            const losSq = AGENT_LOS * AGENT_LOS;
            const chunkSize = world.config.WORLD_SIZE;
            const chunkX = Math.floor(agent.rect.x / chunkSize);
            const chunkY = Math.floor(agent.rect.y / chunkSize);
            
            outer: for (let y = chunkY - 1; y <= chunkY + 1; y++) {
                for (let x = chunkX - 1; x <= chunkX + 1; x++) {
                    const key = `${x},${y}`;
                    const chunkResources = world.resourceChunks.get(key);
                    if (!chunkResources) continue;
                    for (const res of chunkResources) {
                        if (res !== agent.targetResource && !res.isCarried && !res.isDeposited) {
                            const distSq = (agent.rect.x - res.rect.x) ** 2 + (agent.rect.y - res.rect.y) ** 2;
                            if (distSq <= losSq) {
                                agent.hasNearbyResources = true;
                                break outer;
                            }
                        }
                    }
                }
            }

            agent.carriedResource = agent.targetResource;
            agent.carriedResource.isCarried = true;
            if (agent.targetResource.claimedBy === agent) {
                agent.targetResource.claimedBy = null;
            }
            agent.targetResource = null;
            agent.state = AgentState.RETURN;
            agent.path = [];
        }
    } else if (agent.state === AgentState.RETURN) {
        if (!agent.carriedResource) {
            agent.state = AgentState.SEARCH;
            agent.path = [];
            if (agent.targetSlot) {
                agent.targetSlot.reserved = false;
                agent.targetSlot = null;
                agent.standPos = null;
            }
            return;
        }

        const distToBase = Math.sqrt(
            Math.pow(agent.rect.center.x - world.base.rect.center.x, 2) +
            Math.pow(agent.rect.center.y - world.base.rect.center.y, 2)
        );

        const withinLOS = distToBase <= AGENT_LOS;

        if (agent.targetSlot && !world.base.slots.includes(agent.targetSlot)) {
            agent.targetSlot = null;
            agent.standPos = null;
        }

        if (!agent.targetSlot && withinLOS) {
            agent.targetSlot = world.base.reserveSlot({ x: agent.rect.x, y: agent.rect.y });
            if (agent.targetSlot) {
                agent.standPos = calculateStandPos(agent, agent.targetSlot, world.base);
            }
        }

        let targetX = world.base.rect.center.x - agent.rect.w / 2;
        let targetY = world.base.rect.center.y - agent.rect.h / 2;

        if (agent.standPos) {
            targetX = agent.standPos.x;
            targetY = agent.standPos.y;
        } else {
            const safeDistance = Math.max(world.base.rect.w, world.base.rect.h) / 2 + 32;
            if (distToBase < safeDistance) {
                targetX = agent.rect.x;
                targetY = agent.rect.y;
            }
        }

        const effectiveMode = (withinLOS && PATHFINDING_MODE === PathfindingMode.DIRECT) ? PathfindingMode.A_STAR : PATHFINDING_MODE;

        if (effectiveMode === PathfindingMode.DIRECT || !agent.standPos) {
            moveTowards(agent, targetX, targetY, AGENT_SPEED, 0);
        } else {
            if (agent.path.length === 0) {
                agent.path = findPath(agent.rect, {x: targetX + agent.rect.w/2, y: targetY + agent.rect.h/2}, world.base.rect, effectiveMode, ENABLE_SMOOTHING);
                agent.pathIndex = 0;
            }
            
            if (agent.pathIndex < agent.path.length) {
                const nextPoint = agent.path[agent.pathIndex];
                moveTowards(agent, nextPoint.x - agent.rect.w/2, nextPoint.y - agent.rect.h/2, AGENT_SPEED, 0);
                
                if (Math.abs(agent.rect.x + agent.rect.w/2 - nextPoint.x) < AGENT_SPEED && Math.abs(agent.rect.y + agent.rect.h/2 - nextPoint.y) < AGENT_SPEED) {
                    agent.pathIndex++;
                }
            } else {
                moveTowards(agent, targetX, targetY, AGENT_SPEED, 0);
            }
        }

        if (Math.abs(agent.lastMove.y) > Math.abs(agent.lastMove.x)) {
            if (agent.lastMove.y < 0) { // Up
                agent.carriedResource!.rect.x = agent.rect.x + (agent.rect.w - agent.carriedResource!.rect.w) / 2;
                agent.carriedResource!.rect.y = agent.rect.y - agent.carriedResource!.rect.h;
            } else { // Down
                agent.carriedResource!.rect.x = agent.rect.x + (agent.rect.w - agent.carriedResource!.rect.w) / 2;
                agent.carriedResource!.rect.y = agent.rect.y + agent.rect.h;
            }
        } else {
            if (agent.lastMove.x < 0) { // Left
                agent.carriedResource!.rect.x = agent.rect.x - agent.carriedResource!.rect.w;
                agent.carriedResource!.rect.y = agent.rect.y + (agent.rect.h - agent.carriedResource!.rect.h) / 2;
            } else { // Right
                agent.carriedResource!.rect.x = agent.rect.x + agent.rect.w;
                agent.carriedResource!.rect.y = agent.rect.y + (agent.rect.h - agent.carriedResource!.rect.h) / 2;
            }
        }

        if (agent.standPos) {
            const distToStand = Math.sqrt(Math.pow(agent.rect.x - agent.standPos.x, 2) + Math.pow(agent.rect.y - agent.standPos.y, 2));
            if (distToStand <= AGENT_SPEED * 2.5) {
                const slotStillValid = world.base.slots.includes(agent.targetSlot!);

                if (slotStillValid) {
                    agent.rect.x = agent.standPos.x;
                    agent.rect.y = agent.standPos.y;
                    
                    world.base.deposit(agent.carriedResource!, agent.targetSlot!);
                    agent.carriedResource = null;
                    agent.targetSlot = null;
                    agent.standPos = null;
                    
                    if (agent.hasNearbyResources && agent.lastPickupPos) {
                        agent.state = AgentState.REVISIT;
                    } else {
                        agent.state = AgentState.SEARCH;
                    }
                    
                    agent.path = [];
                    
                    let dx = agent.rect.x + agent.rect.w/2 - world.base.rect.center.x;
                    let dy = agent.rect.y + agent.rect.h/2 - world.base.rect.center.y;
                    const dist = Math.sqrt(dx*dx + dy*dy) || 1;
                    agent.lastMove.x = (dx / dist) * AGENT_SPEED;
                    agent.lastMove.y = (dy / dist) * AGENT_SPEED;
                } else {
                    if (agent.targetSlot) agent.targetSlot.reserved = false;
                    agent.targetSlot = null;
                    agent.standPos = null;
                    agent.path = [];
                    return;
                }
            }
        }
    }
}
