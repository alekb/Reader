import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { RecordSounds } from '../components/RecordSounds'
import { Screen, TopBar } from '../components/ui'
import { GPCS, GPC_BY_ID, GROUPS } from '../content/gpcs'
import { TRICKY_WORDS } from '../content/trickyWords'
import { newItemPolicy, nextGpcToIntroduce, nextTrickyToIntroduce, summarize } from '../engine/curriculum'
import { DAY_MS, dayKey, masteryOf } from '../engine/scheduler'
import type { MasteryLevel } from '../engine/scheduler'
import type { SessionLog, VoiceGender } from '../engine/types'
import { useProgress } from '../store/progressStore'
import { useSync } from '../store/syncStore'
import { isParentUnlocked } from './ParentGate'
import { say } from '../speech/phonics'
import { stopSpeaking } from '../speech/tts'

type Tab = 'progress' | 'activity' | 'sounds' | 'account' | 'settings'

const STATUS: Record<MasteryLevel, { label: string; color: string; icon: string }> = {
  new: { label: 'Not started', color: '#e5e7eb', icon: '–' },
  learning: { label: 'Learning', color: '#fcd34d', icon: '▲' },
  secure: { label: 'Secure', color: '#7dd3fc', icon: '■' },
  mastered: { label: 'Mastered', color: '#4ade80', icon: '★' },
}

export function Dashboard() {
  const nav = useNavigate()
  const progress = useProgress((s) => s.progress)
  const sessions = useProgress((s) => s.sessions)
  const [tab, setTab] = useState<Tab>('progress')
  if (!isParentUnlocked()) return <Navigate to="/parent" replace />
  if (!progress) {
    // No child profile on this device yet (fresh install): only offer sign-in to restore.
    return (
      <Screen className="gap-3 px-4 pb-10 text-base">
        <TopBar title="Restore progress" onBack={() => nav('/')} />
        <AccountTab />
      </Screen>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'progress', label: 'Progress' },
    { id: 'activity', label: 'Activity' },
    { id: 'sounds', label: 'Sounds' },
    { id: 'account', label: 'Account' },
    { id: 'settings', label: 'Settings' },
  ]

  return (
    <Screen className="gap-3 px-4 pb-10 text-base">
      <TopBar title="Parent dashboard" onBack={() => nav('/')} />
      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 whitespace-nowrap rounded-xl px-2 py-2 text-xs font-extrabold ${tab === t.id ? 'bg-grape text-white' : 'text-ink/60'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'progress' && <ProgressTab />}
      {tab === 'activity' && <ActivityTab sessions={sessions} goalMin={progress.dailyGoalMin} />}
      {tab === 'sounds' && <SoundsTab />}
      {tab === 'account' && <AccountTab />}
      {tab === 'settings' && <SettingsTab />}
    </Screen>
  )
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      {title && <div className="mb-2 text-sm font-extrabold uppercase tracking-wide text-ink/50">{title}</div>}
      {children}
    </div>
  )
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-cream p-3">
      <div className="text-2xl font-extrabold text-ink">{value}</div>
      <div className="text-xs font-bold uppercase text-ink/50">{label}</div>
      {sub && <div className="text-xs text-ink/60">{sub}</div>}
    </div>
  )
}

