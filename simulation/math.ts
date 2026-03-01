import { Rect, PathfindingMode } from '../types';
import { GRID_SIZE } from './constants';

export interface Point {
    x: number;
    y: number;
}

export class Node {
    constructor(
        public x: number,
        public y: number,
        public g: number = 0,
        public h: number = 0,
        public parent: Node | null = null
    ) {}

    f(mode: PathfindingMode) {
        if (mode === PathfindingMode.GREEDY) return this.h;
        if (mode === PathfindingMode.DIJKSTRA) return this.g;
        return this.g + this.h;
    }
    
    get key() { return `${this.x},${this.y}`; }
}

export function lineIntersectsRect(p1: Point, p2: Point, r: Rect): boolean {
    const dist = Math.sqrt((p2.x - p1.x)**2 + (p2.y - p1.y)**2);
    if (dist === 0) return false;
    
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);
    
    if (maxX < r.x || minX > r.x + r.w || maxY < r.y || minY > r.y + r.h) {
        return false;
    }

    const steps = Math.ceil(dist / 8);
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

export function smoothPath(path: Point[], obstacle: Rect, agentW: number, agentH: number): Point[] {
    if (path.length < 3) return path;
    const smoothed = [path[0]];
    let inputIndex = 0;
    
    const safeObstacle = {
        x: obstacle.x - agentW - 1, 
        y: obstacle.y - agentH - 1,
        w: obstacle.w + agentW + 2,
        h: obstacle.h + agentH + 2
    };

    while (inputIndex < path.length - 1) {
        let nextIndex = inputIndex + 1;
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

export function findPath(start: Rect, end: Point, obstacle: Rect, mode: PathfindingMode, enableSmoothing: boolean): Point[] {
    const startGrid = { x: Math.floor(start.x / GRID_SIZE), y: Math.floor(start.y / GRID_SIZE) };
    const endGrid = { x: Math.floor(end.x / GRID_SIZE), y: Math.floor(end.y / GRID_SIZE) };
    
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

    let iterations = 0;
    const MAX_ITERATIONS = 2500; 

    while (openList.length > 0 && iterations < MAX_ITERATIONS) {
        iterations++;
        
        openList.sort((a, b) => a.f(mode) - b.f(mode));
        const current = openList.shift()!;

        if (Math.abs(current.x - endGrid.x) <= 1 && Math.abs(current.y - endGrid.y) <= 1) {
            const path: Point[] = [];
            let curr: Node | null = current;
            while (curr) {
                path.push({ x: curr.x * GRID_SIZE + GRID_SIZE/2, y: curr.y * GRID_SIZE + GRID_SIZE/2 });
                curr = curr.parent;
            }
            const rawPath = path.reverse();
            return enableSmoothing ? smoothPath(rawPath, obstacle, start.w, start.h) : rawPath;
        }

        closedSet.add(current.key);

        const dist = Math.abs(current.x - endGrid.x) + Math.abs(current.y - endGrid.y);
        if (dist < minH) {
            minH = dist;
            closestNode = current;
        }

        const dirs = [
            {x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0},
            {x:-1, y:-1}, {x:1, y:-1}, {x:-1, y:1}, {x:1, y:1}
        ];

        for (const dir of dirs) {
            const nx = current.x + dir.x;
            const ny = current.y + dir.y;
            const key = `${nx},${ny}`;

            if (closedSet.has(key)) continue;

            const isStartOrEnd = (nx === startGrid.x && ny === startGrid.y) || (nx === endGrid.x && ny === endGrid.y);
            let isObstacle = false;
            
            if (!isStartOrEnd) {
                if (nx >= obsGrid.minX && nx <= obsGrid.maxX && ny >= obsGrid.minY && ny <= obsGrid.maxY) {
                    isObstacle = true;
                }
                
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
