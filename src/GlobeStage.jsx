import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { buildRoute, buildTimeline, frameAt } from './lib/timeline.js';
import { createRecorder, paintFilm } from './lib/record.js';
import { haversine } from './lib/geo.js';

const stopEntities = [];

const GlobeStage = forwardRef(function GlobeStage({ onReady, onPick, onStatus }, ref) {
  const rootRef = useRef(null);
  const exportRef = useRef(null);
  const viewerRef = useRef(null);
  const onReadyRef = useRef(onReady);
  const onPickRef = useRef(onPick);
  const onStatusRef = useRef(onStatus);
  const playRef = useRef(null);
  const routeRef = useRef(null);
  const vehicleRef = useRef(null);
  const activeRef = useRef(-1);

  onReadyRef.current = onReady;
  onPickRef.current = onPick;
  onStatusRef.current = onStatus;

  useImperativeHandle(ref, () => ({
    setRoute(stops, modes, options = {}) {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed() || playRef.current) return;
      const route = buildRoute(stops, modes);
      const timeline = buildTimeline(route);
      routeRef.current = { stops, modes, timeline };
      mountRoute(viewer, timeline.legs, stops);
      updateVehicle(vehicleRef.current, { show: false });
      if (options.frame) frameCamera(viewer, stops, timeline.overview);
    },
    play(options) {
      const viewer = viewerRef.current;
      if (!viewer || viewer.isDestroyed()) throw new Error('地球还没准备好');
      const { stops, modes } = options;
      if (routeRef.current?.stops !== stops || routeRef.current.modes !== modes) {
        const timeline = buildTimeline(buildRoute(stops, modes));
        mountRoute(viewer, timeline.legs, stops);
        routeRef.current = { stops, modes, timeline };
      }
      const { timeline } = routeRef.current;
      activeRef.current = -1;
      viewer.camera.cancelFlight();
      viewer.scene.screenSpaceCameraController.enableInputs = false;
      viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
      const previousScale = viewer.resolutionScale || 1;
      setMotionQuality(viewer, true);
      const pixelRatio = window.devicePixelRatio || 1;
      const playbackRatio = 2;
      viewer.resolutionScale = Math.min(previousScale, playbackRatio / pixelRatio);
      viewer.resize();
      playRef.current = {
        timeline,
        stops: options.stops,
        title: options.title,
        t0: null,
        wantsRecord: !!options.record,
        aspect: options.aspect,
        recorder: null,
        recordFailed: false,
        finished: false,
        completing: false,
        hud: null,
        previousScale,
        lastUi: 0,
        lastExportFrame: -Infinity,
      };
    },
    stop() {
      const play = playRef.current;
      if (!play) return Promise.resolve(null);
      playRef.current = null;
      for (const leg of play.timeline.legs) {
        if (leg.primitive) leg.primitive.show = true;
      }
      releaseCamera(viewerRef.current, play.previousScale);
      if (!play.recorder) return Promise.resolve(null);
      return play.recorder.stop();
    },
    resize() {
      const viewer = viewerRef.current;
      if (viewer && !viewer.isDestroyed()) viewer.resize();
    },
  }));

  useEffect(() => {
    let destroyed = false;
    let viewer;
    let handler;
    const root = rootRef.current;

    try {
      viewer = createViewer(root);
      if (destroyed) {
        viewer.destroy();
        return undefined;
      }
      viewerRef.current = viewer;
      vehicleRef.current = addVehicle(viewer);

      handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((movement) => {
        if (playRef.current) return;
        const ray = viewer.camera.getPickRay(movement.position);
        if (!ray) return;
        const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
        if (!cartesian) return;
        const carto = Cesium.Cartographic.fromCartesian(cartesian);
        onPickRef.current?.(
          Cesium.Math.toDegrees(carto.latitude),
          Cesium.Math.toDegrees(carto.longitude),
        );
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

      const onPre = () => {
        const play = playRef.current;
        if (!play || viewer.isDestroyed()) return;
        const now = performance.now();
        play.t0 ??= now;
        const elapsed = (now - play.t0) / 1000;
        const frame = frameAt(
          play.timeline,
          play.stops,
          Math.min(elapsed, play.timeline.total),
          play.title,
        );
        reveal(play.timeline.legs, frame.progress);
        updateVehicle(vehicleRef.current, frame.vehicle);
        applyCamera(viewer, frame.camera);
        if (frame.activeStop !== activeRef.current) {
          activeRef.current = frame.activeStop;
          highlightStop(frame.activeStop);
        }
        play.hud = frame.hud;
        if (elapsed >= play.timeline.total) play.finished = true;
        if (now - play.lastUi > 90 || play.finished) {
          play.lastUi = now;
          onStatusRef.current?.({
            type: 'tick',
            hud: frame.hud,
            activeStop: frame.activeStop,
          });
        }
      };

      const onPost = () => {
        const play = playRef.current;
        if (!play || viewer.isDestroyed()) return;
        if (play.wantsRecord && !play.recorder && !play.recordFailed) {
          try {
            const canvas = exportRef.current;
            sizeExport(canvas, play.aspect);
            play.recorder = createRecorder(canvas);
            play.recorder.start();
          } catch (error) {
            play.recordFailed = true;
            play.wantsRecord = false;
            onStatusRef.current?.({
              type: 'record-failed',
              message: error.message || '暂时不能导出视频',
            });
          }
        }
        const now = performance.now();
        if (play.recorder && play.hud && (play.finished || now >= play.lastExportFrame + 1000 / 30 - 2)) {
          play.lastExportFrame = now;
          try {
            const canvas = exportRef.current;
            const context = canvas.getContext('2d', { alpha: false });
            paintFilm(context, viewer.scene.canvas, canvas.width, canvas.height, {
              ...play.hud,
              recording: true,
            });
          } catch (error) {
            const recorder = play.recorder;
            play.recorder = null;
            play.wantsRecord = false;
            play.recordFailed = true;
            recorder.stop().catch(() => {});
            onStatusRef.current?.({
              type: 'record-failed',
              message: error.message || '导出失败',
            });
          }
        }
        if (play.finished) finishPlayback(play, viewer, playRef, onStatusRef);
      };

      viewer.scene.preUpdate.addEventListener(onPre);
      viewer.scene.postRender.addEventListener(onPost);
      onReadyRef.current?.();
      document.fonts?.ready?.then(() => {
        if (destroyed || viewer.isDestroyed()) return;
        const route = routeRef.current;
        if (route?.stops.length && !playRef.current) syncStops(viewer, route.stops, activeRef.current);
      });
    } catch (error) {
      console.error(error);
      if (!destroyed) onStatusRef.current?.({ type: 'error', message: '三维地球启动失败' });
    }

    const observer = new ResizeObserver(() => {
      const current = viewerRef.current;
      if (!current || current.isDestroyed()) return;
      if (root.clientWidth < 8 || root.clientHeight < 8) return;
      current.resize();
    });
    if (root) observer.observe(root);

    return () => {
      destroyed = true;
      observer.disconnect();
      playRef.current = null;
      handler?.destroy();
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
      stopEntities.length = 0;
    };
  }, []);

  return (
    <div className="globe-root" ref={rootRef}>
      <canvas ref={exportRef} className="export-sink" width="1920" height="1080" />
    </div>
  );
});

const scratchTarget = new Cesium.Cartesian3();
const scratchHpr = new Cesium.HeadingPitchRange(0, -0.8, 1_000_000);
let revealReady = false;

function ensureRevealMaterial() {
  if (revealReady) return;
  revealReady = true;
  const source = [
    'czm_material czm_getMaterial(czm_materialInput materialInput)',
    '{',
    '  czm_material material = czm_getDefaultMaterial(materialInput);',
    '  float along = materialInput.st.s;',
    '  float edge = max(fwidth(along), 0.00001);',
    '  float revealed = progress >= 1.0 ? 1.0 : 1.0 - smoothstep(progress - edge, progress + edge, along);',
    '  if (progress <= 0.0) revealed = 0.0;',
    '  float head = smoothstep(progress - 0.045, progress, along) * revealed;',
    '  material.diffuse = color.rgb;',
    '  material.emission = color.rgb * head * 0.35;',
    '  float across = abs(materialInput.st.t * 2.0 - 1.0);',
    '  float coverage = 1.0 - smoothstep(0.55, 1.0, across);',
    '  material.alpha = mix(0.08, 0.78, revealed) * coverage;',
    '  return material;',
    '}',
  ].join('\n');
  try {
    Cesium.Material._materialCache.addMaterial('ArcRibbon', {
      fabric: {
        type: 'ArcRibbon',
        uniforms: {
          color: new Cesium.Color(1, 1, 1, 1),
          progress: 0,
        },
        source,
      },
      translucent: () => true,
    });
  } catch {
    revealReady = true;
  }
}

function setMotionQuality(viewer, moving) {
  if (!viewer || viewer.isDestroyed()) return;
  viewer.scene.globe.maximumScreenSpaceError = moving ? 1.5 : 1;
}

function featherPolarImagery(provider) {
  const requestImage = provider.requestImage.bind(provider);
  provider.requestImage = (x, y, level, request) => {
    const rectangle = provider.tilingScheme.tileXYToRectangle(x, y, level);
    const edge = Cesium.Math.toRadians(78);
    const image = requestImage(x, y, level, request);
    if (!image || (rectangle.north < edge && rectangle.south > -edge)) return image;
    return Promise.resolve(image).then((source) => {
      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      const context = canvas.getContext('2d');
      // Cesium decodes ImageBitmap tiles with Y already flipped. Restore
      // their orientation before drawing into a canvas that WebGL will flip.
      context.save();
      if (source instanceof ImageBitmap) {
        context.translate(0, canvas.height);
        context.scale(1, -1);
      }
      context.drawImage(source, 0, 0);
      context.restore();
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const project = (latitude) => Math.log(Math.tan(Math.PI / 4 + latitude / 2));
      const north = project(rectangle.north);
      const south = project(rectangle.south);
      const limit = provider.tilingScheme.rectangle.north;
      for (let row = 0; row < canvas.height; row++) {
        const mercator = north + (south - north) * (row + 0.5) / canvas.height;
        const latitude = Math.abs(2 * Math.atan(Math.exp(mercator)) - Math.PI / 2);
        const fade = Cesium.Math.clamp((latitude - edge) / (limit - edge), 0, 1);
        const alpha = 1 - fade * fade * (3 - 2 * fade);
        for (let column = 0; column < canvas.width; column++) {
          const offset = (row * canvas.width + column) * 4 + 3;
          pixels.data[offset] = Math.round(pixels.data[offset] * alpha);
        }
      }
      context.putImageData(pixels, 0, 0);
      return canvas;
    });
  };
  return provider;
}

function createViewer(root) {
  // A Mercator base layer stretches its last row of pixels over the poles.
  // Keep a full-coverage geographic layer underneath the detailed imagery.
  const polarBase = new Cesium.UrlTemplateImageryProvider({
    url: Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII/{z}/{x}/{reverseY}.jpg'),
    tilingScheme: new Cesium.GeographicTilingScheme(),
    maximumLevel: 2,
    credit: 'Natural Earth',
    enablePickFeatures: false,
  });
  const imagery = featherPolarImagery(new Cesium.UrlTemplateImageryProvider({
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maximumLevel: 19,
    credit: 'Esri, Maxar, Earthstar Geographics',
    enablePickFeatures: false,
  }));
  const terrainProvider = new Cesium.EllipsoidTerrainProvider();
  const viewer = new Cesium.Viewer(root, {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    scene3DOnly: true,
    shouldAnimate: true,
    shadows: false,
    orderIndependentTranslucency: false,
    requestRenderMode: false,
    contextOptions: {
      webgl: {
        alpha: false,
        preserveDrawingBuffer: true,
      },
    },
    baseLayer: new Cesium.ImageryLayer(polarBase),
    terrain: new Cesium.Terrain(Promise.resolve(terrainProvider)),
  });
  const controller = viewer.scene.screenSpaceCameraController;
  controller.minimumZoomDistance = 2500;
  controller.maximumZoomDistance = 45_000_000;
  controller.inertiaSpin = 0.82;
  controller.inertiaTranslate = 0.75;
  controller.inertiaZoom = 0.7;
  controller.enableCollisionDetection = true;
  viewer.scene.globe.enableLighting = true;
  viewer.scene.globe.dynamicAtmosphereLighting = true;
  viewer.scene.globe.dynamicAtmosphereLightingFromSun = true;
  viewer.scene.globe.depthTestAgainstTerrain = false;
  viewer.scene.globe.showGroundAtmosphere = true;
  viewer.scene.globe.atmosphereLightIntensity = 5.5;
  viewer.scene.globe.atmosphereHueShift = 0;
  viewer.scene.globe.atmosphereSaturationShift = -0.45;
  viewer.scene.globe.atmosphereBrightnessShift = -0.12;
  viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#050910');
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#02030a');
  if (viewer.scene.skyAtmosphere) {
    viewer.scene.skyAtmosphere.hueShift = 0;
    viewer.scene.skyAtmosphere.saturationShift = -0.2;
    viewer.scene.skyAtmosphere.brightnessShift = 0.05;
  }
  viewer.clock.clockStep = Cesium.ClockStep.SYSTEM_CLOCK;
  viewer.useBrowserRecommendedResolution = false;
  const displayRatio = window.devicePixelRatio || 1;
  viewer.resolutionScale = Math.min(2.25, Math.max(displayRatio, 2.25) / displayRatio);
  setMotionQuality(viewer, false);
  viewer.scene.globe.loadingDescendantLimit = 20;
  viewer.scene.globe.tileCacheSize = 2000;
  if (viewer.scene.postProcessStages.fxaa) viewer.scene.postProcessStages.fxaa.enabled = false;
  const polarLayer = viewer.imageryLayers.get(0);
  polarLayer.brightness = 0.78;
  polarLayer.contrast = 1.22;
  polarLayer.saturation = 0.42;
  polarLayer.gamma = 1.05;
  polarLayer.nightAlpha = 0.72;
  const layer = viewer.imageryLayers.addImageryProvider(imagery);
  if (layer) {
    layer.brightness = 0.78;
    layer.contrast = 1.22;
    layer.saturation = 0.42;
    layer.gamma = 1.05;
    layer.dayAlpha = 1;
    layer.nightAlpha = 0.72;
  }
  // A complete same-origin night image stays underneath the remote detail
  // tiles, so a slow or failed request cannot expose a daytime wedge.
  const nightOverview = viewer.imageryLayers.addImageryProvider(
    new Cesium.SingleTileImageryProvider({
      url: `${import.meta.env.BASE_URL}maps/night-earth.jpg`,
      tileWidth: 3600,
      tileHeight: 1800,
      credit: 'NASA Earth Observatory / NOAA NGDC',
    }),
  );
  // Keep the lightweight overview on the first terrain tiles. Refined
  // terrain requests the visible sectors of the native-resolution image.
  const nightHD = new Cesium.ImageryLayer(
    new Cesium.UrlTemplateImageryProvider({
      url: `${import.meta.env.BASE_URL}maps/night-hd/{x}-{y}.jpg`,
      tilingScheme: new Cesium.GeographicTilingScheme({
        numberOfLevelZeroTilesX: 4,
        numberOfLevelZeroTilesY: 2,
      }),
      tileWidth: 3375,
      tileHeight: 3375,
      maximumLevel: 0,
      hasAlphaChannel: false,
      credit: 'NASA Earth Observatory / NOAA NGDC',
      enablePickFeatures: false,
    }),
    { minimumTerrainLevel: 2 },
  );
  viewer.imageryLayers.add(nightHD);
  const night = viewer.imageryLayers.addImageryProvider(
    new Cesium.WebMapServiceImageryProvider({
      // Geographic WMS covers both poles; Mercator stops at 85.05 degrees
      // and exposes a visibly different circular patch underneath.
      url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
      layers: 'VIIRS_CityLights_2012',
      parameters: { format: 'image/jpeg', transparent: false },
      tilingScheme: new Cesium.GeographicTilingScheme(),
      maximumLevel: 8,
      credit: 'NASA VIIRS',
      enablePickFeatures: false,
    }),
  );
  for (const nightLayer of [nightOverview, nightHD, night]) {
    nightLayer.dayAlpha = 0;
    nightLayer.nightAlpha = 1;
    nightLayer.brightness = 1.28;
    nightLayer.contrast = 1.32;
    nightLayer.saturation = 0.5;
    nightLayer.gamma = 1;
  }
  // Overview uses the cached full globe; only request remote night detail
  // when the camera is close enough to display that extra resolution.
  night.show = false;
  viewer.scene.preRender.addEventListener(() => {
    const { height } = viewer.camera.positionCartographic;
    const fade = Cesium.Math.clamp((height - 280_000) / 1_320_000, 0, 1);
    const lights = fade * fade * (3 - 2 * fade);
    nightOverview.alpha = lights;
    nightHD.alpha = lights;
    nightHD.show = lights > 0;
    night.alpha = lights;
    night.show = lights > 0 && height < 3_000_000;
    layer.nightAlpha = 0.72 + (1 - lights) * 0.22;
  });
  ensureRevealMaterial();
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(78, 18, 18_000_000),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-55),
      roll: 0,
    },
  });
  return viewer;
}

