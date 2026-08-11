// 전술 리소스 이미지 정의 및 로드
const imageAssets = {
    bg: 'background.jpg',
    bossLaser: 'boss-laser.png',
    playerBullet: 'player-bullet.png',
    commander: 'commander.png',
    soldier: 'soldier.png',
    bosses: [
        'boss-stage-1.png',
        'boss-stage-2.png',
        'boss-stage-3.png',
        'boss-stage-4.png',
        'boss-stage-5.png',
        'boss-stage-6.png',
        'boss-stage-7.png',
        'boss-stage-8.png',
        'boss-stage-9.png',
        'boss-stage-10.png'
    ]
};
const TOTAL_ROUNDS = Math.max(1, imageAssets.bosses.length);

const processedCutouts = new WeakMap();

function loadTacticalImage(src, options = {}) {
    const img = new Image();
    img.requiresCutout = Boolean(options.removeBackground);
    img.onerror = () => console.warn(`[Sequence War] 이미지 자산을 찾을 수 없습니다: ${src}`);
    img.onload = () => {
        if (options.removeBackground) {
            try {
                processedCutouts.set(img, createBackgroundCutout(img, options));
            } catch (error) {
                img.requiresCutout = false;
                console.warn(`[Sequence War] 이미지 배경 제거 실패: ${src}`, error);
            }
        }
    };
    img.src = src;
    return img;
}

function colorDistanceSq(r1, g1, b1, r2, g2, b2) {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return dr * dr + dg * dg + db * db;
}

function createBackgroundCutout(img, options = {}) {
    const sourceCanvas = document.createElement('canvas');
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    sourceCanvas.width = w;
    sourceCanvas.height = h;

    const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    sourceCtx.drawImage(img, 0, 0);

    const imageData = sourceCtx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const tolerance = options.tolerance || 58;
    const toleranceSq = tolerance * tolerance;
    const palette = [];
    const step = Math.max(8, Math.floor(Math.min(w, h) / 56));

    function addPalettePixel(x, y) {
        const i = (y * w + x) * 4;
        if (data[i + 3] > 16) {
            palette.push([data[i], data[i + 1], data[i + 2]]);
        }
    }

    for (let x = 0; x < w; x += step) {
        addPalettePixel(x, 0);
        addPalettePixel(x, h - 1);
    }
    for (let y = 0; y < h; y += step) {
        addPalettePixel(0, y);
        addPalettePixel(w - 1, y);
    }
    palette.push(
        [data[0], data[1], data[2]],
        [data[(w - 1) * 4], data[(w - 1) * 4 + 1], data[(w - 1) * 4 + 2]],
        [data[((h - 1) * w) * 4], data[((h - 1) * w) * 4 + 1], data[((h - 1) * w) * 4 + 2]],
        [data[(h * w - 1) * 4], data[(h * w - 1) * 4 + 1], data[(h * w - 1) * 4 + 2]]
    );

    const compactPalette = [];
    const paletteStep = Math.max(1, Math.ceil(palette.length / 64));
    for (let i = 0; i < palette.length; i += paletteStep) {
        compactPalette.push(palette[i]);
    }

    function isLikelyBackground(idx) {
        const base = idx * 4;
        const a = data[base + 3];
        if (a < 24) return true;

        const r = data[base];
        const g = data[base + 1];
        const b = data[base + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max - min;
        const luma = (r * 0.299) + (g * 0.587) + (b * 0.114);

        if (saturation < 10 && luma > 168 && luma < 238) return true;
        for (const [pr, pg, pb] of compactPalette) {
            if (colorDistanceSq(r, g, b, pr, pg, pb) <= toleranceSq) return true;
        }
        return false;
    }

    const visited = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    let head = 0;
    let tail = 0;

    function enqueue(idx) {
        if (idx < 0 || idx >= visited.length || visited[idx] || !isLikelyBackground(idx)) return;
        visited[idx] = 1;
        queue[tail++] = idx;
    }

    for (let x = 0; x < w; x++) {
        enqueue(x);
        enqueue((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
        enqueue(y * w);
        enqueue(y * w + w - 1);
    }

    while (head < tail) {
        const idx = queue[head++];
        const x = idx % w;
        const y = Math.floor(idx / w);
        if (x > 0) enqueue(idx - 1);
        if (x < w - 1) enqueue(idx + 1);
        if (y > 0) enqueue(idx - w);
        if (y < h - 1) enqueue(idx + w);
    }

    for (let idx = 0; idx < visited.length; idx++) {
        if (visited[idx]) {
            data[idx * 4 + 3] = 0;
        }
    }

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const idx = y * w + x;
            if (visited[idx]) continue;
            const touchesRemoved =
                visited[idx - 1] || visited[idx + 1] || visited[idx - w] || visited[idx + w];
            if (!touchesRemoved) continue;

            const base = idx * 4;
            const max = Math.max(data[base], data[base + 1], data[base + 2]);
            const min = Math.min(data[base], data[base + 1], data[base + 2]);
            if (max - min < 34) {
                data[base + 3] = Math.floor(data[base + 3] * 0.46);
            }
        }
    }

    sourceCtx.putImageData(imageData, 0, 0);
    return sourceCanvas;
}

const imgBossLaser = loadTacticalImage(imageAssets.bossLaser);
const imgPlayerBullet = loadTacticalImage(imageAssets.playerBullet);
const imgCommander = loadTacticalImage(imageAssets.commander);
const imgSoldier = loadTacticalImage(imageAssets.soldier);

// 라운드별 각기 다른 고유형 보스 이미지 로드
const imgBossStages = imageAssets.bosses.map(src => loadTacticalImage(src));

// --- WEBAUDIO EFFECT SYNTHESIZER ---
class WebAudioSynth {
    constructor() {
        this.ctx = null;
        this.muted = false;
    }
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }
    playGateCorrect() {
        if (this.muted) return; this.init();
        const now = this.ctx.currentTime;
        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((f, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(f, now + i * 0.05);
            gain.gain.setValueAtTime(0.08, now + i * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.15);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + i * 0.05);
            osc.stop(now + i * 0.05 + 0.15);
        });
    }
    playGateWrong() {
        if (this.muted) return; this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(70, this.ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }
    playLaser() {
        if (this.muted) return; this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.08);
    }
    playExplode() {
        if (this.muted) return; this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(10, this.ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.4);
    }
    playUpgrade() {
        if (this.muted) return; this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(1000, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(now + 0.2);
    }
}
const audio = new WebAudioSynth();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

const COMMANDER_RENDER_SCALE = 1.95;
const SOLDIER_RENDER_SCALE = 1.72;
const PLAYER_BULLET_ROTATION_OFFSET = 0;
const BOSS_BULLET_ROTATION_OFFSET = Math.PI;
const BOSS_WARNING_DISTANCE = 200;
const COMMANDER_BOTTOM_OFFSET = 150;
const MAX_ARMY_CAP = 64;
const ARMY_WEAPON_BIAS_THRESHOLD = 48;
const COMMANDER_FIRE_BASE_RATE = 0.34;
const COMMANDER_BULLET_COLOR = '#a3e635';
const GATE_RULE_READ_MS = 3000;
const GATE_COUNTDOWN_STEP_MS = 1000;
const GATE_COUNTDOWN_TOTAL_MS = GATE_RULE_READ_MS + GATE_COUNTDOWN_STEP_MS * 3;

