import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip as LTooltip, useMap } from 'react-leaflet'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import {
  Activity, MapPin, Wind, Users, BrainCircuit, Plus, RefreshCw,
  ShieldCheck, AlertTriangle, Scale, Globe2, HeartHandshake, BookOpen, Layers, Crosshair
} from 'lucide-react'
import { getJSON, postJSON } from './api'

const CENTER = { latitude: 31.5204, longitude: 74.3587 }
const PRESETS = [
  { name: 'Lahore', latitude: 31.5204, longitude: 74.3587 },
  { name: 'Karachi', latitude: 24.8607, longitude: 67.0011 },
  { name: 'Delhi', latitude: 28.6139, longitude: 77.209 },
  { name: 'Mumbai', latitude: 19.076, longitude: 72.8777 },
  { name: 'Dhaka', latitude: 23.8103, longitude: 90.4125 },
  { name: 'London', latitude: 51.5072, longitude: -0.1276 },
  { name: 'New York', latitude: 40.7128, longitude: -74.006 },
  { name: 'Nairobi', latitude: -1.2921, longitude: 36.8219 },
]

const AQI_BANDS = [
  { max: 50, color: '#16a34a', label: 'Good', short: 'Good' },
  { max: 100, color: '#ca8a04', label: 'Moderate', short: 'Moderate' },
  { max: 150, color: '#ea580c', label: 'Unhealthy for sensitive groups', short: 'Sensitive' },
  { max: 200, color: '#dc2626', label: 'Unhealthy', short: 'Unhealthy' },
  { max: 300, color: '#9333ea', label: 'Very unhealthy', short: 'Very unhealthy' },
  { max: Infinity, color: '#881337', label: 'Hazardous', short: 'Hazardous' },
]
const METRICS = [
  { key: 'aqi', label: 'AQI', unit: 'US AQI' },
  { key: 'pm2_5', label: 'PM2.5', unit: 'PM2.5 in µg/m³' },
  { key: 'pm10', label: 'PM10', unit: 'PM10 in µg/m³' },
]
const color = (v) => AQI_BANDS.find((b) => v <= b.max).color
const tintBg = (v) => (v == null ? '#f1f5f9' : `${color(v)}1a`)
const fmt = (n) => (n != null ? Number(n).toFixed(1) : '—')
const label = (v) =>
  v <= 50 ? 'Good' : v <= 100 ? 'Moderate' : v <= 150 ? 'Unhealthy for sensitive groups' : v <= 200 ? 'Unhealthy' : v <= 300 ? 'Very unhealthy' : 'Hazardous'

function ResizeMap() {
  const map = useMap()
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 120)
  }, [map])
  return null
}

function PanToSelected({ point }) {
  const map = useMap()
  useEffect(() => {
    if (point?.latitude != null && point?.longitude != null)
      map.flyTo([point.latitude, point.longitude], Math.max(map.getZoom(), 11), { duration: 0.6 })
  }, [map, point?.latitude, point?.longitude])
  return null
}

function FitToPoints({ points, fitKey }) {
  const map = useMap()
  const sig = points.map((p) => `${p.latitude},${p.longitude}`).join('|')
  useEffect(() => {
    if (points.length > 1)
      map.fitBounds(
        points.map((p) => [p.latitude, p.longitude]),
        { padding: [48, 48], maxZoom: 12 }
      )
  }, [map, sig, fitKey])
  return null
}

