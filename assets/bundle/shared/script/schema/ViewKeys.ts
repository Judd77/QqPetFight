import type { LoadingView } from "db://assets/bundle/ingame/loading/script/LoadingView";
import type { ResultView } from "db://assets/bundle/ingame/result/script/ResultView";
import type { GameplayView } from "db://assets/bundle/ingame/gameplay/script/GameplayView";
import type { LobbyView } from "db://assets/bundle/outgame/lobby/script/LobbyView";
import { ViewDefinition } from "db://assets/bootstrap/script/service/viewService/ViewDefinition";

export const ViewKeys = {
    Loading: ViewDefinition.defineView<LoadingView>("LoadingView"),
    Lobby: ViewDefinition.defineView<LobbyView>("LobbyView"),
    Gameplay: ViewDefinition.defineView<GameplayView>("GameplayView"),
    Result: ViewDefinition.defineView<ResultView>("ResultView"),
} as const;