const vehiclePaths = {
  plane: 'M12 2 Q14 2 14 5 V9 L22 14 V17 L14 14 V18 L17 21 V23 L12 21 L7 23 V21 L10 18 V14 L2 17 V14 L10 9 V5 Q10 2 12 2Z',
  rail: 'M6 5 Q6 2 12 2 Q18 2 18 5 V18 Q18 22 12 22 Q6 22 6 18Z M8 6 V10 H16 V6Z M8 13 V16 H16 V13Z',
  car: 'M7 3 Q12 1 17 3 L20 9 V19 Q20 22 17 22 H7 Q4 22 4 19 V9Z M8 6 L6 10 H18 L16 6Z M7 15 V18 H17 V15Z',
};

function drawVehicleIcon(path) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 96;
  const context = canvas.getContext('2d');
  context.fillStyle = '#2866d2';
  context.beginPath();
  context.arc(48, 48, 43, 0, Math.PI * 2);
  context.fill();
  context.translate(18, 18);
  context.scale(2.5, 2.5);
  context.fillStyle = '#fff';
  context.fill(new Path2D(path), 'evenodd');
  return canvas;
}

function addVehicle(viewer) {
  const billboards = viewer.scene.primitives.add(new Cesium.BillboardCollection());
  return Object.fromEntries(Object.entries(vehiclePaths).map(([mode, path]) => [mode, billboards.add({
    show: false,
    image: drawVehicleIcon(path),
    width: 34,
    height: 34,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  })]));
}

