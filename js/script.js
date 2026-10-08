// clean trailing spaces from data.js
if (typeof marvelData !== 'undefined') {
    marvelData.forEach(item => {
        Object.keys(item).forEach(key => {
            const cleanKey = key.trim();
            const val = item[key];
            if (typeof val === 'string') {
                item[cleanKey] = val.trim();
            } else {
                item[cleanKey] = val;
            }
            if (cleanKey !== key) {
                delete item[key];
            }
        });
    });
}

const IMAGE_PATH = 'images/';
const PLACEHOLDER_IMAGE = 'placeholder.jpg';

// state
let watchedItems = JSON.parse(localStorage.getItem('marvelWatched')) || {};
let skippedItems = JSON.parse(localStorage.getItem('marvelSkipped')) || {};
let isCompactGrid = localStorage.getItem('marvelCompactGrid') === 'true';
let currentModalItem = null;
let currentView = 'catalog';
let pixelsPerYear = 150;
const MIN_ZOOM = 10;
const MAX_ZOOM = 2000;
let sortMode = 'chronological';

// unique ID generator
function getUniqueId(item) {
    return `${item.title || 'Unknown'}||${item.position || 0}`;
}

// parse runtime string to minutes
function parseRuntimeToMinutes(runtimeStr) {
    if (!runtimeStr || runtimeStr === 'N/A') return 0;
    let totalMinutes = 0;
    const str = runtimeStr.toLowerCase();
    const hourMatch = str.match(/(\d+)\s*h/);
    if (hourMatch) totalMinutes += parseInt(hourMatch[1], 10) * 60;
    const minMatch = str.match(/(\d+)\s*m/);
    if (minMatch) {
        totalMinutes += parseInt(minMatch[1], 10);
    } else if (!hourMatch) {
        const numMatch = str.match(/(\d+)/);
        if (numMatch) totalMinutes += parseInt(numMatch[1], 10);
    }
    return totalMinutes;
}

// different format for image
function handleImageError(img, imageName) {
    const baseName = imageName.replace(/.(webp|jpe?g|png)$/i, '');
    const currentSrc = img.src.toLowerCase();
    if (currentSrc.endsWith('.webp')) {
        img.src = `${IMAGE_PATH}${baseName}.jpg`;
    } else if (currentSrc.endsWith('.jpg')) {
        img.src = `${IMAGE_PATH}${baseName}.jpeg`;
    } else if (currentSrc.endsWith('.jpeg')) {
        img.src = `${IMAGE_PATH}${baseName}.png`;
    } else {
        img.onerror = null;
        img.src = `${IMAGE_PATH}${PLACEHOLDER_IMAGE}`;
    }
}

// initialisation
function init() {
    let currentStorage = JSON.parse(localStorage.getItem('marvelWatched')) || {};
    let needsUpdate = false;
    const newWatched = {};
    const validIds = typeof marvelData !== 'undefined' ? new Set(marvelData.map(item => getUniqueId(item))) : new Set();
    
    for (const key in currentStorage) {
        const parts = key.split('||');
        let newKey = key;
        if (parts.length === 3) {
            needsUpdate = true;
            const title = parts[0];
            const position = parts[2];
            newKey = `${title}||${position}`;
        } else if (parts.length === 1) {
            needsUpdate = true;
            if (typeof marvelData !== 'undefined') {
                const matches = marvelData.filter(i => i.title === key);
                matches.forEach(match => { newWatched[getUniqueId(match)] = true; });
            }
            continue;
        }
        if (validIds.has(newKey)) { newWatched[newKey] = true; } 
        else { needsUpdate = true; }
    }
    
    if (needsUpdate) {
        watchedItems = newWatched;
        localStorage.setItem('marvelWatched', JSON.stringify(watchedItems));
    } else {
        watchedItems = currentStorage;
    }

    let currentSkipped = JSON.parse(localStorage.getItem('marvelSkipped')) || {};
    let skippedNeedsUpdate = false;
    const newSkipped = {};
    
    for (const key in currentSkipped) {
        const parts = key.split('||');
        let newKey = key;
        if (parts.length === 3) {
            skippedNeedsUpdate = true;
            newKey = `${parts[0]}||${parts[2]}`;
        } else if (parts.length === 1) {
            skippedNeedsUpdate = true;
            if (typeof marvelData !== 'undefined') {
                marvelData.filter(i => i.title === key).forEach(match => { newSkipped[getUniqueId(match)] = true; });
            }
            continue;
        }
        if (validIds.has(newKey)) { newSkipped[newKey] = true; } 
        else { skippedNeedsUpdate = true; }
    }
    
    if (skippedNeedsUpdate) {
        skippedItems = newSkipped;
        localStorage.setItem('marvelSkipped', JSON.stringify(skippedItems));
    } else {
        skippedItems = currentSkipped;
    }

    const savedTheme = localStorage.getItem('marvelTheme');
    if (savedTheme === 'night') {
        document.body.classList.add('night-edition');
        updateThemeIcon(true);
    }

    populateFilters();
    renderTimeline();
    renderCatalog();
    renderWatchedView();
    renderRemainingView();
    renderSkippedView();
    updateStats();
    setupEventListeners();
    updateSortToggleUI(); 
    applyGridSize();
}

// filters setup
function populateFilters() {
    const universes = [...new Set(marvelData.map(i => i.universe))].sort();
    const uf = document.getElementById('universeFilter');
    universes.forEach(u => {
        const o = document.createElement('option');
        o.value = u; o.textContent = u; uf.appendChild(o);
    });

    const studios = [...new Set(marvelData.map(i => i.studio))].sort();
    const sf = document.getElementById('studioFilter');
    studios.forEach(s => {
        const o = document.createElement('option');
        o.value = s; o.textContent = s; sf.appendChild(o);
    });
}

// event listeners
function setupEventListeners() {
    ['searchBox', 'phaseFilter', 'universeFilter', 'studioFilter', 'eraFilter'].forEach(id => {
        document.getElementById(id).addEventListener('input', applyFilters);
        document.getElementById(id).addEventListener('change', applyFilters);
    });

    const slider = document.querySelector('.timeline-wrapper');    
    let isDown = false, startX, scrollLeft;
    slider.addEventListener('mousedown', e => { isDown = true; startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft; });
    ['mouseleave', 'mouseup'].forEach(ev => slider.addEventListener(ev, () => isDown = false));
    slider.addEventListener('mousemove', e => {
        if (!isDown) return;
        e.preventDefault();
        slider.scrollLeft = scrollLeft - (e.pageX - slider.offsetLeft - startX) * 1.5;
    });

    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    const zoomInBtn = document.getElementById('zoomIn');
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => zoomTimeline(1));

    const zoomOutBtn = document.getElementById('zoomOut');
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => zoomTimeline(-1));

    const gridSizeBtn = document.getElementById('gridSizeToggleBtn');
    if (gridSizeBtn) gridSizeBtn.addEventListener('click', toggleGridSize);

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeModal();
        const overlay = document.getElementById('modalOverlay');
        if (overlay && overlay.classList.contains('active')) {
            if (e.key === 'ArrowLeft') {
                const prevBtn = document.getElementById('modalPrev');
                if (prevBtn && !prevBtn.disabled) prevBtn.click();
            }
            if (e.key === 'ArrowRight') {
                const nextBtn = document.getElementById('modalNext');
                if (nextBtn && !nextBtn.disabled) nextBtn.click();
            }
        }
    });
}

