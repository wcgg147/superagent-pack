# 上架检查清单：lingbin 要做的事（按顺序）

> 本目录只准备了材料，**没有上传、没有建仓库、没有用任何账号提交**。下面每一步都要 lingbin 亲手做（或明确授权后由 Muse 代做）。

## 第 0 步：先定三件事（不用电脑也能定，手机上就能回）

1. **仓库名**：建议 `wcgg147/superagent-pack`（GitHub 用户名 wcgg147 已确认）。备选：`wcgg147/superagent-dsh-pack`。
2. **许可证**：本目录已备 MIT（`LICENSE`，版权方写“一间工作室”）。确认就用 MIT，不确认就换。
3. **包名**：现在三个插件在 `package.json` 里是 `@local/superagent-*` 且 `"private": true`，这是本地名、发不出去。建议改成公开名（不用 npm 也能装，见第 2 步）：
   - `dsh-superagent-intervention`、`dsh-superagent-takeover`、`dsh-superagent-caretaker`（不带 scope，短、好记、不易撞名），并把 `"private": true` 去掉。
   - 改包名只改 `package.json` 的 `name` 字段，不改代码。

## 第 1 步：建 GitHub 公开仓库（lingbin 手机上操作）

1. 在 GitHub（账号 wcgg147）新建公开仓库，名叫 `dsh-superagent-pack`，描述写一句话价值（照抄 README 第一句）：
   > Supervise your DeepSeek Harness agents while they work — stop, redirect, ask, take over — and a background caretaker that watches your fish and fixes silent failures.
2. 把本包内容传上去（Muse 代传需要 lingbin 给仓库地址和授权；他现在没电脑，传仓库这一步大概率要等他有办法传文件，或由 Muse 在云电脑上推——推之前必须他确认仓库建好了）。
3. 仓库根目录放这些文件（本目录已备好，照单放）：
   - `README.md`（本目录的英文版，替代现在包里的中文 README；中文版放 `README-zh.md`）
   - `LICENSE`（MIT）
   - `plugins/superagent-intervention/`、`plugins/superagent-takeover/`、`plugins/superagent-caretaker/`（三个插件目录；每个目录里再放对应的 `README-intervention.md` 等，改名为 `README.md`）
   - `screenshots/`（7 张演示截图）
4. 给仓库加 Topics：`dsh-plugin`（必需，Hub 爬虫靠它识别）、`deepseek-harness`、`super-agent`（建议）。

## 第 2 步：验证安装命令真的能装（Muse 在云电脑上做，lingbin 不用动手）

在隔离 rc.5 上跑一遍 GitHub 路径安装，确认三条命令都通：

```bash
dsh plugin --profile web add 'github:wcgg147/superagent-pack#main&path:plugins/superagent-intervention'
dsh plugin --profile web add 'github:wcgg147/superagent-pack#main&path:plugins/superagent-takeover'
dsh plugin --profile web add 'github:wcgg147/superagent-pack#main&path:plugins/superagent-caretaker'
```

通了才算能上架；不通就修包名或路径，不要先提交。

## 第 3 步：提交到社区（选一条线先上，推荐 Hub）

### 路线 A（推荐）：DSH Plugin Hub（dsh-plugin.org）

- 不用填表、不用等审核通过才上架：公开仓库 + `dsh-plugin` topic + README 里有安装命令，自动扫描就会收录（一般一个刷新周期内），先标 `unconfirmed`，社区人工检查兼容性和可用性后改 `verified`。
- 提交入口是 Submit 页（https://dsh-plugin.org/tutorials/publish-plugin-to-hub），按页面的要求和清单自查一遍再提交。
- 费用：免费。实名：不用实名，只要 GitHub 公开仓库。

### 路线 B：Open Plugin Market（dshopen.org）

- 要求：公开仓库 + npm 发布 + 许可证，然后在 GitHub 上开一个 request（issue）申请收录。收录后把 badge 放进 README。
- 注意：这条线要求发 npm 包（要 npm 账号 + `npm publish`），比 Hub 多一步。建议先走 Hub，npm 以后再说。
- 费用：免费。市场本身不是 DeepSeek 官方的，是独立社区项目。

### 路线 C（可选）：dsh-plugins registry（Ephemeral-AI-Lab）

- 读 `registry/community/README.md`，把 `registry/submission-template.json` 拷成 `registry/community/<slug>.json`，开 PR。CI 会 scratch-install 每个声明的源，维护者按 review checklist 人工审。
- 这条线要开 PR、要过人工审，周期最长。建议 Hub 上线、有人用之后再考虑。

### 路线 D（可选）：awesome-dsh-plugin（dshfind.com）

- 策展列表，要求插件能用 `dsh plugin add` 安装、描述属实、分类正确、有人维护，PR 提交，维护者按源检查后合并。
- 它的 index（`https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json`）可以加进 DSH Discover，曝光不错。可以和 Hub 一起交。

## 第 4 步：上架后要做的事

- 在 DSH Plugin Hub 的市场里搜插件名，核对卡片上的名字、描述、星数（卡片数据来自仓库元数据，仓库描述写得含糊会直接影响第一印象）。
- README 和版本信息会自动同步，不用重新提交；但插件 API 或兼容性变了要更新 README 并发新 release。
- 看鱼人 R4 修复提示词里还写着旧测试的材料路径（`dsh-care-test/r4p-src-*.md`），上架前要换成通用文案（包 README“已知遗留”里已记）。
- 看鱼人 README.md 现在是内部设计文档，上架前要换成本目录的 `README-caretaker.md`（用户向）。

## 风险（上架前要知道）

1. **插件 API 是开发者预览，接口会变。** 插件钉死 DSH 0.2.2-rc.5；DSH 升级后可能要跟着改，维护者要持续跟进，不然会被卸掉。
2. **装插件就是跑第三方代码。** 社区会提醒用户“装之前看源码”；我们的 README 已写明权限和不联网，源码公开可查。
3. **没有官方市场。** 四条线全是社区项目，都不是 DeepSeek 官方的；DeepSeek 官方 Discover 没有内置市场，得自加 index URL。
4. **从 `unconfirmed` 到 `verified` 要人工检查。** Hub 上架快，但拿到 `verified` 要等社区排期；README 写得越好、仓库越活跃，越快。
5. **lingbin 没电脑，传仓库是卡点。** 建仓库、推代码这两步现在只能在他手机上操作 GitHub（或等他确认后由 Muse 在云电脑上推）。在仓库建好之前，提交流程走不下去。
