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
 * Design (v02 redesign, Linear / Raycast / Things): the panel is a list,
 * not a form. One border only (the card). State is a 6px dot, never text.
 * Rows are clickable — no per-row buttons. Actions are ghost text buttons
 * (6px radius, no border, no fill); red text is reserved for the one
 * destructive action. Copy is cut to what the controls do not already say.
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
      'panel.noFish': '没有在跑的鱼。',
      'panel.hidden': '还有 {n} 条收起来了',
      'panel.t1': '停下这条鱼',
      'panel.waitReceipt': '回执：等我改完',
      'panel.doneReceipt': '回执：改完了',
    };
    const DICT = { zh: COPY, en: COPY };

    // Three type sizes only: 12 primary, 11 secondary, 10 micro-caption.
    // Two text colors only: primary + secondary. Chromatic color appears
    // in exactly three places: the running dot, the decision dot, and the
    // destructive action. 4px spacing base.
    const S = {
      card: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        marginTop: 6,
        padding: '4px 0',
        border: 'none',
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        fontFamily: 'inherit',
        fontSize: 13,
        lineHeight: '18px',
      },
      title: { fontSize: 13, fontWeight: 600, lineHeight: '18px' },
      empty: {
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 12,
        fontWeight: 400,
        lineHeight: '17px',
      },
      hiddenNote: {
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 12,
        fontWeight: 400,
        lineHeight: '17px',
      },
      fishList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      },
      fishRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        height: 40,
        padding: '4px 8px',
        borderRadius: 6,
        cursor: 'pointer',
        transition: 'background-color 150ms ease-out',
      },
      fishRowSelected: {
        background: 'var(--dsw-alias-bg-layer-2)',
      },
      fishName: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: 13,
        fontWeight: 500,
        lineHeight: '18px',
      },
      avatar: {
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 600,
        lineHeight: 1,
        color: 'var(--dsw-alias-label-primary)',
        boxSizing: 'border-box',
      },
      actionBtn: {
        font: 'inherit',
        fontSize: 12,
        fontWeight: 600,
        lineHeight: '16px',
        padding: '6px 12px',
        borderRadius: 6,
        border: '1px solid var(--dsw-alias-border-l2)',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background-color 150ms ease-out',
      },
      actionBtnDanger: {
        border: '1px solid var(--dsw-alias-state-error-primary)',
        color: 'var(--dsw-alias-state-error-primary)',
      },
      actionBtnDisabled: {
        opacity: 0.4,
        cursor: 'default',
      },
      actionRow: {
        display: 'flex',
        gap: 4,
        alignItems: 'center',
      },
      status: {
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 12,
        fontWeight: 400,
        lineHeight: '17px',
      },
    };

    // Hover is progressive enhancement: if the host strips the <style> tag
    // the panel still works, it just has no hover fill.
    const HOVER_CSS =
      '.sa-tk-row:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.sa-tk-btn:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.sa-tk-btn:disabled:hover{background:transparent}' +
      '.sa-avatar-run{animation:sa-avatar-pulse 1.6s ease-out infinite}' +
      '@keyframes sa-avatar-pulse{0%,100%{opacity:1}50%{opacity:.7}}';

    // Avatar carries identity + state (Grok Bot: the avatar IS the status).
    // A circle with the first character of the name on a muted tint; the 2px
    // ring is the state (green running, none idle, dashed external). Running
    // breathes (opacity pulse).
    const AVATAR_TINTS = [
      'rgba(94,106,210,0.16)',
      'rgba(39,166,68,0.14)',
      'rgba(240,191,0,0.16)',
      'rgba(235,87,87,0.14)',
      'rgba(60,174,254,0.14)',
      'rgba(113,112,255,0.14)',
    ];
    function avatarTint(seed) {
      const s = String(seed || '');
      let hash = 0;
      for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
      return AVATAR_TINTS[hash % AVATAR_TINTS.length];
    }
    function Avatar({ label, seed, size, state, pulse }) {
      const initial = String(label || '?').trim().charAt(0) || '?';
      const ring =
        state === 'lost'
          ? 'var(--dsw-alias-state-error-primary)'
          : state === 'waiting'
            ? 'var(--dsw-alias-state-warn-primary)'
            : state === 'running'
              ? 'var(--dsw-alias-state-success-primary)'
              : 'transparent';
      const style = {
        ...S.avatar,
        width: size,
        height: size,
        fontSize: size >= 32 ? 13 : 12,
        borderRadius: state === 'lost' ? 8 : '50%',
        background: avatarTint(seed),
        boxShadow: ring === 'transparent' ? 'none' : '0 0 0 2px ' + ring,
        opacity: state === 'idle' ? 0.55 : 1,
        border: state === 'external' ? '1.5px dashed var(--dsw-alias-label-secondary)' : 'none',
      };
      return h(
        'span',
        { 'aria-hidden': true, className: pulse ? 'sa-avatar-run' : undefined, style },
        initial,
      );
    }

    /** Client projection face for one key on a retained Session. */
    function projectionFace(session, key) {
      try {
        if (!session || !session.projections || typeof session.projections.faceOf !== 'function') return undefined;
        return session.projections.faceOf(key) || undefined;
      } catch (_error) {
        return undefined;
      }
    }

    /** One whole projection value from the retained Session's projection store. */
    function projectionValue(session, key) {
      const face = projectionFace(session, key);
      if (!face || typeof face.getSnapshot !== 'function') return undefined;
      try {
        return face.getSnapshot();
      } catch (_error) {
        return undefined;
      }
    }

    /** The retained Session's live snapshot. */
    function sessionSnapshot(session) {
      try {
        return session && typeof session.getSnapshot === 'function' ? session.getSnapshot() : undefined;
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
        running: !!(snapshot && snapshot.running),
        timingActive: !!(timing && timing.active),
        stats:
          stats && typeof stats === 'object'
            ? { turns: Number(stats.turns) || 0, steps: Number(stats.steps) || 0 }
            : null,
        todos: Array.isArray(todos)
          ? todos.map((item) => ({ content: String((item && item.content) || ''), status: item && item.status }))
          : null,
      };
    }

    /** True when neither an agent turn nor a subagent turn is open. */
    function isIdle(session) {
      const facts = readFacts(session);
      return !facts.running && !facts.timingActive;
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
          if (timer !== null) clearTimeout(timer);
          for (const off of unsubs) {
            try {
              off();
            } catch (_error) {
              /* disposed */
            }
          }
          resolve(value);
        };
        const check = () => {
          if (isIdle(session)) finish(true);
        };
        try {
          unsubs.push(session.subscribe(check));
        } catch (_error) {
          /* best-effort */
        }
        const timingFace = projectionFace(session, 'subagentTiming');
        if (timingFace && typeof timingFace.subscribe === 'function') {
          try {
            unsubs.push(timingFace.subscribe(check));
          } catch (_error) {
            /* best-effort */
          }
        }
        timer = setTimeout(() => finish(false), timeoutMs);
        check();
      });
    }

    /**
     * Stop one fish through the same primitive the Web stop button uses:
     * the retained Session's cancel(). A subagent address routes through
     * subagents/interruptByParent; a top-level session through session/cancel.
     */
    async function stopFish(sessions, target) {
      try {
        return await sessions.using(target, { source: 'superagent-takeover' }, async (reference) => {
          const session = reference && reference.binding ? reference.binding.session : undefined;
          if (!session) return { status: 'failed', error: 'no live session binding' };
          const before = readFacts(session);
          if (!before.running && !before.timingActive) return { status: 'already-idle', facts: before };
          const result = await session.cancel();
          if (!result || result.ok !== true) {
            const failure =
              result && result.error
                ? result.error.message || result.error.code || String(result.error)
                : 'cancel rejected';
            return { status: 'failed', facts: before, error: String(failure) };
          }
          const stopped = await waitIdle(session, 5000);
          return { status: stopped ? 'stopped' : 'still-running', facts: before };
        });
      } catch (error) {
        return { status: 'failed', error: error && error.message ? String(error.message) : String(error) };
      }
    }

    /** Call one Host method of this plugin through the Client connection RPC. */
    async function callHost(ctx, method, args) {
      const connection = ctx.get('connection');
      if (!connection || !connection.rpc || typeof connection.rpc.call !== 'function') {
        throw new Error('no client connection for ' + method);
      }
      const result = await connection.rpc.call('/api', 'superagent-takeover/' + method, { args });
      if (!result || result.ok !== true) {
        const error =
          result && result.error
            ? result.error.message || result.error.code || String(result.error)
            : method + ' failed';
        throw new Error(String(error));
      }
      return result.value !== undefined ? result.value : result;
    }

    /** Fish of the current session, from its subagentCatalog projection. */
    function deriveFish(list, currentSessionId) {
      if (!list || !currentSessionId) return [];
      const projections = list.projectionsBySession || {};
      const stored =
        projections[currentSessionId] && projections[currentSessionId].values
          ? projections[currentSessionId].values
          : undefined;
      const byId = list.byId || {};
      const row = byId[currentSessionId];
      const values = stored || (row && row.projectionValues) || {};
      const catalog = Array.isArray(values.subagentCatalog) ? values.subagentCatalog : [];
      const fish = [];
      for (const entry of catalog) {
        if (!entry || !entry.id) continue;
        const childValues =
          projections[entry.id] && projections[entry.id].values ? projections[entry.id].values : undefined;
        const childSummary = byId[entry.id];
        const timing = childValues && childValues.subagentTiming;
        let running = false;
        if (timing && typeof timing === 'object') running = !!timing.active;
        else if (childSummary && typeof childSummary.running === 'boolean') running = childSummary.running;
        fish.push({
          key: entry.id,
          label: entry.label || entry.id.slice(0, 8),
          external: entry.mode === 'external',
          mode: entry.mode || 'unknown',
          running,
          target:
            entry.mode === 'external'
              ? null
              : {
                  parentSessionId: currentSessionId,
                  childSessionId: entry.id,
                  mode: entry.mode === 'one-shot' || entry.mode === 'continuable' ? entry.mode : 'unknown',
                },
        });
      }
      return fish;
    }

    /** Plain-language outcome for a stop-fish result. */
    function stopStatus(result) {
      if (!result) return '没成';
      if (result.status === 'stopped') return '已停下';
      if (result.status === 'already-idle') return '本来就停着';
      if (result.status === 'still-running') return '叫停了，但还没确认停下';
      return '没停成' + (result.error ? '：' + String(result.error).slice(0, 40) : '');
    }

    function TakeoverPanel(props) {
      const t = props.t;
      const ctx = props.ctx;
      const sessions = props.sessions;
      const list = props.useSessions((state) => state);
      const currentSessionId = props.sessionId;
      const [selected, setSelected] = React.useState(null);
      const [status, setStatus] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const [phase, setPhase] = React.useState('pick');

      const fish = React.useMemo(() => deriveFish(list || {}, currentSessionId), [list, currentSessionId]);
      const shownFish = fish.slice(0, 5);
      const hiddenFish = Math.max(0, fish.length - shownFish.length);
      const current = shownFish.find((f) => f.key === selected) || shownFish.find((f) => f.running) || shownFish[0] || null;

      const record = React.useCallback(
        (step, result) => {
          try {
            callHost(ctx, 'recordResult', { step, result }).catch(() => {
              /* disk record is best-effort */
            });
          } catch (_e) {
            /* ignore */
          }
        },
        [ctx],
      );

      const run = React.useCallback(
        async (step, fn, okText, onOk) => {
          if (busy) return;
          setBusy(true);
          try {
            const result = await fn();
            record(step, result);
            setStatus(typeof okText === 'function' ? okText(result) : okText);
            if (typeof onOk === 'function') onOk(result);
          } catch (error) {
            const message = error && error.message ? String(error.message) : String(error);
            record(step, { status: 'failed', error: message });
            setStatus('没成：' + message.slice(0, 40));
          } finally {
            setBusy(false);
          }
        },
        [busy, record],
      );

      const target = current && current.target ? current.target : null;

      return h(
        'div',
        { style: S.card },
        h('style', null, HOVER_CSS),
        h('div', { style: S.title }, t('panel.title')),
        fish.length === 0
          ? h('div', { style: S.empty }, t('panel.noFish'))
          : h(
              'div',
              { style: S.fishList },
              shownFish.map((f) =>
                h(
                  'div',
                  {
                    key: f.key,
                    className: 'sa-tk-row',
                    role: 'button',
                    'aria-label': f.label,
                    style:
                      current && current.key === f.key
                        ? { ...S.fishRow, ...S.fishRowSelected }
                        : S.fishRow,
                    onClick: () => {
                      setSelected(f.key);
                      setPhase('pick');
                      setStatus('');
                    },
                  },
                  h(Avatar, {
                    label: f.label,
                    seed: f.key,
                    size: 32,
                    state: f.external ? 'external' : f.running ? 'running' : 'idle',
                    pulse: f.running,
                  }),
                  h('span', { style: S.fishName }, f.label),
                ),
              ),
              hiddenFish > 0 ? h('div', { style: S.hiddenNote }, t('panel.hidden', { n: hiddenFish })) : null,
            ),
        h(
          'div',
          { style: S.actionRow },
          phase === 'pick'
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'sa-tk-btn',
                  style:
                    busy || !target
                      ? { ...S.actionBtn, ...S.actionBtnDanger, ...S.actionBtnDisabled }
                      : { ...S.actionBtn, ...S.actionBtnDanger },
                  disabled: busy || !target,
                  onClick: () =>
                    run(
                      '停鱼',
                      () => stopFish(sessions, target),
                      (result) => stopStatus(result),
                      (result) => {
                        if (result.status === 'stopped' || result.status === 'already-idle') setPhase('stopped');
                      },
                    ),
                },
                t('panel.t1'),
              )
            : phase === 'stopped'
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'sa-tk-btn',
                    style: busy ? { ...S.actionBtn, ...S.actionBtnDisabled } : S.actionBtn,
                    disabled: busy,
                    onClick: () =>
                      run(
                        '回执：等我改完',
                        () =>
                          callHost(ctx, 'appendReceipt', {
                            sessionId: currentSessionId,
                            text:
                              '用户接管了' +
                              (current ? current.label : '这条鱼') +
                              '，正在改文件。先别派新鱼，等用户改完我再通知你。',
                          }),
                        '已告诉队长：等你改完',
                        () => setPhase('waiting'),
                      ),
                  },
                  t('panel.waitReceipt'),
                )
              : h(
                  'button',
                  {
                    type: 'button',
                    className: 'sa-tk-btn',
                    style: busy ? { ...S.actionBtn, ...S.actionBtnDisabled } : S.actionBtn,
                    disabled: busy,
                    onClick: () =>
                      run(
                        '回执：改完了',
                        () =>
                          callHost(ctx, 'appendReceipt', {
                            sessionId: currentSessionId,
                            text: '用户改完了，接着写。派一条新鱼，接着我改完的地方写，别重写，别改、别删、别覆盖我改的内容。',
                          }),
                        () => '已交还队长',
                        () => {
                          setPhase('pick');
                          setSelected(null);
                        },
                      ),
                  },
                  t('panel.doneReceipt'),
                ),
        ),
        status ? h('div', { style: S.status, role: 'status' }, status) : null,
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
                (props) => h(TakeoverPanel, { ...props, t, ctx, sessions: ctx.sessions }),
              ),
            ),
          'superagent-takeover: composer dock entry',
        );
      },
    };
  },
});