const bossRenderProfiles = {
    1: { widthMul: 4.05, heightMul: 4.05, glow: '#84cc16' },
    2: { widthMul: 4.25, heightMul: 4.25, glow: '#c084fc' },
    3: { widthMul: 3.95, heightMul: 3.95, glow: '#f97316' },
    4: { widthMul: 4.35, heightMul: 3.75, glow: '#ef4444' },
    5: { widthMul: 4.45, heightMul: 4.05, glow: '#f43f5e' },
    6: { widthMul: 4.45, heightMul: 4.45, glow: '#a855f7' },
    7: { widthMul: 4.18, heightMul: 4.18, glow: '#84cc16' },
    8: { widthMul: 4.05, heightMul: 4.05, glow: '#fb923c' },
    9: { widthMul: 4.7, heightMul: 4.0, glow: '#ef4444' },
    10: { widthMul: 4.5, heightMul: 4.35, glow: '#f97316' }
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getPlayfieldSpeedScale() {
    const baseScale = clamp(canvas.height / 980, 0.38, 0.74);
    return window.innerWidth >= 720 ? clamp(baseScale * 1.28, 0.55, 0.94) : baseScale;
}

function getBossTravelSpeedScale() {
    const baseScale = clamp(canvas.height / 1020, 0.36, 0.7);
    return window.innerWidth >= 720 ? clamp(baseScale * 1.25, 0.52, 0.88) : baseScale;
}

function getProjectileSpeedScale() {
    return clamp(canvas.height / 980, 0.46, 0.78);
}

function getMobileFireIntervalScale() {
    const shortScreenRatio = clamp((720 - canvas.height) / 260, 0, 1);
    return 1 + shortScreenRatio * 0.95;
}

function getBossBulletSizeScale() {
    return clamp(0.78 - Math.min(currentStage, TOTAL_ROUNDS) * 0.012, 0.62, 0.76);
}

function getDrawableAsset(img) {
    if (!img) return null;
    if (img.requiresCutout) {
        return processedCutouts.get(img) || (img.complete && img.naturalWidth > 0 ? img : null);
    }
    return img;
}

function getDrawableSize(drawable) {
    if (!drawable) return { width: 0, height: 0 };
    return {
        width: drawable.naturalWidth || drawable.width || 0,
        height: drawable.naturalHeight || drawable.height || 0
    };
}

function isImageReady(img) {
    const drawable = getDrawableAsset(img);
    const { width, height } = getDrawableSize(drawable);
    return Boolean(drawable && width > 0 && height > 0);
}

function drawNaturalImageCentered(img, x, y, maxW, maxH, options = {}) {
    const drawable = getDrawableAsset(img);
    if (!drawable) return false;

    const { width, height } = getDrawableSize(drawable);
    if (!width || !height) return false;

    const scale = Math.min(maxW / width, maxH / height) * (options.scale || 1);
    const drawW = width * scale;
    const drawH = height * scale;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (options.alpha !== undefined) ctx.globalAlpha = options.alpha;
    if (options.shadowColor) {
        ctx.shadowColor = options.shadowColor;
        ctx.shadowBlur = options.shadowBlur || 18;
    }
    ctx.translate(x, y);
    ctx.rotate(options.rotation || 0);
    ctx.scale(options.scaleX || 1, options.scaleY || 1);
    ctx.drawImage(drawable, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
    return true;
}

function getBossRenderProfile() {
    return bossRenderProfiles[Math.min(currentStage, TOTAL_ROUNDS)] || bossRenderProfiles[TOTAL_ROUNDS];
}

function getBossGameplayRadius() {
    if (currentStage === 1) return 56;
    if (currentStage === 2) return 58;
    if (currentStage === 3) return 60;
    if (currentStage === 4) return 64;
    if (currentStage === 5) return 66;
    if (currentStage === 6) return 68;
    if (currentStage === 7) return 70;
    if (currentStage === 8) return 72;
    if (currentStage === 9) return 74;
    return 78;
}

function getBossRenderBox() {
    const profile = getBossRenderProfile();
    return {
        width: Math.min(canvas.width * 0.92, boss.radius * profile.widthMul),
        height: Math.min(canvas.height * 0.42, boss.radius * profile.heightMul)
    };
}

function getBossMotionProfile() {
    const profiles = {
        1: { entrySpeed: 4.8, advanceMul: 0.92, xAmp: 4.5, yAmp: 4.8, rotAmp: 0.042, scaleAmp: 0.012, stomp: 1.15 },
        2: { entrySpeed: 3.6, advanceMul: 0.78, xAmp: 7.5, yAmp: 7.2, rotAmp: 0.026, scaleAmp: 0.018, stomp: 0.62 },
        3: { entrySpeed: 5.5, advanceMul: 0.86, xAmp: 3.2, yAmp: 6.6, rotAmp: 0.02, scaleAmp: 0.01, stomp: 1.55 },
        4: { entrySpeed: 4.1, advanceMul: 0.82, xAmp: 5.6, yAmp: 3.2, rotAmp: 0.016, scaleAmp: 0.014, stomp: 1.0 },
        5: { entrySpeed: 5.0, advanceMul: 0.84, xAmp: 4.0, yAmp: 5.4, rotAmp: 0.038, scaleAmp: 0.012, stomp: 1.28 },
        6: { entrySpeed: 4.4, advanceMul: 0.78, xAmp: 8.0, yAmp: 6.0, rotAmp: 0.05, scaleAmp: 0.015, stomp: 0.86 },
        7: { entrySpeed: 3.4, advanceMul: 0.72, xAmp: 5.2, yAmp: 7.8, rotAmp: 0.022, scaleAmp: 0.02, stomp: 0.72 },
        8: { entrySpeed: 5.7, advanceMul: 0.9, xAmp: 7.4, yAmp: 5.6, rotAmp: 0.032, scaleAmp: 0.013, stomp: 1.35 },
        9: { entrySpeed: 3.8, advanceMul: 0.66, xAmp: 3.0, yAmp: 4.0, rotAmp: 0.014, scaleAmp: 0.022, stomp: 0.58 },
        10: { entrySpeed: 4.0, advanceMul: 0.56, xAmp: 4.6, yAmp: 5.0, rotAmp: 0.02, scaleAmp: 0.018, stomp: 0.7 }
    };
    return profiles[Math.min(currentStage, TOTAL_ROUNDS)] || profiles[TOTAL_ROUNDS];
}

function getBossMarchPose() {
    const profile = getBossMotionProfile();
    const phase = (boss.battleFrame || frameCount) * (0.092 + Math.min(currentStage, TOTAL_ROUNDS) * 0.01) + boss.strideSeed;
    const rawFootfall = Math.abs(Math.sin(phase));
    const footfall = Math.pow(rawFootfall, profile.stomp);
    const entryT = clamp((boss.spawnTargetY - boss.y) / Math.max(1, Math.abs(boss.spawnTargetY - boss.introStartY)), 0, 1);
    const swagger = Math.sin(phase * 0.5);
    const stageStyle = Math.min(currentStage, TOTAL_ROUNDS);

    let x = swagger * profile.xAmp;
    let y = Math.sin(phase) * profile.yAmp;
    let rotation = Math.sin(phase) * profile.rotAmp;

    if (stageStyle === 2) {
        y += Math.sin(phase * 0.32) * 5.5;
        rotation += Math.sin(phase * 0.22) * 0.018;
    } else if (stageStyle === 3) {
        y += footfall * 7.5;
        rotation += Math.sign(Math.sin(phase)) * 0.012;
    } else if (stageStyle === 4) {
        x += Math.sin(phase * 1.35) * 3.2;
        y += Math.sin(phase * 1.7) * 2.2;
    } else if (stageStyle >= 5) {
        y += footfall * 5.8;
        rotation += Math.sin(phase * 0.35) * 0.018;
    }

    x += Math.sin(entryT * Math.PI * 3) * entryT * 18;
    y -= entryT * 18;
    rotation += Math.sin(entryT * Math.PI * 2) * entryT * 0.12;

    return {
        phase,
        x,
        y,
        rotation,
        scaleX: 1 + Math.sin(phase) * profile.scaleAmp + entryT * 0.04,
        scaleY: 1 - footfall * profile.scaleAmp * 1.15 - entryT * 0.025,
        footfall
    };
}

function getBossLaserTuning() {
    const stage = Math.min(currentStage, TOTAL_ROUNDS);
    if (stage === 2) {
        return {
            chargeFrames: 78,
            activeFrames: 26,
            visualWidth: 22,
            lethalWidth: 5,
            commanderPenalty: 0.18,
            shake: 10
        };
    }
    if (stage >= TOTAL_ROUNDS) {
        return {
            chargeFrames: 28,
            activeFrames: 54,
            visualWidth: 64,
            lethalWidth: 18,
            commanderPenalty: 0.68,
            shake: 26
        };
    }
    if (stage >= 5) {
        return {
            chargeFrames: Math.max(34, 56 - stage * 3),
            activeFrames: Math.min(42, 28 + stage * 2),
            visualWidth: Math.min(54, 30 + stage * 4),
            lethalWidth: Math.min(15, 7 + stage * 1.2),
            commanderPenalty: Math.min(0.46, 0.22 + stage * 0.045),
            shake: Math.min(20, 10 + stage * 2)
        };
    }

    return {
        chargeFrames: Math.max(34, 66 - stage * 6),
        activeFrames: Math.max(30, 48 - stage * 2),
        visualWidth: Math.min(46, 23 + stage * 4),
        lethalWidth: Math.min(13, 5 + stage * 1.8),
        commanderPenalty: Math.min(0.36, 0.18 + stage * 0.05),
        shake: Math.min(16, 9 + stage * 2)
    };
}

function getBossHpForStage() {
    const hpByStage = [0, 720, 1050, 1450, 2050, 3100, 4700, 6900, 9800, 14000, 62000];
    return hpByStage[Math.min(currentStage, TOTAL_ROUNDS)] || 62000;
}

function getFinalBossLaserDelay() {
    return 0.42 + Math.random() * 1.05;
}

function shootCommanderWeapon() {
    const dmgScale = 1 + upgradeLevels.fireRate * 0.18;
    const coreDamage = (5.5 + weaponLevel * 1.45) * dmgScale;
    const startY = commander.y - commander.radius * 0.75;

    bullets.push({
        x: commander.x,
        y: startY,
        vx: 0,
        vy: -15.5,
        damage: coreDamage,
        size: 10,
        angle: -Math.PI / 2,
        color: COMMANDER_BULLET_COLOR,
        commander: true
    });

    if (weaponLevel >= 3) {
        bullets.push({
            x: commander.x - 7,
            y: startY + 2,
            vx: -1.2,
            vy: -14.2,
            damage: coreDamage * 0.45,
            size: 7,
            angle: Math.atan2(-14.2, -1.2),
            color: '#67e8f9',
            commander: true
        });
        bullets.push({
            x: commander.x + 7,
            y: startY + 2,
            vx: 1.2,
            vy: -14.2,
            damage: coreDamage * 0.45,
            size: 7,
            angle: Math.atan2(-14.2, 1.2),
            color: '#67e8f9',
            commander: true
        });
    }

    if (weaponLevel >= 5) {
        bullets.push({
            x: commander.x,
            y: startY + 4,
            vx: 0,
            vy: -12.8,
            damage: coreDamage * 0.62,
            size: 8,
            angle: -Math.PI / 2,
            color: '#facc15',
            commander: true
        });
    }

    audio.playLaser();
}

function spawnBossProjectile(angle, speed, options = {}) {
    const radius = (options.radius || 8) * getBossBulletSizeScale();
    const speedScale = getProjectileSpeedScale();
    bossBullets.push({
        x: options.x ?? boss.x,
        y: options.y ?? boss.y + 15,
        vx: Math.cos(angle) * speed * speedScale,
        vy: Math.sin(angle) * speed * speedScale,
        radius,
        hitRadius: Math.max(3.5, radius * 0.68),
        damage: options.damage || 1,
        color: options.color || '#ef4444',
        curve: options.curve || 0,
        accel: options.accel || 1,
        gravity: (options.gravity || 0) * speedScale,
        wave: options.wave || 0,
        wavePhase: options.wavePhase || Math.random() * Math.PI * 2,
        life: options.life || 240,
        trail: []
    });
}

function removeBossBulletDamage(hitIndex, damage, hitColor = '#ff007f') {
    const lossCount = Math.min(army.length, Math.max(1, Math.round(damage || 1)));
    for (let loss = 0; loss < lossCount; loss++) {
        const index = loss === 0 ? Math.min(hitIndex, army.length - 1) : army.length - 1;
        const victim = army[index];
        if (!victim) continue;
        spawnSparks(victim.x, victim.y, hitColor);
        army.splice(index, 1);
    }
    updateArmyLayout();
    return lossCount;
}

function drawBossMarchShadow(box, pose, profile) {
    const footY = boss.y + box.height * 0.42 + pose.footfall * 5;
    const shadowW = Math.min(canvas.width * 0.72, box.width * (0.58 + pose.footfall * 0.08));
    const shadowH = Math.max(12, box.height * 0.08);

    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.beginPath();
    ctx.ellipse(boss.x + pose.x * 0.6, footY, shadowW, shadowH, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.18 + pose.footfall * 0.12;
    ctx.strokeStyle = profile.glow;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(boss.x + pose.x * 0.6, footY, shadowW * 0.88, shadowH * 0.7, 0, 0, Math.PI * 2);
    ctx.stroke();

    if (pose.footfall > 0.86) {
        ctx.globalAlpha = (pose.footfall - 0.86) * 1.6;
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 5; i++) {
            const dx = (i - 2) * shadowW * 0.18;
            ctx.beginPath();
            ctx.moveTo(boss.x + dx, footY);
            ctx.lineTo(boss.x + dx * 1.3, footY + 10 + i % 2 * 5);
            ctx.stroke();
        }
    }
    ctx.restore();
}

function drawBattlefieldBackground() {
    const w = canvas.width;
    const h = canvas.height;

    const base = ctx.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, '#2b2118');
    base.addColorStop(0.46, '#4b341b');
    base.addColorStop(1, '#15100c');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    const roadW = w * 0.72;
    const roadX = (w - roadW) / 2;
    const roadGradient = ctx.createLinearGradient(roadX, 0, roadX + roadW, 0);
    roadGradient.addColorStop(0, '#2c2924');
    roadGradient.addColorStop(0.18, '#3e3a33');
    roadGradient.addColorStop(0.5, '#4d4940');
    roadGradient.addColorStop(0.82, '#38342e');
    roadGradient.addColorStop(1, '#24211d');
    ctx.fillStyle = roadGradient;
    ctx.fillRect(roadX, 0, roadW, h);

    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = '#d6b06a';
    ctx.lineWidth = 2;
    ctx.setLineDash([24, 28]);
    ctx.lineDashOffset = -bgScrollY * 1.25;
    ctx.beginPath();
    ctx.moveTo(w / 2, -20);
    ctx.lineTo(w / 2, h + 20);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.globalAlpha = 0.48;
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.46)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(roadX + 8, 0);
    ctx.lineTo(roadX + 8, h);
    ctx.moveTo(roadX + roadW - 8, 0);
    ctx.lineTo(roadX + roadW - 8, h);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.38;
    for (let y = -96 + bgScrollY; y < h + 96; y += 96) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
        ctx.fillRect(roadX + roadW * 0.15, y + 28, roadW * 0.7, 3);
        ctx.fillStyle = 'rgba(255, 221, 146, 0.04)';
        ctx.fillRect(roadX + roadW * 0.08, y + 54, roadW * 0.84, 2);
    }
    ctx.restore();

    ctx.save();
    for (let i = 0; i < 14; i++) {
        const seed = (i * 73) % 101;
        const side = i % 2 === 0 ? -1 : 1;
        const x = side < 0
            ? roadX * (0.2 + (seed % 50) / 80)
            : roadX + roadW + (w - roadX - roadW) * (0.18 + (seed % 48) / 74);
        const y = ((i * 67 + bgScrollY * (0.7 + (i % 3) * 0.2)) % (h + 120)) - 60;
        const r = 8 + (seed % 18);
        ctx.fillStyle = i % 3 === 0 ? 'rgba(62, 39, 21, 0.42)' : 'rgba(16, 13, 10, 0.34)';
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.5, r * 0.62, (seed / 101) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
        if (i % 4 === 0) {
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.22)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }
    ctx.restore();

    if (gameState === 'BOSS_BATTLE') {
        const alertGlow = ctx.createRadialGradient(w / 2, 0, 0, w / 2, 0, h * 0.8);
        alertGlow.addColorStop(0, 'rgba(239, 68, 68, 0.22)');
        alertGlow.addColorStop(0.62, 'rgba(239, 68, 68, 0.04)');
        alertGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = alertGlow;
        ctx.fillRect(0, 0, w, h);
    }

    const vignette = ctx.createRadialGradient(w / 2, h * 0.48, h * 0.08, w / 2, h * 0.48, h * 0.78);
    vignette.addColorStop(0, 'rgba(255, 255, 255, 0.02)');
    vignette.addColorStop(0.62, 'rgba(0, 0, 0, 0.08)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.48)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
}

// 영구 진행 상황 (localStorage 저장 대상)
let saveGold = 0;
let currentStage = 1;
let upgradeLevels = {
    startUnit: 0,
    fireRate: 0,
    goldGain: 0
};
let bestStage = 0;
let totalCorrect = 0;
let totalWrong = 0;
let maxCombo = 0;

const SAVE_KEY = 'sequence-war-save-v1';

function saveProgress() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
            gold: saveGold,
            stage: currentStage,
            upgrades: upgradeLevels,
            best: bestStage,
            correct: totalCorrect,
            wrong: totalWrong,
            maxCombo: maxCombo
        }));
    } catch (error) {
        // 시크릿 모드 등 저장 불가 환경에서는 그냥 세션 플레이로 진행
    }
}

function loadProgress() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        saveGold = Math.max(0, Math.floor(Number(data.gold) || 0));
        currentStage = clamp(Math.floor(Number(data.stage) || 1), 1, TOTAL_ROUNDS);
        if (data.upgrades) {
            upgradeLevels.startUnit = Math.max(0, Math.floor(Number(data.upgrades.startUnit) || 0));
            upgradeLevels.fireRate = clamp(Math.floor(Number(data.upgrades.fireRate) || 0), 0, 6);
            upgradeLevels.goldGain = Math.max(0, Math.floor(Number(data.upgrades.goldGain) || 0));
        }
        bestStage = clamp(Math.floor(Number(data.best) || 0), 0, TOTAL_ROUNDS);
        totalCorrect = Math.max(0, Math.floor(Number(data.correct) || 0));
        totalWrong = Math.max(0, Math.floor(Number(data.wrong) || 0));
        maxCombo = Math.max(0, Math.floor(Number(data.maxCombo) || 0));
    } catch (error) {
        // 저장 데이터가 깨져 있으면 새 게임으로 시작
    }
}

