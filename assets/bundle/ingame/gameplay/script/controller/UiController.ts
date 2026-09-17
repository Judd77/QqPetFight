import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import type { GameplayView } from "../GameplayView";
import type { BattleWorld } from "../battle/BattleWorld";
import { BattleEventType, BattlePhase, COUNTDOWN_FRAMES, FRAME_RATE, SKILLS, WeaponId, WEAPONS } from "../battle/BattleTypes";

/** 处理固定 UI 的输入转发与战斗数据显示。 */
export class UiController extends BaseController<GameplayView> {
    private finishElapsed = 0;
    private resultRequested = false;

    /** 展示本次出招提示。 */
    onFrame(world: BattleWorld) {
        const state = this.view.component;
        for (const event of world.events) {
            if (event.type === BattleEventType.Skill) state.actionLabel.string = SKILLS[event.skill!].name;
            else if (event.type === BattleEventType.PutDown) state.actionLabel.string = "放下" + WEAPONS[event.weapon!].name;
            else if (event.type === BattleEventType.PickUp) state.actionLabel.string = "拾起" + WEAPONS[event.weapon!].name;
            else if (event.type === BattleEventType.Equip) state.actionLabel.string = "取出" + WEAPONS[event.weapon!].name;
            else if (event.type === BattleEventType.Throw) state.actionLabel.string = "投掷" + WEAPONS[event.weapon!].name;
            else if (event.type === BattleEventType.Attack) state.actionLabel.string = WEAPONS[event.weapon ?? WeaponId.Fist].name;
            else continue;
            state.actionExpires = world.tick + FRAME_RATE * 2;
        }
    }

    /** 刷新生命值、库存和战斗结果。 */
    protected override onUpdate(dt: number) {
        const state = this.view.component;
        const session = this.view.context.session;
        if (!session) return;
        const world = session.world;
        state.speedButton.active = !session.finished;
        for (const fighter of world.fighters) {
            const ui = state.players[fighter.id]!;
            ui.hp.fillRange = fighter.hp / fighter.maxHp * (fighter.id === 0 ? 1 : -1);
            ui.health.string = fighter.hp + "/" + fighter.maxHp;
            ui.name.string = this.view.context.info!.fighters[fighter.id]!.name;
        }
        state.roundLabel.string = world.phase === BattlePhase.Countdown
            ? String(Math.max(1, Math.ceil((COUNTDOWN_FRAMES - world.tick) / FRAME_RATE)))
            : "第" + Math.ceil(world.round / 2) + "回合";
        if (world.tick > state.actionExpires) state.actionLabel.string = "";
        if (session.finished && !session.paused) this.finishElapsed += dt * session.speed;
        if (session.finished && this.finishElapsed > 0.8 && !this.resultRequested && !this.view.context.loading) {
            this.resultRequested = true;
            void this.view.openResult().catch((error) => {
                console.error(error);
                state.actionLabel.string = "结算加载失败，请重新进入战斗";
                state.actionExpires = Number.MAX_SAFE_INTEGER;
            });
        }
    }

    /** 开局清理状态，保留已编辑好的所有节点。 */
    reset() {
        const state = this.view.component;
        this.resultRequested = false;
        this.finishElapsed = 0;
        state.actionExpires = 0;
        state.actionLabel.string = "";
    }

    /** 切换播放倍速。 */
    onClickSpeed() { this.view.battleCtrl.toggleSpeed(); }

}
