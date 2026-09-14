import { _decorator } from "cc";
import { BaseViewComponent } from "db://assets/bootstrap/script/service/viewService/BaseViewComponent";
import type { LobbyView } from "./LobbyView";
const { ccclass, property } = _decorator;

@ccclass("LobbyComponent")
export class LobbyComponent extends BaseViewComponent<LobbyView> {}
