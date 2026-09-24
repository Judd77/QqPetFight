# Gameplay 单机对战

通用开发规范见客户端根目录的 [AGENTS.md](../../../../AGENTS.md)。本文仅记录 Gameplay 的实现、资源与验证方式。

从 Bootstrap 启动，在 Lobby 点击“江湖闯关”（PVE）预览当前关卡对手，点击“挑战”进入战斗；胜利解锁下一关，失败可重试。“乐斗切磋”（PVP）打开匹配页，等待后与女企鹅 mm 对战；当前为离线匹配，不读写 PVE 进度。玩法节点直接放在场景的 `2d` 下，固定 UI 直接放在 `Ui` 下。

## NPC 完整动作

十关依次为青蛙、狐狸精、树妖、花妖、黑熊、虾兵、蟹兵、章鱼、龟丞相、夜叉。来自官网当前清单的 NPC 5012～5030（偶数编号），合计 82 段动画、3838 个时间轴帧。每个角色有准备、待机、受击、闪避、胜利、失败及两到三套专属攻击；这些 NPC 的原版资源没有独立跑步动作，攻击中的位移保留在原始子时间轴内。

`NPC动画.xlsx` 按 NPC、阶段、动作、技能映射图集，帧数据与玩家共用 `角色序列帧.xlsx`，缩放和偏移均在表内。RolePresentation 统一播放序列帧；NPC 不使用静态头像作为战斗形象，也不回退为企鹅外观。资源放 `texture/role/npc编号`，共用头像放 `shared/texture/role`，技能散图放 `texture/atlas/skill`。

NPC 的 82 段动作已按脚掌或身体接地点校准。采样保存在 `脚底采样.xlsx`，共用默认站立基准，`tool/gameplay/align-npc-feet.cjs` 只计算整段 offsetX/offsetY 并写回 `NPC动画.xlsx`。入场采用落地后的采样帧，保留原始腾空、攻击和倒地位移；渲染层不硬编码 NPC 偏移。生成后运行 `node test/gameplay/verify-npc-feet.cjs` 检查。

NPC 固有攻击在技能表中设为 repeatable，由自动指令生成器选择，战斗内核执行。技能编号是当前 PVE 配置的内部编号，伤害、命中时点与关卡生命是当前版本调校数据，不代表官网服务器公式；技能缩略图取自对应动作，尚不是原版独立技能图标。

主角配装来自 PlayerGateway，关卡对手来自 PVE关卡表。素材转换与导出步骤见项目根目录 `tool/gameplay/README.md`。

启动时根据 ViewSchema 调用一次 `viewService.preload(ViewKeys.Loading)`，只预加载 LoadingView，不创建节点或执行业务逻辑，也不预加载玩法。点击战斗真正打开 `ingame/loading` 下的 LoadingView 后，才加载玩法并显示场景切换与本场角色、武器、技能的准备进度；完成后销毁加载页，失败可重试或返回大厅。LoadingView 不缓存 View 实例，已加载的玩法资源留在可复用 Controller 中，退出战斗不释放。

角色加载清单由本场 BattleInfo 决定：NPC 仅加载当前对手和其技能动作，玩家根据武器、技能与动作映射选取图集。远程武器只准备取出、投掷及结算动作；需要空手的技能只准备空手版本，携带这类技能时才准备近战武器的暂放、拾回动作。不整批加载角色目录，成功缓存跨局复用。场景 Actor 不绑定固定角色图集或默认帧，避免 PVE 随场景隐式加载 mm；角色在本场资源就绪后显示。运行 `node test/gameplay/verify-battle-assets.cjs` 验证加载范围和完整战斗动作覆盖。

## 已接入的玩法

