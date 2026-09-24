import { Sprite, SpriteFrame } from "cc";
import { BaseView } from "db://assets/bootstrap/script/service/viewService/BaseView";
import { ViewKeys } from "db://assets/bundle/shared/script/schema/ViewKeys";
import { playerGateway } from "db://assets/bundle/shared/script/player/PlayerGateway";
import type { GameplayEntry } from "../../../ingame/gameplay/script/model/GameplayEntry";
import { FighterGender, FighterInfo } from "../../../ingame/gameplay/script/model/GameplayTypes";
import type { MatchingComponent } from "./MatchingComponent";
import { pvpGateway } from "./PvpGateway";

enum MatchState { Preparing, Waiting, Requesting, Found, Entering, Failed, Closed }
const frames = new Map<string, SpriteFrame>();

/** PVP 匹配总入口，不在加载阶段等待整个匹配流程。 */
export class MatchingView extends BaseView<MatchingComponent> {
    private state = MatchState.Closed;
    private elapsedSeconds = 0;
    private requestId = 0;
    private entry?: GameplayEntry;

    protected override async onLoad() {
        await this.start();
    }

    /** 初始化本次匹配并读取玩家资料。 */
    async start() {
        const requestId = ++this.requestId;
        const component = this.component;
        this.state = MatchState.Preparing;
        this.elapsedSeconds = 0;
        this.entry = undefined;
        component.retry.node.active = false;
        component.cancel.interactable = true;
        component.playerPortrait.node.active = false;
        component.opponentPortrait.node.active = false;
        component.searching.active = true;
        component.playerName.string = "我方";
        component.opponentName.string = "等待对手";
        component.status.string = "正在准备匹配…";
        component.elapsed.string = "";
        try {
            const { fighter } = await playerGateway.getProfile();
            const portrait = await this.loadPortrait(fighter);
            if (requestId !== this.requestId) return;
            this.setPortrait(component.playerPortrait, portrait);
            component.playerName.string = fighter.name;
            component.status.string = "正在寻找对手…";
            component.elapsed.string = "已等待 0 秒";
            this.state = MatchState.Waiting;
        } catch (error) {
            if (requestId === this.requestId) this.fail(error);
        }
    }

    /** 取消当前匹配并关闭页面。 */
    cancel() {
        if (this.state === MatchState.Entering) return;
        this.closeRequest();
        this.serve.viewService.unload(ViewKeys.Matching);
    }

    /** 推进等待、匹配成功停留和进入战斗的计时。 */
    protected override onUpdate(dt: number) {
        if (this.state !== MatchState.Waiting && this.state !== MatchState.Found) return;
        this.elapsedSeconds += dt;
        if (this.state === MatchState.Waiting) {
            this.component.elapsed.string = "已等待 " + Math.floor(this.elapsedSeconds) + " 秒";
            if (this.elapsedSeconds >= 3) void this.match();
        } else if (this.elapsedSeconds >= 1) {
            void this.enterBattle();
        }
    }

    /** 页面关闭后使所有异步匹配响应失效。 */
    protected override onUnload() {
        this.closeRequest();
    }

    /** 关闭当前异步请求上下文。 */
    private closeRequest() {
        this.requestId++;
        this.state = MatchState.Closed;
        this.entry = undefined;
    }

    /** 请求离线匹配响应并展示对手。 */
    private async match() {
        this.state = MatchState.Requesting;
        const requestId = this.requestId;
        try {
            const entry = await pvpGateway.match();
            const opponent = entry.battle.fighters[1]!;
            const portrait = await this.loadPortrait(opponent);
            if (requestId !== this.requestId) return;
            this.entry = entry;
            this.setPortrait(this.component.opponentPortrait, portrait);
            this.component.searching.active = false;
            this.component.opponentName.string = opponent.name;
            this.component.status.string = "匹配成功";
            this.component.elapsed.string = "即将进入战斗";
            this.elapsedSeconds = 0;
            this.state = MatchState.Found;
        } catch (error) {
            if (requestId === this.requestId) this.fail(error);
        }
    }

    /** 匹配完成后打开加载页。 */
    private async enterBattle() {
        if (!this.entry) return;
        this.state = MatchState.Entering;
        this.component.cancel.interactable = false;
        try {
            await this.serve.viewService.loadWithComponentReady(ViewKeys.Loading,
                () => this.serve.viewService.unload(ViewKeys.Matching), this.entry);
        } catch (error) {
            if (this.isLoaded) this.fail(error);
        }
    }

    /** 展示匹配失败状态并允许重试。 */
    private fail(error: unknown) {
        console.error(error);
        this.state = MatchState.Failed;
        this.component.status.string = "匹配失败，请重试";
        this.component.elapsed.string = "";
        this.component.retry.node.active = true;
        this.component.cancel.interactable = true;
    }

    /** 加载并缓存角色头像。 */
    private async loadPortrait(fighter: FighterInfo) {
        const config = this.serve.configService.tables.TbBattleView.get(1)!;
        const path = fighter.portraitPath || (fighter.gender === FighterGender.Female
            ? config.femalePortrait : config.malePortrait);
        const cached = frames.get(path);
        if (cached) return cached;
        const frame = await this.serve.assetService.load(path, SpriteFrame);
        const loaded = frames.get(path);
        if (loaded) return loaded;
        frame.addRef();
        frames.set(path, frame);
        return frame;
    }

    /** 按原始比例设置头像。 */
    private setPortrait(sprite: Sprite, frame: SpriteFrame) {
        sprite.spriteFrame = frame;
        const scale = 112 / Math.max(frame.originalSize.width, frame.originalSize.height);
        sprite.node.setScale(scale, scale, 1);
        sprite.node.active = true;
    }
}
