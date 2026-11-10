# BoxBox

[English](README.md) | [한국어](README.ko.md) | [简体中文](README.zh-CN.md)

本文所链接的详细文档目前主要使用英语。

**纵向读代码，横向作比较。**

本项目将重复的代码视为电子表格：每条承担相同角色的语句是一行，对应的组成部分是列。它帮助编程智能体简化不一致的结构，再将剩余的语法元素对齐成紧凑、易读的网格。

```typescript
// Before
const name = "deploy";
const retries = 3;
const timeoutMs = 1000;

// After
const name      = "deploy" ;
const retries   = 3        ;
const timeoutMs = 1000     ;
```

上面的对齐示例是 TypeScript 引擎的实际输出，并由测试保证。目前自动写入的范围有意保持狭窄：只有少数已批准的规则，其他大多数模式只报告，不修改。名称、值和执行顺序保持不变；对应的语法元素变得更容易比较。

产品名称是 **BoxBox**；核心 CLI、技能和插件的 ID 为 `boxbox`（于 2026-10-16 确认）。公开 npm 安装包是 [`boxbox-plugin`](https://www.npmjs.com/package/boxbox-plugin)，使用 `npx boxbox-plugin` 安装。请参阅 [Windows 插件安装指南](product/installer/README.md)。

| 关键事项 | BoxBox 0.2.8 |
| --- | --- |
| 确定性语言处理范围 | TypeScript、Python、严格 JSON 和 YAML 1.2 |
| 默认写入批准 | 5 条刻意保持狭窄的约定 |
| 引擎和钩子的模型调用 | **0 次** |
| npm 下载 | 压缩后 384,104 字节；解压后 607,186 字节 |

BoxBox 不是通用格式化工具，也不会让模型判断字节是否得到保留。引擎在本地完成测量、规划、解析和
验证。只有真正需要判断的工作才使用智能体：Write、Refactor，以及可选的只读 inspector。

## 为什么将代码组织成网格？

重复的代码往往以不同的数据表达相同的操作。按段落阅读时，每一行都需要单独理解。按表格阅读时，差异便一目了然。

- 纵向比较标识符、类型、参数和值。
- 根据实际内容，为每组代码确定各自的列宽。
- 将不同职责分开，而不是强行放进同一张表。
- 先简化过长的特殊行，避免它拉宽其他所有行。

目标是形成一致的结构，帮助你自上而下理解程序。

## 简化、对齐、验证

### 1. 简化结构

技能会引导智能体检查重复的行及使用它们的代码。智能体会提出建议，消除不必要的包装、重复的表达式，或让表格变宽的实现细节。结构性修改仍由智能体和人共同决定。

### 2. 对齐可比较的行

确定性引擎会将支持的连续结构分组，并对齐其语法边界。空行、缩进和不兼容的行结构构成分组边界。每组都有自己的最小列宽。

支持的模式包括声明、赋值、导入、对象条目和部分调用。覆盖范围取决于语言和模式；引擎不会对所有可能的结构进行分类。

### 3. 写入前验证修改

对齐阶段只修改空白字符。替换文件之前，它会检查内容保留情况并比较解析器诊断结果。无法确定的结构分解、不可用的解析器和不安全的文件状态，都可能导致它拒绝写入。

公开的 `format` 命令要求完整的人工批准证据。如果项目配置了格式化器，它会先运行该格式化器，再验证解析结果、检查规则批准情况并执行对齐。未配置格式化器时，它会直接对齐已批准的模式。整个流程运行两遍，以验证结果达到不动点，随后仅替换目标文件一次。外部格式化器所做的修改不属于对齐阶段“仅修改空白字符”的保证范围。

## 编写、重构、对齐与检查

BoxBox 0.2.8 区分智能体工作流程与引擎修改范围：

- **Write — 编写：** 智能体参考已批准的编写指导，实现所请求的功能。
- **Refactor — 重构：** 智能体改进现有结构，并单独验证行为以及相关性能。
- **Align — 对齐：** 引擎只调整已批准的水平布局空白，不换行、不改变缩进，也不运行外部格式化器。
- **Check — 检查：** 检查现有代码而不修改它。未检测到分组不代表整个文件的风格已通过验证。

`guide --file <file> --authoring --json` 为现有文件、空文件或尚未创建的文件提供已批准的指导；
示例是编写指导，不是该文件的写入批准证据。`align --file <file> --dry-run --json` 预览对齐结果，
`align --file <file> --json` 应用对齐。Write 和 Refactor 由宿主智能体执行，不是 CLI 代码生成命令。
预览不会修改目标；现有的 `format` 流程仍是独立操作。
Check 和 Format 还支持重复的 `--file` 或有界递归 `--directory` 选择。配置格式化器后，Check 在工作副本上
验证“格式化器之后再运行 BoxBox”的最终字节，并区分原始源码检查结果与 `canonical` 验证。批量格式化对每个
文件分别原子执行；其他文件失败时，仍报告此前已完成的写入。按分组选择写入仍暂缓实现。会话钩子默认使用只读
`check`；只有显式选择 `boxbox mode align`，才会在匹配的工具调用后执行已批准的水平空白对齐。Stop 保持只读。
参见[工作流程选择与验证限制](docs/user/modes.md)。

CLI 现在可以检查 TypeScript、Python、严格 JSON 和 YAML 1.2，并将语法状态报告为 valid、invalid 或
parser error。JSON/YAML 对齐范围刻意限制为：
同一层级中至少三个相邻的单行标量映射条目。引擎会单独报告不支持的行，并保持其原样。
YAML 块标量、锚点、别名、标签、复杂键、流式集合、序列、指令和文档标记不在本次对齐范围内。
结构化文档的 Align 引擎路径已经实现，但推荐预设仍只授权下述 TypeScript 和 Python 规则写入；
JSON/YAML 写入需要完整的本地批准证据或未来单独批准的预设规则。

## 安装插件

需要 Node.js 22.22.3 或更高版本、npm，以及 Codex 或 Claude Code CLI。公开安装器会为检测到的每个宿主安装插件和本地 Node 引擎。详情请参阅
[安装指南](product/installer/README.md)。

```sh
npx boxbox-plugin
```

重启宿主，然后让它用 BoxBox 对齐文件。将本仓库添加为 Claude 或 Codex 市场时，只会安装插件而没有引擎：命令会显示设置提示并停止，检查也不会运行：钩子不会阻止操作，只有会话钩子会输出该提示。如果已经这样添加，请先运行你所用宿主对应的命令删除该注册，再运行安装器：

```sh
claude plugin uninstall boxbox@boxbox-plugins --scope user
claude plugin marketplace remove boxbox-plugins
codex plugin marketplace remove boxbox-plugins
```

在 Windows 上，请将通配符替换为压缩包的完整路径，详见安装指南。**如果你的项目使用代码格式化工具：** Prettier、Black 和 Ruff 的格式化器会在其重写的文件中撤销 BoxBox 的对齐。为语言配置一个格式化器，再让编辑器、钩子和 CI 调用 BoxBox 的 `format` 和 `check`，而不是直接运行格式化器。它们支持重复的 `--file` 或 `--directory` 选择，并为每个文件保留整文件批准条件。之后直接运行格式化器仍可能撤销对齐。当项目根目录的配置显示存在格式化工具时，`doctor`、`init`、`align` 和 `format` 会发出警告。

检出仓库只在构建时需要。安装后的插件使用其永久安装的 Node 引擎。
公开安装器需要 Node.js 22.22.3 或更高版本以及 npm；Python 检查和格式化还需要可运行的 `python3`。

## BoxBox 重吗？

简短回答：下载很小，安装后占用空间的主要部分是 TypeScript 工具链。

以下数字来自公开的 `boxbox-plugin@0.2.8` 在干净、隔离的 macOS arm64 环境中的实测快照。
不同平台的 npm 元数据和原生 TypeScript 包大小可能不同，因此这些数字不是跨平台保证。

| 测量项目 | 大小 |
| --- | ---: |
| npm tarball | 384,104 B (375.1 KiB) |
| npm 报告的解压包，42 个文件 | 607,186 B (0.58 MiB) |
| Codex 永久安装 | 30,984,814 B (29.55 MiB) |
| Claude 永久安装 | 30,986,310 B (29.55 MiB) |
| 每个宿主新增的插件缓存 | 约 0.10 MiB |
| 隔离安装使用的全新 npm 下载缓存 | 27.80 MiB |
| 包含 npm 缓存的双宿主隔离测试目录总计 | 87.10 MiB |

每个宿主永久安装中约 26.22 MiB 来自固定版本的原生 TypeScript 7 包。Codex 与 Claude 使用独立的
永久运行时，因此修复或移除一个宿主时不会暗中改变另一个宿主。安装一个宿主永久占用约 29.55 MiB；
两个宿主约 59.1 MiB，另加可复用的 npm 下载缓存。

在同一台 Apple M1 工作站上，对一个三行 TypeScript 文件执行 10 次 warm process 检查耗时
248–475 ms，中位数 266 ms，平均 298 ms。这是小文件的启动成本测量，不是大型项目基准。
钩子成本会随实际检查的已修改文件数量增长。

## 会消耗多少 AI token？

BoxBox 有两条成本性质完全不同的路径：

- **引擎命令和 lifecycle 钩子：** `check`、`guide`、`align`、`format`、`doctor`、更新检查、状态输出
  和会话 receipt 都不会调用模型，因此直接 AI token 成本为 **0**。
- **智能体工作流：** Write 和 Refactor 使用宿主中已经运行的模型。用量取决于任务、仓库和宿主；
  BoxBox 不宣称固定的 token 节省比例。
- **可选 Claude inspector：** 只有在委派时才消费模型 token，是独立的只读 subagent。生成的 0.2.8
  定义目前指定 Sonnet 和 medium effort，但这仍是 `unevaluated-default`，不是经过证明的最优值。
  发布的 Codex 插件不包含 inspector agent。

安装后的 `SKILL.md` 为 16,644 字节。技能与全部四份参考文档合计 92,343 字节。按每 token
约四个字符粗略换算，分别约为 4.2K 和 23K token；实际数量取决于宿主 tokenizer、实际打开的
参考文档和 prompt cache 复用情况。这些是上下文大小估算，不是计费数据。

一项使用单个 228 行 TypeScript 文件的六次 Claude pilot，对比了继承的 Opus 5.5 和
Sonnet 5 inspector：

| pilot 结果 | 继承的 Opus | Sonnet inspector |
| --- | ---: | ---: |
| 平均显示会话成本 | $0.7244 | $0.6107 |
| 平均耗时 | 107 秒 | 177 秒 |
| 平均 inspector turn | 4.3 | 8.7 |
| 平均 inspector 输出 token | 8,070 | 12,230 |
| 平均指向的可修复分组 | 6.7 / 8 | 7.7 / 8 |

Sonnet 的平均显示成本比为 0.843，高于预先登记的 0.70 阈值，因此该 pilot **不能**证明 Sonnet
是节省成本的选择。实验只使用一个文件，每种条件运行三次，也没有对建议质量评分。请参阅
[协议、原始运行、勘误与限制](docs/development/reviews/2026-10-22-inspector-model-pilot/RESULTS.md)。
与 [Ponytail](https://github.com/DietrichGebert/ponytail) 或
[Caveman](https://github.com/JuliusBrussee/caveman) 这类覆盖面更广的优化插件不同，BoxBox
不宣称总体 token 或总体成本必然下降。它们“展示收益、方法和不利结果”的 README 方式只是本文的
表达参考；它们的基准结果不能直接套用于 BoxBox。

SessionStart 最多每 24 小时检查一次 GitHub release tag，并且不会发送源代码内容。可通过
`BOXBOX_UPDATE_CHECK=0` 禁用该探测。Monitor 报告保留在本地，不包含 transcript、命令或源代码内容。

## 在哪里可以运行？

npm 安装器正式支持 **Codex 和 Claude Code**。开发安装器可以把与智能体无关的技能暴露给 ZCode
以及 Pi / Oh My Pi，其他 harness 也可以直接调用 Node CLI。但这些路径尚未拥有与两个正式宿主相同的
lifecycle hook、trust 和原生验收矩阵。包裹 Codex 或 Claude 的 wrapper 只要保留该宿主的插件环境和
事件即可工作；Gajae Code、Pi 或其他 orchestrator 的直接集成仍需要一个薄 adapter，负责 discovery、
plugin data、编辑事件映射和 Stop 行为。参见[可移植性契约](docs/development/agent-portability.md)。

## 开发 BoxBox

产品源码位于 `product/`；开发工具、研究和证据位于 `development/`。
`plugin/` 由产品模板生成，`dist/` 存放生成的包。
`docs/` 保存公开的用户和贡献者文档。测试、构建工具及这些文档即使不包含在安装包中，也应保留在源码仓库里；个人工作记录单独管理。
请参阅[开发指南](development/README.md)和[目录布局契约](docs/development/layout.md)。

```sh
bun install
bun run check
./development/install.sh codex
bun product/packages/cli/entry.ts check --file path/to/file.ts --json
```

开发版技能支持 Claude Code、Codex、ZCode 和 pi。默认的链接安装会跟随产品源码的实时变化；
`--copy` 则创建受管理的副本。开发创作钩子需要在宿主中单独注册。

## 语言覆盖范围

| 范围 | 覆盖情况 |
| --- | --- |
| 已实现的公开 CLI Check/Align 引擎 | TypeScript、Python、严格 JSON 和 YAML 1.2（`.yaml`/`.yml`） |
| 默认预设写入授权 | 仅五条规则：四种 TypeScript 声明形式和 Python 简单赋值 |
| 开发版对齐引擎 | 与上述相同的四种语言（其他行引擎语言已于 2026-10-22 移除） |
| TypeScript 检测 | TypeScript 7 AST 工具和表格类型注册表 |
| JSON/YAML 检测 | 同一层级中至少三个相邻的单行标量映射条目 |
| Python 检测 | 按文档进行 CPython AST/令牌分析，再交给共享行引擎和有界行配置 |

所支持的四种语言并不具有相同的发布支持程度：默认预设的写入授权仅覆盖 TypeScript 和 Python。写入前的检查需要相应的解析器工具。各语言的具体边界请参阅[实现映射](docs/development/implementation.md)。

## 项目设置与规则

项目配置位于 `.boxbox/`。配置按 Base → Preset → User → Project 的层级解析；安全不变条件始终是强制要求。

推荐预设包含五条已批准的约定、十个合成示例和五条决策记录：TypeScript 顶层声明中的相同函数调用、其他调用、空调用和简单值（至少 2 行），以及 Python 简单赋值（至少 3 行）。研究候选规则单独保存，不会自动获得批准。当前规则请参阅[可读性契约](product/rules/references/readability-contract.md)，智能体工作流程请参阅[插件技能](product/plugin/skills/boxbox/SKILL.md)。

## 开发状态

公开安装器 `boxbox-plugin@0.2.8` 已发布，并具有 macOS 上 Codex、Claude 的干净 registry 安装证据，
以及原生 Windows 安装和引擎检查证据。确定性引擎与宿主 adapter 已实现；可选 inspector 的模型选择
仍明确标记为未评估。标准 `plugin/` 启动脚本仍要求显式的本地引擎，而 npm 安装器会携带该引擎并
安装到永久本地目录。

已验证的行为和剩余工作请参阅[发布准备状态](docs/development/status.md)、[发布契约](docs/development/release-contract.md)和[计划](docs/development/plan.md)。历史命名及迁移详情见[命名记录](docs/development/reviews/2026-10-16-boxbox-rename.md)。

## 参与贡献

请先阅读[维护者文档](docs/development/README.md)，了解架构、检查阶段、存储契约和可重复使用的修改模式。

```bash
bun install
bun run check
```

`check` 会运行产品标识与依赖检查、测试套件、TypeScript 类型检查，以及开发安装器的 Shell 语法检查。贡献和创作规则请遵循 [AGENTS.md](AGENTS.md)。BoxBox 以 [MIT 许可证](LICENSE)发布；安装器包和引擎包也声明 `MIT` 并随附许可证文件。十个合成预设示例单独标记为 CC0-1.0。

产品命名由 [`product.json`](product.json) 管理；请参阅[重命名流程与代码长度边界](docs/development/product-identity.md)。
