export function pickMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

export function createRecorder(canvas) {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('这个浏览器不能导出视频，可以先播放足迹');
  }
  const mime = pickMime();
  const stream = canvas.captureStream(30);
  const recorder = mime
    ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10_000_000 })
    : new MediaRecorder(stream, { videoBitsPerSecond: 10_000_000 });
  const chunks = [];
  let settled = false;
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size) chunks.push(event.data);
  };
  return {
    start() {
      recorder.start(200);
    },
    stop() {
      if (settled || recorder.state === 'inactive') {
        return Promise.resolve(chunks.length ? new Blob(chunks, { type: mime || 'video/webm' }) : null);
      }
      settled = true;
      return new Promise((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mime || 'video/webm' }));
        recorder.onerror = () => reject(new Error('视频录制失败'));
        recorder.stop();
      });
    },
  };
}

export function filmName(title) {
  const clean = (title || '旅程').replace(/[\\/:*?"<>|]/g, '').trim() || '旅程';
  return `旅迹-${clean}.webm`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function cover(ctx, source, width, height) {
  const sw = source.width;
  const sh = source.height;
  if (!sw || !sh) return;
  const scale = Math.max(width / sw, height / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(source, (width - dw) / 2, (height - dh) / 2, dw, dh);
}

export function paintFilm(ctx, source, width, height, hud) {
  ctx.fillStyle = '#07090d';
  ctx.fillRect(0, 0, width, height);
  try {
    cover(ctx, source, width, height);
  } catch {
    throw new Error('影像跨域限制，暂时不能导出视频');
  }

  const gradient = ctx.createLinearGradient(0, height * 0.61, 0, height);
  gradient.addColorStop(0, 'rgba(8,19,30,0)');
  gradient.addColorStop(1, 'rgba(8,19,30,0.82)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, height * 0.61, width, height * 0.39);

  const pad = Math.round(Math.min(width, height) * 0.055);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(246,239,226,0.9)';
  ctx.font = `600 ${Math.round(Math.min(width, height) * 0.028)}px "Noto Sans SC", "Microsoft YaHei", sans-serif`;
  ctx.fillText('旅迹', pad, pad);

  if (hud.recording) {
    const recX = width - pad - 78;
    ctx.fillStyle = '#ff5a4a';
    ctx.beginPath();
    ctx.arc(recX, pad + 8, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(246,239,226,0.92)';
    ctx.font = `600 ${Math.round(Math.min(width, height) * 0.026)}px "Noto Sans SC", "Microsoft YaHei", sans-serif`;
    ctx.fillText('REC', recX + 14, pad);
  }

  const captionSize = Math.round(Math.min(width, height) * (width > height ? 0.052 : 0.046));
  const captionY = height - pad - captionSize * 2.15;
  ctx.font = `700 ${captionSize}px "Noto Sans SC", "Microsoft YaHei", sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.fillText(hud.caption || '', pad, captionY);

  ctx.font = `500 ${Math.round(captionSize * 0.4)}px "Noto Sans SC", "Microsoft YaHei", sans-serif`;
  ctx.fillStyle = '#f1f5fa';
  ctx.fillText(hud.meta || '', pad, captionY + captionSize * 1.12);

  const barY = height - Math.round(pad * 0.72);
  const barW = width - pad * 2;
  ctx.fillStyle = 'rgba(246,239,226,0.22)';
  ctx.fillRect(pad, barY, barW, 4);
  ctx.fillStyle = '#fff';
  ctx.fillRect(pad, barY, barW * Math.min(1, Math.max(0, hud.progress || 0)), 4);

  ctx.font = `400 ${Math.max(13, Math.round(Math.min(width, height) * 0.02))}px "Microsoft YaHei", sans-serif`;
  ctx.fillStyle = 'rgba(246,239,226,0.66)';
  ctx.fillText('影像 © Esri, Maxar, Earthstar Geographics', pad, pad + Math.round(Math.min(width, height) * 0.05));
}
