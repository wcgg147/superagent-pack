/**
 * Host half of the fishtank test-build bundle.
 *
 * The Client half computes the two receipt sentences, the confirmation prompt
 * and the per-fish stop, and renders all of it in the panel. Two separate things
 * must survive a refresh/restart, and they are deliberately kept apart:
 *
 *  - `fishtank/postReceipt` appends ONE plain-text `user/message` (with
 *    `surfaceOp: 'append'`) to a live Session. This is the human-facing record:
 *    the two receipt sentences and the pending-question text, exactly as a
 *    person should read them, with no machine payload mixed in. It lands in the
 *    Session log, survives a refresh, and does not wake the agent.
 *
 *  - `fishtank/recordEvent` writes the machine-readable half of an operation
 *    (operation id, kind, group/fish identity, timestamps, and the text needed to
 *    redraw a receipt) to a small JSON side store keyed by Session id, one file
 *    per Session under the profile home. This is what makes recovery work after
 *    a restart without leaking `{…}` JSON into the chat.
 *
 *  - `fishtank/listPendingQuestions` reads that side store back and returns the
 *    unanswered pending questions (a later record with the same operation id
 *    answered it), the interrupted stops (a `notified` record with no matching
 *    `completed`/`cancel`), and the completed receipt pairs.
 *
 * The stop mechanism and the receipt wording stay in the Client; this half only
 * writes the exact text the Client hands it and keeps the side store. There is
 * no new runtime mechanism: one small append-only JSON file per Session.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import { createUserMessage } from '@deepseek-ai/dsh-llm'

/** Root directory of the durable side store (outside the profile composition). */
function stateRoot() {
  const base = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(base, 'fishtank-state')
}

/** One safe, reversible-enough file name for a Session id. */
function sessionFileName(sessionId) {
  const safe = String(sessionId || '').replace(/[^A-Za-z0-9._-]/g, '_')
  return safe.length > 0 ? safe + '.json' : '_unknown.json'
}

/** Read one Session's recorded events (empty on a missing/corrupt file). */
function readRecords(sessionId) {
  try {
    const text = fs.readFileSync(path.join(stateRoot(), sessionFileName(sessionId)), 'utf8')
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed : []
  } catch (_error) {
    return []
  }
}

/** Replace one Session's recorded events atomically. */
function writeRecords(sessionId, records) {
  const dir = stateRoot()
  fs.mkdirSync(dir, { recursive: true })
  const target = path.join(dir, sessionFileName(sessionId))
  const temporary = target + '.' + process.pid + '.tmp'
  fs.writeFileSync(temporary, JSON.stringify(records))
  fs.renameSync(temporary, target)
}

/**
 * Apply a standard `@Remote` method decorator without decorator syntax.
 * Runs the decorator's initializers once against a throwaway instance, which
 * records the versioned marker on the class prototype exactly as the compiled
 * form does.
 * @param target - Service class owning the method.
 * @param name - public instance method name.
 * @param decorator - a decorator returned by `Remote(...)`.
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

/** Host half: writes the human message and keeps the machine-readable side store. */
export default class FishtankReceiptService extends TypertRemoteService {
  static inject = ['sessions']

  constructor(ctx) {
    super(ctx, 'fishtank')
  }

