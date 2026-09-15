import type { GameplayView } from "db://assets/bundle/ingame/gameplay/script/GameplayView";
import type { LobbyView } from "db://assets/bundle/outgame/lobby/script/LobbyView";
import { ViewDefinition } from "db://assets/bootstrap/script/service/viewService/ViewDefinition";

export const ViewKeys = {
    Lobby: ViewDefinition.defineView<LobbyView>("LobbyView"),
    Gameplay: ViewDefinition.defineView<GameplayView>("GameplayView"),
} as const;
