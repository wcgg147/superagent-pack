# 看鱼人（Caretaker）插件设计（常驻后台 Worker）

日期：2026-11-20 晚。判断依据：`superagent-caretaker-judgment-v05.md`。简报：`superagent-caretaker-testbuild-brief-v01.md`。
环境：隔离 rc.5（3081，`~/.dsh-rc5`），模型 group/hy4-free（Magpie），主线 rc.1 不动。
性质：Super Agent 插件包里的看鱼人插件。做的是 caretaker 的判断 + 修复能不能在真实 DSH 里自主跑起来。

## 架构：Host-only，无界面

caretaker 是后台 Worker，不用界面（grounding 已定：slots 只做展示，caretaker 本身不用界面）。所以插件只有 Host 一半，没有 Client：

```
~/workspace/dsh-superagent-caretaker/
  package.json       — dsh-superagent-caretaker 1.0.0，exports . -> index.js，dsh.bundle.patch
  index.js           — Host 服务（TypertRemoteService）：心跳 + 判定 + 修复 + 回执 + 状态
  cordis.patch.yml   — insert bundle
  locale/en.json, locale/zh.json — 最小（服务名）
  icon.svg           — 最小
```

不做 Client 面板：caretaker 的输出是（a）诊断回执（Session.append 贴到队长会话里，不唤醒，人在聊天里看得到），（b）修复动作（恢复配置文件、指挥重写），（c）状态文件（每条判断的记录，供报告核对）。这三样都不需要 UI。

## 心跳与 watch 文件（测试接口）

- **心跳**：`ctx.interval`（cordis-plugin-timer，包里有；启动时检查 `typeof ctx.interval === 'function'`，没有就退回 `setInterval`，卸载时清掉）。每 20 秒一轮。
- **watch 文件**：`~/workspace/dsh-care/caretaker-watch.json`，测试驱动（我）按场景写。心跳每轮读它。格式：
  ```json
  { "watches": [ {
    "id": "r7-1",
    "fishSessionId": "session-xxx",
    "captainSessionId": "session-yyy",
    "task": "写一份留存问卷分析，1500字……",
    "targetFile": "/home/hatch/workspace/dsh-care-xxx.md",
    "deliverableKind": "留存问卷分析",
    "configFile": "/home/hatch/workspace/dsh-care/r7-config.json",
    "configBackup": "/home/hatch/workspace/dsh-care/r7-config-backup.json",
    "expectRules": ["R7"]
  } ] }
  ```
  每条 watch 有自己的状态（pending → judged → repaired → verified / no-issue），存在状态文件里，不存在内存里（重启后能续上）。

## 判定：确定性的在 Host 里判，R4 走模型

- **R7（配置丢了）**：Host 里 fs 读 config + backup，比顶层 key 数。config 的 key 少了 → R7。确定性，不用模型。WOZ 里这条三次都过了，插件里再过一次。
- **R4（偏离目标）**：走模型。Host 建一个 caretaker agent（见下），把任务 + 鱼交的文件内容 + R4 规则发给它，它回 JSON `{"drift": true/false, "reason": "一句话"}`。Host 按回的 JSON 行动。R4 是唯一要模型判的规则（判断 v05），WOZ v02 已验证模型能判（1/1）；插件里要验证的是“常驻 Worker 能调动模型判 R4”这条链路。
- **R1（写不出来）**：基础版——目标文件不存在，且鱼会话的最后一条消息是 assistant（鱼那轮结束了还没交）。确定性。验收不含 R1，只做轻量实现，不硬测。
- **R6（静默失败）**：队长会话的消息里报“都交了”，但目标文件缺/错 → R6。确定性（比对队长回报与磁盘实际）。验收里好鱼 B 和 R6 观察组用这条。
- **R5**：测试版不做（验收不含；要 token 估算，2 倍阈值是设计值）。
- **R2/R3**：测试版不做（验收不含；要读思考轨迹，成本高）。

**成本规矩**（判断 v05）：文件能回答的，读文件；只有 R4（模型判）才调模型。R7/R1/R6 的 Host 检查烧 0 个模型 token。R4 每判一次烧一个 caretaker agent 回合的 token，记下来。

## caretaker agent（R4 用）：agentLoop.create 现建现用

