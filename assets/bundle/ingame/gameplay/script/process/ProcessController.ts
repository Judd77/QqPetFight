import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import type { GameplayView } from "../GameplayView";
import type { BattleInfo, BattleRecording, BattleStepResult } from "../model/GameplayTypes";
import { validateBattleInfo } from "../model/GameplayValidator";
import { LockstepController } from "../lockstep/LockstepController";
import { ServerSimulationController } from "../simulation/ServerSimulationController";
import { ProcessAudio } from "./ProcessAudio";

/** 控制准备、开战、推进、回放和结束等整场玩法流程。 */
export class ProcessController extends BaseController<GameplayView> {
    private readonly audio = new ProcessAudio(this.view);

    /** 校验服务端数据并启动一场新的单机战斗。 */
    start(info: BattleInfo) {
        const config = this.view.config.battle;
        validateBattleInfo(info, config);

        const context = this.view.context;
        context.info = info;
        context.lockstep = new LockstepController(
            info,
            config,
            new ServerSimulationController(info, config, this.view.statsCtrl),
        );
        context.replaying = false;
        context.completed = false;
    }

    /** 使用 GameplayView 已校验的录像帧重新启动流程。 */
    replay(recording: BattleRecording) {
        const config = this.view.config.battle;
        const context = this.view.context;
        context.info = recording.battle;
        context.lockstep = LockstepController.createReplay(recording, config);
        context.replaying = true;
        context.completed = false;
    }

    /** 重置流程音效，并立即播放首个倒计时提示。 */
    reset() {
        this.audio.reset();
    }

    /** 消费倒计时和开战事件。 */
    onStep(result: BattleStepResult) {
        this.audio.onStep(result);
    }

    /** 在配置指定的正常速度和加速速度之间切换。 */
    toggleSpeed() {
        const lockstep = this.view.context.lockstep;
        if (!lockstep) return;
        const viewConfig = this.view.config.view;
        lockstep.speed = lockstep.speed === viewConfig.normalSpeed
            ? viewConfig.fastSpeed
            : viewConfig.normalSpeed;
    }

    /** 返回便于开发期排查锁步差异的只读状态快照。 */
    getDebugState() {
        const context = this.view.context;
        const lockstep = context.lockstep;
        if (!lockstep) return;
        return {
            tick: lockstep.state.tick,
            seed: lockstep.command.info.seed,
            phase: lockstep.state.phase,
            winner: lockstep.state.winner,
            checksum: lockstep.command.calculateChecksum(),
            replaying: context.replaying,
            fighters: lockstep.state.fighters.map((fighter) => ({
                ...fighter,
                inventory: fighter.inventory.slice(),
                usedSkills: fighter.usedSkills.slice(),
            })),
            recordedFrames: lockstep.recording.frames.length,
        };
    }

    /** 每个 Cocos 更新帧推进锁步，并在首次结束时保存录像校验信息。 */
    protected override onUpdate(elapsedSeconds: number) {
        const context = this.view.context;
        const lockstep = context.lockstep;
        if (!lockstep || context.loading) return;

        lockstep.update(elapsedSeconds, (stepResult) => this.view.onCommandStep(stepResult));
        if (context.completed || !lockstep.finished) return;

        context.completed = true;
        const checksum = lockstep.command.calculateChecksum();
        if (context.replaying) {
            if (checksum !== context.lastChecksum) throw new Error("回放状态校验失败");
            return;
        }
        context.lastRecording = lockstep.recording;
        context.lastChecksum = checksum;
    }

    /** 离开 GameplayView 时清空本局运行状态。 */
    protected override onUnload() {
        this.view.context.clear();
    }
}
