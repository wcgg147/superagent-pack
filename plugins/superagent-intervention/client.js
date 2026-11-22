window.__ModuleLoader__.load({
  id: 'dsh-superagent-intervention',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const NS = 'superagent-intervention';

    // The intervention copy is fixed Chinese product text: the buttons read
    // “先停下 / 确定停 / 取消” and every receipt line keeps the established
    // “停了，做了…，没做…” wording. It is still routed through the Client
    // locale service, so a later translation pass only replaces this dictionary.
    const COPY = {
      'panel.title': '鱼缸',
      'panel.total': '{groups} 组 · {fish} 条鱼',
      'panel.empty': '还没养鱼，说一句话开始。',
      'panel.hidden': '还有 {n} 条收起来了',
      'group.stop': '先停下',
      'group.stopping': '在停…',
      'group.preparing': '记一下…',
      'group.confirmStop': '确定停',
      'group.cancel': '取消',
      'fish.self': '本组任务',
      'fish.stop': '先停下',
      'receipt.captionNotified': '已通知',
      'receipt.captionCompleted': '已改完',
      'receipt.summary': '停了：{group}（{scope}）。{untouched}没动。',
      'receipt.summaryOnly': '停了：{group}（{scope}）。',
      'receipt.summaryPartial': '叫停了：{group}（{scope}，{failed} 个没停住）。{untouched}没动。',
      'receipt.summaryPartialOnly': '叫停了：{group}（{scope}，{failed} 个没停住）。',
      'receipt.count': '{n} 条鱼',
      'receipt.stopped': '停了，做了{did}，没做{notDone}。',
      'receipt.already': '没动（本来就停着），之前做了{did}。',
      'receipt.alreadyUnknown': '没动（本来就停着）。',
      'receipt.failed': '没停成（{reason}），做了{did}，没做{notDone}。',
      'receipt.stillRunning': '叫停了但没确认停下（还在跑），做了{did}，没做{notDone}。',
      'receipt.unconfirmed': '叫停了，但看不到它自己的运行状态，没确认停下，做了{did}，没做{notDone}。',
      'receipt.external': '停不了（外部执行，没有本地会话可以停）。',
      'receipt.continuation': '不再继续，之后要再做，得重新说一声。',
      'receipt.did.unknown': '看不到做了什么',
      'receipt.did.noStats': '看不到跑了多少轮',
      'receipt.did.noTurns': '还没跑完一轮',
      'receipt.did.turns': '跑完 {turns} 轮（{steps} 步）',
      'receipt.did.todos': '完成待办：{items}',
      'receipt.notDone.unknown': '看不到没做什么',
      'receipt.notDone.pending': '还有 {n} 项待办没动：{items}',
      'receipt.notDone.active': '{n} 项做到一半：{items}',
      'receipt.notDone.interrupted': '被叫停时正在跑的那一轮没跑完，结果没交回',
      'receipt.notDone.none': '没有记录到未完成项',
      'receipt.more': ' 等',
      'receipt.sep': '，',
      'receipt.colon': '：',
      'notify.group': '{group}这组已通知停下。',
      'notify.groupOthers': '{group}这组已通知停下，{others}没动。',
      'notify.fish': '{fish}已通知停下。',
      'notify.fishOthers': '{fish}已通知停下，{others}不动。',
      'pending.group': "要停'{group}'这组（{n} 条鱼）吗？",
      'pending.groupOthers': "要停'{group}'这组（{n} 条鱼）吗？{others}不动。",
      'pending.fish': "要停'{fish}'这条鱼吗？",
      'pending.fishOthers': "要停'{fish}'这条鱼吗？{others}不动。",
      'pending.resume': '刚才那个问题没答完，你继续',
      'pending.lost': '刚才问你的那个问题丢了，你再说一句',
      'pending.cancelled': '已取消。',
    };

    const DICT = { zh: COPY, en: COPY };

    /** Stable scope key for a fish receipt / pending question. */
    function fishScope(groupId, fishKey) {
      return groupId + '::' + fishKey;
    }

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
      header: {
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 8,
      },
      title: { fontSize: 13, fontWeight: 600, lineHeight: '18px' },
      total: {
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 12,
        fontWeight: 400,
        lineHeight: '17px',
      },
      empty: {
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 12,
        fontWeight: 400,
        lineHeight: '17px',
      },
      banner: {
        color: 'var(--dsw-alias-state-error-primary)',
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
      group: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      },
      groupRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 28,
      },
      groupTitle: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        overflow: 'hidden',
        flex: '1 1 auto',
        minWidth: 0,
        fontSize: 13,
        fontWeight: 600,
        lineHeight: '18px',
      },
      groupTitleText: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      iconBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        padding: 0,
        borderRadius: 6,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        flex: 'none',
        transition: 'background-color 150ms ease-out',
      },
      iconBtnDanger: {
        color: 'var(--dsw-alias-state-error-primary)',
      },
      iconBtnSecondary: {
        color: 'var(--dsw-alias-label-secondary)',
      },
      iconBtnDisabled: {
        opacity: 0.4,
        cursor: 'default',
      },
      textBtn: {
        font: 'inherit',
        fontSize: 12,
        fontWeight: 500,
        lineHeight: '16px',
        padding: '4px 10px',
        borderRadius: 6,
        border: 'none',
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background-color 150ms ease-out',
      },
      textBtnSecondary: {
        color: 'var(--dsw-alias-label-secondary)',
      },
      confirmYes: {
        border: '1px solid var(--dsw-alias-state-error-primary)',
        color: 'var(--dsw-alias-state-error-primary)',
        fontWeight: 600,
      },
      confirmBox: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '8px 10px',
        borderRadius: 6,
        background: 'var(--dsw-alias-bg-layer-2)',
      },
      confirmResume: {
        color: 'var(--dsw-alias-state-warn-primary)',
        fontSize: 12,
        fontWeight: 400,
        lineHeight: '17px',
      },
      confirmQuestion: {
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 12,
        fontWeight: 500,
        lineHeight: '17px',
      },
      confirmRow: {
        display: 'flex',
        gap: 4,
        alignItems: 'center',
      },
      lostBox: {
        color: 'var(--dsw-alias-state-error-primary)',
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
        transition: 'background-color 150ms ease-out',
      },
      fishRowActive: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '6px 8px',
        borderRadius: 6,
        transition: 'background-color 150ms ease-out',
      },
      fishText: {
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        minWidth: 0,
      },
      fishName: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flex: '1 1 auto',
        minWidth: 0,
        fontSize: 13,
        fontWeight: 500,
        lineHeight: '18px',
      },
      fishDetail: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: 12,
        fontWeight: 400,
        lineHeight: '17px',
        color: 'var(--dsw-alias-label-secondary)',
      },
      fishBtnGroup: {
        display: 'flex',
        gap: 4,
        flex: 'none',
        alignSelf: 'center',
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
      askBox: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
        padding: '6px 8px',
        borderRadius: 6,
        background: 'var(--dsw-alias-bg-layer-2)',
      },
      askInput: {
        flex: '1 1 auto',
        minWidth: 0,
        border: 'none',
        outline: 'none',
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        fontSize: 12,
        lineHeight: '17px',
        padding: 0,
      },
      askSend: {
        font: 'inherit',
        fontSize: 12,
        fontWeight: 500,
        lineHeight: '16px',
        padding: '4px 8px',
        borderRadius: 6,
        border: 'none',
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      },
      receipt: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '8px 10px',
        borderRadius: 6,
        background: 'var(--dsw-alias-bg-layer-2)',
      },
      receiptPart: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      },
      receiptCaption: {
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.04em',
        lineHeight: '14px',
      },
      receiptLineFirst: {
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 12,
        fontWeight: 600,
        lineHeight: '17px',
        wordBreak: 'break-word',
      },
      receiptLineText: {
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 12,
        fontWeight: 400,
        lineHeight: '17px',
        wordBreak: 'break-word',
      },
    };

    // Hover is progressive enhancement: if the host strips the <style> tag
    // the panel still works, it just has no hover fill.
    const HOVER_CSS =
      '.sa-ft-fishrow:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.sa-ft-btn:hover{background:var(--dsw-alias-bg-layer-2)}' +
      '.sa-ft-btn:disabled:hover{background:transparent}' +
      '.sa-ft-btn-ask{opacity:0;transition:opacity 150ms ease-out}' +
      '.sa-ft-fishrow:hover .sa-ft-btn-ask{opacity:1}' +
      '.sa-ft-btn-stop{opacity:0;transition:opacity 150ms ease-out}' +
      '.sa-ft-fishrow:hover .sa-ft-btn-stop{opacity:1}' +
      '.sa-ft-btn-group{opacity:0;transition:opacity 150ms ease-out}' +
      '.sa-ft-grouprow:hover .sa-ft-btn-group{opacity:1}' +
      '.sa-avatar-run{animation:sa-avatar-pulse 1.6s ease-out infinite}' +
      '@keyframes sa-avatar-pulse{0%,100%{opacity:1}50%{opacity:.7}}';

    /** Short stable display fallback for an opaque id. */
    function shortId(id) {
      const text = String(id || '');
      return text.length > 10 ? text.slice(0, 8) + '…' : text;
    }

    /** Join up to `limit` item contents, ending with the locale's "and more" marker. */
    function listNames(t, items, limit) {
      const names = items
        .map((item) => (item && typeof item.content === 'string' ? item.content.trim() : ''))
        .filter((text) => text.length > 0);
      if (names.length === 0) return '';
      if (names.length <= limit) return names.join(t('receipt.sep'));
      return names.slice(0, limit).join(t('receipt.sep')) + t('receipt.more');
    }

    /** The Client projection face for one key on a retained Session, when available. */
    function projectionFace(session, key) {
      try {
        if (!session || !session.projections || typeof session.projections.faceOf !== 'function') return undefined;
        return session.projections.faceOf(key) || undefined;
      } catch (_error) {
        return undefined;
      }
    }

    /** One whole projection value from the retained Session's own projection store. */
    function projectionValue(session, key) {
      const face = projectionFace(session, key);
      if (!face || typeof face.getSnapshot !== 'function') return undefined;
      try {
        return face.getSnapshot();
      } catch (_error) {
        return undefined;
      }
    }

    /** The retained Session's live snapshot, when it is available. */
    function sessionSnapshot(session) {
      try {
        return session && typeof session.getSnapshot === 'function' ? session.getSnapshot() : undefined;
      } catch (_error) {
        return undefined;
      }
    }

    /**
     * What the session had actually done at this instant: durable turn/step counts,
     * its current todo list, and whether a turn is still open.
     */
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
          ? todos.map((item) => ({
              content: String((item && item.content) || ''),
              status: item && item.status,
            }))
          : null,
      };
    }

    /** True when neither an agent turn nor a subagent turn is open. */
    function isIdle(session) {
      const facts = readFacts(session);
      return !facts.running && !facts.timingActive;
    }

    /**
     * Resolve when the session's own observable state goes idle, or when the bound
     * elapsed. No polling: both signals are snapshot stores owned by the framework.
     */
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
              /* a disposed face is already forgotten */
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
          /* snapshot subscription is best-effort; the bound still decides */
        }
        const timingFace = projectionFace(session, 'subagentTiming');
        if (timingFace && typeof timingFace.subscribe === 'function') {
          try {
            unsubs.push(timingFace.subscribe(check));
          } catch (_error) {
            /* same */
          }
        }
        timer = setTimeout(() => finish(false), timeoutMs);
        check();
      });
    }

    /**
     * Resolve when the session starts running (its own turn or a subagent turn),
     * or when the bound elapsed. Snapshot stores, no polling.
     */
    function waitRunning(session, timeoutMs) {
      if (!isIdle(session)) return Promise.resolve(true);
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
              /* disposed face */
            }
          }
          resolve(value);
        };
        const check = () => {
          if (!isIdle(session)) finish(true);
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
     * Stop exactly one running unit through the same primitive the Web stop button
     * uses: the retained Session's `cancel()`. A subagent address routes that call
     * through `subagents/interruptByParent`; a top-level session through
     * `session/cancel` -> `agent.cancel({ kind: 'user' }, { keepInbox: true })`.
     *
     * `wakeWaitMs` covers the case where this group's parent turn already ended
     * while its fish ran: interrupting those fish wakes the parent for a report
     * turn, so we catch that wake and stop it too. `idle` means it never woke.
     */
    async function stopOne(sessions, target, expectedRunning, wakeWaitMs) {
      try {
        return await sessions.using(target, { source: 'fishtank' }, async (reference) => {
          const session = reference && reference.binding ? reference.binding.session : undefined;
          if (!session) return { status: 'failed', facts: null, error: 'no live session binding' };
          let before = readFacts(session);
          let wasRunning = expectedRunning === true || before.running || before.timingActive;
          if (!wasRunning && wakeWaitMs > 0) {
            const woke = await waitRunning(session, wakeWaitMs);
            if (!woke) return { status: 'idle', facts: before };
            before = readFacts(session);
            wasRunning = before.running || before.timingActive;
          }
          if (!wasRunning) return { status: 'already', facts: before };
          const result = await session.cancel();
          if (!result || result.ok !== true) {
            const failure = result && result.error ? result.error.message || result.error.code || String(result.error) : 'cancel rejected';
            return { status: 'failed', facts: before, error: String(failure) };
          }
          const observable = before.running || before.timingActive;
          const stopped = await waitIdle(session, 4000);
          if (!observable) return { status: 'unconfirmed', facts: before };
          return { status: stopped ? 'stopped' : 'still-running', facts: before };
        });
      } catch (error) {
        return { status: 'failed', facts: null, error: error && error.message ? String(error.message) : String(error) };
      }
    }

    /**
     * Ask-test only: deliver one question to a session through its `prompt()`.
     * prompt() wakes an idle session with a new turn; it throws when a prompt is
     * already in flight ("a prompt is already in flight"). The answer itself
     * lands in the session and shows in chat; this only reports the outcome.
     */
    async function askCaptainPrompt(sessions, sessionId, question) {
      try {
        return await sessions.using(sessionId, { source: 'superagent-ask' }, async (reference) => {
          const session = reference && reference.binding ? reference.binding.session : undefined;
          if (!session) return { status: 'failed', error: 'no live session binding' };
          if (typeof session.prompt !== 'function') return { status: 'failed', error: 'session.prompt is not a function' };
          await session.prompt(
            { sessionId, prompt: [{ type: 'text', text: question }] },
            false,
          );
          return { status: 'answered' };
        });
      } catch (error) {
        return { status: 'failed', error: error && error.message ? String(error.message) : String(error) };
      }
    }

    /**
     * Stop one group: every live subagent ("fish") of that top-level session through
     * `cancel()` on its subagent address, then that session's own active turn through
     * its ordinary `cancel()`. Returns the real, observed outcome per unit.
     */
    async function stopGroup(sessions, group, others) {
      const lines = [];
      const realFish = group.fish.filter((fish) => !fish.self);

      const selfFish = group.fish.find((fish) => fish.self);
      if (selfFish) {
        const outcome = await stopOne(sessions, group.id, selfFish.running, 0);
        lines.push({ key: group.id, kind: 'self', status: outcome.status, facts: outcome.facts, error: outcome.error });
      }

      const fishOutcomes = await Promise.all(
        realFish.map(async (fish) => {
          if (fish.external) {
            return { key: fish.key, kind: 'fish', label: fish.label, status: 'external', facts: null };
          }
          const outcome = await stopOne(sessions, fish.target, fish.running, 0);
          return { key: fish.key, kind: 'fish', label: fish.label, status: outcome.status, facts: outcome.facts, error: outcome.error };
        }),
      );
      for (const line of fishOutcomes) lines.push(line);

      if (!selfFish && realFish.some((fish) => !fish.external)) {
        // A parent whose turn already ended can be woken by its interrupted fish;
        // stop that wake too so the group really ends up stopped.
        const outcome = await stopOne(sessions, group.id, group.running, 2500);
        if (outcome.status !== 'idle') {
          lines.unshift({ key: group.id, kind: 'self', status: outcome.status, facts: outcome.facts, error: outcome.error });
        }
      }

      return {
        groupId: group.id,
        groupTitle: group.title,
        others: (others || []).map((other) => other.title),
        fishCount: realFish.length,
        lines,
        at: Date.now(),
      };
    }

    /** One line of "did / did not" sourced only from the session's own projections. */
    function didText(t, facts) {
      if (!facts) return t('receipt.did.unknown');
      const parts = [];
      if (!facts.stats) {
        parts.push(t('receipt.did.noStats'));
      } else if (facts.stats.turns > 0) {
        parts.push(t('receipt.did.turns', { turns: facts.stats.turns, steps: facts.stats.steps }));
      } else {
        parts.push(t('receipt.did.noTurns'));
      }
      if (facts.todos) {
        const completed = facts.todos.filter((todo) => todo.status === 'completed');
        if (completed.length > 0) parts.push(t('receipt.did.todos', { items: listNames(t, completed, 2) }));
      }
      return parts.join(t('receipt.sep'));
    }

    /** What the session had not finished, plus whether its open turn was cut. */
    function notDoneText(t, facts, status) {
      if (!facts) return t('receipt.notDone.unknown');
      const parts = [];
      if (facts.todos) {
        const pending = facts.todos.filter((todo) => todo.status === 'pending');
        const active = facts.todos.filter((todo) => todo.status === 'in_progress');
        if (pending.length > 0) {
          parts.push(t('receipt.notDone.pending', { n: pending.length, items: listNames(t, pending, 3) }));
        }
        if (active.length > 0) {
          parts.push(t('receipt.notDone.active', { n: active.length, items: listNames(t, active, 3) }));
        }
      }
      if (status === 'stopped' || status === 'still-running' || status === 'unconfirmed') {
        parts.push(t('receipt.notDone.interrupted'));
      }
      if (parts.length === 0) parts.push(t('receipt.notDone.none'));
      return parts.join(t('receipt.sep'));
    }

    /** One fish/self receipt line. */
    function lineText(t, line) {
      if (line.status === 'external') return t('receipt.external');
      if (line.status === 'already') {
        return line.facts ? t('receipt.already', { did: didText(t, line.facts) }) : t('receipt.alreadyUnknown');
      }
      const did = didText(t, line.facts);
      if (line.status === 'failed') {
        return t('receipt.failed', { reason: line.error || '?', did, notDone: notDoneText(t, line.facts, 'failed') });
      }
      if (line.status === 'still-running') {
        return t('receipt.stillRunning', { did, notDone: notDoneText(t, line.facts, 'still-running') });
      }
      if (line.status === 'unconfirmed') {
        return t('receipt.unconfirmed', { did, notDone: notDoneText(t, line.facts, 'unconfirmed') });
      }
      return t('receipt.stopped', { did, notDone: notDoneText(t, line.facts, 'stopped') });
    }

    /** The one-sentence receipt: which group stopped / was asked to stop, which did not move. */
    function receiptSummary(t, receipt, currentTitle) {
      const group = currentTitle || receipt.groupTitle;
      const scope = receipt.fishCount > 0 ? t('receipt.count', { n: receipt.fishCount }) : t('fish.self');
      const failed = receipt.lines.filter(
        (line) => line.status === 'failed' || line.status === 'still-running' || line.status === 'external',
      ).length;
      const untouched = (receipt.others || []).filter((title) => typeof title === 'string' && title.length > 0).join(t('receipt.sep')) || '';
      if (failed > 0) {
        return untouched.length > 0
          ? t('receipt.summaryPartial', { group, scope, failed, untouched })
          : t('receipt.summaryPartialOnly', { group, scope, failed });
      }
      return untouched.length > 0
        ? t('receipt.summary', { group, scope, untouched })
        : t('receipt.summaryOnly', { group, scope });
    }

    /** The receipt as one plain-text block: the summary line, then one fish line each. */
    function receiptPlainText(t, receipt, groupTitle) {
      const lines = [receiptSummary(t, receipt, groupTitle)];
      for (const line of receipt.lines) {
        const label = line.kind === 'self' ? t('fish.self') : line.label;
        lines.push(label + t('receipt.colon') + lineText(t, line));
      }
      return lines.join('\n');
    }

    /** The first sentence (已通知) for a whole-group stop. */
    function groupNotifyText(t, group, others) {
      const names = (others || []).map((other) => other.title).filter((name) => typeof name === 'string' && name.length > 0);
      return names.length > 0
        ? t('notify.groupOthers', { group: group.title, others: names.join(t('receipt.sep')) })
        : t('notify.group', { group: group.title });
    }

    /** The first sentence (已通知) for a single-fish stop. */
    function fishNotifyText(t, fish, otherFish) {
      const names = (otherFish || []).map((item) => item.label).filter((name) => typeof name === 'string' && name.length > 0);
      return names.length > 0
        ? t('notify.fishOthers', { fish: fish.label, others: names.join(t('receipt.sep')) })
        : t('notify.fish', { fish: fish.label });
    }

    /** The persisted pending question for stopping a whole group. */
    function groupPendingQuestion(t, group, others) {
      const n = Math.max(1, group.fish.filter((fish) => !fish.self).length);
      const names = (others || []).map((other) => other.title).filter((name) => typeof name === 'string' && name.length > 0);
      return names.length > 0
        ? t('pending.groupOthers', { group: group.title, n, others: names.join(t('receipt.sep')) })
        : t('pending.group', { group: group.title, n });
    }

    /** The persisted pending question for stopping one fish. */
    function fishPendingQuestion(t, group, fish) {
      const names = group.fish
        .filter((item) => !item.self && item.key !== fish.key)
        .map((item) => item.label)
        .filter((name) => typeof name === 'string' && name.length > 0);
      return names.length > 0
        ? t('pending.fishOthers', { fish: fish.label, others: names.join(t('receipt.sep')) })
        : t('pending.fish', { fish: fish.label });
    }

    /**
     * Append one human-readable message to its Session on the Host through this
     * package's Remote endpoint (`fishtank/postReceipt`). Only the text a person
     * should read is written — no machine metadata rides along in the message.
     */
    async function postReceipt(ctx, sessionId, text) {
      const connection = ctx.get('connection');
      if (!connection || !connection.rpc || typeof connection.rpc.call !== 'function') {
        throw new Error('no client connection for postReceipt');
      }
      const result = await connection.rpc.call('/api', 'fishtank/postReceipt', {
        args: { sessionId, text },
      });
      if (!result || result.ok !== true) {
        const error = result && result.error ? result.error.message || result.error.code || String(result.error) : 'postReceipt failed';
        throw new Error(String(error));
      }
      return result.value;
    }

    /**
     * Persist the machine-readable half of one fishtank operation (id, kind,
     * group/fish identity, timestamps) to the Host's durable side store through
     * `fishtank/recordEvent`. It never touches the Session log, so nothing
     * machine-shaped is visible in the chat; `listPendingQuestions` reads it
     * back after a restart.
     */
    async function recordEvent(ctx, sessionId, record) {
      const connection = ctx.get('connection');
      if (!connection || !connection.rpc || typeof connection.rpc.call !== 'function') {
        throw new Error('no client connection for recordEvent');
      }
      const result = await connection.rpc.call('/api', 'fishtank/recordEvent', {
        args: { sessionId, entry: record },
      });
      if (!result || result.ok !== true) {
        const error = result && result.error ? result.error.message || result.error.code || String(result.error) : 'recordEvent failed';
        throw new Error(String(error));
      }
      return result.value;
    }

    /**
     * Read back the persisted fishtank state (unanswered pending questions,
     * interrupted stops, completed receipt pairs) of one Session through
     * `fishtank/listPendingQuestions`, which reads the durable side store. This
     * is the restart-recovery path.
     */
    async function listPendingQuestions(ctx, sessionId) {
      const connection = ctx.get('connection');
      if (!connection || !connection.rpc || typeof connection.rpc.call !== 'function') {
        throw new Error('no client connection for listPendingQuestions');
      }
      const result = await connection.rpc.call('/api', 'fishtank/listPendingQuestions', {
        args: { sessionId },
      });
      if (!result || result.ok !== true) {
        const error = result && result.error ? result.error.message || result.error.code || String(result.error) : 'listPendingQuestions failed';
        throw new Error(String(error));
      }
      return result.value;
    }

    /** Whether a fish is running: its own open-turn projection outranks a synthesized row. */
    function fishIsRunning(childSummary, childValues, parentRunning) {
      // A child row synthesized from the parent's subagent catalog carries a
      // placeholder `running: false`, so its own timing projection comes first.
      const timing = childValues && childValues.subagentTiming;
      if (timing && typeof timing === 'object') return !!timing.active;
      if (childSummary && typeof childSummary.running === 'boolean') return childSummary.running;
      return !!parentRunning;
    }

    /** Short second line for a running fish: its current todo, else its turn count. */
    function fishDetail(values) {
      if (!values || typeof values !== 'object') return '';
      const todos = Array.isArray(values.todos) ? values.todos : null;
      if (todos) {
        const active = todos.find(
          (item) => item && item.status === 'in_progress' && typeof item.content === 'string' && item.content.trim().length > 0,
        );
        if (active) return active.content.trim();
        const pending = todos.find(
          (item) => item && item.status === 'pending' && typeof item.content === 'string' && item.content.trim().length > 0,
        );
        if (pending) return pending.content.trim();
      }
      const stats = values.sessionStats;
      if (stats && typeof stats === 'object' && Number(stats.turns) > 0) {
        return '第 ' + Number(stats.turns) + ' 轮';
      }
      return '';
    }

    /** Best-effort: does this group's projection say something is waiting on the user? */
    function projectionDecision(values) {
      if (!values || typeof values !== 'object') return false;
      for (const key of ['pendingInteraction', 'pendingApproval', 'approval', 'userQuestions', 'pendingQuestions']) {
        const value = values[key];
        if (value === true) return true;
        if (value && typeof value === 'object') {
          if (Array.isArray(value) && value.length > 0) return true;
          if (!Array.isArray(value) && Object.keys(value).length > 0) return true;
        }
      }
      return false;
    }

    /**
     * Turn the live Session projection store into real groups: one top-level Session
     * per user goal, its subagent catalog as the fish. Nothing here is fixture data.
     * A group is live while its own turn runs OR any of its fish still runs — a
     * parent turn routinely ends while its subagents keep working — and it stays
     * visible after a stop only to carry the receipt. It also stays visible when it
     * still owns a pending question, so restart recovery has a row to hang it on.
     */
    function deriveGroups(list, receipts, t, pendingGroupIds) {
      const keep = pendingGroupIds instanceof Set ? pendingGroupIds : new Set();
      const ids = Array.isArray(list.ids) ? list.ids : [];
      const byId = list.byId || {};
      const projections = list.projectionsBySession || {};
      const groups = [];
      for (const id of ids) {
        const row = byId[id];
        if (!row || row.parentId != null || row.origin === 'subagent' || row.blank) continue;
        const stored = projections[id] && projections[id].values ? projections[id].values : undefined;
        const values = stored || row.projectionValues || {};
        const catalog = Array.isArray(values.subagentCatalog) ? values.subagentCatalog : [];
        const running = !!row.running;
        const fish = [];
        for (const entry of catalog) {
          if (!entry || !entry.id) continue;
          const childValues = projections[entry.id] && projections[entry.id].values ? projections[entry.id].values : undefined;
          const childSummary = byId[entry.id];
          const external = entry.mode === 'external';
          fish.push({
            key: entry.id,
            label: entry.label || shortId(entry.id),
            external,
            self: false,
            running: fishIsRunning(childSummary, childValues, running),
            detail: fishDetail(childValues),
            target: external
              ? null
              : {
                  parentSessionId: id,
                  childSessionId: entry.id,
                  mode: entry.mode === 'one-shot' || entry.mode === 'continuable' ? entry.mode : 'unknown',
                },
          });
        }
        if (fish.length === 0) {
          fish.push({
            key: id,
            label: t('fish.self'),
            external: false,
            self: true,
            running,
            target: null,
          });
        }
        const active = running || fish.some((item) => item.running);
        // A group whose last fish was stopped still needs a row so its receipt
        // (keyed by group id or by a fish scope) stays visible after the stop.
        const hasReceipt = !!receipts[id] || Object.keys(receipts).some((key) => key.startsWith(id + '::'));
        if (!active && !hasReceipt && !keep.has(id)) continue;
        groups.push({
          id,
          title: row.displayTitle || row.title || shortId(id),
          running,
          active,
          fish,
          needsDecision: projectionDecision(values),
        });
      }
      return groups;
    }

    // Avatar carries identity + state (Grok Bot: the avatar IS the status).
    // A circle with the first character of the name on a muted tint; the 2px
    // ring is the state (green running, amber waiting, red lost, none idle,
    // dashed external). Lost also turns the circle into a rounded square —
    // shape changes, not just color. Running breathes (opacity pulse).
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

    /** Render one multi-line receipt/sentence block, first line emphasised. */
    function TextLines({ text }) {
      const lines = String(text || '').split('\n');
      return h(
        'div',
        null,
        lines.map((line, index) =>
          h('div', { key: index, style: index === 0 ? S.receiptLineFirst : S.receiptLineText }, line),
        ),
      );
    }

    /** The two-sentence receipt block: 「已通知」 first, then 「已改完」. */
    function Receipt({ entry, t }) {
      return h(
        'div',
        { style: S.receipt, role: 'status' },
        entry.notified
          ? h(
              'div',
              { style: S.receiptPart },
              h('span', { style: S.receiptCaption }, t('receipt.captionNotified')),
              h(TextLines, { text: entry.notified.text }),
            )
          : null,
        entry.completed
          ? h(
              'div',
              { style: S.receiptPart },
              h('span', { style: S.receiptCaption }, t('receipt.captionCompleted')),
              h(TextLines, { text: entry.completed.text }),
            )
          : null,
      );
    }

    function Fishtank(props) {
      const t = props.t;
      const list = props.useSessions((state) => state);
      const stopGroupOnHost = props.stopGroup;
      const stopFishOnHost = props.stopFish;
      const askCaptainOnHost = props.askCaptain;
      const postReceiptOnHost = props.postReceipt;
      const recordEventOnHost = props.recordEvent;
      const listPendingOnHost = props.listPendingQuestions;
      const currentSessionId = props.sessionId;

      const [receipts, setReceipts] = React.useState({});
      const [confirms, setConfirms] = React.useState({});
      const [lost, setLost] = React.useState({});
      const [lostGlobal, setLostGlobal] = React.useState([]);
      const [busy, setBusy] = React.useState({});
      const [preparing, setPreparing] = React.useState({});
      const [recovered, setRecovered] = React.useState(null);
      const [askFor, setAskFor] = React.useState(null);
      const [askText, setAskText] = React.useState('');

      const previousRunning = React.useRef({});
      const busyRef = React.useRef({});
      const inflightRef = React.useRef({});
      const handledRef = React.useRef(new Set());

      // Groups that must stay on screen even when idle and receipt-less: those
      // that still own an unanswered pending question. Without this a restart
      // (nothing running, no receipt) would silently drop the row the recovered
      // question needs to attach to.
      const pendingGroupIds = React.useMemo(() => {
        const keep = new Set();
        for (const record of (recovered && recovered.pending) || []) {
          if (record && typeof record.groupKey === 'string') keep.add(record.groupKey);
        }
        for (const scope of Object.keys(confirms)) {
          keep.add(scope.indexOf('::') >= 0 ? scope.slice(0, scope.indexOf('::')) : scope);
        }
        return keep;
      }, [recovered, confirms]);

      const groups = React.useMemo(
        () => deriveGroups(list || {}, receipts, t, pendingGroupIds),
        [list, receipts, t, pendingGroupIds],
      );

      // A group that starts new work long after a stop is no longer described by
      // that old receipt. A fresh receipt is never cleared by the brief wake of a
      // parent whose fish were just interrupted.
      React.useEffect(() => {
        const current = {};
        for (const group of groups) current[group.id] = group.active;
        const previous = previousRunning.current;
        let changed = false;
        const next = { ...receipts };
        for (const id of Object.keys(next)) {
          const entry = next[id];
          const stamp = entry && entry.completed ? entry.completed.at : entry && entry.notified ? entry.notified.at : 0;
          const fresh = stamp > 0 && Date.now() - stamp < 10000;
          const groupId = id.indexOf('::') >= 0 ? id.slice(0, id.indexOf('::')) : id;
          if (current[groupId] === true && previous[groupId] === false && !fresh) {
            delete next[id];
            changed = true;
          }
        }
        previousRunning.current = current;
        if (changed) setReceipts(next);
      }, [groups, receipts]);

      // On open, ask the Host for anything this Session still has unanswered or
      // interrupted, so a restart does not silently turn a dangling question into
      // a bare "Stopped".
      React.useEffect(() => {
        let alive = true;
        if (!currentSessionId || typeof listPendingOnHost !== 'function') return () => { alive = false; };
        listPendingOnHost(currentSessionId)
          .then((value) => {
            if (alive && value) setRecovered(value);
          })
          .catch((error) => {
            console.error('[superagent-intervention] pending questions not readable:', error);
          });
        return () => { alive = false; };
      }, [currentSessionId]);

      // Reconcile the recovered records against the live groups, exactly once per id.
      React.useEffect(() => {
        if (!recovered) return;
        // Wait until the Session list has actually produced rows; an empty list on
        // first paint must not be mistaken for "the group is gone".
        if (!list || !Array.isArray(list.ids) || list.ids.length === 0) return;
        const groupById = new Map(groups.map((group) => [group.id, group]));
        for (const record of recovered.pending || []) {
          if (handledRef.current.has(record.id)) continue;
          handledRef.current.add(record.id);
          const scope = record.kind === 'fish' ? fishScope(record.groupKey, record.fishKey) : record.groupKey;
          const group = groupById.get(record.groupKey);
          let exists = !!group;
          if (exists && record.kind === 'fish') exists = group.fish.some((fish) => fish.key === record.fishKey);
          if (exists) {
            setConfirms((prev) =>
              prev[scope]
                ? prev
                : {
                    ...prev,
                    [scope]: {
                      id: record.id,
                      kind: record.kind,
                      groupId: record.groupKey,
                      fishKey: record.fishKey || null,
                      question: record.question || '',
                      at: record.at || 0,
                      resumed: true,
                    },
                  },
            );
          } else if (group) {
            setLost((prev) => ({ ...prev, [record.groupKey]: true }));
          } else {
            setLostGlobal((prev) => (prev.includes(record.id) ? prev : [...prev, record.id]));
          }
        }
        for (const record of recovered.interrupted || []) {
          const guard = 'interrupted:' + record.id;
          if (handledRef.current.has(guard)) continue;
          handledRef.current.add(guard);
          const group = groupById.get(record.groupKey);
          if (group && group.active) continue;
          if (group) setLost((prev) => ({ ...prev, [record.groupKey]: true }));
          else setLostGlobal((prev) => (prev.includes(record.id) ? prev : [...prev, record.id]));
        }
        for (const record of recovered.receipts || []) {
          const scope = record.kind === 'fish' ? fishScope(record.groupKey, record.fishKey) : record.groupKey;
          setReceipts((prev) =>
            prev[scope]
              ? prev
              : {
                  ...prev,
                  [scope]: {
                    notified: { text: record.notifiedText || '', at: record.notifiedAt || 0 },
                    completed: { text: record.completedText || '', at: record.completedAt || 0 },
                  },
                },
          );
        }
      }, [recovered, groups]);

      const totalFish = groups.reduce(
        (sum, group) => sum + group.fish.filter((fish) => !fish.self).length,
        0,
      );

      const setScopedBusy = (scope, value) => {
        setBusy((prev) => {
          const next = { ...prev };
          if (value) next[scope] = true;
          else delete next[scope];
          return next;
        });
      };
      const setScopedPreparing = (scope, value) => {
        setPreparing((prev) => {
          const next = { ...prev };
          if (value) next[scope] = true;
          else delete next[scope];
          return next;
        });
      };
      const clearConfirm = (scope) => {
        setConfirms((prev) => {
          if (!(scope in prev)) return prev;
          const next = { ...prev };
          delete next[scope];
          return next;
        });
      };
      const clearLost = (scope) => {
        setLost((prev) => {
          if (!(scope in prev)) return prev;
          const next = { ...prev };
          delete next[scope];
          return next;
        });
      };
      // Once a recovered question is answered (confirmed or cancelled) it must
      // stop pinning an otherwise-idle group on screen.
      const forgetRecovered = (id) => {
        setRecovered((prev) =>
          prev ? { ...prev, pending: (prev.pending || []).filter((record) => record.id !== id) } : prev,
        );
      };

      // Persistence is split in two: the machine-readable record goes to the
      // Host's durable side store (`recordEvent`), while the Session log gets
      // only the human text a person should read (`postReceipt`).
      const record = (meta) => recordEventOnHost(currentSessionId, meta);
      const postHuman = (text) => postReceiptOnHost(currentSessionId, text);

      // ── Confirmation is recorded before any stop happens ──────────────────
      const beginGroupConfirm = (group) => {
        const scope = group.id;
        if (confirms[scope] || inflightRef.current[scope]) return;
        inflightRef.current[scope] = true;
        setScopedPreparing(scope, true);
        const id = 'pending-' + group.id + '-' + Date.now();
        const others = groups.filter((candidate) => candidate.id !== group.id);
        const question = groupPendingQuestion(t, group, others);
        const at = Date.now();
        const meta = {
          k: 'pending',
          id,
          kind: 'group',
          groupKey: group.id,
          groupTitle: group.title,
          fishKey: null,
          fishLabel: null,
          n: Math.max(1, group.fish.filter((fish) => !fish.self).length),
          others: others.map((other) => other.title),
          q: question,
          text: question,
          at,
        };
        record(meta)
          .then(() => {
            clearLost(scope);
            setConfirms((prev) => ({
              ...prev,
              [scope]: { id, kind: 'group', groupId: group.id, fishKey: null, question, at, resumed: false },
            }));
            postHuman(question).catch((error) => {
              console.error('[superagent-intervention] question not shown in chat:', error);
            });
          })
          .catch((error) => {
            // A3 clause b: the question did not land in the durable store, so do
            // NOT offer buttons.
            console.error('[superagent-intervention] pending question not persisted:', error);
            setLost((prev) => ({ ...prev, [scope]: true }));
          })
          .finally(() => {
            delete inflightRef.current[scope];
            setScopedPreparing(scope, false);
          });
      };

      const beginFishConfirm = (group, fish) => {
        if (fish.self || fish.external) return;
        const scope = fishScope(group.id, fish.key);
        if (confirms[scope] || inflightRef.current[scope]) return;
        inflightRef.current[scope] = true;
        setScopedPreparing(scope, true);
        const id = 'pending-' + group.id + '-' + fish.key + '-' + Date.now();
        const question = fishPendingQuestion(t, group, fish);
        const at = Date.now();
        const meta = {
          k: 'pending',
          id,
          kind: 'fish',
          groupKey: group.id,
          groupTitle: group.title,
          fishKey: fish.key,
          fishLabel: fish.label,
          n: 1,
          others: group.fish.filter((item) => !item.self && item.key !== fish.key).map((item) => item.label),
          q: question,
          text: question,
          at,
        };
        record(meta)
          .then(() => {
            clearLost(scope);
            setConfirms((prev) => ({
              ...prev,
              [scope]: { id, kind: 'fish', groupId: group.id, fishKey: fish.key, question, at, resumed: false },
            }));
            postHuman(question).catch((error) => {
              console.error('[superagent-intervention] question not shown in chat:', error);
            });
          })
          .catch((error) => {
            console.error('[superagent-intervention] pending question not persisted:', error);
            setLost((prev) => ({ ...prev, [scope]: true }));
          })
          .finally(() => {
            delete inflightRef.current[scope];
            setScopedPreparing(scope, false);
          });
      };

      // ── Ask one fish: prompt for a question, save it, post it, deliver it ──
      // Ask entry is an inline message composer under the fish (Muse: ask a
      // person, don't operate a console). The question is saved durably
      // (record, kind 'ask'), posted to the captain session as the "asked"
      // receipt, delivered to the captain through session.prompt(), and the
      // "answered" receipt is posted when prompt() resolves. The delivered
      // text names the fish so the captain knows which fish the question is about.
      const askFish = (group, fish, question) => {
        if (fish.self || fish.external) return;
        const label = fish.label || fish.key;
        if (!question || !question.trim()) return;
        const q = question.trim();
        const id = 'ask-' + group.id + '-' + fish.key + '-' + Date.now();
        const at = Date.now();
        record({
          k: 'ask',
          id,
          kind: 'fish',
          groupKey: group.id,
          groupTitle: group.title,
          fishKey: fish.key,
          fishLabel: label,
          q,
          text: q,
          at,
        }).catch(() => {});
        postHuman('已问' + label + '：' + q).catch(() => {});
        askCaptainOnHost(currentSessionId, '[' + label + '] ' + q).then((outcome) => {
          if (outcome.status === 'answered') {
            postHuman('已答完：' + label).catch(() => {});
          } else {
            postHuman('没答上：' + label + ' - ' + (outcome.error || outcome.status)).catch(() => {});
          }
        }).catch((error) => {
          postHuman('没答上：' + label + ' - ' + String(error && error.message ? error.message : error)).catch(() => {});
        });
      };

      // Inline composer submit: send the typed question, then close the composer.
      const submitAsk = (group, fish) => {
        const q = askText.trim();
        if (!q) return;
        setAskFor(null);
        setAskText('');
        askFish(group, fish, q);
      };

      // ── Cancel: do nothing else, record the answer durably and leave a human note ─
      const cancelPending = (scope) => {
        const descriptor = confirms[scope];
        clearConfirm(scope);
        if (!descriptor) return;
        forgetRecovered(descriptor.id);
        const text = t('pending.cancelled');
        record({ k: 'cancel', id: descriptor.id, at: Date.now() }).catch((error) => {
          console.error('[superagent-intervention] cancel not persisted:', error);
        });
        postHuman(text).catch((error) => {
          console.error('[superagent-intervention] cancel not shown in chat:', error);
        });
      };

      // ── Confirmed group stop: first sentence → stop → second sentence ──────
      const runGroupStop = async (group, id) => {
        if (busyRef.current[group.id]) return;
        busyRef.current[group.id] = true;
        setScopedBusy(group.id, true);
        const others = groups.filter((candidate) => candidate.id !== group.id);
        const notifyText = groupNotifyText(t, group, others);
        const notifiedAt = Date.now();
        setReceipts((prev) => ({
          ...prev,
          [group.id]: { notified: { text: notifyText, at: notifiedAt }, completed: prev[group.id] ? prev[group.id].completed : undefined },
        }));
        try {
          await record({ k: 'notified', id, kind: 'group', groupKey: group.id, groupTitle: group.title, text: notifyText, at: notifiedAt });
        } catch (error) {
          console.error('[superagent-intervention] first sentence not recorded:', error);
        }
        try {
          await postHuman(notifyText);
        } catch (error) {
          console.error('[superagent-intervention] first sentence not shown in chat:', error);
        }
        let receipt;
        try {
          receipt = await stopGroupOnHost(group, others);
        } catch (error) {
          receipt = {
            groupId: group.id,
            groupTitle: group.title,
            others: [],
            fishCount: group.fish.filter((fish) => !fish.self).length,
            at: Date.now(),
            lines: [
              {
                key: group.id,
                kind: 'self',
                status: 'failed',
                facts: null,
                error: error && error.message ? String(error.message) : String(error),
              },
            ],
          };
        }
        const completedText = receiptPlainText(t, receipt, group.title) + '\n' + t('receipt.continuation');
        const completedAt = Date.now();
        setReceipts((prev) => ({
          ...prev,
          [group.id]: {
            notified: prev[group.id] && prev[group.id].notified ? prev[group.id].notified : { text: notifyText, at: notifiedAt },
            completed: { text: completedText, at: completedAt },
          },
        }));
        record({ k: 'completed', id, kind: 'group', groupKey: group.id, groupTitle: group.title, text: completedText, at: completedAt }).catch((error) => {
          console.error('[superagent-intervention] second sentence not recorded:', error);
        });
        postHuman(completedText).catch((error) => {
          console.error('[superagent-intervention] second sentence not shown in chat:', error);
        });
        delete busyRef.current[group.id];
        setScopedBusy(group.id, false);
      };

      // ── Confirmed single-fish stop: same two sentences, one fish line ──────
      const runFishStop = async (group, fish, id) => {
        const scope = fishScope(group.id, fish.key);
        if (busyRef.current[scope]) return;
        busyRef.current[scope] = true;
        setScopedBusy(scope, true);
        const otherFish = group.fish.filter((item) => !item.self && item.key !== fish.key);
        const notifyText = fishNotifyText(t, fish, otherFish);
        const notifiedAt = Date.now();
        setReceipts((prev) => ({
          ...prev,
          [scope]: { notified: { text: notifyText, at: notifiedAt }, completed: prev[scope] ? prev[scope].completed : undefined },
        }));
        try {
          await record({
            k: 'notified',
            id,
            kind: 'fish',
            groupKey: group.id,
            groupTitle: group.title,
            fishKey: fish.key,
            fishLabel: fish.label,
            text: notifyText,
            at: notifiedAt,
          });
        } catch (error) {
          console.error('[superagent-intervention] first sentence not recorded:', error);
        }
        try {
          await postHuman(notifyText);
        } catch (error) {
          console.error('[superagent-intervention] first sentence not shown in chat:', error);
        }
        let outcome;
        try {
          outcome = await stopFishOnHost(fish);
        } catch (error) {
          outcome = { status: 'failed', facts: null, error: error && error.message ? String(error.message) : String(error) };
        }
        const receipt = {
          groupId: group.id,
          groupTitle: group.title,
          others: [],
          fishCount: 1,
          at: Date.now(),
          lines: [
            { key: fish.key, kind: 'fish', label: fish.label, status: outcome.status, facts: outcome.facts, error: outcome.error },
          ],
        };
        const completedText = receiptPlainText(t, receipt, group.title) + '\n' + t('receipt.continuation');
        const completedAt = Date.now();
        setReceipts((prev) => ({
          ...prev,
          [scope]: {
            notified: prev[scope] && prev[scope].notified ? prev[scope].notified : { text: notifyText, at: notifiedAt },
            completed: { text: completedText, at: completedAt },
          },
        }));
        record({
          k: 'completed',
          id,
          kind: 'fish',
          groupKey: group.id,
          groupTitle: group.title,
          fishKey: fish.key,
          fishLabel: fish.label,
          text: completedText,
          at: completedAt,
        }).catch((error) => {
          console.error('[superagent-intervention] second sentence not recorded:', error);
        });
        postHuman(completedText).catch((error) => {
          console.error('[superagent-intervention] second sentence not shown in chat:', error);
        });
        delete busyRef.current[scope];
        setScopedBusy(scope, false);
      };

      const confirmPending = (scope) => {
        const descriptor = confirms[scope];
        if (!descriptor) return;
        clearConfirm(scope);
        forgetRecovered(descriptor.id);
        const group = groups.find((candidate) => candidate.id === descriptor.groupId);
        if (!group) {
          setLostGlobal((prev) => (prev.includes(descriptor.id) ? prev : [...prev, descriptor.id]));
          return;
        }
        if (descriptor.kind === 'fish') {
          const fish = group.fish.find((candidate) => candidate.key === descriptor.fishKey);
          if (!fish) {
            setLostGlobal((prev) => (prev.includes(descriptor.id) ? prev : [...prev, descriptor.id]));
            return;
          }
          runFishStop(group, fish, descriptor.id);
          return;
        }
        runGroupStop(group, descriptor.id);
      };

      // ── Ordering: a group (or fish) that needs a decision is pinned first,
      //    then live groups, then stopped ones; at most 5 rows are shown. ─────
      const groupHasDecision = (group) => {
        if (group.needsDecision || confirms[group.id] || lost[group.id]) return true;
        return group.fish.some((fish) => {
          const scope = fishScope(group.id, fish.key);
          return confirms[scope] || lost[scope];
        });
      };
      const orderedGroups = [...groups].sort((a, b) => {
        const da = groupHasDecision(a) ? 0 : 1;
        const db = groupHasDecision(b) ? 0 : 1;
        if (da !== db) return da - db;
        const aa = a.active ? 0 : 1;
        const ab = b.active ? 0 : 1;
        return aa - ab;
      });
      const visibleGroups = orderedGroups.slice(0, 5);
      const hiddenGroups = Math.max(0, orderedGroups.length - visibleGroups.length);

      const renderConfirmBox = (scope) => {
        const descriptor = confirms[scope];
        if (!descriptor) return null;
        return h(
          'div',
          { style: S.confirmBox },
          descriptor.resumed ? h('div', { style: S.confirmResume }, t('pending.resume')) : null,
          h('div', { style: S.confirmQuestion }, descriptor.question),
          h(
            'div',
            { style: S.confirmRow },
            h(
              'button',
              {
                type: 'button',
                className: 'sa-ft-btn',
                style: { ...S.textBtn, ...S.confirmYes },
                onClick: () => confirmPending(scope),
              },
              t('group.confirmStop'),
            ),
            h(
              'button',
              { type: 'button', className: 'sa-ft-btn', style: { ...S.textBtn, ...S.textBtnSecondary }, onClick: () => cancelPending(scope) },
              t('group.cancel'),
            ),
          ),
        );
      };

      return h(
        'section',
        { style: S.card, 'aria-label': t('panel.title') },
        h('style', null, HOVER_CSS),
        h(
          'header',
          { style: S.header },
          h('span', { style: S.title }, t('panel.title')),
          h('span', { style: S.total }, t('panel.total', { groups: groups.length, fish: totalFish })),
        ),
        lostGlobal.length > 0 ? h('div', { style: S.banner, role: 'status' }, t('pending.lost')) : null,
        groups.length === 0 ? h('span', { style: S.empty }, t('panel.empty')) : null,
        visibleGroups.map((group) => {
          const stopped = !group.active;
          const decision = groupHasDecision(group);
          const groupConfirm = confirms[group.id];
          const groupPreparing = !!preparing[group.id];
          const groupBusy = !!busy[group.id];
          const groupDisabled = stopped || groupBusy || groupPreparing || !!groupConfirm;
          const groupLost = !!lost[group.id] || group.fish.some((fish) => !!lost[fishScope(group.id, fish.key)]);
          const groupWaiting = decision || groupBusy || groupPreparing;
          const fishToShow = (() => {
            if (group.fish.length <= 5) return group.fish;
            const pinned = group.fish.filter((fish) => {
              const scope = fishScope(group.id, fish.key);
              return confirms[scope] || lost[scope];
            });
            const rest = group.fish.filter((fish) => !pinned.includes(fish));
            return [...pinned, ...rest].slice(0, 5);
          })();
          const hiddenFish = Math.max(0, group.fish.length - fishToShow.length);
          return h(
            'div',
            { key: group.id, style: S.group },
            h(
              'div',
              { style: S.groupRow, className: 'sa-ft-grouprow' },
              h(Avatar, {
                label: group.title,
                seed: group.id,
                size: 28,
                state: groupLost ? 'lost' : groupWaiting ? 'waiting' : group.active ? 'running' : 'idle',
                pulse: group.active && !groupLost && !groupWaiting,
              }),
              h(
                'span',
                { style: S.groupTitle, title: group.id },
                h('span', { style: S.groupTitleText }, group.title),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'sa-ft-btn sa-ft-btn-group',
                  style: groupDisabled
                    ? { ...S.iconBtn, ...S.iconBtnDanger, ...S.iconBtnDisabled }
                    : { ...S.iconBtn, ...S.iconBtnDanger },
                  disabled: groupDisabled,
                  'aria-label': t('group.stop') + ' — ' + group.title,
                  onClick: () => {
                    beginGroupConfirm(group);
                  },
                },
                h('span', { style: { fontSize: 11, lineHeight: 1 } }, '■'),
              ),
            ),
            renderConfirmBox(group.id),
            lost[group.id]
              ? h('div', { style: S.lostBox, role: 'status' }, t('pending.lost'))
              : null,
            h(
              'div',
              { style: S.fishList },
              fishToShow.map((fish) => {
                const scope = fishScope(group.id, fish.key);
                const fishConfirm = confirms[scope];
                const fishBusy = !!busy[scope];
                const fishPreparing = !!preparing[scope];
                const fishLost = !!lost[scope];
                const fishWaiting = !!fishConfirm || fishBusy || fishPreparing;
                const showStop = !fish.self && !fish.external && (fish.running || fishBusy || fishPreparing || !!fishConfirm);
                const showDetail = fish.running && !!fish.detail;
                const fishDisabled = fish.self || fish.external || !fish.running || fishBusy || fishPreparing || !!fishConfirm;
                return h(
                  React.Fragment,
                  { key: fish.key },
                  h(
                    'div',
                    {
                      className: 'sa-ft-fishrow',
                      style: showDetail ? S.fishRowActive : S.fishRow,
                    },
                    h(Avatar, {
                      label: fish.self ? t('fish.self') : fish.label,
                      seed: fish.key,
                      size: 32,
                      state: fishLost
                        ? 'lost'
                        : fish.external
                          ? 'external'
                          : fishWaiting
                            ? 'waiting'
                            : fish.running
                              ? 'running'
                              : 'idle',
                      pulse: fish.running && !fishLost && !fishWaiting,
                    }),
                    h(
                      'div',
                      { style: S.fishText },
                      h('span', { style: S.fishName, title: fish.key }, fish.self ? t('fish.self') : fish.label),
                      showDetail ? h('div', { style: S.fishDetail }, fish.detail) : null,
                    ),
                    fish.self || fish.external
                      ? null
                      : h(
                          'div',
                          { style: S.fishBtnGroup },
                          h(
                            'button',
                            {
                              type: 'button',
                              className: 'sa-ft-btn sa-ft-btn-ask',
                              style: { ...S.iconBtn, ...S.iconBtnSecondary },
                              'aria-label': '问一句 — ' + fish.label,
                              onClick: () => {
                                setAskFor(scope);
                                setAskText('');
                              },
                            },
                            h('span', { style: { fontSize: 13, fontWeight: 500, lineHeight: 1 } }, '?'),
                          ),
                          showStop
                            ? h(
                                'button',
                                {
                                  type: 'button',
                                  className: 'sa-ft-btn sa-ft-btn-stop',
                                  style: fishDisabled
                                    ? { ...S.iconBtn, ...S.iconBtnDanger, ...S.iconBtnDisabled }
                                    : { ...S.iconBtn, ...S.iconBtnDanger },
                                  disabled: fishDisabled,
                                  'aria-label': t('fish.stop') + ' — ' + fish.label,
                                  onClick: () => {
                                    beginFishConfirm(group, fish);
                                  },
                                },
                                h('span', { style: { fontSize: 11, lineHeight: 1 } }, '■'),
                              )
                            : null,
                        ),
                  ),
                  askFor === scope
                    ? h(
                        'div',
                        { style: S.askBox },
                        h('input', {
                          type: 'text',
                          value: askText,
                          placeholder: '问' + (fish.self ? t('fish.self') : fish.label) + '…',
                          style: S.askInput,
                          autoFocus: true,
                          onChange: (e) => setAskText(e.target.value),
                          onKeyDown: (e) => {
                            if (e.key === 'Enter') submitAsk(group, fish);
                            if (e.key === 'Escape') {
                              setAskFor(null);
                              setAskText('');
                            }
                          },
                        }),
                        h(
                          'button',
                          {
                            type: 'button',
                            style: S.askSend,
                            onClick: () => submitAsk(group, fish),
                          },
                          '发送',
                        ),
                      )
                    : null,
                  renderConfirmBox(scope),
                  lost[scope] ? h('div', { style: S.lostBox, role: 'status' }, t('pending.lost')) : null,
                  receipts[scope] ? h(Receipt, { key: 'fish-receipt:' + scope, entry: receipts[scope], t }) : null,
                );
              }),
            ),
            hiddenFish > 0 ? h('div', { style: S.hiddenNote }, t('panel.hidden', { n: hiddenFish })) : null,
            receipts[group.id]
              ? h(Receipt, { key: 'group-receipt:' + group.id, entry: receipts[group.id], t })
              : null,
          );
        }),
        hiddenGroups > 0 ? h('div', { style: S.hiddenNote }, t('panel.hidden', { n: hiddenGroups })) : null,
      );
    }

    return {
      inject: ['slots', 'locale', 'sessions', 'connection'],
      apply(ctx) {
        const t = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, DICT), 'superagent-intervention: dictionaries');
        ctx.effect(
          () =>
            ctx.slots.inject('conversation.composer.dock', () =>
              ctx.slots.register(
                {
                  name: 'conversation.composer.dock',
                  id: 'superagent-intervention',
                  order: 2,
                  locale: NS,
                  label: () => t('panel.title'),
                  inject: () => ({
                    stopGroup: (group, others) => stopGroup(ctx.sessions, group, others),
                    stopFish: (fish) => stopOne(ctx.sessions, fish.target, fish.running, 0),
                    askCaptain: (sessionId, question) => askCaptainPrompt(ctx.sessions, sessionId, question),
                    postReceipt: (sessionId, text) => postReceipt(ctx, sessionId, text),
                    recordEvent: (sessionId, recordData) => recordEvent(ctx, sessionId, recordData),
                    listPendingQuestions: (sessionId) => listPendingQuestions(ctx, sessionId),
                  }),
                },
                Fishtank,
              ),
            ),
          'superagent-intervention: composer dock entry',
        );
      },
    };
  },
});
