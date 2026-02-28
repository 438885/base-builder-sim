export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export enum AgentState {
    SEARCH = "SEARCH",
    APPROACH = "APPROACH",
    RETURN = "RETURN"
}

export enum PathfindingMode {
    DIRECT = "DIRECT",
    A_STAR = "A_STAR",
    GREEDY = "GREEDY",
    DIJKSTRA = "DIJKSTRA"
}

export interface SimulationConfig {
    WORLD_SIZE: number;
    AGENT_SPEED: number;
    AGENT_LOS: number;
    BASE_START_SIZE: number;
    RESOURCE_SIZE: number;
    AGENT_SIZE: number;
    INITIAL_AGENTS: number;
    INITIAL_RESOURCES: number;
    AGENT_SPAWN_THRESHOLD: number;
    RESOURCE_CLUSTER_CHANCE: number;
    RESOURCE_CLUSTER_SIZE: number;
    RESOURCE_CLUSTER_RADIUS: number;
    // New parameters
    BASE_POINT_MULTIPLIER: number;
    AGENT_WIGGLE: number; // 0-1 chance to move randomly
    MAX_AGENTS: number;
    PATHFINDING_MODE: PathfindingMode;
    ENABLE_SMOOTHING: boolean;
}

export interface SimulationStats {
    tickCount: number;
    totalPoints: number;
    agentCount: number;
    resourceCount: number;
    baseSize: number; // width (assuming square)
    baseSlotsFree: number;
}