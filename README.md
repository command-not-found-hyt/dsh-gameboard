# dsh-gameboard · 项目看板

给 DSH（DeepSeek Harness）用的游戏项目状态板插件。

多终端、多智能体一起做游戏时，最难回答的四个问题它一直摆在桌面上：

| 问题 | 看板里的答案 |
|---|---|
| 哪些开发完了？ | `stage` = `built` / `tested` / `shipped` |
| 哪些测试过了？ | `test` 门，以及从 JUnit / Vitest 报告推导出的结果 |
| 哪些等你拍板？ | `decision: pending`，带问题、选项、影响、截止时间 |
| 哪些要你手动做？ | `manual: pending`，带可勾选步骤和预估耗时 |

数据不在插件里，而在**游戏仓库的 `.gameboard/` 目录**，随 git 走：换机器、换终端、换智能体，看到的是同一块板。

## 它是怎么工作的

```
游戏仓库/
├─ .gameboard/
│  ├─ config.json          # 扫描排除项、测试报告路径
│  ├─ board/<id>.md        # 一个工作项一个文件，人可读、git 可合并
│  └─ .cache/              # 本机扫描缓存，已 gitignore
└─ src/ docs/ tests/ ...   # 扫描证据：代码、文档、测试报告
```

- **Host 半**：定时扫描仓库（默认 60 秒）+ 监听 `.gameboard/` 变化；解析工作项和测试报告，生成快照。
- **多仓库**：面板顶部可以直接切换仓库；候选包括当前仓库、配置里的 `roots`，以及 DSH 已打开的工作区。
- **Web 面板**：侧边栏「项目看板」→ 概览 / 待处理 / 看板 / 时间线 / 变更。
- **时间线**：每个工作项自动记录创建 / 开始 / 开发完成 / 测试通过 / 发布 / 拍板 / 手动完成的时间点，外加看板提交记录；支持按领域、事件类型、时间范围筛选，显示相邻里程碑用时、平均周期与停滞天数。
- **泳道视图**：同一批数据换成每项一条泳道，横轴是时间，圆点是里程碑，一眼看出哪项卡住、哪项跨度异常。
- **偏离检测**：按里程碑之间的用时算中位数，明显慢于中位（超过 2 倍且至少 1 天）的项会在时间线上标出来。
- **Git 关联**：每次扫描读一次 `git log`，把工作项文件的历史提交挂到对应事件上；没提交的改动会标为 dirty。
- **AI 工具 `gameboard`**：`summary` `list` `get` `add` `update` `note` `scan` `repos` `timeline`，让智能体自己维护看板、切换仓库、读最近发生了什么。
- **规则模板**：[`AGENTS.template.md`](AGENTS.template.md)，复制到项目根目录，任何智能体开工前读它就知道怎么维护。

## 安装

需要 DSH（桌面版或 CLI）以及一个游戏项目仓库。

```bash
git clone https://github.com/command-not-found-hyt/dsh-gameboard.git
```

然后在 DSH 里安装这个目录：用插件管理器的 `install_bundle`，target 填克隆下来的绝对路径；或者在 DSH 的插件页选择「安装本地插件」并选中该目录。侧边栏出现「项目看板」图标即安装成功。

安装后在**游戏仓库根目录**建看板：

```bash
mkdir -p .gameboard/board
```

也可以在面板的空状态里直接点「初始化看板」。

## 指向你的游戏仓库

默认扫描**当前工作区**。要固定到别的目录，二选一：

1. 插件行配置（写进 profile 的 `cordis.patch.yml`）：

   ```yaml
   - insert:
       - id: gameboard
         name: 'dsh-gameboard'
         config:
           root: 'D:\MyGame'
   ```

2. 机器本地配置（推荐：不进仓库，重装插件也不丢）。在 `<profile>/gameboard.json` 写：

   ```json
   { "root": "D:\\MyGame" }
   ```

优先级：插件行 `config` > `GAMEBOARD_ROOT` 环境变量 > `gameboard.json` > 当前工作区 > 进程目录。

### 切换仓库

面板标题栏的「仓库」下拉框列出所有可切换的仓库，选项后面是工作项数量；未初始化 `.gameboard` 的仓库会标出来，切过去可以直接点「初始化看板」。切换结果会写进 `gameboard.json`（`activeRoot`），重开面板或重启 DSH 都保持。