const scratchVehicle = new Cesium.Cartesian3();
const scratchDirection = new Cesium.Cartesian3();
const scratchVehicleTransform = new Cesium.Matrix4();

function updateVehicle(billboards, vehicle) {
  const marker = vehicle.show ? billboards[vehicle.mode] : null;
  for (const billboard of Object.values(billboards)) billboard.show = billboard === marker;
  if (!marker) return;
  marker.position = Cesium.Cartesian3.fromDegrees(
    vehicle.lng, vehicle.lat, vehicle.height, Cesium.Ellipsoid.WGS84, scratchVehicle,
  );
  const heading = Cesium.Math.toRadians(vehicle.heading);
  Cesium.Cartesian3.fromElements(Math.sin(heading), Math.cos(heading), 0, scratchDirection);
  Cesium.Transforms.eastNorthUpToFixedFrame(scratchVehicle, Cesium.Ellipsoid.WGS84, scratchVehicleTransform);
  marker.alignedAxis = Cesium.Matrix4.multiplyByPointAsVector(scratchVehicleTransform, scratchDirection, scratchDirection);
}

function mountRoute(viewer, legs, stops) {
  clearArcs(viewer);
  syncStops(viewer, stops, -1);
  for (const leg of legs) {
    if (leg.samples.length < 2) continue;
    const positions = leg.samples.map(({ lng, lat, alt }) => Cesium.Cartesian3.fromDegrees(lng, lat, alt));
    const material = Cesium.Material.fromType('ArcRibbon');
    const primitive = viewer.scene.primitives.add(new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({
        geometry: new Cesium.PolylineGeometry({
          positions,
          width: 2.6,
          arcType: Cesium.ArcType.NONE,
          vertexFormat: Cesium.PolylineMaterialAppearance.VERTEX_FORMAT,
        }),
      }),
      appearance: new Cesium.PolylineMaterialAppearance({ material }),
      asynchronous: false,
    }));
    viewer._routePrimitives.push(primitive);
    leg.primitive = primitive;
    leg.material = material;
  }
}