// Current Stage runtime variables
let gameState = 'MENU'; // MENU, RUNNING, BOSS_WARNING, BOSS_BATTLE, PAUSED, FINISHED
let roadSpeed = 4.75;    
let weaponLevel = 1;
let frameCount = 0;
let shakeTimer = 0;
let comboCount = 0;      // 연속 정답 수
let shieldCharges = 0;   // 보스전에서 피탄 1회를 막아주는 실드

// Background scroll offset for "배경.jpg"
let bgScrollY = 0;

// Leader Commander & Army
const commander = {
    x: 200,
    y: 500, 
    radius: 18, // Adjusted bounding size for 사령관.png
    targetX: 200,
    speed: 0.16 
};

function getCommanderBaseY() {
    return Math.max(canvas.height * 0.62, canvas.height - COMMANDER_BOTTOM_OFFSET);
}

let army = [];
let bullets = [];
let bossBullets = [];
let commanderFireTimer = 0;
let particles = [];
let debrisList = []; // 모래바람 파편

// Active Sequence info
let sequence = {
    type: 'arithmetic',
    d: 2,
    r: 2,
    history: [],
    currentValue: 0,
    targetValue: 0,
    gatePassedCount: 0,
    maxGates: 6 
};

// Boss stats (진격 속도 및 좌표 변경)
const boss = {
    x: 200,
    y: -150, 
    radius: 56,
    hp: 300,
    maxHp: 300,
    speed: 0.45,         // 보스 진격속도
    active: false,
    shieldAngle: 0,
    attackTimer: 0,
    laserCharge: 0,      
    laserActive: 0,   
    laserTargetX: 200,    
    laserSweep: 0,
    beamWidth: 30,
    laserLethalWidth: 6,
    laserCommanderHit: false,
    laserNeedsLayout: false,
    currentPattern: 0,
    nextAttackInterval: 2.6,
    battleFrame: 0,
    introStartY: -220,
    spawnTargetY: 80,
    strideSeed: 0
};

let popupTexts = [];
let activeGates = null; 
let gateCountdownRemainingMs = 0;
let gateCountdownLastTick = 0;
let pendingGateDrop = false;
let isDragging = false;
let bossIntroTimer = null;

function getBossSpawnY() {
    const bossBox = getBossRenderBox();
    const topAnchoredCenter = bossBox.height * 0.48;
    return Math.min(topAnchoredCenter, commander.y - boss.radius - 46);
}

function resetBossState() {
    if (bossIntroTimer) {
        clearTimeout(bossIntroTimer);
        bossIntroTimer = null;
    }
    boss.active = false;
    boss.y = -999;
    boss.hp = boss.maxHp;
    boss.attackTimer = 0;
    boss.laserCharge = 0;
    boss.laserActive = 0;
    boss.laserSweep = 0;
    boss.beamWidth = 30;
    boss.laserLethalWidth = 6;
    boss.laserCommanderHit = false;
    boss.laserNeedsLayout = false;
    boss.currentPattern = 0;
    boss.nextAttackInterval = 2.6;
    boss.battleFrame = 0;
    boss.introStartY = -220;
    boss.spawnTargetY = 80;
    boss.strideSeed = 0;
    bossBullets = [];
}

// 골드 부족 알림 모달
function showAlert() {
    document.getElementById('custom-alert').classList.add('show');
}
document.getElementById('alert-close').addEventListener('click', () => {
    document.getElementById('custom-alert').classList.remove('show');
});

// 진행 초기화 — 새 빌드로 처음부터. 최고 기록/정답률/최다 콤보는 남긴다.
document.getElementById('reset-progress-btn').addEventListener('click', () => {
    document.getElementById('reset-confirm').classList.add('show');
});
document.getElementById('reset-confirm-no').addEventListener('click', () => {
    document.getElementById('reset-confirm').classList.remove('show');
});
document.getElementById('reset-confirm-yes').addEventListener('click', () => {
    saveGold = 0;
    currentStage = 1;
    upgradeLevels = { startUnit: 0, fireRate: 0, goldGain: 0 };
    saveProgress();
    renderShopStats();
    renderStatsPanel();
    updateHud();
    document.getElementById('reset-confirm').classList.remove('show');
    audio.playUpgrade();
});

// 이미지 회전 그리기 헬퍼 함수
function drawRotatedImage(img, x, y, w, h, angle) {
    const drawable = getDrawableAsset(img);
    if (!drawable) return false;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(drawable, -w/2, -h/2, w, h);
    ctx.restore();
    return true;
}

// Responsive resize
function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    commander.y = getCommanderBaseY();
    updateArmyLayout();
}
window.addEventListener('resize', resizeCanvas);
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resizeCanvas);
}
resizeCanvas();

class Soldier {
    constructor(offsetX, offsetY) {
        this.offsetX = offsetX; 
        this.offsetY = offsetY;
        this.x = commander.x + offsetX;
        this.y = commander.y + offsetY;
        this.color = '#84cc16'; 
        this.radius = 12; // Adjusted hit circle for 병사.png
        this.fireTimer = Math.random() * 0.12; 
    }
    update(fireRateLimit) {
        const targetX = commander.x + this.offsetX;
        const targetY = commander.y + this.offsetY;
        this.x += (targetX - this.x) * 0.12;
        this.y += (targetY - this.y) * 0.12;

        // Automatic firing in Boss Battle
        if (gameState === 'BOSS_BATTLE') {
            this.fireTimer += 0.016; 
            if (this.fireTimer >= fireRateLimit) {
                this.fireTimer = 0;
                this.shootWeapon();
            }
        }
    }
    shootWeapon() {
        const dmgScale = 1 + upgradeLevels.fireRate * 0.15;
        audio.playLaser();
        
        // 우리편 총알.png 이미지 장착 사격 물리
        const bulletDmg = 1 * dmgScale;
        if (weaponLevel === 1) {
            bullets.push({
                x: this.x, y: this.y, vx: 0, vy: -11,
                damage: bulletDmg, size: 6, angle: -Math.PI / 2
            });
        } 
        else if (weaponLevel === 2) {
            bullets.push({
                x: this.x - 4, y: this.y, vx: 0, vy: -11.5,
                damage: 0.9 * bulletDmg, size: 5, angle: -Math.PI / 2
            });
            bullets.push({
                x: this.x + 4, y: this.y, vx: 0, vy: -11.5,
                damage: 0.9 * bulletDmg, size: 5, angle: -Math.PI / 2
            });
        } 
        else if (weaponLevel === 3) {
            bullets.push({
                x: this.x, y: this.y, vx: -2, vy: -11,
                damage: 1 * bulletDmg, size: 5.5, angle: Math.atan2(-11, -2)
            });
            bullets.push({
                x: this.x, y: this.y, vx: 0, vy: -12,
                damage: 1.5 * bulletDmg, size: 7, angle: -Math.PI / 2
            });
            bullets.push({
                x: this.x, y: this.y, vx: 2, vy: -11,
                damage: 1 * bulletDmg, size: 5.5, angle: Math.atan2(-11, 2)
            });
        } 
        else if (weaponLevel === 4) {
            bullets.push({
                x: this.x - 3, y: this.y, vx: -2.8, vy: -11.5,
                damage: 1.2 * bulletDmg, size: 6, angle: Math.atan2(-11.5, -2.8)
            });
            bullets.push({
                x: this.x, y: this.y, vx: 0, vy: -13,
                damage: 2.2 * bulletDmg, size: 8, angle: -Math.PI / 2
            });
            bullets.push({
                x: this.x + 3, y: this.y, vx: 2.8, vy: -11.5,
                damage: 1.2 * bulletDmg, size: 6, angle: Math.atan2(-11.5, 2.8)
            });
        } 
        else {
            bullets.push({
                x: this.x, y: this.y, vx: -3.8, vy: -12,
                damage: 1.5 * bulletDmg, size: 7, angle: Math.atan2(-12, -3.8)
            });
            bullets.push({
                x: this.x, y: this.y, vx: 0, vy: -14,
                damage: 3.5 * bulletDmg, size: 10, angle: -Math.PI / 2
            });
            bullets.push({
                x: this.x, y: this.y, vx: 3.5, vy: -12,
                damage: 1.5 * bulletDmg, size: 7, angle: Math.atan2(-12, 3.5)
            });
        }
    }
    // 병사.png 렌더링 (그라데이션 폴백 내장)
    draw() {
        if (isImageReady(imgSoldier)) {
            drawNaturalImageCentered(
                imgSoldier,
                this.x,
                this.y,
                this.radius * 2 * SOLDIER_RENDER_SCALE,
                this.radius * 2 * SOLDIER_RENDER_SCALE,
                { shadowColor: 'rgba(132, 204, 22, 0.55)', shadowBlur: 8 }
            );
        } else {
            // [대규모 보강] 완벽하고 아름다운 사막 위장 지상군 정예 병사 벡터 그래픽 폴백
            ctx.save();
            ctx.translate(this.x, this.y);
            
            // 신체 하체 (안정적인 돌격 보병자세)
            ctx.fillStyle = '#292524';
            ctx.fillRect(-5, 4, 10, 3);
            
            // 흉갑 몸통 (전술 방탄조끼 올리브)
            ctx.fillStyle = '#166534';
            ctx.fillRect(-7, -2, 14, 6);
            
            // 전술 방탄 헬멧
            ctx.fillStyle = '#14532d';
            ctx.strokeStyle = '#84cc16';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, -4, 5.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // 안면 고글
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(-3, -5, 6, 1.5);
            
            // 소지 화포/소총 소체
            ctx.fillStyle = '#334155';
            ctx.fillRect(4, -1, 6, 3);

            ctx.restore();
        }
    }
}

function updateArmyLayout() {
    const currentSize = army.length;
    const maxRow = Math.floor(Math.sqrt(Math.max(0, currentSize - 1)));
    const baseOffsetY = 34;
    const soldierRenderHalf = 12 * SOLDIER_RENDER_SCALE;
    const bottomLimit = canvas.height - soldierRenderHalf - 10;
    const maxOffsetY = Math.max(baseOffsetY + 10, bottomLimit - commander.y);
    const rowSpacing = maxRow > 0
        ? Math.min(22, Math.max(11, (maxOffsetY - baseOffsetY) / maxRow))
        : 22;

    for (let i = 0; i < currentSize; i++) {
        const row = Math.floor(Math.sqrt(i));
        const rowStart = row * row;
        const rowCount = row * 2 + 1;
        const positionInRow = i - rowStart;
        const centeredIndex = positionInRow - (rowCount - 1) / 2;
        const stagger = row % 2 === 0 ? 0 : 10;
        const offX = centeredIndex * 22 + stagger;
        const offY = baseOffsetY + row * rowSpacing + Math.sin(i * 0.9) * 2.4;
        
        army[i].offsetX = offX;
        army[i].offsetY = offY;
    }
}

function addSoldiers(count, options = {}) {
    const currentArmyCount = army.length;
    const showPopup = Boolean(options.showPopup);
    
    if (currentArmyCount >= MAX_ARMY_CAP) {
        convertOverflowSquadReward(showPopup);
        return;
    }

    const spawnCount = Math.min(count, MAX_ARMY_CAP - currentArmyCount);
    for (let i = 0; i < spawnCount; i++) {
        const randX = (Math.random() - 0.5) * 60;
        const randY = 30 + Math.random() * 40;
        army.push(new Soldier(randX, randY));
    }
    updateArmyLayout();

    if (showPopup && spawnCount > 0) {
        spawnPopupText(commander.x, commander.y - 52, `SQUAD +${spawnCount}`, '#39ff14', 'reward');
    }
    if (count > spawnCount) {
        convertOverflowSquadReward(showPopup);
    }
}

function convertOverflowSquadReward(showPopup = true) {
    if (weaponLevel < 5) {
        weaponLevel = Math.min(weaponLevel + 1, 5);
        if (showPopup) {
            spawnPopupText(commander.x, commander.y - 78, `SQUAD FULL! WEAPON UP LV.${weaponLevel}`, '#00f0ff', 'reward');
        }
        audio.playUpgrade();
    } else {
        // 병력도 무기도 꽉 찼으면 보스전용 실드로 전환
        shieldCharges++;
        if (showPopup) {
            spawnPopupText(commander.x, commander.y - 78, `SQUAD FULL! SHIELD +1`, '#22d3ee', 'reward');
        }
    }
    updateHud();
}

function removeSoldiers(proportion) {
    const removeCount = Math.floor(army.length * proportion);
    if (removeCount > 0) {
        for (let i = 0; i < removeCount; i++) {
            const victim = army[army.length - 1 - i];
            if (victim) {
                spawnSparks(victim.x, victim.y, '#ff007f');
            }
        }
        army.splice(army.length - removeCount, removeCount);
        updateArmyLayout();
        triggerScreenShake(12);
    }
}

function triggerScreenShake(duration) {
    shakeTimer = duration;
    document.getElementById('game-container').classList.add('shake-screen');
}

