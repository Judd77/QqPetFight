# 乐斗切磋

Lobby 的“乐斗切磋”打开 MatchingView。准备主角头像后等待 3 秒，由 LocalPvpGateway 返回女企鹅 mm，显示匹配成功 1 秒后打开 LoadingView，再进入 GameplayView。

- MatchingComponent 只获取固定节点和转发点击；MatchingController 负责状态、取消、失败重试及进场。
- 主角来自 PlayerGateway；当前对手是离线接口数据，不是真实联网匹配。配装与数值为当前演示调校，不代表官网服务器数据。
- 关闭后忽略异步返回。头像成功加载后缓存，退出不释放；加载失败允许重试。
- 切磋结算提供“再次匹配”，不读取或修改 PVE 十关进度。
- 固定 UI 保存在 prefab，使用官网 task.png 卷轴和 sprite7.jpg 按钮素材重新组合，并非宣称官网存在相同的匹配页面。素材导出见项目根目录 tool/gameplay/export-menu-ui.py。