候选来源（自动合并去重）：

1. 当前激活的仓库；
2. `roots` 配置（插件行 `config.roots` 或 `gameboard.json` 的 `roots` 数组）；
3. DSH 已打开的所有工作区。

想让某个仓库固定出现在下拉框里，把它加进 `roots`：

```json
{
  "activeRoot": "D:\\MyGame",
  "roots": ["D:\\MyGame", "D:\\AnotherGame"]
}
```

智能体也能切换：`gameboard` 工具 `{"action":"repos"}` 列仓库，`{"action":"repos","root":"D:\\MyGame"}` 切换。

## 工作项格式

`.gameboard/board/combat.damage-formula.md`：

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

| 字段 | 取值 | 说明 |
|---|---|---|
| `id` | 字符串 | 必须等于文件名（去掉 `.md`），稳定不改 |
| `title` / `area` | 字符串 | 标题、模块（如 `战斗`、`工程`、`项目管理`） |
| `stage` | `idea` `spec` `building` `built` `tested` `shipped` | 开发进度 |
| `priority` | `low` `normal` `high` `urgent` | 默认 `normal` |
| `owner` | `ai` `human` | 谁在推进 |
| `decision` | `none` `pending` `decided` | 待用户拍板 |
| `decision_question` / `_options` / `_impact` / `_deadline` | 文本 / 数组 / 文本 / 日期 | 只有 `pending` 时有意义 |
| `decision_choice` / `_at` / `_by` | — | **只能由用户写入**，智能体不得代填 |
| `manual` | `none` `pending` `done` | 需要人亲手做 |
| `manual_steps` / `manual_done` / `manual_estimate` | 数组 / 下标数组 / 文本 | 全部勾选后自动转 `done` |
| `test` | `untested` `failing` `passing` | 有匹配报告时以扫描结果为准 |
| `test_match` | 关键字数组 | 匹配测试用例名或文件路径，子串、大小写不敏感 |
| `match` | glob 数组 | 证据文件，相对仓库根；声明了却匹配不到会标「缺失」 |
| `tags` / `links` | 数组 | 标签、链接 |
| `updated_by` | `<机器名>/<ai\|user>` | 最后写入来源，用于多机排查 |
| `started_at` `built_at` `tested_at` `shipped_at` `decided_at` `manual_done_at` | ISO 时间 | 里程碑，插件在状态推进时自动写入，只写一次、不后退 |

front matter 是逐行 `key: value` 的简化 YAML：数组写在一行，标量不做类型转换，未知 key 会保留不报错。

## 配置

`.gameboard/config.json`（可提交，全队共享）：

```json
{
  "maxFiles": 20000,
  "exclude": ["referenceGame/**", "封存/**", ".workbuddy/**", "node_modules/**", "dist/**", "**/*.log"],
  "tests": {
    "junit": [".gameboard/reports/junit/*.xml"],
    "json": [".gameboard/reports/vitest.json"]
  }
}
```

插件行可选项：`boardDir`（默认 `.gameboard`）、`scanIntervalSec`（默认 60，最小 10）、`watch`（目录监听）、`promptDigest`（把摘要注入 AI 系统提示词）、`maxFiles`、`machine`（写入记录里的机器名）、`token`（固定写入令牌）、`git`（默认开启）、`gitBin`（git 可执行文件路径）。

## Git 关联

扫描时会读一次仓库最近 300 条提交（`git log --name-only`），然后：

- 把**改过该工作项文件的提交**挂到工作项上（最多 5 条），时间线里作为「看板提交」出现；
- 给每个里程碑找**时间最接近的那次提交**，在时间线上显示短 hash，悬停看提交信息；
- 工作项更新时间晚于最后一条提交时标 `dirty`（改了还没提交）。

找不到 git、不是 git 仓库、或命令超时（5 秒）时自动降级，只是没有 git 信息，不影响其它功能。git 不在 PATH 里时用 `gitBin` 指定绝对路径，例如 GitHub Desktop 自带的：

```json
{
  "gitBin": "C:\\Users\\you\\AppData\\Local\\GitHubDesktop\\app-3.6.10\\resources\\app\\git\\cmd\\git.exe"
}
```

