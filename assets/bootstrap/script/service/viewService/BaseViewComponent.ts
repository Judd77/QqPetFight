import { Component } from "cc";
import type { AnyView } from "./BaseView";

/** Component 只持有 Cocos 引用并将输入转发给 View。 */
export abstract class BaseViewComponent<TView extends AnyView> extends Component {
    declare view: TView;
}
