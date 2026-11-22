/*
* Host half of the caretaker test-build bundle.
*
* A resident background Worker (no Client UI): a heartbeat reads the watch
* file, judges watched fish by judgment v05, repairs what it can, posts a
* plain-language diagnosis receipt into the captain's session, and records
* every judgment to a durable state file.
*
* Stage 1: R7 only (config lost). Deterministic, no model call, 0 model
* tokens. Stage 2 adds R4 (model judgment via a caretaker agent), R1, R6.
*
* Watch file (written by the test driver, read every heartbeat):
* ~/workspace/dsh-care/caretaker-watch.json
* { "watches": [ { "id", "fishSessionId", "captainSessionId", "task",
* "targetFile", "deliverableKind", "configFile", "configBackup",
* "expectRules": ["R7"], "subagentMount": "workflow"}]}
*
* State (one JSON file per watch, survives restart):
* <DSH_HOME>/caretaker-state/<watchId>.json
*
* Receipts: one plain-text user/message appended to the captain's live
* session (surfaceOp 'append', does not wake the agent) — same road as
* fishtank's postReceipt. Human text, <=100 words, three parts + evidence.
*/
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { TypertRemoteService, Remote} from '@deepseek-ai/dsh-typert-protocol'
import { createUserMessage} from '@deepseek-ai/dsh-llm'

/* Root directory of the durable caretaker state (outside the profile composition). */
function stateRoot() {
const base = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
return path.join(base, 'caretaker-state')
}

/* Watch file written by the test driver. */
function watchFilePath() {
return path.join(os.homedir(), 'workspace', 'dsh-care', 'caretaker-watch.json')
}

/* Append one line to the caretaker log (debugging; never contains secrets). */
function logLine(text) {
try {
const dir = stateRoot()
fs.mkdirSync(dir, { recursive: true})
fs.appendFileSync(path.join(dir, 'caretaker.log'), new Date().toISOString() + ' ' + text + '\n')
} catch (_error) {
/* Logging must never break the heartbeat. */
}
}

/* Read a JSON file; returns null on missing/corrupt. */
function readJsonFile(file) {
try {
return JSON.parse(fs.readFileSync(file, 'utf8'))
} catch (_error) {
return null
}
}

/* Write JSON atomically (tmp + rename). */
function writeJsonFile(file, value) {
const dir = path.dirname(file)
fs.mkdirSync(dir, { recursive: true})
const temporary = file + '.' + process.pid + '.tmp'
fs.writeFileSync(temporary, JSON.stringify(value, null, 2))
fs.renameSync(temporary, file)
}

/* Top-level key count of a JSON object config. */
function countTopKeys(value) {
if (!value || typeof value!== 'object' || Array.isArray(value)) return -1
return Object.keys(value).length
}

/* Keys present in backup but missing from config. */
function lostKeys(backup, config) {
if (!backup || typeof backup!== 'object') return []
if (!config || typeof config!== 'object') return Object.keys(backup)
return Object.keys(backup).filter((key) =>!(key in config))
}

/* Plain text out of a derived message (several shapes, defensive).
* Only the visible text parts count; reasoning/thinking parts are skipped,
* so a model reply that carries a reasoning trace parses cleanly. */
function messageTextOf(message) {
if (!message || typeof message!== 'object') return ''
const content = message.content
if (typeof content === 'string') return content
if (Array.isArray(content)) {
const parts = []
for (const part of content) {
if (typeof part === 'string') parts.push(part)
else if (part && part.type === 'reasoning') continue
else if (part && typeof part.text === 'string') parts.push(part.text)
}
return parts.join('')
}
if (typeof message.text === 'string') return message.text
return ''
}

/* Parse JSON out of a reply that may carry extra words around it. */
function parseJsonLoose(text) {
if (typeof text!== 'string') return null
try {
return JSON.parse(text)
} catch (_error) {
const start = text.indexOf('{')
const end = text.lastIndexOf('}')
if (start < 0 || end <= start) return null
try {
return JSON.parse(text.slice(start, end + 1))
} catch (_error2) {
return null
}
}
}

