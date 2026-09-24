import {
    BattleAttackType, BattleCommandType, BattleDefinitions, BattleIntent, BattleReaction, BattleRecording,
} from "../model/GameplayTypes";
import { validateBattleInfo } from "../model/GameplayValidator";

/**
 * 校验外部录像能否安全交给确定性战斗内核执行。
 *
 * 校验范围包括配置版本、初始战斗数据、连续帧号、指令序号和已结算结果。
 * 此函数不修改录像内容。
 */
export function validateBattleRecording(recording: BattleRecording, config: BattleDefinitions) {
    if (!recording || recording.version !== 5) throw new Error("不支持的录像版本");
    if (recording.configVersion !== config.rules.version) throw new Error("录像配置版本不匹配");
    validateBattleInfo(recording.battle, config);
    if (!Array.isArray(recording.frames) || !recording.frames.length ||
        recording.frames.length > config.rules.maxFrames) {
        throw new Error("录像帧数无效");
    }

    const latestSequenceByPlayer = recording.battle.fighters.map(() => 0);
    let latestRound = 0;
    recording.frames.forEach((frame, index) => {
        const playersInFrame = new Set<number>();
        const invalidFrame = !frame || frame.tick !== index + 1 || !Array.isArray(frame.commands) ||
            frame.commands.length > 1 || frame.commands.some((command) => {
                const invalidCommand = !command || !Number.isInteger(command.player) || command.player < 0 ||
                    command.player >= recording.battle.fighters.length || playersInFrame.has(command.player) ||
                    !Number.isSafeInteger(command.sequence) ||
                    command.sequence <= latestSequenceByPlayer[command.player]! ||
                    command.type !== BattleCommandType.Act || !Number.isSafeInteger(command.round) ||
                    command.round <= 0 || command.round < latestRound ||
                    ![BattleIntent.Attack, BattleIntent.Equip, BattleIntent.Throw,
                        BattleIntent.Skill].includes(command.intent) ||
                    ![BattleAttackType.None, BattleAttackType.Normal, BattleAttackType.Throw,
                        BattleAttackType.Combo].includes(command.attackType) ||
                    typeof command.counter !== "boolean" || !Number.isSafeInteger(command.comboIndex) ||
                    command.comboIndex < 0 || !Number.isSafeInteger(command.entryId) || !command.resolution ||
                    !Number.isInteger(command.resolution.target) || command.resolution.target < 0 ||
                    command.resolution.target >= recording.battle.fighters.length ||
                    ![BattleReaction.None, BattleReaction.Hit, BattleReaction.Dodge,
                        BattleReaction.Block].includes(command.resolution.reaction) ||
                    !Number.isSafeInteger(command.resolution.damage) || command.resolution.damage < 0 ||
                    !Number.isSafeInteger(command.resolution.healing) || command.resolution.healing < 0 ||
                    typeof command.resolution.critical !== "boolean" ||
                    (command.resolution.reaction !== BattleReaction.Hit && command.resolution.damage !== 0);
                if (invalidCommand) return true;

                playersInFrame.add(command.player);
                latestSequenceByPlayer[command.player] = command.sequence;
                latestRound = command.round;
                return false;
            });
        if (invalidFrame) throw new Error("录像服务帧无效：" + (index + 1));
    });
}
