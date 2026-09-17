import { BattleCommand, BattleInfo, BattlePhase, BattleRecording, FRAME_SECONDS, MAX_BATTLE_FRAMES, ServiceFrame } from "./BattleTypes";
import { BattleWorld } from "./BattleWorld";
import { validateBattleInfo } from "./MockBattleServer";

/** 外部收藏和回放先验证初始数据及连续服务帧，拒绝损坏录像。 */
export function validateRecording(recording: BattleRecording) {
    if (!recording || recording.version !== 2) throw new Error("不支持的录像版本");
    validateBattleInfo(recording.battle);
    if (!Array.isArray(recording.frames) || !recording.frames.length || recording.frames.length > MAX_BATTLE_FRAMES) {
        throw new Error("录像帧数无效");
    }
    recording.frames.forEach((frame, index) => {
        if (!frame || frame.tick !== index + 1 || !Array.isArray(frame.commands) || frame.commands.length > 100 ||
            frame.commands.some((command) => !command || ![0, 1].includes(command.player) || !Number.isSafeInteger(command.sequence))) {
            throw new Error("录像服务帧无效：" + (index + 1));
        }
    });
}


/** 正式联网时用网络实现替换本地服务，不改变 BattleWorld。 */
export interface FrameSource {
    onFrame: (frame: ServiceFrame) => void;
    advance(dt: number): void;
    submit(command: BattleCommand): void;
}

/** 本地模拟服务：按固定频率收集输入、排序并广播服务帧。 */
export class LocalFrameServer implements FrameSource {
    onFrame: (frame: ServiceFrame) => void = () => {};
    private tick = 0;
    private elapsed = 0;
    private readonly pending: BattleCommand[] = [];
    private readonly sequences = [-1, -1];

    submit(command: BattleCommand) {
        if (!Number.isInteger(command.player) || command.player < 0 || command.player > 1 ||
            !Number.isSafeInteger(command.sequence) || command.sequence <= this.sequences[command.player]!) return;
        this.sequences[command.player] = command.sequence;
        this.pending.push({ ...command });
    }

    advance(dt: number) {
        if (!Number.isFinite(dt) || dt <= 0) return;
        this.elapsed += dt;
        // 限制单次补帧工作量，保留积压时间，不跳过逻辑帧。
        for (let count = 0; count < 100 && this.elapsed + 1e-9 >= FRAME_SECONDS; count++) {
            this.elapsed -= FRAME_SECONDS;
            const commands = this.pending.splice(0).sort((a, b) => a.player - b.player || a.sequence - b.sequence);
            this.onFrame({ tick: ++this.tick, commands });
        }
    }
}

/** 回放直接重发已录制的服务帧，不重新采集输入。 */
export class ReplayFrameSource implements FrameSource {
    onFrame: (frame: ServiceFrame) => void = () => {};
    private index = 0;
    private elapsed = 0;

    constructor(private readonly recording: BattleRecording) {
        validateRecording(recording);
    }

    submit(_command: BattleCommand) {}

    advance(dt: number) {
        if (!Number.isFinite(dt) || dt <= 0) return;
        this.elapsed += dt;
        for (let count = 0; count < 100 && this.elapsed + 1e-9 >= FRAME_SECONDS && this.index < this.recording.frames.length; count++) {
            this.elapsed -= FRAME_SECONDS;
            this.onFrame(this.recording.frames[this.index++]!);
        }
    }
}

/** 客户端只推进连续已确认帧；乱序帧缓存，缺帧等待，重复帧忽略。 */
export class BattleSession {
    readonly world: BattleWorld;
    readonly recording: BattleRecording;
    paused = false;
    speed = 1;
    private readonly frames = new Map<number, ServiceFrame>();
    private renderTime = 0;

    constructor(info: BattleInfo, readonly source: FrameSource = new LocalFrameServer()) {
        const battle = JSON.parse(JSON.stringify(info)) as BattleInfo;
        this.world = new BattleWorld(battle);
        this.recording = { version: 2, battle, frames: [] };
        source.onFrame = (frame) => this.receive(frame);
    }

    receive(frame: ServiceFrame) {
        if (!Number.isSafeInteger(frame.tick) || frame.tick <= this.world.tick || this.frames.has(frame.tick)) return;
        this.frames.set(frame.tick, { tick: frame.tick, commands: frame.commands.map((command) => ({ ...command })) });
    }

    /** 渲染 dt 只驱动服务时钟和插值，不传入逻辑状态机。 */
    update(dt: number, onStep: (world: BattleWorld) => void) {
        if (this.paused || this.finished) return;
        const elapsed = Math.max(0, Number.isFinite(dt) ? dt : 0) * this.speed;
        this.renderTime += elapsed;
        this.source.advance(elapsed);
        let frame: ServiceFrame | undefined;
        while ((frame = this.frames.get(this.world.tick + 1))) {
            this.frames.delete(frame.tick);
            this.world.step(frame);
            this.recording.frames.push(frame);
            this.renderTime = Math.max(0, this.renderTime - FRAME_SECONDS);
            onStep(this.world);
            if (this.world.phase === BattlePhase.Finished) break;
        }
    }

    get finished(): boolean { return this.world.phase === BattlePhase.Finished; }

    get alpha(): number { return Math.min(1, this.renderTime / FRAME_SECONDS); }

    submit(command: BattleCommand) {
        if (this.world.phase !== BattlePhase.Finished) this.source.submit(command);
    }
}
