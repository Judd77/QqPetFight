import { ViewDefinition } from "./ViewDefinition";

/** 业务层通过注册表向框架提供 View 构造信息。 */
export class ViewRegistry implements ViewDefinition.ViewRegistry {
    private static schema?: ViewDefinition.ViewSchema;

    declare sharedPath: string;
    readonly preloadViews: ViewDefinition.AnyViewKey[] = [];

    private readonly constructors = new Map<string, ViewDefinition.ViewConstructor>();

    static setSchema(schema: ViewDefinition.ViewSchema) {
        ViewRegistry.schema = schema;
    }

    registerSchema(): ViewDefinition.AnyViewKey {
        const schema = ViewRegistry.schema;
        if (!schema) throw new Error("业务 View Schema 尚未加载");
        this.sharedPath = schema.sharedPath;
        this.preloadViews.push(...(schema.preloadViews ?? []));
        for (const view of schema.views) this.register(view.key, view.config);
        return schema.entryView;
    }

    private register(viewKey: ViewDefinition.AnyViewKey, constructor: ViewDefinition.ViewConstructor) {
        if (this.constructors.has(viewKey.name)) throw new Error(`视图【${viewKey.name}】重复注册`);
        this.constructors.set(viewKey.name, constructor);
    }

    getViewCtor(viewName: string): ViewDefinition.ViewConstructor | undefined {
        return this.constructors.get(viewName);
    }
}
