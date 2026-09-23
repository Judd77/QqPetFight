import type { BattleCommandSource } from "../battle/BattleFrameSource";
import type { BattleCommand, BattleReport } from "../battle/BattleTypes";

/** 顺序读取一份已生成战报，不参与战报规则计算。 */
export class BattleReportReader implements BattleCommandSource {
    private nextActionIndex = 0;

    constructor(private readonly report: BattleReport) {}

    /** 战斗内核可开始新行动时，返回战报中的下一条已结算指令。 */
    readNextCommand(canStartAction: boolean): BattleCommand | undefined {
        if (!canStartAction) return;
        const command = this.report.actions[this.nextActionIndex++];
        return command ? this.cloneCommand(command) : undefined;
    }

    /** 读出的指令使用独立对象，避免客户端执行过程污染原始战报。 */
    private cloneCommand(command: BattleCommand): BattleCommand {
        return { ...command, resolution: { ...command.resolution } };
    }
}