function ProgressTab() {
  const progress = useProgress((s) => s.progress)!
  const sessions = useProgress((s) => s.sessions)
  const now = Date.now()
  const s = useMemo(() => summarize(progress, now), [progress, now])
  const totalMin = Math.round(sessions.reduce((a, x) => a + x.durationSec, 0) / 60)
  const group = GROUPS.find((g) => g.id === progress.currentGroup)
  const policy = newItemPolicy(progress, now)
  const nextGpc = nextGpcToIntroduce(progress)
  const nextTricky = nextTrickyToIntroduce(progress)
  const last7 = sessions.filter((x) => now - x.startedAt < 7 * DAY_MS)
  const acc7 = last7.reduce((a, x) => a + x.attempts, 0) ? Math.round((last7.reduce((a, x) => a + x.correct, 0) / last7.reduce((a, x) => a + x.attempts, 0)) * 100) : null

  return (
    <>
      <Card title="Where the child is">
        <div className="text-xl font-extrabold">
          {group?.theme.emoji} Island {progress.currentGroup}: {group?.title}
        </div>
        <div className="text-ink/70">{group?.tagline}</div>
        <div className="mt-2 text-sm text-ink/70">
          Next: {nextGpc ? <b className="font-letter text-base">{GPC_BY_ID[nextGpc].grapheme} ({GPC_BY_ID[nextGpc].sound})</b> : <b>all sounds taught</b>}
          {nextTricky && (
            <>
              {' '}· next heart word <b>{nextTricky}</b>
            </>
          )}
        </div>
        <div className="mt-1 text-xs text-ink/50">Next session: {policy.reason}</div>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <Tile label="Sounds mastered" value={`${s.gpcsMastered} / ${s.gpcsTotal}`} sub={`${s.gpcsSecure} secure · ${s.gpcsLearning} learning`} />
        <Tile label="Heart words" value={`${s.trickyMastered} / ${s.trickyTotal}`} sub={`${s.trickyLearning} learning`} />
        <Tile label="Words read" value={String(s.knownWords)} sub={`${progress.wordsRead} total reads`} />
        <Tile label="Streak" value={`${s.streak} days`} sub={`${progress.sessionsCompleted} sessions`} />
        <Tile label="Total practice" value={`${totalMin} min`} sub={`${sessions.length} sessions started`} />
        <Tile label="Accuracy (7 days)" value={acc7 == null ? '–' : `${acc7}%`} sub="target 70–90% (not too easy, not too hard)" />
      </div>
      <Card title="How it works">
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink/80">
          <li>Each session (10–15 min) follows the same order: review → robot talk → new sound → read words → heart word → sentences → build words.</li>
          <li>Sounds are taught in a proven synthetic-phonics order so real words can be read from the first few letters.</li>
          <li>Every sound and heart word is reviewed on a spaced schedule (1, 2, 4, 7, 14, 30 days). Mistakes bring an item back sooner.</li>
          <li>A new sound is only introduced when review goes well; every 4th session is review-only. Stars reward effort, not accuracy.</li>
          <li>Tip: ask the child to say each sound and word <b>out loud</b>; the app checks by tapping, you check by listening.</li>
        </ul>
      </Card>
    </>
  )
}

