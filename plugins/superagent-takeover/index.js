/**
 * Host half of the Super Agent takeover panel. It answers, from the Host
 * side, what a takeover plugin can and cannot do:
 *
 *  - probeHost: what can the Host do with a fish session? (sessions.get,
 *    method list, ctx.get('session'), deriveMessages). The caretaker
 *    grounding said Host has no cancel/prompt and no SessionController;
 *    this verifies it live against a real fish session.
 *  - readFishMessages: Host-side state read (deriveMessages) for one session.
 *  - recordResult: append one result to the durable results file.
 *  - writeConfirm / readConfirm / listConfirms: confirmation persistence
 *    (step 5). A confirmation is a plain JSON file under the profile home;
 *    it must survive a DSH restart and be readable back afterwards.
 *
 * The stop / resume / prompt mechanics live in the Client (client.js):
 * only the Client has sessions.using + session.cancel() + session.prompt().
 * This half never touches a Session's turn.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import { createUserMessage } from '@deepseek-ai/dsh-llm'

/** Root directory of the takeover state (outside the profile composition). */
function stateRoot() {
  const base = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(base, 'superagent-takeover')
}

function resultsFile() {
  return path.join(stateRoot(), 'results.jsonl')
}

function confirmFile(id) {
  const safe = String(id || '').replace(/[^A-Za-z0-9._-]/g, '_')
  return path.join(stateRoot(), 'confirm-' + (safe.length > 0 ? safe : '_unknown') + '.json')
}

/**
 * Apply a standard `@Remote` method decorator without decorator syntax.
 * (Copied from the fishtank test build; same mechanism.)
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

/** Host half: probes + durable side store. */
export default class TakeoverService extends TypertRemoteService {
  static inject = ['sessions']

  constructor(ctx) {
    super(ctx, 'superagent-takeover')
  }

  /**
   * What can the Host do with one session id? Reports, without side effects:
   * whether sessions.get finds it, which methods the Host Session object has,
   * whether ctx.get('session') yields a SessionController, and what
   * deriveMessages returns. Never appends, never cancels, never prompts.
   */
  async probeHost(sessionId) {
    const out = { sessionId: String(sessionId || ''), at: Date.now() }
    try {
      const s = this.ctx.sessions.get(sessionId)
      out.sessionsGet = s ? 'defined' : 'undefined'
      if (s) {
        out.methods = {}
        for (const m of ['cancel', 'prompt', 'deriveMessages', 'append', 'getSnapshot', 'subscribe']) {
          out.methods[m] = typeof s[m]
        }
        out.header = s.header ? 'defined' : 'undefined'
        try {
          const msgs = s.deriveMessages()
          out.deriveMessages = { ok: true, count: Array.isArray(msgs) ? msgs.length : 'not-array' }
          if (Array.isArray(msgs) && msgs.length > 0) {
            const last = msgs[msgs.length - 1]
            out.deriveMessages.lastKind = last && last.kind ? String(last.kind) : (last && last.type ? String(last.type) : 'unknown')
          }
        } catch (error) {
          out.deriveMessages = { ok: false, error: String(error && error.message ? error.message : error).slice(0, 200) }
        }
      }
    } catch (error) {
      out.sessionsGetError = String(error && error.message ? error.message : error).slice(0, 200)
    }
    try {
      const sc = this.ctx.get('session')
      out.sessionController = sc ? 'defined' : 'undefined-or-null'
      if (sc) {
        out.sessionControllerMethods = {}
        for (const m of ['prompt', 'cancel', 'steer']) {
          out.sessionControllerMethods[m] = typeof sc[m]
        }
      }
    } catch (error) {
      out.sessionControllerError = String(error && error.message ? error.message : error).slice(0, 200)
    }
    return { ok: true, ...out }
  }

