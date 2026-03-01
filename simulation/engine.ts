import { AgentState, Rect, SimulationConfig, PathfindingMode } from '../types';

export const DefaultConfig: SimulationConfig = {
    WORLD_SIZE: 1024,
    AGENT_SPEED: 3,
    AGENT_LOS: 176,
    BASE_START_SIZE: 24,
    RESOURCE_SIZE: 8,
    AGENT_SIZE: 8,
    INITIAL_AGENTS: 3,
    INITIAL_RESOURCES: 64,
    AGENT_SPAWN_THRESHOLD: 262144,
    RESOURCE_CLUSTER_CHANCE: 1.0,
    RESOURCE_CLUSTER_SIZE: 50,
    RESOURCE_CLUSTER_RADIUS: 200,
    BASE_POINT_MULTIPLIER: 0.2,
    AGENT_WIGGLE: 0,
    MAX_AGENTS: 5000,
    PATHFINDING_MODE: PathfindingMode.A_STAR,
    ENABLE_SMOOTHING: false
};

interface Point {
    x: number;
    y: number;
}

// A* / Greedy / Dijkstra Implementation
const GRID_SIZE = 32;

class Node {
    constructor(
        public x: number,
        public y: number,
        public g: number = 0,
        public h: number = 0,
        public parent: Node | null = null
    ) {}

    // F score depends on algorithm: A* = g + h, Greedy = h, Dijkstra = g
    f(mode: PathfindingMode) {
        if (mode === PathfindingMode.GREEDY) return this.h;
        if (mode === PathfindingMode.DIJKSTRA) return this.g;
        return this.g + this.h;
    }
    
    get key() { return `${this.x},${this.y}`; }
}

function lineIntersectsRect(p1: Point, p2: Point, r: Rect): boolean {
    // Basic raycast to check if line segment p1-p2 intersects rect r
    // Sampling method is robust enough for this grid resolution
    const dist = Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2);
    if (dist === 0) return false;
    
    // Check bounding box first for optimization
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);
    
    if (maxX < r.x || minX > r.x + r.w || maxY < r.y || minY > r.y + r.h) {
        return false;
    }

    const steps = Math.ceil(dist / 8); // Increased resolution for better accuracy
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = p1.x + (p2.x - p1.x) * t;
        const y = p1.y + (p2.y - p1.y) * t;
        
        if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) {
            return true;
        }
    }
    return false;
}

function smoothPath(path: Point[], obstacle: Rect, agentW: number, agentH: number): Point[] {
    if (path.length < 3) return path;
    const smoothed = [path[0]];
    let inputIndex = 0;
    
    // Safety margin around obstacle for smoothing rays
    // The path points represent the top-left of the agent.
    // For the top-left to not collide, it must not enter the expanded obstacle.
    const safeObstacle = {
        x: obstacle.x - agentW - 1, 
        y: obstacle.y - agentH - 1,
        w: obstacle.w + agentW + 2,
        h: obstacle.h + agentH + 2
    };

    while (inputIndex < path.length - 1) {
        let nextIndex = inputIndex + 1;
        // Look ahead to find the furthest visible node
        // Optimisation: iterate backwards to find furthest reachable point first
        for (let i = path.length - 1; i > inputIndex + 1; i--) {
             if (!lineIntersectsRect(path[inputIndex], path[i], safeObstacle)) {
                 nextIndex = i;
                 break; 
             }
        }
        smoothed.push(path[nextIndex]);
        inputIndex = nextIndex;
    }
    
    return smoothed;
}

