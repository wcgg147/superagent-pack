/**
* Client half of the Super Agent takeover panel.
*
* Flow: stop a fish, the user edits the file, the plugin tells the captain
* to resume by appending a receipt (Host appendReceipt). The receipt is the
* only way to tell the captain: session.prompt() on a fish session does not
* work (all three formats fail with "content.some is not a function"), and
* session.prompt() on the captain can resolve as 'answered' with the message
* never landing, so the panel never uses prompt. The resume goes through
* the captain, which dispatches a new fish to continue from the user's edit.
*
* Buttons:
* 停鱼： sessions.using(fish target) + session.cancel() mid-work.
* 读状态： snapshot + projections (todos, sessionStats, subagentTiming)
* + Host readFishMessages (deriveMessages).
* 回执：等我改完 / 回执：改完了： Host appendReceipt to the captain's live
* session. Append does not wake an idle captain; it acts on its own turn.
* 写确认： Host writeConfirm (durable JSON) + readConfirm.
* 探针： Host probeHost for the selected fish (what can the Host do?).
*
* Fish are discovered from the current session's subagentCatalog projection
* (same source the intervention panel uses). A fish target address is
* { parentSessionId, childSessionId, mode} where mode is 'one-shot' or
* 'continuable'. Every action is also sent to the Host recordResult so it
* lands on disk even if the panel closes.
*/
window.__ModuleLoader__.load({
id: 'dsh-superagent-takeover',
factory(require) {
    console.log('[superagent-takeover] factory running');
const React = require('react');
const h = React.createElement;
const NS = 'superagent-takeover';

const COPY = {
'panel.title': '接管',
'panel.hint': '先停鱼，再改文件，再告诉队长续上。',
'panel.noFish': '当前会话没有在跑的鱼。先派一条鱼写个长任务，再回来点。',
'panel.fish': '鱼',
'panel.mode': '模式',
'panel.running': '在跑',
'panel.idle': '停着',
'panel.select': '选这条',
'panel.t1': '停鱼',
'panel.t2': '读状态',
'panel.t5': '写确认',
'panel.waitReceipt': '回执：等我改完',
'panel.doneReceipt': '回执：改完了',
'panel.probe': '探针',
'panel.results': '结果',
'panel.clear': '清空显示',
};
const DICT = { zh: COPY, en: COPY };

const S = {
root: { padding: '10px 12px', fontSize: 13, lineHeight: 1.5},
title: { fontWeight: 700, fontSize: 14, marginBottom: 4},
hint: { color: '#888', fontSize: 12, marginBottom: 8},
fishRow: { display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #eee'},
fishLabel: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'},
btn: { padding: '4px 10px', border: '1px solid #ccc', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13},
btnPrimary: { padding: '4px 10px', border: '1px solid #2563eb', borderRadius: 6, background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13},
btnRow: { display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0'},
results: { marginTop: 8, maxHeight: 260, overflow: 'auto', border: '1px solid #eee', borderRadius: 6, padding: 8, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word'},
};

/** Client projection face for one key on a retained Session. */
function projectionFace(session, key) {
try {
if (!session ||!session.projections || typeof session.projections.faceOf!== 'function') return undefined;
return session.projections.faceOf(key) || undefined;
} catch (_error) {
return undefined;
}
}

/** One whole projection value from the retained Session's projection store. */
function projectionValue(session, key) {
const face = projectionFace(session, key);
if (!face || typeof face.getSnapshot!== 'function') return undefined;
try {
return face.getSnapshot();
} catch (_error) {
return undefined;
}
}

/** The retained Session's live snapshot. */
function sessionSnapshot(session) {
try {
return session && typeof session.getSnapshot === 'function'? session.getSnapshot(): undefined;
} catch (_error) {
return undefined;
}
}

/** What the session had done: running flag, turn/step counts, todos. */
function readFacts(session) {
const snapshot = sessionSnapshot(session);
const timing = projectionValue(session, 'subagentTiming');
const stats = projectionValue(session, 'sessionStats');
const todos = projectionValue(session, 'todos');
return {
running:!!(snapshot && snapshot.running),
timingActive:!!(timing && timing.active),
stats: stats && typeof stats === 'object'
? { turns: Number(stats.turns) || 0, steps: Number(stats.steps) || 0}
: null,
todos: Array.isArray(todos)
? todos.map((item) => ({ content: String((item && item.content) || ''), status: item && item.status}))
: null,
};
}

/** True when neither an agent turn nor a subagent turn is open. */
function isIdle(session) {
const facts = readFacts(session);
return!facts.running &&!facts.timingActive;
}

function waitIdle(session, timeoutMs) {
if (isIdle(session)) return Promise.resolve(true);
return new Promise((resolve) => {
let settled = false;
let timer = null;
const unsubs = [];
const finish = (value) => {
if (settled) return;
settled = true;
if (timer!== null) clearTimeout(timer);
for (const off of unsubs) {
try { off();} catch (_error) { /* disposed */}
}
resolve(value);
};
const check = () => { if (isIdle(session)) finish(true);};
try { unsubs.push(session.subscribe(check));} catch (_error) { /* best-effort */}
const timingFace = projectionFace(session, 'subagentTiming');
if (timingFace && typeof timingFace.subscribe === 'function') {
try { unsubs.push(timingFace.subscribe(check));} catch (_error) { /* best-effort */}
}
timer = setTimeout(() => finish(false), timeoutMs);
check();
});
}

/**
* T1: stop one fish through the same primitive the Web stop button uses:
* the retained Session's cancel(). A subagent address routes through
* subagents/interruptByParent; a top-level session through session/cancel.
*/
async function stopFish(sessions, target) {
try {
return await sessions.using(target, { source: 'superagent-takeover'}, async (reference) => {
const session = reference && reference.binding? reference.binding.session: undefined;
if (!session) return { status: 'failed', error: 'no live session binding'};
const before = readFacts(session);
if (!before.running &&!before.timingActive) return { status: 'already-idle', facts: before};
const result = await session.cancel();
if (!result || result.ok!== true) {
const failure = result && result.error? result.error.message || result.error.code || String(result.error): 'cancel rejected';
return { status: 'failed', facts: before, error: String(failure)};
}
const stopped = await waitIdle(session, 5000);
return { status: stopped? 'stopped': 'still-running', facts: before};
});
} catch (error) {
return { status: 'failed', error: error && error.message? String(error.message): String(error)};
}
}

/**
* T2: read a fish's state. Snapshot + projections from the Client side.
* Host-side deriveMessages is read separately (Host readFishMessages).
*/
async function readFishState(sessions, target) {
try {
return await sessions.using(target, { source: 'superagent-takeover'}, async (reference) => {
const session = reference && reference.binding? reference.binding.session: undefined;
if (!session) return { status: 'failed', error: 'no live session binding'};
const facts = readFacts(session);
const catalog = projectionValue(session, 'subagentCatalog');
return {
status: 'ok',
facts,
hasPrompt: typeof session.prompt === 'function',
hasCancel: typeof session.cancel === 'function',
hasGetSnapshot: typeof session.getSnapshot === 'function',
subagentCatalog: Array.isArray(catalog)? catalog.map((e) => ({ id: e && e.id, label: e && e.label, mode: e && e.mode})): null,
};
});
} catch (error) {
return { status: 'failed', error: error && error.message? String(error.message): String(error)};
}
}

/** Call one Host method of this plugin through the Client connection RPC. */
async function callHost(ctx, method, args) {
const connection = ctx.get('connection');
if (!connection ||!connection.rpc || typeof connection.rpc.call!== 'function') {
throw new Error('no client connection for ' + method);
}
const result = await connection.rpc.call('/api', 'superagent-takeover/' + method, { args});
if (!result || result.ok!== true) {
const error = result && result.error? result.error.message || result.error.code || String(result.error): method + ' failed';
throw new Error(String(error));
}
return result.value!== undefined? result.value: result;
}

/** Fish of the current session, from its subagentCatalog projection. */
function deriveFish(list, currentSessionId) {
if (!list ||!currentSessionId) return [];
const projections = list.projectionsBySession || {};
const stored = projections[currentSessionId] && projections[currentSessionId].values? projections[currentSessionId].values: undefined;
const byId = list.byId || {};
const row = byId[currentSessionId];
const values = stored || (row && row.projectionValues) || {};
const catalog = Array.isArray(values.subagentCatalog)? values.subagentCatalog: [];
const fish = [];
for (const entry of catalog) {
if (!entry ||!entry.id) continue;
const childValues = projections[entry.id] && projections[entry.id].values? projections[entry.id].values: undefined;
const childSummary = byId[entry.id];
const timing = childValues && childValues.subagentTiming;
let running = false;
if (timing && typeof timing === 'object') running =!!timing.active;
else if (childSummary && typeof childSummary.running === 'boolean') running = childSummary.running;
fish.push({
key: entry.id,
label: entry.label || entry.id.slice(0, 8),
external: entry.mode === 'external',
mode: entry.mode || 'unknown',
running,
target: entry.mode === 'external'? null: {
parentSessionId: currentSessionId,
childSessionId: entry.id,
mode: entry.mode === 'one-shot' || entry.mode === 'continuable'? entry.mode: 'unknown',
},
});
}
return fish;
}

function TakeoverPanel(props) {
const t = props.t;
const ctx = props.ctx;
const sessions = props.sessions;
const list = props.useSessions((state) => state);
const currentSessionId = props.sessionId;
const [selected, setSelected] = React.useState(null);
const [results, setResults] = React.useState([]);
const [busy, setBusy] = React.useState(false);

const fish = React.useMemo(() => deriveFish(list || {}, currentSessionId), [list, currentSessionId]);
const current = fish.find((f) => f.key === selected) || fish.find((f) => f.running) || fish[0] || null;

const push = React.useCallback((step, result) => {
setResults((prev) => [{ step, at: new Date().toISOString(), result},...prev].slice(0, 30));
try {
callHost(ctx, 'recordResult', { step, result}).catch(() => { /* disk record is best-effort */});
} catch (_e) { /* ignore */}
}, [ctx]);

const run = React.useCallback(async (step, fn) => {
if (busy) return;
setBusy(true);
try {
const result = await fn();
push(step, result);
} catch (error) {
push(step, { status: 'failed', error: error && error.message? String(error.message): String(error)});
} finally {
setBusy(false);
}
}, [busy, push]);

const target = current && current.target? current.target: null;
const childId = current? current.key: null;
const confirmId = 'takeover-' + String(currentSessionId || '').slice(8, 16) + '-' + String(childId || 'nofish').slice(0, 8);

return h('div', { style: S.root},
h('div', { style: S.title}, t('panel.title')),
h('div', { style: S.hint}, t('panel.hint')),
h('div', { style: { fontSize: 12, color: '#666', marginBottom: 6}}, 'captain: ' + String(currentSessionId || '').slice(0, 20) + '...'),
fish.length === 0
? h('div', null, t('panel.noFish'))
: fish.map((f) => h('div', { key: f.key, style: S.fishRow},
h('span', { style: S.fishLabel}, t('panel.fish') + ' ' + f.label + ' [' + f.mode + '] ' + (f.running? t('panel.running'): t('panel.idle'))),
h('button', {
style: current && current.key === f.key? S.btnPrimary: S.btn,
onClick: () => setSelected(f.key),
disabled: busy,
}, t('panel.select')),
)),
h('div', { style: S.btnRow},
h('button', { style: S.btn, disabled: busy ||!target, onClick: () => run('停鱼', () => stopFish(sessions, target))}, t('panel.t1')),
h('button', { style: S.btn, disabled: busy ||!target, onClick: () => run('读状态', () => readFishState(sessions, target))}, t('panel.t2')),
h('button', { style: S.btn, disabled: busy, onClick: () => run('回执：等我改完', () => callHost(ctx, 'appendReceipt', { sessionId: currentSessionId, text: '用户接管了' + (current ? current.label : '这条鱼') + '，正在改文件。先别派新鱼，等用户改完我再通知你。' }))}, t('panel.waitReceipt')),
h('button', { style: S.btn, disabled: busy, onClick: () => run('回执：改完了', () => callHost(ctx, 'appendReceipt', { sessionId: currentSessionId, text: '用户改完了，接着写。派一条新鱼，接着我改完的地方写，别重写，别改、别删、别覆盖我改的内容。' }))}, t('panel.doneReceipt')),
h('button', { style: S.btn, disabled: busy, onClick: () => run('写确认', () => callHost(ctx, 'writeConfirm', { record: { id: confirmId, kind: 'takeover-confirm', question: '用户改完了，新鱼怎么接着写？', options: ['接着用户改完的地方写，别重写', '按用户改完的版本重写一遍'], fishLabel: current? current.label: '', captainSessionId: currentSessionId } }))}, t('panel.t5')),
h('button', { style: S.btn, disabled: busy, onClick: () => run('读确认', () => callHost(ctx, 'readConfirm', { id: confirmId }))}, '读确认'),
h('button', { style: S.btn, disabled: busy, onClick: () => run('确认列表', () => callHost(ctx, 'listConfirms', {}))}, '确认列表'),
h('button', { style: S.btn, disabled: busy ||!childId, onClick: () => run('探针', () => callHost(ctx, 'probeHost', { sessionId: childId}))}, t('panel.probe')),
h('button', { style: S.btn, disabled: busy ||!childId, onClick: () => run('读鱼消息', () => callHost(ctx, 'readFishMessages', { sessionId: childId}))}, '读鱼消息'),
),
h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center'}},
h('div', { style: { fontWeight: 700}}, t('panel.results')),
h('button', { style: S.btn, onClick: () => setResults([])}, t('panel.clear')),
),
h('div', { style: S.results},
results.length === 0? '(还没有结果)': results.map((r, i) => h('div', { key: i}, r.at.slice(11, 19) + ' ' + r.step + ': ' + JSON.stringify(r.result))),
),
);
}

return {
inject: ['slots', 'locale', 'sessions', 'connection'],
apply(ctx) {
const t = ctx.locale.bind(NS);
ctx.effect(() => ctx.locale.register(NS, DICT), 'superagent-takeover: dictionaries');
ctx.effect(
() =>
ctx.slots.inject('conversation.composer.dock', () =>
ctx.slots.register(
{
name: 'conversation.composer.dock',
id: 'superagent-takeover',
order: 2,
locale: NS,
label: () => t('panel.title'),
inject: () => ({}),
},
(props) => h(TakeoverPanel, {...props, t, ctx, sessions: ctx.sessions}),
),
),
'superagent-takeover: composer dock entry',
);
},
};
},
});