function setSequenceWindow(seq, values, targetValue) {
    seq.history = values;
    seq.currentValue = values[values.length - 1];
    seq.targetValue = targetValue;
}

// 다음 항 계산 (기본 3종 수열 전용 — 가운데 항 가리기 표시에 사용)
function nextTermOf(seq, value) {
    if (seq.type === 'geometric') return value * seq.r;
    if (seq.type === 'subtraction') return Math.max(0, value - seq.d);
    return value + seq.d;
}

function generateSequenceForStage() {
    const maxGatesCount = 5 + Math.min(currentStage, 5);
    // 3스테이지부터는 규칙의 상세 파라미터(공차/공비)를 숨겨 직접 추론하게 한다
    const hideParams = currentStage >= 3;
    const seq = { gatePassedCount: 0, maxGates: maxGatesCount, displayMode: 'next' };

    const typePool = ['arithmetic', 'arithmetic', 'geometric', 'subtraction'];
    if (currentStage >= 4) typePool.push('stepped', 'stepped');
    if (currentStage >= 6) typePool.push('fibonacci', 'fibonacci');
    seq.type = typePool[Math.floor(Math.random() * typePool.length)];

    if (seq.type === 'arithmetic') {
        const possibleDiffs = currentStage >= 5 ? [2, 3, 4, 5, 6, 7, 8, 9] : [2, 3, 4, 5, 6];
        seq.d = possibleDiffs[Math.floor(Math.random() * possibleDiffs.length)];
        const start = Math.floor(Math.random() * (5 + Math.min(currentStage, 5))) + 1;
        setSequenceWindow(seq, [start, start + seq.d, start + seq.d * 2], start + seq.d * 3);
        seq.ruleDescription = hideParams ? '등차수열' : `등차수열 (공차 +${seq.d})`;
    }
    else if (seq.type === 'geometric') {
        const possibleRatios = currentStage >= 6 ? [2, 2, 3, 4] : [2, 2, 3];
        seq.r = possibleRatios[Math.floor(Math.random() * possibleRatios.length)];
        let start = Math.floor(Math.random() * (currentStage >= 5 ? 3 : 2)) + 1;
        // 스테이지 후반에 숫자가 수만 단위로 폭주하지 않도록 최종 항을 제한
        while (start * Math.pow(seq.r, maxGatesCount + 1) > 5000 && (seq.r > 2 || start > 1)) {
            if (start > 1) start--;
            else seq.r--;
        }
        setSequenceWindow(seq, [start, start * seq.r, start * seq.r * seq.r], start * seq.r * seq.r * seq.r);
        seq.ruleDescription = hideParams ? '등비수열' : `등비수열 (공비 ×${seq.r})`;
    }
    else if (seq.type === 'subtraction') {
        const possibleDiffs = currentStage >= 5 ? [2, 3, 4, 5, 6, 7] : [2, 3, 4, 5];
        seq.d = possibleDiffs[Math.floor(Math.random() * possibleDiffs.length)];
        const start = seq.d * (maxGatesCount + 4) + Math.floor(Math.random() * 4) * seq.d;
        setSequenceWindow(seq, [start, start - seq.d, start - seq.d * 2], start - seq.d * 3);
        seq.ruleDescription = hideParams ? '등차수열' : `등차수열 (공차 -${seq.d})`;
    }
    else if (seq.type === 'stepped') {
        // 계차수열: 항 사이의 차이가 매번 inc만큼 커진다
        const firstDiff = 2 + Math.floor(Math.random() * 3);
        seq.inc = 1 + Math.floor(Math.random() * 2);
        const start = 1 + Math.floor(Math.random() * 5);
        const v2 = start + firstDiff;
        const v3 = v2 + firstDiff + seq.inc;
        seq.d = firstDiff + seq.inc * 2; // targetValue를 만들 차이값
        setSequenceWindow(seq, [start, v2, v3], v3 + seq.d);
        seq.ruleDescription = '계차수열 (차이가 점점 커짐)';
    }
    else {
        // 피보나치형: 앞 두 항의 합
        const a = 1 + Math.floor(Math.random() * 3);
        const b = a + Math.floor(Math.random() * 3);
        setSequenceWindow(seq, [a, b, a + b], b + (a + b));
        seq.ruleDescription = '피보나치 (앞 두 항의 합)';
    }

    sequence = seq;
    updateHud();
}

function advanceSequence() {
    const seq = sequence;
    seq.history.push(seq.targetValue);
    if (seq.history.length > 3) seq.history.shift();

    seq.currentValue = seq.targetValue;
    if (seq.type === 'arithmetic') {
        seq.targetValue = seq.currentValue + seq.d;
    } else if (seq.type === 'geometric') {
        seq.targetValue = seq.currentValue * seq.r;
    } else if (seq.type === 'subtraction') {
        seq.targetValue = Math.max(0, seq.currentValue - seq.d);
    } else if (seq.type === 'stepped') {
        seq.d += seq.inc;
        seq.targetValue = seq.currentValue + seq.d;
    } else {
        // fibonacci: history의 마지막 두 항의 합
        const len = seq.history.length;
        seq.targetValue = seq.history[len - 1] + seq.history[len - 2];
    }

    seq.displayMode = 'next';
    seq.gatePassedCount++;
    updateHud();
}

function setBadgeVisible(displayId, sepId, visible, text) {
    const display = document.getElementById(displayId);
    const sep = document.getElementById(sepId);
    if (visible) {
        display.innerText = text;
        display.classList.remove('hidden');
        sep.classList.remove('hidden');
    } else {
        display.classList.add('hidden');
        sep.classList.add('hidden');
    }
}

function updateHud() {
    document.getElementById('seq-rule').innerText = sequence.ruleDescription || '수열 규칙';
    const historyText = sequence.displayMode === 'mid'
        ? `${sequence.currentValue} → ? → ${sequence.midC}`
        : sequence.history.join(' → ') + ' → ?';
    document.getElementById('seq-history').innerText = historyText;

    setBadgeVisible('combo-display', 'combo-sep', comboCount >= 2, `COMBO x${comboCount}`);
    setBadgeVisible('shield-display', 'shield-sep', shieldCharges > 0, `SHIELD x${shieldCharges}`);

    document.getElementById('gold-display').innerText = `${saveGold.toLocaleString('ko-KR')} G`;
    const progressRatio = Math.min(1, sequence.gatePassedCount / sequence.maxGates);
    document.getElementById('progress-bar').style.width = `${progressRatio * 100}%`;
    document.getElementById('army-size-text').innerText = `ARMY: ${army.length}`;
    document.getElementById('weapon-lvl-display').innerText = `WEAPON: LV.${weaponLevel}`;
    document.getElementById('current-stage-num').innerText = currentStage;
    document.getElementById('shop-gold').innerText = `${saveGold.toLocaleString('ko-KR')} G`;
}

// --- MULTI-CHOICE GATES CREATION ---
// 미끼는 "계산을 실수했을 때 나오는 값" 위주로 만든다.
// 정답±1처럼 홀짝만 봐도 걸러지는 값은 쓰지 않는다.
function createDecoyValues(seq, count) {
    const target = seq.targetValue;
    const used = new Set([target, ...(seq.history || [])]);
    if (seq.displayMode === 'mid' && seq.midC) used.add(seq.midC); // 화면에 보이는 값 제외
    const candidates = [];

    if (seq.type === 'arithmetic') {
        candidates.push(target + seq.d, target - seq.d, target + 2, target - 2, target + seq.d * 2);
    } else if (seq.type === 'subtraction') {
        candidates.push(target - seq.d, target + seq.d, target + 2, target - 2, target - seq.d * 2);
    } else if (seq.type === 'geometric') {
        candidates.push(
            seq.currentValue * (seq.r + 1),
            seq.currentValue * (seq.r - 1),
            target + seq.r, target - seq.r,
            target + 2, target - 2
        );
    } else if (seq.type === 'stepped') {
        candidates.push(
            seq.currentValue + (seq.d - seq.inc), // 차이가 커지는 걸 잊었을 때
            seq.currentValue + (seq.d + seq.inc),
            target + 2, target - 2
        );
    } else {
        // fibonacci
        candidates.push(seq.currentValue * 2, target + 2, target - 2, seq.currentValue + 2);
    }

    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const decoys = [];
    for (const candidate of candidates) {
        if (decoys.length >= count) break;
        if (!Number.isInteger(candidate) || candidate < 0 || used.has(candidate)) continue;
        used.add(candidate);
        decoys.push(candidate);
    }

    // 후보가 모자라면 정답과 홀짝이 같은 값으로 채운다
    let offset = 4;
    while (decoys.length < count) {
        for (const candidate of [target + offset, target - offset]) {
            if (decoys.length >= count) break;
            if (candidate >= 0 && !used.has(candidate)) {
                used.add(candidate);
                decoys.push(candidate);
            }
        }
        offset += 2;
    }

    return decoys;
}

// 계차/피보나치는 계산량이 많아 관문을 조금 천천히 내린다
function getGateFallMultiplier() {
    return (sequence.type === 'stepped' || sequence.type === 'fibonacci') ? 0.85 : 1;
}

function pickGateAtCommander() {
    const laneCount = activeGates.lanes.length;
    const laneW = canvas.width / laneCount;
    const chosenLaneIdx = Math.max(0, Math.min(laneCount - 1, Math.floor(commander.x / laneW)));
    return activeGates.lanes[chosenLaneIdx];
}

// 정답/오답 공통 처리 (콤보, 통계, 정답 공개)
function handleCorrectAnswer() {
    audio.playGateCorrect();
    spawnSparks(commander.x, commander.y, '#39ff14');
    totalCorrect++;
    comboCount++;
    if (comboCount > maxCombo) maxCombo = comboCount;
    if (comboCount >= 2) {
        const comboGold = comboCount * 3;
        saveGold += comboGold;
        spawnPopupText(commander.x, commander.y - 88, `COMBO x${comboCount}  +${comboGold}G`, '#facc15', 'reward');
    }
}

function handleWrongAnswer(correctAnswer) {
    audio.playGateWrong();
    spawnSparks(commander.x, commander.y, '#ff007f');
    totalWrong++;
    comboCount = 0;
    // 틀린 이유를 배울 수 있게 정답을 보여준다
    spawnPopupText(canvas.width / 2, commander.y - 132, `정답: ${correctAnswer}`, '#fbbf24', 'info');
}

function spawnGates() {
    const seq = sequence;
    // 3스테이지부터는 일부 관문에서 "가운데 항"을 가린다 (정답 자체는 동일)
    const midC = nextTermOf(seq, seq.targetValue);
    const canUseMid = currentStage >= 3
        && (seq.type === 'arithmetic' || seq.type === 'geometric' || seq.type === 'subtraction')
        && midC > 0;
    seq.displayMode = canUseMid && Math.random() < 0.35 ? 'mid' : 'next';
    seq.midC = midC;
    updateHud();

    const target = seq.targetValue;
    const lanesCount = currentStage >= 3 ? 3 : 2;
    const lanes = createDecoyValues(seq, lanesCount - 1).map(decoy => ({
        value: decoy,
        isCorrect: false,
        effect: getRandomGateEffect(false)
    }));

    const correctGate = {
        value: target,
        isCorrect: true,
        effect: getRandomGateEffect(true)
    };
    const correctIndex = Math.floor(Math.random() * lanesCount);
    lanes.splice(correctIndex, 0, correctGate);

    activeGates = {
        y: -100,
        passed: false,
        lanes: lanes
    };
}

function hideGateCountdown() {
    const banner = document.getElementById('gate-countdown-banner');
    banner.classList.remove('scale-100');
    banner.classList.add('scale-0');
}

function updateGateCountdownBanner() {
    const banner = document.getElementById('gate-countdown-banner');
    const label = document.getElementById('gate-countdown-label');
    const problem = document.getElementById('gate-countdown-problem');
    const text = document.getElementById('gate-countdown-text');
    if (!pendingGateDrop || gateCountdownRemainingMs <= 0) {
        hideGateCountdown();
        return;
    }

    const readMs = gateCountdownRemainingMs - GATE_COUNTDOWN_STEP_MS * 3;
    const ruleText = sequence.ruleDescription || '규칙을 확인하세요';

    problem.innerText = ruleText;
    if (readMs > 0) {
        label.innerText = '규칙 확인';
        problem.classList.remove('hidden');
        text.classList.add('hidden');
    } else {
        label.innerText = '곧 시작';
        problem.classList.add('hidden');
        text.innerText = Math.max(1, Math.ceil(gateCountdownRemainingMs / GATE_COUNTDOWN_STEP_MS));
        text.classList.remove('hidden');
    }

    banner.classList.remove('scale-0');
    banner.classList.add('scale-100');
}

function scheduleGateDrop(withStagePreview = false) {
    activeGates = null;
    pendingGateDrop = false;
    gateCountdownRemainingMs = 0;
    gateCountdownLastTick = 0;

    if (!withStagePreview) {
        hideGateCountdown();
        spawnGates();
        return;
    }

    pendingGateDrop = true;
    gateCountdownRemainingMs = GATE_COUNTDOWN_TOTAL_MS;
    gateCountdownLastTick = performance.now();
    updateGateCountdownBanner();
}

