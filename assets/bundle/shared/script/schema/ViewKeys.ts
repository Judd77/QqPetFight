import type { LoadingView } from "db://assets/bundle/ingame/loading/script/LoadingView";
import type { ResultView } from "db://assets/bundle/ingame/result/script/ResultView";
import type { GameplayView } from "db://assets/bundle/ingame/gameplay/script/GameplayView";
import type { LobbyView } from "db://assets/bundle/outgame/lobby/script/LobbyView";
import type { PveView } from "db://assets/bundle/outgame/pve/script/PveView";
import type { MatchingView } from "db://assets/bundle/outgame/pvp/script/MatchingView";
import type { PreloadView } from "db://assets/bundle/outgame/preload/script/PreloadView";
import { ViewDefinition } from "db://assets/bootstrap/script/service/viewService/ViewDefinition";

export const ViewKeys = {
    Preload: ViewDefinition.defineView<PreloadView>("PreloadView"),
    Matching: ViewDefinition.defineView<MatchingView>("MatchingView"),
    Pve: ViewDefinition.defineView<PveView>("PveView"),
    Loading: ViewDefinition.defineView<LoadingView>("LoadingView"),
    Lobby: ViewDefinition.defineView<LobbyView>("LobbyView"),
    Gameplay: ViewDefinition.defineView<GameplayView>("GameplayView"),
    Result: ViewDefinition.defineView<ResultView>("ResultView"),
} as const;