// filter
function matchesFilters(item) {
    const s = document.getElementById('searchBox').value.toLowerCase();
    let p = document.getElementById('phaseFilter').value;
    const u = document.getElementById('universeFilter').value;
    const st = document.getElementById('studioFilter').value;
    let e = document.getElementById('eraFilter').value;

    const matchS = !s || (item.title || '').toLowerCase().includes(s) || (item.description || '').toLowerCase().includes(s);
    
    let matchP = true;
    if (p) {
        const phaseMap = {
            'Phase I': 'Phase 1', 'Phase II': 'Phase 2', 'Phase III': 'Phase 3',
            'Phase IV': 'Phase 4', 'Phase V': 'Phase 5', 'Phase VI': 'Phase 6',
            'Non-MCU': 'other'
        };
        const normalizedP = phaseMap[p] || p;
        matchP = item.phase === normalizedP;
    }

    const matchU = !u || item.universe === u;
    const matchSt = !st || item.studio === st;

    let matchE = true;
    if (e) {
        const y = extractYear(item.timeline);
        const eraMap = {
            'ancient': 'ancient', 'before 1900': 'ancient',
            'early': 'early', '1900-1950': 'early', '1900-1950': 'early',
            'mid': 'mid', '1950-1990': 'mid', '1950-1990': 'mid',
            'modern': 'modern', '1990-2020': 'modern', '1990-2020': 'modern',
            'future': 'future', '2020+': 'future'
        };
        const normalizedE = eraMap[e.toLowerCase()] || e;
        if (normalizedE === 'ancient') matchE = y < 1900 && y > -10000;
        else if (normalizedE === 'early') matchE = y >= 1900 && y < 1950;
        else if (normalizedE === 'mid') matchE = y >= 1950 && y < 1990;
        else if (normalizedE === 'modern') matchE = y >= 1990 && y < 2020;
        else if (normalizedE === 'future') matchE = y >= 2020;
    }

    return matchS && matchP && matchU && matchSt && matchE;
}

function applyFilters() {
    let catalogVisible = 0;
    marvelData.forEach(item => {
        const matchesFilter = matchesFilters(item);
        const uid = getUniqueId(item);
        const isW = watchedItems[uid];
        const isS = skippedItems[uid];

        const tlEl = document.querySelector(`.tl-item[data-uid="${CSS.escape(uid)}"]`);
        if (tlEl) tlEl.classList.toggle('hidden', !matchesFilter);

        const catEl = document.querySelector(`#catalogGrid .card[data-uid="${CSS.escape(uid)}"]`);
        if (catEl) {
            catEl.classList.toggle('hidden', !matchesFilter);
            if (matchesFilter) catalogVisible++;
        }

        const wEl = document.querySelector(`#watchedGrid .card[data-uid="${CSS.escape(uid)}"]`);
        if (wEl) wEl.classList.toggle('hidden', !(matchesFilter && isW));

        const rEl = document.querySelector(`#remainingGrid .card[data-uid="${CSS.escape(uid)}"]`);
        if (rEl) rEl.classList.toggle('hidden', !(matchesFilter && !isW && !isS));

        const sEl = document.querySelector(`#skippedGrid .card[data-uid="${CSS.escape(uid)}"]`);
        if (sEl) sEl.classList.toggle('hidden', !(matchesFilter && isS));
    });

    const watchedMatching = marvelData.filter(i => matchesFilters(i) && watchedItems[getUniqueId(i)]).length;
    const remainingMatching = marvelData.filter(i => matchesFilters(i) && !watchedItems[getUniqueId(i)] && !skippedItems[getUniqueId(i)]).length;
    const skippedMatching = marvelData.filter(i => matchesFilters(i) && skippedItems[getUniqueId(i)]).length;

    document.getElementById('catalogCount').textContent = catalogVisible;
    document.getElementById('catalogShowing').textContent = `${catalogVisible} ${catalogVisible === 1 ? 'entry' : 'entries'}`;
    document.getElementById('watchedTabCount').textContent = watchedMatching;
    document.getElementById('watchedShowing').textContent = `${watchedMatching} ${watchedMatching === 1 ? 'entry' : 'entries'}`;
    document.getElementById('remainingTabCount').textContent = remainingMatching;
    document.getElementById('remainingShowing').textContent = `${remainingMatching} ${remainingMatching === 1 ? 'entry' : 'entries'}`;
    document.getElementById('skippedTabCount').textContent = skippedMatching;
    document.getElementById('skippedShowing').textContent = `${skippedMatching} ${skippedMatching === 1 ? 'entry' : 'entries'}`;

    updateEmptyStates();
}

// empty states
function updateEmptyStates() {
    const grids = {
        watchedGrid: { symbol: '∅', text: 'Your archive awaits. Begin by marking an entry as viewed.' },
        remainingGrid: { symbol: '✦', text: 'The chronicle is complete. Every entry has been viewed or skipped.' },
        skippedGrid: { symbol: '⊘', text: 'No entries have been skipped. Every title is awaiting your discovery.' },
        catalogGrid: { symbol: '-', text: 'No entries match your current query.' }
    };

    Object.entries(grids).forEach(([gridId, { symbol, text }]) => {
        const grid = document.getElementById(gridId);
        if (!grid) return;
        const existing = grid.querySelector('.empty-state');
        const hasCards = grid.querySelector('.card:not(.hidden)');
        if (existing) existing.remove();
        if (!hasCards) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.innerHTML = `<div class="empty-state-num">${symbol}</div><p class="empty-state-text">${text}</p>`;
            grid.appendChild(empty);
        }
    });
}

