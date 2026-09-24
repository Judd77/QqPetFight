import type {
    BattleCommand, BattleDefinitions, BattleInfo, BattleReport, ServiceFrame,
} from "../model/GameplayTypes";
import type { CommandSubmittingFrameSource } from "../lockstep/FrameSource";
import type { StatsController } from "../stats/StatsController";
import { ServerSimulationLogic } from "./ServerSimulationLogic";

/**
 * 单机 Demo 的模拟服务器入口。
 * 正式联网后由网络数据源替换，LockstepController 无需感知帧的来源。
 */
export class ServerSimulationController implements CommandSubmittingFrameSource {
    private readonly report: BattleReport;
    private reportIndex = 0;
    private tick = 0;
    private readonly pendingCommands: BattleCommand[] = [];
    private readonly latestSequenceByPlayer = new Map<number, number>();

    /** 根据本场数据预先生成确定性的服务端战报。 */
    constructor(info: BattleInfo, config: BattleDefinitions, stats: StatsController) {
        this.report = new ServerSimulationLogic().generateReport(info, config, stats);
    }

    /** 校验指令序号并加入下一服务帧。 */
    submitCommand(command: BattleCommand) {
        const latestSequence = this.latestSequenceByPlayer.get(command.player) ?? 0;
        if (!Number.isInteger(command.player) || command.player < 0 ||
            !Number.isSafeInteger(command.sequence) || command.sequence <= latestSequence) {
            return;
        }
        this.latestSequenceByPlayer.set(command.player, command.sequence);
        this.pendingCommands.push(this.cloneCommand(command));
    }

    /** 生成下一编号连续的权威服务帧。 */
    readNextFrame(canStartAction: boolean): ServiceFrame {
        if (canStartAction) {
            const command = this.report.actions[this.reportIndex++];
            if (command) this.submitCommand(command);
        }
        const commands = this.pendingCommands.splice(0).sort((left, right) =>
            left.player - right.player || left.sequence - right.sequence);
        return { tick: ++this.tick, commands };
    }

    /** 隔离服务端战报与客户端执行过程的数据所有权。 */
    private cloneCommand(command: BattleCommand): BattleCommand {
        return { ...command, resolution: { ...command.resolution } };
    }
}
