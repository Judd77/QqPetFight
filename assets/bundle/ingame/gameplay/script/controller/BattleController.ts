import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import type { GameplayView } from "../GameplayView";
import { BattleSession, LocalFrameServer, ReplayFrameSource } from "../battle/BattleSession";
import type { BattleInfo, BattleRecording } from "../battle/BattleTypes";
import { validateBattleInfo } from "../battle/BattleValidator";
import { BattleReportProducer } from "../server/BattleReportProducer";

/** 管理对战数据源和会话生命周期，不操作任何 Cocos 节点。 */
export class BattleController extends BaseController<GameplayView> {
    start(info: BattleInfo) {
        validateBattleInfo(info, this.view.config.battle);
        const context = this.view.context;
        const config = this.view.config.battle;
        context.info = info;
        context.session = new BattleSession(
            info,
            config,
            new LocalFrameServer(config),
            new BattleReportProducer(info, config),
        );
        context.replaying = false;
        context.completed = false;
    }

    replay(recording: BattleRecording) {
        const context = this.view.context;
        const config = this.view.config.battle;
        context.info = recording.battle;
        context.session = new BattleSession(recording.battle, config, new ReplayFrameSource(recording, config));
        context.replaying = true;
        context.completed = false;
        return true;
    }

    toggleSpeed() {
        const session = this.view.context.session;
        if (!session) return;
        const view = this.view.config.view;
        session.speed = session.speed === view.normalSpeed ? view.fastSpeed : view.normalSpeed;
    }

    getDebugState() {
        const context = this.view.context;
        const session = context.session;
        if (!session) return;
        return {
            tick: session.state.tick,
            seed: session.engine.info.seed,
            phase: session.state.phase,
            winner: session.state.winner,
            checksum: session.engine.checksum(),
            replaying: context.replaying,
            fighters: session.state.fighters.map((fighter) => ({
                ...fighter,
                inventory: fighter.inventory.slice(),
                usedSkills: fighter.usedSkills.slice(),
            })),
            recordedFrames: session.recording.frames.length,
        };
    }

    protected override onUpdate(dt: number) {
        const context = this.view.context;
        const session = context.session;
        if (!session || context.loading) return;
        session.update(dt, (result) => this.view.onBattleStep(result));
        if (context.completed || !session.finished) return;
        context.completed = true;
        if (context.replaying) {
            if (session.engine.checksum() !== context.lastChecksum) throw new Error("回放状态校验失败");
        } else {
            context.lastRecording = session.recording;
            context.lastChecksum = session.engine.checksum();
        }
    }

    protected override onUnload() {
        this.view.context.reset();
    }
}
