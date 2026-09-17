# Gameplay 单机 Demo

通用开发规范见客户端根目录的 [AGENTS.md](../../../../AGENTS.md)。本文仅记录 Gameplay 的实现、资源与验证方式。

从 Bootstrap 启动，在 Lobby 点击“开始战斗”。玩法节点直接放在场景的 `2d` 下，固定 UI 直接放在 `Ui` 下，不再添加中间容器。

启动时根据 ViewSchema 调用一次 `viewService.preload(ViewKeys.Loading)`，只预加载 LoadingView，不创建节点或执行业务逻辑，也不预加载玩法。点击战斗真正打开 `ingame/loading` 下的 LoadingView 后，才加载玩法并显示场景切换与本场角色、武器、技能的准备进度；完成后销毁加载页，失败可重试或返回大厅。LoadingView 不缓存 View 实例，已加载的玩法资源留在可复用 Controller 中，退出战斗不释放。

## 已接入的演示内容

- 20Hz 本地服务帧、确定性随机数、整局录像和回放校验。
- 模拟接口返回双方名字、性别、生命值、武器列表和技能列表。
- 原版男女企鹅，空手、短剑、红缨枪、小李飞刀。红缨枪使用官方中型武器的站立、跑步、受击和取出姿势。
- 小李飞刀原地投出、直线飞行；消耗服务器响应里的库存，不做近战接近。
- 依次取武器、接近、出招、投掷、归位；矿泉水回血、佛山无影脚、企鹅吼。
- 无影脚按官方配置先暂放手中武器，出招后拾回；暂放不增加库存。
- 喝水和企鹅吼可持械使用；动画有空手、短剑、红缨枪版本。
- 动画统一脚掌基准和翻转轴，不再按阴影或武器边界对齐；整段动作只平移，保留跑步步态、抬脚和技能腾空。
- 图集保留官方外层动作缩放及帧原点，合并重复图片但不删除时间轴帧；按本场角色、武器、技能加载可达动作。
- 武器栏、技能栏根据返回数据实例化 `WeaponCell`、`SkillCell` 通用项。
- 原版 19 个战斗音效，通过 AudioController 消费逻辑事件；重复帧不重复播放，男女配音来自响应，投掷脱手后保留正确刀伤声，卷轴出现时播放胜负声音。
- “收藏录像”保存完整战斗数据、连续服务帧和最终校验值到本机；同局重复点击不重复保存。存储损坏或配额不足不会静默覆盖原存档。

这不是完整复刻验收：目前只有三把武器、三个技能。触发概率、威力、先后手等仍为明确标注的 Demo 参数，不冒充官网服务器公式；完整武器技能、强化、连击反击、背景音乐和结算奖励还没有全部实现。

## 素材分类

- `texture/role`：男女角色的 118 张动作图集；4412 个时间轴帧条目由 shared 下的 Luban 配置表生成。
- `texture/ui`：状态栏、男女头像、血条和玩法按钮。
- `texture/skill`：技能图标。
- `texture/weapon`：短剑、红缨枪、小李飞刀图标，库存、落地和投掷表现共用。
- `texture/courtyard.jpg`：背景直接放 texture 根目录。
- `audio`：战斗音效；胜负结算音效归属 `../result/audio`。
- `../result`：独立结算业务，包含 script、prefab、texture/ui 和 audio；结算图片不再放在玩法 UI 目录。
- `prefab/WeaponCell.prefab`、`prefab/SkillCell.prefab`：无具体图标的动态项模板。

## 代码职责

- `GameplayView`：协调对战数据、资源准备、开局与回放。
- `GameplayComponent`：Cocos 引用、被动状态、动态按钮绑定与转发。
- `BattleController` / `battle`：模拟接口、服务帧、独立战斗状态及录像。
- `PresentationController`：按对战数据加载动作和头像。
- `BattlePresentation`：播放帧、飞行和落地武器、伤害数字，不计算伤害。
- `WeaponController` / `SkillController`：按返回列表生成对应项及更新库存、消耗状态。
- `AudioController`：处理事件声音、倒计时及重复帧去重。
- `UiController`：处理固定 UI 输入、数据显示及结算打开时机。
- `../result/script/ResultView` / `ResultController`：独立结算弹窗，处理胜负展示与声音、收藏录像、再来一场和返回 Lobby。
- `RecordingController`：本机收藏，最多 20 条；满额或存储损坏时拒绝覆盖。

