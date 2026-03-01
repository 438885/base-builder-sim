import { SimulationConfig } from '../types';
import { DefaultConfig } from './constants';
import { Resource } from './entities/Resource';
import { Base } from './entities/Base';
import { Agent } from './entities/Agent';

export class SimulationEngine {
    config: SimulationConfig;
    base: Base;
    agents: Agent[] = [];
    resources: Resource[] = [];
    agentGrid: Map<string, Agent[]> = new Map(); // Spatial partitioning for collisions
    generatedChunks: Set<string> = new Set();
    resourceChunks: Map<string, Resource[]> = new Map(); // Spatial partitioning for resources
    totalPoints: number = 0;
    spawnAccumulator: number = 0;
    tickCount: number = 0;

    constructor(config: SimulationConfig = DefaultConfig) {
        this.config = { ...config };
        this.base = new Base(this.config);
        this._initializeEntities();
    }

    _initializeEntities() {
        this._generateChunk(0, 0);
        for (let i = 0; i < this.config.INITIAL_AGENTS; i++) this._spawnAgent();
    }

    _generateChunk(cx: number, cy: number) {
        const key = `${cx},${cy}`;
        if (this.generatedChunks.has(key)) return;
        this.generatedChunks.add(key);

        const chunkSize = this.config.WORLD_SIZE;
        const resourcesPerChunk = this.config.INITIAL_RESOURCES;
        
        const chunkResources: Resource[] = [];
        
        let resCount = 0;
        let attempts = 0;
        while (resCount < resourcesPerChunk && attempts < resourcesPerChunk * 2) {
            attempts++;
            if (Math.random() < this.config.RESOURCE_CLUSTER_CHANCE) {
                const centerX = cx * chunkSize + Math.floor(Math.random() * (chunkSize - this.config.RESOURCE_SIZE));
                const centerY = cy * chunkSize + Math.floor(Math.random() * (chunkSize - this.config.RESOURCE_SIZE));
                const clusterSize = Math.floor(Math.random() * this.config.RESOURCE_CLUSTER_SIZE) + 1;
                for (let j = 0; j < clusterSize; j++) {
                    if (resCount >= resourcesPerChunk) break;
                    if (this._spawnResourceAt(centerX, centerY, this.config.RESOURCE_CLUSTER_RADIUS, chunkResources)) {
                        resCount++;
                    }
                }
            } else {
                const size = this.config.RESOURCE_SIZE;
                let x = cx * chunkSize + Math.floor(Math.random() * (chunkSize - size));
                let y = cy * chunkSize + Math.floor(Math.random() * (chunkSize - size));
                x = Math.floor(x / size) * size;
                y = Math.floor(y / size) * size;
                
                const isOverlapping = chunkResources.some(res => res.rect.x === x && res.rect.y === y);
                if (!isOverlapping) {
                    const res = new Resource(x, y, size);
                    this.resources.push(res);
                    chunkResources.push(res);
                    resCount++;
                }
            }
        }
        
        this.resourceChunks.set(key, chunkResources);
    }

    _spawnResourceAt(centerX: number, centerY: number, radius: number, chunkResources: Resource[]): boolean {
        const size = this.config.RESOURCE_SIZE;
        let x = 0, y = 0;
        let isOverlapping = true;
        let spawnAttempts = 0;
        
        while (isOverlapping && spawnAttempts < 50) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.random() * radius;
            x = centerX + Math.cos(angle) * r;
            y = centerY + Math.sin(angle) * r;
            
            x = Math.floor(x / size) * size;
            y = Math.floor(y / size) * size;
            
            isOverlapping = chunkResources.some(res => res.rect.x === x && res.rect.y === y);
            spawnAttempts++;
        }
        
        if (!isOverlapping) {
            const res = new Resource(x, y, size);
            this.resources.push(res);
            chunkResources.push(res);
            return true;
        }
        return false;
    }

    _spawnAgent() {
        const br = this.base.rect;
        const side = ['N', 'S', 'E', 'W'][Math.floor(Math.random() * 4)];
        let x = 0, y = 0;
        const size = this.config.AGENT_SIZE;

        if (side === 'N') { x = br.x + Math.random() * br.w; y = br.y - size; }
        else if (side === 'S') { x = br.x + Math.random() * br.w; y = br.y + br.h; }
        else if (side === 'E') { x = br.x + br.w; y = br.y + Math.random() * br.h; }
        else { x = br.x - size; y = br.y + Math.random() * br.h; }

        this.agents.push(new Agent(x, y, size, this.config.AGENT_SPEED));
    }

    tick() {
        this.tickCount++;
        
        // 1. Rebuild Spatial Grid for Collision
        const GRID_CELL = 32;
        this.agentGrid.clear();

        // Populate grid
        for (const agent of this.agents) {
            const cx = Math.floor((agent.rect.x + agent.rect.w/2) / GRID_CELL);
            const cy = Math.floor((agent.rect.y + agent.rect.h/2) / GRID_CELL);
            
            const key = `${cx},${cy}`;
            let cell = this.agentGrid.get(key);
            if (!cell) {
                cell = [];
                this.agentGrid.set(key, cell);
            }
            cell.push(agent);
        }

        // 2. Generate chunks around agents
        const chunkSize = this.config.WORLD_SIZE;
        for (const agent of this.agents) {
            const cx = Math.floor(agent.rect.x / chunkSize);
            const cy = Math.floor(agent.rect.y / chunkSize);
            
            // Generate current chunk and surrounding chunks (3x3)
            for (let y = cy - 1; y <= cy + 1; y++) {
                for (let x = cx - 1; x <= cx + 1; x++) {
                    this._generateChunk(x, y);
                }
            }
        }

        // 3. Points & Agent Spawn
        const pointsThisTick = this.base.getPointsPerTick() * this.config.BASE_POINT_MULTIPLIER;
        this.totalPoints += pointsThisTick;
        this.spawnAccumulator += pointsThisTick;

        if (this.spawnAccumulator >= this.config.AGENT_SPAWN_THRESHOLD) {
            if (this.agents.length < this.config.MAX_AGENTS) {
                this._spawnAgent();
            }
            this.spawnAccumulator -= this.config.AGENT_SPAWN_THRESHOLD;
        }

        // 4. Update Agents
        this.agents.forEach(agent => agent.update(this));
    }
}
