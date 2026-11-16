const initialSnapshot = (state) => ({
  capacity: state.capacity, occupancy: state.occupancy, empty: state.empty, full: state.full,
  mutex: state.mutex, mutexOwner: state.mutexOwner, reservedEmpty: state.reservedEmpty,
  reservedFull: state.reservedFull, readPosition: state.readPosition, writePosition: state.writePosition,
  slots: state.slots.map((slot) => slot ? { ...slot } : null),
  processes: (state.processes ?? []).map(({ id, type, state: processState, pc, waitingFor, permit, acquiredMutex, result }) => ({ id, type, state: processState, pc, waitingFor, permit, acquiredMutex, result: result ? { ...result } : null })),
});

export function createExperimentRecord({ title, objective, expected, initialState, finalState, integrity, actualResult, raceEvents = [], raceInitialState = null }) {
  const events = [...(finalState.events ?? [])].reverse().map((event) => ({ ...event }));
  const allEvents = [...events, ...raceEvents.map((event) => ({ ...event, processId: event.processId ?? event.process ?? null, lane: 'race' }))];
  const producers = [...new Set(allEvents.filter((event) => event.processId?.startsWith('P')).map((event) => event.processId))];
  const consumers = [...new Set(allEvents.filter((event) => event.processId?.startsWith('C')).map((event) => event.processId))];
  const actualIntegrity = integrity ?? finalState.integrity ?? { passed: false, checks: [], failure: null };
  return {
    schema: 'canteo-synclab-experiment/v1', createdAt: new Date().toISOString(), title, objective,
    initialState: initialSnapshot(initialState), raceInitialState, capacity: initialState.capacity,
    initialSemaphores: { empty: initialState.capacity, full: 0, mutex: 1 },
    scenarioStartSemaphores: { empty: initialState.empty, full: initialState.full, mutex: initialState.mutex },
    processes: { producers, consumers }, events: allEvents,
    semaphoreChanges: allEvents.filter((event) => event.type === 'semaphore' || event.operation?.startsWith('wait')),
    mutexEvents: allEvents.filter((event) => event.type === 'critical' || event.resource === 'mutex' || event.message?.toLowerCase().includes('mutex')),
    blockingAndWakeEvents: allEvents.filter((event) => ['blocked', 'wake'].includes(event.type) || event.transition?.to === 'BLOCKED' || event.transition?.to === 'WAITING'),
    finalState: initialSnapshot(finalState), integrityChecks: actualIntegrity.checks,
    expectedResult: expected, actualResult: actualResult ?? (actualIntegrity.passed ? 'Engine invariants passed for the recorded final state.' : 'No validated result was recorded.'),
    conclusion: actualIntegrity.passed ? 'The recorded state satisfies the engine integrity checks.' : 'The recorded state did not pass all integrity checks.',
  };
}

export function experimentToCsv(report) {
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = [
    ['record', 'title', report.title], ['record', 'objective', report.objective], ['record', 'expected', report.expectedResult],
    ['record', 'actual', report.actualResult], ['record', 'conclusion', report.conclusion],
    ['event', 'sequence', 'process', 'operation', 'type', 'transition', 'variablesBefore', 'variablesAfter', 'message'],
    ...report.events.map((event) => ['event', event.step ?? event.id, event.processId, event.operation, event.type, event.transition ? `${event.transition.from}->${event.transition.to}` : '', JSON.stringify(event.variablesBefore ?? { shared: event.sharedBefore, buffer: event.bufferBefore, mutexOwner: event.mutexOwnerBefore }), JSON.stringify(event.variablesAfter ?? { shared: event.sharedAfter, buffer: event.bufferAfter, mutexOwner: event.mutexOwnerAfter }), event.message]),
  ];
  return rows.map((row) => row.map(quote).join(',')).join('\r\n');
}

export function experimentToJson(report) { return JSON.stringify(report, null, 2); }

export function downloadExperiment(report, format) {
  const content = format === 'csv' ? experimentToCsv(report) : experimentToJson(report);
  const blob = new Blob([content], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url;
  anchor.download = `synclab-${report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${format}`;
  anchor.click(); URL.revokeObjectURL(url);
}

export function simulatorScenarioResult(scenarioId, state) {
  const events = state.events;
  const blockedProducer = state.processes.some((p) => p.type === 'PRODUCER' && p.state === 'BLOCKED' && p.waitingFor === 'empty');
  const blockedConsumer = state.processes.some((p) => p.type === 'CONSUMER' && p.state === 'BLOCKED' && p.waitingFor === 'full');
  const allCompleted = state.processes.length > 0 && state.processes.every((p) => p.state === 'COMPLETED');
  const producersCompleted = state.processes.some((p) => p.type === 'PRODUCER') && state.processes.filter((p) => p.type === 'PRODUCER').every((p) => p.state === 'COMPLETED');
  const activeOrders = state.workers?.filter((worker) => worker.assignedOrderId).map((worker) => worker.assignedOrderId) ?? [];
  const uniqueConsumed = state.workers ? new Set(activeOrders).size === activeOrders.length && state.integrity.passed : new Set(state.processes.filter((p) => p.result).map((p) => p.result.id)).size === state.processes.filter((p) => p.result).length;
  const checks = {
    normal: (allCompleted || producersCompleted) && state.occupancy === 0 && events.some((e) => e.operation === 'insert') && events.some((e) => e.operation === 'remove'),
    full: state.occupancy === 5 && state.empty === 0 && blockedProducer,
    empty: state.occupancy === 0 && state.full === 0 && blockedConsumer,
    wrap: events.some((e) => e.operation === 'advanceWrite' && e.variablesBefore?.writePosition === 4 && e.variablesAfter?.writePosition === 0),
    mixed: (allCompleted || producersCompleted) && uniqueConsumed && state.integrity.passed,
    protected: (allCompleted || producersCompleted) && uniqueConsumed && state.integrity.passed,
  };
  return { passed: Boolean(checks[scenarioId]), actual: checks[scenarioId] ? 'The scenario objective is verified from the current engine state and recorded events.' : 'The scenario objective is not yet verified. Continue stepping through the required execution.' };
}

export function classroomDemoResult(demo, state, raceSnapshot) {
  if (demo.lane === 'race') {
    const unsafe = raceSnapshot?.unsafe;
    const safe = raceSnapshot?.safe;
    const passed = demo.index >= demo.steps.length && Boolean(unsafe && safe && (unsafe.lostOrder || unsafe.duplicateConsume) && safe.interactiveComplete && !safe.lostOrder && !safe.duplicateConsume);
    return { passed, actual: passed ? 'The isolated unsafe race was reproduced and the protected run completed without the race outcome.' : 'The prepared race sequence is still in progress or its expected outcomes are not yet present.' };
  }
  const expected = demo.id === 'producer-block'
    ? demo.index >= demo.steps.length && state.integrity.passed && state.processes.some((p) => p.type === 'PRODUCER' && p.state === 'COMPLETED')
    : demo.index >= demo.steps.length && state.integrity.passed && state.processes.some((p) => p.type === 'CONSUMER' && (p.state === 'COMPLETED' || p.state === 'PREPARING'));
  return { passed: expected, actual: expected ? 'The deterministic blocking demonstration completed with valid engine invariants.' : 'The demonstration has not reached its validated completion state.' };
}
