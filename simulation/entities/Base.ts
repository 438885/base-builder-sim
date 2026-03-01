import { SimulationConfig } from '../../types';
import { RectImpl } from '../math';
import { Resource } from './Resource';

export interface Slot {
    x: number;
    y: number;
    reserved: boolean;
}

export class Base {
    rect: RectImpl;
    slots: Slot[] = [];
    resourceSize: number;

    constructor(config: SimulationConfig) {
        this.resourceSize = config.RESOURCE_SIZE;
        let startPos = (config.WORLD_SIZE - config.BASE_START_SIZE) / 2;
        // Align to resource grid
        startPos = Math.floor(startPos / this.resourceSize) * this.resourceSize;
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

    reserveSlot(agentPos: { x: number; y: number }): Slot | null {
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

    deposit(resource: Resource, slot: Slot) {
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
