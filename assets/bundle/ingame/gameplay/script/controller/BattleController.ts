import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import type { GameplayView } from "../GameplayView";
import { LocalFrameServer } from "../battle/LocalFrameServer";
import { ReplayFrameSource } from "../battle/ReplayFrameSource";
import { validateBattleRecording } from "../battle/BattleRecordingValidator";
import { BattleSession } from "../battle/BattleSession";
import type { BattleInfo, BattleRecording } from "../battle/BattleTypes";
import { validateBattleInfo } from "../battle/BattleValidator";
import { BattleReportProducer } from "../server/BattleReportProducer";
import { BattleReportReader } from "../server/BattleReportReader";

/**
 * 对战用例的总协调器。
 *
 * 这里是战斗逻辑对象的组装入口：生成战报、创建本地帧服务并启动会话。
 * 它不操作 Cocos 节点，也不实现具体战斗规则。
 */
export class BattleController extends BaseController<GameplayView> {
    /** 校验战斗数据并启动一场新的单机战斗。 */
    start(info: BattleInfo) {
        const config = this.view.config.battle;
        validateBattleInfo(info, config);

        const report = new BattleReportProducer().generateReport(info, config);
        const reportReader = new BattleReportReader(report);
        const localFrameServer = new LocalFrameServer(reportReader);

        const context = this.view.context;
        context.info = info;
        context.session = new BattleSession(info, config, localFrameServer);
        context.replaying = false;
        context.completed = false;
    }

    /** 校验并启动一份已有录像；回放期间不会重新执行随机规则。 */
    replay(recording: BattleRecording) {
        const config = this.view.config.battle;
        validateBattleRecording(recording, config);

        const context = this.view.context;
        context.info = recording.battle;
        context.session = new BattleSession(
            recording.battle,
            config,
            new ReplayFrameSource(recording),
        );
        context.replaying = true;
        context.completed = false;
        return true;
    }

    /** 在配置指定的正常速度和加速速度之间切换。 */
    toggleSpeed() {
        const session = this.view.context.session;
        if (!session) return;
        const viewConfig = this.view.config.view;
        session.speed = session.speed === viewConfig.normalSpeed
            ? viewConfig.fastSpeed
            : viewConfig.normalSpeed;
    }

    /** 返回便于开发期排查锁步差异的只读状态快照。 */
    getDebugState() {
        const context = this.view.context;
        const session = context.session;
        if (!session) return;
        return {
            tick: session.state.tick,
            seed: session.engine.info.seed,
            phase: session.state.phase,
            winner: session.state.winner,
            checksum: session.engine.calculateChecksum(),
            replaying: context.replaying,
            fighters: session.state.fighters.map((fighter) => ({
                ...fighter,
                inventory: fighter.inventory.slice(),
                usedSkills: fighter.usedSkills.slice(),
            })),
            recordedFrames: session.recording.frames.length,
        };
    }

    /** 每个 Cocos 更新帧推进会话，并在首次结束时保存录像校验信息。 */
    protected override onUpdate(elapsedSeconds: number) {
        const context = this.view.context;
        const session = context.session;
        if (!session || context.loading) return;

        session.update(elapsedSeconds, (stepResult) => this.view.onBattleStep(stepResult));
        if (context.completed || !session.finished) return;

        context.completed = true;
        const checksum = session.engine.calculateChecksum();
        if (context.replaying) {
            if (checksum !== context.lastChecksum) throw new Error("回放状态校验失败");
            return;
        }
        context.lastRecording = session.recording;
        context.lastChecksum = checksum;
    }

    /** 离开 GameplayView 时清空本局运行状态。 */
    protected override onUnload() {
        this.view.context.reset();
    }
}
