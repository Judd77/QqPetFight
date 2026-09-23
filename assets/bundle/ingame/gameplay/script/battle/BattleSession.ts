import { BattleEngine } from "./BattleEngine";
import type {
    BattleFrameSource, CommandSubmittingFrameSource,
} from "./BattleFrameSource";
import {
    BattleCommand, BattleDefinitions, BattleInfo, BattlePhase, BattleRecording, BattleState, BattleStepResult,
    ServiceFrame,
} from "./BattleTypes";

/**
 * 协调一场战斗的固定帧循环。
 *
 * 职责仅包括：
 * 1. 把 Cocos 每帧传入的秒数累计为固定频率的逻辑帧。
 * 2. 从帧来源读取服务帧，并按连续 tick 交给 BattleEngine。
 * 3. 记录已经执行的服务帧，并提供渲染插值比例。
 *
 * 战斗规则由 BattleEngine 负责；服务帧生成由 BattleFrameSource 负责；
 * Cocos 节点和动画由表现层 Controller 负责。
 */
export class BattleSession {
    readonly engine: BattleEngine;
    readonly recording: BattleRecording;
    paused = false;
    speed = 1;

    private readonly pendingFrames = new Map<number, ServiceFrame>();
    private accumulatedSeconds = 0;

    constructor(
        info: BattleInfo,
        readonly config: BattleDefinitions,
        private readonly frameSource: BattleFrameSource,
    ) {
        const recordingBattle = JSON.parse(JSON.stringify(info)) as BattleInfo;
        this.engine = new BattleEngine(recordingBattle, config);
        this.recording = {
            version: 5,
            configVersion: config.rules.version,
            battle: recordingBattle,
            frames: [],
        };
    }

    /**
     * 接收一帧服务数据并放入连续帧缓存。
     * 已执行、重复或 tick 非法的帧会被忽略。
     */
    receiveFrame(frame: ServiceFrame) {
        if (!Number.isSafeInteger(frame.tick) || frame.tick <= this.engine.state.tick ||
            this.pendingFrames.has(frame.tick)) {
            return;
        }
        this.pendingFrames.set(frame.tick, this.cloneFrame(frame));
    }

    /**
     * 使用一帧 Cocos 游戏时间推进战斗。
     *
     * frameRate 配置为 20 时，每累计 0.05 秒执行一个逻辑帧。
     * maxCatchUpFrames 限制单次补帧数量，避免设备卡顿后长时间阻塞主线程。
     */
    update(elapsedSeconds: number, onStep: (result: BattleStepResult) => void) {
        if (this.paused || this.finished) return;

        const safeElapsedSeconds = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
        this.accumulatedSeconds += safeElapsedSeconds * this.speed;
        const fixedFrameSeconds = 1 / this.config.rules.frameRate;

        for (let count = 0; count < this.config.rules.maxCatchUpFrames; count++) {
            if (this.accumulatedSeconds + 1e-9 < fixedFrameSeconds || this.finished) break;

            const frame = this.frameSource.readNextFrame(this.engine.canStartAction);
            if (!frame) break;

            this.accumulatedSeconds -= fixedFrameSeconds;
            this.receiveFrame(frame);
            this.processPendingFrames(onStep);
        }

        // 支持外部提前送达的连续帧；即使本次 elapsedSeconds 为 0 也可以执行。
        this.processPendingFrames(onStep);
    }

    /** 向支持指令提交的帧来源发送一条客户端指令。 */
    submitCommand(command: BattleCommand) {
        if (this.finished || !this.canSubmitCommands(this.frameSource)) return;
        this.frameSource.submitCommand(command);
    }

    /** 当前只读战斗状态。 */
    get state(): Readonly<BattleState> {
        return this.engine.state;
    }

    /** 战斗内核是否已经产生最终胜负。 */
    get finished() {
        return this.engine.state.phase === BattlePhase.Finished;
    }

    /**
     * 当前逻辑帧到下一逻辑帧之间的渲染插值比例，范围为 0 到 1。
     * 该值只影响画面平滑度，不参与战斗结果计算。
     */
    get interpolationAlpha() {
        return Math.min(1, this.accumulatedSeconds * this.config.rules.frameRate);
    }

    /** 按 tick 顺序执行已到达的连续服务帧。 */
    private processPendingFrames(onStep: (result: BattleStepResult) => void) {
        let frame: ServiceFrame | undefined;
        while ((frame = this.pendingFrames.get(this.engine.state.tick + 1))) {
            this.pendingFrames.delete(frame.tick);
            const stepResult = this.engine.executeFrame(frame);
            this.recording.frames.push(frame);
            onStep(stepResult);
            if (this.finished) break;
        }
    }

    /** 深拷贝指令结算结果，隔离网络层、录像层和战斗内核的数据所有权。 */
    private cloneFrame(frame: ServiceFrame): ServiceFrame {
        return {
            tick: frame.tick,
            commands: frame.commands.map((command) => ({
                ...command,
                resolution: { ...command.resolution },
            })),
        };
    }

    /** 判断当前帧来源是否支持接收客户端指令。 */
    private canSubmitCommands(source: BattleFrameSource): source is CommandSubmittingFrameSource {
        return "submitCommand" in source && typeof source.submitCommand === "function";
    }
}