  /** Host-side state read: deriveMessages for one session id. */
  async readFishMessages(sessionId) {
    try {
      const s = this.ctx.sessions.get(sessionId)
      if (!s) return { ok: false, code: 'session-not-found' }
      if (typeof s.deriveMessages !== 'function') return { ok: false, code: 'no-deriveMessages' }
      const msgs = s.deriveMessages()
      if (!Array.isArray(msgs)) return { ok: false, code: 'not-array' }
      const tail = msgs.slice(-6).map((m) => {
        const kind = (m && (m.kind || m.type)) || 'unknown'
        let text = ''
        try {
          const content = m && m.content
          if (typeof content === 'string') text = content.slice(0, 120)
          else if (Array.isArray(content)) {
            const part = content.find((p) => p && p.type === 'text' && typeof p.text === 'string')
            if (part) text = part.text.slice(0, 120)
          }
        } catch (_e) { /* best effort */ }
        return { kind: String(kind), text }
      })
      return { ok: true, count: msgs.length, tail }
    } catch (error) {
      return { ok: false, code: 'error', message: String(error && error.message ? error.message : error).slice(0, 200) }
    }
  }

  /**
   * TB: append one plain-text receipt to a LIVE session (the captain's).
   * Same primitive as the fishtank postReceipt: a `user/message` with
   * `surfaceOp: 'append'`. It lands in the Session log, survives a refresh,
   * and does NOT wake the agent - the captain sees it when it next acts.
   * The captain is a top-level session, so ctx.sessions.get finds it while
   * its browser tab is open (unlike a finished fish session).
   * @returns `{ ok: true }` or `{ ok: false, code }`.
   */
  async appendReceipt(sessionId, text) {
    const session = this.ctx.sessions.get(sessionId)
    if (!session) return { ok: false, code: 'session-not-found' }
    if (typeof text !== 'string' || text.length === 0) return { ok: false, code: 'empty-text' }
    const message = createUserMessage({
      content: [{ type: 'text', text }],
      source: { kind: 'user' },
    })
    session.append('user/message', message, { surfaceOp: 'append' })
    return { ok: true }
  }

  /** Append one result to the durable results file. */
  async recordResult(step, result) {
    try {
      const dir = stateRoot()
      fs.mkdirSync(dir, { recursive: true })
      fs.appendFileSync(resultsFile(), JSON.stringify({ step, at: Date.now(), result }) + '\n')
      return { ok: true }
    } catch (error) {
      return { ok: false, code: 'write-failed', message: String(error && error.message ? error.message : error).slice(0, 200) }
    }
  }

  /** Persist one confirmation record (step 5). Plain JSON file, survives restart. */
  async writeConfirm(record) {
    if (!record || typeof record !== 'object' || typeof record.id !== 'string' || record.id.length === 0) {
      return { ok: false, code: 'bad-record' }
    }
    try {
      const dir = stateRoot()
      fs.mkdirSync(dir, { recursive: true })
      const file = confirmFile(record.id)
      fs.writeFileSync(file, JSON.stringify({ ...record, writtenAt: Date.now() }, null, 2))
      return { ok: true, file }
    } catch (error) {
      return { ok: false, code: 'write-failed', message: String(error && error.message ? error.message : error).slice(0, 200) }
    }
  }

  /** Read one persisted confirmation back. */
  async readConfirm(id) {
    try {
      const file = confirmFile(id)
      if (!fs.existsSync(file)) return { ok: false, code: 'not-found' }
      const record = JSON.parse(fs.readFileSync(file, 'utf8'))
      return { ok: true, record }
    } catch (error) {
      return { ok: false, code: 'read-failed', message: String(error && error.message ? error.message : error).slice(0, 200) }
    }
  }

  /** List persisted confirmation files (restart-recovery check). */
  async listConfirms() {
    try {
      const dir = stateRoot()
      fs.mkdirSync(dir, { recursive: true })
      const files = fs.readdirSync(dir).filter((f) => f.startsWith('confirm-'))
      return { ok: true, files }
    } catch (error) {
      return { ok: false, code: 'read-failed', message: String(error && error.message ? error.message : error).slice(0, 200) }
    }
  }
}

markRemote(TakeoverService, 'probeHost', Remote('probeHost'))
markRemote(TakeoverService, 'readFishMessages', Remote('readFishMessages'))
markRemote(TakeoverService, 'appendReceipt', Remote('appendReceipt'))
markRemote(TakeoverService, 'recordResult', Remote('recordResult'))
markRemote(TakeoverService, 'writeConfirm', Remote('writeConfirm'))
markRemote(TakeoverService, 'readConfirm', Remote('readConfirm'))
markRemote(TakeoverService, 'listConfirms', Remote('listConfirms'))
