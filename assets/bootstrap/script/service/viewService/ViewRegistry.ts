import { ViewDefinition } from "./ViewDefinition";

/** 业务层通过注册表向框架提供 View 构造信息。 */
export class ViewRegistry implements ViewDefinition.ViewRegistry {
    private static schema?: ViewDefinition.ViewSchema;

    private readonly constructors = new Map<string, ViewDefinition.ViewConstructor>();

    static setSchema(schema: ViewDefinition.ViewSchema) {
        ViewRegistry.schema = schema;
    }

    applySchema(): ViewDefinition.AnyViewKey {
        const schema = ViewRegistry.schema;
        if (!schema) throw new Error("业务 View Schema 尚未加载");
        for (const view of schema.views) this.register(view.key, view.config);
        return schema.entryView;
    }

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