- 20Hz 本地服务帧、整局录像和回放校验；渲染帧率不参与战斗计算。
- PlayerGateway 提供主角存档，PveCampaign 按关卡表组装对手；正式服务器协议尚未接入。
- 本地服务端在开战前生成已结算的完整战报，攻击者、目标、伤害和闪避均由战报指定；CommandController 只按连续服务帧执行，不固定交替也不自行随机判定。
- 原版男女企鹅，空手、短剑、红缨枪、小李飞刀。红缨枪使用官方中型武器的站立、跑步、受击和取出姿势。
- 小李飞刀原地投出、直线飞行；消耗服务器响应里的库存，不做近战接近。
- 依次取武器、接近、出招、投掷、归位；矿泉水回血、佛山无影脚、企鹅吼。
- 无影脚按官方配置先暂放手中武器，出招后拾回；暂放不增加库存。
- 喝水和企鹅吼可持械使用；动画有空手、短剑、红缨枪版本。
- 动画统一脚掌基准和翻转轴，不再按阴影或武器边界对齐；整段动作只平移，保留跑步步态、抬脚和技能腾空。
- 图集保留官方外层动作缩放及帧原点，合并重复图片但不删除时间轴帧；按本场角色、武器、技能加载可达动作。
- 武器栏、技能栏根据返回数据实例化 `WeaponCell`、`SkillCell` 通用项。
- 原版 27 个战斗与结算音效，按流程、角色、武器、技能归属到各业务；重复帧不重复播放，男女配音来自响应，投掷脱手后保留正确刀伤声，卷轴出现时播放胜负声音。
- “收藏录像”保存完整战斗数据、连续服务帧和最终校验值到本机；同局重复点击不重复保存。存储损坏或配额不足不会静默覆盖原存档。

这不是完整复刻验收：目前主角有六把武器、六个技能，十名 NPC 有 22 套固有攻击。触发概率、威力、先后手等为当前版本调校参数，不冒充官网服务器公式；完整武器技能、强化、连击反击、背景音乐和结算奖励还没有全部实现。

## 素材分类

- `texture/role/gg`、`texture/role/mm`：分别存放男、女角色的动作图集，共 226 张；8904 个时间轴帧条目由 shared 下的 Luban 配置表生成。
- `texture/ui`：状态栏、男女头像、血条和玩法按钮。
- `texture/atlas/skill`：技能散图。
- `texture/atlas/weapon`：短剑、红缨枪、小李飞刀、平底锅、板砖和大铁锤图标，库存、落地和投掷表现共用。
- `texture/courtyard.jpg`：背景直接放 texture 根目录。
- `audio`：战斗音效；胜负结算音效归属 `../result/audio`。
- `../result`：独立结算业务，包含 script、prefab、texture/ui 和 audio；结算图片不再放在玩法 UI 目录。
- `prefab/WeaponCell.prefab`、`prefab/SkillCell.prefab`：无具体图标的动态项模板。

## 代码职责

- `GameplayView`：玩法总入口，只创建并编排各业务 Controller。
- `GameplayComponent`：动态获取 Cocos 节点与组件，保存被动引用并转发按钮，不保存业务运行状态。
- `common`：集中保存 GameplayContext、GameplayTypes、GameplayEntry 和 GameplayConfig 等跨业务上下文与声明。
- `process/ProcessController`：控制准备、开战、推进、回放、结束和退出等整场玩法流程。
- `service`：放置不属于具体表现业务的 Gameplay 服务，包括资源缓存、锁步、单机服务模拟和数值计算；`common` 不承载服务实现。
- `service/LockstepController`：把 Cocos 时间转换为 20Hz 固定逻辑帧，处理连续帧缓存、录像记录和渲染插值。
- `service/ServerSimulationController`：单机模拟服务器入口；生成已结算战报和连续服务帧，正式联网时可整体替换。
- `service/StatsController`：命中、闪避、暴击、伤害和治疗的确定性数值入口，不保存战斗状态。
- `command/CommandController` / `CommandSequence`：消费服务指令并逐帧执行取武器、接近、攻击、返回等确定性步骤。
- `role/RoleController` / `RolePresentation` / `RoleAudio`：负责角色位置、动作、序列帧、攻击层级及角色音效，不计算战斗结果。
- `weapon/WeaponController` / `WeaponAudio`：管理动态武器格、地面武器及武器音效。
- `skill/SkillController` / `SkillAudio`：管理动态技能格及技能释放音效。
- `process/ProcessAudio`：处理倒计时和开战提示音效。
- `projectile/ProjectileController` / `effect/DamageTextController`：分别负责投射物和战斗飘字。
- `service/AssetController`：根据本场数据加载并长期缓存角色、头像、武器、技能和动态格子资源。
- `ui/UiController`：显示头像、名称、血量、回合、行为提示、倍速和结算入口，不加载资源。
- `recording/RecordingController`：管理本机录像收藏；`RecordingValidator` 校验外部录像。
- `shared/script/player/PlayerGateway` / `../pve/script/PveCampaign`：分别提供主角数据、关卡对手与通关进度。
- `../result/script/ResultView`：完整结算业务入口，处理 PVE 通关、胜负文案与声音、收藏录像、再来一场和返回 Lobby。

