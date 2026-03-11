/**
 * Settings Page
 * Configure Mission Control paths, URLs, and preferences
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Save, RotateCcw, FolderOpen, Link as LinkIcon, PlugZap } from 'lucide-react';
import { getConfig, updateConfig, resetConfig, type MissionControlConfig } from '@/lib/config';

export default function SettingsPage() {
  const router = useRouter();
  const [config, setConfig] = useState<MissionControlConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openclawConfig, setOpenclawConfig] = useState({
    gateway_url: '',
    gateway_token: '',
    gateway_origin: '',
    gateway_role: 'operator',
    gateway_scopes: 'operator.read,operator.write',
  });
  const [openclawStatus, setOpenclawStatus] = useState<string | null>(null);
  const [openclawError, setOpenclawError] = useState<string | null>(null);
  const [isTestingOpenclaw, setIsTestingOpenclaw] = useState(false);
  const [isSavingOpenclaw, setIsSavingOpenclaw] = useState(false);
  const [cronLoading, setCronLoading] = useState(false);
  const [cronError, setCronError] = useState<string | null>(null);
  const [cronStatusText, setCronStatusText] = useState('');
  const [cronListText, setCronListText] = useState('');
  const [cronActionOutput, setCronActionOutput] = useState('');
  const [cronName, setCronName] = useState('mc-trigger-content-automation-default');
  const [cronEveryMs, setCronEveryMs] = useState('3600000');
  const [cronPipelineJobId, setCronPipelineJobId] = useState('content-automation-default');
  const [cronMissionControlUrl, setCronMissionControlUrl] = useState('http://127.0.0.1:4317');
  const [cronTriggerToken, setCronTriggerToken] = useState('');
  const [cronApprovalToken, setCronApprovalToken] = useState('');
  const [cronTargetId, setCronTargetId] = useState('');

  useEffect(() => {
    setConfig(getConfig());
    void (async () => {
      try {
        const res = await fetch('/api/openclaw/config');
        if (!res.ok) return;
        const data = await res.json();
        setOpenclawConfig({
          gateway_url: data.gateway_url || '',
          gateway_token: data.gateway_token || '',
          gateway_origin: data.gateway_origin || '',
          gateway_role: data.gateway_role || 'operator',
          gateway_scopes: data.gateway_scopes || 'operator.read,operator.write',
        });
      } catch {
        // no-op; this panel can be manually filled
      }
    })();
    void refreshCronState();
  }, []);

  const handleSave = async () => {
    if (!config) return;

    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      updateConfig(config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      resetConfig();
      setConfig(getConfig());
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleChange = (field: keyof MissionControlConfig, value: string) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  const handleOpenClawChange = (field: keyof typeof openclawConfig, value: string) => {
    setOpenclawConfig((prev) => ({ ...prev, [field]: value }));
  };

  const testOpenClaw = async () => {
    setIsTestingOpenclaw(true);
    setOpenclawStatus(null);
    setOpenclawError(null);
    try {
      const res = await fetch('/api/openclaw/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...openclawConfig,
          action: 'test',
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || 'OpenClaw test failed');
      }
      setOpenclawStatus(`Connection OK (${payload.sessions_count || 0} sessions visible).`);
    } catch (err) {
      setOpenclawError(err instanceof Error ? err.message : 'OpenClaw test failed');
    } finally {
      setIsTestingOpenclaw(false);
    }
  };

  const saveOpenClaw = async () => {
    setIsSavingOpenclaw(true);
    setOpenclawStatus(null);
    setOpenclawError(null);
    try {
      const res = await fetch('/api/openclaw/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...openclawConfig,
          action: 'save',
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || 'Failed to save OpenClaw config');
      }
      if (payload.warning) {
        setOpenclawStatus(`Saved, but reconnect warning: ${payload.warning}`);
      } else {
        setOpenclawStatus('Saved and reconnected successfully.');
      }
    } catch (err) {
      setOpenclawError(err instanceof Error ? err.message : 'Failed to save OpenClaw config');
    } finally {
      setIsSavingOpenclaw(false);
    }
  };

  const refreshCronState = async () => {
    setCronLoading(true);
    setCronError(null);
    try {
      const res = await fetch('/api/openclaw/cron');
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to load OpenClaw cron state');
      }
      setCronStatusText(payload.status_text || '');
      setCronListText(payload.list_text || '');
    } catch (err) {
      setCronError(err instanceof Error ? err.message : 'Failed to load OpenClaw cron state');
    } finally {
      setCronLoading(false);
    }
  };

  const createCronTrigger = async () => {
    setCronLoading(true);
    setCronError(null);
    setCronActionOutput('');
    try {
      const res = await fetch('/api/openclaw/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_trigger',
          name: cronName,
          every_ms: cronEveryMs,
          mission_control_url: cronMissionControlUrl,
          pipeline_job_id: cronPipelineJobId,
          trigger_token: cronTriggerToken,
          approval_token: cronApprovalToken || undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || 'Failed to create cron trigger');
      }
      setCronActionOutput(payload.output || 'Cron trigger created.');
      await refreshCronState();
    } catch (err) {
      setCronError(err instanceof Error ? err.message : 'Failed to create cron trigger');
    } finally {
      setCronLoading(false);
    }
  };

  const runCronAction = async (action: 'run' | 'disable' | 'remove' | 'runs') => {
    if (!cronTargetId.trim()) {
      setCronError('Cron ID is required for action.');
      return;
    }
    setCronLoading(true);
    setCronError(null);
    setCronActionOutput('');
    try {
      const res = await fetch(`/api/openclaw/cron/${encodeURIComponent(cronTargetId.trim())}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || `Cron action failed: ${action}`);
      }
      setCronActionOutput(payload.output || `Cron action completed: ${action}`);
      await refreshCronState();
    } catch (err) {
      setCronError(err instanceof Error ? err.message : `Cron action failed: ${action}`);
    } finally {
      setCronLoading(false);
    }
  };

  if (!config) {
    return (
      <div className="min-h-screen bg-mc-bg flex items-center justify-center">
        <div className="text-mc-text-secondary">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mc-bg">
      {/* Header */}
      <div className="border-b border-mc-border bg-mc-bg-secondary">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-mc-bg-tertiary rounded text-mc-text-secondary"
              title="Back to Mission Control"
            >
              ← Back
            </button>
            <Settings className="w-6 h-6 text-mc-accent" />
            <h1 className="text-2xl font-bold text-mc-text">Settings</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-mc-border rounded hover:bg-mc-bg-tertiary text-mc-text-secondary flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-mc-accent text-mc-bg rounded hover:bg-mc-accent/90 flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Success Message */}
        {saveSuccess && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded text-green-400">
            ✓ Settings saved successfully
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded text-red-400">
            ✗ {error}
          </div>
        )}

        {/* Workspace Paths */}
        <section className="mb-8 p-6 bg-mc-bg-secondary border border-mc-border rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="w-5 h-5 text-mc-accent" />
            <h2 className="text-xl font-semibold text-mc-text">Workspace Paths</h2>
          </div>
          <p className="text-sm text-mc-text-secondary mb-4">
            Configure where Mission Control stores projects and deliverables.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-mc-text mb-2">
                Workspace Base Path
              </label>
              <input
                type="text"
                value={config.workspaceBasePath}
                onChange={(e) => handleChange('workspaceBasePath', e.target.value)}
                placeholder="~/Documents/Shared"
                className="w-full px-4 py-2 bg-mc-bg border border-mc-border rounded text-mc-text focus:border-mc-accent focus:outline-none"
              />
              <p className="text-xs text-mc-text-secondary mt-1">
                Base directory for all Mission Control files. Use ~ for home directory.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-mc-text mb-2">
                Projects Path
              </label>
              <input
                type="text"
                value={config.projectsPath}
                onChange={(e) => handleChange('projectsPath', e.target.value)}
                placeholder="~/Documents/Shared/projects"
                className="w-full px-4 py-2 bg-mc-bg border border-mc-border rounded text-mc-text focus:border-mc-accent focus:outline-none"
              />
              <p className="text-xs text-mc-text-secondary mt-1">
                Directory where project folders are created. Each project gets its own folder.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-mc-text mb-2">
                Default Project Name
              </label>
              <input
                type="text"
                value={config.defaultProjectName}
                onChange={(e) => handleChange('defaultProjectName', e.target.value)}
                placeholder="mission-control"
                className="w-full px-4 py-2 bg-mc-bg border border-mc-border rounded text-mc-text focus:border-mc-accent focus:outline-none"
              />
              <p className="text-xs text-mc-text-secondary mt-1">
                Default name for new projects. Can be changed per project.
              </p>
            </div>
          </div>
        </section>

        {/* OpenClaw Native Cron Manager */}
        <section className="mb-8 p-6 bg-mc-bg-secondary border border-mc-border rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <PlugZap className="w-5 h-5 text-mc-accent" />
            <h2 className="text-xl font-semibold text-mc-text">OpenClaw Native Cron</h2>
          </div>
          <p className="text-sm text-mc-text-secondary mb-4">
            Create and control OpenClaw cron jobs from the app (no terminal). This is the native trigger path for Mission Control pipelines.
          </p>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-mc-text mb-2">Cron Job Name</label>
                <input
                  type="text"
                  value={cronName}
                  onChange={(e) => setCronName(e.target.value)}
                  className="w-full px-4 py-2 bg-mc-bg border border-mc-border rounded text-mc-text focus:border-mc-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-mc-text mb-2">Interval (ms)</label>
                <input
                  type="text"
                  value={cronEveryMs}
                  onChange={(e) => setCronEveryMs(e.target.value)}
                  className="w-full px-4 py-2 bg-mc-bg border border-mc-border rounded text-mc-text focus:border-mc-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-mc-text mb-2">Pipeline Job ID</label>
                <input
                  type="text"
                  value={cronPipelineJobId}
                  onChange={(e) => setCronPipelineJobId(e.target.value)}
                  className="w-full px-4 py-2 bg-mc-bg border border-mc-border rounded text-mc-text focus:border-mc-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-mc-text mb-2">Mission Control Trigger URL</label>
                <input
                  type="text"
                  value={cronMissionControlUrl}
                  onChange={(e) => setCronMissionControlUrl(e.target.value)}
                  className="w-full px-4 py-2 bg-mc-bg border border-mc-border rounded text-mc-text focus:border-mc-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-mc-text mb-2">Trigger Token (required)</label>
                <input
                  type="password"
                  value={cronTriggerToken}
                  onChange={(e) => setCronTriggerToken(e.target.value)}
                  placeholder="MISSION_CONTROL_CRON_TRIGGER_TOKEN"
                  className="w-full px-4 py-2 bg-mc-bg border border-mc-border rounded text-mc-text focus:border-mc-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-mc-text mb-2">Approval Token (optional)</label>
                <input
                  type="text"
                  value={cronApprovalToken}
                  onChange={(e) => setCronApprovalToken(e.target.value)}
                  className="w-full px-4 py-2 bg-mc-bg border border-mc-border rounded text-mc-text focus:border-mc-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => void createCronTrigger()}
                disabled={cronLoading}
                className="px-4 py-2 bg-mc-accent text-mc-bg rounded hover:bg-mc-accent/90 disabled:opacity-50"
              >
                {cronLoading ? 'Working...' : 'Create Trigger Job'}
              </button>
              <button
                onClick={() => void refreshCronState()}
                disabled={cronLoading}
                className="px-4 py-2 border border-mc-border rounded hover:bg-mc-bg-tertiary text-mc-text-secondary disabled:opacity-50"
              >
                Refresh Cron State
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-mc-text mb-2">Cron ID (for actions)</label>
                <input
                  type="text"
                  value={cronTargetId}
                  onChange={(e) => setCronTargetId(e.target.value)}
                  className="w-full px-4 py-2 bg-mc-bg border border-mc-border rounded text-mc-text focus:border-mc-accent focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <button
                  onClick={() => void runCronAction('run')}
                  disabled={cronLoading}
                  className="px-3 py-2 border border-mc-border rounded hover:bg-mc-bg-tertiary text-mc-text-secondary disabled:opacity-50"
                >
                  Run Now
                </button>
                <button
                  onClick={() => void runCronAction('runs')}
                  disabled={cronLoading}
                  className="px-3 py-2 border border-mc-border rounded hover:bg-mc-bg-tertiary text-mc-text-secondary disabled:opacity-50"
                >
                  Show History
                </button>
                <button
                  onClick={() => void runCronAction('disable')}
                  disabled={cronLoading}
                  className="px-3 py-2 border border-mc-border rounded hover:bg-mc-bg-tertiary text-mc-text-secondary disabled:opacity-50"
                >
                  Disable
                </button>
                <button
                  onClick={() => void runCronAction('remove')}
                  disabled={cronLoading}
                  className="px-3 py-2 border border-red-500/40 rounded hover:bg-red-500/10 text-red-400 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>

            {cronError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
                {cronError}
              </div>
            )}

            {cronActionOutput && (
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-sm whitespace-pre-wrap">
                {cronActionOutput}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-mc-text mb-2">Cron Status</h4>
                <pre className="text-xs p-3 bg-mc-bg border border-mc-border rounded text-mc-text-secondary whitespace-pre-wrap">
                  {cronStatusText || 'No status output yet.'}
                </pre>
              </div>
              <div>
                <h4 className="text-sm font-medium text-mc-text mb-2">Cron Jobs</h4>
                <pre className="text-xs p-3 bg-mc-bg border border-mc-border rounded text-mc-text-secondary whitespace-pre-wrap">
                  {cronListText || 'No cron list output yet.'}
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* API Configuration */}
        <section className="mb-8 p-6 bg-mc-bg-secondary border border-mc-border rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <LinkIcon className="w-5 h-5 text-mc-accent" />
            <h2 className="text-xl font-semibold text-mc-text">API Configuration</h2>
          </div>
          <p className="text-sm text-mc-text-secondary mb-4">
            Configure Mission Control API URL for agent orchestration.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-mc-text mb-2">
                Mission Control URL
              </label>
              <input
                type="text"
                value={config.missionControlUrl}
                onChange={(e) => handleChange('missionControlUrl', e.target.value)}
                placeholder="http://localhost:3000"
                className="w-full px-4 py-2 bg-mc-bg border border-mc-border rounded text-mc-text focus:border-mc-accent focus:outline-none"
              />
              <p className="text-xs text-mc-text-secondary mt-1">
                URL where Mission Control is running. Auto-detected by default. Change for remote access.
              </p>
            </div>
          </div>
        </section>

        {/* OpenClaw Connection Manager */}
        <section className="mb-8 p-6 bg-mc-bg-secondary border border-mc-border rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <PlugZap className="w-5 h-5 text-mc-accent" />
            <h2 className="text-xl font-semibold text-mc-text">OpenClaw Connection</h2>
          </div>
          <p className="text-sm text-mc-text-secondary mb-4">
            Configure, test, and reconnect OpenClaw from the app. No terminal needed.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-mc-text mb-2">Gateway URL</label>
              <input
                type="text"
                value={openclawConfig.gateway_url}
                onChange={(e) => handleOpenClawChange('gateway_url', e.target.value)}
                placeholder="ws://100.93.24.14:27932"
                className="w-full px-4 py-2 bg-mc-bg border border-mc-border rounded text-mc-text focus:border-mc-accent focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-mc-text mb-2">Gateway Token</label>
              <input
                type="password"
                value={openclawConfig.gateway_token}
                onChange={(e) => handleOpenClawChange('gateway_token', e.target.value)}
                placeholder="Paste gateway token"
                className="w-full px-4 py-2 bg-mc-bg border border-mc-border rounded text-mc-text focus:border-mc-accent focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-mc-text mb-2">Allowed Origin</label>
              <input
                type="text"
                value={openclawConfig.gateway_origin}
                onChange={(e) => handleOpenClawChange('gateway_origin', e.target.value)}
                placeholder="http://100.93.24.14:3001"
                className="w-full px-4 py-2 bg-mc-bg border border-mc-border rounded text-mc-text focus:border-mc-accent focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-mc-text mb-2">Role</label>
                <input
                  type="text"
                  value={openclawConfig.gateway_role}
                  onChange={(e) => handleOpenClawChange('gateway_role', e.target.value)}
                  className="w-full px-4 py-2 bg-mc-bg border border-mc-border rounded text-mc-text focus:border-mc-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-mc-text mb-2">Scopes (comma-separated)</label>
                <input
                  type="text"
                  value={openclawConfig.gateway_scopes}
                  onChange={(e) => handleOpenClawChange('gateway_scopes', e.target.value)}
                  className="w-full px-4 py-2 bg-mc-bg border border-mc-border rounded text-mc-text focus:border-mc-accent focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => void testOpenClaw()}
                disabled={isTestingOpenclaw}
                className="px-4 py-2 border border-mc-border rounded hover:bg-mc-bg-tertiary text-mc-text-secondary disabled:opacity-50"
              >
                {isTestingOpenclaw ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={() => void saveOpenClaw()}
                disabled={isSavingOpenclaw}
                className="px-4 py-2 bg-mc-accent text-mc-bg rounded hover:bg-mc-accent/90 disabled:opacity-50"
              >
                {isSavingOpenclaw ? 'Saving...' : 'Save & Reconnect'}
              </button>
            </div>

            {openclawStatus && (
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-green-400 text-sm">
                {openclawStatus}
              </div>
            )}
            {openclawError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
                {openclawError}
              </div>
            )}
          </div>
        </section>

        {/* Environment Variables Note */}
        <section className="p-6 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-400 mb-2">
            📝 Environment Variables
          </h3>
          <p className="text-sm text-blue-300 mb-3">
            Some settings are also configurable via environment variables in <code className="px-2 py-1 bg-mc-bg rounded">.env.local</code>:
          </p>
          <ul className="text-sm text-blue-300 space-y-1 ml-4 list-disc">
            <li><code>MISSION_CONTROL_URL</code> - API URL override</li>
            <li><code>WORKSPACE_BASE_PATH</code> - Base workspace directory</li>
            <li><code>PROJECTS_PATH</code> - Projects directory</li>
            <li><code>OPENCLAW_GATEWAY_URL</code> - Gateway WebSocket URL</li>
            <li><code>OPENCLAW_GATEWAY_TOKEN</code> - Gateway auth token</li>
            <li><code>SCHEDULER_MODE</code> - Use <code>openclaw-cron</code> for native external cron trigger mode</li>
            <li><code>MISSION_CONTROL_CRON_TRIGGER_TOKEN</code> - token required by <code>/api/jobs/:id/trigger</code></li>
          </ul>
          <p className="text-xs text-blue-400 mt-3">
            Environment variables take precedence over UI settings for server-side operations.
          </p>
        </section>
      </div>
    </div>
  );
}