function clearArcs(viewer) {
  (viewer._routePrimitives || []).forEach((primitive) => {
    if (!primitive.isDestroyed?.()) viewer.scene.primitives.remove(primitive);
  });
  viewer._routePrimitives = [];
}

function clearPrefixed(viewer, prefix) {
  const ids = [];
  const values = viewer.entities.values;
  for (let i = 0; i < values.length; i += 1) {
    const id = values[i].id;
    if (typeof id === 'string' && id.startsWith(prefix)) ids.push(id);
  }
  ids.forEach((id) => viewer.entities.removeById(id));
}

function syncStops(viewer, stops, activeIndex) {
  clearPrefixed(viewer, 'stop-');
  stopEntities.length = 0;
  samePlaceGroups(stops).forEach((group) => {
    const stop = stops[group[0]];
    const active = group.includes(activeIndex);
    const entity = viewer.entities.add({
      id: `stop-${group[0]}`,
      position: Cesium.Cartesian3.fromDegrees(stop.lng, stop.lat, 1800),
      billboard: {
        image: plainDot(group.length),
        width: 25,
        height: 25,
        scale: active ? 1.2 : 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: stop.name,
        font: '500 42px "Noto Sans SC", "Microsoft YaHei", sans-serif',
        fillColor: Cesium.Color.fromCssColorString('#f4ecdf'),
        style: Cesium.LabelStyle.FILL,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('#13243a').withAlpha(0.78),
        backgroundPadding: new Cesium.Cartesian2(11, 6),
        pixelOffset: new Cesium.Cartesian2(0, -18),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scale: active ? 0.56 : 0.48,
        scaleByDistance: new Cesium.NearFarScalar(90_000, 1, 3_200_000, 0.72),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5_500_000),
      },
    });
    entity.visitIndices = group;
    group.forEach((index) => {
      stopEntities[index] = entity;
    });
  });
}

