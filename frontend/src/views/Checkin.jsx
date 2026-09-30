import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { todayISO, fmtDate, fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { METRICS, checkinStatus } from '../lib/tracking.js'
import NumField from '../components/NumField.jsx'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { confirmSheet } from '../sheets.jsx'

const round = n => Math.round(n * 10) / 10
const blank = () => ({ w: 0, neck: 0, waist: 0, hips: 0, chest: 0, bicep: 0 })

function Delta({ d, good }) {
  if (d == null) return <span className="dl flat">–</span>
  const r = round(d)
  if (!r) return <span className="dl flat">0</span>
  const cls = good === 0 ? 'flat' : (r * good > 0 ? 'good' : 'bad')
  return <span className={'dl ' + cls}><Icon name={r > 0 ? 'arrowUp' : 'arrowDown'} />{fmtNum(Math.abs(r))}</span>
}

export default function Checkin() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)
  const list = [...(S.checkins || [])].sort((a, b) => (a.d < b.d ? -1 : 1))
  const last = list[list.length - 1], prev = list[list.length - 2], first = list[0]
  const status = checkinStatus(S)
  const [date, setDate] = useState(todayISO())
  const existing = list.find(c => c.d === date)
  const [v, setV] = useState(() => Object.assign(blank(), existing || {}))
  const [metric, setMetric] = useState('w')
  const wUnit = S.unit || 'kg'

  const pickDate = d => { setDate(d); const ex = list.find(c => c.d === d); setV(Object.assign(blank(), ex || {})) }
  const save = () => {
    if (!v.w) { toast(t('Enter your weight')); return }
    update(s => {
      s.checkins = s.checkins || []
      const row = { d: date, t: Date.now(), w: round(v.w), neck: v.neck, waist: v.waist, hips: v.hips, chest: v.chest, bicep: v.bicep }
      const i = s.checkins.findIndex(c => c.d === date)
      if (i >= 0) s.checkins[i] = row; else s.checkins.push(row)
      s.checkins.sort((a, b) => (a.d < b.d ? -1 : 1))
      // the weight also feeds the regular body-weight curve — no double entry
      const b = s.bodyweight.find(x => x.d === date)
      if (b) { b.w = row.w; b.t = Date.now() } else s.bodyweight.push({ d: date, w: row.w, t: Date.now() })
      s.bodyweight.sort((a, b2) => (a.d < b2.d ? -1 : 1))
    })
    toast(t('Check-in saved'))
  }
  const del = d => confirmSheet({
    title: t('Delete this check-in?'), message: fmtDate(d, true), confirmText: t('Delete'), danger: true,
    onConfirm: () => update(s => { s.checkins = s.checkins.filter(c => c.d !== d) })
  })

  const m = METRICS.find(x => x.k === metric)
  const pts = list.filter(c => c[metric]).map(c => ({ t: new Date(c.d + 'T12:00:00').getTime(), y: c[metric], d: c.d }))
  const lab = mt => t(mt.label)
  const unitOf = mt => (mt.k === 'w' ? wUnit : 'in')

  return <div className="narrow">
    <div className="hdr">
      <div><h1>{t('Check-in')}</h1><div className="sub">{t('Every Saturday · body measurements')}</div></div>
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
    </div>

    {status !== 'done' && <div className="card hot">
      <div className="row" style={{ gap: 10 }}>
        <Icon name="ruler" style={{ fontSize: 26, color: 'var(--acc)' }} />
        <div><div style={{ fontWeight: 600 }}>{status === 'today' ? t('It’s Saturday — check-in time') : t('You missed last Saturday')}</div>
          <div className="small muted">{t('Takes a minute. Same time of day and same spot works best.')}</div></div>
      </div>
    </div>}

    <div className="card">
      <div className="row between" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>{existing ? t('Edit check-in') : t('New check-in')}</h2>
        <input type="date" value={date} max={todayISO()} onChange={e => e.target.value && pickDate(e.target.value)}
          style={{ background: 'var(--surface-2)', border: 'none', borderRadius: 10, padding: '7px 10px', fontSize: 15 }} />
      </div>
      <div className="ckgrid">
        {METRICS.map(mt => <div key={mt.k} className="ckf">
          <label>{lab(mt)}{mt.hint ? ' — ' + t(mt.hint) : ''}</label>
          <div className="in">
            <NumField value={v[mt.k] || ''} placeholder={last && last[mt.k] ? fmtNum(last[mt.k]) : '0'} onChange={x => setV(o => ({ ...o, [mt.k]: x }))} />
            <span className="u">{unitOf(mt)}</span>
          </div>
        </div>)}
      </div>
      <div style={{ height: 12 }} />
      <Button variant="primary" icon="check" onClick={save}>{existing ? t('Update check-in') : t('Save check-in')}</Button>
    </div>

    {last && <div className="card">
      <div className="row between" style={{ marginBottom: 2 }}>
        <h2 style={{ margin: 0 }}>{t('Changes')}</h2>
        <div className="small muted">{prev ? t('vs {0}', fmtDate(prev.d)) : t('First check-in logged')}</div>
      </div>
      {METRICS.map(mt => {
        const cur = last[mt.k]
        const dPrev = prev && cur && prev[mt.k] ? cur - prev[mt.k] : null
        const dFirst = first !== last && cur && first[mt.k] ? cur - first[mt.k] : null
        return <div key={mt.k} className="ckrow" onClick={() => setMetric(mt.k)} style={{ cursor: 'pointer' }}>
          <div className="n">{lab(mt)}<small>{mt.hint ? t(mt.hint) + ' · ' : ''}{dFirst != null ? t('since start') + ' ' : ''}{dFirst != null ? (dFirst > 0 ? '+' : '') + fmtNum(round(dFirst)) : ''}</small></div>
          <Delta d={dPrev} good={mt.good} />
          <div className="ckv" style={{ minWidth: 70, textAlign: 'right' }}>{cur ? fmtNum(cur) : '–'}<span className="small dim"> {unitOf(mt)}</span></div>
        </div>
      })}
    </div>}

    {pts.length > 1 && <div className="card">
      <div className="chips" style={{ marginBottom: 8 }}>
        {METRICS.map(mt => <button key={mt.k} className={'chip' + (metric === mt.k ? ' on' : '')} onClick={() => setMetric(mt.k)}>{lab(mt)}</button>)}
      </div>
      <LineChart points={pts} h={140} unit={unitOf(m)} />
    </div>}

    {list.length > 0 && <div className="card">
      <h2>{t('History')}</h2>
      {[...list].reverse().map(c => <div key={c.d} className="ckrow">
        <div className="n" onClick={() => { pickDate(c.d); window.scrollTo(0, 0) }} style={{ cursor: 'pointer' }}>
          {fmtDate(c.d, true)}
          <small>{fmtNum(c.w)} {wUnit}{[['neck', 'N'], ['waist', 'Ab'], ['hips', 'H'], ['chest', 'C'], ['bicep', 'B']].filter(([k]) => c[k]).map(([k, l]) => ' · ' + l + ' ' + fmtNum(c[k])).join('')}</small>
        </div>
        <button className="iconbtn" aria-label="Delete" onClick={() => del(c.d)}><Icon name="trash" /></button>
      </div>)}
    </div>}
  </div>
}
