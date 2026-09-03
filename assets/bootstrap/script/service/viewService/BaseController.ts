import type { AnyView } from "./BaseView";

/** 可组合到 View 中的行为控制器。 */
export abstract class BaseController<TView extends AnyView> {
    constructor(protected readonly view: TView) {}

    async load() {
        await this.onLoad();
    }

    unload() {
        this.onUnload();
    }

    update(dt: number) {
        this.onUpdate(dt);
    }

    protected onLoad(): void | Promise<void> {}
    protected onUnload() {}
    protected onUpdate(_dt: number) {}
}
