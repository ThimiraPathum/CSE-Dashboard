/**
 * UploadModal — modal dialog for uploading CSV candidate universe,
 * downloading template, or loading demo synthetic data.
 */
import { useState, useRef } from 'react';
import { api } from '../api';
import { IconUpload, IconClose, IconDownload, IconModel } from './Icons';

export default function UploadModal({ isOpen, onClose, onDatasetLoaded }) {
  const [file, setFile] = useState(null);
  const [universeConfirmed, setUniverseConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      if (!dropped.name.toLowerCase().endsWith('.csv')) {
        setError('Please select a valid .csv file.');
        return;
      }
      setFile(dropped);
      setError(null);
    }
  };

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.name.toLowerCase().endsWith('.csv')) {
        setError('Please select a valid .csv file.');
        return;
      }
      setFile(selected);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a CSV file to upload.');
      return;
    }
    if (!universeConfirmed) {
      setError('Please confirm that this file represents a complete candidate universe with all 34 features.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.predict(file, universeConfirmed);
      onDatasetLoaded(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to score candidate universe.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.demo();
      onDatasetLoaded(res);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to load demo dataset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'var(--accent-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)'
            }}>
              <IconUpload style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <div className="modal-title">Import Candidate Dataset</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Score an offline universe with CeylonQuant XGBoost</div>
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>
            <IconClose style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px 24px' }}>
          {error && (
            <div className="notice" style={{ borderColor: 'rgba(248, 113, 113, 0.4)', background: 'rgba(248, 113, 113, 0.08)', marginBottom: 16 }}>
              <div style={{ color: 'var(--red)', fontSize: 13, lineHeight: 1.5 }}>{error}</div>
            </div>
          )}

          {/* Drag & Drop Area */}
          <div
            className={`upload-dropzone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-md)',
              padding: '28px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? 'rgba(52, 211, 153, 0.05)' : 'rgba(20, 45, 75, 0.02)',
              transition: 'all 0.2s ease',
              marginBottom: 16
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <IconUpload style={{ width: 32, height: 32, color: file ? 'var(--accent)' : 'var(--text-muted)', margin: '0 auto 10px' }} />
            {file ? (
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{file.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  {(file.size / 1024).toFixed(1)} KB · Click to choose different file
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
                  Drop your CSV file here or <span style={{ color: 'var(--accent)' }}>browse</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Required: 34 feature columns + date, symbol (max 5 MB)
                </div>
              </div>
            )}
          </div>

          {/* Universe Confirmation Checkbox */}
          <label style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            fontSize: 12,
            color: 'var(--text-secondary)',
            marginBottom: 20,
            cursor: 'pointer',
            lineHeight: 1.4
          }}>
            <input
              type="checkbox"
              checked={universeConfirmed}
              onChange={(e) => setUniverseConfirmed(e.target.checked)}
              style={{ marginTop: 2, accentColor: 'var(--accent)' }}
            />
            <span>
              I confirm this file contains a complete candidate universe with all 34 precomputed features for a single market as-of date.
            </span>
          </label>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <a
                href={api.templateUrl}
                download="cse_features_template.csv"
                className="btn btn-secondary btn-sm"
                style={{ textDecoration: 'none' }}
              >
                <IconDownload style={{ width: 14, height: 14 }} />
                Template CSV
              </a>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleLoadDemo}
                disabled={loading}
              >
                <IconModel style={{ width: 14, height: 14 }} />
                Demo Data
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleUpload}
                disabled={loading || !file}
              >
                {loading ? 'Scoring...' : 'Score Candidates'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
