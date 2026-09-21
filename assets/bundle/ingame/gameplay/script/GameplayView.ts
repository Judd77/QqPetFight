import { BaseView } from "db://assets/bootstrap/script/service/viewService/BaseView";
import { ViewKeys } from "db://assets/bundle/shared/script/schema/ViewKeys";
import type { LoadingProgress } from "db://assets/bundle/ingame/loading/script/LoadingView";
import type { GameplayComponent } from "./GameplayComponent";
import { BattleContext } from "./battle/BattleContext";
import type { BattleInfo, BattleRecording, BattleStepResult } from "./battle/BattleTypes";
import { GameplayConfig } from "./config/GameplayConfig";
import { AudioController } from "./controller/AudioController";
import { BattleController } from "./controller/BattleController";
import { GameplayAssetController } from "./controller/GameplayAssetController";
import { RecordingController } from "./controller/RecordingController";
import { StageController } from "./controller/StageController";
import { UiController } from "./controller/UiController";
import type { BattleEntry } from "./battle/BattleEntry";
import { BattleResultController } from "./controller/BattleResultController";

/** 玩法总入口：只编排数据、资源、会话、表现和结算的先后顺序。 */
export class GameplayView extends BaseView<GameplayComponent, [BattleEntry, LoadingProgress?]> {
    declare entry: BattleEntry;
    readonly context = new BattleContext();
    readonly config = new GameplayConfig();
    readonly assetCtrl = new GameplayAssetController(this);
    readonly battleCtrl = new BattleController(this);
    readonly stageCtrl = new StageController(this);
    readonly uiCtrl = new UiController(this);
    readonly audioCtrl = new AudioController(this);
    readonly recordingCtrl = new RecordingController(this);
    readonly resultCtrl = new BattleResultController(this);

    protected override readonly controllers = [
        this.assetCtrl,
        this.battleCtrl,
        this.stageCtrl,
        this.uiCtrl,
        this.audioCtrl,
        this.recordingCtrl,
        this.resultCtrl,
    ];

    protected override onBeforeLoad() {
        this.config.load(this.serve.configService.tables);
    }

    protected override async onLoad(entry: BattleEntry, onProgress?: LoadingProgress) {
        this.entry = entry;
        await this.startBattle(entry.battle, onProgress);
    }

    private async startBattle(info: BattleInfo, onProgress?: LoadingProgress) {
        if (this.context.loading) return;
        this.context.loading = true;
        try {
            onProgress?.(0.25, "准备对战");
            await this.prepareBattle(info, onProgress);
            this.battleCtrl.start(info);
            this.resetPresentation();
            onProgress?.(0.98, "准备就绪");
        } finally {
            this.context.loading = false;
        }
    }

    async replay(recording: BattleRecording | undefined = this.context.lastRecording, checksum = this.context.lastChecksum) {
        if (this.context.loading || !recording) return;
        this.context.loading = true;
        try {
            await this.prepareBattle(recording.battle);
            this.context.lastRecording = recording;
            this.context.lastChecksum = checksum;
            if (this.battleCtrl.replay(recording)) this.resetPresentation();
        } finally {
            this.context.loading = false;
        }
    }

    onBattleStep(result: BattleStepResult) {
        this.stageCtrl.onStep(result);
        this.uiCtrl.onStep(result);
        this.audioCtrl.onStep(result);
    }

    async openResult() {
        await this.resultCtrl.show();
    }

    protected override onUnload() {
        this.serve.viewService.unload(ViewKeys.Result);
    }

    private async prepareBattle(info: BattleInfo, onProgress?: LoadingProgress) {
        onProgress?.(0.3, "加载角色、武器与技能");
        await this.assetCtrl.prepare(info, (progress) => {
            onProgress?.(0.3 + 0.65 * progress, "加载角色、武器与技能");
        });
        this.stageCtrl.prepare();
        this.uiCtrl.prepare(info);
    }

    private resetPresentation() {
        this.serve.viewService.unload(ViewKeys.Result);
        this.stageCtrl.reset();
        this.uiCtrl.reset();
        this.audioCtrl.reset();
        this.stageCtrl.update(0);
        this.uiCtrl.update(0);
    }
}
