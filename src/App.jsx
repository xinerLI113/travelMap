import { useEffect, useMemo, useRef, useState } from 'react';
import GlobeStage from './GlobeStage.jsx';
import TripPanel from './TripPanel.jsx';
import { formatHours, formatKm } from './lib/format.js';
import { haversine } from './lib/geo.js';
import { readCurrentTrip, readHome, readTrips, saveCurrentTrip, saveHome, saveTrip } from './lib/history.js';
import { PRESETS, reversePlace } from './lib/places.js';
import { downloadBlob, filmName } from './lib/record.js';
import { buildRoute, cinematicSeconds, defaultMode, normalizeModes } from './lib/timeline.js';

const starter = { ...PRESETS[0], aspect: 'landscape' };

export default function App() {
  const globeRef = useRef(null);
  const [initialTrip] = useState(() => readCurrentTrip() ?? starter);
  const [ready, setReady] = useState(false);
  const [title, setTitle] = useState(initialTrip.title);
  const [stops, setStops] = useState(initialTrip.stops);
  const [modes, setModes] = useState(initialTrip.modes);
  const [aspect, setAspect] = useState(initialTrip.aspect);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [finished, setFinished] = useState(false);
  const [activeStop, setActiveStop] = useState(-1);
  const [hud, setHud] = useState(null);
  const [status, setStatus] = useState('点地球上的任意位置，也能添加城市');
  const [bootError, setBootError] = useState('');
  const [trips, setTrips] = useState(readTrips);
  const [home, setHome] = useState(readHome);

  const playingRef = useRef(false);
  const titleRef = useRef(title);
  const stopsRef = useRef(stops);
  const modesRef = useRef(modes);
  const aspectRef = useRef(aspect);
  const goHomeRef = useRef(null);
  const reverseLock = useRef(false);
  const stopsKey = stops.map((stop) => `${stop.name}:${stop.lat.toFixed(3)}:${stop.lng.toFixed(3)}`).join('|');
  const modesKey = modes.join(',');
  const seenStops = useRef('');

  titleRef.current = title;
  stopsRef.current = stops;
  modesRef.current = modes;
  aspectRef.current = aspect;
  goHomeRef.current = home ? () => addCity(home) : null;

  const route = useMemo(() => buildRoute(stops, modes), [stops, modes]);
  const seconds = useMemo(() => cinematicSeconds(stops, modes), [stops, modes]);
  const routeView = useMemo(() => ({ ...route, total: seconds }), [route, seconds]);

  useEffect(() => {
    try {
      saveCurrentTrip({ title, stops, modes, aspect });
    } catch {
      setStatus('浏览器存储不可用，当前行程未保存');
    }
  }, [title, stops, modes, aspect]);

  useEffect(() => {
    if (!ready || playingRef.current) return;
    const frame = seenStops.current !== stopsKey;
    seenStops.current = stopsKey;
    globeRef.current?.setRoute(stopsRef.current, modesRef.current, { frame });
  }, [ready, stopsKey, modesKey]);

  useEffect(() => {
    const id = requestAnimationFrame(() => globeRef.current?.resize());
    return () => cancelAnimationFrame(id);
  }, [aspect]);

  useEffect(() => {
    const onKey = (event) => {
      const tag = event.target?.tagName;
      if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) return;
      if (event.code === 'KeyH' && !event.shiftKey && !event.repeat && goHomeRef.current && !playingRef.current) {
        event.preventDefault();
        goHomeRef.current();
        return;
      }
      if (event.code !== 'Space') return;
      event.preventDefault();
      if (playingRef.current) stopPlayback();
      else startPlayback(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function haltIfPlaying() {
    if (!playingRef.current) return;
    stopPlayback();
  }

  function startPlayback(record) {
    if (stopsRef.current.length < 2) {
      setStatus('至少添加两座城市');
      return;
    }
    if (playingRef.current) return;
    const trip = {
      title: titleRef.current.trim() || '未命名旅程',
      stops: stopsRef.current,
      modes: modesRef.current,
      aspect: aspectRef.current,
    };
    playingRef.current = true;
    setPlaying(true);
    setRecording(!!record);
    setFinished(false);
    setStatus(record ? '正在录制足迹视频…' : '');
    try {
      globeRef.current.play({ ...trip, record: !!record });
    } catch (error) {
      playingRef.current = false;
      setPlaying(false);
      setRecording(false);
      setStatus(error.message || '暂时不能播放');
      return;
    }
    try {
      setTrips(saveTrip(trip));
    } catch {
      setStatus('浏览器存储不可用，这次旅程未保存');
    }
  }

  async function stopPlayback() {
    if (!playingRef.current) return;
    playingRef.current = false;
    setPlaying(false);
    setRecording(false);
    setFinished(true);
    const blob = await globeRef.current?.stop();
    if (blob) {
      downloadBlob(blob, filmName(titleRef.current));
      setStatus('足迹视频已下载');
    } else {
      setStatus('已停止');
    }
  }

  function handleStatus(event) {
    if (event.type === 'tick') {
      setHud(event.hud);
      setActiveStop(event.activeStop);
      return;
    }
    if (event.type === 'record-failed') {
      setRecording(false);
      setStatus(event.message);
      return;
    }
    if (event.type === 'done') {
      if (!playingRef.current) return;
      playingRef.current = false;
      setPlaying(false);
      setRecording(false);
      setFinished(true);
      if (event.hud) setHud(event.hud);
      if (event.blob) {
        downloadBlob(event.blob, filmName(titleRef.current));
        setStatus('足迹视频已下载');
      } else {
        setStatus('播放结束。满意的话可以导出视频');
      }
      return;
    }
    if (event.type === 'error') {
      playingRef.current = false;
      setPlaying(false);
      setRecording(false);
      setBootError(event.message);
      setStatus(event.message);
    }
  }

  function addCity(city) {
    haltIfPlaying();
    const current = stopsRef.current;
    const last = current[current.length - 1];
    if (last && haversine(last, city) < 8) {
      setStatus('终点已经是这座城市');
      return;
    }
    const nextStops = [...current, city];
    const nextModes = last
      ? [...modesRef.current, defaultMode(haversine(last, city))]
      : modesRef.current;
    setStops(nextStops);
    setModes(normalizeModes(nextStops, nextModes));
    setFinished(false);
    setStatus(`已添加 ${city.name}`);
    if ((titleRef.current === '未命名旅程' || !titleRef.current.trim()) && nextStops.length === 2) {
      setTitle(`${nextStops[0].name} → ${nextStops[1].name}`);
    }
  }

  function chooseHome(city) {
    try {
      saveHome(city);
      setHome(city);
      setStatus(`已将 ${city.name} 设为家`);
    } catch {
      setStatus('浏览器存储不可用，家的位置未保存');
    }
  }

  async function onPick(lat, lng) {
    if (playingRef.current || reverseLock.current) return;
    reverseLock.current = true;
    setStatus('正在识别城市…');
    try {
      const place = await reversePlace(lat, lng);
      if (!place) {
        setStatus('这里没有可识别的城市');
        return;
      }
      addCity(place);
    } catch {
      setStatus('城市识别失败，可以改用搜索');
    } finally {
      reverseLock.current = false;
    }
  }

  function removeStop(index) {
    haltIfPlaying();
    const nextStops = stops.filter((_, stopIndex) => stopIndex !== index);
    let nextModes = modes.slice();
    if (index === 0) nextModes = nextModes.slice(1);
    else if (index >= stops.length - 1) nextModes = nextModes.slice(0, -1);
    else nextModes.splice(index, 1);
    setStops(nextStops);
    setModes(normalizeModes(nextStops, nextModes));
    setFinished(false);
  }

  function moveStop(index, direction) {
    haltIfPlaying();
    const target = index + direction;
    if (target < 0 || target >= stops.length) return;
    const nextStops = stops.slice();
    const [item] = nextStops.splice(index, 1);
    nextStops.splice(target, 0, item);
    setStops(nextStops);
    setModes(normalizeModes(nextStops, modes));
    setFinished(false);
  }

  function changeMode(index, mode) {
    haltIfPlaying();
    const next = modes.slice();
    next[index] = mode;
    setModes(normalizeModes(stops, next));
    setFinished(false);
  }

  function applyPreset(preset) {
    haltIfPlaying();
    setTitle(preset.title);
    setStops(preset.stops.map((stop) => ({ ...stop })));
    setModes([...preset.modes]);
    setFinished(false);
    setStatus('');
  }

  function openTrip(trip) {
    applyPreset(trip);
    setAspect(trip.aspect);
    setStatus(`已打开 ${trip.title}`);
  }

  function clearAll() {
    haltIfPlaying();
    setStops([]);
    setModes([]);
    setTitle('未命名旅程');
    setFinished(false);
    setHud(null);
    setStatus('旅程已清空');
  }

  const idleHud = {
    caption: title || '未命名旅程',
    meta:
      stops.length < 2
        ? '搜索或点选两座城市'
        : `${stops.length} 座城市 · ${formatKm(route.km)} · 约 ${formatHours(route.hours)}`,
    color: '#e6b15c',
    progress: finished ? 1 : 0,
    recording: false,
  };
  const shown = playing && hud ? { ...hud, recording } : idleHud;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="11" />
              <path d="M7 19c4-8 8-8 10-3s6 4 9-2" />
              <circle cx="22.5" cy="12.2" r="1.4" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <div>
            <strong>旅迹</strong>
            <em>TRAIL</em>
          </div>
        </div>
        <p>created by Claire</p>
      </header>
      <main>
        <section className={`stage-wrap ${aspect}`}>
          <div className={`stage-frame ${aspect}`}>
            <GlobeStage
              ref={globeRef}
              onReady={() => setReady(true)}
              onPick={onPick}
              onStatus={handleStatus}
            />
            <div className="vignette" />
            <FilmHud hud={shown} showProgress={playing || finished} />
            {!ready && !bootError && <div className="loading-veil">正在展开地球…</div>}
            {bootError && <div className="loading-veil">{bootError}</div>}
          </div>
        </section>
        <TripPanel
          title={title}
          onTitle={setTitle}
          stops={stops}
          modes={modes}
          route={routeView}
          activeStop={activeStop}
          playing={playing}
          recording={recording}
          aspect={aspect}
          onAspect={setAspect}
          status={status}
          onAdd={addCity}
          home={home}
          onGoHome={goHomeRef.current}
          onSetHome={chooseHome}
          onRemove={removeStop}
          onMove={moveStop}
          onMode={changeMode}
          onPreset={applyPreset}
          onClear={clearAll}
          presets={PRESETS}
          trips={trips}
          onOpenTrip={openTrip}
          onPlay={() => startPlayback(false)}
          onExport={() => startPlayback(true)}
          onStop={stopPlayback}
        />
      </main>
    </div>
  );
}

function FilmHud({ hud, showProgress }) {
  return (
    <div className="film-hud">
      <div className="film-kicker">
        <span>旅迹</span>
        {hud.recording && <em className="rec">REC</em>}
      </div>
      <div className="film-caption">
        <strong>{hud.caption}</strong>
        <small>{hud.meta}</small>
        {showProgress && (
          <i>
            <b style={{ transform: `scaleX(${hud.progress || 0})` }} />
          </i>
        )}
      </div>
    </div>
  );
}
