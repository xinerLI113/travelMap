import { useEffect, useRef, useState } from 'react';
import { CarIcon, PlaneIcon, RailIcon } from './icons.jsx';
import { formatHours, formatKm, placeSubtitle } from './lib/format.js';
import { POPULAR, searchPlaces } from './lib/places.js';
import { MODES } from './lib/timeline.js';

const MODE_ORDER = ['plane', 'rail', 'car'];
const ICONS = { plane: PlaneIcon, rail: RailIcon, car: CarIcon };

export default function TripPanel({
  title,
  onTitle,
  stops,
  modes,
  route,
  activeStop,
  playing,
  recording,
  aspect,
  onAspect,
  status,
  onAdd,
  home,
  onGoHome,
  onSetHome,
  onRemove,
  onMove,
  onMode,
  onPreset,
  onClear,
  presets,
  trips,
  onOpenTrip,
  onDownloadTrip,
  onImportTrip,
  onPlay,
  onExport,
  onStop,
}) {
  const homeShortcut = home && (
    <button
      type="button"
      className="text-btn home-shortcut"
      aria-keyshortcuts="H"
      onClick={onGoHome}
      disabled={playing}
    >
      回家 · {home.name} <kbd>H</kbd>
    </button>
  );
  const tripFile = useRef(null);

  return (
    <aside className="panel">
      <div className="panel-body">
        <label className="field">
          <span>旅程名称</span>
          <input
            value={title}
            maxLength={32}
            onChange={(event) => onTitle(event.target.value)}
            placeholder="给这段旅程起个名字"
          />
        </label>

        <div className="presets">
          <button type="button" onClick={onDownloadTrip} disabled={!stops.length}>下载行程</button>
          <button type="button" onClick={() => tripFile.current.click()} disabled={playing}>导入行程</button>
          <input
            ref={tripFile}
            hidden
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              onImportTrip(event.target.files[0]);
              event.target.value = '';
            }}
          />
        </div>

        <div className="section-label">预设</div>
        <div className="presets">
          {presets.map((preset) => (
            <button key={preset.title} type="button" onClick={() => onPreset(preset)} disabled={recording}>
              {preset.title}
            </button>
          ))}
        </div>

        {trips.length > 0 && (
          <details className="trip-history">
            <summary>历史旅程（{trips.length}）</summary>
            <div className="presets">
              {trips.map((trip) => (
                <button key={trip.id} type="button" onClick={() => onOpenTrip(trip)} disabled={playing}>
                  {trip.title} · {trip.stops[0].name} → {trip.stops.at(-1).name}
                </button>
              ))}
            </div>
          </details>
        )}

        <div className="section-label">添加城市</div>
        <CitySearch onAdd={onAdd} disabled={recording} />
        <div className="chips">
          {homeShortcut}
          {POPULAR.map((place) => (
            <button key={place.name} type="button" onClick={() => onAdd(place)} disabled={recording}>
              {place.name}
            </button>
          ))}
        </div>

        <div className="section-row">
          <div className="section-label">足迹</div>
          <button type="button" className="text-btn" onClick={onClear} disabled={!stops.length || recording}>
            清空
          </button>
        </div>

        {stops.length === 0 && <p className="empty">搜索一座城市，或直接在地球上点一下。</p>}

        <ol className="stops">
          {stops.map((stop, index) => (
            <li key={`${stop.name}-${index}-${stop.lat.toFixed(2)}`} className={playing && activeStop === index ? 'is-active' : ''}>
              <div className="stop">
                <span className="stop-index">{index + 1}</span>
                <div>
                  <strong>{stop.name}</strong>
                  <small>{placeSubtitle(stop) || '已选地点'}</small>
                </div>
                <div className="stop-actions">
                  {home?.lat === stop.lat && home?.lng === stop.lng ? (
                    <span className="home-label">家</span>
                  ) : (
                    <button type="button" className="set-home" disabled={playing} onClick={() => onSetHome(stop)}>
                      设为家
                    </button>
                  )}
                  <button type="button" aria-label="上移" disabled={index === 0 || playing} onClick={() => onMove(index, -1)}>
                    ↑
                  </button>
                  <button type="button" aria-label="下移" disabled={index === stops.length - 1 || playing} onClick={() => onMove(index, 1)}>
                    ↓
                  </button>
                  <button type="button" aria-label="移除" disabled={playing} onClick={() => onRemove(index)}>
                    ×
                  </button>
                </div>
              </div>
              {index < stops.length - 1 && route.legs[index] && (
                <LegEditor
                  leg={route.legs[index]}
                  mode={modes[index]}
                  disabled={playing}
                  onMode={(mode) => onMode(index, mode)}
                />
              )}
            </li>
          ))}
        </ol>

        {homeShortcut}

        {route.legs.length > 0 && (
          <div className="stats">
            <div>
              <b>{formatKm(route.km)}</b>
              <span>估算里程</span>
            </div>
            <div>
              <b>{formatHours(route.hours)}</b>
              <span>估算耗时</span>
            </div>
            <div>
              <b>{Math.round(route.total)} 秒</b>
              <span>成片时长</span>
            </div>
          </div>
        )}
        <p className="fine">
          里程按城市坐标估算：飞机走大圆，高铁和汽车会加上绕路系数，不是实时导航。画面里的航线高度做了夸张，方便看清足迹。城市搜索使用 Open-Meteo 与 OpenStreetMap。
        </p>
      </div>

      <div className="panel-actions">
        <div className="segmented" role="group" aria-label="画面比例">
          <button type="button" aria-pressed={aspect === 'landscape'} disabled={playing} onClick={() => onAspect('landscape')}>
            横屏
          </button>
          <button type="button" aria-pressed={aspect === 'portrait'} disabled={playing} onClick={() => onAspect('portrait')}>
            竖屏
          </button>
        </div>
        <div className="action-row">
          <button type="button" className="btn primary" disabled={stops.length < 2} onClick={playing ? onStop : onPlay}>
            {playing ? (recording ? '停止并保存' : '停止') : '播放足迹'}
          </button>
          <button type="button" className="btn ghost" disabled={stops.length < 2 || playing} onClick={onExport}>
            导出视频
          </button>
        </div>
        <p className="status" role="status">{status || '空格键播放或停止'}</p>
      </div>
    </aside>
  );
}