function Metric({ icon: Icon, title, value, detail, tint }) {
  return (
    <article className="metric">
      <div className="metric-top">
        {title}
        <Icon size={16} />
      </div>
      <strong style={tint ? { color: tint } : {}}>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

export default function App() {
  const [places, setPlaces] = useState([])
  const [selected, setSelected] = useState({ id: 'centre', name: 'Lahore', ...CENTER })
  const [hotspots, setHotspots] = useState(null)
  const [area, setArea] = useState({ name: 'Lahore', ...CENTER })
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState([])
  const [community, setCommunity] = useState(null)
  const [locationMessage, setLocationMessage] = useState('')
  const [air, setAir] = useState(null)
  const [insight, setInsight] = useState(null)
  const [reports, setReports] = useState([])
  const [rights, setRights] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState(false)
  const [showPoints, setShowPoints] = useState(true)
  const [showReports, setShowReports] = useState(true)
  const [fitKey, setFitKey] = useState(0)
  const [metric, setMetric] = useState('aqi')
  const [benchmark, setBenchmark] = useState({})
  const [benchBusy, setBenchBusy] = useState(false)
  const [form, setForm] = useState({
    category: 'smoke',
    description: '',
    location_name: '',
    latitude: CENTER.latitude,
    longitude: CENTER.longitude,
  })

  async function refreshReports() {
    try {
      setReports(await getJSON('/api/reports'))
      setCommunity(await getJSON('/api/community-insights'))
    } catch (e) {
      setError(e.message)
    }
  }

  async function refreshHotspots(a = area) {
    try {
      const h = await getJSON(
        `/api/hotspots?latitude=${a.latitude}&longitude=${a.longitude}&name=${encodeURIComponent(a.name)}`
      )
      setHotspots(h)
      setPlaces(h.locations)
    } catch (e) {
      setError(e.message)
    }
  }

  function chooseArea(a) {
    const next = { name: a.name, latitude: a.latitude, longitude: a.longitude }
    setArea(next)
    setSelected({ id: 'centre', ...next })
    setForm((f) => ({ ...f, latitude: next.latitude, longitude: next.longitude, location_name: next.name }))
    setMatches([])
    setQuery('')
    refreshHotspots(next)
  }

  async function search(e) {
    e.preventDefault()
    if (query.trim().length < 2) return
    try {
      const r = await getJSON(`/api/geocode?q=${encodeURIComponent(query.trim())}`)
      setMatches(r)
      setLocationMessage(r.length ? 'Choose a match below.' : 'No place found. Try another spelling.')
    } catch (err) {
      setError(err.message)
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationMessage('Location is not supported. Search for your city instead.')
      return
    }
    setLocationMessage('Requesting location permission…')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = {
          id: 'your-location',
          name: 'Your current area',
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }
        const a = { name: 'Your current area', latitude: point.latitude, longitude: point.longitude }
        setArea(a)
        setSelected(point)
        setPlaces([])
        refreshHotspots(a)
        setForm((f) => ({
          ...f,
          latitude: point.latitude,
          longitude: point.longitude,
          location_name: 'Your current area',
        }))
        setLocationMessage('Showing model estimates for the location you shared.')
      },
      (err) =>
        setLocationMessage(
          err.code === 1
            ? 'Location permission was denied. Search for your city instead.'
            : 'Could not determine location. Check device settings or search for your city.'
        ),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    )
  }

  async function refreshAir(place = selected) {
    setBusy(true)
    setError('')
    try {
      const q = `latitude=${place.latitude}&longitude=${place.longitude}&past_days=2`
      const [a, i] = await Promise.all([
        getJSON(`/api/air-quality?${q}`),
        getJSON(`/api/insights?latitude=${place.latitude}&longitude=${place.longitude}`),
      ])
      setAir(a)
      setInsight(i)
    } catch (e) {
      setError(e.message)
      setAir(null)
      setInsight(null)
    } finally {
      setBusy(false)
    }
  }

  async function loadBenchmark() {
    setBenchBusy(true)
    const entries = await Promise.all(
      PRESETS.map(async (c) => {
        try {
          const d = await getJSON(`/api/air-quality?latitude=${c.latitude}&longitude=${c.longitude}&past_days=0`)
          return [c.name, d.current?.us_aqi ?? null]
        } catch {
          return [c.name, null]
        }
      })
    )
    setBenchmark(Object.fromEntries(entries))
    setBenchBusy(false)
  }

  useEffect(() => {
    refreshReports()
    refreshHotspots()
    loadBenchmark()
    getJSON('/api/rights')
      .then(setRights)
      .catch(() => {})
  }, [])

  useEffect(() => {
    refreshAir(selected)
  }, [selected.latitude, selected.longitude])

  const current = air?.current || {}
  const aqi = current.us_aqi
  const chart = useMemo(() => {
    const h = air?.hourly
    if (!h?.time) return []
    return h.time
      .map((t, i) => ({
        time: new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric' }),
        aqi: h.us_aqi?.[i],
      }))
      .filter((x) => x.aqi != null)
  }, [air])

  const mapPoints = places

  const compare = useMemo(() => {
    const locs = hotspots?.locations || []
    const aqis = locs.map((p) => p.aqi).filter((v) => v != null)
    const vals = locs.map((p) => p[metric]).filter((v) => v != null)
    const avg = aqis.length ? Math.round(aqis.reduce((a, b) => a + b, 0) / aqis.length) : null
    const rows = [...locs].sort((a, b) => (b[metric] ?? -1) - (a[metric] ?? -1))
    return {
      rows,
      avg,
      spread: aqis.length > 1 ? Math.max(...aqis) - Math.min(...aqis) : null,
      metricAvg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
      metricMax: Math.max(1, ...vals),
    }
  }, [hotspots, metric])

  const benchmarkRows = useMemo(() => {
    const rows = PRESETS.map((c) => ({ name: c.name, aqi: benchmark[c.name] ?? null }))
    const inPresets = rows.find((r) => r.name === area.name)
    if (inPresets) inPresets.current = true
    else rows.push({ name: area.name, aqi: compare.avg, current: true })
    return rows.sort((a, b) => (b.aqi ?? -1) - (a.aqi ?? -1))
  }, [benchmark, area.name, compare.avg])

  async function submit(e) {
    e.preventDefault()
    try {
      await postJSON('/api/reports', form)
      setModal(false)
      setForm((f) => ({ ...f, description: '' }))
      await refreshReports()
      alert('Report submitted and is pending human verification.')
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="shell">
      <header>
        <a className="brand" href="#top">
          <span className="brand-mark">
            <Wind size={18} />
          </span>
          <span className="brand-text">
            AirWatch <span>AI</span>
            <small className="brand-sub">CLEAN AIR · RIGHTS · JUSTICE</small>
          </span>
        </a>
        <nav>
          <a href="#map">Explore</a>
          <a href="#hotspots">Hotspots</a>
          <a href="#rights">Rights & Law</a>
          <a href="#trends">Analytics</a>
          <a href="#reports">Reports</a>
        </nav>
        <button className="btn btn-primary" onClick={() => setModal(true)}>
          <Plus size={15} /> Report pollution
        </button>
      </header>

      <main id="top">
        {/* HERO */}
        <section className="hero">
          <div>
            <div className="eyebrow">Live air intelligence · Rights-based</div>
            <h1>
              Clean air is not a privilege.
              <br />
              <em>It is a human right.</em>
            </h1>
            <p className="hero-lead">
              AirWatch AI connects modeled air-quality data with community observations and the
              international legal frameworks that protect the right to a clean, healthy and sustainable
              environment — so local knowledge can support accountability and climate justice.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="#map">
                Explore your area →
              </a>
              <a className="btn btn-ghost" href="#rights">
                <Scale size={15} /> Rights & climate justice
              </a>
            </div>
          </div>
          <div className="hero-card">
            <div className="hero-card-label">LOCAL AIR SNAPSHOT</div>
            <div className="hero-aqi" style={{ color: color(aqi ?? 0) }}>
              {aqi ?? '—'}
            </div>
            <div className="hero-status" style={{ color: color(aqi ?? 0) }}>
              {aqi != null ? label(aqi) : busy ? 'Loading…' : 'No reading'}
            </div>
            <div className="hero-loc">
              {selected.name} · US AQI · Model estimate
            </div>
          </div>
        </section>

        {error && (
          <div className="error-banner">
            <AlertTriangle size={16} />
            {error}
            <button onClick={() => refreshAir()}>Retry</button>
          </div>
        )}

        {/* METRICS */}
        <section className="metrics">
          <Metric
            icon={Activity}
            title="US AIR QUALITY INDEX"
            value={aqi ?? '—'}
            detail={aqi != null ? label(aqi) : 'Waiting for data'}
            tint={color(aqi ?? 0)}
          />
          <Metric
            icon={Wind}
            title="PM2.5"
            value={current.pm2_5 != null ? current.pm2_5.toFixed(1) : '—'}
            detail="µg/m³ · fine particles"
          />
          <Metric
            icon={Activity}
            title="PM10"
            value={current.pm10 != null ? current.pm10.toFixed(1) : '—'}
            detail="µg/m³ · coarse particles"
          />
          <Metric
            icon={Users}
            title="COMMUNITY REPORTS"
            value={reports.length}
            detail={`${reports.filter((r) => r.status === 'pending').length} awaiting review`}
          />
        </section>

        {/* MAP */}
        <section className="section" id="map">
          <div className="section-head">
            <div>
              <div className="eyebrow">01 · Explore</div>
              <h2>Air quality across your area</h2>
              <p>
                Search any city, use a global preset, or share your location. Data are model-based grid
                estimates (Open-Meteo / CAMS), not street-level sensors.
              </p>
              <form className="geo-bar" onSubmit={search}>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search any city or town worldwide…"
                  aria-label="Search city"
                />
                <button className="btn btn-ghost" type="submit">
                  Search
                </button>
              </form>
              {matches.length > 0 && (
                <div className="chips">
                  {matches.map((m) => (
                    <button type="button" className="chip" key={m.id} onClick={() => chooseArea(m)}>
                      {m.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="chips">
                {PRESETS.map((p) => (
                  <button type="button" className="chip" key={p.name} onClick={() => chooseArea(p)}>
                    {p.name}
                  </button>
                ))}
              </div>
              {locationMessage && <div className="loc-msg">{locationMessage}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" onClick={useMyLocation}>
                <MapPin size={15} /> Use my location
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  refreshAir()
                  refreshReports()
                  refreshHotspots()
                }}
              >
                <RefreshCw size={15} /> Refresh
              </button>
            </div>
          </div>

          <div className="map-layout">
            <div className="map-card">
              <MapContainer center={[area.latitude, area.longitude]} zoom={11} scrollWheelZoom>
                <ResizeMap />
                <PanToSelected point={selected} />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {places.map((p) => (
                  <CircleMarker
                    key={p.id}
                    center={[p.latitude, p.longitude]}
                    radius={selected.id === p.id ? 12 : 8}
                    pathOptions={{
                      color: '#fff',
                      weight: 2,
                      fillColor: selected.id === p.id ? color(aqi ?? 0) : '#3ee0b8',
                      fillOpacity: 0.9,
                    }}
                    eventHandlers={{ click: () => setSelected(p) }}
                  >
                    <Popup>
                      <b>{p.name}</b>
                      <br />
                      Select this area
                    </Popup>
                  </CircleMarker>
                ))}
                {selected.id === 'your-location' && (
                  <CircleMarker
                    center={[selected.latitude, selected.longitude]}
                    radius={12}
                    pathOptions={{ color: '#fff', weight: 3, fillColor: '#3b82f6', fillOpacity: 1 }}
                  >
                    <Popup>Your shared location · modeled estimate</Popup>
                  </CircleMarker>
                )}
                {reports.map((r) => (
                  <CircleMarker
                    key={`r${r.id}`}
                    center={[r.latitude, r.longitude]}
                    radius={7}
                    pathOptions={{
                      color: '#fff',
                      weight: 1,
                      fillColor: r.status === 'verified' ? '#f97316' : '#94a3b8',
                    }}
                  >
                    <Popup>
                      <b>{r.category} report</b>
                      <br />
                      {r.description}
                      <br />
                      Status: {r.status}
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
              <div className="legend">
                <span>🟢 Model query point</span>
                <span>🟠 Verified report</span>
                <span>⚪ Pending report</span>
              </div>
            </div>
            <aside className="side-panel">
              <h3>Monitoring points</h3>
              <p>Select a point to load its data.</p>
              <div>
                {places.map((p) => (
                  <button
                    key={p.id}
                    className={selected.id === p.id ? 'place active' : 'place'}
                    onClick={() => setSelected(p)}
                  >
                    <MapPin size={14} />
                    <span>
                      {p.name}
                      <small>
                        {p.latitude.toFixed(3)}, {p.longitude.toFixed(3)}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
              <div className="selected-box">
                <div className="label">SELECTED AREA</div>
                <h3>{selected.name}</h3>
                <div className="aqi-val" style={{ color: color(aqi ?? 0) }}>
                  {aqi ?? '—'}
                </div>
                <div className="aqi-label" style={{ color: color(aqi ?? 0) }}>
                  {aqi != null ? label(aqi) : busy ? 'Loading…' : 'No reading'}
                </div>
                <p>{air?.note || 'Readings are supplied by the air-quality model.'}</p>
              </div>
            </aside>
          </div>
          <p className="attribution">
            Map © OpenStreetMap. Air-quality data: Open-Meteo / CAMS. Model grid estimates are not
            street-level sensor measurements.
          </p>
        </section>

        {/* COMPARISON */}
        <section className="section" id="hotspots">
          <div className="section-head">
            <div>
              <div className="eyebrow">02 · Compare</div>
              <h2>Pollution hotspot watch</h2>
              <p>
                Rank modeled readings across points around {area.name}, then benchmark against major
                cities worldwide.
              </p>
            </div>
            <button className="btn btn-ghost" onClick={() => refreshHotspots()}>
              <RefreshCw size={15} /> Update comparison
            </button>
          </div>

          <div className="compare-summary">
            <div className="summary-tile">
              <span>Area average</span>
              <strong style={{ color: compare.avg != null ? color(compare.avg) : undefined }}>
                {compare.avg ?? '—'}
              </strong>
              <small>{compare.avg != null ? label(compare.avg) : 'US AQI'}</small>
            </div>
            <div className="summary-tile">
              <span>Highest</span>
              <strong style={{ color: hotspots?.highest ? color(hotspots.highest.aqi) : undefined }}>
                {hotspots?.highest?.aqi ?? '—'}
              </strong>
              <small>{hotspots?.highest?.name || '—'}</small>
            </div>
            <div className="summary-tile">
              <span>Lowest</span>
              <strong style={{ color: hotspots?.lowest ? color(hotspots.lowest.aqi) : undefined }}>
                {hotspots?.lowest?.aqi ?? '—'}
              </strong>
              <small>{hotspots?.lowest?.name || '—'}</small>
            </div>
            <div className="summary-tile">
              <span>Spread</span>
              <strong>{compare.spread ?? '—'}</strong>
              <small>AQI points between best and worst</small>
            </div>
          </div>

          <div className="compare-grid">
            <div className="card compare-card">
              <div className="card-head">
                <div>
                  <h3>Local ranking</h3>
                  <p>Worst to best · click a row to inspect it</p>
                </div>
                <div className="segmented" role="tablist" aria-label="Comparison metric">
                  {METRICS.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      role="tab"
                      aria-selected={metric === m.key}
                      className={metric === m.key ? 'on' : ''}
                      onClick={() => setMetric(m.key)}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rank-list">
                {compare.rows.map((p, i) => {
                  const v = p[metric]
                  const diff = v != null && compare.metricAvg != null ? v - compare.metricAvg : null
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`rank-row ${selected.id === p.id ? 'chosen' : ''}`}
                      onClick={() => setSelected(p)}
                    >
                      <span className="rank-n">{i + 1}</span>
                      <span className="rank-name">
                        {p.name}
                        <small>{p.aqi != null ? label(p.aqi) : 'No reading'}</small>
                      </span>
                      <span className="rank-bar">
                        <i
                          style={{
                            width: v != null ? `${Math.max(4, (v / compare.metricMax) * 100)}%` : 0,
                            background: p.aqi != null ? color(p.aqi) : '#cbd5e1',
                          }}
                        />
                      </span>
                      <span className="rank-val">
                        {v != null ? (metric === 'aqi' ? v : Number(v).toFixed(1)) : '—'}
                        {diff != null && (
                          <small className={diff > 0 ? 'up' : diff < 0 ? 'down' : ''}>
                            {diff > 0 ? '+' : ''}
                            {metric === 'aqi' ? Math.round(diff) : diff.toFixed(1)} vs avg
                          </small>
                        )}
                      </span>
                    </button>
                  )
                })}
                {!compare.rows.length && <p className="muted-note">Loading comparison…</p>}
              </div>
              <p className="card-foot">
                {METRICS.find((m) => m.key === metric)?.unit} · {hotspots?.note || ''}
              </p>
            </div>

            <div className="card compare-card">
              <div className="card-head">
                <div>
                  <h3>Global city benchmark</h3>
                  <p>How {area.name} compares with major cities right now</p>
                </div>
                <button type="button" className="toggle" onClick={loadBenchmark} disabled={benchBusy}>
                  <RefreshCw size={13} className={benchBusy ? 'spin' : ''} /> Refresh
                </button>
              </div>
              <div className="bench-list">
                {benchmarkRows.map((c) => (
                  <div className={`bench-row ${c.current ? 'current' : ''}`} key={c.name}>
                    <span className="bench-name">
                      {c.name}
                      {c.current && <em>you</em>}
                    </span>
                    <span className="bench-track">
                      {[50, 100, 150, 200].map((t) => (
                        <i key={t} style={{ left: `${t / 3}%` }} />
                      ))}
                      <b
                        style={{
                          width: c.aqi != null ? `${Math.min(100, Math.max(3, c.aqi / 3))}%` : 0,
                          background: c.aqi != null ? color(c.aqi) : '#cbd5e1',
                        }}
                      />
                    </span>
                    <span className="bench-val" style={{ color: c.aqi != null ? color(c.aqi) : undefined }}>
                      {c.aqi ?? (benchBusy ? '…' : '—')}
                    </span>
                  </div>
                ))}
              </div>
              <div className="bench-axis">
                {[0, 50, 100, 150, 200, 300].map((t) => (
                  <span key={t} style={{ left: `${t / 3}%` }}>
                    {t === 300 ? '300+' : t}
                  </span>
                ))}
              </div>
              <p className="card-foot">Current-hour US AQI model estimates. Scale capped at 300.</p>
            </div>
          </div>
        </section>

        {/* RIGHTS & CLIMATE JUSTICE */}
        <section className="section" id="rights">
          <div className="section-head">
            <div>
              <div className="eyebrow">03 · Law & Justice</div>
              <h2>International environmental law & climate justice</h2>
              <p>
                Clean air sits at the intersection of human rights, climate action, and equity. These
                instruments and principles frame why community monitoring matters.
              </p>
            </div>
          </div>

          <div className="rights-grid">
            {(rights?.core_instruments || []).map((inst) => (
              <article className="rights-card" key={inst.name}>
                <div className="tag">{inst.name}</div>
                <h3>{inst.title}</h3>
                <p>{inst.summary}</p>
                <div className="relevance">
                  <strong>Why it matters here: </strong>
                  {inst.relevance}
                </div>
              </article>
            ))}
          </div>

          <div style={{ marginTop: 28 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              <HeartHandshake size={14} style={{ display: 'inline', marginRight: 6 }} />
              Four pillars of climate justice
            </div>
            <div className="pillars">
              {(rights?.climate_justice_pillars || []).map((p) => (
                <div className="pillar" key={p.title}>
                  <h4>{p.title}</h4>
                  <p>{p.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="facts-strip">
            {(rights?.key_facts || []).map((f, i) => (
              <div className="fact" key={i}>
                <Globe2 size={14} style={{ color: 'var(--accent)', marginBottom: 8 }} />
                {f}
              </div>
            ))}
          </div>
        </section>

        {/* COMMUNITY PATTERNS */}
        <section className="section" id="community-patterns">
          <div className="section-head">
            <div>
              <div className="eyebrow">04 · Community signals</div>
              <h2>What residents are reporting</h2>
              <p>
                Summarises observations (excluding rejected submissions). Community data complements
                models and supports procedural justice — the right to be heard.
              </p>
            </div>
          </div>
          <div className="pattern-grid">
            <div className="stat-stack">
              <div className="stat-box">
                <strong>{community?.total_reports ?? 0}</strong>
                <small>Reports analysed</small>
              </div>
              <div className="stat-box">
                <strong>{community?.pending_reports ?? 0}</strong>
                <small>Pending review</small>
              </div>
              <div className="stat-box">
                <strong>{community?.verified_reports ?? 0}</strong>
                <small>Verified reports</small>
              </div>
            </div>
            <div className="pattern-card">
              <h3>Frequently reported pollution types</h3>
              <div>
                {Object.entries(community?.category_counts || {})
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, count]) => (
                    <div className="cat-row" key={name}>
                      <span>{name}</span>
                      <div className="cat-bar">
                        <i
                          style={{
                            width: `${Math.max(
                              5,
                              (count / Math.max(1, ...Object.values(community?.category_counts || {}))) *
                                100
                            )}%`,
                          }}
                        />
                      </div>
                      <b>{count}</b>
                    </div>
                  ))}
                {!Object.keys(community?.category_counts || {}).length && (
                  <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                    No community reports yet. Be the first to contribute an observation.
                  </p>
                )}
              </div>
              <div className="action-tip">
                <b>Suggested action: </b>
                {community?.suggested_action ||
                  'As reports arrive, AirWatch identifies common observation types and links them to practical next steps under environmental accountability principles.'}
              </div>
            </div>
          </div>
          <p className="attribution">{community?.note}</p>
        </section>

        {/* TRENDS */}
        <section className="section" id="trends">
          <div className="section-head">
            <div>
              <div className="eyebrow">05 · Understand</div>
              <h2>Air quality over time</h2>
              <p>Recent and forecast hourly model values for {selected.name}.</p>
            </div>
          </div>
          <div className="analytics">
            <div className="chart-card">
              <h3>US AQI trend</h3>
              <p>Historical context + short-range model series</p>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart}>
                    <defs>
                      <linearGradient id="aqiFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0f766e" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#0f766e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} minTickGap={35} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip
                      contentStyle={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 10,
                        color: '#0f172a',
                        boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="aqi"
                      stroke="#0f766e"
                      fill="url(#aqiFill)"
                      strokeWidth={2}
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="insight-card">
              <BrainCircuit size={26} />
              <div className="eyebrow">AirWatch intelligence</div>
              <h3>What the data suggests</h3>
              <p>{insight?.summary || 'Loading the available air-quality series…'}</p>
              <div className="insight-flag">
                {insight
                  ? insight.anomaly
                    ? '⚠ Unusual increase detected'
                    : '✓ No unusual increase detected'
                  : 'Analysing'}
              </div>
              <div className="insight-meta">
                {insight?.prediction != null
                  ? `Baseline estimate: ${insight.prediction} AQI · ${insight.confidence}`
                  : 'Prediction unavailable'}
              </div>
              <div className="disclaimer">
                Experimental statistical insight, not an official alert or validated ML forecast.
                Always cross-check with local public-health guidance.
              </div>
            </div>
          </div>
        </section>

        {/* REPORTS */}
        <section className="section" id="reports">
          <div className="section-head">
            <div>
              <div className="eyebrow">06 · Community voice</div>
              <h2>Recent observations</h2>
              <p>
                Reports remain pending until human review. They are observations, not measurements —
                and they give affected people a channel consistent with the right to environmental
                information and participation.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setModal(true)}>
              <Plus size={15} /> Add report
            </button>
          </div>
          <div className="reports-grid">
            {reports.length === 0 && (
              <div className="empty">
                <BookOpen size={28} style={{ marginBottom: 10, opacity: 0.5 }} />
                <h3>No reports yet</h3>
                <p>Share what you see. Your observation can strengthen the local air-quality picture.</p>
              </div>
            )}
            {reports.slice(0, 9).map((r) => (
              <article className="report" key={r.id}>
                <div className="report-head">
                  <b>{r.category}</b>
                  <span className={`status ${r.status}`}>{r.status}</span>
                </div>
                <p>{r.description}</p>
                <small>
                  <MapPin size={12} />{' '}
                  {r.location_name || `${r.latitude.toFixed(3)}, ${r.longitude.toFixed(3)}`} ·{' '}
                  {new Date(r.created_at).toLocaleDateString()}
                </small>
              </article>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="cta">
          <div>
            <div className="eyebrow">Accountability starts locally</div>
            <h2>Your observation is part of the evidence base.</h2>
            <p>
              Community data, transparent models, and rights-based framing together support fairer
              environmental decisions.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setModal(true)}>
            <Plus size={16} /> Report pollution
          </button>
        </section>
      </main>

      <footer>
        <strong>
          AirWatch <span>AI</span>
        </strong>
        <span>Community air intelligence · Environmental rights · Climate justice</span>
        <span>Open-Meteo / CAMS · OpenStreetMap · UNGA 76/300 · Paris Agreement</span>
      </footer>

      {modal && (
        <div className="backdrop" onClick={() => setModal(false)}>
          <form className="modal" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
            <button type="button" className="close" onClick={() => setModal(false)}>
              ×
            </button>
            <div className="eyebrow">Community report</div>
            <h2>What are you noticing?</h2>
            <p>Reports remain pending until reviewed by a human moderator.</p>
            <label>
              Observation type
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="smoke">Smoke</option>
                <option value="dust">Dust</option>
                <option value="burning">Open burning</option>
                <option value="industrial">Industrial emissions</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Location name
              <input
                value={form.location_name}
                onChange={(e) => setForm({ ...form, location_name: e.target.value })}
                placeholder="Neighbourhood or nearby landmark"
              />
            </label>
            <div className="form-row">
              <label>
                Latitude
                <input
                  type="number"
                  step="any"
                  required
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })}
                />
              </label>
              <label>
                Longitude
                <input
                  type="number"
                  step="any"
                  required
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })}
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                minLength={10}
                maxLength={1200}
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe what you observed, when, and for how long…"
              />
            </label>
            <button className="btn btn-primary btn-block" type="submit">
              Submit for human review →
            </button>
            <small className="form-note">
              <ShieldCheck size={13} /> Do not include private or identifying information.
            </small>
          </form>
        </div>
      )}
    </div>
  )
}
