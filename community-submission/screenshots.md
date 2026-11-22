# 截图清单（干净演示 v02，2026-11-21）

来源：`~/workspace/dsh-shots/` 642–648，话题为用户留存方案（队长 session-2aa5013f，三条鱼各写 20000 字以上一节）。三件事都干净证明了，见 `~/workspace/deepseek-article-prep/superagent-plugin-pack-demo-report-v02.md`。

| 文件 | 内容 |
|---|---|
| `642-pack2c-panels.png` | 三条鱼都在跑：接管面板三行（鱼3/鱼2/鱼1，都是“在跑”），队长 session-2aa5013f |
| `643-pack2c-ask.png` | 问一句之后：接管面板三条鱼都在跑，队长 3 subagents |
| `644-pack2c-stop-fish3.png` | 停鱼3 之后（先停下 + 确定停） |
| `645-pack2c-takeover-stop.png` | 接管停鱼1 之后（results 里 stopped，running:true） |
| `646-pack2c-takeover-receipts.png` | 两句回执都落了之后 |
| `647-pack2c-takeover-resumed.png` | 新鱼续上之后：鱼缸面板有“已通知/已完成”回执，接管面板出现“续写策略与预算总盘”“重写策略与预算总盘”在跑，顶栏 6 subagents |
| `648-pack2c-final.png` | 终态 |

两个诚实限定（写进 README 和报告，不藏着）：
1. 鱼1 被停时还没写出正文（只读过种子文件），所以“改”是直接把预算定成 200 万，不是改它写好的 350 万数字；新鱼执行 200 万是干净的，但“改写已有数字”这个动作本身这次没测到。
2. 接管续上时队长派了不止一条鱼，part1 中间有互相覆盖，终态才稳定在 200 万版本。“队长一次只派一条续写鱼”不是机制保证的。
