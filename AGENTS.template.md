# 任务看板维护规则（模板）

> **用法**：把本文件复制到你的游戏仓库根目录，改名为 `AGENTS.md`，按项目情况改掉「模块」「提交规范」之类的例子即可。
> 本文件管**任务看板**：谁在做什么、做到哪一步、卡在谁身上。仓库自己的 git / 文档纪律请另写，或在开头加一行指向它。

看板由 DSH 插件 `dsh-gameboard` 维护，数据在仓库 `.gameboard/` 里，随 git 同步。它回答四个问题：

| 问题 | 看板里的字段 |
|---|---|
| 哪些开发完了？ | `stage` = `built` / `tested` / `shipped` |
| 哪些测试过了？ | `test` 门 + 测试报告推导出的结果 |
| 哪些等用户拍板？ | `decision: pending` |
| 哪些要用户手动做？ | `manual: pending` |

在 DSH 里从侧边栏「项目看板」看实时状态；扫描每 60 秒一次，改动看板文件后约 1 秒自动刷新。

---

## 一、三条硬规则

1. **开工前先查、收工前必写。** 动手前用 `gameboard` 工具的 `summary` / `list` 看清现状；只要这次工作改变了任何一项的状态（写完代码、测试通过、发现要用户定的事、发现需要人手动做的事），收工前必须写回看板。
2. **不许替用户拍板。** `decision` 从 `pending` 变成 `decided` 只能由用户本人在面板点击，或在对话里明确授权。智能体只能新建待拍板项、补充问题/选项/影响，或在备注里写建议，**绝不能**自己写 `decision: decided`、`decision_choice`。
3. **一个工作项一个文件，id 就是文件名。** 新增走工具或模板，不要拆项、不要重命名已有 id（等于删一项再新增一项）。

---

## 二、什么时候必须维护看板

| 你做了什么 | 看板要发生的变化 |
|---|---|
| 开始一项新功能 / 新文档 / 新资源 | 没有对应项就新建，`stage` 至少到 `spec` 或 `building` |
| 代码写完了、能跑 | `stage: built`，把 `match` 指向你改的文件，让证据自动对上 |
| 加了测试 / 测试从失败转通过 | 更新 `test`，或确认报告路径已配好让扫描自动推导 |
| 发现只有用户能定的选择（数值口径、范围取舍、风格方向） | 建待拍板项，或给已有项加 `decision: pending` + 问题 + 选项 + 影响 |
| 发现只有人能做的事（真机试玩、素材采购、账号配置、外设测试） | 加 `manual: pending` + 可勾选步骤 + 预估耗时 |
| 被别的任务挡住 | 在备注里写清「卡在什么、等谁」，不要让项停在 `building` 而不说明 |
| 确认某项已发布、上线、交付 | `stage: shipped` |

只做了一件小事（改错别字、单行修复）且不影响任何门时，可以不动看板。

---

## 三、怎么改

**优先用工具**（DSH 里的 `gameboard` 工具，不用碰文件格式）：

| 动作 | 用途 |
|---|---|
| `summary` | 总览：计数、各 area、摘要 |
| `list` | 按 `gate`（decision/manual/test）、`stage`、`area` 过滤 |
| `get` | 单项完整字段 |
| `add` | 新建项（`title` 必填，可带 `area`/`match`/`testMatch`/`stage`/`priority`/`question`/`options`/`impact`） |
| `update` | 改阶段、优先级、标题、证据 glob、待拍板问题 |
| `note` | 往备注追加一条带时间的记录 |
| `scan` | 立刻重扫仓库 |
| `repos` | 列出可切换的仓库；带 `root` 参数则切过去（切错仓库会改到别人的板，先确认） |
| `timeline` | 最近 N 天（默认 7）的里程碑事件、慢于中位的项、停滞项；接手前先看一眼 |

**没有工具时**直接编辑 `.gameboard/board/<id>.md`，格式见第四节。

**不要做**：手改 `.gameboard/.cache/`（会自动重建）；批量重排 front matter 字段顺序；把多个工作项合并进一个文件。

---

## 四、工作项文件格式

路径 `.gameboard/board/<id>.md`，`id` 必须等于文件名去掉 `.md`。

```markdown
---
id: combat.damage-formula
title: 伤害公式与护甲减伤
area: 战斗
stage: built
priority: high
owner: ai
decision: pending
decision_question: 暴击是否采用乘法叠加？
decision_options: ["乘法叠加", "加法叠加", "只取最高"]
decision_impact: 影响全部数值平衡与存档兼容
decision_deadline: 2026-11-12
decision_choice: 
decision_at: 
decision_by: 
manual: none
manual_steps: []
manual_done: []
manual_estimate: 
test: failing
test_report: 
test_match: ["combat.damage"]
match: ["src/combat/**", "docs/design/combat*.md"]
tags: ["数值"]
links: []
created_at: 2026-11-01T10:00:00.000Z
updated_at: 2026-11-05T12:00:00.000Z
updated_by: workstation-A/ai
---

## 备注

自由文本。扫描不会改这段，插件追加记录时加在末尾。
```

### 字段

