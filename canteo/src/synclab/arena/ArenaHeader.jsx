import React from 'react';
import {
  Activity,
  Plus,
  RotateCcw,
  BookOpen,
  Sparkles,
  GitBranch,
  Layers,
  Users,
  Trash2,
  Box,
} from 'lucide-react';

export function ArenaHeader({
  activeView = 'arena',
  onChangeView = () => {},
  onAddProducer = () => {},
  onAddConsumer = () => {},
  onReset = () => {},
  onClearSession = () => {},
  onOpenProcessManager = () => {},
  processCount = 0,
}) {
  return (
    <header className="arena-header" role="banner">
      {/* Brand & Page Identity */}
      <div className="arena-header-brand">
        <div className="brand-disc" aria-hidden="true">
          <Activity size={18} />
        </div>
        <div className="brand-text">
          <div className="brand-breadcrumbs">
            <span>CANTEO LABS</span>
            <span className="sep">/</span>
            <span className="sub">CASE STUDY 3</span>
          </div>
          <h1 className="arena-page-title">SyncLab Arena</h1>
          <p className="brand-tagline">
            Coordinate five shared positions, one instruction at a time.
          </p>
        </div>
      </div>

      {/* Center: View Switcher */}
      <nav className="arena-view-tabs" aria-label="Arena Navigation">
        <button
          className={`arena-tab-btn ${activeView === 'arena' ? 'active' : ''}`}
          onClick={() => onChangeView('arena')}
        >
          <Sparkles size={13} />
          <span>SyncLab Arena</span>
        </button>

        <button
          className={`arena-tab-btn ${activeView === '3d' ? 'active' : ''}`}
          onClick={() => onChangeView('3d')}
        >
          <Box size={13} />
          <span>3D Simulation</span>
        </button>

        <button
          className={`arena-tab-btn ${activeView === 'race' ? 'active' : ''}`}
          onClick={() => onChangeView('race')}
        >
          <GitBranch size={13} />
          <span>Race Lab</span>
        </button>

        <button
          className={`arena-tab-btn ${activeView === 'flowcharts' ? 'active' : ''}`}
          onClick={() => onChangeView('flowcharts')}
        >
          <Layers size={13} />
          <span>Flowcharts</span>
        </button>

        <button
          className={`arena-tab-btn ${activeView === 'overview' ? 'active' : ''}`}
          onClick={() => onChangeView('overview')}
        >
          <BookOpen size={13} />
          <span>Case Study</span>
        </button>
      </nav>

      {/* Right: Actions */}
      <div className="arena-header-actions">
        <button
          type="button"
          className="header-action-btn primary-add"
          onClick={onAddProducer}
          title="Add student producer"
        >
          <Plus size={12} />
          <span>Student</span>
        </button>

        <button
          type="button"
          className="header-action-btn primary-add"
          onClick={onAddConsumer}
          title="Add kitchen consumer"
        >
          <Plus size={12} />
          <span>Kitchen</span>
        </button>

        <button
          type="button"
          className="header-action-btn"
          onClick={onOpenProcessManager}
          title="Manage processes and safe removal"
        >
          <Users size={12} />
          <span>Processes ({processCount})</span>
        </button>

        <button
          type="button"
          className="header-action-btn"
          onClick={onReset}
          title="Reset current scenario"
        >
          <RotateCcw size={12} />
          <span>Reset</span>
        </button>

        <button
          type="button"
          className="header-action-btn danger-hover"
          onClick={onClearSession}
          title="Clear session to 0 processes"
        >
          <Trash2 size={12} />
          <span>Clear</span>
        </button>
      </div>
    </header>
  );
}
