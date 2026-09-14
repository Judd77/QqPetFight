import { ViewDefinition } from "db://assets/bootstrap/script/service/viewService/ViewDefinition";
import { ViewRegistry } from "db://assets/bootstrap/script/service/viewService/ViewRegistry";
import { LobbyComponent } from "db://assets/bundle/outgame/lobby/script/LobbyComponent";
import { LobbyView } from "db://assets/bundle/outgame/lobby/script/LobbyView";

export const ViewKeys = {
    Lobby: ViewDefinition.defineView<LobbyView>("LobbyView", "bundle", "outgame/lobby/scene/Lobby"),
} as const;

ViewRegistry.setSchema({
    entryView: ViewKeys.Lobby,
    views: [
        {
            key: ViewKeys.Lobby,
            config: { ctor: LobbyView, comp: LobbyComponent, resourceType: "scene" },
        },
    ],
});