function samePlaceGroups(stops) {
  const groups = [];
  const used = new Set();
  stops.forEach((stop, index) => {
    if (used.has(index)) return;
    const group = [index];
    for (let other = index + 1; other < stops.length; other += 1) {
      if (used.has(other)) continue;
      if (haversine(stop, stops[other]) < 8) group.push(other);
    }
    group.forEach((item) => used.add(item));
    groups.push(group);
  });
  return groups;
}

const dotImages = new Map();

function plainDot(visits = 1) {
  const layers = Math.min(5, Math.max(1, visits));
  if (dotImages.has(layers)) return dotImages.get(layers);
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  for (let layer = layers - 1; layer > 0; layer -= 1) {
    ctx.beginPath();
    ctx.arc(32, 32, 11 + layer * 4, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${0.62 - layer * 0.08})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(32, 32, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  dotImages.set(layers, canvas);
  return canvas;
}

function highlightStop(index) {
  const activeEntity = stopEntities[index];
  const seen = new Set();
  stopEntities.forEach((entity) => {
    if (!entity || seen.has(entity)) return;
    seen.add(entity);
    const active = entity === activeEntity;
    if (entity.billboard) {
      entity.billboard.scale = active ? 1.2 : 1;
      const visits = entity.visitIndices.filter((visit) => visit <= index).length;
      entity.billboard.image = plainDot(visits);
    }
    if (entity.label) entity.label.scale = active ? 0.56 : 0.48;
  });
}

function reveal(legs, progress) {
  const next = progress.findIndex((value) => value < 1);
  legs.forEach((leg, index) => {
    const material = leg.material;
    if (!material) return;
    leg.primitive.show = next === -1 || index <= next;
    if (material.uniforms.progress !== progress[index]) {
      material.uniforms.progress = progress[index];
    }
  });
}

function applyCamera(viewer, target) {
  Cesium.Cartesian3.fromDegrees(target.lng, target.lat, target.height, Cesium.Ellipsoid.WGS84, scratchTarget);
  scratchHpr.heading = Cesium.Math.toRadians(target.heading);
  scratchHpr.pitch = Cesium.Math.toRadians(target.pitch);
  scratchHpr.range = target.range;
  viewer.camera.lookAt(scratchTarget, scratchHpr);
}

function releaseCamera(viewer, previousScale) {
  if (!viewer || viewer.isDestroyed()) return;
  viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  viewer.scene.screenSpaceCameraController.enableInputs = true;
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
  setMotionQuality(viewer, false);
  if (previousScale && Math.abs(viewer.resolutionScale - previousScale) > 0.01) {
    viewer.resolutionScale = previousScale;
    viewer.resize();
  }
}

function finishPlayback(play, viewer, playRef, onStatusRef) {
  if (play.completing) return;
  play.completing = true;
  if (playRef.current === play) playRef.current = null;
  releaseCamera(viewer, play.previousScale);
  const emit = (blob) => {
    onStatusRef.current?.({ type: 'done', blob, hud: play.hud, cancelled: false });
  };
  if (play.recorder) play.recorder.stop().then(emit).catch(() => emit(null));
  else emit(null);
}

function frameCamera(viewer, stops, overview) {
  viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  if (!stops.length) {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(78, 18, 18_000_000),
      orientation: {
        heading: 0,
        pitch: Cesium.Math.toRadians(-55),
        roll: 0,
      },
      duration: 0.8,
    });
    return;
  }
  const center = Cesium.Cartesian3.fromDegrees(overview.lng, overview.lat, overview.height);
  viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(center, 0), {
    duration: 0.85,
    offset: new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(overview.heading),
      Cesium.Math.toRadians(overview.pitch),
      stops.length === 1 ? 70_000 : overview.range,
    ),
  });
}

function sizeExport(canvas, aspect) {
  const portrait = aspect === 'portrait';
  const width = portrait ? 1080 : 1920;
  const height = portrait ? 1920 : 1080;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}

export default GlobeStage;
