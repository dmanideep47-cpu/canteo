import React from 'react';
import { Minus, Plus, Users } from 'lucide-react';

export function ProcessStepperBar({
  producerCount = 0,
  stoppingProducersCount = 0,
  consumerCount = 0,
  stoppingConsumersCount = 0,
  onAddProducer = () => {},
  onRemoveProducer = () => {},
  onAddConsumer = () => {},
  onRemoveConsumer = () => {},
  onOpenProcessManager = () => {},
}) {
  const removableProducers = producerCount - stoppingProducersCount;
  const removableConsumers = consumerCount - stoppingConsumersCount;

  return (
    <div
      className="arena-process-controls-bar"
      role="region"
      aria-label="Process Count Controls"
    >
      <div className="process-steppers-wrapper">
        {/* Producers Stepper */}
        <div
          className="process-stepper-group"
          role="group"
          aria-label="Producer Controls"
        >
          <span className="stepper-label" id="producers-stepper-label">
            Producers
          </span>
          <button
            type="button"
            className="stepper-btn stepper-btn-minus"
            onClick={onRemoveProducer}
            disabled={removableProducers <= 0}
            aria-label="Remove producer"
            aria-describedby="producers-stepper-label"
            title={
              removableProducers <= 0
                ? producerCount === 0
                  ? 'No producers to remove'
                  : 'All producers are already stopping'
                : 'Remove newest producer'
            }
          >
            <Minus size={13} />
          </button>

          <div
            className="stepper-count-badge"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="count-number">{producerCount}</span>
            {stoppingProducersCount > 0 && (
              <span
                className="count-stopping-pill"
                title={`${stoppingProducersCount} producer(s) completing current operation before retiring`}
              >
                · {stoppingProducersCount} stopping
              </span>
            )}
          </div>

          <button
            type="button"
            className="stepper-btn stepper-btn-plus"
            onClick={onAddProducer}
            aria-label="Add producer"
            aria-describedby="producers-stepper-label"
            title="Add 1 student producer"
          >
            <Plus size={13} />
          </button>
        </div>

        <div className="stepper-bar-divider" aria-hidden="true" />

        {/* Consumers Stepper */}
        <div
          className="process-stepper-group"
          role="group"
          aria-label="Consumer Controls"
        >
          <span className="stepper-label" id="consumers-stepper-label">
            Consumers
          </span>
          <button
            type="button"
            className="stepper-btn stepper-btn-minus"
            onClick={onRemoveConsumer}
            disabled={removableConsumers <= 0}
            aria-label="Remove consumer"
            aria-describedby="consumers-stepper-label"
            title={
              removableConsumers <= 0
                ? consumerCount === 0
                  ? 'No consumers to remove'
                  : 'All consumers are already stopping'
                : 'Remove newest consumer'
            }
          >
            <Minus size={13} />
          </button>

          <div
            className="stepper-count-badge"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="count-number">{consumerCount}</span>
            {stoppingConsumersCount > 0 && (
              <span
                className="count-stopping-pill"
                title={`${stoppingConsumersCount} consumer(s) completing current operation before retiring`}
              >
                · {stoppingConsumersCount} stopping
              </span>
            )}
          </div>

          <button
            type="button"
            className="stepper-btn stepper-btn-plus"
            onClick={onAddConsumer}
            aria-label="Add consumer"
            aria-describedby="consumers-stepper-label"
            title="Add 1 kitchen consumer"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* Right Action: Manage Processes Dialog Trigger */}
      <div className="stepper-bar-right">
        <button
          type="button"
          className="stepper-manage-btn"
          onClick={onOpenProcessManager}
          title="Open Process Management Panel"
          aria-label={`Manage processes, ${producerCount + consumerCount} active`}
        >
          <Users size={13} />
          <span>Manage processes ({producerCount + consumerCount})</span>
        </button>
      </div>
    </div>
  );
}