function findPath(start: Rect, end: Point, obstacle: Rect, mode: PathfindingMode, enableSmoothing: boolean): Point[] {
    const startGrid = { x: Math.floor(start.x / GRID_SIZE), y: Math.floor(start.y / GRID_SIZE) };
    const endGrid = { x: Math.floor(end.x / GRID_SIZE), y: Math.floor(end.y / GRID_SIZE) };
    
    // Convert obstacle to grid bounds (with padding)
    const obsGrid = {
        minX: Math.floor((obstacle.x - start.w - GRID_SIZE/2) / GRID_SIZE) + 1,
        maxX: Math.ceil((obstacle.x + obstacle.w - GRID_SIZE/2) / GRID_SIZE) - 1,
        minY: Math.floor((obstacle.y - start.h - GRID_SIZE/2) / GRID_SIZE) + 1,
        maxY: Math.ceil((obstacle.y + obstacle.h - GRID_SIZE/2) / GRID_SIZE) - 1
    };

    const openList: Node[] = [];
    const closedSet = new Set<string>();
    
    openList.push(new Node(startGrid.x, startGrid.y));

    let closestNode = openList[0];
    let minH = Infinity;

    // Safety break
    let iterations = 0;
    const MAX_ITERATIONS = 2500; 

    while (openList.length > 0 && iterations < MAX_ITERATIONS) {
        iterations++;
        
        // Sort by F cost
        openList.sort((a, b) => a.f(mode) - b.f(mode));
        const current = openList.shift()!;

        // Check if reached destination (within 1 tile radius)
        if (Math.abs(current.x - endGrid.x) <= 1 && Math.abs(current.y - endGrid.y) <= 1) {
            const path: Point[] = [];
            let curr: Node | null = current;
            while (curr) {
                // Convert back to world coordinates (center of tile)
                path.push({ x: curr.x * GRID_SIZE + GRID_SIZE/2, y: curr.y * GRID_SIZE + GRID_SIZE/2 });
                curr = curr.parent;
            }
            const rawPath = path.reverse();
            return enableSmoothing ? smoothPath(rawPath, obstacle, start.w, start.h) : rawPath;
        }

        closedSet.add(current.key);

        // Update closest node for fallback
        const dist = Math.abs(current.x - endGrid.x) + Math.abs(current.y - endGrid.y);
        if (dist < minH) {
            minH = dist;
            closestNode = current;
        }

        // Neighbors (8 directions)
        const dirs = [
            {x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0},
            {x:-1, y:-1}, {x:1, y:-1}, {x:-1, y:1}, {x:1, y:1}
        ];

        for (const dir of dirs) {
            const nx = current.x + dir.x;
            const ny = current.y + dir.y;
            const key = `${nx},${ny}`;

            // Bounds check
            if (closedSet.has(key)) continue;

            // Obstacle Check (Base)
            // Allow start and end nodes to be "inside" obstacle logic slightly to prevent getting stuck
            const isStartOrEnd = (nx === startGrid.x && ny === startGrid.y) || (nx === endGrid.x && ny === endGrid.y);
            let isObstacle = false;
            
            if (!isStartOrEnd) {
                if (nx >= obsGrid.minX && nx <= obsGrid.maxX && ny >= obsGrid.minY && ny <= obsGrid.maxY) {
                    isObstacle = true;
                }
                
                // If diagonal, check if we are cutting corners
                if (!isObstacle && dir.x !== 0 && dir.y !== 0) {
                    const isOrthogonal1Obstacle = nx >= obsGrid.minX && nx <= obsGrid.maxX && current.y >= obsGrid.minY && current.y <= obsGrid.maxY;
                    const isOrthogonal2Obstacle = current.x >= obsGrid.minX && current.x <= obsGrid.maxX && ny >= obsGrid.minY && ny <= obsGrid.maxY;
                    if (isOrthogonal1Obstacle || isOrthogonal2Obstacle) {
                        isObstacle = true;
                    }
                }
            }

            if (isObstacle) continue;

            const moveCost = Math.sqrt(dir.x*dir.x + dir.y*dir.y);
            const gScore = current.g + moveCost;
            
            const existingNode = openList.find(n => n.key === key);

            if (!existingNode) {
                // Optimization: Don't calc hScore if Dijkstra
                const hScore = (mode === PathfindingMode.DIJKSTRA) 
                    ? 0 
                    : Math.sqrt(Math.pow(nx - endGrid.x, 2) + Math.pow(ny - endGrid.y, 2));
                    
                openList.push(new Node(nx, ny, gScore, hScore, current));
            } else if (gScore < existingNode.g) {
                existingNode.g = gScore;
                existingNode.parent = current;
            }
        }
    }

    // Fallback: return path to closest point found
    const path: Point[] = [];
    let curr: Node | null = closestNode;
    while (curr) {
        path.push({ x: curr.x * GRID_SIZE + GRID_SIZE/2, y: curr.y * GRID_SIZE + GRID_SIZE/2 });
        curr = curr.parent;
    }
    const rawFallback = path.reverse();
    return enableSmoothing ? smoothPath(rawFallback, obstacle, start.w, start.h) : rawFallback;
}

