import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Play,
  Printer,
  RotateCcw,
  SkipForward,
  Timer,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  CLASSROOM_EXPERIMENTS,
  EXPERIMENT_STATUS,
  evaluateExperimentChecks,
  buildExperimentReport,
} from './classroomExperiments.js';
import { downloadExperiment } from './evidence.js';

export function ClassroomWorkbench({
  engine,
  state,
  refresh,
  onInteraction,
  onInspectStep,
  activeExperimentId,
  onSelectExperiment,
}) {
  const [currentExpId, setCurrentExpId] = useState(() => activeExperimentId || CLASSROOM_EXPERIMENTS[0].id);
  const [activeStage, setActiveStage] = useState('SETUP'); // 'SETUP' | 'PREDICT' | 'RUN' | 'OBSERVE' | 'EXPLAIN'

  // Per-experiment user state
  const [experimentStateMap, setExperimentStateMap] = useState(() => ({}));
  const [showReplaceWarning, setShowReplaceWarning] = useState(false);
  const [pendingLoadExpId, setPendingLoadExpId] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

  // Student metadata for reporting
  const [studentName, setStudentName] = useState('Student / Lab Participant');
  const [studentId, setStudentId] = useState('STUDENT-01');

  // Sync prop changes
  useEffect(() => {
    if (activeExperimentId && activeExperimentId !== currentExpId) {
      setCurrentExpId(activeExperimentId);
    }
  }, [activeExperimentId, currentExpId]);

  const activeExperiment = useMemo(() => {
    return CLASSROOM_EXPERIMENTS.find((exp) => exp.id === currentExpId) || CLASSROOM_EXPERIMENTS[0];
  }, [currentExpId]);

  const expState = useMemo(() => {
    return experimentStateMap[currentExpId] || {
      loaded: false,
      predictionAnswer: null,
      predictionHypothesis: '',
      predictionRecorded: false,
      conclusion: activeExperiment.takeaway,
    };
  }, [experimentStateMap, currentExpId, activeExperiment.takeaway]);

  const updateCurrentExpState = useCallback((patch) => {
    setExperimentStateMap((prev) => ({
      ...prev,
      [currentExpId]: {
        ...(prev[currentExpId] || {
          loaded: false,
          predictionAnswer: null,
          predictionHypothesis: '',
          predictionRecorded: false,
          conclusion: activeExperiment.takeaway,
        }),
        ...patch,
      },
    }));
  }, [currentExpId, activeExperiment.takeaway]);

  const history = state?.executionHistory || [];

  // Evaluated checks
  const evaluatedChecks = useMemo(() => {
    return evaluateExperimentChecks(activeExperiment, state, history);
  }, [activeExperiment, state, history]);

  const observedChecksCount = evaluatedChecks.filter((c) => c.status === EXPERIMENT_STATUS.OBSERVED).length;
  const totalChecksCount = evaluatedChecks.length;
  const isExperimentFullyObserved = totalChecksCount > 0 && observedChecksCount === totalChecksCount;

  // Check if simulation state has been modified
  const isSimulationDirty = (state?.events?.length || 0) > 0;

  const executeLoadExperiment = useCallback((exp) => {
    exp.setupEngine(engine);
    updateCurrentExpState({
      loaded: true,
      conclusion: exp.takeaway,
    });
    refresh();
    onInteraction();
    setShowReplaceWarning(false);
    setPendingLoadExpId(null);
  }, [engine, refresh, onInteraction, updateCurrentExpState]);

  const handleRequestLoadExperiment = useCallback((expId) => {
    const targetExp = CLASSROOM_EXPERIMENTS.find((e) => e.id === expId) || activeExperiment;
    if (isSimulationDirty) {
      setPendingLoadExpId(expId);
      setShowReplaceWarning(true);
    } else {
      if (expId !== currentExpId) {
        setCurrentExpId(expId);
        onSelectExperiment?.(expId);
      }
      executeLoadExperiment(targetExp);
    }
  }, [isSimulationDirty, currentExpId, activeExperiment, executeLoadExperiment, onSelectExperiment]);

  const handleConfirmReplace = useCallback(() => {
    if (!pendingLoadExpId) return;
    const targetExp = CLASSROOM_EXPERIMENTS.find((e) => e.id === pendingLoadExpId) || activeExperiment;
    setCurrentExpId(pendingLoadExpId);
    onSelectExperiment?.(pendingLoadExpId);
    executeLoadExperiment(targetExp);
  }, [pendingLoadExpId, activeExperiment, executeLoadExperiment, onSelectExperiment]);

  // Report generation
  const generatedReport = useMemo(() => {
    return buildExperimentReport({
      studentName,
      studentId,
      experiment: activeExperiment,
      predictionAnswer: expState.predictionAnswer,
      predictionHypothesis: expState.predictionHypothesis,
      conclusion: expState.conclusion || activeExperiment.takeaway,
      state,
      history,
    });
  }, [studentName, studentId, activeExperiment, expState, state, history]);

  const handleExportJSON = useCallback(() => {
    downloadExperiment(generatedReport, 'json');
  }, [generatedReport]);

  const handleExportCSV = useCallback(() => {
    downloadExperiment(generatedReport, 'csv');
  }, [generatedReport]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="sl-classroom-workbench">
      {/* Experiment Selector Bar */}
      <div className="sl-workbench-top-bar">
        <div className="sl-experiment-pills" role="tablist" aria-label="Classroom Experiments">
          {CLASSROOM_EXPERIMENTS.map((exp) => {
            const isSelected = exp.id === currentExpId;
            // Check status
            const isObserved = exp.id === currentExpId && isExperimentFullyObserved;
            return (
              <button
                type="button"
                key={exp.id}
                role="tab"
                aria-selected={isSelected}
                className={`sl-exp-pill ${isSelected ? 'active' : ''} ${isObserved ? 'observed' : ''}`}
                onClick={() => {
                  if (exp.id === currentExpId) return;
                  handleRequestLoadExperiment(exp.id);
                }}
              >
                <span className="sl-pill-letter">{exp.letter}</span>
                <span className="sl-pill-title">{exp.title.split('·')[1]?.trim() ?? exp.title}</span>
                {isObserved && <span className="sl-pill-check">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Warning Confirmation Modal */}
      {showReplaceWarning && (
        <div className="sl-warning-dialog-backdrop" role="dialog" aria-modal="true">
          <div className="sl-warning-dialog">
            <div className="sl-warning-icon">
              <AlertTriangle size={24} />
            </div>
            <div className="sl-warning-content">
              <h4>Active Simulation Run in Progress</h4>
              <p>
                The simulator currently holds active state and recorded execution steps. Loading this experiment will reset the simulation state.
                Do you wish to proceed?
              </p>
            </div>
            <div className="sl-warning-actions">
              <button
                className="sl-btn small"
                onClick={() => {
                  setShowReplaceWarning(false);
                  setPendingLoadExpId(null);
                }}
              >
                Cancel
              </button>
              <button className="sl-btn primary small danger" onClick={handleConfirmReplace}>
                Proceed & Reset State
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Experiment Main Card */}
      <div className="sl-experiment-container">
        {/* Stage Navigation Stepper */}
        <div className="sl-stage-stepper" role="navigation" aria-label="Experiment Stages">
          {[
            ['SETUP', '1. Setup'],
            ['PREDICT', '2. Predict'],
            ['RUN', '3. Run'],
            ['OBSERVE', '4. Observe'],
            ['EXPLAIN', '5. Explain & Report'],
          ].map(([stageKey, stageLabel]) => {
            const isCurrent = activeStage === stageKey;
            return (
              <button
                type="button"
                key={stageKey}
                className={`sl-stage-step ${isCurrent ? 'current' : ''}`}
                onClick={() => setActiveStage(stageKey)}
              >
                <span>{stageLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Header Info */}
        <div className="sl-experiment-header">
          <div>
            <span className="sl-eyebrow">{activeExperiment.concept}</span>
            <h3 className="sl-experiment-headline">{activeExperiment.title}</h3>
            <p className="sl-experiment-objective">{activeExperiment.objective}</p>
          </div>
          <div className="sl-experiment-status-badge">
            <span className={`sl-status-tag ${isExperimentFullyObserved ? 'observed' : isSimulationDirty ? 'in-progress' : 'not-run'}`}>
              {isExperimentFullyObserved ? 'OBSERVED · COMPLETE' : isSimulationDirty ? 'IN PROGRESS' : 'NOT STARTED'}
            </span>
          </div>
        </div>

        {/* STAGE 1: SETUP */}
        {activeStage === 'SETUP' && (
          <div className="sl-stage-content sl-stage-setup">
            <div className="sl-setup-grid">
              <div className="sl-setup-card">
                <h4>Initial Conditions & Configuration</h4>
                <p className="sl-setup-desc">{activeExperiment.setupDescription}</p>
                <div className="sl-setup-metrics">
                  <div className="sl-setup-metric-item">
                    <span>Buffer Capacity</span>
                    <strong>5 Slots</strong>
                  </div>
                  <div className="sl-setup-metric-item">
                    <span>Current Queue Occupancy</span>
                    <strong>{state.occupancy} Orders</strong>
                  </div>
                  <div className="sl-setup-metric-item">
                    <span>Semaphores (empty / full / mutex)</span>
                    <strong>{state.empty} / {state.full} / {state.mutex}</strong>
                  </div>
                </div>
              </div>

              <div className="sl-setup-actions-card">
                <h4>Experiment Setup Action</h4>
                <p>Click below to initialize the exact starting state and semaphores for this demonstration.</p>
                <button
                  className="sl-btn primary"
                  onClick={() => handleRequestLoadExperiment(currentExpId)}
                >
                  <RotateCcw size={15} /> Initialize / Reset Starting State
                </button>
                {expState.loaded && (
                  <div className="sl-setup-confirmed">
                    <CheckCircle2 size={16} />
                    <span>Initial state loaded. You can now formulate your prediction.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="sl-stage-footer">
              <span className="sl-muted">Proceed to the next stage to record your prediction before running.</span>
              <button className="sl-btn small" onClick={() => setActiveStage('PREDICT')}>
                Proceed to Prediction <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* STAGE 2: PREDICT */}
        {activeStage === 'PREDICT' && (
          <div className="sl-stage-content sl-stage-predict">
            <div className="sl-predict-card">
              <h4>Formulate Your Hypothesis</h4>
              <p className="sl-predict-question">{activeExperiment.prediction.question}</p>

              <div className="sl-predict-options">
                {activeExperiment.prediction.options.map((option) => (
                  <label key={option.id} className={`sl-predict-option ${expState.predictionAnswer === option.id ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="prediction-choice"
                      value={option.id}
                      checked={expState.predictionAnswer === option.id}
                      onChange={() => updateCurrentExpState({ predictionAnswer: option.id })}
                    />
                    <span>{option.text}</span>
                  </label>
                ))}
              </div>

              <div className="sl-predict-hypothesis-field">
                <label htmlFor="student-hypothesis">
                  <b>Your Technical Reasoning (Optional):</b>
                  <small> Explain why you chose this answer based on semaphore and mutex theory.</small>
                </label>
                <textarea
                  id="student-hypothesis"
                  rows={2}
                  value={expState.predictionHypothesis}
                  onChange={(e) => updateCurrentExpState({ predictionHypothesis: e.target.value })}
                  placeholder="e.g. Because empty counts vacant buffer slots, wait(empty) must decrement empty. When empty reaches 0, the calling thread blocks..."
                />
              </div>

              <div className="sl-predict-action-row">
                <button
                  className="sl-btn primary small"
                  disabled={!expState.predictionAnswer}
                  onClick={() => updateCurrentExpState({ predictionRecorded: true })}
                >
                  <CheckCircle2 size={14} /> Record Prediction
                </button>
                {expState.predictionRecorded && (
                  <span className="sl-prediction-saved-tag">
                    ✓ Prediction recorded. Advance to the RUN stage to test your hypothesis.
                  </span>
                )}
              </div>

              {expState.predictionRecorded && (
                <div className="sl-predict-explanation-preview">
                  <b>Conceptual Context:</b>
                  <p>{activeExperiment.prediction.explanation}</p>
                </div>
              )}
            </div>

            <div className="sl-stage-footer">
              <button className="sl-btn quiet small" onClick={() => setActiveStage('SETUP')}>
                <ArrowLeft size={14} /> Back to Setup
              </button>
              <button className="sl-btn small" onClick={() => setActiveStage('RUN')}>
                Proceed to Simulation <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* STAGE 3: RUN */}
        {activeStage === 'RUN' && (
          <div className="sl-stage-content sl-stage-run">
            <div className="sl-run-grid">
              <div className="sl-run-instructions">
                <h4>Guided Simulation Steps</h4>
                <ol className="sl-run-steps-list">
                  {activeExperiment.guideSteps.map((step, idx) => (
                    <li key={idx}>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="sl-run-controls-card">
                <h4>Simulation Execution Controls</h4>
                <p>Advance the simulation using the controls below, or use the main simulator bar.</p>
                <div className="sl-run-buttons">
                  <button
                    className="sl-btn primary small"
                    onClick={() => {
                      engine.stepNextInstruction();
                      refresh();
                      onInteraction();
                    }}
                  >
                    <SkipForward size={14} /> Step Instruction
                  </button>
                  <button
                    className="sl-btn small"
                    onClick={() => {
                      engine.stepNextProcess();
                      refresh();
                      onInteraction();
                    }}
                  >
                    <Play size={14} /> Step Process
                  </button>
                  <button
                    className="sl-btn small"
                    onClick={() => {
                      engine.tickKitchen();
                      refresh();
                      onInteraction();
                    }}
                    disabled={!state.workers?.some((w) => w.state === 'PREPARING')}
                  >
                    <Timer size={14} /> Advance Kitchen Tick
                  </button>
                  <button
                    className="sl-btn quiet small"
                    onClick={() => {
                      activeExperiment.setupEngine(engine);
                      refresh();
                      onInteraction();
                    }}
                  >
                    <RotateCcw size={14} /> Reset Setup
                  </button>
                </div>

                <div className="sl-run-live-status">
                  <div className="sl-live-status-row">
                    <span>Recorded Steps:</span>
                    <strong>{state.executionHistory?.length ?? 0} transitions</strong>
                  </div>
                  <div className="sl-live-status-row">
                    <span>Last Instruction:</span>
                    <code>{state.lastInstruction?.label ?? 'None yet'}</code>
                  </div>
                  <div className="sl-live-status-row">
                    <span>Mutex Owner:</span>
                    <strong>{state.mutexOwner ? state.mutexOwner : 'Free / Unlocked'}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="sl-stage-footer">
              <button className="sl-btn quiet small" onClick={() => setActiveStage('PREDICT')}>
                <ArrowLeft size={14} /> Back to Predict
              </button>
              <button className="sl-btn small" onClick={() => setActiveStage('OBSERVE')}>
                Inspect Evidence & Observations <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* STAGE 4: OBSERVE */}
        {activeStage === 'OBSERVE' && (
          <div className="sl-stage-content sl-stage-observe">
            <div className="sl-observe-table-card">
              <div className="sl-table-card-header">
                <div>
                  <h4>Expected vs. Observed Results Comparison</h4>
                  <p>
                    Verified outcomes from live engine execution history. Click any step link to center and highlight that event on the Occupancy Graph and Process Timeline.
                  </p>
                </div>
                <div className="sl-observe-summary-badge">
                  <span>Progress: </span>
                  <strong>{observedChecksCount} / {totalChecksCount} Observed</strong>
                </div>
              </div>

              <div className="sl-observe-table-responsive">
                <table className="sl-observe-table">
                  <thead>
                    <tr>
                      <th style={{ width: '22%' }}>Check & Verification Point</th>
                      <th style={{ width: '30%' }}>Expected Condition</th>
                      <th style={{ width: '34%' }}>Observed Evidence</th>
                      <th style={{ width: '14%' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluatedChecks.map((chk) => (
                      <tr key={chk.id}>
                        <td>
                          <b>{chk.label}</b>
                        </td>
                        <td>
                          <span className="sl-expected-text">{chk.expected}</span>
                        </td>
                        <td>
                          <div className="sl-evidence-cell">
                            <span className="sl-evidence-text">{chk.evidenceText}</span>
                            {chk.stepSeq !== null && (
                              <button
                                type="button"
                                className="sl-evidence-link-btn"
                                onClick={() => onInspectStep?.(chk.stepSeq)}
                                title={`Highlight step ${chk.stepSeq} on the Occupancy Graph and Process Timeline`}
                              >
                                <ExternalLink size={12} /> Inspect Step #{chk.stepSeq}
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`sl-check-status-tag status-${chk.status.toLowerCase().replace(/\s+/g, '-')}`}>
                            {chk.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="sl-stage-footer">
              <button className="sl-btn quiet small" onClick={() => setActiveStage('RUN')}>
                <ArrowLeft size={14} /> Back to Run
              </button>
              <button className="sl-btn small primary" onClick={() => setActiveStage('EXPLAIN')}>
                Proceed to Conclusion & Report <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* STAGE 5: EXPLAIN & REPORT */}
        {activeStage === 'EXPLAIN' && (
          <div className="sl-stage-content sl-stage-explain">
            <div className="sl-explain-grid">
              <div className="sl-takeaway-card">
                <h4>Operating System Principle & Takeaway</h4>
                <p className="sl-takeaway-p">{activeExperiment.takeaway}</p>

                <div className="sl-student-conclusion-block">
                  <label htmlFor="student-conclusion-input">
                    <b>Student Conclusion & Academic Synthesis:</b>
                    <small> Editable summary for your laboratory export.</small>
                  </label>
                  <textarea
                    id="student-conclusion-input"
                    rows={4}
                    value={expState.conclusion}
                    onChange={(e) => updateCurrentExpState({ conclusion: e.target.value })}
                  />
                </div>
              </div>

              <div className="sl-report-export-card">
                <h4>Laboratory Report Export</h4>
                <p>Generate a formal academic experiment report with initial conditions, prediction, evidence, and takeaway.</p>

                <div className="sl-student-meta-inputs">
                  <label>
                    <span>Student Name:</span>
                    <input
                      type="text"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                    />
                  </label>
                  <label>
                    <span>Student / Roll ID:</span>
                    <input
                      type="text"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                    />
                  </label>
                </div>

                <div className="sl-report-actions">
                  <button
                    className="sl-btn primary"
                    onClick={() => setShowReportModal(true)}
                  >
                    <FileText size={15} /> Preview Printable Report
                  </button>
                  <div className="sl-secondary-export-btns">
                    <button className="sl-btn small" onClick={handleExportJSON}>
                      <Download size={13} /> Export JSON
                    </button>
                    <button className="sl-btn small" onClick={handleExportCSV}>
                      <FileSpreadsheet size={13} /> Export CSV
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="sl-stage-footer">
              <button className="sl-btn quiet small" onClick={() => setActiveStage('OBSERVE')}>
                <ArrowLeft size={14} /> Back to Observations
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Printable Report Modal */}
      {showReportModal && (
        <div className="sl-report-modal-backdrop" role="dialog" aria-modal="true">
          <div className="sl-report-modal-container">
            <div className="sl-report-modal-header no-print">
              <div>
                <span className="sl-eyebrow">ACADEMIC EXPORT</span>
                <h3>Classroom Experiment Report Preview</h3>
              </div>
              <div className="sl-modal-header-buttons">
                <button className="sl-btn primary small" onClick={handlePrint}>
                  <Printer size={14} /> Print Report
                </button>
                <button className="sl-btn small" onClick={handleExportJSON}>
                  <Download size={14} /> JSON
                </button>
                <button className="sl-btn small" onClick={handleExportCSV}>
                  <FileSpreadsheet size={14} /> CSV
                </button>
                <button
                  className="sl-modal-close-btn"
                  onClick={() => setShowReportModal(false)}
                  aria-label="Close Preview"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Printable Report Content */}
            <div className="sl-printable-report" id="printable-experiment-report">
              <div className="sl-report-print-header">
                <div className="sl-report-print-title">
                  <h2>CANTEO SYNCLAB · LABORATORY EXPERIMENT REPORT</h2>
                  <p>Operating Systems & Distributed Synchronization Laboratory</p>
                </div>
                <div className="sl-report-meta-box">
                  <div><strong>Student Name:</strong> {studentName}</div>
                  <div><strong>Student ID:</strong> {studentId}</div>
                  <div><strong>Date / Time:</strong> {new Date().toLocaleString()}</div>
                </div>
              </div>

              <hr className="sl-report-hr" />

              <div className="sl-report-section">
                <h3>1. Experiment Identification</h3>
                <table className="sl-report-table-kv">
                  <tbody>
                    <tr><td><strong>Experiment:</strong></td><td>{activeExperiment.title}</td></tr>
                    <tr><td><strong>Core Concept:</strong></td><td>{activeExperiment.concept}</td></tr>
                    <tr><td><strong>Objective:</strong></td><td>{activeExperiment.objective}</td></tr>
                    <tr><td><strong>Initial Setup:</strong></td><td>{activeExperiment.setupDescription}</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="sl-report-section">
                <h3>2. Student Prediction & Hypothesis</h3>
                <div className="sl-report-prediction-box">
                  <p><strong>Question:</strong> {activeExperiment.prediction.question}</p>
                  <p>
                    <strong>Selected Prediction:</strong> {generatedReport.prediction.selectedOption}
                    {' '}<span className={generatedReport.prediction.isCorrect ? 'sl-pass-pill' : 'sl-fail-pill'}>
                      {generatedReport.prediction.isCorrect ? '(Correct Technical Hypothesis)' : '(Incorrect)'}
                    </span>
                  </p>
                  {generatedReport.prediction.hypothesis && (
                    <p><strong>Student Reasoning:</strong> <em>"{generatedReport.prediction.hypothesis}"</em></p>
                  )}
                  <p><strong>Theoretical Explanation:</strong> {activeExperiment.prediction.explanation}</p>
                </div>
              </div>

              <div className="sl-report-section">
                <h3>3. Expected vs. Observed Invariant Checks</h3>
                <table className="sl-report-print-table">
                  <thead>
                    <tr>
                      <th>Check</th>
                      <th>Expected Condition</th>
                      <th>Observed Evidence</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluatedChecks.map((chk) => (
                      <tr key={chk.id}>
                        <td><strong>{chk.label}</strong></td>
                        <td>{chk.expected}</td>
                        <td>{chk.evidenceText}</td>
                        <td><strong>{chk.status}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="sl-report-section">
                <h3>4. Final Execution Summary</h3>
                <div className="sl-report-summary-grid">
                  <div><strong>Total Transitions Recorded:</strong> {history.length}</div>
                  <div><strong>Final Queue Occupancy:</strong> {state.occupancy} / 5</div>
                  <div><strong>Final Semaphores:</strong> empty={state.empty}, full={state.full}, mutex={state.mutex}</div>
                  <div><strong>Integrity Status:</strong> {state.integrity?.passed ? 'PASS · All Invariants Satisfied' : 'FAIL'}</div>
                </div>
              </div>

              <div className="sl-report-section">
                <h3>5. Student Conclusion & Takeaway</h3>
                <div className="sl-report-conclusion-box">
                  <p>{expState.conclusion || activeExperiment.takeaway}</p>
                </div>
              </div>

              <div className="sl-report-print-footer">
                <p>Generated by Canteo SyncLab · Section 02 Educational Simulator Workbench</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
