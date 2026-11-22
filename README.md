# Super Agent 插件包（DSH 插件包 v01）

DeepSeek Harness 上的 Super Agent 监督插件包：**介入面板 + 接管面板 + 看鱼人**，三个插件装进同一个 DSH profile，像装任何 DSH 插件一样装。

> 基底前提（已定）：Super Agent 的 UI 是 DSH 插件，不是独立 app；没有通用前端。这个包就是 DSH 插件，不是另一个 app。

## 包里有什么

| 插件 | 面板 | 做什么 | 已验证的数 |
|---|---|---|---|
| `superagent-intervention`（介入面板，鱼缸） | 鱼缸 | 停一条鱼 / 停一组鱼、改一条鱼的方向、问一条鱼一句；回执写进面板 | 面板停组 8/8、停一条鱼 7/8、问一句 P 8/8 对 N 5/8 |
| `superagent-takeover`（接管面板） | 接管 | 先停鱼，再改文件，再告诉队长派新鱼续上 | 对照 P-A 8/8、P-B 8/8，对 N-A 0/8、N-B 5/8 |
| `superagent-caretaker`（看鱼人） | 无界面（后台常驻） | 每 10 秒心跳，判一条鱼有没有出问题（R7 配置丢失、R4 漂移、R1 没交、R6 没交齐），能修的自己修，修完贴回执到队长会话 | 判准率 9/9、误杀 0/3、累计 37 次判断 0 误判 |

三个插件都是已有测试版插件的产品化版本：机制没改，只改了面板标题/文案（去掉了“测试版”“spike”等内部词）、清掉了已知尾巴、统一了包名。

## 安装

要求：DSH 0.2.2-rc.5（或同系列），模型已配好（本包测试用 Magpie `group/hy4-free`）。

```bash
bash install.sh
# 等价于下面三条（DSH_HOME 指 rc.5 的 home）：
# dsh plugin --profile web add plugins/superagent-intervention
# dsh plugin --profile web add plugins/superagent-takeover
# dsh plugin --profile web add plugins/superagent-caretaker
```

装完重启 DSH。三个插件都是 `link:` 依赖，改代码后重启即生效，不用重装。

注意：如果 profile 里还装着旧的 `@local/takeover-spike`（测试版），先卸掉它再装本包，否则会出现两个“接管”面板：

```bash
dsh plugin --profile web remove @local/takeover-spike
```

## 怎么用

1. **介入（鱼缸面板）**：派鱼写长任务后，面板出现在输入框下方，按目标分组。每条鱼一行：先停下（整组或单条）、问一句（点哪条问哪条，问题落在那条鱼的队长回执里）。
2. **接管（接管面板）**：先点“停鱼”停住一条鱼，再在磁盘上改它写的文件（或只改方向），点“回执：等我改完”让队长先别派新鱼，改完点“回执：改完了”——队长派一条新鱼，接着你改完的地方写。面板上的“写确认”把交还方式落盘（重启后还在）。
3. **看鱼人（无界面）**：写 watch 文件 `~/workspace/dsh-care/caretaker-watch.json`，每条 watch 写清鱼会话 id、队长会话 id、任务、目标文件、配置文件和备份。心跳每 10 秒读一次，判到问题就修（R7 从备份恢复配置、R4 指挥重写），修完贴回执到队长会话。状态文件在 `<DSH_HOME>/caretaker-state/<watchId>.json`。

## 设计约束（实测定下来的，别绕过去）

- **告诉队长只用回执 append，不用 prompt。** `session.prompt()` 在接管场景下会假报 `answered`（消息根本没落到队长会话里），2/2 复现。接管面板上没有 prompt 按钮。
- **同一条被停掉的鱼，队长叫不回来。** 交还 = 队长派一条新鱼收尾。回执文案必须写“派一条新鱼，接着我改完的地方写”，不能写“把鱼叫回来，不要派新鱼”（后者会死锁，P-A 第一轮已撞上）。
- **看鱼人修不了 R1。** Host 插件拿不到 session controller，R1 的修法（让鱼重做）走不通；只有 R4 有“自己生成 + 写盘 + 下一轮再判”的修法。R7 的修法是“从备份恢复”。
- **token 成本量不出来。** `deriveMessages()` 不给 token 数，只看得到轮数和字符数。别在包里编 token 数。

## 已知遗留

- 看鱼人插件目录里的 `README.md` 正文还留着几处“测试版”字样（设计文档的历史措辞），标题已改。面板本身没有界面，不影响使用。
- 看鱼人 R4 的修复提示词里还写着旧测试的材料路径（`dsh-care-test/r4p-src-*.md`）。R7 不受影响；要跑 R4 演示，先把那段提示词换成演示用的材料。
- 介入面板的“问一句”用 `window.prompt` 弹框问问题（最小实现），队长答问题是查磁盘文件、不是直接问鱼的会话。

## 来源

- 介入面板：`superagent-intervention-testbuild`（面板停/问对照已跑完）。
- 接管面板：`superagent-takeover-testbuild`（第 8 步测试版）+ 第 9 步对照（P-A/P-B/N-A/N-B）。
- 看鱼人：`superagent-caretaker-testbuild`（R7 4/4、R4 5/5）+ A/B/C 对照（H1 部分立住：价值在抓静默的状态丢失，不在判内容偏没偏）。
- 演示报告：`superagent-plugin-pack-demo-report-v01.md`（见 `~/workspace/deepseek-article-prep/`）。