export class RectImpl implements Rect {
    constructor(
        public x: number,
        public y: number,
        public w: number,
        public h: number
    ) {}

    collidesWith(other: Rect): boolean {
        return (
            this.x < other.x + other.w &&
            this.x + this.w > other.x &&
            this.y < other.y + other.h &&
            this.y + this.h > other.y
        );
    }

    get center(): { x: number; y: number } {
        return {
            x: this.x + this.w / 2,
            y: this.y + this.h / 2,
        };
    }
}

export class Resource {
    rect: RectImpl;
    isCarried: boolean = false;
    isDeposited: boolean = false;
    claimedBy: Agent | null = null;
    color: string;

    constructor(x: number, y: number, size: number) {
        this.rect = new RectImpl(x, y, size, size);
        this.color = '#64748b'; // slate-500
    }
}

export class Base {
    rect: RectImpl;
    slots: { x: number; y: number; reserved: boolean }[] = [];
    resourceSize: number;

    constructor(config: SimulationConfig) {
        this.resourceSize = config.RESOURCE_SIZE;
        const startPos = (config.WORLD_SIZE - config.BASE_START_SIZE) / 2;
        this.rect = new RectImpl(startPos, startPos, config.BASE_START_SIZE, config.BASE_START_SIZE);
        this._generateLayerSlots();
    }

    _generateLayerSlots() {
        this.slots = [];
        const r = this.resourceSize;
        // Top and Bottom perimeters
        for (let x = this.rect.x - r; x < this.rect.x + this.rect.w + r; x += r) {
            this.slots.push({ x, y: this.rect.y - r, reserved: false }); // Top
            this.slots.push({ x, y: this.rect.y + this.rect.h, reserved: false }); // Bottom
        }
        // Left and Right perimeters
        for (let y = this.rect.y; y < this.rect.y + this.rect.h; y += r) {
            this.slots.push({ x: this.rect.x - r, y, reserved: false }); // Left
            this.slots.push({ x: this.rect.x + this.rect.w, y, reserved: false }); // Right
        }
    }

    getPointsPerTick(): number {
        return Math.floor(this.rect.w * this.rect.h);
    }

    reserveSlot(agentPos: { x: number; y: number }): { x: number; y: number; reserved: boolean } | null {
        let nearestIdx = -1;
        let minDist = Infinity;

        this.slots.forEach((slot, i) => {
            if (!slot.reserved) {
                const dist = Math.sqrt(Math.pow(slot.x - agentPos.x, 2) + Math.pow(slot.y - agentPos.y, 2));
                if (dist < minDist) {
                    minDist = dist;
                    nearestIdx = i;
                }
            }
        });

        if (nearestIdx !== -1) {
            this.slots[nearestIdx].reserved = true;
            return this.slots[nearestIdx];
        }
        return null;
    }

    deposit(resource: Resource, slot: { x: number; y: number; reserved: boolean }) {
        const idx = this.slots.indexOf(slot);
        if (idx !== -1) {
            this.slots.splice(idx, 1);
        }
        
        resource.rect.x = slot.x;
        resource.rect.y = slot.y;
        resource.isDeposited = true;
        resource.isCarried = false;

        if (this.slots.length === 0) {
            this._expandBase();
        }
    }

    _expandBase() {
        this.rect.x -= this.resourceSize;
        this.rect.y -= this.resourceSize;
        this.rect.w += this.resourceSize * 2;
        this.rect.h += this.resourceSize * 2;
        this._generateLayerSlots();
    }
}

export class Agent {
    rect: RectImpl;
    lastMove: { x: number; y: number };
    targetResource: Resource | null = null;
    carriedResource: Resource | null = null;
    state: AgentState = AgentState.SEARCH;
    id: string;
    
