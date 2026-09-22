import { BattleResolution, SkillId, WeaponId } from "./BattleTypes";

export enum BattleActionStepType {
    Equip,
    Approach,
    Attack,
    Throw,
    PutDown,
    Skill,
    Wait,
    PickUp,
    Return,
    Complete,
}

export interface BattleActionStep {
    type: BattleActionStepType;
    weapon?: WeaponId;
    skill?: SkillId;
    resolution?: BattleResolution;
    startedFrame?: number;
    resolveFrame?: number;
    endFrame?: number;
    resolved?: boolean;
}

/** 一次行动的显式步骤队列；状态可进入 checksum，便于定位帧同步差异。 */
export class BattleActionQueue {
    private readonly steps: BattleActionStep[] = [];
    private index = 0;

    get current() {
        return this.steps[this.index];
    }

    get empty() {
        return this.index >= this.steps.length;
    }

    replace(steps: readonly BattleActionStep[]) {
        this.steps.length = 0;
        this.steps.push(...steps.map((step) => ({ ...step })));
        this.index = 0;
    }

    advance() {
        if (!this.empty) this.index++;
    }

    clear() {
        this.steps.length = 0;
        this.index = 0;
    }

    snapshot() {
        return {
            index: this.index,
            steps: this.steps.map((step) => ({ ...step })),
        };
    }
}