// timeline rendering
function renderTimeline() {
    const timeline = document.getElementById('timeline');
    timeline.querySelectorAll('.tl-item, .tl-break').forEach(i => i.remove());

    const sortedData = [...marvelData].sort((a, b) => (a.position || 0) - (b.position || 0));
    const itemXCoords = {};
    let currentX = 100;
    
    const ORIGINAL_PPY = 150;
    const MIN_GAP = 90;
    const isZoomedOut = pixelsPerYear < ORIGINAL_PPY;
    const SAME_YEAR_GAP = Math.max(50, pixelsPerYear * 0.6);
    const BREAK_THRESHOLD_YEARS = 20;
    const BREAK_GAP = Math.max(150, pixelsPerYear * 2);
    const DISABLE_BREAKS_ZOOM = 300;
    const breaks = [];

    sortedData.forEach((item, index) => {
        const currentYear = extractYear(item.timeline);
        const uid = getUniqueId(item);

        if (index === 0) {
            itemXCoords[uid] = currentX;
        } else {
            const prevItem = sortedData[index - 1];
            const prevYear = extractYear(prevItem.timeline);
            const yearDiff = Math.abs(currentYear - prevYear);

            if (isZoomedOut) {
                currentX += MIN_GAP;
                const originalDistance = yearDiff * ORIGINAL_PPY;
                if (originalDistance > MIN_GAP && currentYear !== 0 && prevYear !== 0) {
                    breaks.push({ x: currentX - (MIN_GAP / 2) });
                }
            } else {
                if (yearDiff === 0 || currentYear === 0 || prevYear === 0) {
                    currentX += SAME_YEAR_GAP;
                } else {
                    const scaledDistance = yearDiff * pixelsPerYear;
                    if (yearDiff > BREAK_THRESHOLD_YEARS && pixelsPerYear < DISABLE_BREAKS_ZOOM) {
                        currentX += BREAK_GAP;
                        breaks.push({ x: currentX - (BREAK_GAP / 2) });
                    } else {
                        currentX += scaledDistance;
                    }
                }
            }
            itemXCoords[uid] = currentX;
        }
    });

    breaks.forEach(breakPos => {
        const breakDiv = document.createElement('div');
        breakDiv.className = 'tl-break';
        breakDiv.style.left = `${breakPos.x}px`;
        timeline.appendChild(breakDiv);
    });

    let maxX = 0;
    let alternateDirection = 1;
    sortedData.forEach(item => {
        const uid = getUniqueId(item);
        const offsetX = itemXCoords[uid];
        const isTop = alternateDirection === 1;
        alternateDirection *= -1;
        if (offsetX > maxX) maxX = offsetX;
        timeline.appendChild(createTimelineItem(item, offsetX, isTop));
    });

    timeline.style.width = `${maxX + 500}px`;

    const iconSVGs = {
        hammer: `data:image/svg+xml;base64,${btoa(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='h-m' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#e0e0e0'/><stop offset='0.5' stop-color='#888'/><stop offset='1' stop-color='#555'/></linearGradient><filter id='h-g'><feGaussianBlur stdDeviation='2'/></filter></defs><rect x='45' y='45' width='10' height='45' fill='#3a2e28' rx='2'/><path d='M45 50 L55 55 M45 58 L55 63 M45 66 L55 71 M45 74 L55 79 M45 82 L55 87' stroke='#1a1512' stroke-width='1.5'/><rect x='20' y='15' width='60' height='35' fill='url(#h-m)' rx='3' stroke='#333' stroke-width='1.5'/><rect x='22' y='17' width='56' height='4' fill='#fff' opacity='0.6' rx='1'/><rect x='22' y='44' width='56' height='3' fill='#000' opacity='0.6' rx='1'/><path d='M30 25 L30 40 M35 25 L35 40 M40 25 L40 40 M60 25 L60 40 M65 25 L65 40 M70 25 L70 40' stroke='#444' stroke-width='1' opacity='0.8'/><ellipse cx='50' cy='32' rx='35' ry='20' fill='#fff' opacity='0.2' filter='url(#h-g)'/><path d='M15 30 L25 25 L20 35 L30 30' stroke='#66ccff' stroke-width='1.5' fill='none' opacity='0.8' filter='url(#h-g)'/><path d='M85 35 L75 30 L80 40 L70 35' stroke='#66ccff' stroke-width='1.5' fill='none' opacity='0.8' filter='url(#h-g)'/></svg>`)}`,
    
        shield: `data:image/svg+xml;base64,${btoa(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><radialGradient id='s-sh' cx='0.3' cy='0.3' r='0.7'><stop offset='0' stop-color='#fff' stop-opacity='0.6'/><stop offset='1' stop-color='#000' stop-opacity='0.5'/></radialGradient><filter id='s-ds'><feDropShadow dx='0' dy='2' stdDeviation='2' flood-opacity='0.4'/></filter></defs><g filter='url(#s-ds)'><circle cx='50' cy='50' r='42' fill='#c8102e'/><circle cx='50' cy='50' r='33' fill='#f5f1e8'/><circle cx='50' cy='50' r='24' fill='#c8102e'/><circle cx='50' cy='50' r='15' fill='#0033a0'/><polygon points='50,38 53.5,46 62,47 55.5,52.5 57.5,61 50,56.5 42.5,61 44.5,52.5 38,47 46.5,46' fill='#f5f1e8'/><circle cx='50' cy='50' r='42' fill='url(#s-sh)'/><circle cx='50' cy='50' r='41' fill='none' stroke='#fff' stroke-width='1' opacity='0.5'/><circle cx='50' cy='50' r='42' fill='none' stroke='#000' stroke-width='1.5' opacity='0.4'/></g></svg>`)}`,
        
        cassette: `data:image/svg+xml;base64,${btoa(`
            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs>
            <linearGradient id='c-body' x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0' stop-color='#3a3a3a'/>
            <stop offset='0.5' stop-color='#222'/>
            <stop offset='1' stop-color='#111'/>
            </linearGradient>
            <filter id='c-sh' x='-10%' y='-10%' width='120%' height='120%'>
            <feDropShadow dx='0' dy='2' stdDeviation='2' flood-opacity='0.5'/></filter></defs>
            <rect x='5' y='20' width='90' height='60' rx='4' fill='url(#c-body)' stroke='#000' stroke-width='1' filter='url(#c-sh)'/><rect x='5' y='20' width='90' height='2' fill='#fff' opacity='0.15' rx='1'/>
            <circle cx='10' cy='25' r='1.2' fill='#111' stroke='#555' stroke-width='0.5'/>
            <circle cx='90' cy='25' r='1.2' fill='#111' stroke='#555' stroke-width='0.5'/>
            <circle cx='10' cy='75' r='1.2' fill='#111' stroke='#555' stroke-width='0.5'/>
            <circle cx='90' cy='75' r='1.2' fill='#111' stroke='#555' stroke-width='0.5'/>
            <circle cx='10' cy='25' r='0.5' fill='#333'/>
            <circle cx='90' cy='25' r='0.5' fill='#333'/>
            <circle cx='10' cy='75' r='0.5' fill='#333'/>
            <circle cx='90' cy='75' r='0.5' fill='#333'/>
            <rect x='14' y='28' width='72' height='30' rx='1.5' fill='#fdfbf7' stroke='#dcd0b0' stroke-width='0.5'/>
            <line x1='14' y1='40' x2='86' y2='40' stroke='#ff7f00' stroke-width='0.5' opacity='0.85'/>
            <line x1='14' y1='44' x2='86' y2='44' stroke='#ff7f00' stroke-width='0.7' opacity='0.85'/>
            <line x1='14' y1='47' x2='86' y2='47' stroke='#ff7f00' stroke-width='0.9' opacity='0.85'/>
            <line x1='14' y1='50' x2='86' y2='50' stroke='#ff7f00' stroke-width='1.1' opacity='0.85'/>
            <line x1='14' y1='53' x2='86' y2='53' stroke='#ff7f00' stroke-width='1.5' opacity='0.85'/>
            <line x1='14' y1='56' x2='86' y2='56' stroke='#ff7f00' stroke-width='2' opacity='0.85'/>
            <text x='50' y='38' font-family="'Bradley Hand', 'Brush Script MT', 'Segoe Script', 'Comic Sans MS', cursive" font-size='8' fill="#1a2530" text-anchor='middle' transform='rotate(0, 50, 45)'>Awesome Mix Vol. 1</text>
            <rect x='20' y='62' width='60' height='14' rx='2' fill="#111" stroke="#333" stroke-width="0.5"/>
            <rect x='24' y='40.1' width='52' height="10.2" fill="#2c1b10" opacity="0.9"/>
            <rect x="18" y="65" width="2.5" height="6" fill="#aaa" rx="0.5"/>
            <rect x="79.5" y="65" width="2.5" height="6" fill="#aaa" rx="0.5"/>
            <circle cx='32' cy='45' r='4.5' fill='none' stroke='#e0e0e0' stroke-width='1.5' stroke-dasharray='1.8 3'/>
            <circle cx='32' cy='45' r='1.8' fill='#222'/>
            <circle cx='32' cy='45' r='0.8' fill='#555'/>
            <circle cx='68' cy='45' r='4.5' fill='none' stroke='#e0e0e0' stroke-width='1.5' stroke-dasharray='1.8 3'/>
            <circle cx='68' cy='45' r='1.8' fill='#222'/>
            <circle cx='68' cy='45' r='0.8' fill='#555'/></svg>
        `)}`,        

        reactor: `data:image/svg+xml;base64,${btoa(`
            <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs>
            
            <linearGradient id="metal-gold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#3e1f03ff" />
                <stop offset="30%" stop-color="#e6b56bff" />
                <stop offset="50%" stop-color="#6b4612ff" />
                <stop offset="70%" stop-color="#eab291ff" />
                <stop offset="100%" stop-color="#1a1000" />
            </linearGradient>
            <radialGradient id='arc-core' cx='50%' cy='50%' r='50%'><stop offset='0%' stop-color='#ffffff'/><stop offset='30%' stop-color='#aaffff'/><stop offset='70%' stop-color='#00ccff'/><stop offset='100%' stop-color='#0044aa' stop-opacity='0.8'/></radialGradient><linearGradient id='arc-metal' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='#d4d4d4'/><stop offset='50%' stop-color='#888888'/><stop offset='100%' stop-color='#444444'/></linearGradient><filter id='arc-glow' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='3' result='blur'/><feMerge><feMergeNode in='blur'/><feMergeNode in='SourceGraphic'/></feMerge></filter></defs>

            <circle cx='50' cy='50' r='44' fill='url(#arc-metal)' stroke='#222' stroke-width='2'/>
            <circle cx='50' cy='50' r='40' fill='#111' stroke='#333' stroke-width='1'/>
            <circle cx='50' cy='50' r='30' fill='none' stroke='#777' stroke-width='4' stroke-dasharray='6 4'/>
            <circle cx='50' cy='50' r='39' fill='none' stroke='url(#metal-gold)' stroke-width='9' stroke-dasharray='9 18.5'/>
            <circle cx='50' cy='50' r='22' fill='#001133'/>
            <circle cx='50' cy='50' r='18' fill='url(#arc-core)' filter='url(#arc-glow)'/>
            <path d='M50 37 L62 56 L38 56 Z' fill='none' stroke='#ffffff' stroke-width='1.5' stroke-linejoin='round' opacity='0.9' filter='url(#arc-glow)'/>
            <circle cx='50' cy='50' r='4' fill='#ffffff' filter='url(#arc-glow)'/></svg>
        `)}`,
        
        web: `data:image/svg+xml;base64,${btoa(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><filter id='w-s' x='-20%' y='-20%' width='140%' height='140%'><feDropShadow dx='0' dy='1.5' stdDeviation='1.5' flood-opacity='0.4'/></filter><linearGradient id='w-g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='#ff1a3d'/><stop offset='100%' stop-color='#c8102e'/></linearGradient></defs><g stroke='url(#w-g)' fill='none' filter='url(#w-s)' stroke-linecap='round' stroke-linejoin='round'><path d='M50 50 L50 5 M50 50 L81.82 18.18 M50 50 L95 50 M50 50 L81.82 81.82 M50 50 L50 95 M50 50 L18.18 81.82 M50 50 L5 50 M50 50 L18.18 18.18' stroke-width='2'/><path d='M50 38 L58.49 41.51 L62 50 L58.49 58.49 L50 62 L41.51 58.49 L38 50 L41.51 41.51 Z' stroke-width='1.5'/><path d='M50 26 L66.97 33.03 L74 50 L66.97 66.97 L50 74 L33.03 66.97 L26 50 L33.03 33.03 Z' stroke-width='1.5'/><path d='M50 14 L75.46 24.54 L86 50 L75.46 75.46 L50 86 L24.54 75.46 L14 50 L24.54 24.54 Z' stroke-width='1.5'/><path d='M50 5 L81.82 18.18 L95 50 L81.82 81.82 L50 95 L18.18 81.82 L5 50 L18.18 18.18 Z' stroke-width='1.5'/><circle cx='50' cy='50' r='3' fill='#ff1a3d' stroke='none'/></g></svg>`)}`,

        arrow: `data:image/svg+xml;base64,${btoa(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='a-m' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#ddd'/><stop offset='0.5' stop-color='#fff'/><stop offset='1' stop-color='#aaa'/></linearGradient><linearGradient id='a-s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#888'/><stop offset='1' stop-color='#333'/></linearGradient></defs><rect x='47' y='25' width='6' height='60' fill='url(#a-s)' rx='1'/><polygon points='50,10 42,28 50,24 58,28' fill='url(#a-m)' stroke='#444' stroke-width='1'/><polygon points='50,10 50,24 58,28' fill='#fff' opacity='0.6'/><path d='M47 70 L35 85 L47 80 Z' fill='#6a0dad' stroke='#333' stroke-width='0.5'/><path d='M53 70 L65 85 L53 80 Z' fill='#6a0dad' stroke='#333' stroke-width='0.5'/><path d='M47 78 L38 92 L47 88 Z' fill='#6a0dad' stroke='#333' stroke-width='0.5'/><path d='M53 78 L62 92 L53 88 Z' fill='#6a0dad' stroke='#333' stroke-width='0.5'/></svg>`)}`,
        
        tesseract: `data:image/svg+xml;base64,${btoa(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><radialGradient id='t-glow' cx='50%' cy='50%' r='50%'><stop offset='0%' stop-color='#00ffff' stop-opacity='0.5'/><stop offset='50%' stop-color='#0066ff' stop-opacity='0.2'/><stop offset='100%' stop-color='#001144' stop-opacity='0'/></radialGradient><linearGradient id='f-top' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='#00ffff'/><stop offset='100%' stop-color='#00aaff'/></linearGradient><linearGradient id='f-right' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='#0088ff'/><stop offset='100%' stop-color='#003399'/></linearGradient><linearGradient id='f-left' x1='0%' y1='0%' x2='0%' y2='100%'><stop offset='0%' stop-color='#00ccff'/><stop offset='100%' stop-color='#0055cc'/></linearGradient><radialGradient id='core-glow' cx='50%' cy='50%' r='50%'><stop offset='0%' stop-color='#ffffff'/><stop offset='40%' stop-color='#00ffff'/><stop offset='100%' stop-color='#0088ff' stop-opacity='0'/></radialGradient><filter id='blur-glow' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='5'/></filter></defs><circle cx='50' cy='50' r='48' fill='url(#t-glow)' filter='url(#blur-glow)'/><polygon points='50,20 76,35 50,50 24,35' fill='url(#f-top)' stroke='#00ffff' stroke-width='1' stroke-opacity='0.8'/><polygon points='50,50 76,35 76,65 50,80' fill='url(#f-right)' stroke='#0088ff' stroke-width='1' stroke-opacity='0.6'/><polygon points='50,50 24,35 24,65 50,80' fill='url(#f-left)' stroke='#00ccff' stroke-width='1' stroke-opacity='0.7'/><polygon points='50,38 60.4,44 50,50 39.6,44' fill='url(#core-glow)' opacity='0.9'/><polygon points='50,50 60.4,44 60.4,56 50,62' fill='#00ffff' opacity='0.6'/><polygon points='50,50 39.6,44 39.6,56 50,62' fill='#0088ff' opacity='0.7'/><line x1='50' y1='20' x2='50' y2='38' stroke='#ffffff' stroke-width='1.5' stroke-opacity='0.7'/><line x1='76' y1='35' x2='60.4' y2='44' stroke='#ffffff' stroke-width='1.5' stroke-opacity='0.7'/><line x1='76' y1='65' x2='60.4' y2='56' stroke='#ffffff' stroke-width='1.5' stroke-opacity='0.7'/><line x1='50' y1='80' x2='50' y2='62' stroke='#ffffff' stroke-width='1.5' stroke-opacity='0.7'/><line x1='24' y1='65' x2='39.6' y2='56' stroke='#ffffff' stroke-width='1.5' stroke-opacity='0.7'/><line x1='24' y1='35' x2='39.6' y2='44' stroke='#ffffff' stroke-width='1.5' stroke-opacity='0.7'/><path d='M 50 20 L 76 35 L 76 65 L 50 80 L 24 65 L 24 35 Z' fill='none' stroke='#ffffff' stroke-width='2' stroke-opacity='0.5' filter='url(#blur-glow)'/></svg>`)}`,
        
        star: `data:image/svg+xml;base64,${btoa(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='captain-gold' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='#FFF9C4'/><stop offset='20%' stop-color='#FFD700'/><stop offset='45%' stop-color='#B8860B'/><stop offset='55%' stop-color='#FFF9C4'/><stop offset='80%' stop-color='#FFD700'/><stop offset='100%' stop-color='#8B6508'/></linearGradient><linearGradient id='line-gold' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='#FFFFFF'/><stop offset='40%' stop-color='#FFF9C4'/><stop offset='60%' stop-color='#FFE082'/><stop offset='100%' stop-color='#FFFFFF'/></linearGradient><filter id='star-shadow' x='-20%' y='-20%' width='140%' height='140%'><feDropShadow dx='0' dy='2' stdDeviation='2.5' flood-color='#000' flood-opacity='0.35'/></filter></defs><path d='M 50 4 L 55.51 35.22 L 70.37 27.37 L 63.30 43.88 L 91.4 50 L 63.30 56.12 L 70.37 72.63 L 55.51 64.78 L 50 96 L 44.49 64.78 L 29.63 72.63 L 36.70 56.12 L 8.6 50 L 36.70 43.88 L 29.63 27.37 L 44.49 35.22 Z' fill='url(#captain-gold)' stroke='#996515' stroke-width='1.5' stroke-linejoin='round' filter='url(#star-shadow)'/><g stroke='url(#line-gold)' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round' opacity='0.85'><path d='M 50 50 L 50 4 M 50 50 L 70.37 27.37 M 50 50 L 91.4 50 M 50 50 L 70.37 72.63 M 50 50 L 50 96 M 50 50 L 29.63 72.63 M 50 50 L 8.6 50 M 50 50 L 29.63 27.37'/><path d='M 55.51 35.22 L 50 4 M 55.51 35.22 L 70.37 27.37 M 63.30 43.88 L 70.37 27.37 M 63.30 43.88 L 91.4 50 M 63.30 56.12 L 91.4 50 M 63.30 56.12 L 70.37 72.63 M 55.51 64.78 L 70.37 72.63 M 55.51 64.78 L 50 96 M 44.49 64.78 L 50 96 M 44.49 64.78 L 29.63 72.63 M 36.70 56.12 L 29.63 72.63 M 36.70 56.12 L 8.6 50 M 36.70 43.88 L 8.6 50 M 36.70 43.88 L 29.63 27.37 M 44.49 35.22 L 29.63 27.37 M 44.49 35.22 L 50 4'/></g></svg>`)}`,    
        
        // infinityStones: `data:image/svg+xml;base64,${btoa(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><defs><filter id='glow' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='3'/></filter><filter id='soft-glow' x='-50%' y='-50%' width='200%' height='200%'><feGaussianBlur stdDeviation='1.5'/></filter><radialGradient id='nexus' cx='50%' cy='50%' r='50%'><stop offset='0%' stop-color='#ffffff'/><stop offset='50%' stop-color='#a29bfe'/><stop offset='100%' stop-color='#6c5ce7' stop-opacity='0'/></radialGradient></defs><rect x='0' y='0' width='200' height='200' rx='20' fill='#050510'/><circle cx='40' cy='30' r='1' fill='#fff' opacity='0.6'/><circle cx='160' cy='40' r='1.5' fill='#fff' opacity='0.4'/><circle cx='170' cy='160' r='1' fill='#fff' opacity='0.7'/><circle cx='30' cy='170' r='1.2' fill='#fff' opacity='0.5'/><circle cx='100' cy='100' r='65' fill='none' stroke='#6c5ce7' stroke-width='1' stroke-dasharray='4 6' opacity='0.4'/><g stroke='#a29bfe' stroke-width='1' opacity='0.5' filter='url(#soft-glow)'><line x1='100' y1='100' x2='100' y2='35'/><line x1='100' y1='100' x2='156.3' y2='67.5'/><line x1='100' y1='100' x2='156.3' y2='132.5'/><line x1='100' y1='100' x2='100' y2='165'/><line x1='100' y1='100' x2='43.7' y2='132.5'/><line x1='100' y1='100' x2='43.7' y2='67.5'/></g><circle cx='100' cy='100' r='20' fill='url(#nexus)' filter='url(#glow)'/><circle cx='100' cy='100' r='8' fill='#fff' opacity='0.8' filter='url(#soft-glow)'/><!-- power --><g transform='translate(100, 35)'><circle cx='0' cy='0' r='18' fill='#8e44ad' opacity='0.4' filter='url(#glow)'/><path d='M 0,-14 L 6,-11 L 13,-13 L 11,-5 L 15,1 L 9,5 L 11,13 L 3,10 L 0,15 L -5,11 L -13,12 L -11,4 L -15,-1 L -8,-4 L -10,-12 Z' fill='#6c3483' stroke='#d980fa' stroke-width='0.8'/><polygon points='0,-14 6,-11 0,0 -10,-12' fill='#8e44ad' opacity='0.6'/><polygon points='0,0 11,-5 15,1 9,5' fill='#4a235a' opacity='0.5'/><polygon points='0,0 11,13 3,10 0,15' fill='#2e1a47' opacity='0.7'/><path d='M -5,-8 L 2,-2 L -4,6' stroke='#fff' stroke-width='0.5' opacity='0.4'/><path d='M 8,-6 L 4,2 L 10,8' stroke='#000' stroke-width='0.5' opacity='0.4'/></g><!-- space --><g transform='translate(156.3, 67.5)'><circle cx='0' cy='0' r='18' fill='#0088ff' opacity='0.4' filter='url(#glow)'/><polygon points='0,-14 12,-7 0,0 -12,-7' fill='#00bfff' stroke='#00ffff' stroke-width='0.6'/><polygon points='0,0 12,-7 12,7 0,14' fill='#0055cc' stroke='#0088ff' stroke-width='0.6'/><polygon points='0,0 -12,-7 -12,7 0,14' fill='#003399' stroke='#0055cc' stroke-width='0.6'/><polygon points='0,-14 4,-11 0,-7 -4,-11' fill='#fff' opacity='0.3'/><polygon points='0,0 5,-3 0,-7 -5,-3' fill='#fff' opacity='0.2'/><path d='M -8,-4 L 2,2 L 6,-5' stroke='#fff' stroke-width='0.5' opacity='0.5'/><path d='M 4,4 L -2,8 L 2,12' stroke='#000' stroke-width='0.5' opacity='0.3'/></g><!-- reality --><g transform='translate(156.3, 132.5)'><circle cx='0' cy='0' r='18' fill='#d63031' opacity='0.4' filter='url(#glow)'/><path d='M 0,-14 C 9,-11 13,-3 11,5 C 9,13 5,15 0,16 C -7,14 -13,9 -12,1 C -11,-7 -7,-12 0,-14 Z' fill='#c0392b' stroke='#ff7675' stroke-width='0.6'/><polygon points='0,-14 6,-10 0,-4 -8,-8' fill='#e74c3c' opacity='0.7'/><polygon points='0,-4 10,2 4,8 0,16' fill='#922b21' opacity='0.6'/><polygon points='-8,-8 0,-4 -4,4 -12,1' fill='#641e16' opacity='0.5'/><path d='M -6,-6 L 2,-1 L -3,5' stroke='#fff' stroke-width='0.5' opacity='0.4'/><path d='M 5,-5 L 1,2 L 7,8' stroke='#000' stroke-width='0.5' opacity='0.3'/></g><!-- time --><g transform='translate(100, 165)'><circle cx='0' cy='0' r='18' fill='#00b894' opacity='0.4' filter='url(#glow)'/><path d='M 0,-13 L 11,-6 L 12,5 L 2,13 L -10,10 L -13,-2 Z' fill='#00997a' stroke='#55efc4' stroke-width='0.8'/><polygon points='0,-13 5,-8 0,-2 -6,-7' fill='#55efc4' opacity='0.4'/><polygon points='0,-2 8,2 2,10 0,13' fill='#006652' opacity='0.6'/><polygon points='-6,-7 0,-2 -4,5 -10,2' fill='#145a32' opacity='0.5'/><circle cx='0' cy='0' r='4' fill='#004d40' stroke='#55efc4' stroke-width='0.5'/><path d='M -8,-4 L 2,1 L -2,6' stroke='#fff' stroke-width='0.5' opacity='0.5'/></g><!-- mind --><g transform='translate(43.7, 132.5)'><circle cx='0' cy='0' r='18' fill='#fdcb6e' opacity='0.4' filter='url(#glow)'/><path d='M 0,-14 L 9,-8 L 11,2 L 8,12 L 0,15 L -8,11 L -11,0 L -9,-10 Z' fill='#f1c40f' stroke='#ffeaa7' stroke-width='0.8'/><polygon points='0,-14 5,-9 0,-3 -6,-9' fill='#fff' opacity='0.3'/><polygon points='0,-3 7,1 2,9 0,15' fill='#d4ac0d' opacity='0.5'/><polygon points='-6,-9 0,-3 -4,4 -9,-1' fill='#9a7d0a' opacity='0.4'/><path d='M -6,-6 L 2,-1 L -2,5' stroke='#fff' stroke-width='0.5' opacity='0.6'/><path d='M 5,-5 L 1,2 L 6,8' stroke='#000' stroke-width='0.5' opacity='0.2'/></g><!-- soul --><g transform='translate(43.7, 67.5)'><circle cx='0' cy='0' r='18' fill='#e17055' opacity='0.4' filter='url(#glow)'/><path d='M 0,-14 L 8,-6 L 10,4 L 6,12 L 0,15 L -7,11 L -9,2 L -8,-8 Z' fill='#d35400' stroke='#fab1a0' stroke-width='0.8'/><polygon points='0,-14 4,-9 0,-3 -5,-8' fill='#e67e22' opacity='0.6'/><polygon points='0,-3 6,2 2,9 0,15' fill='#a04000' opacity='0.5'/><polygon points='-5,-8 0,-3 -3,4 -8,2' fill='#784212' opacity='0.4'/><path d='M -5,-5 L 2,-1 L -2,4' stroke='#fff' stroke-width='0.5' opacity='0.5'/><path d='M 4,-4 L 0,2 L 5,7' stroke='#000' stroke-width='0.5' opacity='0.3'/></g></svg>`)}`,
    };

  // CONTINUOUS ROLLING ICONS?
const existingIcons = document.querySelectorAll('.timeline-bg-icons');
existingIcons.forEach(el => el.remove());

const bgLayer = document.createElement('div');
bgLayer.className = 'timeline-bg-icons';

const iconKeys = Object.keys(iconSVGs);
const timelineWidth = maxX + 660; // total width of the timeline content

// configuration for the repeating pattern
const iconsPerGroup =2;
const groupWidth = 450; // width of one full set of 5 icons
const iconSize = 120;   // visual size of the icon
const rowYs = [100, 400]; // y positions for top and bottom rows

let seed = 42;
const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
};