    // Pathfinding
    path: Point[] = [];
    pathIndex: number = 0;

    targetSlot: { x: number; y: number; reserved: boolean } | null = null;
    standPos: { x: number; y: number } | null = null;

    constructor(x: number, y: number, size: number, initialSpeed: number) {
        this.rect = new RectImpl(x, y, size, size);
        // Start with random direction instead of vertical
        const angle = Math.random() * Math.PI * 2;
        this.lastMove = { 
            x: Math.cos(angle) * initialSpeed, 
            y: Math.sin(angle) * initialSpeed 
        };
        this.id = Math.random().toString(36).substr(2, 9);
    }

    _calculateStandPos(slot: { x: number; y: number }, base: Base) {
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
        
        // Normalize vector
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

        // Random movement noise (wiggle)
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

        // Ensure velocity magnitude matches current speed config (important when slider changes)
        const currentSpeedSq = this.lastMove.x ** 2 + this.lastMove.y ** 2;
        if (currentSpeedSq > 0 && Math.abs(currentSpeedSq - AGENT_SPEED ** 2) > 0.1) {
            const scale = AGENT_SPEED / Math.sqrt(currentSpeedSq);
            this.lastMove.x *= scale;
            this.lastMove.y *= scale;
        }

        if (this.state === AgentState.SEARCH) {
            this.path = []; // Clear path
            
            // Vector based movement
            this.rect.x += this.lastMove.x;
            this.rect.y += this.lastMove.y;

            // Random direction change (Wiggle)
            if (AGENT_WIGGLE > 0 && Math.random() < AGENT_WIGGLE * 0.05) {
                // Rotate vector slightly +/- 45 degrees
                const angleChange = (Math.random() - 0.5) * Math.PI / 2;
                const cos = Math.cos(angleChange);
                const sin = Math.sin(angleChange);
                const nx = this.lastMove.x * cos - this.lastMove.y * sin;
                const ny = this.lastMove.x * sin + this.lastMove.y * cos;
                this.lastMove.x = nx;
                this.lastMove.y = ny;
            }

            // --- LOS Check with Inter-Agent Communication ---
            // Cache current agent center
            const cx = this.rect.x + this.rect.w / 2;
            const cy = this.rect.y + this.rect.h / 2;
            const losSq = AGENT_LOS * AGENT_LOS;
            
            // Only check resources in current and adjacent chunks
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
                            
                            // Check distance to resource
                            const distSq = (cx - rcx) ** 2 + (cy - rcy) ** 2;

                            if (distSq <= losSq) {
                                // Resource is visible. 
                                // Now check if any neighbor (within LOS) has already claimed it.
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
                                    this.path = []; // Reset path when target found
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

            // Logic Switch
            if (PATHFINDING_MODE === PathfindingMode.DIRECT) {
                 this._moveTowards(this.targetResource.rect.x, this.targetResource.rect.y, AGENT_SPEED, AGENT_WIGGLE);
            } else {
                // A_STAR, GREEDY, DIJKSTRA
                if (this.path.length === 0) {
                    this.path = findPath(this.rect, this.targetResource.rect, world.base.rect, PATHFINDING_MODE, ENABLE_SMOOTHING);
                    this.pathIndex = 0;
                }
                
                // Follow Path
                if (this.pathIndex < this.path.length) {
                    const nextPoint = this.path[this.pathIndex];
                    this._moveTowards(nextPoint.x, nextPoint.y, AGENT_SPEED, 0); // No wiggle on path
                    
                    // Check if reached point
                    if (Math.abs(this.rect.x - nextPoint.x) < AGENT_SPEED && Math.abs(this.rect.y - nextPoint.y) < AGENT_SPEED) {
                        this.pathIndex++;
                    }
                } else {
                    // Reached end of path, move direct to target (final approach)
                     this._moveTowards(this.targetResource.rect.x, this.targetResource.rect.y, AGENT_SPEED, 0);
                }
            }

            if (this.rect.collidesWith(this.targetResource.rect)) {
                this.carriedResource = this.targetResource;
                this.carriedResource.isCarried = true;
                if (this.targetResource.claimedBy === this) {
                    this.targetResource.claimedBy = null;
                }
                this.targetResource = null;
                this.state = AgentState.RETURN;
                this.path = []; // Reset path for return trip
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

            // Move towards target
            if (PATHFINDING_MODE === PathfindingMode.DIRECT || !this.standPos) {
                this._moveTowards(targetX, targetY, AGENT_SPEED, 0); // No wiggle for precise insertion
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

            // Carry logic visual - Snap to front
            if (Math.abs(this.lastMove.y) > Math.abs(this.lastMove.x)) {
                if (this.lastMove.y < 0) { // Up
                    this.carriedResource.rect.x = this.rect.x + (this.rect.w - this.carriedResource.rect.w) / 2;
                    this.carriedResource.rect.y = this.rect.y - this.carriedResource.rect.h;
                } else { // Down
                    this.carriedResource.rect.x = this.rect.x + (this.rect.w - this.carriedResource.rect.w) / 2;
                    this.carriedResource.rect.y = this.rect.y + this.rect.h;
                }
            } else {
                if (this.lastMove.x < 0) { // Left
                    this.carriedResource.rect.x = this.rect.x - this.carriedResource.rect.w;
                    this.carriedResource.rect.y = this.rect.y + (this.rect.h - this.carriedResource.rect.h) / 2;
                } else { // Right
                    this.carriedResource.rect.x = this.rect.x + this.rect.w;
                    this.carriedResource.rect.y = this.rect.y + (this.rect.h - this.carriedResource.rect.h) / 2;
                }
            }

            // Check if reached the stand position
            if (this.standPos) {
                const distToStand = Math.sqrt(Math.pow(this.rect.x - this.standPos.x, 2) + Math.pow(this.rect.y - this.standPos.y, 2));
                if (distToStand <= AGENT_SPEED) {
                    // Snap to exact position
                    this.rect.x = this.standPos.x;
                    this.rect.y = this.standPos.y;
                    
                    world.base.deposit(this.carriedResource, this.targetSlot!);
                    this.carriedResource = null;
                    this.targetSlot = null;
                    this.standPos = null;
                    this.state = AgentState.SEARCH;
                    this.path = [];
                    
                    // Turn around (move away from base)
                    let dx = this.rect.x + this.rect.w/2 - world.base.rect.center.x;
                    let dy = this.rect.y + this.rect.h/2 - world.base.rect.center.y;
                    const dist = Math.sqrt(dx*dx + dy*dy) || 1;
                    this.lastMove.x = (dx / dist) * AGENT_SPEED;
                    this.lastMove.y = (dy / dist) * AGENT_SPEED;
                }
            } else {
                // If no slot available, prevent entering base
                if (this.rect.collidesWith(world.base.rect)) {
                    this.rect.x -= this.lastMove.x;
                    this.rect.y -= this.lastMove.y;
                }
            }
        }
        
        // Resolve Collisions (Basic separation)
        this._resolveCollisions(world);
    }

    _resolveCollisions(world: SimulationEngine) {
        const GRID_CELL = 32;
        
        const cx = Math.floor((this.rect.x + this.rect.w/2) / GRID_CELL);
        const cy = Math.floor((this.rect.y + this.rect.h/2) / GRID_CELL);

        // Check 3x3 area
        for (let y = cy - 1; y <= cy + 1; y++) {
            for (let x = cx - 1; x <= cx + 1; x++) {
                const key = `${x},${y}`;
                const cell = world.agentGrid.get(key);
                if (cell) {
                    for (const other of cell) {
                        if (other === this) continue;
                        if (this.rect.collidesWith(other.rect)) {
                            // Simple separation vector
                            const dx = (this.rect.x + this.rect.w/2) - (other.rect.x + other.rect.w/2);
                            const dy = (this.rect.y + this.rect.h/2) - (other.rect.y + other.rect.h/2);
                            const dist = Math.sqrt(dx*dx + dy*dy) || 0.001;
                            
                            // Push away
                            const pushForce = 0.5; // Soft collision strength
                            this.rect.x += (dx / dist) * pushForce;
                            this.rect.y += (dy / dist) * pushForce;
                        }
                    }
                }
            }
        }
    }
}

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
        // Points scaled by multiplier
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