收藏仍缺少玩家可操作的录像列表页面；当前可通过 `recordingCtrl.list()` 和 `recordingCtrl.replay(id, checksum)` 验证读回与回放，不能称收藏浏览流程已完成。正式联网未接入。

## 验证

在本 Gameplay 目录执行，TypeScript 模块路径见根目录规范：

```
node test/gameplay/verify-lockstep.cjs <typescript 模块路径>
node test/gameplay/verify-recordings.cjs <typescript 模块路径>
node test/gameplay/verify-presentation.cjs <typescript 模块路径>
node test/gameplay/verify-audio.cjs <typescript 模块路径>
node test/gameplay/verify-audio-service.cjs <typescript 模块路径>
node test/gameplay/verify-startup.cjs <typescript 模块路径>
node test/gameplay/verify-result.cjs <typescript 模块路径>
```

分别检查：

- 30/60/144 FPS 逐帧一致、40 个种子、乱序/缺帧/重复帧、暂停、库存、技能来源/效果帧/治疗和暂放拾回、飞刀原地投掷及消耗。
- 收藏、重复点击、重载读取、回放数据、引用隔离、损坏存档保护、配额失败重试。测试使用隔离存储。
- 所有图集矩形边界和尺寸、8 种性别/装备/技能组合的每个可达动作都能加载；同时检查脚掌基准、翻转轴和双方攻击层级。
- 音效资源存在、倒计时、事件和结算去重、不同帧率回放声音序列一致、男女配音、脱手刀伤。
- 框架加载：缺少音频目录、并发去重、缓存复用、全局重名检查、失败重试、默认音量和保留静音、音乐播放、音频先于 View 加载。
- 启动：Bootstrap 不运行时引用业务 Schema，业务注册 Tables 工厂；先加载 bundle、注册，再并行加载配置、公共音频和预加载 LoadingView，最后进入大厅。
- 结算：胜负和平局、收藏去重与失败重试、重复开局保护、返回大厅及按钮缩放。

实际原生设备的内存、帧率和触控尚未验证。

## 音频接入状态

浏览器预览已确认 19 个战斗 AudioClip 成功解码，背景音乐素材的实际播放仍待接入。

音频按使用业务分类，`Win` / `Lose` 在打开 ResultView 时由 ViewService 加载 `ingame/result/audio`；其他战斗音效仍随 GameplayView 加载。

## 来源与使用边界

官网资源版本、可核实依据和待完成内容见项目根目录 `tool/gameplay/README.md`。

## 动画配置（Luban）

全部动画描述及对齐偏移使用 Luban 源表：角色动画、角色序列帧、脚底基准、脚底采样。源表位置和生成入口见根目录规范；生成结果统一位于 `bundle/shared/script/schema/Schema.ts` 和 `bundle/shared/config/*.json`。Facade 在进入首个 View 前统一加载配置，PresentationController 通过 `configService.tables` 同步获取 Tables；BattlePresentation 按表中 fps 播放，使用 `dx + offsetX` / `dy + offsetY` 定位。

## 角色 SpriteAtlas 资源

角色图集使用标准 `.plist`，在生成 Luban 配置时同步输出到 `texture/role`。Excel 仍是帧矩形、帧率和偏移的唯一配置来源；生成的 plist 不手工维护。每帧名称为 `动作ID_四位帧号`。

运行时按本场配装加载 SpriteAtlas，并直接引用导入的 SpriteFrame，不再创建或销毁临时帧。Actor 使用 RAW 尺寸与表中 scale 等比缩放，保留 dx / dy 和 offsetX / offsetY 对齐。场景中绑定默认待机帧，编辑时也能定位对应资源。