| 字段 | 取值 | 说明 |
|---|---|---|
| `id` | 小写、点分、可含中文 | 与文件名一致，稳定不改 |
| `title` | 一句话 | 给人看的名字 |
| `area` | 任意 | 模块/领域，如 `战斗`、`设计`、`项目管理`、`音频` |
| `stage` | `idea` `spec` `building` `built` `tested` `shipped` | 开发进度 |
| `priority` | `low` `normal` `high` `urgent` | 缺省 `normal` |
| `owner` | `ai` `human` | 谁在推进 |
| `decision` | `none` `pending` `decided` | 待用户拍板 |
| `decision_question` / `decision_options` / `decision_impact` / `decision_deadline` | 文本 / 数组 / 文本 / 日期 | 只有 `decision: pending` 时有意义 |
| `decision_choice` / `decision_at` / `decision_by` | 由用户操作写入 | **智能体不要写** |
| `manual` | `none` `pending` `done` | 需要用户亲手做 |
| `manual_steps` / `manual_done` / `manual_estimate` | 字符串数组 / 数字数组 / 文本 | 步骤下标从 0 开始，全部勾选后 `manual` 变 `done` |
| `test` | `untested` `failing` `passing` | 有匹配报告时以扫描推导为准 |
| `test_match` | 关键字数组 | 匹配测试用例名或文件路径，子串、大小写不敏感 |
| `match` | glob 数组 | 证据文件，相对仓库根，如 `src/**` |
| `tags` / `links` | 数组 | 标签、外部链接 |
| `created_at` / `updated_at` / `updated_by` | ISO 时间 / `<机器名>/<ai\|user>` | `updated_by` 手工维护时写机器名 |

枚举写错会退回默认值并记一条扫描错误，不会弄挂整块看板，但状态会悄悄不对——改完扫一眼面板。

### 里程碑时间戳（自动，不要手写）

`started_at` / `built_at` / `tested_at` / `shipped_at` / `decided_at` / `manual_done_at` 由插件在状态推进时自动写入，只写第一次、不会后退。它们驱动面板的「时间线」页和卡片上的五步进度条。

- 你只要正常改 `stage` / `test` / `decision` / `manual`，时间戳会跟着生成，**不要手工填写或改写**。
- 跳过阶段（比如 `spec` 直接到 `shipped`）时，中间里程碑会一起记在本次操作时间上。
- 手工编辑文件推进状态时，这些字段不会自动补；需要精确时间线就走工具或面板。

### front matter 规则

- 逐行 `key: value`，不是完整 YAML；数组写在一行，如 `["a", "b"]`。
- 第一个 `---` 开头、第二个 `---` 结束；之后的正文是自由文本。
- 未知字段会保留，不会被删，但也不会显示。

---

## 五、维护时的判断口径

- **`stage: built` 不等于 `test: passing`。** 代码能跑就 `built`，测试通过才 `passing`；两者分开写。
- **`match` 声明的文件一个都不存在时，面板会标「缺失」。** 文件改名或删除后要同步改 `match`，否则误报。
- **只有用户能做的动作才写 `manual`。** 智能体能跑的命令、能点的按钮，不算手动项。
- **待拍板项要写清楚「不定的后果」。** 没有 `decision_impact` 的问题，用户没法判断优先级。
- **一个项只表达一件事。** 「战斗系统」这种大项要拆成伤害公式、技能树、敌人 AI 等可独立判断的子项。
- **不要在备注里写会过期的状态描述**（如「目前进度 60%」），进度靠字段表达，备注写原因和结论。

---

## 六、测试状态怎么接

扫描只认两种报告，路径写在 `.gameboard/config.json` 的 `tests` 里：

```json
{
  "exclude": ["node_modules/**", "dist/**", "**/*.log"],
  "tests": {
    "junit": [".gameboard/reports/junit/*.xml"],
    "json": [".gameboard/reports/vitest.json"]
  },
  "maxFiles": 20000
}
```

- JUnit XML：读 `<testcase>` 的 `name` / `classname` / `file`，内部有 `<failure>` 或 `<error>` 记为失败。
- JSON：兼容 vitest（`testResults[].assertionResults[]`）与简化格式 `{ "tests": [{ "name", "status" }] }`。
- 工作项的 `test_match` 命中任意失败用例 → `failing`；全部通过 → `passing`；一个都没命中 → 保持你写的 `test`，不猜。
- 想让多台机器看到同样的测试结论，就把报告提交进仓库；否则在每台机器本地重新生成。

---

## 七、提交与多机协作

- 看板文件**跟着代码一起提交**，别单独攒着，否则别的机器看到的进度是旧的。
- 时间线会显示「看板提交」和每条里程碑对应的提交；改了没提交的项会标 `dirty`，所以收工提交之后时间线才是完整的。
- 提交信息里写清看板变化，例如 `更新看板：伤害公式完成开发，暴击叠加方案待拍板`。
- `.gameboard/.cache/` 已在 `.gitignore` 里，不要提交。
- 同一工作项被两台机器同时改时，后提交的一方覆盖前者，冲突只落在单个 item 文件里；解决时保留 `id` 与文件名一致。
- `updated_by` 里的机器名用来判断最后改动来自哪台机器；插件会自动写，手工维护时按 `<机器名>/<ai|user>` 写。

---

## 八、常见错误

| 现象 | 原因 |
|---|---|
| 工作项没出现 | 文件名和 `id` 不一致，或缺开头 `---`；看面板的扫描错误 |
| 状态不刷新 | 文件没保存、写到别的 `.gameboard/`、或扫描根不是本仓库 |
| 测试状态一直是 `untested` | `config.tests` 路径不对，或 `test_match` 没命中任何用例 |
| 明明改了却显示「缺失」 | `match` 指向的 glob 已经匹配不到文件 |
| 面板按钮提示「未连接写入通道」 | 页面没拿到写入令牌，刷新页面再试 |
| 待拍板项消失 | 有人把 `decision` 改成了 `decided`；只有用户能这么做，去 git 历史里查 |
