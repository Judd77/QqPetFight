# 项目背景

- 本项目是《Q宠大乱斗》的 PvP 版本，玩法完整参考《Q宠大乱斗》。
- 当前阶段优先实现单机版 Demo；在没有额外说明时，开发与设计均以单机 Demo 为目标，不提前引入联网 PvP 的复杂度。

## 代码职责

- 框架使用方式及代码风格参考 `D:/project/tdCar-game/client`。
- View 是业务总入口，负责协调各个 Controller，不写显式构造函数。
- Component 作为 Cocos 引用与被动状态的仓库，只负责动态获取节点、组件及按钮事件绑定与转发，不承载业务逻辑。
- 各项功能拆到对应 Controller；表现层不计算战斗结果。
- Set、Map 和迭代器转数组使用 `Array.from(...)`。当前 Cocos 发布编译会把数组展开降级为 concat，不能对这些非数组对象使用 `[...value]`；需实际构建验证，不能只测编辑器预览。
- Bootstrap 与 bundle 业务解耦：框架不硬编码业务路径，不引用 bundle 内的业务脚本或生成类型。

## UI 与资源

- 固定 UI 保存在场景或 prefab 中；动态列表通过数据实例化通用项，不把具体业务数据写死在 UI 上。
- 使用场景已有相机，不额外添加相机、Widget、SafeArea 或运行时分辨率适配。背景使用静态 1334×750 图片。
- UI Sprite 使用 RAW，图片只等比缩放，不用 CUSTOM 拉伸。
- 图片统一放业务的 `texture` 目录，角色序列帧放 `texture/role`，UI 放 `texture/ui`，其他素材按用途分类；背景直接放 `texture` 根目录。
- 武器图标放 `texture/weapon`，技能散图放 `texture/atlas/skill`；结算等独立业务的图片、音频和 prefab 放回各自业务目录，不混入玩法 UI。
- 玩法资源加载后保留缓存，退出玩法只清理节点和运行状态，不释放已加载资源；再次进入或加载失败重试时复用成功缓存，不重复增加资源引用。

## 音频加载

- `ViewSchema` 的 `path` 是业务根目录。`ViewService` 在创建 View 前调用 `setAudioClips(path)`，读取 `path/audio`；业务 Controller 不自行加载或卸载音频。
- 业务按名称调用 `playSound(name)` / `playMusic(name)`，所有业务音频名称须唯一。
- 资源按目录去重并缓存，退出业务不卸载；失败不标记已加载，允许重试。
- 公共路径由 `ViewSchema` 的 `sharedPath` 提供（当前为 `shared`），Facade 在进入首个 View 前加载公共音频；没有音频时返回空列表。
- 未保存音量时默认 1，显式保存的 0 保持静音。

## 配置表（Luban）

- Excel 源表位于客户端目录之外的 `D:/project/qqPetFight-game/table`，生成工具位于 `D:/project/qqPetFight-game/tool/luban`，不放到 client 中。
- 运行 `tool/luban/gen-client.bat` 生成 `assets/bundle/shared/script/schema/Schema.ts` 和 `assets/bundle/shared/config/*.json`；以源表为准，不手工维护生成文件。
- 全项目只使用 `bundle/shared/config` 一个配置目录。Facade 在进入首个 View 前统一加载，业务通过 `configService.tables` 同步获取 Tables。
- `Tables` 的创建方法在业务包的 ViewSchema 中注册，类型也由业务层补充；ConfigService 不导入业务 Schema。启动先等待 bundle 加载并注册，再加载配置、公共音频和预加载 View，最后进入大厅。

## 验证与素材使用

- Cocos 3.8.8 的 TypeScript 模块位于编辑器 `resources/resources/3d/engine/node_modules/typescript`；具体测试命令见各业务 README。
- 离线 Node 测试统一放在项目根目录 `test/gameplay`，使用 `.cjs`，不放入 Cocos assets。资源转换工具统一放在项目根目录 `tool/gameplay`，不执行下载的 Flash 代码。
- 浏览器预览不能代替原生设备的内存、帧率和触控验证，未验证的部分须明确说明。
- 公开下载不代表商业使用或再分发授权，正式发布前须落实原权利人授权。

## Git 提交规范

- 提交标题使用 `【领域】动作与内容` 格式；前缀说明改动范围，标题中的动词说明具体做了什么。
- 常用前缀：`框架`、`玩法`、`界面`、`资源`、`配置`、`修复`、`优化`、`重构`、`工程`、`测试`、`文档`、`清理`。
- 一个提交只选择一个主要领域；同时涉及多类内容时，以核心目的为准，其他内容写入提交正文。
- 彼此独立的不同领域改动应拆分提交，避免使用含义宽泛的 `新增`、`更新`、`调整`。
- Bootstrap、Service、View 等基础设施使用 `【框架】`；战斗规则、帧同步、技能和武器使用 `【玩法】`。
- 不改变功能的代码结构整理使用 `【重构】`；构建、工具、依赖和目录结构使用 `【工程】`。