const spacingX = groupWidth / iconsPerGroup;

const totalGroups = Math.ceil(timelineWidth / groupWidth) + 2; 

let iconIndex = 0;

// icons for both rows
rowYs.forEach(yPos => {
    for (let g = 0; g < totalGroups; g++) {
        for (let i = 0; i < iconsPerGroup; i++) {
            const icon = document.createElement('div');
            icon.className = 'tl-bg-icon';
            
            // cycle through icons
            const keyIndex = iconIndex % iconKeys.length;
            icon.style.backgroundImage = `url("${iconSVGs[iconKeys[keyIndex]]}")`;
            
            // calculate position: group start + icon offset
            const x = (g * groupWidth) + (i * spacingX) + (spacingX / 2) - (iconSize / 2);
            
            icon.style.left = `${x}px`;
            icon.style.top = `${yPos}px`;
            
            // random rotation and scale
            const rotation = Math.floor(rand() * 360);
            const scale = 0.8 + rand() * 0.4;
            icon.style.transform = `rotate(${rotation}deg) scale(${scale})`;
            
            bgLayer.appendChild(icon);
            iconIndex++;
        }
    }
});

const wrapper = document.querySelector('.timeline-wrapper');

bgLayer.style.width = `${timelineWidth + 200}px`; 
bgLayer.style.height = '620px';
wrapper.appendChild(bgLayer);
}

