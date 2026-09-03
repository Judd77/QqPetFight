import { ViewDefinition } from "./ViewDefinition";

/** 业务层通过注册表向框架提供 View 构造信息。 */
export class ViewRegistry implements ViewDefinition.ViewRegistry {
    private readonly constructors = new Map<string, ViewDefinition.ViewConstructor>();

    register(viewKey: ViewDefinition.AnyViewKey, constructor: ViewDefinition.ViewConstructor) {
        if (this.constructors.has(viewKey.name)) throw new Error(`视图【${viewKey.name}】重复注册`);
        this.constructors.set(viewKey.name, constructor);
    }

    unregister(viewKey: ViewDefinition.AnyViewKey): boolean {
        return this.constructors.delete(viewKey.name);
    }

    getViewCtor(viewName: string): ViewDefinition.ViewConstructor | undefined {
        return this.constructors.get(viewName);
    }

    clear() {
        this.constructors.clear();
    }
}
