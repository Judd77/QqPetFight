import { _decorator } from "cc";
import { BaseViewComponent } from "db://assets/bootstrap/script/service/viewService/BaseViewComponent";
import type { GameplayView } from "./GameplayView";

const { ccclass } = _decorator;

@ccclass("GameplayComponent")
export class GameplayComponent extends BaseViewComponent<GameplayView> {}