function createTimelineItem(item, xPos, isTop) {
    const div = document.createElement('div');
    const uid = getUniqueId(item);
    div.className = `tl-item ${isTop ? 'tl-top' : 'tl-bottom'}`;
    div.setAttribute('data-title', item.title || 'Unknown');
    div.setAttribute('data-uid', uid);
    div.style.left = `${xPos}px`;
    div.onclick = () => openModal(item);

    if (watchedItems[uid]) div.classList.add('watched');

    const rawImage = item.image || PLACEHOLDER_IMAGE;
    const baseImage = rawImage.replace(/\.(webp|jpe?g|png)$/i, '');
    const safeImageName = rawImage.replace(/'/g, "\\'");

    const labelContent = isTop 
        ? `<div class="tl-title">${item.title || 'Unknown'}</div><div class="tl-year">${item.timeline || 'N/A'}</div>`
        : `<div class="tl-year">${item.timeline || 'N/A'}</div><div class="tl-title">${item.title || 'Unknown'}</div>`;

    div.innerHTML = `
        <div class="tl-branch"></div>
        <div class="tl-node"></div>
        <div class="tl-label">${labelContent}</div>
        <div class="tl-popup">
            <div class="tl-popup-img">
                <img src="${IMAGE_PATH}${baseImage}.webp" alt="${item.title || 'Unknown'}" onerror="handleImageError(this, '${safeImageName}')">
            </div>
        </div>
    `;
    return div;
}

// card
function createCard(item, idx, showNum = true) {
    const card = document.createElement('div');
    const uid = getUniqueId(item);
    card.className = 'card';

    const isW = watchedItems[uid];
    const isS = skippedItems[uid];
    if (isW) card.classList.add('watched');
    if (isS) card.classList.add('skipped');

    card.setAttribute('data-title', item.title || 'Unknown Title');
    card.setAttribute('data-uid', uid);
    card.onclick = (e) => {
        if (e.target.closest('.card-action-btn')) return;
        openModal(item);
    };

    const rawImage = item.image || PLACEHOLDER_IMAGE;
    const baseImage = rawImage.replace(/\.(webp|jpe?g|png)$/i, '');
    const safeImageName = rawImage.replace(/'/g, "\\'");

    card.innerHTML = `
        <div class="card-img">
            <img src="${IMAGE_PATH}${baseImage}.webp" alt="${item.title || 'Unknown'}" onerror="handleImageError(this, '${safeImageName}')">
        </div>
        ${showNum ? `<div class="card-num">No. ${String(idx + 1).padStart(2, '0')}</div>` : ''}
        <div class="card-title">${item.title || 'Unknown Title'}</div>
        <div class="card-meta">${item.year || 'N/A'} · ${item.universe || 'N/A'}</div>
        <div class="card-actions">
            <button class="card-action-btn watched-btn ${isW ? 'active' : ''}" data-action="watch" title="Mark as viewed">
                <span class="btn-icon">✓</span> ${isW ? 'Watched' : 'Watch'}
            </button>
            <button class="card-action-btn skip-btn ${isS ? 'active' : ''}" data-action="skip" title="Skip this entry">
                <span class="btn-icon">⊘</span> ${isS ? 'Unskip' : 'Skip'}
            </button>
        </div>
    `;

    const watchBtn = card.querySelector('[data-action="watch"]');
    const skipBtn = card.querySelector('[data-action="skip"]');
    watchBtn.onclick = (e) => { e.stopPropagation(); markWatched(item); };
    skipBtn.onclick = (e) => { e.stopPropagation(); markSkipped(item); };

    return card;
}

// unified sorting
function getSortedData() {
    return [...marvelData].sort((a, b) => {
        if (sortMode === 'release') {
            const yearA = parseInt(a.year) || 9999;
            const yearB = parseInt(b.year) || 9999;
            if (yearA !== yearB) return yearA - yearB;
            return (a.title || '').localeCompare(b.title || '');
        }
        return (a.position || 0) - (b.position || 0);
    });
}

// view rendering
function renderCatalog() {
    const grid = document.getElementById('catalogGrid');
    grid.innerHTML = '';
    const sorted = getSortedData();
    sorted.forEach((item, idx) => {
        try { grid.appendChild(createCard(item, idx, true)); }
        catch (e) { console.error('Catalog render error:', item, e); }
    });
    document.getElementById('catalogCount').textContent = marvelData.length;
    document.getElementById('catalogShowing').textContent = `${marvelData.length} entries`;
    applyFilters();
}

function renderWatchedView() {
    const grid = document.getElementById('watchedGrid');
    grid.innerHTML = '';
    const watched = getSortedData().filter(i => watchedItems[getUniqueId(i)]);
    watched.forEach((item, idx) => {
        try { grid.appendChild(createCard(item, idx, false)); }
        catch (e) { console.error('Watched render error on item:', item, e); }
    });
    document.getElementById('watchedTabCount').textContent = watched.length;
    document.getElementById('watchedShowing').textContent = `${watched.length} ${watched.length === 1 ? 'entry' : 'entries'}`;
    updateEmptyStates();
}

function renderRemainingView() {
    const grid = document.getElementById('remainingGrid');
    grid.innerHTML = '';
    const remaining = getSortedData().filter(i => !watchedItems[getUniqueId(i)] && !skippedItems[getUniqueId(i)]);
    remaining.forEach((item, idx) => {
        try { grid.appendChild(createCard(item, idx, false)); }
        catch (e) { console.error('Remaining render error on item:', item, e); }
    });
    document.getElementById('remainingTabCount').textContent = remaining.length;
    document.getElementById('remainingShowing').textContent = `${remaining.length} ${remaining.length === 1 ? 'entry' : 'entries'}`;
    updateEmptyStates();
}

function renderSkippedView() {
    const grid = document.getElementById('skippedGrid');
    if (!grid) return;
    grid.innerHTML = '';
    const skipped = getSortedData().filter(i => skippedItems[getUniqueId(i)]);
    skipped.forEach((item, idx) => {
        try { grid.appendChild(createCard(item, idx, false)); }
        catch (e) { console.error('Skipped render error on item:', item, e); }
    });
    document.getElementById('skippedTabCount').textContent = skipped.length;
    document.getElementById('skippedShowing').textContent = `${skipped.length} ${skipped.length === 1 ? 'entry' : 'entries'}`;
    updateEmptyStates();
}

// mark Watched/Skipped
function markWatched(item) {
    const uid = getUniqueId(item);
    if (watchedItems[uid]) {
        delete watchedItems[uid];
    } else {
        delete skippedItems[uid];
        watchedItems[uid] = true;
    }
    persistAndRefresh(uid);
}

function markSkipped(item) {
    const uid = getUniqueId(item);
    if (skippedItems[uid]) {
        delete skippedItems[uid];
    } else {
        delete watchedItems[uid];
        skippedItems[uid] = true;
    }
    persistAndRefresh(uid);
}

function persistAndRefresh(uid) {
    localStorage.setItem('marvelWatched', JSON.stringify(watchedItems));
    localStorage.setItem('marvelSkipped', JSON.stringify(skippedItems));

    document.querySelectorAll(`.card[data-uid="${CSS.escape(uid)}"]`).forEach(card => {
        card.classList.toggle('watched', !!watchedItems[uid]);
        card.classList.toggle('skipped', !!skippedItems[uid]);
        const wBtn = card.querySelector('.watched-btn');
        const sBtn = card.querySelector('.skip-btn');
        
        if (wBtn) {
            wBtn.classList.toggle('active', !!watchedItems[uid]);
            wBtn.innerHTML = `<span class="btn-icon">✓</span> ${watchedItems[uid] ? 'Watched' : 'Watch'}`;
        }
        if (sBtn) {
            sBtn.classList.toggle('active', !!skippedItems[uid]);
            sBtn.innerHTML = `<span class="btn-icon">⊘</span> ${skippedItems[uid] ? 'Unskip' : 'Skip'}`;
        }
    });

    const tlEl = document.querySelector(`.tl-item[data-uid="${CSS.escape(uid)}"]`);
    if (tlEl) tlEl.classList.toggle('watched', !!watchedItems[uid]);

    if (currentModalItem && getUniqueId(currentModalItem) === uid) {
        updateToggle();
        updateSkipBtn();
    }

    renderWatchedView();
    renderRemainingView();
    renderSkippedView();
    applyFilters();
    updateStats();
}

// sort toggle
function toggleSortMode() {
    sortMode = sortMode === 'chronological' ? 'release' : 'chronological';
    updateSortToggleUI();
    renderCatalog();
    renderWatchedView();
    renderRemainingView();
    renderSkippedView();
}

function updateSortToggleUI() {
    const btn = document.getElementById('sortToggleBtn');
    if (!btn) return;
    const label = btn.querySelector('.sort-toggle-label');
    if (label) {
        label.textContent = sortMode === 'chronological' ? 'Chronological' : 'Release Order';
    }
    btn.classList.toggle('active-release', sortMode === 'release');
}

// grid size toggle 
function applyGridSize() {
    document.querySelectorAll('.card-grid').forEach(grid => {
        grid.classList.toggle('compact', isCompactGrid);
    });
    
    const btn = document.getElementById('gridSizeToggleBtn');
    if (btn) {
        const label = btn.querySelector('.sort-toggle-label');
        const icon = btn.querySelector('.sort-toggle-icon');
        if (label) label.textContent = isCompactGrid ? 'Compact' : 'Standard';
        if (icon) icon.textContent = isCompactGrid ? '⊞' : '⊟';
    }
}

function toggleGridSize() {
    isCompactGrid = !isCompactGrid;
    localStorage.setItem('marvelCompactGrid', isCompactGrid);
    applyGridSize();
}

// modal
function openModal(item) {
    currentModalItem = item;
    const rawImage = item.image || PLACEHOLDER_IMAGE;
    const baseImage = rawImage.replace(/.(webp|jpe?g|png)$/i, '');
    const modalImg = document.getElementById('modalImage');
    modalImg.src = `${IMAGE_PATH}${baseImage}.webp`;
    modalImg.onerror = function() { handleImageError(this, rawImage); };

    document.getElementById('modalEyebrow').textContent = `${item.studio || 'N/A'} · ${item.universe || 'N/A'}`;
    document.getElementById('modalTitle').textContent = item.title || 'Unknown';
    document.getElementById('modalRuntime').textContent = item.runtime || 'N/A';
    document.getElementById('modalYear').textContent = item.year || 'N/A';
    document.getElementById('modalTimeline').textContent = item.timeline || 'N/A';
    document.getElementById('modalPhase').textContent = item.phase === 'other' ? 'Non-MCU' : (item.phase || 'N/A');

    const universe = document.getElementById('modalUniverse');
    if (universe) universe.closest('.modal-meta-item').style.display = '';
    const studio = document.getElementById('modalStudio');
    if (studio) studio.closest('.modal-meta-item').style.display = '';

    let desc = item.description || 'No description available.';
    if (desc.includes('\n- ') || desc.includes('\r\n- ')) {
        const parts = desc.split(/\r?\n- /);
        desc = `<p>${parts[0]}</p><ul style="padding-left: 35px; margin: 8px 0;">` + parts.slice(1).map(p => `<li>${p}</li>`).join('') + '</ul>';
    }
    document.getElementById('modalDescription').innerHTML = desc;

    const runtimeEl = document.getElementById('modalRuntime').parentElement;
    const timelineEl = document.getElementById('modalTimeline').parentElement;
    runtimeEl.parentNode.insertBefore(timelineEl, runtimeEl);

    updateToggle();
    updateSkipBtn();

    const navItems = marvelData.filter(item => {
        if (currentView === 'watched' && !watchedItems[getUniqueId(item)]) return false;
        if (currentView === 'remaining' && (watchedItems[getUniqueId(item)] || skippedItems[getUniqueId(item)])) return false;
        if (currentView === 'skipped' && !skippedItems[getUniqueId(item)]) return false;
        return true;
    });

    const currentIndex = navItems.findIndex(i => getUniqueId(i) === getUniqueId(item));
    const prevBtn = document.getElementById('modalPrev');
    const nextBtn = document.getElementById('modalNext');

    if (prevBtn) {
        prevBtn.disabled = currentIndex <= 0;
        prevBtn.onclick = () => { if (currentIndex > 0) openModal(navItems[currentIndex - 1]); };
    }
    if (nextBtn) {
        nextBtn.disabled = currentIndex >= navItems.length - 1;
        nextBtn.onclick = () => { if (currentIndex < navItems.length - 1) openModal(navItems[currentIndex + 1]); };
    }

    document.getElementById('modalOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal(e) {
    if (!e || e.target.id === 'modalOverlay' || e.target.className === 'modal-close') {
        document.getElementById('modalOverlay').classList.remove('active');
        document.body.style.overflow = '';
        currentModalItem = null;
    }
}

function toggleWatchedFromModal() {
    if (!currentModalItem) return;
    markWatched(currentModalItem);
}

function toggleSkippedFromModal() {
    if (!currentModalItem) return;
    markSkipped(currentModalItem);
}

function updateToggle() {
    const track = document.getElementById('toggleTrack');
    const label = document.getElementById('toggleLabel');
    if (currentModalItem && watchedItems[getUniqueId(currentModalItem)]) {
        track.classList.add('on');
        if (label) label.textContent = 'Viewed - click to unmark';
    } else {
        track.classList.remove('on');
        if (label) label.textContent = 'I have viewed this entry';
    }
}

function updateSkipBtn() {
    const btn = document.getElementById('skipBtn');
    const label = document.getElementById('skipBtnText');
    if (!btn || !currentModalItem) return;
    const isSkipped = skippedItems[getUniqueId(currentModalItem)];
    btn.classList.toggle('active', isSkipped);
    if (label) label.textContent = isSkipped ? 'Unskip entry' : 'Skip this entry';
}

// stats
function updateStats() {
    const total = marvelData.length;
    const watched = marvelData.filter(item => watchedItems[getUniqueId(item)]).length;
    const skipped = marvelData.filter(item => skippedItems[getUniqueId(item)]).length;
    const remaining = total - watched - skipped;
    const pct = total > 0 ? Math.round((watched / total) * 100) : 0;

    let totalMins = 0;
    let watchedMins = 0;
    let remainingMins = 0;

    marvelData.forEach(item => {
        const mins = parseRuntimeToMinutes(item.runtime);
        totalMins += mins;
        const uid = getUniqueId(item);
        if (watchedItems[uid]) {
            watchedMins += mins;
        } else if (!skippedItems[uid]) {
            remainingMins += mins;
        }
    });

    const formatHours = (mins) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (h === 0) return `${m} <span class="stat-unit">min</span>`;
        if (m === 0) return `${h} <span class="stat-unit">h</span>`;
        return `${h} <span class="stat-unit">h</span> ${m} <span class="stat-unit">min</span>`;
    };

    document.getElementById('totalCount').textContent = total;
    document.getElementById('watchedCount').textContent = watched;
    document.getElementById('remainingCount').textContent = remaining;
    document.getElementById('skippedCount').textContent = skipped;
    document.getElementById('totalHours').innerHTML = formatHours(totalMins);
    document.getElementById('watchedHours').innerHTML = formatHours(watchedMins);
    document.getElementById('remainingHours').innerHTML = formatHours(remainingMins);
    document.getElementById('progressPercent').textContent = pct + '%';
}

// view switching
function switchView(view) {
    currentView = view;
    document.querySelectorAll('.view-tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
    document.getElementById('catalogView').classList.toggle('active', view === 'catalog');
    document.getElementById('watchedView').classList.toggle('active', view === 'watched');
    document.getElementById('remainingView').classList.toggle('active', view === 'remaining');
    document.getElementById('skippedView').classList.toggle('active', view === 'skipped');

    const target = document.getElementById(view + 'View');
    if (target) {
        setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
}

// click listeners for tabs
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.view-tab').forEach(tab => {
        tab.addEventListener('click', () => switchView(tab.dataset.view));
    });
    document.querySelectorAll('.stat[data-view]').forEach(stat => {
        stat.addEventListener('click', () => switchView(stat.dataset.view));
    });
});