- 不用 cordis.patch 声明持久 agent（声明式要改 agent-loop 配置，风险高）。改用编程式：第一次要判 R4 时，`ctx.agentLoop.create('caretaker-judge-<时间戳>', {}, { cwd: '/home/hatch/workspace' })` 现建一个 caretaker agent（不指定 provider/model，走会话默认 = Magpie Hy4 Free），`agent.followup(判断提示)` 发判断任务，`await agent.whenIdle()` 等它回完，`agent.session.deriveMessages()` 读最后一条 assistant 消息，解析 JSON。
- 每次 R4 判断建一个新 agent（id 带时间戳，不撞已有的会话），判完留着（不主动删，卸载时由 DSH 收）。判断提示里写死“只判断，不动手，不调用工具，直接回 JSON”，防它乱动。
- 如果 `agentLoop.create` 或 `followup` 失败（API 不通、模型不回），记下来、R4 判“没判出来”（不编结论），报告里写明。这是测试版要探的边界，不是藏起来的失败。
- 注入：`static inject = ['sessions', 'agentLoop']`。

## 修复：按判断 v05 的顺序

- **R7**：Host 直接 fs 把 config 从 backup 恢复（cp），再读回来数 key（== backup 的 key 数才算验过）。修完贴诊断回执到队长会话（Session.append，不唤醒）。
- **R4**：Host 用 `ctx.remote.session.prompt({ requestId, sessionId: captainSessionId, mode: 'queue', content: [{ type: 'text', text: 重写指令 }] })` 唤醒队长，让它指挥鱼重写。重写指令写清：鱼交的是说明不是计划、要一份真正的<deliverableKind>、按原任务重写到原目标文件。下一轮心跳读新文件再判（是真计划了 → 验过；还是说明 → 按“同一条鱼同一问题最多修 1 次”停手，记“修不好”，问用户一句——测试版里问用户那句先记下来不发，等主聊定）。
- **R1**：`ctx.remote.session.prompt` 唤醒鱼（mode 'queue'）让它重做当前这一步；下一轮心跳验文件落没落。
- **R6**：贴诊断回执到队长会话（说明哪份没交、证据），不自动修（R6 的修法是“让队长重新核对”，测试版里先只诊断，修法等真实数据）。
- **修完要验证**：修完不能只说“修了”，要核对——文件落盘了没有、配置 key 数对不对、重写的是不是真计划。验证不过算没修好。
- **不修也是一种决定**：目标本身写不进去（R1 里文件路径不可达那种）就不派鱼重试，记下来。

## 诊断回执：人话，≤100 词，三部分 + 一行证据

格式（判断 v05）：它在干什么 / 怎么了（哪条规则，人话）/ 接下来怎么办 + 一行证据（哪里、证据、下一步）。贴到队长会话里（Session.append，`createUserMessage` + `surfaceOp: 'append'`，不唤醒，照搬 fishtank 的 postReceipt）。不贴日志、不编数、不说“已修复”除非验过。

## 状态文件：每条判断的记录

`~/.dsh-rc5/caretaker-state/<watchId>.json`（DSH_HOME 下，跟 fishtank-state 一个路子）：
```json
{ "watchId": "r7-1", "rule": "R7", "judged": true, "diagnosis": "……",
  "lostItems": ["audience","deadline",…], "repaired": true, "verified": true,
  "tokenCost": 0, "subagentMount": "workflow", "at": 1732… }
```
- `tokenCost`：R7/R1/R6 是 0（Host fs，不调模型）；R4 是 caretaker agent 那回合的 token（从 agent 会话里读，能读到就写实数，读不到就写提示+回复的字符数并注明）。
- `subagentMount`：这条链的子代理挂法（direct / workflow），测试驱动在 watch 文件里写（我知道鱼是怎么派的）。

## 验收怎么跑（简报 §验收）

1. R7 组：鱼按 10 项配置写完，测试驱动把配置砍到 2 项 → 心跳判 R7、说清 8 项、恢复、验 10/10。
2. R4 组：任务拉新、材料全留存 → 鱼交说明时判 R4、指挥重写、验了是真计划；鱼写对时不判。
3. 一轮两条组：一条配置被砍（R7）、一条交说明/落错路径（R4/R6）→ 一轮里同时判出两条、各给各的诊断、只修该修的那条。
4. 好鱼 A：目标模糊但写对了 → 不判 R4。
5. 好鱼 B：队长核对了 → 不判 R6。
6. R6 观察组：跑一组正常任务，只观察，不硬造；没出现就记“本轮没出现”。

误杀线：两条好鱼对照，错判一条，判断就得改。

## 清理与底线

- 跑完干净卸载（remove_bundle changed:true，list 确认不在，残留软链和 state 目录删掉），主线 rc.1 未动。
- 不编成本数、不编价格；token 数按实数写，读不到就写字符数并注明。
- 失败要记下来：agentLoop.create 不通、ctx.remote.session.prompt 不通、R4 的 JSON 解析失败、whenIdle 超时——都记进报告，不藏。