function getRandomGateEffect(isCorrect) {
    if (isCorrect) {
        const currentArmyCount = army.length;
        const rand = Math.random();

        // 병력과 무기가 전부 만렙이어도 정답 보상이 남아 있도록 실드를 준다
        if (currentArmyCount >= MAX_ARMY_CAP && weaponLevel >= 5) {
            return { type: 'SHIELD', value: 1 };
        }
        if (currentArmyCount >= MAX_ARMY_CAP) {
            return { type: 'WEAPON_UP', value: 1 };
        }
        else if (currentArmyCount >= ARMY_WEAPON_BIAS_THRESHOLD) {
            if (rand < 0.86) {
                return { type: 'WEAPON_UP', value: 1 };
            } else {
                return { type: 'SQUAD_ADD', value: Math.floor(Math.random() * 3) + 2 };
            }
        }
        else {
            if (rand < 0.40) {
                const val = Math.min(25, Math.floor(sequence.targetValue * 0.5) + 4);
                return { type: 'SQUAD_ADD', value: val };
            } else if (rand < 0.75) {
                return { type: 'WEAPON_UP', value: 1 };
            } else {
                return { type: 'SQUAD_MULTIPLY', value: 1.3 };
            }
        }
    }
    return Math.random() < 0.6
        ? { type: 'SQUAD_SUB', value: 0.4 }
        : { type: 'WEAPON_DOWN', value: 1 };
}

function spawnSparks(x, y, color) {
    for (let i = 0; i < 12; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            radius: Math.random() * 2 + 1.5,
            color: color,
            alpha: 1,
            decay: Math.random() * 0.03 + 0.01
        });
    }
}

function spawnPopupText(x, y, text, color, kind = 'neutral') {
    // kind: neutral / reward / penalty / info(정답 공개 등 오래 보여줄 안내)
    popupTexts.push({
        x: x,
        y: y,
        text: text,
        color: color,
        kind: kind,
        alpha: 1,
        vy: kind === 'penalty' ? -1.1 : kind === 'info' ? -0.7 : -1.35,
        life: kind === 'neutral' ? 48 : kind === 'info' ? 96 : 66
    });
}

// 라운드별 각기 다른 고유형 보스 이미지 선택 도우미
function getCurrentBossImage() {
    const bossIndex = Math.min(currentStage - 1, imgBossStages.length - 1);
    return imgBossStages[bossIndex];
}

function triggerBossBattle() {
    gameState = 'BOSS_WARNING';
    audio.playExplode();
    pendingGateDrop = false;
    gateCountdownRemainingMs = 0;
    gateCountdownLastTick = 0;
    hideGateCountdown();
    activeGates = null;
    document.getElementById('hud-sequence-section').classList.add('hidden');

    const banner = document.getElementById('boss-warning-banner');
    banner.classList.remove('scale-0');
    banner.classList.add('scale-100');
    
    bossIntroTimer = setTimeout(() => {
        bossIntroTimer = null;
        if (gameState !== 'BOSS_WARNING') return;
        banner.classList.remove('scale-100');
        banner.classList.add('scale-0');
        
        gameState = 'BOSS_BATTLE';
        boss.active = true;
        const isFinalBoss = currentStage >= TOTAL_ROUNDS;
        boss.hp = getBossHpForStage(); 
        boss.maxHp = boss.hp;
        boss.x = canvas.width / 2;
        boss.radius = getBossGameplayRadius();
        
        const motionProfile = getBossMotionProfile();
        boss.speed = (0.52 + currentStage * 0.078) * motionProfile.advanceMul;
        if (isFinalBoss) {
            boss.speed *= 0.48;
        }

        boss.attackTimer = 0;
        boss.laserCharge = 0;
        boss.laserActive = 0;
        boss.laserSweep = 0;
        boss.beamWidth = 30;
        boss.laserLethalWidth = 6;
        boss.laserCommanderHit = false;
        boss.laserNeedsLayout = false;
        boss.currentPattern = isFinalBoss ? -1 : 0;
        boss.nextAttackInterval = isFinalBoss ? getFinalBossLaserDelay() : 2.6;
        boss.battleFrame = 0;
        boss.strideSeed = Math.random() * Math.PI * 2;

        document.getElementById('hud-boss-section').classList.remove('hidden');
        updateBossHpBar();
        boss.spawnTargetY = getBossSpawnY();
        boss.introStartY = -Math.max(160, getBossRenderBox().height * 0.42);
        boss.y = boss.introStartY;
    }, 2000);
}

function updateBossHpBar() {
    const ratio = Math.max(0, boss.hp / boss.maxHp);
    document.getElementById('boss-hp-bar-fill').style.width = `${ratio * 100}%`;
    document.getElementById('boss-hp-text').innerText = `HP: ${Math.max(0, Math.floor(boss.hp))} / ${boss.maxHp}`;
}

function returnToMenuFromResult() {
    document.getElementById('result-screen').classList.add('hidden');
    document.getElementById('menu-screen').classList.remove('hidden');
    gameState = 'MENU';
    updateHud();
    renderShopStats();
    renderStatsPanel();
}

function endStage(won) {
    if (gameState === 'FINISHED') return;
    gameState = 'FINISHED';
    resetBossState();

    document.getElementById('hud').classList.add('opacity-0');
    document.getElementById('game-container').classList.remove('shake-screen');
    document.getElementById('hud-boss-section').classList.add('hidden');

    const scr = document.getElementById('result-screen');
    const iconCont = document.getElementById('result-icon-container');
    const title = document.getElementById('result-title');
    const desc = document.getElementById('result-desc');
    const actionBtn = document.getElementById('result-action-btn');

    if (won) {
        scr.classList.add('result-victory');
        scr.classList.remove('result-defeat');
        actionBtn.dataset.action = 'menu';
        const clearedStage = currentStage;
        const isFinalStageVictory = clearedStage >= TOTAL_ROUNDS;
        const baseReward = 100 + currentStage * 40;
        const armyBonus = Math.floor(army.length * 1.8);
        const goldMultiplier = 1 + upgradeLevels.goldGain * 0.25;
        const earnedGold = Math.floor((baseReward + armyBonus) * goldMultiplier);

        saveGold += earnedGold;
        bestStage = Math.max(bestStage, clearedStage);

        if (isFinalStageVictory) {
            // 엔딩: 업그레이드와 골드는 유지한 채 1스테이지부터 다시
            currentStage = 1;
            iconCont.innerText = '👑';
            iconCont.className = 'result-icon bounce';
            title.innerText = 'ALL CLEAR';
            title.className = 'result-title gold';
            desc.innerText = `${TOTAL_ROUNDS}개 스테이지를 모두 클리어했습니다! 업그레이드를 유지한 채 처음부터 다시 도전할 수 있습니다.`;
            actionBtn.innerText = '메뉴로';
        } else {
            currentStage++;
            iconCont.innerText = '🏆';
            iconCont.className = 'result-icon bounce';
            title.innerText = 'VICTORY';
            title.className = 'result-title green';
            desc.innerText = '보스 격파! 다음 스테이지가 열렸습니다.';
            actionBtn.innerText = '다음 스테이지';
        }

        document.getElementById('reward-gold').innerText = `+${earnedGold.toLocaleString('ko-KR')} G`;
        document.getElementById('final-army-size').innerText = `${army.length}명`;
    } else {
        scr.classList.add('result-defeat');
        scr.classList.remove('result-victory');
        actionBtn.dataset.action = 'retry';
        iconCont.innerText = '💀';
        iconCont.className = 'result-icon pulse';
        title.innerText = 'DEFEAT';
        title.className = 'result-title red';
        desc.innerText = '부대가 전멸했습니다. 골드와 업그레이드는 그대로니 다시 도전하세요.';
        document.getElementById('reward-gold').innerText = '+0 G';
        document.getElementById('final-army-size').innerText = '0명';
        actionBtn.innerText = '다시 도전';
    }

    saveProgress();
    updateHud();
    scr.classList.remove('hidden');
}

function renderShopStats() {
    const currentUnits = 5 + upgradeLevels.startUnit * 3;
    const costUnits = 100 + upgradeLevels.startUnit * 60;
    document.getElementById('desc-start-unit').innerText = `시작 병력: ${currentUnits}명`;
    document.getElementById('cost-start-unit').innerText = `${costUnits} G`;

    const rawRate = 0.45 - upgradeLevels.fireRate * 0.05;
    const costFire = 150 + upgradeLevels.fireRate * 100;
    document.getElementById('desc-fire-rate').innerText = `발사 간격: ${rawRate.toFixed(2)}초`;
    document.getElementById('cost-fire-rate').innerText = `${costFire} G`;

    const goldMult = 1 + upgradeLevels.goldGain * 0.25;
    const costGold = 200 + upgradeLevels.goldGain * 120;
    document.getElementById('desc-gold-gain').innerText = `획득 배율: x${goldMult.toFixed(2)}`;
    document.getElementById('cost-gold-gain').innerText = `${costGold} G`;

    document.getElementById('shop-gold').innerText = `${saveGold.toLocaleString('ko-KR')} G`;
}

function renderStatsPanel() {
    document.getElementById('stat-best').innerText = bestStage > 0 ? `Stage ${bestStage}` : '-';
    const totalAnswers = totalCorrect + totalWrong;
    document.getElementById('stat-acc').innerText = totalAnswers > 0
        ? `${Math.round((totalCorrect / totalAnswers) * 100)}%`
        : '-';
    document.getElementById('stat-combo').innerText = maxCombo >= 2 ? `x${maxCombo}` : '-';
}

document.getElementById('up-start-unit').addEventListener('click', () => {
    const cost = 100 + upgradeLevels.startUnit * 60;
    if (saveGold >= cost) {
        saveGold -= cost;
        upgradeLevels.startUnit++;
        audio.playUpgrade();
        saveProgress();
        renderShopStats();
        updateHud();
    } else {
        showAlert();
    }
});

document.getElementById('up-fire-rate').addEventListener('click', () => {
    if (upgradeLevels.fireRate >= 6) {
        spawnPopupText(180, 400, "MAX LEVEL", "#ff007f");
        return;
    }
    const cost = 150 + upgradeLevels.fireRate * 100;
    if (saveGold >= cost) {
        saveGold -= cost;
        upgradeLevels.fireRate++;
        audio.playUpgrade();
        saveProgress();
        renderShopStats();
        updateHud();
    } else {
        showAlert();
    }
});

document.getElementById('up-gold-gain').addEventListener('click', () => {
    const cost = 200 + upgradeLevels.goldGain * 120;
    if (saveGold >= cost) {
        saveGold -= cost;
        upgradeLevels.goldGain++;
        audio.playUpgrade();
        saveProgress();
        renderShopStats();
        updateHud();
    } else {
        showAlert();
    }
});

function startStageRuntime() {
    audio.init();

    gameState = 'RUNNING';
    bullets = [];
    bossBullets = [];
    commanderFireTimer = 0;
    particles = [];
    popupTexts = [];
    activeGates = null;
    pendingGateDrop = false;
    gateCountdownRemainingMs = 0;
    gateCountdownLastTick = 0;
    hideGateCountdown();
    isDragging = false;
    weaponLevel = 1;
    shakeTimer = 0;
    comboCount = 0;
    shieldCharges = 0;
    // 스테이지가 오를수록 관문이 조금씩 빨리 내려온다
    roadSpeed = 4.6 + currentStage * 0.14;
    pausedFromState = null;
    setPauseIcon(false);
    resetBossState();

    document.getElementById('hud-sequence-section').classList.remove('hidden');
    document.getElementById('hud-boss-section').classList.add('hidden');
    document.getElementById('game-container').classList.remove('shake-screen');
    document.getElementById('boss-warning-banner').classList.remove('scale-100');
    document.getElementById('boss-warning-banner').classList.add('scale-0');
    
    const startUnitCount = 5 + upgradeLevels.startUnit * 3;
    army = [];
    commander.x = canvas.width / 2;
    commander.targetX = canvas.width / 2;
    commander.y = getCommanderBaseY(); 
    addSoldiers(startUnitCount);

    generateSequenceForStage();
    scheduleGateDrop(true);

    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('result-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('opacity-0');
}

function canControlCommander() {
    return gameState === 'RUNNING' || gameState === 'BOSS_WARNING' || gameState === 'BOSS_BATTLE';
}

function setCommanderTargetX(nextX) {
    const padding = commander.radius + 10;
    commander.targetX = clamp(nextX, padding, canvas.width - padding);
}

function setCommanderTargetFromClientX(clientX) {
    const rect = canvas.getBoundingClientRect();
    const ratio = canvas.width / rect.width;
    setCommanderTargetX((clientX - rect.left) * ratio);
}

canvas.style.touchAction = 'none';
canvas.addEventListener('pointerdown', (event) => {
    if (!canControlCommander()) return;
    isDragging = true;
    canvas.setPointerCapture(event.pointerId);
    setCommanderTargetFromClientX(event.clientX);
    event.preventDefault();
});

canvas.addEventListener('pointermove', (event) => {
    if (!isDragging || !canControlCommander()) return;
    setCommanderTargetFromClientX(event.clientX);
    event.preventDefault();
});

canvas.addEventListener('pointerup', (event) => {
    isDragging = false;
    if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
    }
});

