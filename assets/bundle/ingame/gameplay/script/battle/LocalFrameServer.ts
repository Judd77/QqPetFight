import type {
    BattleCommandSource, CommandSubmittingFrameSource,
} from "./BattleFrameSource";
import type { BattleCommand, ServiceFrame } from "./BattleTypes";

/**
 * 单机 Demo 使用的本地帧服务器。
 *
 * 它模拟真实帧服务器最小职责：接收客户端指令、按玩家与序号排序，
 * 然后产生编号连续的服务帧。时间累计和固定帧率调度由 BattleSession 负责。
 */
export class LocalFrameServer implements CommandSubmittingFrameSource {
    private tick = 0;
    private readonly pendingCommands: BattleCommand[] = [];
    private readonly latestSequenceByPlayer = new Map<number, number>();

    constructor(private readonly commandSource?: BattleCommandSource) {}

    /**
     * 校验指令序号并加入下一服务帧。
     * 重复、倒序或玩家编号无效的指令会被忽略。
     */
    submitCommand(command: BattleCommand) {
        const latestSequence = this.latestSequenceByPlayer.get(command.player) ?? 0;
        if (!Number.isInteger(command.player) || command.player < 0 ||
            !Number.isSafeInteger(command.sequence) || command.sequence <= latestSequence) {
            return;
        }
        this.latestSequenceByPlayer.set(command.player, command.sequence);
        this.pendingCommands.push(this.cloneCommand(command));
    }

    /**
     * 生成下一服务帧。
     * 本地战报指令会在封帧前读取，因此同一帧即可被战斗内核消费。
     */
    readNextFrame(canStartAction: boolean): ServiceFrame {
        const command = this.commandSource?.readNextCommand(canStartAction);
        if (command) this.submitCommand(command);

        const commands = this.pendingCommands.splice(0).sort((left, right) =>
            left.player - right.player || left.sequence - right.sequence);
        return { tick: ++this.tick, commands };
    }

    /** 防止调用方后续修改已提交指令，破坏确定性。 */
    private cloneCommand(command: BattleCommand): BattleCommand {
        return { ...command, resolution: { ...command.resolution } };
    }
}
