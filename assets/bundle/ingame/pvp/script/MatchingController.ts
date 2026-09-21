import { Sprite, SpriteFrame } from "cc";
import { BaseController } from "db://assets/bootstrap/script/service/viewService/BaseController";
import { ViewKeys } from "db://assets/bundle/shared/script/schema/ViewKeys";
import { playerGateway } from "db://assets/bundle/shared/script/player/PlayerGateway";
import { FighterGender, FighterInfo } from "../../gameplay/script/battle/BattleTypes";
import type { BattleEntry } from "../../gameplay/script/battle/BattleEntry";
import type { MatchingView } from "./MatchingView";
import { pvpGateway } from "./PvpGateway";

enum MatchState { Preparing, Waiting, Requesting, Found, Entering, Failed, Closed }
const frames = new Map<string, SpriteFrame>();

/** 单机匹配节奏、取消与进场；异步返回后不触碰已关闭的界面。 */
export class MatchingController extends BaseController<MatchingView> {
    private state = MatchState.Closed;
    private elapsed = 0;
    private requestId = 0;
    private entry?: BattleEntry;

    async start() {
        const requestId = ++this.requestId;
        const ui = this.view.component;
        this.state = MatchState.Preparing;
        this.elapsed = 0;
        this.entry = undefined;
        ui.retry.node.active = false;
        ui.cancel.interactable = true;
        ui.playerPortrait.node.active = false;
        ui.opponentPortrait.node.active = false;
        ui.searching.active = true;
        ui.playerName.string = "我方";
        ui.opponentName.string = "等待对手";
        ui.status.string = "正在准备匹配…";
        ui.elapsed.string = "";
        try {
            const { fighter } = await playerGateway.getProfile();
            const portrait = await this.loadPortrait(fighter);
            if (requestId !== this.requestId) return;
            this.setPortrait(ui.playerPortrait, portrait);
            ui.playerName.string = fighter.name;
            ui.status.string = "正在寻找对手…";
            ui.elapsed.string = "已等待 0 秒";
            this.state = MatchState.Waiting;
        } catch (error) {
            if (requestId === this.requestId) this.fail(error);
        }
    }

    protected override onUpdate(dt: number) {
        if (this.state !== MatchState.Waiting && this.state !== MatchState.Found) return;
        this.elapsed += dt;
        if (this.state === MatchState.Waiting) {
            this.view.component.elapsed.string = "已等待 " + Math.floor(this.elapsed) + " 秒";
            if (this.elapsed >= 3) void this.match();
        } else if (this.elapsed >= 1) {
            void this.enterBattle();
        }
    }

    cancel() {
        if (this.state === MatchState.Entering) return;
        this.closeRequest();
        this.view.serve.viewService.unload(ViewKeys.Matching);
    }

    protected override onUnload() {
        this.closeRequest();
    }

    private closeRequest() {
        this.requestId++;
        this.state = MatchState.Closed;
        this.entry = undefined;
    }

    private async match() {
        this.state = MatchState.Requesting;
        const requestId = this.requestId;
        try {
            const entry = await pvpGateway.match();
            const opponent = entry.battle.fighters[1]!;
            const portrait = await this.loadPortrait(opponent);
            if (requestId !== this.requestId) return;
            const ui = this.view.component;
            this.entry = entry;
            this.setPortrait(ui.opponentPortrait, portrait);
            ui.searching.active = false;
            ui.opponentName.string = opponent.name;
            ui.status.string = "匹配成功";
            ui.elapsed.string = "即将进入战斗";
            this.elapsed = 0;
            this.state = MatchState.Found;
        } catch (error) {
            if (requestId === this.requestId) this.fail(error);
        }
    }

    private async enterBattle() {
        if (!this.entry) return;
        this.state = MatchState.Entering;
        this.view.component.cancel.interactable = false;
        const service = this.view.serve.viewService;
        try {
            await service.loadWithComponentReady(ViewKeys.Loading,
                () => service.unload(ViewKeys.Matching), this.entry);
        } catch (error) {
            if (this.view.isLoaded) this.fail(error);
        }
    }

    private fail(error: unknown) {
        console.error(error);
        this.state = MatchState.Failed;
        const ui = this.view.component;
        ui.status.string = "匹配失败，请重试";
        ui.elapsed.string = "";
        ui.retry.node.active = true;
        ui.cancel.interactable = true;
    }

    private async loadPortrait(fighter: FighterInfo) {
        const config = this.view.serve.configService.tables.TbBattleView.get(1)!;
        const path = fighter.portraitPath || (fighter.gender === FighterGender.Female
            ? config.femalePortrait : config.malePortrait);
        const cached = frames.get(path);
        if (cached) return cached;
        const frame = await this.view.serve.assetService.load(path, SpriteFrame);
        // 取消后立刻重新匹配时，旧请求可能与新请求同时完成。
        const loaded = frames.get(path);
        if (loaded) return loaded;
        frame.addRef();
        frames.set(path, frame);
        return frame;
    }

    private setPortrait(sprite: Sprite, frame: SpriteFrame) {
        sprite.spriteFrame = frame;
        const scale = 112 / Math.max(frame.originalSize.width, frame.originalSize.height);
        sprite.node.setScale(scale, scale, 1);
        sprite.node.active = true;
    }
}
