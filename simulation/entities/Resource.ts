import { RectImpl } from '../math';
import type { Agent } from './agent/Agent';

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
