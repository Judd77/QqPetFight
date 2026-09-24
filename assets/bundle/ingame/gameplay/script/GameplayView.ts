import { BaseView } from "db://assets/bootstrap/script/service/viewService/BaseView";
import type { LoadingProgress } from "db://assets/bundle/ingame/loading/script/LoadingView";
import { ViewKeys } from "db://assets/bundle/shared/script/schema/ViewKeys";
import type { GameplayComponent } from "./GameplayComponent";
import { GameplayConfig } from "./common/GameplayConfig";
import { GameplayContext } from "./common/GameplayContext";
import type { GameplayEntry } from "./common/GameplayEntry";
import type { BattleInfo, BattleRecording, BattleStepResult } from "./common/GameplayTypes";
import { DamageTextController } from "./effect/DamageTextController";
import { ProcessController } from "./process/ProcessController";
import { ProjectileController } from "./projectile/ProjectileController";
import { RecordingController } from "./recording/RecordingController";
import { RoleController } from "./role/RoleController";
import { AssetController } from "./service/AssetController";
import { StatsController } from "./service/StatsController";
import { SkillController } from "./skill/SkillController";
import { UiController } from "./ui/UiController";
import { WeaponController } from "./weapon/WeaponController";

/** 玩法总入口：只编排各业务 Controller，不实现具体业务规则。 */
export class GameplayView extends BaseView<GameplayComponent, [GameplayEntry, LoadingProgress?]> {
    declare entry: GameplayEntry;
    readonly context = new GameplayContext();
    readonly config = new GameplayConfig();
    readonly statsCtrl = new StatsController();
    readonly assetCtrl = new AssetController(this);
    readonly processCtrl = new ProcessController(this);
    readonly roleCtrl = new RoleController(this);
    readonly weaponCtrl = new WeaponController(this);
    readonly skillCtrl = new SkillController(this);
    readonly projectileCtrl = new ProjectileController(this);
    readonly damageTextCtrl = new DamageTextController(this);
    readonly uiCtrl = new UiController(this);
    readonly recordingCtrl = new RecordingController(this);

    protected override readonly controllers = [
        this.assetCtrl,
        this.processCtrl,
        this.roleCtrl,
        this.weaponCtrl,
        this.skillCtrl,
        this.projectileCtrl,
        this.damageTextCtrl,
        this.uiCtrl,
        this.recordingCtrl,
    ];

    /** 配置服务启动完成后同步建立 Gameplay 只读配置。 */
    protected override onBeforeLoad() {
        this.config.load(this.serve.configService.tables);
    }

    /** 保存入口数据并启动本场玩法。 */
    protected override async onLoad(entry: GameplayEntry, onProgress?: LoadingProgress) {
        this.entry = entry;
        await this.start(entry.battle, onProgress);
    }

    /** 重新使用已保存的服务帧播放一场战斗。 */
    async replay(recording: BattleRecording | undefined = this.context.lastRecording, checksum = this.context.lastChecksum) {
        if (this.context.loading || !recording) return;
        this.recordingCtrl.validate(recording);
        this.context.loading = true;
        try {
            await this.prepareBattle(recording.battle);
            this.context.lastRecording = recording;
            this.context.lastChecksum = checksum;
            this.processCtrl.replay(recording);
            this.resetPresentation();
        } finally {
            this.context.loading = false;
        }
    }

    /** 将一帧确定性逻辑结果分发给各表现业务。 */
    onCommandStep(result: BattleStepResult) {
        this.damageTextCtrl.onStep(result);
        this.processCtrl.onStep(result);
        this.weaponCtrl.onStep(result);
        this.skillCtrl.onStep(result);
        this.roleCtrl.onStep(result);
        this.uiCtrl.onStep(result);
    }

    /** 把本局原始结算数据交给独立 ResultView。 */
    async openResult() {
        const lockstep = this.context.lockstep;
        if (!lockstep?.finished) return;
        await this.serve.viewService.load(ViewKeys.Result, {
            entry: this.entry,
            winner: lockstep.state.winner,
            replaying: this.context.replaying,
            saved: this.recordingCtrl.isCurrentSaved,
            saveRecording: () => this.recordingCtrl.save(),
        });
    }

    /** 启动一场新的单机模拟战斗。 */
    private async start(info: BattleInfo, onProgress?: LoadingProgress) {
        if (this.context.loading) return;
        this.context.loading = true;
        try {
            onProgress?.(0.25, "准备对战");
            await this.prepareBattle(info, onProgress);
            this.processCtrl.start(info);
            this.resetPresentation();
            onProgress?.(0.98, "准备就绪");
        } finally {
            this.context.loading = false;
        }
    }

    /** 按本场参战数据准备资源和固定节点表现。 */
    private async prepareBattle(info: BattleInfo, onProgress?: LoadingProgress) {
        onProgress?.(0.3, "加载角色、武器与技能");
        await this.assetCtrl.prepare(info, (progress) => {
            onProgress?.(0.3 + 0.65 * progress, "加载角色、武器与技能");
        });
        this.roleCtrl.prepare();
        this.projectileCtrl.prepare();
        this.uiCtrl.prepare(info);
        this.weaponCtrl.prepare(info);
        this.skillCtrl.prepare(info);
    }

    /** 清空上一场表现并立即绘制当前初始状态。 */
    private resetPresentation() {
        this.serve.viewService.unload(ViewKeys.Result);
        this.processCtrl.reset();
        this.roleCtrl.reset();
        this.weaponCtrl.reset();
        this.skillCtrl.reset();
        this.projectileCtrl.reset();
        this.damageTextCtrl.reset();
        this.uiCtrl.reset();
        this.roleCtrl.update(0);
        this.weaponCtrl.update(0);
        this.projectileCtrl.update(0);
        this.uiCtrl.update(0);
    }

    /** Gameplay 退出时只关闭结算 View，资源缓存由 AssetController 保留。 */
    protected override onUnload() {
        this.serve.viewService.unload(ViewKeys.Result);
    }
}
