import { BattleEngine } from "./BattleEngine";
import {
    BattleAttackType, BattleCommand, BattleCommandType, BattleDefinitions, BattleInfo, BattleIntent, BattlePhase,
    BattleReaction, BattleRecording, BattleStepResult, ServiceFrame,
} from "./BattleTypes";
import { validateBattleInfo } from "./BattleValidator";

export interface CommandProducer {
    create(engine: BattleEngine): BattleCommand | undefined;
}

/** 网络、本地模拟服务与录像源共用的最小服务帧接口。 */
export interface FrameSource {
    onFrame: (frame: ServiceFrame) => void;
    beforeFrame?: () => void;
    advance(dt: number): void;
    submit(command: BattleCommand): void;
}

/** 本地模拟服务：固定频率收集指令、排序并广播服务帧。 */
export class LocalFrameServer implements FrameSource {
    onFrame: (frame: ServiceFrame) => void = () => {};
    beforeFrame: () => void = () => {};
    private tick = 0;
    private elapsed = 0;
    private readonly pending: BattleCommand[] = [];
    private readonly sequences = new Map<number, number>();

    constructor(private readonly config: BattleDefinitions) {}

    submit(command: BattleCommand) {
        if (!Number.isInteger(command.player) || command.player < 0 ||
            !Number.isSafeInteger(command.sequence) ||
            command.sequence <= (this.sequences.get(command.player) ?? 0)) return;
        this.sequences.set(command.player, command.sequence);
        this.pending.push({ ...command, resolution: { ...command.resolution } });
    }

    advance(dt: number) {
        if (!Number.isFinite(dt) || dt <= 0) return;
        const rules = this.config.rules;
        const frameSeconds = 1 / rules.frameRate;
        this.elapsed += dt;
        for (let count = 0; count < rules.maxCatchUpFrames && this.elapsed + 1e-9 >= frameSeconds; count++) {
            this.elapsed -= frameSeconds;
            this.beforeFrame();
            const commands = this.pending.splice(0).sort((left, right) =>
                left.player - right.player || left.sequence - right.sequence);
            this.onFrame({ tick: ++this.tick, commands });
        }
    }
}

/** 回放只重发已录制服务帧，不运行机器人或重新生成指令。 */
export class ReplayFrameSource implements FrameSource {
    onFrame: (frame: ServiceFrame) => void = () => {};
    private index = 0;
    private elapsed = 0;

    constructor(private readonly recording: BattleRecording, private readonly config: BattleDefinitions) {
        validateRecording(recording, config);
    }

    submit(_command: BattleCommand) {}

    advance(dt: number) {
        if (!Number.isFinite(dt) || dt <= 0) return;
        const frameSeconds = 1 / this.config.rules.frameRate;
        this.elapsed += dt;
        for (let count = 0; count < this.config.rules.maxCatchUpFrames &&
            this.elapsed + 1e-9 >= frameSeconds && this.index < this.recording.frames.length; count++) {
            this.elapsed -= frameSeconds;
            this.onFrame(this.recording.frames[this.index++]!);
        }
    }
}

