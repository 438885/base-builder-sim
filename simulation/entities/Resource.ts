import { RectImpl } from '../math';
import type { Agent } from './agent/Agent';

export class Resource {
    rect: RectImpl;
    isCarried: boolean = false;
    isDeposited: boolean = false;
    claimedBy: Agent | null = null;
    claimTime: number = 0;
    color: string;

    constructor(x: number, y: number, size: number) {
        this.rect = new RectImpl(x, y, size, size);
        const gridX = Math.floor(x / size);
        const gridY = Math.floor(y / size);
        const hue = 180 + (Math.abs(gridX * 13 + gridY * 7) % 60);
        this.color = `hsl(${hue}, 70%, 60%)`;
    }
}
