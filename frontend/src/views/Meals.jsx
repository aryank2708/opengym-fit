import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { todayISO, fmtDate } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { MEALS, mealsOf, dayKcal, shiftISO } from '../lib/tracking.js'
import NumField from '../components/NumField.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

export default function Meals() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const [day, setDay] = useState(todayISO())
  const [goalEdit, setGoalEdit] = useState(false)
  const m = mealsOf(S, day)
  const { eaten, planned, ticked } = dayKcal(S, day)
  const goal = S.calGoal || 0

  const setMeal = (n, patch) => update(s => {
    s.meals = s.meals || {}
    const d = s.meals[day] = s.meals[day] || {}
    d[n] = Object.assign({ c: 0, x: false }, d[n], patch)
  })
  const copyYesterday = () => update(s => {
    const y = (s.meals || {})[shiftISO(day, -1)]
    if (!y) return
    s.meals = s.meals || {}
    const d = s.meals[day] = s.meals[day] || {}
    for (const n of MEALS) if (y[n] && !(d[n] && d[n].c)) d[n] = { c: y[n].c || 0, x: false }
  })

  const bars = []
  for (let i = 6; i >= 0; i--) {
    const iso = shiftISO(day, -i), k = dayKcal(S, iso)
    bars.push({ iso, v: k.eaten, tk: k.ticked })
  }
  const max = Math.max(goal, ...bars.map(b => b.v), 1)
  const isToday = day === todayISO()
  const pct = goal ? Math.min(100, Math.round(eaten / goal * 100)) : 0

  return <div className="narrow">
    <div className="hdr">
      <div><h1>{t('Meals')}</h1><div className="sub">{isToday ? t('Today') + ' · ' : ''}{fmtDate(day, true)}</div></div>
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
    </div>

    <div className="daynav">
      <button className="iconbtn" onClick={() => setDay(shiftISO(day, -1))} aria-label="Previous day"><Icon name="chevronLeft" /></button>
      <button className="btn xs" style={{ visibility: isToday ? 'hidden' : 'visible' }} onClick={() => setDay(todayISO())}>{t('Today')}</button>
      <button className="iconbtn" onClick={() => setDay(shiftISO(day, 1))} aria-label="Next day"><Icon name="chevronRight" /></button>
    </div>

    <div className={'card' + (ticked === 5 ? ' hot' : '')}>
      <div className="row between">
        <div>
          <div className="small muted">{t('Eaten')}</div>
          <div className="mealtot"><span className="v">{eaten.toLocaleString()}</span><span className="muted">kcal</span></div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="small muted">{t('Meals ticked')}</div>
          <div className="mealtot" style={{ justifyContent: 'flex-end' }}><span className="v" style={{ fontSize: 34 }}>{ticked}</span><span className="muted">/ 5</span></div>
        </div>
      </div>
      {goal > 0 && <>
        <div className="pbar"><i className={eaten > goal ? 'over' : ''} style={{ width: pct + '%' }} /></div>
        <div className="small muted" style={{ marginTop: 6 }}>{eaten > goal ? t('{0} kcal over your goal', (eaten - goal).toLocaleString()) : t('{0} kcal left of {1}', (goal - eaten).toLocaleString(), goal.toLocaleString())}</div>
      </>}
      {planned > eaten && <div className="small dim" style={{ marginTop: 4 }}>{t('{0} kcal entered, not yet ticked', (planned - eaten).toLocaleString())}</div>}
    </div>

    <div className="card">
      {MEALS.map(n => {
        const e = m[n] || { c: 0, x: false }
        return <div key={n} className={'meal' + (e.x ? ' done' : '')}>
          <div className="mk">M{n}</div>
          <div className="cal">
            <NumField decimal={false} value={e.c || ''} placeholder="0" aria-label={'M' + n + ' calories'} onChange={v => setMeal(n, { c: v })} />
            <span>kcal</span>
          </div>
          <button className={'tick' + (e.x ? ' on' : '')} aria-pressed={e.x} aria-label={'Tick M' + n} onClick={() => setMeal(n, { x: !e.x })}><Icon name="check" /></button>
        </div>
      })}
      <div style={{ height: 10 }} />
      <Button size="sm" icon="history" onClick={copyYesterday}>{t('Copy calories from yesterday')}</Button>
    </div>

    <div className="card">
      <div className="row between" style={{ marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>{t('Daily goal')}</h2>
        {goalEdit
          ? <NumField decimal={false} value={S.calGoal || ''} placeholder="2000" style={{ width: 110, background: 'var(--surface-2)', border: 'none', borderRadius: 10, padding: '8px 10px', textAlign: 'right', fontSize: 17 }}
              onChange={v => update(s => { s.calGoal = v || null })} onBlur={() => setGoalEdit(false)} autoFocus />
          : <Button size="sm" icon="target" onClick={() => setGoalEdit(true)}>{goal ? goal.toLocaleString() + ' kcal' : t('Set goal')}</Button>}
      </div>
      <div className="small muted">{t('Last 7 days, ticked calories')}</div>
      <div className="wkbars">
        {bars.map(b => <div key={b.iso} className={b.iso === day ? 't' : ''}>
          <b style={{ height: Math.max(3, Math.round(b.v / max * 44)) }} />
          <span>{['S', 'M', 'T', 'W', 'T', 'F', 'S'][new Date(b.iso + 'T12:00:00').getDay()]}</span>
        </div>)}
      </div>
    </div>
  </div>
}