/** 先校验配置版本、初始数据和连续服务帧，再允许外部录像进入逻辑层。 */
export function validateRecording(recording: BattleRecording, config: BattleDefinitions) {
    if (!recording || recording.version !== 5) throw new Error("不支持的录像版本");
    if (recording.configVersion !== config.rules.version) throw new Error("录像配置版本不匹配");
    validateBattleInfo(recording.battle, config);
    if (!Array.isArray(recording.frames) || !recording.frames.length || recording.frames.length > config.rules.maxFrames) {
        throw new Error("录像帧数无效");
    }
    const sequences = recording.battle.fighters.map(() => 0);
    let round = 0;
    recording.frames.forEach((frame, index) => {
        const players = new Set<number>();
        if (!frame || frame.tick !== index + 1 || !Array.isArray(frame.commands) ||
            frame.commands.length > 1 ||
            frame.commands.some((command) => {
                if (!command || !Number.isInteger(command.player) || command.player < 0 ||
                    command.player >= recording.battle.fighters.length || players.has(command.player) ||
                    !Number.isSafeInteger(command.sequence) || command.sequence <= sequences[command.player]! ||
                    command.type !== BattleCommandType.Act || !Number.isSafeInteger(command.round) ||
                    command.round <= 0 || command.round < round ||
                    ![BattleIntent.Attack, BattleIntent.Equip, BattleIntent.Throw, BattleIntent.Skill].includes(command.intent) ||
                    ![BattleAttackType.None, BattleAttackType.Normal, BattleAttackType.Throw,
                        BattleAttackType.Combo].includes(command.attackType) || typeof command.counter !== "boolean" ||
                    !Number.isSafeInteger(command.comboIndex) || command.comboIndex < 0 ||
                    !Number.isSafeInteger(command.entryId) || !command.resolution ||
                    !Number.isInteger(command.resolution.target) || command.resolution.target < 0 ||
                    command.resolution.target >= recording.battle.fighters.length ||
                    ![BattleReaction.None, BattleReaction.Hit, BattleReaction.Dodge,
                        BattleReaction.Block].includes(command.resolution.reaction) ||
                    !Number.isSafeInteger(command.resolution.damage) || command.resolution.damage < 0 ||
                    !Number.isSafeInteger(command.resolution.healing) || command.resolution.healing < 0 ||
                    typeof command.resolution.critical !== "boolean" ||
                    (command.resolution.reaction !== BattleReaction.Hit && command.resolution.damage !== 0)) return true;
                players.add(command.player);
                sequences[command.player] = command.sequence;
                round = command.round;
                return false;
            })) {
            throw new Error("录像服务帧无效：" + (index + 1));
        }
    });
}

/** 只推进连续确认帧；逻辑帧和渲染插值时间完全分离。 */
export class BattleSession {
    readonly engine: BattleEngine;
    readonly recording: BattleRecording;
    paused = false;
    speed = 1;
    private readonly frames = new Map<number, ServiceFrame>();
    private renderTime = 0;
    private stepCallback?: (result: BattleStepResult) => void;

    constructor(
        info: BattleInfo,
        readonly config: BattleDefinitions,
        readonly source: FrameSource = new LocalFrameServer(config),
        producer?: CommandProducer,
    ) {
        const battle = JSON.parse(JSON.stringify(info)) as BattleInfo;
        this.engine = new BattleEngine(battle, config);
        this.recording = { version: 5, configVersion: config.rules.version, battle, frames: [] };
        source.onFrame = (frame) => {
            this.receive(frame);
            if (this.stepCallback) this.drain(this.stepCallback);
        };
        if (producer && source.beforeFrame) {
            source.beforeFrame = () => {
                const command = producer.create(this.engine);
                if (command) source.submit(command);
            };
        }
    }

    receive(frame: ServiceFrame) {
        if (!Number.isSafeInteger(frame.tick) || frame.tick <= this.engine.state.tick || this.frames.has(frame.tick)) return;
        this.frames.set(frame.tick, {
            tick: frame.tick,
            commands: frame.commands.map((command) => ({
                ...command,
                resolution: { ...command.resolution },
            })),
        });
    }

    update(dt: number, onStep: (result: BattleStepResult) => void) {
        if (this.paused || this.finished) return;
        const elapsed = Math.max(0, Number.isFinite(dt) ? dt : 0) * this.speed;
        this.renderTime += elapsed;
        this.stepCallback = onStep;
        try {
            this.source.advance(elapsed);
            this.drain(onStep);
        } finally {
            this.stepCallback = undefined;
        }
    }

    submit(command: BattleCommand) {
        if (!this.finished) this.source.submit(command);
    }

    get state() {
        return this.engine.state;
    }

    get finished() {
        return this.engine.state.phase === BattlePhase.Finished;
    }

    get alpha() {
        return Math.min(1, this.renderTime * this.config.rules.frameRate);
    }

    private drain(onStep: (result: BattleStepResult) => void) {
        let frame: ServiceFrame | undefined;
        const frameSeconds = 1 / this.config.rules.frameRate;
        while ((frame = this.frames.get(this.engine.state.tick + 1))) {
            this.frames.delete(frame.tick);
            const result = this.engine.step(frame);
            this.recording.frames.push(frame);
            this.renderTime = Math.max(0, this.renderTime - frameSeconds);
            onStep(result);
            if (this.finished) break;
        }
    }
}
