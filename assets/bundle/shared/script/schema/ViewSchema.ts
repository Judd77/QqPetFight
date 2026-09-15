import { ViewRegistry } from "db://assets/bootstrap/script/service/viewService/ViewRegistry";
import { GameplayComponent } from "db://assets/bundle/ingame/gameplay/script/GameplayComponent";
import { GameplayView } from "db://assets/bundle/ingame/gameplay/script/GameplayView";
import { LobbyComponent } from "db://assets/bundle/outgame/lobby/script/LobbyComponent";
import { LobbyView } from "db://assets/bundle/outgame/lobby/script/LobbyView";
import { ViewKeys } from "./ViewKeys";

ViewRegistry.setSchema({
    entryView: ViewKeys.Lobby,
    views: [
        {
            key: ViewKeys.Lobby,
            config: { ctor: LobbyView, comp: LobbyComponent, assetPath: "outgame/lobby/scene/LobbyView", isScene: true },
        },
        {
            key: ViewKeys.Gameplay,
            config: { ctor: GameplayView, comp: GameplayComponent, assetPath: "ingame/gameplay/scene/GameplayView", isScene: true },
        },
    ],
});