收藏仍缺少玩家可操作的录像列表页面；当前可通过 `recordingCtrl.list()` 和 `recordingCtrl.replay(id, checksum)` 验证读回与回放，不能称收藏浏览流程已完成。正式联网未接入。

当前录像格式为 v5，并同时校验战斗配置版本；不兼容的旧收藏使用独立存储键保留，不会被当作新版本录像读取或覆盖。

## 验证

在项目根目录 `D:/project/qqPetFight-game` 执行，TypeScript 模块路径见客户端 AGENTS 规范：

```
node test/gameplay/verify-lockstep.cjs <typescript 模块路径>
node test/gameplay/verify-architecture.cjs
node test/gameplay/verify-recordings.cjs <typescript 模块路径>
node test/gameplay/verify-presentation.cjs <typescript 模块路径>
node test/gameplay/verify-audio.cjs <typescript 模块路径>
node test/gameplay/verify-audio-service.cjs <typescript 模块路径>
node test/gameplay/verify-startup.cjs <typescript 模块路径>
node test/gameplay/verify-result.cjs <typescript 模块路径>
```

分别检查：

- Gameplay 脚本无循环依赖，common 与各业务目录依赖方向正确，View 与 Component 职责边界稳定，代码中不写死业务资源路径。
- Luban 战斗定义、服务帧指令消费、30/60/144 FPS 逐帧一致、40 个种子、乱序/缺帧/重复帧、暂停、库存、技能来源/效果帧/治疗和暂放拾回、远程武器原地投掷及消耗。
- 收藏、重复点击、重载读取、回放数据、引用隔离、损坏存档保护、配额失败重试。测试使用隔离存储。
- 所有图集矩形边界和尺寸、8 种性别/装备/技能组合的每个可达动作都能加载；同时检查脚掌基准、翻转轴和双方攻击层级。
- 音效资源存在、倒计时、事件和结算去重、不同帧率回放声音序列一致、男女配音、脱手刀伤。
- 框架加载：缺少音频目录、并发去重、缓存复用、全局重名检查、失败重试、默认音量和保留静音、音乐播放、音频先于 View 加载。
- 启动：Bootstrap 不运行时引用业务 Schema，业务注册 Tables 工厂；先加载 bundle、注册，再并行加载配置、公共音频和预加载 LoadingView，最后进入大厅。
- 结算：胜负和平局、收藏去重与失败重试、重复开局保护、返回大厅及按钮缩放。

实际原生设备的内存、帧率和触控尚未验证。

## 音频接入状态

此前浏览器预览已确认 19 个 AudioClip 成功解码；本轮新增 8 个武器与技能音效已通过文件和配置校验，仍需在浏览器或真机逐个确认实际解码。背景音乐素材的实际播放仍待接入。

音频按使用业务分类，`Win` / `Lose` 在打开 ResultView 时由 ViewService 加载 `ingame/result/audio`；其他战斗音效仍随 GameplayView 加载。

## 来源与使用边界

官网资源版本、可核实依据和待完成内容见项目根目录 `tool/gameplay/README.md`。

## 动画配置（Luban）

战斗规则、武器、技能、逻辑动作映射、战斗表现、动画描述及对齐偏移来自 Luban；PVE 对战数据由 `PveCampaign` 结合关卡表与玩家接口响应组装。源表位置和生成入口见根目录规范；生成结果统一位于 `bundle/shared/script/schema/Schema.ts` 和 `bundle/shared/config/*.json`。Facade 在进入首个 View 前统一加载配置，GameplayConfig 通过 `configService.tables` 同步读取 Tables；RolePresentation 按表中 fps 播放，使用 `dx + offsetX` / `dy + offsetY` 定位。

## 角色 SpriteAtlas 资源

角色图集使用标准 `.plist`，在生成 Luban 配置时同步输出到 `texture/role`。Excel 仍是帧矩形、帧率和偏移的唯一配置来源；生成的 plist 不手工维护。每帧名称为 `动作ID_四位帧号`。

运行时按本场配装加载 SpriteAtlas，并直接引用导入的 SpriteFrame，不再创建或销毁临时帧。Actor 使用 RAW 尺寸与表中 scale 等比缩放，保留 dx / dy 和 offsetX / offsetY 对齐。场景 Actor 不绑定固定角色帧，运行时在本场资源加载完成后设置对应动画。