canvas.addEventListener('pointercancel', () => {
    isDragging = false;
});

window.addEventListener('keydown', (event) => {
    if (!canControlCommander()) return;
    const keyStep = canvas.width * 0.18;
    if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        setCommanderTargetX(commander.targetX - keyStep);
        event.preventDefault();
    } else if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        setCommanderTargetX(commander.targetX + keyStep);
        event.preventDefault();
    }
});

// 일시정지: RUNNING / BOSS_BATTLE 중에만 동작
let pausedFromState = null;
const pauseBtn = document.getElementById('hud-pause');

const PAUSE_ICON_SVG = '<svg viewBox="0 0 16 16" width="12" height="12"><rect x="3" y="2" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="currentColor"/></svg>';
const PLAY_ICON_SVG = '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M4.5 2.8 13 8l-8.5 5.2z" fill="currentColor"/></svg>';

function setPauseIcon(paused) {
    pauseBtn.innerHTML = paused ? PLAY_ICON_SVG : PAUSE_ICON_SVG;
}

pauseBtn.addEventListener('click', () => {
    if (gameState === 'PAUSED') {
        gameState = pausedFromState || 'RUNNING';
        pausedFromState = null;
        gateCountdownLastTick = performance.now(); // 정지한 시간만큼 카운트다운이 튀지 않게 보정
        setPauseIcon(false);
    } else if (gameState === 'RUNNING' || gameState === 'BOSS_BATTLE') {
        pausedFromState = gameState;
        gameState = 'PAUSED';
        shakeTimer = 0;
        document.getElementById('game-container').classList.remove('shake-screen');
        setPauseIcon(true);
    }
});

document.getElementById('start-btn').addEventListener('click', startStageRuntime);
document.getElementById('result-action-btn').addEventListener('click', () => {
    const action = document.getElementById('result-action-btn').dataset.action;
    if (action === 'retry') {
        startStageRuntime();
    } else {
        returnToMenuFromResult();
    }
});
document.getElementById('result-menu-btn').addEventListener('click', () => {
    returnToMenuFromResult();
});

function update() {
    if (gameState === 'MENU' || gameState === 'PAUSED' || gameState === 'FINISHED') return;

    // 시뮬레이션 프레임 카운트와 배경 이동은 여기(고정 60Hz)에서만 진행한다
    frameCount++;
    const bgScrollSpeed = gameState === 'RUNNING'
        ? roadSpeed * getPlayfieldSpeedScale()
        : (gameState === 'BOSS_BATTLE' ? 1.15 * getBossTravelSpeedScale() : 0.42);
    bgScrollY = (bgScrollY + bgScrollSpeed) % 96;
    debrisList.forEach(star => {
        star.x -= star.speed * (roadSpeed / 6);
        if (star.x < 0) {
            star.x = canvas.width;
            star.y = Math.random() * canvas.height;
        }
    });

    if (shakeTimer > 0) {
        shakeTimer--;
        if (shakeTimer <= 0) {
            document.getElementById('game-container').classList.remove('shake-screen');
        }
    }

    // 1. Commander Smooth Move
    commander.x += (commander.targetX - commander.x) * commander.speed;

    // 2. Soldiers Follow Commander
    const mobileFireIntervalScale = getMobileFireIntervalScale();
    const fireRateLimit = (0.45 - upgradeLevels.fireRate * 0.05) * mobileFireIntervalScale;
    army.forEach(soldier => {
        soldier.update(fireRateLimit);
    });
    if (gameState === 'BOSS_BATTLE' && boss.active) {
        const commanderFireScale = 1 + (mobileFireIntervalScale - 1) * 0.45;
        const commanderFireLimit = Math.max(0.18, COMMANDER_FIRE_BASE_RATE - upgradeLevels.fireRate * 0.025) * commanderFireScale;
        commanderFireTimer += 0.016;
        if (commanderFireTimer >= commanderFireLimit) {
            commanderFireTimer = 0;
            shootCommanderWeapon();
        }
    } else {
        commanderFireTimer = 0;
    }

    // 3. RUNNING PHASE (이지선다 관문 통과)
    if (gameState === 'RUNNING') {
        if (pendingGateDrop) {
            const now = performance.now();
            const elapsedMs = Math.min(250, now - gateCountdownLastTick);
            gateCountdownLastTick = now;
            gateCountdownRemainingMs -= elapsedMs;

            if (gateCountdownRemainingMs <= 0) {
                pendingGateDrop = false;
                gateCountdownRemainingMs = 0;
                gateCountdownLastTick = 0;
                hideGateCountdown();
                spawnGates();
            } else {
                updateGateCountdownBanner();
            }
        }

        if (activeGates) {
            activeGates.y += roadSpeed * getPlayfieldSpeedScale() * getGateFallMultiplier();

            if (!activeGates.passed && activeGates.y >= commander.y - 15) {
                activeGates.passed = true;
                const chosenGate = pickGateAtCommander();
                const correctAnswer = sequence.targetValue;

                if (chosenGate.isCorrect) {
                    handleCorrectAnswer();

                    if (chosenGate.effect.type === 'SQUAD_ADD') {
                        addSoldiers(chosenGate.effect.value, { showPopup: true });
                    }
                    else if (chosenGate.effect.type === 'WEAPON_UP') {
                        weaponLevel = Math.min(weaponLevel + 1, 5);
                        spawnPopupText(commander.x, commander.y - 54, `WEAPON UP LV.${weaponLevel}`, '#00f0ff', 'reward');
                    }
                    else if (chosenGate.effect.type === 'SQUAD_MULTIPLY') {
                        const addCount = Math.floor(army.length * (chosenGate.effect.value - 1));
                        addSoldiers(addCount, { showPopup: true });
                    }
                    else if (chosenGate.effect.type === 'SHIELD') {
                        shieldCharges++;
                        spawnPopupText(commander.x, commander.y - 54, `SHIELD +1`, '#22d3ee', 'reward');
                    }

                    advanceSequence();

                    if (sequence.gatePassedCount >= sequence.maxGates) {
                        activeGates = null;
                        triggerBossBattle();
                    } else {
                        scheduleGateDrop();
                    }
                } else {
                    handleWrongAnswer(correctAnswer);

                    if (chosenGate.effect.type === 'SQUAD_SUB') {
                        const beforeSize = army.length;
                        removeSoldiers(0.5);
                        const lost = beforeSize - army.length;
                        spawnPopupText(commander.x, commander.y - 54, `SQUAD -${lost}`, '#ff335f', 'penalty');
                    } else {
                        weaponLevel = Math.max(weaponLevel - 1, 1);
                        spawnPopupText(commander.x, commander.y - 54, `WEAPON DOWN LV.${weaponLevel}`, '#ff335f', 'penalty');
                    }

                    advanceSequence();

                    if (army.length <= 0) {
                        endStage(false);
                    } else if (sequence.gatePassedCount >= sequence.maxGates) {
                        activeGates = null;
                        triggerBossBattle();
                    } else {
                        scheduleGateDrop();
                    }
                }
            }

            if (activeGates && activeGates.y > canvas.height + 50) {
                scheduleGateDrop();
            }
        }
    }

    // 4. BOSS BATTLE PHASE (보스가 아래로 성큼성큼 걸어서 전진하는 기믹 전술 개편)
    if (gameState === 'BOSS_BATTLE') {
        boss.battleFrame++;
        const motionProfile = getBossMotionProfile();
        if (boss.y < boss.spawnTargetY) {
            const entryStep = motionProfile.entrySpeed * getBossTravelSpeedScale();
            boss.y += Math.min(entryStep, boss.spawnTargetY - boss.y);
        } else {
            boss.y += boss.speed * getBossTravelSpeedScale();
        }

        // 패배 메커니즘: 보스가 아군 사령관 방어선(Y 좌표)을 통과하는 순간 방어막 붕괴 패배 처리
        if (boss.y >= commander.y - boss.radius) {
            endStage(false);
            return;
        }

        const distanceToDefense = commander.y - boss.y;
        if (distanceToDefense < BOSS_WARNING_DISTANCE && frameCount % 12 === 0) {
            const tremorPower = Math.ceil(clamp((BOSS_WARNING_DISTANCE - distanceToDefense) / 42, 1, 5));
            triggerScreenShake(tremorPower);
        }

        const bossCanAttack = boss.y > Math.min(44, canvas.height * 0.08);
        if (bossCanAttack) {
            boss.attackTimer += 0.016;
        } else {
            boss.attackTimer = 0;
            boss.laserCharge = 0;
            boss.laserActive = 0;
        }
        boss.shieldAngle += 0.025;

        if (bossCanAttack) {
            // 보스 공격 타이머 및 패턴 제어
            const isFinalBossBattle = currentStage >= TOTAL_ROUNDS;
            const patternInterval = isFinalBossBattle ? boss.nextAttackInterval : Math.max(1.55, 4.35 - currentStage * 0.28);
            const patternReady = boss.laserCharge === 0 && boss.laserActive === 0;
            if (patternReady && boss.attackTimer >= patternInterval) {
                boss.attackTimer = 0;
                if (isFinalBossBattle) {
                    boss.currentPattern = 1;
                    boss.nextAttackInterval = getFinalBossLaserDelay();
                } else if (currentStage === 1) {
                    boss.currentPattern = (boss.currentPattern === 0) ? 2 : 0;
                } else {
                    const patternCount = currentStage >= 3 ? 4 : 3;
                    boss.currentPattern = (boss.currentPattern + 1) % patternCount;
                }
            }

            // --- PATTERN 0: HELFIRE SPIRAL ---
            if (boss.currentPattern === 0) {
                const spiralFrequency = Math.max(2, 5 - Math.floor(currentStage / 3));
                if (frameCount % spiralFrequency === 0) {
                    const streams = Math.min(7, 2 + Math.floor(currentStage / 1.25));
                    const speedBoost = 3.8 + currentStage * 0.38;
                    
                    for (let i = 0; i < streams; i++) {
                        const baseAngle = (frameCount * 0.18) + (i * (Math.PI * 2 / streams));
                        const wobble = Math.sin(frameCount * 0.03 + i) * 0.12;
                        spawnBossProjectile(baseAngle + wobble, speedBoost + i * 0.18, {
                            x: boss.x + Math.sin(i + frameCount * 0.08) * 10,
                            y: boss.y + 15,
                            radius: 7 + Math.min(3, currentStage * 0.45),
                            damage: Math.max(1, Math.floor(1 + currentStage / 4.5)),
                            color: '#ef4444',
                            curve: (i % 2 === 0 ? 1 : -1) * (0.0025 + currentStage * 0.0007),
                            accel: 1.0015 + currentStage * 0.00045,
                            wave: currentStage >= 3 ? 0.45 + currentStage * 0.035 : 0
                        });
                    }
                    audio.playLaser();
                }
            }

            // --- PATTERN 1: TARGETED CHARGE LASER ---
            else if (boss.currentPattern === 1) {
                if (boss.laserCharge === 0 && !boss.laserActive) {
                    const laserTuning = getBossLaserTuning();
                    boss.laserCharge = laserTuning.chargeFrames;
                    boss.laserTargetX = clamp(commander.x + (commander.targetX - commander.x) * 0.55, 28, canvas.width - 28);
                    boss.beamWidth = laserTuning.visualWidth;
                    boss.laserLethalWidth = laserTuning.lethalWidth;
                    boss.laserCommanderHit = false;
                    boss.laserNeedsLayout = false;
                    boss.laserSweep = isFinalBossBattle
                        ? (Math.random() < 0.5 ? -1 : 1) * (0.9 + Math.random() * 1.7)
                        : currentStage >= 4 ? (Math.random() < 0.5 ? -1 : 1) * (0.55 + currentStage * 0.08) : 0;
                }

                if (boss.laserCharge > 0) {
                    boss.laserCharge--;
                    if (boss.laserCharge === 0) {
                        const laserTuning = getBossLaserTuning();
                        boss.laserActive = laserTuning.activeFrames; 
                        audio.playExplode();
                        triggerScreenShake(laserTuning.shake);
                    }
                }

                if (boss.laserActive > 0) {
                    boss.laserActive--;
                    boss.laserTargetX = clamp(boss.laserTargetX + boss.laserSweep, 28, canvas.width - 28);
                    const beamWidth = boss.beamWidth || Math.min(40, 25 + currentStage * 2.5);
                    const lethalWidth = boss.laserLethalWidth || Math.max(5, beamWidth * 0.25);
                    const laserLeft = boss.laserTargetX - lethalWidth;
                    const laserRight = boss.laserTargetX + lethalWidth;
                    let removedByLaser = false;

                    for (let j = army.length - 1; j >= 0; j--) {
                        const soldier = army[j];
                        const soldierLineHit = Math.abs(soldier.x - boss.laserTargetX) <= lethalWidth + soldier.radius * 0.35;
                        if (soldierLineHit) {
                            army.splice(j, 1);
                            spawnSparks(soldier.x, soldier.y, '#ff007f');
                            removedByLaser = true;
                        }
                    }
                    if (removedByLaser) {
                        boss.laserNeedsLayout = true;
                    }

                    if (commander.x >= laserLeft && commander.x <= laserRight && !boss.laserCommanderHit) {
                        boss.laserCommanderHit = true;
                        if (army.length === 0) {
                            endStage(false);
                            return;
                        } else {
                            const laserTuning = getBossLaserTuning();
                            const shieldLoss = Math.floor(army.length * laserTuning.commanderPenalty);
                            if (shieldLoss > 0) {
                                for (let loss = 0; loss < shieldLoss; loss++) {
                                    const victim = army[army.length - 1 - loss];
                                    if (victim) spawnSparks(victim.x, victim.y, '#ff007f');
                                }
                                army.splice(Math.max(0, army.length - shieldLoss), shieldLoss);
                                boss.laserNeedsLayout = true;
                                triggerScreenShake(laserTuning.shake);
                            }
                        }
                    }

                    if (boss.laserActive === 0 && boss.laserNeedsLayout) {
                        updateArmyLayout();
                        boss.laserNeedsLayout = false;
                    }
                    if (boss.laserActive === 0 && isFinalBossBattle) {
                        boss.currentPattern = -1;
                        boss.attackTimer = 0;
                    }
                }
            }

            // --- PATTERN 2: MULTI-TARGET SWARM SHOT ---
            else if (boss.currentPattern === 2) {
                const swarmFrequency = Math.max(12, 31 - currentStage * 2);
                if (frameCount % swarmFrequency === 0) {
                    const targetAngle = Math.atan2(commander.y - boss.y, commander.x - boss.x);
                    const spreadCount = Math.min(6, 1 + Math.floor(currentStage / 1.25));
                    const speedBase = 4.1 + currentStage * 0.34;

                    for (let offset = -spreadCount * 0.25; offset <= spreadCount * 0.25; offset += 0.25) {
                        const speed = speedBase + Math.abs(offset) * 1.4 + Math.random() * 0.35;
                        spawnBossProjectile(targetAngle + offset, speed, {
                            x: boss.x + Math.sin(offset * 8) * 18,
                            y: boss.y + 15,
                            radius: 7 + Math.abs(offset) * 3,
                            damage: Math.max(1, Math.floor(1 + currentStage / 5)) + (Math.abs(offset) < 0.01 && currentStage >= 5 ? 1 : 0),
                            color: '#f97316',
                            curve: -offset * 0.003,
                            life: 210
                        });
                    }
                    audio.playLaser();
                }
            }

            // --- PATTERN 3: HEAVY ARC MORTARS ---
            else if (boss.currentPattern === 3) {
                const mortarFrequency = Math.max(10, 28 - currentStage * 1.8);
                if (frameCount % mortarFrequency === 0) {
                    const lanes = Math.min(7, 2 + Math.floor(currentStage / 1.1));

                    for (let i = 0; i < lanes; i++) {
                        const laneOffset = (i - (lanes - 1) / 2) * 42;
                        const targetX = clamp(commander.x + laneOffset + (Math.random() - 0.5) * 24, 24, canvas.width - 24);
                        const angle = Math.atan2(commander.y - boss.y, targetX - boss.x);
                        spawnBossProjectile(angle, 2.9 + Math.random() * 0.9 + currentStage * 0.06, {
                            x: boss.x + (Math.random() - 0.5) * 36,
                            y: boss.y + 8,
                            radius: 9 + Math.random() * 2,
                            damage: 1 + Math.floor(currentStage / 4),
                            color: '#fb7185',
                            gravity: 0.065 + currentStage * 0.01,
                            accel: 1.0015,
                            life: 260
                        });
                    }
                    audio.playLaser();
                }
            }
        }

        // 아군 총알 충돌 및 보스 데미지 처리 (우리편 총알.png 사격)
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            b.x += b.vx;
            b.y += b.vy;

            const distToBoss = Math.hypot(b.x - boss.x, b.y - boss.y);
            const bossHitRadius = boss.radius * 1.65;
            if (boss.active && distToBoss < bossHitRadius + b.size) {
                boss.hp -= b.damage;
                bullets.splice(i, 1);
                spawnSparks(b.x, b.y, b.color || '#00f0ff');
                
                if (Math.random() < 0.15) triggerScreenShake(2);
                updateBossHpBar();

                if (boss.hp <= 0) {
                    boss.active = false;
                    audio.playExplode();
                    spawnSparks(boss.x, boss.y, '#39ff14');
                    triggerScreenShake(30);
                    endStage(true);
                    return;
                }
                continue;
            }

            if (b.y < -20) bullets.splice(i, 1);
        }

        // 보스 레이져.png 투사체 처리 (Safe Reverse Loop)
        for (let i = bossBullets.length - 1; i >= 0; i--) {
            const bb = bossBullets[i];
            if (bb.curve) {
                const cos = Math.cos(bb.curve);
                const sin = Math.sin(bb.curve);
                const nextVx = bb.vx * cos - bb.vy * sin;
                const nextVy = bb.vx * sin + bb.vy * cos;
                bb.vx = nextVx;
                bb.vy = nextVy;
            }
            if (bb.accel && bb.accel !== 1) {
                bb.vx *= bb.accel;
                bb.vy *= bb.accel;
            }
            if (bb.gravity) {
                bb.vy += bb.gravity;
            }
            if (bb.trail) {
                bb.trail.push({ x: bb.x, y: bb.y });
                if (bb.trail.length > 7) bb.trail.shift();
            }
            const waveDrift = bb.wave ? Math.sin(frameCount * 0.16 + bb.wavePhase) * bb.wave : 0;
            bb.x += bb.vx + waveDrift;
            bb.y += bb.vy;
            bb.life--;

            let hit = false;
            for (let j = army.length - 1; j >= 0; j--) {
                const soldier = army[j];
                const dist = Math.hypot(bb.x - soldier.x, bb.y - soldier.y);
                if (dist < soldier.radius + (bb.hitRadius || bb.radius)) {
                    const hitX = soldier.x;
                    const hitY = soldier.y;
                    bossBullets.splice(i, 1);

                    // 실드가 있으면 피탄 1회를 무효화
                    if (shieldCharges > 0) {
                        shieldCharges--;
                        spawnSparks(hitX, hitY, '#22d3ee');
                        spawnPopupText(hitX, hitY - 18, 'SHIELD', '#22d3ee', 'reward');
                        updateHud();
                        hit = true;
                        break;
                    }

                    const loss = removeBossBulletDamage(j, bb.damage, bb.color || '#ff007f');
                    spawnPopupText(hitX, hitY - 18, `-${loss}`, '#ff335f', 'penalty');
                    audio.playGateWrong();
                    triggerScreenShake(5);
                    hit = true;
                    break;
                }
            }

            if (hit) {
                if (army.length <= 0) {
                    endStage(false);
                    return;
                }
                continue;
            }

            if (army.length === 0) {
                const distToLeader = Math.hypot(bb.x - commander.x, bb.y - commander.y);
                if (distToLeader < commander.radius + bb.radius) {
                    bossBullets.splice(i, 1);
                    endStage(false);
                    return;
                }
            }

            if (bb.life <= 0 || bb.y > canvas.height + 30 || bb.x < -35 || bb.x > canvas.width + 35) {
                bossBullets.splice(i, 1);
            }
        }
    }

    // 5. Particles Update
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        if (p.alpha <= 0) particles.splice(i, 1);
    }

    // 6. Popup Texts Update
    for (let i = popupTexts.length - 1; i >= 0; i--) {
        const pt = popupTexts[i];
        pt.y += pt.vy;
        pt.life--;
        pt.alpha = Math.min(1, pt.life / 18);
        if (pt.life <= 0) popupTexts.splice(i, 1);
    }
}

