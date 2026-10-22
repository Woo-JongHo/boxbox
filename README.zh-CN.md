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

上面的对齐示例是 TypeScript 引擎的实际输出。名称、值和执行顺序保持不变；对应的语法元素变得更容易比较。

产品名称是 **BoxBox**；核心 CLI、技能和插件的 ID 为 `boxbox`（于 2026-10-16 确认）。npm 安装器的候选包名是 `boxbox-plugin`，检查时尚未被注册。目标命令为 `npx boxbox-plugin`；发布需要有效的 npm 身份验证和最终发布决定。请参阅 [Windows 插件安装指南](docs/user/codex-windows-test.md)。

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

0.2.5 源码候选版本区分智能体工作流程与引擎修改范围：

- **Write — 编写：** 智能体参考已批准的编写指导，实现所请求的功能。
- **Refactor — 重构：** 智能体改进现有结构，并单独验证行为以及相关性能。
- **Align — 对齐：** 引擎只调整已批准的水平布局空白，不换行、不改变缩进，也不运行外部格式化器。
- **Check — 检查：** 检查现有代码而不修改它。未检测到分组不代表整个文件的风格已通过验证。

`guide --file <file> --authoring --json` 为现有文件、空文件或尚未创建的文件提供已批准的指导；
示例是编写指导，不是该文件的写入批准证据。`align --file <file> --dry-run --json` 预览对齐结果，
`align --file <file> --json` 应用对齐。Write 和 Refactor 由宿主智能体执行，不是 CLI 代码生成命令。
预览不会修改目标；现有的 `format` 流程仍是独立操作。
集成验证和独立审查正在进行。参见[工作流程选择与验证限制](docs/user/modes.md)。

CLI 现在可以检查 TypeScript、Python、严格 JSON 和 YAML 1.2，并将语法状态报告为 valid、invalid 或
parser error。JSON/YAML 对齐范围刻意限制为：
同一层级中至少三个相邻的单行标量映射条目。引擎会单独报告不支持的行，并保持其原样。
YAML 块标量、锚点、别名、标签、复杂键、流式集合、序列、指令和文档标记不在本次对齐范围内。
结构化文档的 Align 引擎路径已经实现，但推荐预设仍只授权下述两条 TypeScript/Python 规则写入；
JSON/YAML 写入需要完整的本地批准证据或未来单独批准的预设规则。

## 安装插件

公开的 npm 安装器正以 `boxbox-plugin` 为包名进行准备；尚未发布到注册表。
它会为 Codex 和 Claude Code 安装插件及其本地 Node 引擎。当前预览状态和宿主要求请参阅
[安装指南](docs/user/codex-windows-test.md)。

如需试用本地构建的安装器：

```sh
bun install
bun run pack:installer
npm exec --yes --package '/absolute/path/to/dist/installer/boxbox-plugin-<version>.tgz' -- boxbox --codex
```

将 `<version>` 替换为 `package.json` 中的版本号，或使用 `pack:installer` 输出的完整压缩包路径。此本地构建产物的使用流程需要检出仓库进行构建。安装后的插件使用其永久安装的 Node 引擎。
公开安装器需要 Node.js 22.22.3 或更高版本以及 npm；Python 格式化还需要 `python3`。

## 终端 HUD

本地安装候选包支持在 macOS/Linux 上选择启用 BoxBox HUD：

```sh
npm exec --yes --package '/absolute/path/to/dist/installer/boxbox-plugin-<version>.tgz' -- boxbox --codex --claude --hud
~/.local/bin/boxbox-codex
```

Claude Code 重启后使用自身的状态栏。通过 `boxbox-codex` 启动 Codex 时，HUD 显示在独立的 tmux 窗格中；
普通 `codex` 命令保持不变。请先安装 tmux，并在现有 tmux 会话之外启动。
HUD 显示引擎就绪状态、已批准规则数量和已观测的检查结果；缺少记录时显示未知。
Codex 显示启动时固定项目的历史记录，不代表当前会话已接受检查结果。
此适配器不支持 Windows 或桌面应用 HUD。设置过程保留无关配置，拒绝覆盖其他 Claude 状态栏，
也不会授予钩子信任。参见 [HUD 设置、限制与移除](docs/user/hud.md)。

## 开发 BoxBox

产品源码位于 `product/`；开发工具、研究和证据位于 `development/`。
`plugin/` 由产品模板生成，`dist/` 存放生成的包。
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
| 默认预设写入授权 | 仅两条规则：TypeScript 调用声明和 Python 简单赋值 |
| 开发版对齐引擎 | TypeScript、Python、Java、Go、Rust、JavaScript、C、C++、Swift 和 Kotlin |
| TypeScript 检测 | TypeScript 7 AST 工具和表格类型注册表 |
| JSON/YAML 检测 | 同一层级中至少三个相邻的单行标量映射条目 |
| 其他开发语言检测 | 共享的行引擎与各语言专用配置 |

拥有十种语言的开发引擎，并不意味着它们具有相同的发布支持程度。写入前的检查需要相应的解析器工具。各语言的具体边界请参阅[实现映射](docs/development/implementation.md)。

## 项目设置与规则

项目配置位于 `.boxbox/`。配置按 Base → Preset → User → Project 的层级解析；安全不变条件始终是强制要求。

推荐预设包含两条已批准的约定、四个合成示例和两条决策记录：TypeScript 顶层调用声明（至少 2 行）和 Python 简单赋值（至少 3 行）。研究候选规则单独保存，不会自动获得批准。当前规则请参阅[可读性契约](product/rules/references/readability-contract.md)，智能体工作流程请参阅[插件技能](product/plugin/skills/boxbox/SKILL.md)。

## 开发状态

本项目仍处于开发阶段，尚未完成公开发布。本地 CLI 构建产物和技能适配器已经实现；公开分发、原生宿主事件的接纳，以及发布包的许可证元数据仍有待完成。标准 `plugin/` 启动脚本需要显式指定本地引擎。在 Windows 上试用 Codex 时，请使用 [npm 安装器](docs/user/codex-windows-test.md)，它会将随附引擎安装到永久的本地目录。选定的 npm 安装器包名为 `boxbox-plugin`；发布仍待进行。

已验证的行为和剩余工作请参阅[发布准备状态](docs/development/status.md)、[发布契约](docs/development/release-contract.md)和[计划](docs/development/plan.md)。历史命名及迁移详情见[命名记录](docs/development/reviews/2026-10-16-boxbox-rename.md)。

## 参与贡献

请先阅读[维护者文档](docs/development/README.md)，了解架构、检查阶段、存储契约和可重复使用的修改模式。

```bash
bun install
bun run check
```

`check` 会运行产品标识与依赖检查、测试套件、TypeScript 类型检查，以及开发安装器的 Shell 语法检查。贡献和创作规则请遵循 [AGENTS.md](AGENTS.md)。现有的 [MIT LICENSE](LICENSE) 保留自 GitHub main 分支。安装器候选包仍使用 UNLICENSED 预览元数据；发布与发布包元数据仍需分别决定。四个合成预设示例单独标记为 CC0-1.0。

产品命名由 [`product.json`](product.json) 管理；请参阅[重命名流程与代码长度边界](docs/development/product-identity.md)。