function LegEditor({ leg, mode, onMode, disabled }) {
  const farCar = mode === 'car' && leg.greatKm > 800;
  const farRail = mode === 'rail' && leg.greatKm > 1800;
  return (
    <div className="leg">
      <div className="modes">
        {MODE_ORDER.map((id) => {
          const Icon = ICONS[id];
          return (
            <button
              key={id}
              type="button"
              className={mode === id ? 'on' : ''}
              style={{ '--mode': MODES[id].color }}
              disabled={disabled}
              onClick={() => onMode(id)}
            >
              <Icon />
              {MODES[id].label}
            </button>
          );
        })}
      </div>
      <p>
        {formatKm(leg.km)} · 约 {formatHours(leg.hours)}
        {leg.greatKm < 1 ? ' · 两座城市几乎重叠' : ''}
      </p>
      {farCar && <p className="leg-note">这段较远，汽车线按城市之间的方向估算。</p>}
      {farRail && <p className="leg-note">跨度很大，高铁线表示方向，不是实际班次。</p>}
    </div>
  );
}

function CitySearch({ onAdd, disabled }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const list = await searchPlaces(query, controller.signal);
        if (controller.signal.aborted) return;
        setResults(list);
        setOpen(true);
      } catch (error) {
        if (error.name !== 'AbortError') setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 260);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const onPointer = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, []);

  function choose(place) {
    onAdd(place);
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  return (
    <form
      className="search"
      ref={wrapRef}
      onSubmit={(event) => {
        event.preventDefault();
        if (results[0]) choose(results[0]);
      }}
    >
      <input
        value={query}
        disabled={disabled}
        placeholder="搜索任意城市，例如 京都、里斯本"
        onChange={(event) => {
          setQuery(event.target.value);
          setResults([]);
          setLoading(true);
          setOpen(true);
        }}
        onFocus={() => results.length && setOpen(true)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Escape') setOpen(false);
        }}
        aria-label="搜索城市"
      />
      {open && query.trim() && (
        <div className="results" role="listbox">
          {loading && !results.length && <p>正在搜索…</p>}
          {!loading && !results.length && <p>没有找到这座城市</p>}
          {results.map((place) => (
            <button
              type="button"
              key={`${place.name}-${place.lat}-${place.lng}`}
              onClick={() => choose(place)}
            >
              <strong>{place.name}</strong>
              <small>{placeSubtitle(place) || `${place.lat.toFixed(2)}, ${place.lng.toFixed(2)}`}</small>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
