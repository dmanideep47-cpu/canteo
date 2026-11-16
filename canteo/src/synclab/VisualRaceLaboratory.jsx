import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChefHat, CircleHelp, LockKeyhole, Pause, Play, RotateCcw, SkipForward, Utensils } from 'lucide-react';
import { createRaceState, getRaceOutcome, RACE_ORDERS, RACE_STEP_COUNTS, stepRaceState } from './RaceConditionDemo.js';
import './raceLab.css';

const FOOD_SPRITE = '/synclab/canteen-dishes.png';

function FoodImage({ order, compact = false }) {
  const [failed, setFailed] = useState(false);
  if (!order) return <div className={`race-food race-food-empty ${compact ? 'compact' : ''}`} aria-hidden="true"><Utensils size={17} /></div>;
  const [column, row] = order.crop;
  return <div className={`race-food ${compact ? 'compact' : ''} ${failed ? 'fallback' : ''}`} role="img" aria-label={`${order.name} thumbnail`}>
    {failed ? <Utensils size={18} aria-hidden="true" /> : <img src={FOOD_SPRITE} alt="" draggable="false" onError={() => setFailed(true)} style={{ left: `${column * -100}%`, top: `${row * -100}%` }} />}
  </div>;
}

function Worker({ id, worker, mutexOwner, mutexWaiter, active }) {
  const assigned = worker.assigned;
  const waiting = mutexWaiter === id;
  const readOrder = RACE_ORDERS.find((order) => order.id === worker.localRead) ?? null;
  return <article className={`race-worker ${active ? 'is-active' : ''}`} aria-label={`Kitchen worker ${id}`}>
    <div className="race-worker-heading">
      <div className="race-chef-icon"><ChefHat size={19} /></div>
      <div><span className="race-worker-id">KITCHEN WORKER</span><h3>{id}</h3></div>
      {(waiting || mutexOwner === id) && <span className={`race-status ${waiting ? 'waiting' : 'locked'}`}>{waiting ? 'Waiting for mutex' : 'Owns mutex'}</span>}
    </div>
    <p className="race-action-line"><i aria-hidden="true" />{worker.action}</p>
    <div className="race-order-display">
      <FoodImage order={assigned ?? readOrder} />
      <div className="race-order-copy">
        <span>LOCAL READ · {worker.localRead ?? '—'}</span>
        <strong>{assigned ? `ASSIGNED · ${assigned.id}` : 'NOT ASSIGNED'}</strong>
        <p>{assigned?.name ?? readOrder?.name ?? 'The worker has not read the queue.'}</p>
        {worker.stale && <em className="race-stale">Earlier read is stale</em>}
      </div>
    </div>
  </article>;
}