  /**
   * Append `text` as one plain-text user message on the target's live Session.
   * Only human text is written here — no structured payload. Unchanged by this
   * fix.
   * @param sessionId - Session identity to append to.
   * @param text - the message plain text.
   * @returns `{ ok: true }` on success, otherwise `{ ok: false, code }`.
   */
  async postReceipt(sessionId, text) {
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

  /**
   * Append one machine-readable event for `sessionId` to the durable side store.
   * Never touches the Session log, so nothing machine-shaped shows in chat.
   * @param sessionId - the Session the panel is docked in.
   * @param entry - `{ k, id, kind?, groupKey?, groupTitle?, fishKey?, fishLabel?, n?, others?, q?, text?, at? }`.
   * @returns `{ ok: true }` or `{ ok: false, code }`.
   */
  async recordEvent(sessionId, entry) {
    if (typeof sessionId !== 'string' || sessionId.length === 0) return { ok: false, code: 'missing-session' }
    if (!entry || typeof entry !== 'object' || typeof entry.k !== 'string' || typeof entry.id !== 'string') {
      return { ok: false, code: 'bad-record' }
    }
    try {
      const records = readRecords(sessionId)
      const record = { ...entry }
      if (typeof record.at !== 'number') record.at = Date.now()
      records.push(record)
      // Bound the file so it cannot grow without limit across many operations.
      const trimmed = records.length > 1000 ? records.slice(records.length - 1000) : records
      writeRecords(sessionId, trimmed)
      return { ok: true }
    } catch (error) {
      return { ok: false, code: 'write-failed', message: error && error.message ? String(error.message) : String(error) }
    }
  }

  /**
   * Read one Session's recorded fishtank events back from the durable side store.
   *
   * Returned shape:
   *   {
   *     ok: true,
   *     sessionId,
   *     pending:    [{ id, kind, groupKey, groupTitle, fishKey, fishLabel, n, others, question, at }],
   *     interrupted:[{ id, kind, groupKey, groupTitle, fishKey, fishLabel, at }],
   *     receipts:   [{ id, kind, groupKey, groupTitle, fishKey, fishLabel,
   *                    notifiedText, notifiedAt, completedText, completedAt }],
   *   }
   * A pending question is unanswered until an event with the same operation id
   * records `notified`, `completed` or `cancel`. An interrupted stop is a
   * `notified` event with no matching `completed`/`cancel`.
   *
   * @param sessionId - the Session whose side-store file to read.
   */
  async listPendingQuestions(sessionId) {
    const records = readRecords(sessionId)
    const byId = new Map()
    for (const record of records) {
      if (!record || typeof record.k !== 'string' || typeof record.id !== 'string') continue
      const bucket = byId.get(record.id) || []
      bucket.push(record)
      byId.set(record.id, bucket)
    }

    const pending = []
    const interrupted = []
    const receipts = []
    for (const [id, bucket] of byId) {
      const kinds = new Set(bucket.map((record) => record.k))
      const pendingRecord = bucket.find((record) => record.k === 'pending')
      const notifiedRecord = bucket.find((record) => record.k === 'notified')
      const completedRecord = bucket.find((record) => record.k === 'completed')

      if (pendingRecord && !kinds.has('notified') && !kinds.has('completed') && !kinds.has('cancel')) {
        pending.push({
          id,
          kind: pendingRecord.kind,
          groupKey: pendingRecord.groupKey,
          groupTitle: pendingRecord.groupTitle || '',
          fishKey: pendingRecord.fishKey || null,
          fishLabel: pendingRecord.fishLabel || null,
          n: Number(pendingRecord.n) || 0,
          others: Array.isArray(pendingRecord.others) ? pendingRecord.others : [],
          question: typeof pendingRecord.q === 'string' ? pendingRecord.q : pendingRecord.text || '',
          at: typeof pendingRecord.at === 'number' ? pendingRecord.at : 0,
        })
      }

      if (notifiedRecord && !completedRecord && !kinds.has('cancel')) {
        interrupted.push({
          id,
          kind: notifiedRecord.kind,
          groupKey: notifiedRecord.groupKey,
          groupTitle: notifiedRecord.groupTitle || '',
          fishKey: notifiedRecord.fishKey || null,
          fishLabel: notifiedRecord.fishLabel || null,
          at: typeof notifiedRecord.at === 'number' ? notifiedRecord.at : 0,
        })
      }

      if (notifiedRecord && completedRecord) {
        receipts.push({
          id,
          kind: completedRecord.kind || notifiedRecord.kind,
          groupKey: completedRecord.groupKey || notifiedRecord.groupKey,
          groupTitle: completedRecord.groupTitle || notifiedRecord.groupTitle || '',
          fishKey: completedRecord.fishKey || notifiedRecord.fishKey || null,
          fishLabel: completedRecord.fishLabel || notifiedRecord.fishLabel || null,
          notifiedText: typeof notifiedRecord.text === 'string' ? notifiedRecord.text : '',
          notifiedAt: typeof notifiedRecord.at === 'number' ? notifiedRecord.at : 0,
          completedText: typeof completedRecord.text === 'string' ? completedRecord.text : '',
          completedAt: typeof completedRecord.at === 'number' ? completedRecord.at : 0,
        })
      }
    }

    return { ok: true, sessionId, pending, interrupted, receipts }
  }
}

markRemote(FishtankReceiptService, 'postReceipt', Remote('postReceipt'))
markRemote(FishtankReceiptService, 'recordEvent', Remote('recordEvent'))
markRemote(FishtankReceiptService, 'listPendingQuestions', Remote('listPendingQuestions'))
