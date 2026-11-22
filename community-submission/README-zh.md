# Super Agent 插件包（DeepSeek Harness）

**鱼在替你干活的时候，你随时能接得上它，而且你一说话它就听。**

三个插件装进 DSH：介入面板（鱼缸）、接管面板、看鱼人（后台常驻）。Super Agent 的 UI 是 DSH 插件，不是独立 app。

> 状态：在 DSH 0.2.2-rc.5 上测过。DSH 插件 API 是开发者预览，接口可能变，请按下面钉死版本。真人用户行为证据目前只有间接的（脚本任务 + 真实 DSH 执行），见“诚实说明”。

## 包里有什么

| 插件 | 面板 | 做什么 | 测出来的数 |
|---|---|---|---|
| `dsh-superagent-intervention`（鱼缸） | 鱼缸 | 停一组鱼 / 停一条鱼、改一条鱼的方向、半路问一条鱼一句；回执写进面板 | 面板停组 8/8、停一条鱼 7/8、问一句 8/8 对原生 5/8 |
| `dsh-superagent-takeover`（接管） | 接管 | 先停鱼，再改文件，再告诉队长派新鱼续上 | 对照 P-A 8/8、P-B 8/8，对原生 0/8、5/8 |
| `dsh-superagent-caretaker`（看鱼人） | 无界面（后台） | 每 10 秒心跳，判一条鱼有没有出问题（R7 配置丢失、R4 漂移、R1/R6 没交），能修的自己修，修完贴回执到队长会话 | 判准率 9/9、误杀 0/3、累计 37 次判断 0 误判 |

## 安装

要求：DSH 0.2.2-rc.5（或同系列），模型已配好。

```bash
dsh plugin --profile web add 'github:wcgg147/superagent-pack#main&path:plugins/superagent-intervention'
dsh plugin --profile web add 'github:wcgg147/superagent-pack#main&path:plugins/superagent-takeover'
dsh plugin --profile web add 'github:wcgg147/superagent-pack#main&path:plugins/superagent-caretaker'
```

装完重启 DSH。如果还装着旧的测试版 `@local/takeover-spike`，先卸掉它，不然会出现两个“接管”面板：

```bash
dsh plugin --profile web remove @local/takeover-spike
```

## 怎么用

1. **介入（鱼缸面板）**：派鱼写长任务后，面板出现在输入框下方，按目标分组。每条鱼一行：先停下（整组或单条）、问一句（点哪条问哪条，问题落在那条鱼的队长回执里）。
2. **接管（接管面板）**：先点“停鱼”停住一条鱼，再在磁盘上改它写的文件（或只改方向），点“回执：等我改完”让队长先别派新鱼，改完点“回执：改完了”——队长派一条新鱼，接着你改完的地方写。被停掉的鱼叫不回来，交还永远是派新鱼。
3. **看鱼人（无界面）**：写 watch 文件 `~/workspace/dsh-care/caretaker-watch.json`，每条写清鱼会话 id、队长会话 id、任务、目标文件、配置文件和备份。心跳每 10 秒读一次，判到问题就修（R7 从备份恢复配置、R4 指挥重写），修完贴回执到队长会话。状态文件在 `<DSH_HOME>/caretaker-state/<watchId>.json`。

## 设计约束（实测定下来的，别绕过去）

- **告诉队长只用回执 append，不用 prompt。** `session.prompt()` 在接管场景下会假报 `answered`（消息根本没落到队长会话里），2/2 复现。接管面板上没有 prompt 按钮。
- **同一条被停掉的鱼，队长叫不回来。** 交还 = 队长派一条新鱼收尾。回执文案必须写“派一条新鱼，接着我改完的地方写”。
- **看鱼人修不了 R1。** Host 插件拿不到 session controller，R1 的修法（让鱼重做）走不通；只有 R4 有“自己生成 + 写盘 + 下一轮再判”的修法。R7 的修法是“从备份恢复”。
- **token 成本量不出来。** `deriveMessages()` 不给 token 数，只看得到轮数和字符数。别在包里编 token 数。

## 诚实说明

- 真人行为证据只有间接的：所有数字都来自脚本任务 + 真实 DSH 执行，不是真人用户。介入频率和感受没量过。
- 看鱼人假设只部分立住：已验证的价值在“抓住静默的状态丢失”（R7），不在判内容偏没偏；白干轮数上没赢过对照组。R1/R2/R3/R5 还没有干净的卡鱼证据，插件也没实现 R2/R3/R5 检查。
- 被停的鱼措辞留不住：新鱼接手后内容底子在、措辞会重写。
- 看鱼人要手写 watch JSON，还没有加 watch 的界面。
- “问一句”用 `window.prompt` 弹框（最小实现），队长答问题是查磁盘文件、不是直接问鱼的会话。

## 权限

插件以你自己的 DSH 权限运行：读写工作区文件、停会话、给队长会话贴回执。不联网，不用任何外部服务。装之前请看源码，和装任何 DSH 插件一样。

## 兼容性

- DSH 0.2.2-rc.5（已测）。插件 API 是开发者预览，请钉死这个版本范围。
- Profile：`web`（已测），desktop 未测。

## 许可证

MIT，见 [LICENSE](LICENSE)。

## 来源

- 一间工作室。欢迎提 issue 和 PR。
- 演示：干净重跑 v02（2026-11-21）干净证明了接管整条、半路问对的鱼、介入停正在跑的鱼，截图见 `screenshots/`。
