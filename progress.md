# 进度日志

## 2026-04-22

- 已读取两份参考规划文档。
- 已创建独立实现根目录 `<repo-root>`。
- 已建立任务计划、发现记录和进度日志文件。
- 已完成 `knowledge/` 目录、基础文档、模板和首批通用知识内容。
- 已完成图谱生成脚本、静态图谱页和 Node 原生最小测试。
- 已完成构建、测试和浏览器烟测，并清理临时服务日志。
- 已对照参考目录完成图谱交互形态调研，确认后续若继续改造，重点应从“关系板”切换为“交互式画布图谱”。
- 用户已确认本轮只做 `MVP 交互画布`，准备进入设计确认阶段。
- 用户已确认设计第 1 部分：保留现有知识源和生成器主干，只把阅读层改成交互式图谱画布。
- 用户已确认设计第 2 部分：页面改为顶栏 + 图谱画布 + 右侧抽屉，交互流以搜索、点选、高亮、项目视角切换为主。
- 已完成交互式 SVG 图谱画布的首轮实现，并补上画布运行时 helper 与页面壳子测试。
- 浏览器烟测发现本地静态服务器未为 `.mjs` 返回正确 MIME，已修复并新增回归测试。
- 已完成最终验证：`npm test` 通过，图谱数据已重新生成，浏览器内已验证节点点击、搜索、筛选、项目视角切换、节点拖拽、画布缩放和平移。
- 已为页面补充内联 favicon，消除本地预览时的额外 404 控制台噪音。
- 用户已确认新的 UI 方向为“展示型信息画布 + 平衡型密度 + 混合型节点语法 + 混合型详情抽屉”。
- 已新增本轮 UI 重构设计文档与实现计划，准备按 TDD 只改阅读层。
- 已完成页面层 UI 重构：顶部工具带收敛、节点类型视觉语法重建、详情抽屉拆分为展陈区和结构区。
- 已完成浏览器烟测，确认搜索、项目视角切换、节点点击、分数展示、拖拽、缩放、平移未回退。

## 2026-04-28

- 已新增 `pk:auto-crystallize` / `pk:pk-auto-crystallize` 自动结晶入口。
- 自动结晶会在命中已有 practice 时把推荐 option 记为 adopted；未命中 practice 但存在 touched files 时，会创建孵化 practice 和候选 option。
- 已补充自动结晶测试，并把完整测试套件扩展到 57 个用例。
- 已将 pk 插件版本提升到 `0.1.5` 并重新执行 `npm run codex:install`。
- 已优化图谱画布节点标题布局：长标题改为 SVG `tspan` 多行显示，超长标题截断，避免溢出节点边缘。
- 已刷新外部样例项目的 `.project-knowledge/graph`，确认长标题所在图谱使用新的标题布局资源。
- 已修复项目扫描文档入口污染：`docs/plans`、根目录 planning 文件、嵌套 README 不再进入 `doc_entrypoints`。
- 已定向清理外部样例项目 `.project-knowledge/project-profile.md` 中旧规则写入的 planning 文档入口，并重建图谱。

## 2026-04-29

- 已修复“集中配置入口”误关联过多 links 的根因：扫描器不再把页面级 `src/views/**/config.ts` 或 `public/**/config.js` 当成项目级配置模块。
- 外部样例项目当前未发现真实集中配置模块，已移除旧的 `option-centralized-config` / `rule-centralized-config-default`，配置管理实践回到孵化区，只保留 6 个内联配置证据。
- 已重建外部样例项目 `.project-knowledge/graph`，并把 pk 插件安装状态更新到 `0.1.8`。
- 已修复自动结晶过度业务化的问题：长周期自动同步类任务会沉淀为“长周期自动任务应使用登录态就绪后的全局调度器”，业务名只保留在 session/evidence 中。
- 已为 preflight 增加中文关键短语匹配，验证“自动同步任务不要绑在页面生命周期里，登录后通过全局调度器执行”能命中该通用实践。
- 已将外部样例项目旧的业务化实践迁移为通用孵化 practice + option，并把 pk 插件版本更新到 `0.1.9`。
- 已为 `pk:preflight` 增加上下文预算：默认最多返回 5 个匹配 practice、每个节点 5 条 evidence 预览、扫描 hint 每类 5 条，并返回总数与截断标记。
- 已优化扫描器内存占用：不再一次性缓存所有代码/Markdown 内容，改为按需逐个读取文件内容做特征判断。
- 已把 pk 插件版本更新到 `0.1.10`，并验证外部样例项目未命中扫描路径只返回 20 条 hint 预览、总数 13485、`evidenceHintsTruncated: true`。
- 已修复未初始化项目的自动知识流程：缺少 `.project-knowledge/project-profile.md` 时，`pk:preflight` 保持 `no-knowledge` 且不扫描代码，`pk:auto-crystallize` 返回 `no-knowledge` 并跳过结晶，不创建 `.project-knowledge/`。
- 已把 pk 插件版本更新到 `0.1.11`。

## 2026-04-30

- 已补齐知识生命周期治理：孵化节点达到 3 次采纳阈值后会在图数据中标记为 `promotion_candidate`，并记录 `adopted-threshold-met` 原因。
- 已补齐推荐池淘汰提示：每个 practice 在每个项目视角下最多保留 3 个推荐 option，排位外 option 写入 `evicted_option_ids` 供治理使用。
- 已扩展 `pk:pk-lint`：新增 `incubating-promotion-candidate`、`recommendation-pool-eviction-candidate`、`possible-duplicate-node` 三类只读治理 issue。
- 已将根脚本同步到 `plugins/pk/scripts/`，更新 README、根 `SKILL.md`、`pk-lint` skill 和插件 manifest。
- 已把 pk 插件版本更新到 `0.1.12` 并重新执行 `npm run codex:install`。
- 验证结果：目标测试 13/13 通过，完整 `npm test` 66/66 通过。
- 已新增自动治理设计与实施计划：`docs/plans/2026-04-30-auto-governance-design.md`、`docs/plans/2026-04-30-auto-governance-implementation.md`。
- 已新增 `pk:govern` / `pk:pk-govern`：自动把达到阈值且未打回的孵化节点转正，把推荐池排位外方案退回孵化区，把强重复节点标记为 `duplicate_of` 并打回。
- 已增强 `pk:serve`：新增 `POST /api/governance/reject`，图谱页可以通过本地服务把节点打回孵化区。
- 已增强图谱详情抽屉：展示治理状态，并为非项目画像节点提供“打回孵化”按钮。
- 已调整 lint：`review_status: rejected` 节点不再反复出现在转正和重复治理候选中。
- 已将 pk 插件版本更新到 `0.1.14`，准备重新执行 `npm run codex:install`。
- 验证结果：本轮目标测试 34/34 通过，完整 `npm test` 75/75 通过。

