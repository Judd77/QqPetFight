import { BaseView } from "db://assets/bootstrap/script/service/viewService/BaseView";
import { ViewKeys } from "db://assets/bundle/shared/script/schema/ViewKeys";
import type { LoadingProgress } from "db://assets/bundle/ingame/loading/script/LoadingView";
import type { GameplayComponent } from "./GameplayComponent";
import { BattleContext } from "./battle/BattleContext";
import type { BattleInfo, BattleRecording } from "./battle/BattleTypes";
import type { BattleWorld } from "./battle/BattleWorld";
import { AudioController } from "./controller/AudioController";
import { BattleController } from "./controller/BattleController";
import { UiController } from "./controller/UiController";
import { PresentationController } from "./controller/PresentationController";
import { RecordingController } from "./controller/RecordingController";
import { SkillController } from "./skill/SkillController";
import { WeaponController } from "./weapon/WeaponController";

/** 玩法总入口：组装 Controller，协调对战数据、资源与表现。 */
export class GameplayView extends BaseView<GameplayComponent, [LoadingProgress?]> {
    readonly context = new BattleContext();
    readonly battleCtrl = new BattleController(this);
    readonly weaponCtrl = new WeaponController(this);
    readonly skillCtrl = new SkillController(this);
    readonly presentationCtrl = new PresentationController(this);
    readonly uiCtrl = new UiController(this);
    readonly audioCtrl = new AudioController(this);
    readonly recordingCtrl = new RecordingController(this);

    protected override readonly controllers = [
        this.battleCtrl,
        this.recordingCtrl,
        this.weaponCtrl,
        this.skillCtrl,
        this.presentationCtrl,
        this.uiCtrl,
        this.audioCtrl,
    ];

    /** 完成固定资源加载后，申请第一场对战。 */
    protected override async onLoad(onProgress?: LoadingProgress) {
        await this.restart(onProgress);
    }

    /** 根据新响应准备资源，再启动这一场战斗。 */
    async restart(onProgress?: LoadingProgress) {
        if (this.context.loading) return;
        this.context.loading = true;
        try {
            onProgress?.(0.25, "获取对战信息");
            const info = await this.battleCtrl.requestBattle();
            await this.prepareBattle(info, onProgress);
            this.battleCtrl.start(info);
            this.resetPresentation();
            onProgress?.(0.98, "准备就绪");
        } finally {
            this.context.loading = false;
        }
    }

    /** 使用录像保存的配装重建武器栏，不请求另一份对战数据。 */
    async replay(recording: BattleRecording | undefined = this.context.lastRecording, checksum = this.context.lastChecksum) {
        if (this.context.loading || !recording) return;
        this.context.loading = true;
        try {
            const info = recording.battle;
            await this.prepareBattle(info);
            this.context.lastRecording = recording;
            this.context.lastChecksum = checksum;
            if (this.battleCtrl.replay()) this.resetPresentation();
        } finally {
            this.context.loading = false;
        }
    }

    /** 汇总武器、技能和角色动画的实际完成进度。 */
    private async prepareBattle(info: BattleInfo, onProgress?: LoadingProgress) {
        let completed = 0;
        let roleProgress = 0;
        const report = () => onProgress?.(0.3 + 0.65 * (completed + roleProgress) / 3, "加载角色、武器与技能");
        report();
        const results = await Promise.allSettled([
            this.weaponCtrl.prepare(info).then(() => { completed++; report(); }),
            this.skillCtrl.prepare(info).then(() => { completed++; report(); }),
            this.presentationCtrl.prepare(info, (progress) => { roleProgress = progress; report(); }),
        ]);
        const failed = results.find((result) => result.status === "rejected") as PromiseRejectedResult | undefined;
        if (failed) throw failed.reason;
    }

    /** 打开独立结算 View，传入本局结果与业务操作。 */
    async openResult() {
        const session = this.context.session;
        if (!session?.finished) return;
        await this.serve.viewService.load(ViewKeys.Result, {
            winner: session.world.winner,
            saved: this.recordingCtrl.isCurrentSaved,
            saveRecording: () => this.recordingCtrl.save(),
            playAgain: () => this.restart(),
        });
    }

    /** 离开玩法时同时关闭结算，避免弹窗遗留到大厅。 */
    protected override onUnload() {
        this.serve.viewService.unload(ViewKeys.Result);
    }

    /** 按逻辑帧通知各表现模块，补帧时不遗漏事件。 */
    onBattleFrame(world: BattleWorld) {
        this.presentationCtrl.onFrame(world);
        this.uiCtrl.onFrame(world);
        this.audioCtrl.onFrame(world);
        this.weaponCtrl.render(world);
        this.skillCtrl.render(world);
    }

    /** 切换对战后立即刷新显示，不额外推进逻辑帧。 */
    private resetPresentation() {
        this.serve.viewService.unload(ViewKeys.Result);
        this.presentationCtrl.reset();
        this.uiCtrl.reset();
        this.audioCtrl.reset();
        this.weaponCtrl.render(this.context.session!.world);
        this.skillCtrl.render(this.context.session!.world);
        this.presentationCtrl.update(0);
        this.uiCtrl.update(0);
    }
}
