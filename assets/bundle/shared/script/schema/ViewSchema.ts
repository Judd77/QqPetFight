import { ConfigService } from "db://assets/bootstrap/script/service/ConfigService";
import { Schema } from "./Schema";
import { ViewDefinition } from "db://assets/bootstrap/script/service/viewService/ViewDefinition";
import { ViewRegistry } from "db://assets/bootstrap/script/service/viewService/ViewRegistry";
import { GameplayComponent } from "db://assets/bundle/ingame/gameplay/script/GameplayComponent";
import { GameplayView } from "db://assets/bundle/ingame/gameplay/script/GameplayView";
import { ResultComponent } from "db://assets/bundle/ingame/result/script/ResultComponent";
import { ResultView } from "db://assets/bundle/ingame/result/script/ResultView";
import { LoadingComponent } from "db://assets/bundle/ingame/loading/script/LoadingComponent";
import { LoadingView } from "db://assets/bundle/ingame/loading/script/LoadingView";
import { LobbyComponent } from "db://assets/bundle/outgame/lobby/script/LobbyComponent";
import { LobbyView } from "db://assets/bundle/outgame/lobby/script/LobbyView";
import { ViewKeys } from "./ViewKeys";
import { PveComponent } from "db://assets/bundle/ingame/pve/script/PveComponent";
import { PveView } from "db://assets/bundle/ingame/pve/script/PveView";
import { MatchingComponent } from "db://assets/bundle/ingame/pvp/script/MatchingComponent";
import { MatchingView } from "db://assets/bundle/ingame/pvp/script/MatchingView";

/** 仅补充 TypeScript 类型，不产生启动包到业务包的运行时依赖。 */
declare module "db://assets/bootstrap/script/service/ConfigService" {
    interface ConfigTables extends Schema.Tables {}
}

ConfigService.createTables = (loader) => new Schema.Tables(loader);

ViewRegistry.setSchema({
    sharedPath: "shared",
    entryView: ViewKeys.Lobby,
    preloadViews: [ViewKeys.Loading],
    views: [
        {
            key: ViewKeys.Matching,
            config: { ctor: MatchingView, comp: MatchingComponent, path: "ingame/pvp", layer: ViewDefinition.ViewLayer.Popup, cache: false },
        },
        {
            key: ViewKeys.Pve,
            config: { ctor: PveView, comp: PveComponent, path: "ingame/pve", layer: ViewDefinition.ViewLayer.Popup, cache: false },
        },
        {
            key: ViewKeys.Loading,
            config: { ctor: LoadingView, comp: LoadingComponent, path: "ingame/loading", layer: ViewDefinition.ViewLayer.System, cache: false },
        },
        {
            key: ViewKeys.Lobby,
            config: { ctor: LobbyView, comp: LobbyComponent, path: "outgame/lobby", isScene: true },
        },
        {
            key: ViewKeys.Gameplay,
            config: { ctor: GameplayView, comp: GameplayComponent, path: "ingame/gameplay", isScene: true },
        },
        {
            key: ViewKeys.Result,
            config: { ctor: ResultView, comp: ResultComponent, path: "ingame/result", layer: ViewDefinition.ViewLayer.Popup },
        },
    ],
});
