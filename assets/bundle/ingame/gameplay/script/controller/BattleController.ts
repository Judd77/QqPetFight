import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import type { GameplayView } from "../GameplayView";
import { BattleSession, ReplayFrameSource } from "../battle/BattleSession";
import type { BattleInfo } from "../battle/BattleTypes";
import { MockBattleServer, validateBattleInfo } from "../battle/MockBattleServer";

/** 管理模拟接口、会话推进与录像，不操作场景节点。 */
export class BattleController extends BaseController<GameplayView> {
    private readonly server = new MockBattleServer();

    /** 获取初始对战数据；正式接入时只替换这里的接口来源。 */
    async requestBattle() {
        const info = await this.server.requestBattle();
        validateBattleInfo(info);
        return info;
    }

    /** 资源与武器栏准备好以后，才启动逻辑帧。 */
    start(info: BattleInfo) {
        const context = this.view.context;
        context.info = info;
        context.session = new BattleSession(info);
        context.replaying = false;
        context.completed = false;
    }

    /** 推进唯一逻辑帧入口，并在结束时保存或校验录像。 */
    protected override onUpdate(dt: number) {
        const context = this.view.context;
        const session = context.session;
        if (!session || context.loading) return;
        session.update(dt, (world) => this.view.onBattleFrame(world));
        if (context.completed || !session.finished) return;
        context.completed = true;
        if (context.replaying) {
            if (session.world.checksum() !== context.lastChecksum) throw new Error("回放状态校验失败");
        } else {
            context.lastRecording = session.recording;
            context.lastChecksum = session.world.checksum();
        }
    }

    /** 重播保存的完整初始数据，不重新向模拟服务器申请装备。 */
    replay() {
        const context = this.view.context;
        const recording = context.lastRecording;
        if (!recording) return false;
        context.info = recording.battle;
        context.session = new BattleSession(recording.battle, new ReplayFrameSource(recording));
        context.replaying = true;
        context.completed = false;
        return true;
    }

    /** 切换一倍与二倍播放速度。 */
    toggleSpeed() {
        const session = this.view.context.session;
        if (session) session.speed = session.speed === 1 ? 2 : 1;
    }

    /** 返回与渲染无关的调试快照。 */
    getDebugState() {
        const context = this.view.context;
        const session = context.session;
        if (!session) return;
        const world = session.world;
        return {
            tick: world.tick, seed: world.seed, phase: world.phase, winner: world.winner,
            checksum: world.checksum(), replaying: context.replaying,
            fighters: world.fighters.map((fighter) => ({ ...fighter, inventory: [...fighter.inventory] })),
            recordedFrames: session.recording.frames.length,
        };
    }

    /** 清理独立于场景节点的对战状态。 */
    protected override onUnload() {
        this.view.context.reset();
    }
}