## 测试状态怎么来

- **JUnit XML**：读 `<testcase>` 的 `name` / `classname` / `file`，内部有 `<failure>` / `<error>` 记为失败。
- **JSON**：兼容 vitest（`testResults[].assertionResults[]`）和简化格式 `{ "tests": [{ "name", "status" }] }`。
- 工作项的 `test_match` 命中任意失败用例 → `failing`；全部通过 → `passing`；一个都没命中 → 保留你写的 `test`，不猜。

## 面板

标题栏右侧是仓库下拉框（显示工作项数量，未初始化的会标出来），旁边是「刷新仓库列表」和「立即扫描」。

- **概览**：四张卡（已完成开发 / 已测通过 / 待你拍板 / 待你手动）+ 测试失败、缺失文件、按 area 的进度条。
- **待处理**：按「待拍板 > 待手动 > 测试失败」排序，拍板项可直接点选项记录，手动项可勾步骤。
- **看板**：按 `stage` 分列。
- **时间线**：所有工作项的里程碑按天倒序排列，可按领域、事件类型（进度 / 测试 / 拍板 / 看板提交）、时间范围（7 / 30 天 / 全部）筛选，可只看未完成；顶部汇总事件数、平均交付周期和停滞事项。卡片上也有一条五步进度条（创建 → 开始 → 开发完成 → 测试通过 → 发布），悬停看时间和相邻步用时，超过 7 天没动的项会带「停滞 N 天」徽标。
- **时间线 · 泳道**：右上「视图」切到泳道，每项一条时间轴，圆点是已发生的里程碑，竖线是今天；跨度异常的项目会进入上方「慢于中位」提示。
- **变更**：最近的新增、状态变化、测试失败/修复。

写操作需要页面里的写入令牌（Host 自动注入）。要在脚本里调用就固定插件配置里的 `token`：

```bash
curl -X POST http://127.0.0.1:<port>/gameboard/action \
  -H 'content-type: application/json' \
  -H 'x-gameboard-token: <token>' \
  -d '{"op":"scan"}'
```

接口：`GET /gameboard/snapshot` 返回完整快照（含 `insights`：各阶段用时中位数、偏离项、停滞项）；`POST /gameboard/action` 支持 `init` `scan` `add` `set` `decide` `manual-step` `manual-set` `repos` `select-root`。

智能体读时间线用工具而不是抓接口：

```json
{ "action": "timeline", "days": 7, "limit": 30 }
```

返回最近 7 天的事件（按时间倒序）、`slow`（慢于中位的项）和 `stalled`（停滞项）。

## 给智能体的规则

把 [`AGENTS.template.md`](AGENTS.template.md) 复制成项目根目录的 `AGENTS.md`，写清三件事：

1. **开工先查、收工必写**：状态变了就写回看板；
2. **不许替用户拍板**：`decision: decided` 只能由用户写；
3. **一个工作项一个文件，id 即文件名**。

DSH 的 AI 摘要会自动提示「维护规则见扫描仓库根目录的 AGENTS.md」，即使某个终端没加载仓库指令也能被指到。

## 多机协作

- 看板跟代码一起提交，别单独攒着；
- `.gameboard/.cache/` 必须 gitignore；
- 同一工作项被两台机器同时改时后提交者覆盖，冲突只落在单个文件；
- `updated_by` 里的机器名用来判断最后改动来自哪里。

## 开发

```bash
# 单元测试（Node 18+）
node --test lib/scan.test.mjs
```

`demo/` 是一个可直接扫描的示例仓库（3 个工作项 + 1 份 JUnit 报告），把插件 `root` 指向 `demo/` 就能看到完整效果。

代码结构：

| 文件 | 职责 |
|---|---|
| `index.js` | Host：扫描调度、原子写入、HTTP 接口、`gameboard` 工具、系统提示词摘要 |
| `client.js` | Web 面板（React，经 DSH 的 slot 机制挂载） |
| `lib/board.js` | front matter 解析/序列化、Item 规范化、统计、AI 摘要 |
| `lib/scan.js` | 仓库遍历、glob、JUnit/JSON 报告解析、缓存、变更 diff |
| `lib/scan.test.mjs` | 13 个单元测试 |

## License

[MIT](LICENSE)
