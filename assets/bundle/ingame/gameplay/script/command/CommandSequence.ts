import { BattleResolution, SkillId, WeaponId } from "../model/GameplayTypes";

/** 一次行动中可逐帧执行的步骤类型。 */
export enum CommandStepType {
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

/** 行动步骤及其确定性执行进度。 */
export interface CommandStep {
    type: CommandStepType;
    weapon?: WeaponId;
    skill?: SkillId;
    resolution?: BattleResolution;
    startedFrame?: number;
    resolveFrame?: number;
    endFrame?: number;
    resolved?: boolean;
}

/**
 * 保存一次行动展开后的步骤及当前位置。
 * 队列状态会进入 CommandController 校验值，便于定位录像或锁步差异。
 */
export class CommandSequence {
    private readonly steps: CommandStep[] = [];
    private currentStepIndex = 0;

    /** 当前应执行的步骤；整次行动结束后返回 undefined。 */
    get currentStep() {
        return this.steps[this.currentStepIndex];
    }

    /** 当前行动是否已经没有待执行步骤。 */
    get isEmpty() {
        return this.currentStepIndex >= this.steps.length;
    }

    /** 使用一组全新步骤开始行动，并隔离调用方持有的步骤对象。 */
    startAction(steps: readonly CommandStep[]) {
        this.steps.length = 0;
        this.steps.push(...steps.map((step) => ({ ...step })));
        this.currentStepIndex = 0;
    }

    /** 标记当前步骤完成，下一逻辑帧将执行后续步骤。 */
    advanceToNextStep() {
        if (!this.isEmpty) this.currentStepIndex++;
    }

    /** 清空当前行动。 */
    reset() {
        this.steps.length = 0;
        this.currentStepIndex = 0;
    }

    /** 创建可序列化快照，供确定性校验使用。 */
    createSnapshot() {
        return {
            index: this.currentStepIndex,
            steps: this.steps.map((step) => ({ ...step })),
        };
    }
}