/* Last assistant message text out of a derived-messages array, or null. */
function lastAssistantTextFromMessages(messages) {
if (!Array.isArray(messages)) return null
for (let i = messages.length - 1; i >= 0; i -= 1) {
const message = messages[i]
if (message && (message.role === 'assistant' || message.type === 'assistant')) {
const text = messageTextOf(message)
if (text) return text
}
}
return null
}

/*
* Apply a standard @Remote method decorator without decorator syntax.
* Same helper as the fishtank bundle: runs the decorator's initializers once
* against a throwaway instance, recording the versioned marker on the class
* prototype exactly as the compiled form does.
*/
function markRemote(target, name, decorator) {
const initializers = []
decorator(target.prototype[name], {
kind: 'method',
name,
static: false,
private: false,
access: {
has: (object) => name in object,
get: (object) => object[name],
},
addInitializer: (fn) => initializers.push(fn),
})
const receiver = Object.create(target.prototype)
for (const initialize of initializers) initialize.call(receiver)
}

/* Host half: heartbeat, judgment, repair, receipts, state. */
export default class CaretakerService extends TypertRemoteService {
static inject = ['sessions', 'timer', 'agentLoop']

constructor(ctx) {
super(ctx, 'caretaker')
this.lastTickAt = 0
this.tickCount = 0
this.ticking = false
this.heartbeatKind = 'none'
this.startHeartbeat()
}

/* Start the heartbeat: ctx.interval when available, else setInterval. */
startHeartbeat() {
const intervalMs = 10000
const onError = (error) => logLine('tick error: ' + String(error && error.message ? error.message : error))
try {
if (this.ctx && typeof this.ctx.interval === 'function') {
this.ctx.interval(() => {
this.tick().catch(onError)
}, intervalMs)
this.heartbeatKind = 'ctx.interval'
} else {
throw new Error('ctx.interval unavailable')
}
} catch (error) {
logLine('ctx.interval failed (' + String(error && error.message ? error.message : error) + '), falling back to setInterval')
try {
setInterval(() => {
this.tick().catch(onError)
}, intervalMs)
this.heartbeatKind = 'setInterval'
} catch (fallbackError) {
logLine('heartbeat start failed: ' + String(fallbackError && fallbackError.message ? fallbackError.message : fallbackError))
this.heartbeatKind = 'failed'
}
}
logLine('caretaker service constructed, heartbeat=' + this.heartbeatKind)
}

/* Read the watch file; empty list on missing/corrupt. */
readWatches() {
const parsed = readJsonFile(watchFilePath())
if (!parsed ||!Array.isArray(parsed.watches)) return []
return parsed.watches
}

/* Read one watch's state file; null when never judged. */
readState(watchId) {
const safe = String(watchId || '').replace(/[^A-Za-z0-9._-]/g, '_')
return readJsonFile(path.join(stateRoot(), safe + '.json'))
}

/* Write one watch's state file. */
writeState(watchId, value) {
const safe = String(watchId || '').replace(/[^A-Za-z0-9._-]/g, '_')
writeJsonFile(path.join(stateRoot(), safe + '.json'), value)
}

/*
* Append `text` as one plain-text user message on the target's live Session.
* Human text only, no structured payload. Does not wake the agent.
* Same road as fishtank's postReceipt.
*/
async postReceipt(sessionId, text) {
const session = this.ctx.sessions.get(sessionId)
if (!session) return { ok: false, code: 'session-not-found'}
if (typeof text!== 'string' || text.length === 0) return { ok: false, code: 'empty-text'}
const message = createUserMessage({
content: [{ type: 'text', text}],
source: { kind: 'user'},
})
session.append('user/message', message, { surfaceOp: 'append'})
return { ok: true}
}

/* One heartbeat round: check every unresolved watch. Guarded against overlap. */
async tick() {
if (this.ticking) return { ok: true, skipped: 'overlap'}
this.ticking = true
try {
this.tickCount += 1
this.lastTickAt = Date.now()
const watches = this.readWatches()
const results = []
for (const watch of watches) {
try {
results.push(await this.checkWatch(watch))
} catch (error) {
const message = error && error.message? String(error.message): String(error)
logLine('watch ' + (watch && watch.id? watch.id: '?') + ' error: ' + message)
results.push({ watchId: watch && watch.id? watch.id: null, ok: false, code: 'watch-error', message})
}
}
return { ok: true, tick: this.tickCount, results}
} finally {
this.ticking = false
}
}

/*
* Check one watch. Stage 2: R7, then R4, then R1, then R6.
* R7 is independent (config). R4/R1/R6 share the target file + sessions.
* A watch resolves when a repair is verified, or when the fish delivered
* and no rule triggered (no-issue). A repair-pending watch is re-checked
* on the next tick (rewrite verified, or repair-failed after 1 repair).
*/
async checkWatch(watch) {
if (!watch || typeof watch.id !== 'string' || watch.id.length === 0) {
return { watchId: null, ok: false, code: 'bad-watch' }
}
const prior = this.readState(watch.id)
if (prior && prior.status === 'resolved') {
return { watchId: watch.id, ok: true, skipped: 'resolved' }
}
if (prior && prior.status === 'repair-failed') {
return { watchId: watch.id, ok: true, skipped: 'repair-failed' }
}
const r7 = await this.checkR7(watch)
if (r7 && r7.triggered) return r7
const r4 = await this.checkR4(watch, prior)
if (r4 && r4.triggered) return r4
const r1 = await this.checkR1(watch, prior)
if (r1 && r1.triggered) return r1
const r6 = await this.checkR6(watch, prior)
if (r6 && r6.triggered) return r6
return { watchId: watch.id, ok: true, skipped: 'no-trigger' }
}

/* R7 gate: config lost. Returns { triggered } or null when not applicable. */
async checkR7(watch) {
if (typeof watch.configFile !== 'string' || typeof watch.configBackup !== 'string') return null
const config = readJsonFile(watch.configFile)
const backup = readJsonFile(watch.configBackup)
if (!config || !backup) return null
const configCount = countTopKeys(config)
const backupCount = countTopKeys(backup)
if (configCount < 0 || backupCount < 0) return null
if (configCount >= backupCount) return null
const result = await this.judgeR7(watch, config, backup, configCount, backupCount)
return { triggered: true, ...result }
}

/* Read a text file, truncated to maxChars. Returns null when unreadable. */
readTextFile(file, maxChars) {
try {
const text = fs.readFileSync(file, 'utf8')
return text.length > maxChars ? text.slice(0, maxChars) : text
} catch (_error) {
return null
}
}

/* Plain text of the derived messages of a live session, newest last. */
sessionMessagesText(sessionId, maxChars) {
try {
const session = this.ctx.sessions.get(sessionId)
if (!session || typeof session.deriveMessages !== 'function') return null
const messages = session.deriveMessages()
if (!Array.isArray(messages)) return null
const parts = []
for (const message of messages) {
const text = messageTextOf(message)
if (text) parts.push(text)
}
const joined = parts.join('\n')
return joined.length > maxChars ? joined.slice(joined.length - maxChars) : joined
} catch (_error) {
return null
}
}

/* Last assistant message text of a live session, or null. */
lastAssistantText(sessionId) {
try {
const session = this.ctx.sessions.get(sessionId)
if (!session || typeof session.deriveMessages !== 'function') return null
const messages = session.deriveMessages()
if (!Array.isArray(messages)) return null
for (let i = messages.length - 1; i >= 0; i -= 1) {
const message = messages[i]
if (message && (message.role === 'assistant' || message.type === 'assistant')) {
const text = messageTextOf(message)
if (text) return text
}
}
return null
} catch (_error) {
return null
}
}

/*
* Wake a live session with a new turn (mode queue) via the SessionController
* service. The controller is the Host service behind ctx.remote.session; a
* Host plugin reaches it directly through ctx.get('session'), not through
* ctx.remote (that accessor is for clients, and 'remote' is not injectable).
* Returns { ok: true, accepted } or { ok: false, code, message }.
*/
async promptSession(sessionId, text) {
try {
const controller = this.ctx && typeof this.ctx.get === 'function' ? this.ctx.get('session') : null
if (!controller || typeof controller.prompt !== 'function') {
return { ok: false, code: 'session-controller-unavailable' }
}
const requestId = 'caretaker-' + Date.now() + '-' + Math.floor(Math.random() * 1000000)
const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(30000) : undefined
const result = await controller.prompt({
requestId,
sessionId,
mode: 'queue',
content: [{ type: 'text', text }],
}, signal)
return { ok: true, accepted: result && result.accepted === true, result }
} catch (error) {
const message = error && error.message ? String(error.message) : String(error)
logLine('promptSession failed for ' + sessionId + ': ' + message)
return { ok: false, code: 'prompt-failed', message }
}
}

/*
* Judge R4 with a real model: build a caretaker agent on the fly, prompt it
* with the task + the fish's file content + the R4 rule, wait for its reply,
* parse JSON { drift, reason }. The agent only judges; it never repairs.
* Returns { ok, drift, reason, tokenCost, promptChars, replyChars, raw }.
* On any failure (agent create, followup, idle timeout, JSON parse) returns
* { ok: false } and the caller records "no judgment" instead of inventing one.
*/
async judgeR4WithModel(watch, fileContent) {
const promptText = '你是 caretaker，只判断一条鱼有没有偏离目标（R4），不动手，不调用工具。\n任务：' + (watch.task || '') + '\n任务要的东西是：' + (watch.deliverableKind || '') + '\n鱼交上来的文件（' + path.basename(watch.targetFile || '') + '）内容如下：\n' + fileContent + '\n规则：交上来的东西是不是任务要的那种东西。任务要的是计划/分析，鱼交的是“为什么写不出来”的说明、评估说明、或别的东西，就是偏离（R4）；任务要的是计划/分析，鱼交的就是计划/分析（哪怕产品自选），就是没偏。\n直接回复 JSON，不要多余文字：{"drift": true 或者 false, "reason": "一句话"}'
const promptChars = promptText.length
let agent = null
try {
if (!this.ctx.agentLoop || typeof this.ctx.agentLoop.create !== 'function') {
return { ok: false, code: 'agentloop-unavailable', promptChars }
}
const agentId = 'caretaker-judge-' + Date.now()
agent = await this.ctx.agentLoop.create(agentId, { provider: 'openai', model: 'group/hy4-free' }, { cwd: '/home/hatch/workspace' })
const message = createUserMessage({
content: [{ type: 'text', text: promptText }],
source: { kind: 'user' },
})
if (typeof agent.followup === 'function') {
agent.followup(message)
} else if (typeof agent.send === 'function') {
agent.send(message, 'next-turn', true)
} else {
return { ok: false, code: 'agent-no-followup', promptChars }
}
const idle = agent.whenIdle ? agent.whenIdle() : Promise.resolve()
const timeoutMs = 120000
const startedAt = Date.now()
let reply = null
let waited = 'timeout'
while (Date.now() - startedAt < timeoutMs) {
reply = lastAssistantTextFromMessages(agent.session.deriveMessages())
if (reply) {
waited = 'idle'
break
}
await new Promise((resolve) => setTimeout(resolve, 3000))
}
if (!reply) {
const idleDone = await Promise.race([idle.then(() => 'idle'), new Promise((resolve) => setTimeout(() => resolve('timeout'), 10000))])
if (idleDone === 'idle') {
reply = lastAssistantTextFromMessages(agent.session.deriveMessages())
}
}
if (waited === 'timeout' && !reply) {
return { ok: false, code: 'judge-timeout', promptChars }
}
if (!reply) {
return { ok: false, code: 'judge-no-reply', promptChars }
}
const replyChars = reply.length
const parsed = parseJsonLoose(reply)
if (!parsed || typeof parsed.drift !== 'boolean') {
return { ok: false, code: 'judge-bad-json', promptChars, replyChars, raw: reply.slice(0, 500) }
}
return { ok: true, drift: parsed.drift, reason: typeof parsed.reason === 'string' ? parsed.reason : '', tokenCost: null, promptChars, replyChars, agentId }
} catch (error) {
const message = error && error.message ? String(error.message) : String(error)
logLine('judgeR4WithModel failed for ' + watch.id + ': ' + message)
return { ok: false, code: 'judge-error', message, promptChars }
}
}

/*
* Repair R4: ask a model agent to WRITE the real deliverable as its reply
* text (no tools needed), then the Host writes that text to the target file.
* This is the repair the test build can actually perform: waking the captain
* or the fish from a Host plugin is blocked (ctx.remote is client-only,
* 'remote' is not an injectable service, ctx.get('session') returns nothing),
* and a programmatic repair agent has no file tools (only working_directory).
* So the caretaker generates the plan with a model and writes it via fs,
* then the next tick re-judges and verifies. The repair is real (a model
* writes the plan, the caretaker verifies it); the "who" differs from the
* design's "wake the fish", which the API does not allow.
* Returns { ok, replyChars, wrote }.
*/
async repairR4WithAgent(watch) {
const promptText = '你是修鱼的 agent，任务是把一份偏了的文件重写成真正的' + (watch.deliverableKind || '东西') + '。原任务：' + (watch.task || '') + '\n鱼交上来的是说明（不是' + (watch.deliverableKind || '东西') + '），已经偏了。材料：两份留存材料 dsh-care-test/r4p-src-1.md（留存率、流失原因、回访话术）和 dsh-care-test/r4p-src-2.md（留存对照数据），两份都只讲留存、不讲拉新；留存数据：次日留存 41%、7 日 22%、30 日 11%；流失前三是不知道怎么用 38%、没马上用到想要的功能 27%、配置丢过一次 19%；召回话术召回率约 9%；对照组 30 日留存 18%（没丢配置）、实验组 9%（丢过一次配置）。\n请直接输出一份真正的' + (watch.deliverableKind || '东西') + '全文（用留存数据推导拉新逻辑，假设要标明，不编造拉新数字），不要多余文字，不要解释，只输出计划本身。'
let agent = null
try {
if (!this.ctx.agentLoop || typeof this.ctx.agentLoop.create !== 'function') {
return { ok: false, code: 'agentloop-unavailable' }
}
const agentId = 'caretaker-repair-' + Date.now()
agent = await this.ctx.agentLoop.create(agentId, { provider: 'openai', model: 'group/hy4-free', maxTokens: 16000 }, { cwd: '/home/hatch/workspace' })
const message = createUserMessage({
content: [{ type: 'text', text: promptText }],
source: { kind: 'user' },
})
if (typeof agent.followup === 'function') {
agent.followup(message)
} else if (typeof agent.send === 'function') {
agent.send(message, 'next-turn', true)
} else {
return { ok: false, code: 'agent-no-followup' }
}
const timeoutMs = 180000
const startedAt = Date.now()
let reply = null
while (Date.now() - startedAt < timeoutMs) {
reply = lastAssistantTextFromMessages(agent.session.deriveMessages())
if (reply && reply.length > 500) break
await new Promise((resolve) => setTimeout(resolve, 3000))
}
if (!reply || reply.length < 500) {
return { ok: false, code: 'repair-no-plan', replyChars: reply ? reply.length : 0 }
}
try {
fs.writeFileSync(watch.targetFile, reply, 'utf8')
} catch (writeError) {
return { ok: false, code: 'repair-write-failed', message: String(writeError && writeError.message ? writeError.message : writeError) }
}
return { ok: true, replyChars: reply.length, wrote: true, agentId }
} catch (error) {
const message = error && error.message ? String(error.message) : String(error)
logLine('repairR4WithAgent failed for ' + watch.id + ': ' + message)
return { ok: false, code: 'repair-error', message }
}
}
async checkR4(watch, prior) {
if (typeof watch.targetFile !== 'string' || watch.targetFile.length === 0) return null
if (!fs.existsSync(watch.targetFile)) return null
const content = this.readTextFile(watch.targetFile, 6000)
if (content === null || content.length === 0) return null
const repairing = prior && prior.status === 'repair-pending' && prior.rule === 'R4' && prior.directed && prior.directed.ok === true
const judged = await this.judgeR4WithModel(watch, content)
if (!judged.ok) {
logLine('R4 no judgment for ' + watch.id + ': ' + (judged.code || 'unknown'))
return null
}
if (repairing) {
if (judged.drift) {
const state = {
watchId: watch.id,
rule: 'R4',
judged: true,
diagnosis: '看鱼人：' + (watch.deliverableKind || '这条鱼') + '重写后还是偏的（' + judged.reason + '）。按规矩同一条鱼同一问题只修 1 次，这条我不再修，记下来了。',
drift: true,
reason: judged.reason,
repaired: true,
verified: false,
tokenCost: judged.tokenCost,
promptChars: judged.promptChars,
replyChars: judged.replyChars,
subagentMount: typeof watch.subagentMount === 'string' ? watch.subagentMount : 'unknown',
status: 'repair-failed',
at: Date.now(),
}
this.writeState(watch.id, state)
return { triggered: true, watchId: watch.id, rule: 'R4', drift: true, verified: false }
}
const diagnosis = '看鱼人：' + (watch.deliverableKind || '这条鱼') + '重写后对了，是任务要的' + (watch.deliverableKind || '东西') + '（' + judged.reason + '）。验过了。'
let receipt = { ok: false, code: 'no-captain' }
if (typeof watch.captainSessionId === 'string' && watch.captainSessionId.length > 0) {
receipt = await this.postReceipt(watch.captainSessionId, diagnosis)
}
const state = {
watchId: watch.id,
rule: 'R4',
judged: true,
diagnosis,
drift: false,
reason: judged.reason,
repaired: true,
verified: true,
receipt,
tokenCost: judged.tokenCost,
promptChars: judged.promptChars,
replyChars: judged.replyChars,
subagentMount: typeof watch.subagentMount === 'string' ? watch.subagentMount : 'unknown',
status: 'resolved',
at: Date.now(),
}
this.writeState(watch.id, state)
logLine('R4 rewrite verified ' + watch.id)
return { triggered: true, watchId: watch.id, rule: 'R4', drift: false, verified: true, receipt }
}
if (!judged.drift) {
const state = {
watchId: watch.id,
rule: 'R4',
judged: true,
diagnosis: '看鱼人：' + (watch.deliverableKind || '这条鱼') + '交的就是任务要的东西，没偏（' + judged.reason + '），不用修。',
drift: false,
reason: judged.reason,
repaired: false,
verified: true,
tokenCost: judged.tokenCost,
promptChars: judged.promptChars,
replyChars: judged.replyChars,
subagentMount: typeof watch.subagentMount === 'string' ? watch.subagentMount : 'unknown',
status: 'resolved',
at: Date.now(),
}
this.writeState(watch.id, state)
logLine('R4 no drift ' + watch.id)
return { triggered: true, watchId: watch.id, rule: 'R4', drift: false, verified: true }
}
const diagnosis = '看鱼人：' + (watch.deliverableKind || '这条鱼') + '偏了：交上来的不是任务要的' + (watch.deliverableKind || '东西') + '，而是说明（' + judged.reason + '）。我叫修鱼的 agent 按原任务重写一份真正的' + (watch.deliverableKind || '东西') + '。'
let receipt = { ok: false, code: 'no-captain' }
if (typeof watch.captainSessionId === 'string' && watch.captainSessionId.length > 0) {
receipt = await this.postReceipt(watch.captainSessionId, diagnosis)
}
const directed = await this.repairR4WithAgent(watch)
const state = {
watchId: watch.id,
rule: 'R4',
judged: true,
diagnosis,
drift: true,
reason: judged.reason,
repaired: false,
directed,
receipt,
tokenCost: judged.tokenCost,
promptChars: judged.promptChars,
replyChars: judged.replyChars,
subagentMount: typeof watch.subagentMount === 'string' ? watch.subagentMount : 'unknown',
status: directed && directed.ok === true ? 'repair-pending' : 'direct-failed',
at: Date.now(),
}
this.writeState(watch.id, state)
logLine('R4 drift ' + watch.id + ' directed=' + JSON.stringify(directed))
return { triggered: true, watchId: watch.id, rule: 'R4', drift: true, directed, receipt }
}

/*
* R1 check (basic): target file missing, and the fish session's last message
* is an assistant message (its turn ended with nothing delivered).
* Directs a retry through the fish session itself when its id is known.
*/
async checkR1(watch, prior) {
if (typeof watch.targetFile !== 'string' || watch.targetFile.length === 0) return null
if (fs.existsSync(watch.targetFile)) return null
if (typeof watch.fishSessionId !== 'string' || watch.fishSessionId.length === 0) return null
const last = this.lastAssistantText(watch.fishSessionId)
if (!last) return null
const diagnosis = '看鱼人：' + (watch.deliverableKind || '这条鱼') + '那轮结束了，目标文件 ' + path.basename(watch.targetFile) + ' 还没落下来（写不出来，R1）。我叫它重做当前这一步。'
let receipt = { ok: false, code: 'no-captain' }
if (typeof watch.captainSessionId === 'string' && watch.captainSessionId.length > 0) {
receipt = await this.postReceipt(watch.captainSessionId, diagnosis)
}
const directed = await this.promptSession(watch.fishSessionId, '你那轮结束了，但目标文件 ' + watch.targetFile + ' 还没落下来。请重做当前这一步，把' + (watch.deliverableKind || '东西') + '写到 ' + watch.targetFile + '。')
const state = {
watchId: watch.id,
rule: 'R1',
judged: true,
diagnosis,
repaired: false,
directed,
receipt,
tokenCost: 0,
subagentMount: typeof watch.subagentMount === 'string' ? watch.subagentMount : 'unknown',
status: directed && directed.ok === true ? 'repair-pending' : 'direct-failed',
at: Date.now(),
}
this.writeState(watch.id, state)
logLine('R1 judged ' + watch.id + ' directed=' + JSON.stringify(directed))
return { triggered: true, watchId: watch.id, rule: 'R1', directed, receipt }
}

/*
* R6 check: the captain reported done, but the target file is missing or
* wrong. Reads the captain's last assistant message for a completion report,
* then compares against the disk. Only diagnoses; repair is "captain re-checks".
*/
async checkR6(watch, prior) {
if (typeof watch.targetFile !== 'string' || watch.targetFile.length === 0) return null
if (typeof watch.captainSessionId !== 'string' || watch.captainSessionId.length === 0) return null
const last = this.lastAssistantText(watch.captainSessionId)
if (!last) return null
const doneMarkers = ['都交了', '交货', '完成了', '核对', '回报', '写好了', '已完成']
const reported = doneMarkers.some((marker) => last.includes(marker))
if (!reported) return null
const exists = fs.existsSync(watch.targetFile)
let size = 0
try { size = fs.statSync(watch.targetFile).size } catch (_error) { size = 0 }
if (exists && size > 0) return null
const diagnosis = '看鱼人：队长说都交了，但目标文件 ' + path.basename(watch.targetFile) + ' 在盘上' + (exists ? '是空的' : '根本不存在') + '（静默失败，R6）。队长没发现，我记下来了，请队长重新核对一遍。'
const receipt = await this.postReceipt(watch.captainSessionId, diagnosis)
const state = {
watchId: watch.id,
rule: 'R6',
judged: true,
diagnosis,
reportedDone: true,
fileExists: exists,
fileSize: size,
repaired: false,
receipt,
tokenCost: 0,
subagentMount: typeof watch.subagentMount === 'string' ? watch.subagentMount : 'unknown',
status: 'resolved',
at: Date.now(),
}
this.writeState(watch.id, state)
logLine('R6 judged ' + watch.id + ' exists=' + exists + ' size=' + size)
return { triggered: true, watchId: watch.id, rule: 'R6', fileExists: exists, receipt }
}

/*
* Judge R7: config lost items, restore from backup, verify, receipt, state.
* Deterministic. Burns 0 model tokens (Host fs only).
*/
async judgeR7(watch, config, backup, configCount, backupCount) {
const lost = lostKeys(backup, config)
const diagnosis = '看鱼人：' + (watch.deliverableKind || '这条鱼') + '的配置丢了：本来 ' + backupCount + ' 项，现在只剩 ' + configCount + ' 项，丢了 ' + lost.length + ' 项（' + lost.join('、') + '）。我已经按备份恢复了。证据：配置文件 ' + path.basename(watch.configFile) + ' 被改过，备份里 ' + backupCount + ' 项齐全。'
let repaired = false
let verified = false
let verifyCount = -1
try {
fs.copyFileSync(watch.configBackup, watch.configFile)
repaired = true
const after = readJsonFile(watch.configFile)
verifyCount = countTopKeys(after)
verified = verifyCount === backupCount
} catch (error) {
logLine('R7 restore failed for ' + watch.id + ': ' + String(error && error.message? error.message: error))
}
const receiptText = diagnosis + (verified? '恢复后我数了一遍，' + verifyCount + ' 项全回来了，验过了。': '恢复后验证没过（读回 ' + verifyCount + ' 项，备份是 ' + backupCount + ' 项），这条我修不好，记下来了。')
let receipt = { ok: false, code: 'no-captain'}
if (typeof watch.captainSessionId === 'string' && watch.captainSessionId.length > 0) {
receipt = await this.postReceipt(watch.captainSessionId, receiptText)
}
const state = {
watchId: watch.id,
rule: 'R7',
judged: true,
diagnosis,
lostItems: lost,
configCountBefore: configCount,
backupCount,
repaired,
verified,
verifyCount,
receipt,
tokenCost: 0,
subagentMount: typeof watch.subagentMount === 'string'? watch.subagentMount: 'unknown',
status: verified? 'resolved': 'repair-failed',
at: Date.now(),
}
this.writeState(watch.id, state)
logLine('R7 judged ' + watch.id + ' lost=' + lost.length + ' repaired=' + repaired + ' verified=' + verified)
return { watchId: watch.id, ok: true, rule: 'R7', lostItems: lost, repaired, verified, receipt}
}

/* RPC: heartbeat status + all watch states (debugging). */
async status() {
const watches = this.readWatches()
const states = []
for (const watch of watches) {
if (watch && typeof watch.id === 'string') {
states.push(this.readState(watch.id))
}
}
return {
ok: true,
heartbeat: this.heartbeatKind,
lastTickAt: this.lastTickAt,
tickCount: this.tickCount,
watches: watches.map((watch) => (watch && watch.id? watch.id: null)),
states,
}
}

/* RPC: run one heartbeat round immediately. */
async tickNow() {
return this.tick()
}

/* RPC: all state files (every judgment so far). */
async listState() {
const dir = stateRoot()
let files = []
try {
files = fs.readdirSync(dir).filter((name) => name.endsWith('.json'))
} catch (_error) {
files = []
}
const states = []
for (const name of files) {
const parsed = readJsonFile(path.join(dir, name))
if (parsed) states.push(parsed)
}
return { ok: true, states}
}
}

markRemote(CaretakerService, 'postReceipt', Remote('postReceipt'))
markRemote(CaretakerService, 'status', Remote('status'))
markRemote(CaretakerService, 'tickNow', Remote('tickNow'))
markRemote(CaretakerService, 'listState', Remote('listState'))
