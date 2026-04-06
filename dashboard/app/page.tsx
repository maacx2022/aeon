'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import TargetCursor from '../components/ui/TargetCursor'

// --- Types ---

interface Skill { name: string; description: string; tags: string[]; enabled: boolean; schedule: string; var: string; model: string }
interface Run { id: number; workflow: string; status: string; conclusion: string | null; created_at: string; url: string }
interface Secret { name: string; group: string; description: string; isSet: boolean; either?: string }
interface SkillOutput { filename: string; skill: string; timestamp: string; spec: { root: string; state?: Record<string, unknown>; elements: Record<string, SpecElement> } }
interface SpecElement { type: string; props?: Record<string, unknown>; children?: string[] }

// --- Constants ---

const MODELS = [
  { id: 'claude-opus-4-6', label: 'Opus 4.6' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
]

const DAYS = [
  { label: 'All', value: -1 }, { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 }, { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 }, { label: 'Sun', value: 0 },
]

const DEPARTMENTS: Record<string, { label: string; color: string }> = {
  meta:     { label: 'Operations',     color: '#6B7280' },
  crypto:   { label: 'Treasury',       color: '#FF6B1A' },
  dev:      { label: 'Engineering',    color: '#3B82F6' },
  news:     { label: 'Intelligence',   color: '#06B6D4' },
  social:   { label: 'Communications', color: '#EC4899' },
  research: { label: 'R&D',            color: '#8B5CF6' },
  content:  { label: 'Publishing',     color: '#43C165' },
  creative: { label: 'Creative',       color: '#F59E0B' },
}

// --- Utilities ---

function displayName(slug: string): string {
  const special: Record<string, string> = { pr: 'PR', hn: 'HN', rss: 'RSS', defi: 'DeFi', ai: 'AI', x: 'X' }
  return slug.split('-').map(w => special[w] || (w[0]?.toUpperCase() + w.slice(1))).join(' ')
}

function initials(slug: string): string {
  const words = slug.split('-')
  return words.length === 1 ? words[0].slice(0, 2).toUpperCase() : (words[0][0] + words[1][0]).toUpperCase()
}

function getUtcOffsetHours(): number { return -(new Date().getTimezoneOffset() / 60) }
function utcToLocal24(utcH: number): number { return ((utcH + getUtcOffsetHours()) % 24 + 24) % 24 }
function localToUtc24(localH: number): number { return ((localH - getUtcOffsetHours()) % 24 + 24) % 24 }

function parseCron(cron: string) {
  const [m, h, , , dow] = cron.split(' ')
  if (m.includes('/')) return { mode: 'interval' as const, value: parseInt(m.split('/')[1]) || 5, unit: 'm' as const }
  if (h === '*' || h.includes('/')) return { mode: 'interval' as const, value: h === '*' ? 1 : parseInt(h.split('/')[1]) || 1, unit: 'h' as const }
  const localH = utcToLocal24(parseInt(h))
  return { mode: 'time' as const, hour12: localH > 12 ? localH - 12 : localH === 0 ? 12 : localH, minute: parseInt(m) || 0, ampm: (localH >= 12 ? 'PM' : 'AM') as 'AM' | 'PM', days: dow === '*' ? [-1] : dow.split(',').map(d => parseInt(d)).filter(d => !isNaN(d)) }
}

function cronLabel(cron: string): string {
  if (cron === 'workflow_dispatch') return 'On demand'
  const p = parseCron(cron)
  if (p.mode === 'interval') return `Every ${p.value}${p.unit}`
  const time = `${p.hour12}:${String(p.minute).padStart(2, '0')} ${p.ampm}`
  if (p.days.includes(-1)) return `${time} daily`
  return `${time} ${p.days.map(d => DAYS.find(x => x.value === d)?.label || '').filter(Boolean).join(', ')}`
}

function buildCron(mode: 'interval' | 'time', iv: number, iu: 'm' | 'h', h12: number, min: number, ap: 'AM' | 'PM', days: number[]): string {
  if (mode === 'interval') return iu === 'm' ? `*/${iv} * * * *` : `0 */${iv} * * *`
  let lh = h12; if (ap === 'PM' && lh !== 12) lh += 12; if (ap === 'AM' && lh === 12) lh = 0
  return `${min} ${localToUtc24(lh)} * * ${days.includes(-1) ? '*' : days.sort((a, b) => a - b).join(',')}`
}

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`
}

function getSkillStatus(name: string, enabled: boolean, runs: Run[]) {
  const sr = runs.filter(r => r.workflow.toLowerCase().includes(name))
  if (sr.length > 0) {
    if (sr[0].status === 'in_progress') return { label: 'Working', color: 'orange' }
    if (sr[0].conclusion === 'failure') return { label: 'Error', color: 'red' }
  }
  return enabled ? { label: 'On duty', color: 'green' } : { label: 'Off duty', color: 'gray' }
}

// --- Schedule Editor ---

function ScheduleEditor({ cron, onSave }: { cron: string; onSave: (c: string) => void }) {
  const parsed = parseCron(cron)
  const [mode, setMode] = useState<'interval' | 'time'>(parsed.mode)
  const [iv, setIv] = useState(parsed.mode === 'interval' ? parsed.value : 3)
  const [iu, setIu] = useState<'m' | 'h'>(parsed.mode === 'interval' ? parsed.unit : 'h')
  const [h12, setH12] = useState(parsed.mode === 'time' ? parsed.hour12 : 7)
  const [min, setMin] = useState(parsed.mode === 'time' ? parsed.minute : 0)
  const [ap, setAp] = useState<'AM' | 'PM'>(parsed.mode === 'time' ? parsed.ampm : 'AM')
  const [days, setDays] = useState<number[]>(parsed.mode === 'time' ? parsed.days : [-1])
  const toggleDay = (v: number) => { setMode('time'); if (v === -1) { setDays([-1]); return }; const w = days.filter(d => d !== -1 && d !== v); setDays(days.includes(v) ? (w.length === 0 ? [-1] : w) : [...w, v]) }

  const inputCls = "w-12 bg-white text-eva-black text-xs px-2 py-1.5 border-2 border-[rgba(10,10,10,0.08)] outline-none text-center font-mono focus:border-eva-orange transition-colors"

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" checked={mode === 'interval'} onChange={() => setMode('interval')} className="accent-[#FF6B1A] w-3.5 h-3.5" />
          <span className="text-xs text-primary-50">Every</span>
          <input type="number" min={1} max={iu === 'm' ? 59 : 24} value={iv}
            onFocus={() => setMode('interval')} onChange={(e) => { setIv(Math.max(1, parseInt(e.target.value) || 1)); setMode('interval') }}
            className={inputCls} />
          <div className="flex text-xs overflow-hidden border-2 border-[rgba(10,10,10,0.08)]">
            {(['m', 'h'] as const).map(u => (
              <button key={u} onClick={() => { setIu(u); setMode('interval') }}
                className={`px-2.5 py-1.5 transition-colors font-mono ${iu === u ? 'bg-eva-black text-white' : 'bg-white text-primary-40 hover:text-primary-70'}`}>{u}</button>
            ))}
          </div>
        </label>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" checked={mode === 'time'} onChange={() => setMode('time')} className="accent-[#FF6B1A] w-3.5 h-3.5" />
          <span className="text-xs text-primary-50">At</span>
          <input type="number" min={1} max={12} value={h12} onFocus={() => setMode('time')} onChange={(e) => { setH12(Math.max(1, Math.min(12, parseInt(e.target.value) || 1))); setMode('time') }} className={inputCls} />
          <span className="text-primary-35">:</span>
          <input type="number" min={0} max={59} value={String(min).padStart(2, '0')} onFocus={() => setMode('time')} onChange={(e) => { setMin(Math.max(0, Math.min(59, parseInt(e.target.value) || 0))); setMode('time') }} className={inputCls} />
          <div className="flex text-xs overflow-hidden border-2 border-[rgba(10,10,10,0.08)]">
            {(['AM', 'PM'] as const).map(v => (
              <button key={v} onClick={() => { setAp(v); setMode('time') }}
                className={`px-2.5 py-1.5 transition-colors font-mono ${ap === v ? 'bg-eva-black text-white' : 'bg-white text-primary-40 hover:text-primary-70'}`}>{v}</button>
            ))}
          </div>
        </label>
      </div>
      {mode === 'time' && (
        <div className="flex gap-1">
          {DAYS.map(d => (
            <button key={d.value} onClick={() => toggleDay(d.value)}
              className={`text-xs px-2.5 py-1 transition-colors font-mono ${
                (d.value === -1 ? days.includes(-1) : days.includes(d.value))
                  ? 'bg-eva-black text-white' : 'bg-white text-primary-40 border-2 border-[rgba(10,10,10,0.08)] hover:text-primary-70'
              }`}>{d.label}</button>
          ))}
        </div>
      )}
      <button onClick={() => onSave(buildCron(mode, iv, iu, h12, min, ap, days))}
        className="bg-eva-black text-white text-xs px-5 py-2 font-mono uppercase tracking-[2px] hover:opacity-90 transition-opacity">
        Save
      </button>
    </div>
  )
}

// --- json-render ---

function SpecNode({ id, elements }: { id: string; elements: Record<string, SpecElement> }) {
  const el = elements[id]; if (!el) return null
  const p = (el.props || {}) as Record<string, string | number | boolean | string[][] | string[] | undefined>
  const kids = el.children?.map(cid => <SpecNode key={cid} id={cid} elements={elements} />)
  switch (el.type) {
    case 'Card': return (<div className="card-hst p-[var(--space-md)]">{(p.title || p.description) && <div className="mb-3">{p.title && <h3 className="font-display text-lg text-primary-100">{String(p.title)}</h3>}{p.description && <p className="text-xs text-primary-50 mt-0.5">{String(p.description)}</p>}</div>}<div className="space-y-3">{kids}</div></div>)
    case 'Stack': return <div className={`flex ${p.direction === 'horizontal' ? 'flex-row' : 'flex-col'} ${p.gap === 'lg' ? 'gap-[var(--space-lg)]' : p.gap === 'sm' ? 'gap-[var(--space-xs)]' : 'gap-[var(--space-sm)]'}`}>{kids}</div>
    case 'Grid': return <div className={`grid gap-[var(--space-sm)]`} style={{ gridTemplateColumns: `repeat(${typeof p.columns === 'number' ? p.columns : 2}, 1fr)` }}>{kids}</div>
    case 'Heading': { const cls = p.level === 'h1' ? 'font-display text-2xl' : p.level === 'h2' ? 'font-display text-lg' : 'font-display text-sm text-primary-70'; return <div className={cls}>{String(p.text || '')}</div> }
    case 'Text': { const cls = p.variant === 'caption' ? 'text-micro text-primary-40' : p.variant === 'muted' ? 'text-xs text-primary-50' : p.variant === 'lead' ? 'text-sm text-primary-70' : 'text-xs text-primary-70'; return <p className={cls}>{String(p.text || '')}</p> }
    case 'Badge': { const v = p.variant || 'default'; const cls = v === 'destructive' ? 'bg-red-50 text-eva-red border-red-200' : v === 'secondary' ? 'bg-eva-gray text-primary-50 border-[rgba(10,10,10,0.08)]' : 'bg-green-50 text-eva-green border-green-200'; return <span className={`inline-block text-[11px] px-2 py-0.5 border font-mono`}>{String(p.text || '')}</span> }
    case 'Table': { const columns = (p.columns || []) as string[]; const rows = (p.rows || []) as string[][]; return (<div className="overflow-x-auto"><table className="w-full text-[11px] font-mono"><thead><tr>{columns.map((c, i) => <th key={i} className="text-left text-primary-40 font-medium px-2 py-1.5 border-b border-[rgba(10,10,10,0.08)]">{c}</th>)}</tr></thead><tbody>{rows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci} className="px-2 py-1.5 text-primary-70 border-b border-[rgba(10,10,10,0.04)]">{cell}</td>)}</tr>)}</tbody></table></div>) }
    case 'Stat': { const trend = p.trend as string | undefined; const dc = trend === 'up' ? 'text-eva-green' : trend === 'down' ? 'text-eva-orange' : 'text-primary-50'; return (<div className="bg-eva-gray p-3">{p.label && <div className="text-label mb-1">{String(p.label)}</div>}<div className="font-display text-xl text-primary-100">{String(p.value || '')}</div>{p.delta && <div className={`text-xs font-mono ${dc}`}>{String(p.delta)}</div>}</div>) }
    case 'Progress': { const pct = Math.min(100, (Number(p.value || 0) / Number(p.max || 100)) * 100); return (<div>{p.label && <div className="text-label mb-1.5">{String(p.label)}</div>}<div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${pct}%` }} /></div></div>) }
    case 'TweetCard': return (<div className="card-hst p-3">{p.author && <div className="flex items-center gap-1.5 mb-1"><span className="text-xs font-medium text-primary-100">{String(p.author)}</span>{p.handle && <span className="text-[11px] text-primary-40">{String(p.handle)}</span>}</div>}<p className="text-xs text-primary-70 leading-relaxed">{String(p.text || '')}</p>{(p.likes || p.retweets) && <div className="flex gap-3 mt-1.5 text-[11px] text-primary-40 font-mono">{p.likes && <span>{String(p.likes)} likes</span>}{p.retweets && <span>{String(p.retweets)} RTs</span>}</div>}</div>)
    case 'StoryLink': return (<a href={String(p.href || '#')} target="_blank" rel="noopener noreferrer" className="block card-hst card-hst-orange p-3"><div className="text-xs text-primary-100">{String(p.title || '')}</div><div className="flex gap-2 mt-0.5 text-[11px] text-primary-40 font-mono">{p.source && <span>{String(p.source)}</span>}{p.score && <span>{String(p.score)}</span>}</div></a>)
    case 'Link': return <a href={String(p.href || '#')} target="_blank" rel="noopener noreferrer" className="text-xs text-eva-orange hover:underline underline-offset-2 font-mono">{String(p.label || p.href || '')}</a>
    case 'Alert': { const t = p.type || 'info'; const cls = t === 'error' ? 'border-red-200 bg-red-50 text-eva-red' : t === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-700' : t === 'success' ? 'border-green-200 bg-green-50 text-eva-green' : 'border-blue-200 bg-blue-50 text-blue-700'; return (<div className={`p-3 border-2 ${cls}`}>{p.title && <div className="text-xs font-bold mb-0.5">{String(p.title)}</div>}{p.message && <div className="text-[11px] opacity-80">{String(p.message)}</div>}</div>) }
    case 'Separator': return <div className="warning-stripes" />
    default: return null
  }
}