function clearFilters() {
    ['searchBox', 'phaseFilter', 'universeFilter', 'studioFilter', 'eraFilter'].forEach(id => {
        document.getElementById(id).value = '';
    });
    applyFilters();
}

function extractYear(t) {
    if (!t) return 0;
    const m = t.match(/(\d{4})\s*(BC|AD)?/);
    if (m) {
        let y = parseInt(m[1]);
        if (m[2] === 'BC') y = -y;
        return y;
    }
    return 0;
}

// boot and theme
function toggleTheme() {
    document.body.classList.toggle('night-edition');
    const isNight = document.body.classList.contains('night-edition');
    localStorage.setItem('marvelTheme', isNight ? 'night' : 'day');
    updateThemeIcon(isNight);
}

function updateThemeIcon(isNight) {
    const moon = document.querySelector('.theme-icon.moon');
    const sun = document.querySelector('.theme-icon.sun');
    if (moon && sun) {
        moon.style.display = isNight ? 'none' : 'inline';
        sun.style.display = isNight ? 'inline' : 'none';
    }
}

function zoomTimeline(direction) {
    const slider = document.querySelector('.timeline-wrapper');
    const timeline = document.getElementById('timeline');
    const scrollLeft = slider.scrollLeft;
    const clientWidth = slider.clientWidth;
    const center = scrollLeft + clientWidth / 2;
    const oldWidth = timeline.scrollWidth;
    const ratio = oldWidth > 0 ? center / oldWidth : 0.5;

    pixelsPerYear += direction * 30;
    pixelsPerYear = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, pixelsPerYear));

    renderTimeline();

    const newWidth = timeline.scrollWidth;
    const newCenter = ratio * newWidth;
    slider.scrollLeft = newCenter - clientWidth / 2;
}

window.addEventListener('DOMContentLoaded', init);