export function VisualRaceLaboratory({ activeSection = 'race' }) {
  const [mode, setMode] = useState('unsafe');
  const [state, setState] = useState(() => createRaceState('unsafe'));
  const stateRef = useRef(state);
  const timerRef = useRef(null);
  const playingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [answer, setAnswer] = useState(null);
  const count = RACE_STEP_COUNTS[mode];
  const complete = state.step >= count;
  const outcome = getRaceOutcome(state);

  const commit = useCallback((next) => { stateRef.current = next; setState(next); }, []);
  const stop = useCallback(() => {
    playingRef.current = false;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setIsPlaying(false);
  }, []);
  const advance = useCallback(() => {
    const current = stateRef.current;
    if (current.step >= RACE_STEP_COUNTS[current.mode]) return false;
    commit(stepRaceState(current));
    return true;
  }, [commit]);
  const reset = useCallback((nextMode = mode) => {
    stop();
    setMode(nextMode);
    setSelectedSlot(null);
    setAnswer(null);
    commit(createRaceState(nextMode));
  }, [commit, mode, stop]);

  useEffect(() => {
    if (!isPlaying || activeSection !== 'race') return undefined;
    const tick = () => {
      if (!playingRef.current || activeSection !== 'race') return;
      if (!advance() || stateRef.current.step >= RACE_STEP_COUNTS[stateRef.current.mode]) { stop(); return; }
      timerRef.current = window.setTimeout(tick, 1100);
    };
    timerRef.current = window.setTimeout(tick, 1100);
    return () => { if (timerRef.current !== null) window.clearTimeout(timerRef.current); timerRef.current = null; };
  }, [activeSection, advance, isPlaying, stop]);

  useEffect(() => {
    if (activeSection === 'race') return undefined;
    const stopPlayback = window.setTimeout(stop, 0);
    return () => window.clearTimeout(stopPlayback);
  }, [activeSection, stop]);

  const togglePlay = () => {
    if (isPlaying) { stop(); return; }
    if (complete) reset(mode);
    playingRef.current = true;
    setIsPlaying(true);
  };
  const handleNext = () => {
    if (isPlaying || complete) return;
    advance();
  };
  const handleAnswer = (choice) => setAnswer(choice);

  const explanation = state.last?.explanation ?? (mode === 'unsafe'
    ? 'Two workers can read the same queue head before either assignment updates the shared pointer.'
    : 'The mutex allows one worker at a time to read and update the shared queue.');
  const detail = state.last?.detail ?? 'Ready: shared read pointer = slot 0';
  const activeWorker = state.last?.actor;
  const focusSlot = selectedSlot ?? state.last?.slot ?? state.readPosition;

  return <main className="sl-section-content sl-race-lab" aria-labelledby="race-lab-title">
    <header className="race-intro">
      <div><span className="sl-eyebrow">04 / RACE CONDITION LABORATORY</span><h2 id="race-lab-title">One queue. Two kitchen workers.</h2></div>
      <p>Watch two workers claim food orders, then compare an interleaved read with a mutex protected queue.</p>
    </header>

    <section className="race-mode-bar" aria-label="Choose execution mode">
      <div className="race-mode-copy"><span>EXECUTION MODE</span><strong>{mode === 'unsafe' ? 'Without protection' : 'With mutex'}</strong></div>
      <div className="race-mode-buttons" role="group" aria-label="Race condition mode">
        <button type="button" aria-pressed={mode === 'unsafe'} className={mode === 'unsafe' ? 'selected' : ''} onClick={() => reset('unsafe')}>Without protection</button>
        <button type="button" aria-pressed={mode === 'safe'} className={mode === 'safe' ? 'selected' : ''} onClick={() => reset('safe')}><LockKeyhole size={15} /> With mutex</button>
      </div>
    </section>

    <section className="race-queue" aria-labelledby="race-queue-title">
      <div className="race-section-heading"><div><span className="sl-eyebrow">SHARED RESOURCE · CAPACITY 5</span><h3 id="race-queue-title">Food-order queue</h3></div><p><span className="race-read-marker" /> READ POINTER <b>Slot {state.readPosition}</b></p></div>
      <div className="race-queue-scroll" tabIndex="0" aria-label="Scrollable five-slot food order queue">
        <div className="race-slots">
          {state.orders.map((order, index) => {
            const claimedBy = order?.claimedBy ?? [];
            const conflict = claimedBy.length > 1;
            return <button key={index} type="button" className={`race-slot ${order ? 'occupied' : 'empty'} ${focusSlot === index ? 'focused' : ''} ${state.readPosition === index ? 'head' : ''} ${conflict ? 'conflict' : ''}`} aria-pressed={selectedSlot === index} aria-label={`Slot ${index + 1}: ${order ? `${order.id}, ${order.name}${claimedBy.length ? `, assigned to ${claimedBy.join(' and ')}` : ''}` : 'empty'}${state.readPosition === index ? ', read pointer' : ''}`} onClick={() => setSelectedSlot(index)}>
              <span className="race-slot-number">0{index + 1}</span>{state.readPosition === index && <span className="race-pointer-label">READ</span>}
              <FoodImage order={order} compact />
              {order ? <><b>{order.id}</b><span className="race-slot-food-name">{order.name}</span><small>{conflict ? 'Multiple assignments' : claimedBy.length ? `Assigned · ${claimedBy[0]}` : 'In queue'}</small></> : <><b>Empty</b><span className="race-slot-food-name">Available slot</span><small>Capacity free</small></>}
            </button>;
          })}
        </div>
      </div>
      <div className="race-queue-caption"><span>Orders leave from the read pointer in FIFO order.</span><span>Selected slot: {selectedSlot === null ? 'none' : `Slot ${selectedSlot + 1}`}</span></div>
    </section>

    <section className="race-workers" aria-label="Kitchen workers">
      <Worker id="C1" worker={state.workers.C1} mutexOwner={state.mutexOwner} mutexWaiter={state.mutexWaiter} active={activeWorker === 'C1'} />
      <Worker id="C2" worker={state.workers.C2} mutexOwner={state.mutexOwner} mutexWaiter={state.mutexWaiter} active={activeWorker === 'C2'} />
    </section>

    <section className="race-explanation" aria-live="polite">
      <div className="race-step-count"><span>{state.step === 0 ? 'READY TO BEGIN' : `STEP ${String(state.step).padStart(2, '0')} OF ${String(count).padStart(2, '0')}`}</span><b>{state.last ? `Last action · ${state.last.actor}` : 'Next action · C1 begins'}</b></div>
      <div className="race-explanation-copy"><p>{explanation}</p><code>{detail}</code></div>
    </section>

    <nav className="race-controls" aria-label="Experiment controls">
      <button type="button" className="race-primary" onClick={togglePlay} aria-label={isPlaying ? 'Pause playback' : complete ? 'Replay experiment' : 'Play experiment'}>{isPlaying ? <Pause size={17} /> : <Play size={17} />}{isPlaying ? 'Pause' : complete ? 'Replay' : 'Play'}</button>
      <button type="button" onClick={handleNext} disabled={isPlaying || complete} title={isPlaying ? 'Pause playback to step manually' : complete ? 'Reset or replay to run another step' : 'Execute exactly one transition'}><SkipForward size={16} />Next step</button>
      <button type="button" onClick={() => reset(mode)}><RotateCcw size={16} />Reset</button>
      <span className="race-control-progress">{state.step} / {count} steps</span>
    </nav>

    {outcome && <section className={`race-outcome ${outcome.conflict ? 'has-conflict' : 'no-conflict'}`} aria-live="polite">
      <div className="race-outcome-icon">{outcome.conflict ? <CircleHelp size={19} /> : <Check size={19} />}</div>
      <div><span>OBSERVED RESULT · {mode === 'unsafe' ? 'WITHOUT PROTECTION' : 'WITH MUTEX'}</span><h3>{outcome.conflict ? 'The same order was assigned twice.' : 'Each worker received a different order.'}</h3><p>C1: <b>{outcome.first ?? 'none'}</b> · C2: <b>{outcome.second ?? 'none'}</b>. {outcome.conflict ? 'The shared ticket remains one queue entry; this model demonstrates conflicting assignments, not two physical removals.' : 'The mutex made C2 read the updated FIFO head.'}</p></div>
    </section>}

    <details className="race-why"><summary>Why this happened</summary><p>Reading the queue head and advancing its shared pointer form one critical section. Without a mutex, both workers can save O01 locally; after C1 advances the pointer, C2 may still act on its stale value. With a mutex, C2 waits, then reads O02 after C1 updates the queue.</p></details>
    {outcome && <section className="race-check" aria-labelledby="race-check-title"><div><span className="sl-eyebrow">QUICK CHECK</span><h3 id="race-check-title">Why did the workers receive these orders?</h3></div><div className="race-answer-options"><button type="button" aria-pressed={answer === 'correct'} onClick={() => handleAnswer('correct')} className={answer === 'correct' ? 'chosen' : ''}>The queue head was read and updated {mode === 'unsafe' ? 'without coordination.' : 'under exclusive mutex ownership.'}</button><button type="button" aria-pressed={answer === 'wrong'} onClick={() => handleAnswer('wrong')} className={answer === 'wrong' ? 'chosen' : ''}>The queue ran out of buffer space.</button></div>{answer && <p className={answer === 'correct' ? 'race-answer-feedback right' : 'race-answer-feedback'}>{answer === 'correct' ? 'Correct. The queue access sequence determines whether the second worker sees a fresh head.' : 'Not this time. The queue still has free slots; the result comes from coordinating shared reads and updates.'}</p>}</section>}
  </main>;
}