function ActivityTab({ sessions, goalMin }: { sessions: SessionLog[]; goalMin: number }) {
  const now = Date.now()
  const days = useMemo(() => {
    const out: { key: string; label: string; min: number; sessions: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const t = now - i * DAY_MS
      const key = dayKey(t)
      const d = new Date(t)
      out.push({ key, label: d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2), min: 0, sessions: 0 })
    }
    for (const s of sessions) {
      const row = out.find((d) => d.key === dayKey(s.startedAt))
      if (row) {
        row.min += s.durationSec / 60
        row.sessions++
      }
    }
    return out
  }, [sessions, now])
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(goalMin, ...days.map((d) => d.min), 1)
  const W = 340
  const H = 150
  const padL = 28
  const padB = 24
  const padT = 10
  const barW = (W - padL) / days.length
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max)
  const activeDays = days.filter((d) => d.sessions > 0).length
  const weekMin = Math.round(days.slice(7).reduce((a, d) => a + d.min, 0))
  const recent = [...sessions].reverse().slice(0, 15)

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Tile label="This week" value={`${weekMin} min`} sub={`${days.slice(7).filter((d) => d.sessions > 0).length} of 7 days`} />
        <Tile label="Last 14 days" value={`${activeDays} active days`} sub={`goal ${goalMin} min/day`} />
      </div>
      <Card title="Minutes per day (last 14 days)">
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Minutes practised per day for the last 14 days">
            {/* grid */}
            {[0, 0.5, 1].map((f) => (
              <g key={f}>
                <line x1={padL} x2={W} y1={y(max * f)} y2={y(max * f)} stroke="#e5e7eb" strokeWidth={1} />
                <text x={padL - 4} y={y(max * f) + 4} fontSize={10} textAnchor="end" fill="#6b7280">
                  {Math.round(max * f)}
                </text>
              </g>
            ))}
            {/* goal line */}
            <line x1={padL} x2={W} y1={y(goalMin)} y2={y(goalMin)} stroke="#6d28d9" strokeWidth={1} strokeDasharray="4 4" opacity={0.6} />
            <text x={W} y={y(goalMin) - 3} fontSize={9} textAnchor="end" fill="#6d28d9">
              goal
            </text>
            {days.map((d, i) => {
              const x = padL + i * barW + barW * 0.2
              const bw = barW * 0.6
              const top = y(d.min)
              const base = y(0)
              const h = Math.max(0, base - top)
              return (
                <g key={d.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)}>
                  <rect x={padL + i * barW} y={padT} width={barW} height={H - padT - padB} fill="transparent" />
                  {h > 0 && <path d={`M${x} ${base} V${top + 4} a4 4 0 0 1 4 -4 h${bw - 8} a4 4 0 0 1 4 4 V${base} Z`} fill={hover === i ? '#4c1d95' : '#7c3aed'} />}
                  <text x={padL + i * barW + barW / 2} y={H - 8} fontSize={9} textAnchor="middle" fill="#6b7280">
                    {d.label}
                  </text>
                </g>
              )
            })}
          </svg>
          {hover != null && (
            <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-xl bg-ink px-3 py-1 text-xs font-bold text-white">
              {new Date(days[hover].key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: {Math.round(days[hover].min)} min · {days[hover].sessions} session{days[hover].sessions === 1 ? '' : 's'}
            </div>
          )}
        </div>
      </Card>
      <Card title="Recent sessions">
        {recent.length === 0 && <div className="text-ink/60">No sessions yet.</div>}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-ink/50">
              <th className="py-1">When</th>
              <th>Min</th>
              <th>Acc.</th>
              <th>New</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((s) => (
              <tr key={s.id} className="border-t border-ink/5">
                <td className="py-1">
                  {new Date(s.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{' '}
                  <span className="text-ink/50">{new Date(s.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                  {!s.completed && <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-800">stopped early</span>}
                </td>
                <td>{Math.max(1, Math.round(s.durationSec / 60))}</td>
                <td>{s.attempts ? `${Math.round((s.correct / s.attempts) * 100)}%` : '–'}</td>
                <td className="font-letter">
                  {s.newGpcs.map((g) => GPC_BY_ID[g]?.grapheme ?? g).join(' ')} {s.newTricky.length ? '❤️' + s.newTricky.join(' ') : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}

function SoundsTab() {
  const progress = useProgress((s) => s.progress)!
  return (
    <>
      <Card title="Sound map">
        <div className="mb-3 flex flex-wrap gap-3 text-xs font-bold text-ink/70">
          {(Object.keys(STATUS) as MasteryLevel[]).map((k) => (
            <span key={k} className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded" style={{ background: STATUS[k].color }} /> {STATUS[k].icon} {STATUS[k].label}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {GROUPS.filter((g) => g.gpcIds.length).map((g) => (
            <div key={g.id}>
              <div className="mb-1 text-xs font-extrabold uppercase text-ink/50">
                {g.theme.emoji} {g.title}
              </div>
              <div className="flex flex-wrap gap-2">
                {g.gpcIds.map((id) => {
                  const st = progress.gpcs[id]
                  const m = masteryOf(st)
                  const acc = st && st.seen ? Math.round((st.correct / st.seen) * 100) : null
                  return (
                    <div key={id} title={`${GPC_BY_ID[id].sound} · ${STATUS[m].label}${acc != null ? ` · ${acc}% correct` : ''}`} className="flex min-w-14 flex-col items-center rounded-xl px-2 py-1" style={{ background: STATUS[m].color }}>
                      <div className="font-letter text-xl font-bold">{GPC_BY_ID[id].grapheme}</div>
                      <div className="text-[10px] font-bold text-ink/70">
                        {STATUS[m].icon} {acc != null ? `${acc}%` : ''}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Heart words">
        <div className="flex flex-wrap gap-2">
          {TRICKY_WORDS.map((t) => {
            const m = masteryOf(progress.tricky[t.word])
            return (
              <span key={t.word} className="font-letter rounded-xl px-2 py-1 text-base font-bold" style={{ background: STATUS[m].color }} title={STATUS[m].label}>
                {STATUS[m].icon} {t.word}
              </span>
            )
          })}
        </div>
      </Card>
      <Card title="Trouble spots">
        {(() => {
          const rows = GPCS.map((g) => ({ g, st: progress.gpcs[g.id] }))
            .filter(({ st }) => st && st.seen >= 3 && st.wrong / st.seen >= 0.3)
            .sort((a, b) => b.st!.wrong / b.st!.seen - a.st!.wrong / a.st!.seen)
            .slice(0, 8)
          if (!rows.length) return <div className="text-ink/60">Nothing stands out yet. 🎉</div>
          return (
            <ul className="space-y-1 text-sm">
              {rows.map(({ g, st }) => (
                <li key={g.id}>
                  <b className="font-letter text-base">{g.grapheme}</b> ({g.sound}): {Math.round((st!.wrong / st!.seen) * 100)}% wrong over {st!.seen} tries — practise with "{g.keyword}" {g.emoji}
                </li>
              ))}
            </ul>
          )
        })()}
      </Card>
    </>
  )
}

function AccountTab() {
  const sync = useSync()
  const progress = useProgress((s) => s.progress)
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  if (!sync.enabled) {
    return (
      <Card title="Cloud sync">
        <div className="text-ink/80">
          Cloud backup is not available in this version of the app. Progress is saved on this device.
        </div>
      </Card>
    )
  }

  const submit = async () => {
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'signup') await sync.signUp(email, password)
      else await sync.signIn(email, password)
      setMsg('Signed in. Syncing…')
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card title="Cloud sync">
        {sync.user ? (
          <div className="flex flex-col gap-2">
            <div>
              Signed in as <b>{sync.user.email}</b>
            </div>
            <div className="text-sm text-ink/70">
              Status: {sync.status === 'syncing' ? 'syncing…' : sync.status === 'synced' ? `synced ${sync.lastSyncAt ? new Date(sync.lastSyncAt).toLocaleTimeString() : ''}` : sync.status === 'error' ? `error: ${sync.error}` : sync.status}
            </div>
            <div className="text-xs text-ink/60">Progress{progress ? ` for ${progress.childName}` : ''} is saved automatically. Reinstall the app, sign in, and everything comes back.</div>
            <div className="flex gap-2">
              <button onClick={() => sync.pull()} className="btn btn-secondary flex-1 text-base" disabled={sync.status === 'syncing'}>
                ⟳ Restore from cloud
              </button>
              <button onClick={() => sync.push()} className="btn btn-secondary flex-1 text-base" disabled={sync.status === 'syncing'}>
                ↑ Save now
              </button>
            </div>
            <button onClick={() => sync.signOut()} className="btn btn-secondary text-base">
              Sign out (keep progress on this device)
            </button>
            <button
              onClick={async () => {
                await sync.signOut({ clearDevice: true })
                nav('/', { replace: true })
              }}
              className="btn btn-warn text-base"
            >
              Sign out and remove from this device
            </button>
            <DeleteAccount />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="text-sm text-ink/70">Sign in with the parent account to back up progress and restore it on any device.</div>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="email" className="rounded-xl border-2 border-ink/20 px-3 py-2 text-base outline-none focus:border-grape" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (6+ characters)" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className="rounded-xl border-2 border-ink/20 px-3 py-2 text-base outline-none focus:border-grape" />
            {msg && <div className="text-sm font-bold text-rose-700">{msg}</div>}
            <button onClick={submit} disabled={busy || !email || password.length < 6} className="btn btn-primary text-base">
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
            <div className="flex justify-between text-sm">
              <button className="font-bold text-grape" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>
                {mode === 'signup' ? 'I already have an account' : 'Create a new account'}
              </button>
              <button
                className="text-ink/60"
                onClick={async () => {
                  try {
                    await sync.resetPassword(email)
                    setMsg('Password reset email sent.')
                  } catch (e) {
                    setMsg((e as Error).message)
                  }
                }}
                disabled={!email}
              >
                Forgot password?
              </button>
            </div>
          </div>
        )}
      </Card>
    </>
  )
}

function DeleteAccount() {
  const deleteAccount = useSync((s) => s.deleteAccount)
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 text-sm font-bold text-rose-700 underline">
        Delete account and all data…
      </button>
    )
  }
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-2xl border-2 border-rose-200 bg-rose-50 p-3">
      <div className="text-sm font-bold text-rose-800">
        This permanently deletes the parent account, the child's progress, session history and voice recordings, in the cloud and on this device. It cannot be undone.
      </div>
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        autoComplete="current-password"
        placeholder="Enter your password to confirm"
        aria-label="Password"
        className="rounded-xl border-2 border-ink/20 px-3 py-2 text-base outline-none focus:border-rose-500"
      />
      {msg && <div className="text-sm font-bold text-rose-700">{msg}</div>}
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className="btn btn-secondary flex-1 text-base" disabled={busy}>
          Cancel
        </button>
        <button
          disabled={busy || !password}
          onClick={async () => {
            setBusy(true)
            setMsg(null)
            try {
              await deleteAccount(password)
              nav('/', { replace: true })
            } catch (e) {
              setMsg((e as Error).message)
              setBusy(false)
            }
          }}
          className="btn btn-warn flex-1 text-base"
        >
          {busy ? 'Deleting…' : 'Delete forever'}
        </button>
      </div>
    </div>
  )
}

function SettingsTab() {
  const progress = useProgress((s) => s.progress)!
  const setChildName = useProgress((s) => s.setChildName)
  const setDailyGoal = useProgress((s) => s.setDailyGoal)
  const setSettings = useProgress((s) => s.setSettings)
  const resetProgress = useSync((s) => s.resetProgress)
  const signedIn = useSync((s) => Boolean(s.user))
  const nav = useNavigate()
  const [name, setName] = useState(progress.childName)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [showRecorder, setShowRecorder] = useState(false)
  const chooseVoice = (voice: VoiceGender) => {
    setSettings({ voice })
    // Let the parent hear the new voice straight away.
    stopSpeaking()
    say('Great work!')
  }

  return (
    <>
      <Card title="Child">
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 rounded-xl border-2 border-ink/20 px-3 py-2 text-base outline-none focus:border-grape" />
          <button onClick={() => setChildName(name)} className="btn btn-secondary text-base">
            Save
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span>Daily goal</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setDailyGoal(progress.dailyGoalMin - 1)} className="tile h-9 w-9 text-lg">
              −
            </button>
            <span className="w-16 text-center font-bold">{progress.dailyGoalMin} min</span>
            <button onClick={() => setDailyGoal(progress.dailyGoalMin + 1)} className="tile h-9 w-9 text-lg">
              +
            </button>
          </div>
        </div>
      </Card>
      <Card title="Audio">
        <label className="flex items-center justify-between py-1">
          <span>Sound effects</span>
          <input type="checkbox" checked={progress.settings.sfx} onChange={(e) => setSettings({ sfx: e.target.checked })} className="h-6 w-6" />
        </label>
        <div className="flex items-center justify-between py-1">
          <span>Voice</span>
          <div className="flex gap-2" role="radiogroup" aria-label="Voice">
            {(['female', 'male'] as const).map((v) => {
              const on = progress.settings.voice === v
              return (
                <button key={v} role="radio" aria-checked={on} onClick={() => chooseVoice(v)} className={`tile px-3 py-1 text-base ${on ? 'bg-sun font-bold ring-4 ring-grape' : ''}`}>
                  {v === 'female' ? 'Female' : 'Male'}
                </button>
              )
            })}
          </div>
        </div>
        <label className="flex items-center justify-between py-1">
          <span>Voice speed</span>
          <input type="range" min={0.6} max={1.2} step={0.05} value={progress.settings.voiceRate} onChange={(e) => setSettings({ voiceRate: Number(e.target.value) })} />
        </label>
        <button onClick={() => setShowRecorder(!showRecorder)} className="btn btn-secondary mt-2 w-full text-base">
          🎙️ {showRecorder ? 'Hide' : 'Record the sounds in your own voice'}
        </button>
        {showRecorder && (
          <div className="mt-3">
            <RecordSounds />
          </div>
        )}
      </Card>
      <Card title="Danger zone">
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="btn btn-warn w-full text-base">
            Reset all progress
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="font-bold text-rose-700">
              This erases {progress.childName}'s progress and session history{signedIn ? ' on this device and in the cloud backup' : ' on this device'}. Voice recordings are kept.
            </div>
            {resetError && <div className="text-sm font-bold text-rose-700">{resetError}</div>}
            <div className="flex gap-2">
              <button onClick={() => setConfirmReset(false)} className="btn btn-secondary flex-1 text-base">
                Cancel
              </button>
              <button
                disabled={resetting}
                onClick={async () => {
                  setResetting(true)
                  setResetError(null)
                  try {
                    await resetProgress()
                    nav('/', { replace: true })
                  } catch (e) {
                    setResetError((e as Error).message)
                    setResetting(false)
                  }
                }}
                className="btn btn-warn flex-1 text-base"
              >
                {resetting ? 'Resetting…' : 'Yes, reset'}
              </button>
            </div>
          </div>
        )}
      </Card>
    </>
  )
}