// --- Main Dashboard ---

export default function Dashboard() {
  const [view, setView] = useState<'hq' | 'secrets'>('hq')
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [rightTab, setRightTab] = useState<'feed' | 'runs' | 'analytics'>('feed')

  const [skills, setSkills] = useState<Skill[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [secrets, setSecrets] = useState<Secret[]>([])
  const [model, setModel] = useState('claude-sonnet-4-6')
  const [repo, setRepo] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [jsonrenderEnabled, setJsonrenderEnabled] = useState(false)

  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [behind, setBehind] = useState(0)
  const [feedKey, setFeedKey] = useState(0)

  const [editingSchedule, setEditingSchedule] = useState(false)
  const [editingVar, setEditingVar] = useState(false)
  const [varDraft, setVarDraft] = useState('')

  const [selectedRun, setSelectedRun] = useState<Run | null>(null)
  const [runLogs, setRunLogs] = useState('')
  const [runSummary, setRunSummary] = useState('')
  const [logsLoading, setLogsLoading] = useState(false)
  const [showFullLogs, setShowFullLogs] = useState(false)

  const [editingSecret, setEditingSecret] = useState<string | null>(null)
  const [secretValue, setSecretValue] = useState('')
  const [addingSecret, setAddingSecret] = useState(false)
  const [newSecretName, setNewSecretName] = useState('')

  const [skillSearch, setSkillSearch] = useState('')

  const [outputs, setOutputs] = useState<SkillOutput[]>([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [analyticsData, setAnalyticsData] = useState<{ skills: Array<{ name: string; total: number; success: number; failure: number; cancelled: number; inProgress: number; successRate: number; lastRun: string | null; lastConclusion: string | null; avgDurationMin: number | null; streak: number }>; insights: Array<{ type: 'warning' | 'info' | 'success'; message: string }>; summary: { totalRuns: number; totalSuccess: number; totalFailure: number; overallSuccessRate: number; uniqueSkills: number; periodDays: number } } | null>(null)

  const [showImport, setShowImport] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<Array<{ path: string; content: string }>>([])
  const [uploadDragOver, setUploadDragOver] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [authStatus, setAuthStatus] = useState<{ authenticated: boolean } | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authKey, setAuthKey] = useState('')

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  // --- API ---
  const fetchData = useCallback(async () => {
    try { const [sr, rr, secr] = await Promise.all([fetch('/api/skills'), fetch('/api/runs'), fetch('/api/secrets')]); if (sr.ok) { const d = await sr.json(); setSkills(d.skills); if (d.model) setModel(d.model); if (d.repo) setRepo(d.repo); if (typeof d.jsonrenderEnabled === 'boolean') setJsonrenderEnabled(d.jsonrenderEnabled) }; if (rr.ok) setRuns((await rr.json()).runs); if (secr.ok) { const d = await secr.json(); if (d.secrets) setSecrets(d.secrets) } } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to connect') } finally { setLoading(false) }
    try { const r = await fetch('/api/sync'); if (r.ok) { const d = await r.json(); setHasChanges(d.hasChanges); if (typeof d.behind === 'number') setBehind(d.behind) } } catch {}
    try { const r = await fetch('/api/auth'); if (r.ok) setAuthStatus(await r.json()) } catch {}
  }, [])
  const refreshRuns = useCallback(async () => { try { const r = await fetch('/api/runs'); if (r.ok) setRuns((await r.json()).runs) } catch {} }, [])
  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { const id = setInterval(refreshRuns, 10_000); return () => clearInterval(id) }, [refreshRuns])
  useEffect(() => { setFeedLoading(true); fetch('/api/outputs').then(r => r.ok ? r.json() : { outputs: [] }).then(d => setOutputs(d.outputs || [])).finally(() => setFeedLoading(false)) }, [feedKey])
  useEffect(() => { if (rightTab === 'analytics' && !analyticsData) fetch('/api/analytics').then(r => r.ok ? r.json() : null).then(d => { if (d) setAnalyticsData(d) }) }, [rightTab, analyticsData])

  const toggleSkill = async (n: string, en: boolean) => { setBusy(b => ({ ...b, [n]: true })); try { const r = await fetch('/api/skills', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n, enabled: en }) }); if (r.ok) { setSkills(s => s.map(sk => sk.name === n ? { ...sk, enabled: en } : sk)); flash(`${displayName(n)} ${en ? 'on duty' : 'off duty'}`); setHasChanges(true) } } finally { setBusy(b => ({ ...b, [n]: false })) } }
  const runSkill = async (n: string, v?: string, sm?: string) => { setBusy(b => ({ ...b, [`r-${n}`]: true })); try { const r = await fetch(`/api/skills/${n}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ var: v || '', model: sm || model }) }); if (r.ok) { flash(`${displayName(n)} started`); for (const d of [2000, 5000, 10000]) setTimeout(refreshRuns, d) } else { const d = await r.json(); flash(d.error || 'Failed') } } finally { setBusy(b => ({ ...b, [`r-${n}`]: false })) } }
  const updateSchedule = async (n: string, s: string) => { try { const r = await fetch('/api/skills', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n, schedule: s }) }); if (r.ok) { setSkills(sk => sk.map(x => x.name === n ? { ...x, schedule: s } : x)); flash('Shift updated'); setHasChanges(true); setEditingSchedule(false) } } catch {} }
  const updateVar = async (n: string, v: string) => { try { const r = await fetch('/api/skills', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n, var: v }) }); if (r.ok) { setSkills(s => s.map(x => x.name === n ? { ...x, var: v } : x)); flash('Brief updated'); setHasChanges(true); setEditingVar(false) } } catch {} }
  const updateSkillModel = async (n: string, m: string) => { try { const r = await fetch('/api/skills', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n, skillModel: m }) }); if (r.ok) { setSkills(s => s.map(x => x.name === n ? { ...x, model: m } : x)); flash('Capability updated'); setHasChanges(true) } } catch {} }
  const updateModel = async (m: string) => { setModel(m); try { await fetch('/api/skills', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: m }) }); flash(`Default: ${MODELS.find(x => x.id === m)?.label}`); setHasChanges(true) } catch {} }
  const deleteSkill = async (n: string) => { setBusy(b => ({ ...b, [`d-${n}`]: true })); try { const r = await fetch('/api/skills', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n }) }); if (r.ok) { setSkills(s => s.filter(x => x.name !== n)); setSelectedSkill(null); flash(`${displayName(n)} removed`); setHasChanges(true) } } finally { setBusy(b => ({ ...b, [`d-${n}`]: false })) } }
  const syncToGithub = async () => { setSyncing(true); try { const r = await fetch('/api/sync', { method: 'POST' }); if (r.ok) { flash('Synced'); setHasChanges(false) } } finally { setSyncing(false) } }
  const pullFromGithub = async () => { setPulling(true); try { const r = await fetch('/api/outputs', { method: 'POST' }); if (r.ok) { flash('Pulled'); setFeedKey(k => k + 1); fetchData() } } finally { setPulling(false) } }
  const setupAuth = async (key?: string) => { setAuthLoading(true); try { const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(key ? { key } : {}) }); if (r.ok) { flash('Authenticated'); setAuthStatus({ authenticated: true }); setShowAuthModal(false); setAuthKey(''); fetchData() } else { if (!key) setShowAuthModal(true); flash('Auto-setup failed') } } finally { setAuthLoading(false) } }
  const saveSecret = async (n: string) => { if (!secretValue.trim()) return; setBusy(b => ({ ...b, [`sec-${n}`]: true })); try { const r = await fetch('/api/secrets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n, value: secretValue.trim() }) }); if (r.ok) { setSecrets(s => { const e = s.some(x => x.name === n); if (e) return s.map(x => x.name === n ? { ...x, isSet: true } : x); return [...s, { name: n, group: 'Skill Keys', description: 'Custom', isSet: true }] }); setEditingSecret(null); setSecretValue(''); setAddingSecret(false); setNewSecretName(''); flash(`${n} saved`) } } finally { setBusy(b => ({ ...b, [`sec-${n}`]: false })) } }
  const deleteSecret = async (n: string) => { setBusy(b => ({ ...b, [`sec-${n}`]: true })); try { const r = await fetch('/api/secrets', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n }) }); if (r.ok) { setSecrets(s => s.map(x => x.name === n ? { ...x, isSet: false } : x)); flash(`${n} removed`) } } finally { setBusy(b => ({ ...b, [`sec-${n}`]: false })) } }
  const viewRunLogs = async (run: Run) => { setSelectedRun(run); setRunLogs(''); setRunSummary(''); setShowFullLogs(false); setLogsLoading(true); try { const r = await fetch(`/api/runs/${run.id}/logs`); if (r.ok) { const d = await r.json(); setRunSummary(d.summary || ''); setRunLogs(d.logs || '') } } catch { setRunLogs('Failed') } finally { setLogsLoading(false) } }
  const readFilesFromInput = async (fl: FileList) => { const files: Array<{ path: string; content: string }> = []; for (let i = 0; i < fl.length; i++) { const f = fl[i]; files.push({ path: (f as { webkitRelativePath?: string }).webkitRelativePath || f.name, content: await f.text() }) }; setUploadFiles(files); const sf = files.find(f => { const l = f.path.toLowerCase(); return l === 'skill.md' || l.endsWith('/skill.md') || l.endsWith('.skill') }); if (sf) { const fm = sf.content.match(/^---\s*\n([\s\S]*?)\n---/); if (fm) { const n = fm[1].match(/name:\s*(.+)/); if (n) { const slug = n[1].trim().replace(/^['"]|['"]$/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); if (slug) setUploadName(slug) } } } }
  const uploadSkill = async () => { if (!uploadFiles.length) return; setImportLoading(true); try { const r = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: uploadFiles, name: uploadName || undefined }) }); if (r.ok) { const d = await r.json(); flash(`${displayName(d.name)} hired`); setShowImport(false); setUploadFiles([]); setUploadName(''); fetchData() } } finally { setImportLoading(false) } }

  // --- Derived ---
  const skill = selectedSkill ? skills.find(s => s.name === selectedSkill) : null
  const dept = skill?.tags?.[0] ? DEPARTMENTS[skill.tags[0]] : null
  const skillRuns = selectedSkill ? runs.filter(r => r.workflow.toLowerCase().includes(selectedSkill)) : []
  const departments = new Map<string, Skill[]>()
  skills.forEach(s => { const t = s.tags?.[0] || 'meta'; if (!departments.has(t)) departments.set(t, []); departments.get(t)!.push(s) })
  const enabledCount = skills.filter(s => s.enabled).length
  const workingCount = runs.filter(r => r.status === 'in_progress').length

  // --- Loading / Error ---
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-grid">
      <div className="relative w-24 h-24">
        <svg className="absolute inset-0 w-full h-full animate-spin" style={{ animationDuration: '8s' }} viewBox="0 0 100 100">
          <polygon points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5" fill="none" stroke="#FF6B1A" strokeWidth="1" strokeDasharray="20 10" opacity="0.6" />
        </svg>
        <svg className="absolute inset-3 w-[calc(100%-24px)] h-[calc(100%-24px)] animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }} viewBox="0 0 100 100">
          <rect x="15" y="15" width="70" height="70" fill="none" stroke="#43C165" strokeWidth="2" opacity="0.8" />
        </svg>
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          <line x1="50" y1="20" x2="50" y2="40" stroke="#FF6B1A" strokeWidth="2" className="animate-pulse" />
          <line x1="50" y1="60" x2="50" y2="80" stroke="#FF6B1A" strokeWidth="2" className="animate-pulse" />
          <line x1="20" y1="50" x2="40" y2="50" stroke="#FF6B1A" strokeWidth="2" className="animate-pulse" />
          <line x1="60" y1="50" x2="80" y2="50" stroke="#FF6B1A" strokeWidth="2" className="animate-pulse" />
          <path d="M25,35 L25,25 L35,25" fill="none" stroke="#43C165" strokeWidth="2" />
          <path d="M65,25 L75,25 L75,35" fill="none" stroke="#43C165" strokeWidth="2" />
          <path d="M75,65 L75,75 L65,75" fill="none" stroke="#43C165" strokeWidth="2" />
          <path d="M35,75 L25,75 L25,65" fill="none" stroke="#43C165" strokeWidth="2" />
          <circle cx="50" cy="50" r="3" fill="#43C165" className="animate-ping" style={{ transformOrigin: 'center' }} />
          <circle cx="50" cy="50" r="2" fill="#0A0A0A" />
        </svg>
        <div className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#43C165] to-transparent opacity-60 animate-scan" style={{ top: '50%' }} />
      </div>
      <div className="text-center space-y-1 mt-6">
        <p className="text-[10px] text-eva-green tracking-widest animate-pulse font-mono">INITIALIZING</p>
        <p className="text-xs text-eva-orange font-mono uppercase tracking-wider">Agent HQ</p>
      </div>
      <div className="w-40 h-1 bg-[rgba(10,10,10,0.1)] overflow-hidden mt-4">
        <div className="h-full w-full bg-gradient-to-r from-[#FF6B1A] via-[#43C165] to-[#FF6B1A] bg-[length:200%_100%] animate-shimmer-gradient" />
      </div>
    </div>
  )
  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-grid">
      <div className="card-hst p-[var(--space-lg)] corner-markers max-w-sm">
        <div className="corner-marker corner-marker-sm top-left" />
        <div className="corner-marker corner-marker-sm top-right" />
        <div className="corner-marker corner-marker-sm bottom-left" />
        <div className="corner-marker corner-marker-sm bottom-right" />
        <div className="text-center">
          <p className="font-display text-xl text-eva-red mb-2">Connection Error</p>
          <div className="warning-stripes my-3" />
          <p className="text-xs text-primary-50 font-mono">{error}</p>
        </div>
      </div>
    </div>
  )

  const statusDot = (color: string) => `w-2 h-2 rounded-full shrink-0 ${color === 'green' ? 'bg-eva-green' : color === 'orange' ? 'bg-eva-orange animate-pulse' : color === 'red' ? 'bg-eva-red' : 'bg-[rgba(10,10,10,0.2)]'}`
  const inputCls = "w-full bg-white text-eva-black text-xs px-3 py-2 border-2 border-[rgba(10,10,10,0.08)] outline-none font-mono focus:border-eva-orange transition-colors"

  return (
    <div className="h-screen flex bg-eva-white text-eva-black bg-grid">
      <TargetCursor />
      {/* Toast */}
      {toast && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-eva-black text-white px-5 py-2.5 text-xs font-mono tracking-wide shadow-xl">{toast}</div>}

      {/* ===== LEFT SIDEBAR ===== */}
      <div className="w-[240px] border-r-2 border-[rgba(10,10,10,0.06)] flex flex-col shrink-0 bg-white">
        {/* Brand */}
        <div className="px-4 py-4 border-b-2 border-[rgba(10,10,10,0.06)]">
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="Aeon" className="h-10" />
            <div>
              <div className="font-display text-lg leading-tight">{repo ? repo.split('/').pop() : 'Aeon'} HQ</div>
              <div className="text-[11px] text-primary-40 font-mono">{enabledCount} on duty{workingCount > 0 ? <span className="text-eva-orange"> &middot; {workingCount} working</span> : ''}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div className="px-2 py-2 border-b-2 border-[rgba(10,10,10,0.06)] space-y-0.5">
          {[
            { id: 'hq', label: 'HQ', icon: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z' },
            { id: 'secrets', label: 'Settings', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z' },
          ].map(item => (
            <button key={item.id} onClick={() => { setView(item.id as 'hq' | 'secrets'); setSelectedSkill(null) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-mono transition-all ${view === item.id && !selectedSkill ? 'bg-eva-black text-white' : 'text-primary-50 hover:text-primary-100 hover:bg-eva-gray'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={item.icon} /></svg>
              {item.label}
            </button>
          ))}
        </div>

        {/* Team roster */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pt-4 pb-1"><span className="text-label">Team</span></div>
          <div className="px-3 pb-2">
            <input type="text" value={skillSearch} onChange={(e) => setSkillSearch(e.target.value)} placeholder="Search members..." className="w-full bg-eva-gray text-eva-black text-[11px] px-3 py-1.5 border-2 border-[rgba(10,10,10,0.06)] outline-none font-mono focus:border-eva-orange transition-colors placeholder:text-primary-35" />
          </div>
          {[...departments.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([tag, tagSkills]) => {
            const filtered = skillSearch ? tagSkills.filter(s => displayName(s.name).toLowerCase().includes(skillSearch.toLowerCase()) || s.name.includes(skillSearch.toLowerCase())) : tagSkills
            if (skillSearch && !filtered.length) return null
            const d = DEPARTMENTS[tag] || DEPARTMENTS.meta
            const en = filtered.filter(s => s.enabled).length
            return (
              <div key={tag} className="mb-1">
                <div className="flex items-center gap-2 px-4 py-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-[11px] font-mono text-primary-40 uppercase tracking-[2px] flex-1">{d.label}</span>
                  <span className="text-[11px] font-mono text-primary-35">{en}</span>
                </div>
                {filtered.sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name)).map(s => {
                  const st = getSkillStatus(s.name, s.enabled, runs)
                  const sel = selectedSkill === s.name
                  return (
                    <button key={s.name} onClick={() => { setSelectedSkill(s.name); setView('hq'); setEditingSchedule(false); setEditingVar(false) }}
                      className={`w-full flex items-center gap-2.5 px-4 py-2 transition-all text-left ${sel ? 'bg-eva-gray selected-indicator' : 'hover:bg-eva-gray'}`}>
                      <div className="w-7 h-7 flex items-center justify-center text-[10px] font-bold shrink-0 text-white" style={{ backgroundColor: s.enabled ? d.color : 'rgba(10,10,10,0.15)' }}>
                        {initials(s.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-primary-100 truncate">{displayName(s.name)}</div>
                        <div className="flex items-center gap-1.5">
                          <div className={statusDot(st.color)} />
                          <span className="text-[10px] text-primary-40 font-mono truncate">{st.label}</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* ===== CENTER PANEL ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-12 border-b-2 border-[rgba(10,10,10,0.06)] flex items-center justify-between px-5 shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg">{skill ? displayName(skill.name) : view === 'secrets' ? 'Settings' : `${repo ? repo.split('/').pop() : 'Aeon'} HQ`}</span>
            {skill && dept && <span className="text-[11px] font-mono px-2 py-0.5" style={{ backgroundColor: dept.color + '15', color: dept.color }}>{dept.label}</span>}
          </div>
          <div className="flex items-center gap-2">
            {authStatus && !authStatus.authenticated && <button onClick={() => setupAuth()} disabled={authLoading} className="bg-eva-orange text-white text-[11px] px-3 py-1.5 font-mono uppercase tracking-[1px] hover:opacity-90 transition-opacity disabled:opacity-50">{authLoading ? '...' : 'Auth'}</button>}
            <select value={model} onChange={(e) => updateModel(e.target.value)} className="bg-white text-primary-70 text-[11px] px-2.5 py-1.5 border-2 border-[rgba(10,10,10,0.08)] outline-none cursor-pointer font-mono">
              {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <button onClick={() => setShowImport(true)} className="bg-eva-black text-white text-[11px] px-3 py-1.5 font-mono uppercase tracking-[1px] hover:opacity-90 transition-opacity">+ Hire</button>
            {repo && <a href={`https://github.com/${repo}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary-40 font-mono border-2 border-[rgba(10,10,10,0.08)] px-3 py-1.5 hover:border-eva-orange hover:text-eva-orange transition-colors">GitHub</a>}
            <button onClick={pullFromGithub} disabled={pulling} className="relative text-[11px] font-mono text-primary-40 border-2 border-[rgba(10,10,10,0.08)] px-3 py-1.5 hover:border-[rgba(10,10,10,0.2)] transition-colors disabled:opacity-50">
              {behind > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-eva-orange" />}
              {pulling ? '...' : 'Pull'}
            </button>
            <button onClick={syncToGithub} disabled={syncing || !hasChanges} className="relative text-[11px] font-mono text-primary-40 border-2 border-[rgba(10,10,10,0.08)] px-3 py-1.5 hover:border-[rgba(10,10,10,0.2)] transition-colors disabled:opacity-50">
              {hasChanges && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-eva-green" />}
              {syncing ? '...' : 'Push'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-[var(--space-lg)]">

          {/* --- SECRETS --- */}
          {view === 'secrets' && !selectedSkill && (
            <div className="max-w-2xl mx-auto space-y-[var(--space-lg)]">
              <h2 className="font-display text-2xl">Access Credentials</h2>
              {['Core', 'Telegram', 'Discord', 'Slack', 'Skill Keys'].map(group => {
                const gs = secrets.filter(s => s.group === group); if (!gs.length) return null
                return (
                  <div key={group}>
                    <div className="text-label mb-[var(--space-sm)]">{group}</div>
                    <div className="card-hst divide-y divide-[rgba(10,10,10,0.06)]">
                      {gs.map(secret => (
                        <div key={secret.name} className="px-[var(--space-md)] py-[var(--space-sm)]">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2"><span className="font-mono text-xs">{secret.name}</span><span className={`w-2 h-2 rounded-full ${secret.isSet ? 'bg-eva-green' : 'bg-[rgba(10,10,10,0.15)]'}`} /></div>
                              <div className="text-[11px] text-primary-40 font-mono">{secret.description}</div>
                            </div>
                            <div className="flex gap-1.5">
                              {!secret.isSet && editingSecret !== secret.name && <button onClick={() => { setEditingSecret(secret.name); setSecretValue('') }} className="text-[11px] text-primary-40 font-mono hover:text-eva-orange transition-colors px-2 py-1">Set</button>}
                              {secret.isSet && <button onClick={() => deleteSecret(secret.name)} disabled={!!busy[`sec-${secret.name}`]} className="text-[11px] text-eva-red/50 hover:text-eva-red font-mono px-2 py-1 transition-colors">Remove</button>}
                            </div>
                          </div>
                          {editingSecret === secret.name && (
                            <div className="flex gap-2 mt-2">
                              <input type="password" value={secretValue} onChange={(e) => setSecretValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveSecret(secret.name)} placeholder="paste value..." autoFocus className={inputCls} />
                              <button onClick={() => saveSecret(secret.name)} disabled={!secretValue.trim()} className="bg-eva-green text-white text-[11px] px-4 py-2 font-mono hover:opacity-90 transition-opacity disabled:opacity-50">Save</button>
                              <button onClick={() => { setEditingSecret(null); setSecretValue('') }} className="text-[11px] text-primary-40 font-mono px-2 py-2 hover:text-primary-70">Cancel</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              <div>{addingSecret ? (<div className="space-y-2"><input type="text" value={newSecretName} onChange={(e) => setNewSecretName(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))} placeholder="SECRET_NAME" autoFocus className={inputCls} />{newSecretName && <div className="flex gap-2"><input type="password" value={secretValue} onChange={(e) => setSecretValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveSecret(newSecretName)} placeholder="value..." className={inputCls} /><button onClick={() => saveSecret(newSecretName)} disabled={!secretValue.trim()} className="bg-eva-green text-white text-[11px] px-4 py-2 font-mono hover:opacity-90 disabled:opacity-50">Save</button></div>}<button onClick={() => { setAddingSecret(false); setNewSecretName(''); setSecretValue('') }} className="text-[11px] text-primary-40 font-mono hover:text-primary-70">Cancel</button></div>) : <button onClick={() => setAddingSecret(true)} className="text-[11px] text-primary-40 font-mono hover:text-eva-orange transition-colors">+ Add Credential</button>}</div>
            </div>
          )}

          {/* --- HQ OVERVIEW --- */}
          {view === 'hq' && !selectedSkill && (
            <div className="max-w-3xl mx-auto space-y-[var(--space-lg)]">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-[var(--space-sm)]">
                {[
                  { label: 'Team Size', value: skills.length, color: '' },
                  { label: 'On Duty', value: enabledCount, color: 'text-eva-green' },
                  { label: 'Working', value: workingCount, color: 'text-eva-orange' },
                  { label: 'Departments', value: departments.size, color: '' },
                ].map(s => (
                  <div key={s.label} className="card-hst p-[var(--space-md)]">
                    <div className="text-label">{s.label}</div>
                    <div className={`font-display text-3xl mt-1 ${s.color}`}>{s.value}</div>
                  </div>
                ))}
              </div>

              <div className="warning-stripes" />

              {/* Departments */}
              <div>
                <div className="text-label mb-[var(--space-sm)]">Departments</div>
                <div className="grid grid-cols-2 gap-[var(--space-sm)]">
                  {[...departments.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([tag, ts]) => {
                    const d = DEPARTMENTS[tag] || DEPARTMENTS.meta; const en = ts.filter(s => s.enabled).length
                    return (
                      <div key={tag} className="card-hst card-hst-orange p-[var(--space-md)] flex items-center gap-3">
                        <div className="w-9 h-9 flex items-center justify-center text-white text-xs font-bold font-mono" style={{ backgroundColor: d.color }}>{d.label.slice(0, 2).toUpperCase()}</div>
                        <div><div className="text-sm font-display">{d.label}</div><div className="text-[11px] text-primary-40 font-mono">{ts.length} members &middot; {en} active</div></div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Activity */}
              <div>
                <div className="text-label mb-[var(--space-sm)]">Recent Activity</div>
                <div className="card-hst divide-y divide-[rgba(10,10,10,0.06)]">
                  {runs.slice(0, 8).map(run => (
                    <button key={run.id} onClick={() => { setRightTab('runs'); viewRunLogs(run) }}
                      className="w-full flex items-center gap-3 px-[var(--space-md)] py-[var(--space-sm)] hover:bg-eva-gray transition-colors text-left">
                      <span className={`text-sm ${run.conclusion === 'success' ? 'text-eva-green' : run.conclusion === 'failure' ? 'text-eva-red' : run.status === 'in_progress' ? 'text-eva-orange' : 'text-primary-35'}`}>
                        {run.conclusion === 'success' ? '\u2713' : run.conclusion === 'failure' ? '\u2717' : run.status === 'in_progress' ? '\u25cc' : '\u00b7'}
                      </span>
                      <span className="text-xs text-primary-70 truncate flex-1 font-mono">{run.workflow}</span>
                      <span className="text-[11px] text-primary-35 font-mono tabular-nums">{timeAgo(run.created_at)}</span>
                    </button>
                  ))}
                  {!runs.length && <div className="px-[var(--space-md)] py-[var(--space-xl)] text-center text-xs text-primary-35 font-mono">No activity yet</div>}
                </div>
              </div>
            </div>
          )}

          {/* --- SKILL DETAIL --- */}
          {skill && (
            <div className="max-w-2xl mx-auto space-y-[var(--space-md)]">
              {/* Profile */}
              <div className="card-hst p-[var(--space-lg)] corner-markers">
                <div className="corner-marker corner-marker-sm top-left" /><div className="corner-marker corner-marker-sm top-right" />
                <div className="corner-marker corner-marker-sm bottom-left" /><div className="corner-marker corner-marker-sm bottom-right" />
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 flex items-center justify-center text-lg font-bold text-white shrink-0" style={{ backgroundColor: skill.enabled ? (dept?.color || '#6B7280') : 'rgba(10,10,10,0.15)' }}>
                    {initials(skill.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h2 className="font-display text-2xl">{displayName(skill.name)}</h2>
                      {(() => { const st = getSkillStatus(skill.name, skill.enabled, runs); return (
                        <span className={`inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 font-mono ${st.color === 'green' ? 'bg-green-50 text-eva-green' : st.color === 'orange' ? 'bg-orange-50 text-eva-orange' : st.color === 'red' ? 'bg-red-50 text-eva-red' : 'bg-eva-gray text-primary-40'}`}>
                          <span className={statusDot(st.color)} />{st.label}
                        </span>
                      )})()}
                    </div>
                    {skill.description && <p className="text-sm text-primary-50 mt-2 leading-relaxed font-display">{skill.description}</p>}
                  </div>
                </div>
                <div className="warning-stripes mt-[var(--space-md)]" />
                <div className="flex items-center gap-2 mt-[var(--space-md)]">
                  <button onClick={() => toggleSkill(skill.name, !skill.enabled)} disabled={!!busy[skill.name]}
                    className={`text-[11px] px-5 py-2 font-mono uppercase tracking-[1px] transition-opacity hover:opacity-90 ${skill.enabled ? 'bg-eva-gray text-primary-70 border-2 border-[rgba(10,10,10,0.08)]' : 'bg-eva-green text-white'}`}>
                    {skill.enabled ? 'Off Duty' : 'On Duty'}
                  </button>
                  <button onClick={() => runSkill(skill.name, skill.var, skill.model)} disabled={!!busy[`r-${skill.name}`]}
                    className="bg-eva-orange text-white text-[11px] px-5 py-2 font-mono uppercase tracking-[1px] hover:opacity-90 transition-opacity disabled:opacity-50">
                    {busy[`r-${skill.name}`] ? '...' : 'Run'}
                  </button>
                  <button onClick={() => { if (confirm(`Remove ${displayName(skill.name)}?`)) deleteSkill(skill.name) }}
                    className="text-[11px] text-eva-red/40 hover:text-eva-red font-mono px-3 py-2 ml-auto transition-colors">Remove</button>
                </div>
              </div>

              {/* Shift */}
              <div className="card-hst p-[var(--space-md)]">
                <div className="flex items-center justify-between mb-[var(--space-sm)]">
                  <span className="text-label">Shift Schedule</span>
                  <button onClick={() => setEditingSchedule(!editingSchedule)} className="text-[11px] text-primary-40 font-mono hover:text-eva-orange transition-colors">{editingSchedule ? 'Cancel' : 'Edit'}</button>
                </div>
                {editingSchedule ? <ScheduleEditor cron={skill.schedule} onSave={(c) => updateSchedule(skill.name, c)} /> : <div className="font-display text-xl">{cronLabel(skill.schedule)}</div>}
              </div>

              {/* Brief */}
              <div className="card-hst p-[var(--space-md)]">
                <div className="flex items-center justify-between mb-[var(--space-sm)]">
                  <span className="text-label">Assignment Brief</span>
                  <button onClick={() => { setEditingVar(!editingVar); setVarDraft(skill.var) }} className="text-[11px] text-primary-40 font-mono hover:text-eva-orange transition-colors">{editingVar ? 'Cancel' : 'Edit'}</button>
                </div>
                {editingVar ? (
                  <div className="flex gap-2"><input type="text" value={varDraft} onChange={(e) => setVarDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && updateVar(skill.name, varDraft)} placeholder="e.g. AI, bitcoin" className={inputCls} /><button onClick={() => updateVar(skill.name, varDraft)} className="bg-eva-black text-white text-[11px] px-4 py-2 font-mono hover:opacity-90">Save</button></div>
                ) : <div className="font-display text-lg">{skill.var || <span className="text-primary-35">No assignment</span>}</div>}
              </div>

              {/* Model */}
              <div className="card-hst p-[var(--space-md)]">
                <div className="text-label mb-[var(--space-sm)]">Capability Level</div>
                <select value={skill.model} onChange={(e) => updateSkillModel(skill.name, e.target.value)} className="bg-white text-eva-black text-xs px-3 py-2 border-2 border-[rgba(10,10,10,0.08)] outline-none font-mono w-full cursor-pointer focus:border-eva-orange transition-colors">
                  <option value="">Default ({MODELS.find(m => m.id === model)?.label})</option>
                  {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>

              {/* Activity */}
              <div>
                <div className="text-label mb-[var(--space-sm)]">Activity Log</div>
                <div className="card-hst divide-y divide-[rgba(10,10,10,0.06)]">
                  {skillRuns.slice(0, 10).map(run => (
                    <button key={run.id} onClick={() => { setRightTab('runs'); viewRunLogs(run) }}
                      className="w-full flex items-center gap-3 px-[var(--space-md)] py-[var(--space-sm)] hover:bg-eva-gray transition-colors text-left">
                      <span className={`text-sm ${run.conclusion === 'success' ? 'text-eva-green' : run.conclusion === 'failure' ? 'text-eva-red' : run.status === 'in_progress' ? 'text-eva-orange' : 'text-primary-35'}`}>
                        {run.conclusion === 'success' ? '\u2713' : run.conclusion === 'failure' ? '\u2717' : run.status === 'in_progress' ? '\u25cc' : '\u00b7'}
                      </span>
                      <span className="text-xs text-primary-70 truncate flex-1 font-mono">{run.conclusion === 'success' ? 'Task completed' : run.conclusion === 'failure' ? 'Task failed' : run.status === 'in_progress' ? 'Working...' : 'Queued'}</span>
                      <span className="text-[11px] text-primary-35 font-mono tabular-nums">{timeAgo(run.created_at)}</span>
                    </button>
                  ))}
                  {!skillRuns.length && <div className="px-[var(--space-md)] py-[var(--space-xl)] text-center text-xs text-primary-35 font-mono">No activity</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== RIGHT PANEL ===== */}
      <div className="w-[320px] border-l-2 border-[rgba(10,10,10,0.06)] flex flex-col shrink-0 bg-white">
        <div className="h-12 border-b-2 border-[rgba(10,10,10,0.06)] flex items-center px-3 gap-1 shrink-0">
          {(['feed', 'runs', 'analytics'] as const).map(tab => (
            <button key={tab} onClick={() => { setRightTab(tab); if (tab === 'analytics' && !analyticsData) fetch('/api/analytics').then(r => r.ok ? r.json() : null).then(d => { if (d) setAnalyticsData(d) }) }}
              className={`text-[11px] px-2.5 py-1.5 transition-colors font-mono uppercase tracking-[1px] ${rightTab === tab ? 'bg-eva-black text-white' : 'text-primary-40 hover:text-primary-70'}`}>{tab}</button>
          ))}
          <button onClick={() => { fetchData(); setFeedKey(k => k + 1); setAnalyticsData(null) }} className="text-[11px] text-primary-35 hover:text-eva-orange transition-colors ml-auto font-mono">Refresh</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Feed — falls back to Runs when empty */}
          {rightTab === 'feed' && (
            feedLoading ? <div className="flex justify-center py-12"><div className="w-2 h-2 rounded-full bg-eva-orange animate-pulse" /></div> :
            outputs.length > 0 ? (
            <div className="space-y-3 p-3">
              {outputs.map(o => (
                <div key={o.filename}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[11px] font-mono text-eva-orange">{o.skill}</span>
                    <span className="text-[11px] text-primary-35 font-mono">{timeAgo(o.timestamp)}</span>
                  </div>
                  {o.spec?.root && o.spec?.elements ? <SpecNode id={o.spec.root} elements={o.spec.elements} /> : null}
                </div>
              ))}
            </div>
            ) : (
            <div>
              {!runs.length ? <div className="px-4 py-12 text-center text-xs text-primary-35 font-mono">No activity yet</div> :
                runs.map(run => (
                  <button key={run.id} onClick={() => { setRightTab('runs'); viewRunLogs(run) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-[rgba(10,10,10,0.04)] hover:bg-eva-gray transition-colors text-left">
                    <span className={`text-xs ${run.conclusion === 'success' ? 'text-eva-green' : run.conclusion === 'failure' ? 'text-eva-red' : run.status === 'in_progress' ? 'text-eva-orange' : 'text-primary-35'}`}>
                      {run.conclusion === 'success' ? '\u2713' : run.conclusion === 'failure' ? '\u2717' : run.status === 'in_progress' ? '\u25cc' : '\u00b7'}
                    </span>
                    <span className="text-xs text-primary-70 truncate flex-1 font-mono">{run.workflow}</span>
                    <span className="text-[11px] text-primary-35 font-mono tabular-nums">{timeAgo(run.created_at)}</span>
                  </button>
                ))}
            </div>
            )
          )}

          {/* Runs */}
          {rightTab === 'runs' && (
            selectedRun ? (
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 px-3 py-2.5 border-b-2 border-[rgba(10,10,10,0.06)]">
                  <button onClick={() => { setSelectedRun(null); setRunLogs(''); setRunSummary('') }} className="text-primary-40 hover:text-primary-100 text-xs">&larr;</button>
                  <span className="font-mono text-xs text-primary-70 truncate flex-1">{selectedRun.workflow}</span>
                  <a href={selectedRun.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary-40 font-mono border-2 border-[rgba(10,10,10,0.08)] px-2 py-0.5 hover:border-eva-orange hover:text-eva-orange transition-colors">GitHub</a>
                </div>
                <div className="flex-1 overflow-y-auto p-3">
                  {logsLoading ? <div className="flex justify-center py-8"><div className="w-2 h-2 rounded-full bg-eva-orange animate-pulse" /></div> : (
                    <div className="space-y-3">
                      {runSummary ? (
                        <>
                          <pre className="text-[11px] leading-relaxed font-mono text-primary-70 whitespace-pre-wrap break-words">{runSummary.replace(/\x1b\[[0-9;]*m/g, '').replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z ?/gm, '')}</pre>
                          <button onClick={() => setShowFullLogs(!showFullLogs)} className="text-[11px] text-primary-40 hover:text-eva-orange font-mono transition-colors">{showFullLogs ? '- Hide full logs' : '+ Show full logs'}</button>
                          {showFullLogs && <pre className="text-[11px] font-mono text-primary-50 whitespace-pre-wrap break-words border-t-2 border-[rgba(10,10,10,0.06)] pt-3">{runLogs.replace(/\x1b\[[0-9;]*m/g, '')}</pre>}
                        </>
                      ) : (
                        <pre className="text-[11px] font-mono text-primary-50 whitespace-pre-wrap break-words">{runLogs.replace(/\x1b\[[0-9;]*m/g, '')}</pre>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                {!runs.length ? <div className="px-4 py-12 text-center text-xs text-primary-35 font-mono">No runs</div> :
                  runs.map(run => (
                    <button key={run.id} onClick={() => viewRunLogs(run)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-[rgba(10,10,10,0.04)] hover:bg-eva-gray transition-colors text-left">
                      <span className={`text-xs ${run.conclusion === 'success' ? 'text-eva-green' : run.conclusion === 'failure' ? 'text-eva-red' : run.status === 'in_progress' ? 'text-eva-orange' : 'text-primary-35'}`}>
                        {run.conclusion === 'success' ? '\u2713' : run.conclusion === 'failure' ? '\u2717' : run.status === 'in_progress' ? '\u25cc' : '\u00b7'}
                      </span>
                      <span className="text-xs text-primary-70 truncate flex-1 font-mono">{run.workflow}</span>
                      <span className="text-[11px] text-primary-35 font-mono tabular-nums">{timeAgo(run.created_at)}</span>
                    </button>
                  ))}
              </div>
            )
          )}

          {/* Analytics */}
          {rightTab === 'analytics' && (
            !analyticsData ? <div className="flex justify-center py-12"><div className="w-2 h-2 rounded-full bg-eva-orange animate-pulse" /></div> : (
              <div className="p-3 space-y-4">
                <div className="grid grid-cols-2 gap-[var(--space-xs)]">
                  <div className="card-hst p-3"><div className="text-label">Runs</div><div className="font-display text-2xl mt-1">{analyticsData.summary.totalRuns}</div></div>
                  <div className="card-hst p-3"><div className="text-label">Success</div><div className={`font-display text-2xl mt-1 ${analyticsData.summary.overallSuccessRate >= 80 ? 'text-eva-green' : analyticsData.summary.overallSuccessRate >= 50 ? 'text-eva-amber' : 'text-eva-red'}`}>{analyticsData.summary.overallSuccessRate}%</div></div>
                </div>
                {analyticsData.insights.length > 0 && (
                  <div className="space-y-1.5">
                    {analyticsData.insights.map((ins, i) => (
                      <div key={i} className={`text-[11px] font-mono px-3 py-2 border-2 ${ins.type === 'warning' ? 'text-eva-orange bg-orange-50 border-orange-200' : ins.type === 'success' ? 'text-eva-green bg-green-50 border-green-200' : 'text-blue-600 bg-blue-50 border-blue-200'}`}>{ins.message}</div>
                    ))}
                  </div>
                )}
                <div className="space-y-1">
                  {analyticsData.skills.map(s => (
                    <div key={s.name} className="flex items-center gap-2 py-1">
                      <span className={`text-xs w-3 text-center ${s.lastConclusion === 'success' ? 'text-eva-green' : s.lastConclusion === 'failure' ? 'text-eva-red' : 'text-primary-35'}`}>
                        {s.lastConclusion === 'success' ? '\u2713' : s.lastConclusion === 'failure' ? '\u2717' : '\u00b7'}
                      </span>
                      <span className="font-mono text-[11px] text-primary-70 w-28 truncate">{s.name}</span>
                      <div className="flex-1 h-2 bg-eva-gray overflow-hidden flex">
                        {s.success > 0 && <div className="bg-eva-green/60 h-full" style={{ width: `${(s.success / Math.max(...analyticsData.skills.map(sk => sk.total), 1)) * 100}%` }} />}
                        {s.failure > 0 && <div className="bg-eva-red/40 h-full" style={{ width: `${(s.failure / Math.max(...analyticsData.skills.map(sk => sk.total), 1)) * 100}%` }} />}
                      </div>
                      <span className={`text-[10px] font-mono tabular-nums w-8 text-right ${s.successRate >= 80 ? 'text-eva-green' : s.successRate >= 50 ? 'text-eva-amber' : 'text-eva-red'}`}>{s.successRate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* ===== MODALS ===== */}
      {showImport && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white border-2 border-[rgba(10,10,10,0.08)] w-full max-w-md mx-4 p-[var(--space-lg)] shadow-2xl">
            <div className="flex items-center justify-between mb-[var(--space-md)]">
              <h2 className="font-display text-xl">Hire New Member</h2>
              <button onClick={() => { setShowImport(false); setUploadFiles([]); setUploadName('') }} className="text-primary-35 hover:text-primary-100 text-lg">&times;</button>
            </div>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && readFilesFromInput(e.target.files)} />
            <input ref={(el) => { if (el) el.setAttribute('webkitdirectory', '') }} type="file" className="hidden" id="folder-input" onChange={(e) => e.target.files && readFilesFromInput(e.target.files)} />
            <div onDragOver={(e) => { e.preventDefault(); setUploadDragOver(true) }} onDragLeave={() => setUploadDragOver(false)} onDrop={(e) => { e.preventDefault(); setUploadDragOver(false); if (e.dataTransfer.files.length > 0) readFilesFromInput(e.dataTransfer.files) }}
              className={`border-2 border-dashed p-8 text-center transition-colors ${uploadDragOver ? 'border-eva-orange bg-orange-50' : 'border-[rgba(10,10,10,0.12)] hover:border-[rgba(10,10,10,0.2)]'}`}>
              {!uploadFiles.length ? (<><div className="text-sm text-primary-50 font-display mb-3">Drop a skill folder here</div><div className="flex gap-2 justify-center"><button onClick={() => fileInputRef.current?.click()} className="bg-eva-gray text-primary-70 text-[11px] px-3 py-1.5 font-mono border-2 border-[rgba(10,10,10,0.08)] hover:border-[rgba(10,10,10,0.2)] transition-colors">Files</button><button onClick={() => document.getElementById('folder-input')?.click()} className="bg-eva-gray text-primary-70 text-[11px] px-3 py-1.5 font-mono border-2 border-[rgba(10,10,10,0.08)] hover:border-[rgba(10,10,10,0.2)] transition-colors">Folder</button></div><div className="text-[11px] text-primary-35 font-mono mt-3">Must include SKILL.md</div></>) : (<><div className="text-sm text-primary-70 font-display">{uploadFiles.length} file{uploadFiles.length !== 1 ? 's' : ''}</div><button onClick={() => { setUploadFiles([]); setUploadName('') }} className="text-[11px] text-primary-40 font-mono hover:text-eva-orange mt-2 transition-colors">Clear</button></>)}
            </div>
            {uploadFiles.length > 0 && (
              <div className="mt-[var(--space-md)] space-y-3">
                <input type="text" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="team-member-name" className={inputCls} />
                <button onClick={uploadSkill} disabled={importLoading} className="w-full bg-eva-black text-white text-sm py-3 font-mono uppercase tracking-[2px] hover:opacity-90 transition-opacity disabled:opacity-50">{importLoading ? 'Hiring...' : 'Add to Team'}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white border-2 border-[rgba(10,10,10,0.08)] w-full max-w-sm mx-4 p-[var(--space-lg)] shadow-2xl">
            <div className="flex items-center justify-between mb-[var(--space-sm)]">
              <h2 className="font-display text-xl">Authenticate</h2>
              <button onClick={() => { setShowAuthModal(false); setAuthKey('') }} className="text-primary-35 hover:text-primary-100 text-lg">&times;</button>
            </div>
            <p className="text-xs text-primary-50 font-mono mb-[var(--space-md)]">Paste your API key to enable deployments.</p>
            <input type="password" value={authKey} onChange={(e) => setAuthKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && authKey.trim() && setupAuth(authKey.trim())} placeholder="sk-ant-..." autoFocus className={`${inputCls} mb-[var(--space-md)]`} />
            <button onClick={() => setupAuth(authKey.trim())} disabled={!authKey.trim() || authLoading} className="w-full bg-eva-black text-white text-sm py-3 font-mono uppercase tracking-[2px] hover:opacity-90 transition-opacity disabled:opacity-50">{authLoading ? '...' : 'Save'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
