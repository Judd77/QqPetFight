import type { BattleCommand, ServiceFrame } from "../model/GameplayTypes";

/**
 * 锁步服务使用的服务帧来源。
 *
 * 本地单机服务和录像回放都实现该接口。会话只负责按固定频率取帧，
 * 不需要知道这一帧来自实时服务、单机模拟服务还是录像文件。
 */
export interface FrameSource {
    /**
     * 读取下一帧。
     *
     * @param canStartAction 当前战斗内核是否可以接收一条新行动。
     * @returns 下一服务帧；数据源耗尽时返回 undefined。
     */
    readNextFrame(canStartAction: boolean): ServiceFrame | undefined;
}

/** 支持外部提交指令的服务帧来源；录像回放不需要实现该能力。 */
export interface CommandSubmittingFrameSource extends FrameSource {
    /** 将一条玩家或机器人指令放入下一服务帧。 */
    submitCommand(command: BattleCommand): void;
}

/** 为本地模拟服务提供已结算指令。 */
export interface CommandSource {
    /** 仅在战斗内核可开始新行动时返回下一条指令。 */
    readNextCommand(canStartAction: boolean): BattleCommand | undefined;
}