function draw() {
    drawBattlefieldBackground();

    // 레인 구분선
    ctx.save();
    const gatesVisible = activeGates && gameState === 'RUNNING';
    const laneCount = gatesVisible ? activeGates.lanes.length : 2;
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.15)'; 
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 16]);
    for (let i = 1; i < laneCount; i++) {
        const lx = (canvas.width / laneCount) * i;
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx, canvas.height);
        ctx.stroke();
    }
    ctx.restore();

    // 모래바람 파편 (이동은 update, 여기서는 그리기만)
    if (debrisList.length === 0) {
        for (let i = 0; i < 50; i++) {
            debrisList.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                size: Math.random() * 3 + 1,
                speed: Math.random() * 1.5 + 0.5,
                color: ['#854d0e', '#a16207', '#78350f', '#451a03'][Math.floor(Math.random() * 4)]
            });
        }
    }

    ctx.globalAlpha = 0.5;
    debrisList.forEach(star => {
        ctx.fillStyle = star.color;
        ctx.fillRect(star.x, star.y, star.size, star.size);
    });
    ctx.globalAlpha = 1.0;

    // 1. 선택 관문 렌더링
    if (gatesVisible) {
        const gateH = 56;
        const lanesNum = activeGates.lanes.length;
        const laneW = canvas.width / lanesNum;

        activeGates.lanes.forEach((lane, i) => {
            const gx = (laneW * i) + 8;
            const gw = laneW - 16;

            ctx.save();
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#f59e0b';
            ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 3.5;
            ctx.fillRect(gx, activeGates.y, gw, gateH);
            ctx.strokeRect(gx, activeGates.y, gw, gateH);

            // 관문 측면 무늬
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.18)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            for (let d = 0; d < 18; d += 6) {
                ctx.moveTo(gx + d, activeGates.y);
                ctx.lineTo(gx + d + 5, activeGates.y + gateH);
                ctx.moveTo(gx + gw - d, activeGates.y);
                ctx.lineTo(gx + gw - d - 5, activeGates.y + gateH);
            }
            ctx.stroke();

            // 숫자 표시 — 굵은 외곽선 텍스트, 관문이 가까워질수록 커진다
            const valueText = Number(lane.value).toLocaleString('ko-KR');
            const textLen = valueText.length;
            const proximity = 0.72 + clamp(activeGates.y / Math.max(1, commander.y), 0, 1) * 0.5;
            let fontSize = clamp(gw * 0.36, 22, 46);
            if (textLen >= 7) fontSize *= 0.6;
            else if (textLen >= 5) fontSize *= 0.78;
            fontSize = Math.round(fontSize * proximity);

            const textX = gx + gw / 2;
            const textY = activeGates.y + gateH / 2 + 1;
            ctx.font = `900 ${fontSize}px "Orbitron", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineJoin = 'round';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.shadowBlur = 10;
            ctx.strokeStyle = '#0c0a09';
            ctx.lineWidth = Math.max(4, fontSize * 0.18);
            ctx.strokeText(valueText, textX, textY);
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(valueText, textX, textY);

            ctx.restore();
        });
    }

    // 2. 라운드별 고유 보스 본체 진격 렌더링 및 경고선
    if (boss.active) {
        const bossProfile = getBossRenderProfile();
        const bossPose = getBossMarchPose();
        const bossBox = getBossRenderBox();
        const bossDrawX = boss.x + bossPose.x;
        const bossDrawY = boss.y + bossPose.y;
        const distanceToDefense = commander.y - boss.y;

        // 오버런 경보선 (보스가 아래 방어선과 200px 미만으로 밀착했을 때 전율감 있게 표시)
        if (distanceToDefense < BOSS_WARNING_DISTANCE) {
            const dangerRatio = clamp((BOSS_WARNING_DISTANCE - distanceToDefense) / BOSS_WARNING_DISTANCE, 0, 1);
            const tremor = (Math.sin(frameCount * 0.88) * 8 + Math.sin(frameCount * 1.7) * 4) * dangerRatio;
            const flash = 0.55 + Math.sin(frameCount * 0.35) * 0.35;
            const warningY = commander.y - boss.radius;

            ctx.save();
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 18 + dangerRatio * 32;
            ctx.setLineDash([14, 10]);

            for (let i = 0; i < 3; i++) {
                ctx.strokeStyle = `rgba(239, 68, 68, ${clamp(flash - i * 0.12, 0.12, 0.95)})`;
                ctx.lineWidth = 5 + dangerRatio * 9 - i * 2;
                ctx.beginPath();
                ctx.moveTo(-20, warningY + tremor + i * 5);
                ctx.lineTo(canvas.width + 20, warningY - tremor * 0.45 + i * 5);
                ctx.stroke();
            }
            
            ctx.setLineDash([]);
            ctx.fillStyle = `rgba(127, 29, 29, ${0.45 + dangerRatio * 0.35})`;
            ctx.fillRect(16, 58 + tremor * 0.2, canvas.width - 32, 34);
            ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
            ctx.lineWidth = 2;
            ctx.strokeRect(16, 58 + tremor * 0.2, canvas.width - 32, 34);
            ctx.fillStyle = '#fff7ed';
            ctx.font = '900 14px "Orbitron", "Noto Sans KR", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText("보스가 방어선에 접근 중!", canvas.width / 2, 80 + tremor * 0.2);
            ctx.restore();
        }

        drawBossMarchShadow(bossBox, bossPose, bossProfile);

        // 보스 회전 장막 글로우
        ctx.save();
        ctx.translate(bossDrawX, bossDrawY);
        ctx.rotate(boss.shieldAngle);
        ctx.shadowBlur = 20;
        ctx.shadowColor = bossProfile.glow;
        ctx.strokeStyle = bossProfile.glow;
        ctx.lineWidth = 3.5;
        ctx.setLineDash([8, 12]);
        ctx.beginPath();
        ctx.arc(0, 0, boss.radius * 1.75, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // 라운드별 각기 다른 보스 이미지 로드 그리기 (완벽한 이미지 드로잉 및 깨짐 폴백)
        const targetBossImg = getCurrentBossImage();
        if (isImageReady(targetBossImg)) {
            drawNaturalImageCentered(
                targetBossImg,
                bossDrawX,
                bossDrawY,
                bossBox.width,
                bossBox.height,
                {
                    shadowColor: bossProfile.glow,
                    shadowBlur: 22,
                    rotation: bossPose.rotation,
                    scaleX: bossPose.scaleX,
                    scaleY: bossPose.scaleY
                }
            );
        } else {
            // [대규모 보강] 라운드별 외형에 부합하는 화려한 2D 벡터 기하학 구조 폴백 렌더링!
            ctx.save();
            ctx.translate(bossDrawX, bossDrawY);
            ctx.rotate(bossPose.rotation);
            ctx.scale(bossPose.scaleX, bossPose.scaleY);
            ctx.shadowBlur = 20;
            
            if (currentStage === 1) {
                // 늪지 변종 괴수: 녹색 유독 가스 실루엣과 오염된 유기 촉수 구조
                ctx.shadowColor = '#16a34a';
                ctx.fillStyle = '#14532d';
                ctx.beginPath();
                ctx.arc(0, 0, boss.radius, 0, Math.PI*2);
                ctx.fill();
                // 오염 핵
                ctx.fillStyle = '#4ade80';
                ctx.beginPath();
                ctx.arc(-10, -5, 8, 0, Math.PI*2);
                ctx.arc(10, 5, 10, 0, Math.PI*2);
                ctx.fill();
            } 
            else if (currentStage === 2) {
                // 공허 심연 군주: 보랏빛 촉수형태의 코어와 눈
                ctx.shadowColor = '#c084fc';
                ctx.fillStyle = '#3b0764';
                ctx.beginPath();
                for(let i=0; i<8; i++){
                    const angle = (Math.PI/4)*i + frameCount*0.03;
                    ctx.lineTo(Math.cos(angle)*boss.radius, Math.sin(angle)*boss.radius);
                }
                ctx.closePath();
                ctx.fill();
                // 붉은 조준안안
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.arc(0, 0, 8, 0, Math.PI*2);
                ctx.fill();
            } 
            else if (currentStage === 3) {
                // 기갑 강철 메카: 거대한 중장갑 기계 판갑과 리볼버식 포신
                ctx.shadowColor = '#ea580c';
                ctx.fillStyle = '#334155';
                ctx.strokeStyle = '#f97316';
                ctx.lineWidth = 4;
                ctx.fillRect(-boss.radius, -boss.radius+10, boss.radius*2, boss.radius*2-20);
                // 전면 헤드 라이트
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(-15, -15, 30, 8);
            } 
            else {
                // 초중 기갑 스파이더 탱크: 8각 형상의 다각 다리 프레임 및 거대 대포 탑재
                ctx.shadowColor = '#dc2626';
                ctx.fillStyle = '#1e293b';
                ctx.strokeStyle = '#ef4444';
                ctx.lineWidth = 5;
                ctx.beginPath();
                for(let i=0; i<6; i++){
                    const angle = (Math.PI/3)*i;
                    ctx.lineTo(Math.cos(angle)*boss.radius, Math.sin(angle)*boss.radius);
                }
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                // 대포구멍
                ctx.fillStyle = '#0f172a';
                ctx.beginPath();
                ctx.arc(0, boss.radius - 10, 12, 0, Math.PI*2);
                ctx.fill();
            }
            ctx.restore();
        }

        // 레이저 조준 라인
        if (boss.laserCharge > 0) {
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 0, 127, 0.4)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(boss.laserTargetX, 0);
            ctx.lineTo(boss.laserTargetX, canvas.height);
            ctx.stroke();
            ctx.restore();
        }

        // 레이저 발사
        if (boss.laserActive > 0) {
            ctx.save();
            const beamWidth = boss.beamWidth || 25;
            const lethalWidth = boss.laserLethalWidth || Math.max(5, beamWidth * 0.25);
            const coreWidth = Math.max(6, lethalWidth * 2);
            ctx.shadowBlur = 25;
            ctx.shadowColor = '#ff007f';
            ctx.fillStyle = 'rgba(255, 0, 127, 0.5)';
            ctx.fillRect(boss.laserTargetX - beamWidth, 0, beamWidth * 2, canvas.height);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(boss.laserTargetX - coreWidth / 2, 0, coreWidth, canvas.height);
            ctx.restore();
        }
    }

    // 3. 우리편 총알.png 투사체 렌더링
    bullets.forEach(b => {
        if (isImageReady(imgPlayerBullet)) {
            // 비행 궤적 라디안 각도를 반영해 총알 진행 방향과 정면을 일치
            const bulletAngle = Math.atan2(b.vy, b.vx) + PLAYER_BULLET_ROTATION_OFFSET;
            const bulletScale = b.commander ? 8.2 : 6.4;
            drawRotatedImage(imgPlayerBullet, b.x, b.y, b.size * bulletScale, b.size * bulletScale, bulletAngle);
        } else {
            // 실탄 느낌이 충만한 오렌지색 돌격 예광탄 폴백 드로잉
            ctx.save();
            ctx.shadowBlur = 10;
            ctx.shadowColor = b.color || '#f97316';
            ctx.fillStyle = b.commander ? '#ecfccb' : '#fff';
            ctx.strokeStyle = b.color || '#f97316';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.size - 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
    });

    // 4. 보스 레이져.png 적군 메테오 포탄 렌더링
    bossBullets.forEach(bb => {
        if (bb.trail && bb.trail.length > 1) {
            ctx.save();
            ctx.globalAlpha = 0.24;
            ctx.strokeStyle = bb.color || '#dc2626';
            ctx.lineWidth = Math.max(2, bb.radius * 0.34);
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(bb.trail[0].x, bb.trail[0].y);
            for (let i = 1; i < bb.trail.length; i++) {
                ctx.lineTo(bb.trail[i].x, bb.trail[i].y);
            }
            ctx.stroke();
            ctx.restore();
        }

        if (isImageReady(imgBossLaser)) {
            // vx/vy 벡터 비례 방향으로 회전하되, 원본 메테오 헤드가 왼쪽을 향하는 기준각을 보정
            const bulletAngle = Math.atan2(bb.vy, bb.vx) + BOSS_BULLET_ROTATION_OFFSET;
            drawRotatedImage(imgBossLaser, bb.x, bb.y, bb.radius * 4.35, bb.radius * 4.35, bulletAngle);
        } else {
            // 파괴적인 플라즈마 화염 메테오 포탄 폴백 드로잉
            ctx.save();
            ctx.shadowBlur = 12;
            ctx.shadowColor = bb.color || '#dc2626';
            ctx.fillStyle = bb.color || '#ef4444';
            ctx.beginPath();
            ctx.arc(bb.x, bb.y, bb.radius, 0, Math.PI * 2);
            ctx.fill();
            // 불꽃의 고온 코어
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(bb.x - bb.vx * 1.5, bb.y - bb.vy * 1.5, bb.radius * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    });

    // 5. 아군 정예 병사 그리기: 사령관 뒤/아래에 배치
    army.forEach(s => s.draw());

    // 6. 사령관.png 헤드 리더 렌더링: 항상 최전면
    if (isImageReady(imgCommander)) {
        drawNaturalImageCentered(
            imgCommander,
            commander.x,
            commander.y,
            commander.radius * 2 * COMMANDER_RENDER_SCALE,
            commander.radius * 2 * COMMANDER_RENDER_SCALE,
            { shadowColor: 'rgba(132, 204, 22, 0.65)', shadowBlur: 11 }
        );
    } else {
        // [대규모 보강] 늠름한 위용의 전술 정예 지참군 사령관 코스튬 폴백 드로잉
        ctx.save();
        ctx.translate(commander.x, commander.y);
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#84cc16'; 
        
        // 사막용 전술 머드브라운 장외 망토
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.moveTo(-10, 10);
        ctx.lineTo(10, 10);
        ctx.lineTo(15, 26);
        ctx.lineTo(-15, 26);
        ctx.closePath();
        ctx.fill();

        // 전술 올리브 드랍 기갑 슈트
        ctx.fillStyle = '#14532d';
        ctx.fillRect(-11, 2, 22, 9);

        // 지휘관 헬멧 바이저 안면부
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#84cc16';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -4, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 붉은 조준 바이저 고글
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-5, -6, 10, 2);

        ctx.restore();
    }

    // 실드 보유 시 사령관 주위에 청록색 방어막 링
    if (shieldCharges > 0 && (gameState === 'RUNNING' || gameState === 'BOSS_BATTLE' || gameState === 'BOSS_WARNING')) {
        ctx.save();
        const shieldPulse = 0.35 + Math.sin(frameCount * 0.1) * 0.15;
        ctx.globalAlpha = shieldPulse;
        ctx.strokeStyle = '#22d3ee';
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 14;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.arc(commander.x, commander.y, commander.radius + 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // 7. 파티클 및 팝업
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
    ctx.globalAlpha = 1.0;

    popupTexts.forEach(pt => {
        ctx.save();
        ctx.globalAlpha = pt.alpha;
        ctx.font = '900 15px "Orbitron", "Noto Sans KR", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const metrics = ctx.measureText(pt.text);
        const boxW = Math.min(canvas.width - 28, Math.max(138, metrics.width + 34));
        const boxH = 32;
        const drawX = clamp(pt.x, boxW / 2 + 8, canvas.width - boxW / 2 - 8);
        const boxX = drawX - boxW / 2;
        const boxY = pt.y - boxH / 2;
        const isPenalty = pt.kind === 'penalty';
        const isReward = pt.kind === 'reward';
        const isInfo = pt.kind === 'info';

        ctx.shadowBlur = isPenalty ? 18 : 16;
        ctx.shadowColor = isPenalty
            ? 'rgba(255, 0, 80, 0.75)'
            : isInfo ? 'rgba(251, 191, 36, 0.6)' : 'rgba(57, 255, 20, 0.58)';
        ctx.fillStyle = isPenalty
            ? 'rgba(69, 10, 10, 0.86)'
            : isReward ? 'rgba(6, 47, 42, 0.86)' : 'rgba(41, 37, 36, 0.9)';
        ctx.fillRect(boxX, boxY, boxW, boxH);

        ctx.shadowBlur = 0;
        ctx.strokeStyle = isPenalty
            ? 'rgba(248, 113, 113, 0.92)'
            : isReward ? 'rgba(132, 204, 22, 0.92)' : 'rgba(251, 191, 36, 0.82)';
        ctx.lineWidth = 2.4;
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        ctx.fillStyle = pt.color;
        ctx.shadowBlur = 5;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
        ctx.fillText(pt.text, drawX, pt.y + 1);
        ctx.restore();
    });

    // 8. 일시정지 오버레이
    if (gameState === 'PAUSED') {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f8fafc';
        ctx.font = '900 32px "Orbitron", sans-serif';
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 12);
        ctx.fillStyle = '#d6d3d1';
        ctx.font = '700 13px "Noto Sans KR", sans-serif';
        ctx.fillText('▶ 버튼을 누르면 계속됩니다', canvas.width / 2, canvas.height / 2 + 18);
        ctx.restore();
    }
}

// 메인 루프 — 60Hz 고정 타임스텝.
// rAF는 화면 주사율(60/90/120Hz…)을 따라가므로, 시뮬레이션을 프레임에 묶으면
// 고주사율 기기에서 게임 전체가 배속된다. 경과 시간을 누적해 16.67ms 단위로만
// update()를 돌리고, draw()는 매 프레임 수행한다.
const SIM_STEP_MS = 1000 / 60;
let lastTickTime = 0;
let tickAccumulator = 0;

function mainTick(now) {
    if (!lastTickTime) lastTickTime = now;
    // 탭 비활성화 등으로 크게 벌어진 시간은 버린다 (한 번에 최대 6스텝)
    tickAccumulator += Math.min(SIM_STEP_MS * 6, now - lastTickTime);
    lastTickTime = now;

    while (tickAccumulator >= SIM_STEP_MS) {
        update();
        tickAccumulator -= SIM_STEP_MS;
    }
    draw();
    requestAnimationFrame(mainTick);
}

window.onload = function() {
    loadProgress();
    resizeCanvas();
    renderShopStats();
    renderStatsPanel();
    updateHud();
    requestAnimationFrame(mainTick);

    // 설치형 웹앱 + 오프라인 실행 (지원 환경에서만)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
};
