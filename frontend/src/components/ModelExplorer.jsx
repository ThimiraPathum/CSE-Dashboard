/**
 * Model Explorer page — shows model provenance, runtime info,
 * verification data, and the complete feature catalog.
 */
import { useState } from 'react';
import { IconModel, IconDownload, IconArrow } from './Icons';

const num = (n) => new Intl.NumberFormat('en').format(n);

export default function ModelExplorer({ modelInfo }) {
  const [filterGroup, setFilterGroup] = useState('all');

  if (!modelInfo) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Model information is unavailable</div>
        <div className="empty-state-desc">Check the dashboard server and reload this page to retry.</div>
      </div>
    );
  }

  const features = modelInfo.feature_details || [];
  const groups = ['all', ...new Set(features.map(f => f.group))];
  const filtered = filterGroup === 'all' ? features : features.filter(f => f.group === filterGroup);

  const handleDownloadMeta = () => {
    const blob = new Blob([JSON.stringify(modelInfo, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ceylonquant_model_metadata.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const verification = modelInfo.verification_report || modelInfo.verification || {};

  return (
    <div>
      <div className="model-grid" style={{ marginBottom: 24 }}>
        {/* Provenance Card */}
        <div className="card card-glow">
          <div className="card-header">
            <div>
              <div className="card-title">Model Provenance</div>
              <div className="card-subtitle">Metadata from the frozen model bundle</div>
            </div>
            <IconModel style={{ width: 20, height: 20, color: 'var(--text-muted)' }} />
          </div>
          <div className="card-body">
            <div className="provenance-list">
              {[
                ['Model', modelInfo.name],
                ['State', 'Experimental research'],
                ['Architecture', `${modelInfo.model_type} · Broad Scan (34F) + Core Signals (25F)`],
                ['Training cutoff', `Through ${modelInfo.training_cutoff}`],
                ['Training rows', num(modelInfo.training_rows)],
                ['Calibration rows', num(modelInfo.calibration_rows)],
                ['Frozen threshold', modelInfo.threshold?.toPrecision?.(10) || modelInfo.threshold],
                ['Ensemble', modelInfo.ensemble],
                ['Fee per side', modelInfo.fee_per_side],
                ['Trading gates', 'Not included / not applied'],
              ].map(([label, value]) => (
                <div key={label} className="provenance-item">
                  <span className="provenance-label">{label}</span>
                  <span className="provenance-value">{String(value)}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 16 }} onClick={handleDownloadMeta}>
              <IconDownload style={{ width: 14, height: 14 }} />
              Download Metadata
            </button>
          </div>
        </div>

        {/* Runtime & Verification Card */}
        <div className="card card-glow">
          <div className="card-header">
            <div>
              <div className="card-title">Runtime & Verification</div>
              <div className="card-subtitle">Artifact reproduction is not evidence of investment performance</div>
            </div>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
              <strong style={{ color: 'var(--text-primary)' }}>
                {modelInfo.model_ready ? 'The local model is ready.' : 'The local model could not load.'}
              </strong>
              {' '}Inference uses the original preprocessor, two XGBoost models and saved calibrators.
            </p>

            {/* Runtime versions */}
            <div className="runtime-versions">
              {Object.entries(modelInfo.runtime_versions || {}).map(([key, value]) => (
                <span key={key} className="runtime-version">{key} {value || 'missing'}</span>
              ))}
            </div>

            {/* Verification */}
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Archived verification record</strong><br />
                {num(verification.frozen_candidates || 0)} frozen 2025 predictions · {verification.signal_mismatches ?? verification.passing_signal_mismatches ?? 0} recorded threshold mismatches.<br />
                Maximum recorded probability difference: {Number(verification.max_probability_error || 0).toExponential(2)}.
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
                This record checks reproduction of saved predictions. It does not demonstrate profitable performance,
                and the original reference predictions are not included here.
              </p>
            </div>

            {/* Warnings */}
            {modelInfo.warnings?.filter(w => w.startsWith('Runtime ')).map((w, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--yellow)', background: 'var(--yellow-subtle)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginTop: 8 }}>
                {w}
              </div>
            ))}

            {modelInfo.error && (
              <div className="error-box" style={{ marginTop: 12 }}>{modelInfo.error}</div>
            )}
          </div>
        </div>
      </div>

      {/* Features Catalog */}
      <div className="card card-glow">
        <div className="card-header">
          <div>
            <div className="card-title">The 34 Model Inputs</div>
            <div className="card-subtitle">Features must follow the original training pipeline, using information available as of the selected day.</div>
          </div>
          <a className="btn btn-secondary btn-sm" href="/api/template.csv" download>
            <IconDownload style={{ width: 14, height: 14 }} />
            Download Template
          </a>
        </div>

        {/* Feature Group Filter */}
        <div style={{ padding: '0 24px 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {groups.map(g => (
            <button
              key={g}
              className={`btn btn-sm ${filterGroup === g ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 11, padding: '4px 12px' }}
              onClick={() => setFilterGroup(g)}
            >
              {g === 'all' ? 'All features' : g}
            </button>
          ))}
        </div>

        <div className="card-body">
          <div className="features-grid">
            {filtered.map((feature, index) => (
              <div key={feature.name} className="feature-item" title={feature.description}>
                <div className="feature-name">
                  {String(index + 1).padStart(2, '0')} · {feature.name}
                </div>
                {feature.description && (
                  <div className="feature-desc">{feature.description}</div>
                )}
                <div className="feature-tags">
                  <span className="feature-tag">{feature.group}</span>
                  <span className={`feature-tag ${feature.is_top25 ? 'top25' : ''}`}>
                    {feature.is_top25 ? 'Core Signal (Top 25)' : 'Broad Scan (34F)'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
