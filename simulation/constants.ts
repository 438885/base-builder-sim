import { SimulationConfig, PathfindingMode } from '../types';

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

export const GRID_SIZE = 32;
