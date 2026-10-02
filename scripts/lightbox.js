/**
 * Dependency-free, accessible, responsive image lightbox with real zoom and pan.
 * Supports mouse wheel zoom, pinch-to-zoom on touch, drag-to-pan, +/- controls,
 * double-click zoom toggle, and keyboard navigation.
 */
(function () {
  'use strict';

  // Lightbox DOM elements
  let lightboxEl = null;
  let backdropEl = null;
  let stageEl = null;
  let imgEl = null;
  let captionEl = null;
  let zoomInBtn = null;
  let zoomOutBtn = null;
  let resetBtn = null;
  let scaleTextEl = null;
  let closeBtn = null;

  // Zoom & Pan state
  const MIN_SCALE = 1;
  const MAX_SCALE = 6;
  const DOUBLE_TAP_SCALE = 2.5;

  let currentScale = 1;
  let translateX = 0;
  let translateY = 0;
  let lastFocusedEl = null;

  // Pointer & Drag tracking
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialTranslateX = 0;
  let initialTranslateY = 0;
  let pointerDownPos = { x: 0, y: 0 };
  let hasMovedSignificantly = false;

  // Touch pinch tracking
  let isPinching = false;
  let pinchStartDist = 0;
  let pinchStartScale = 1;

  // Double-tap tracking for touch devices
  let lastTapTime = 0;

  function createLightboxMarkup() {
    if (document.getElementById('lightbox')) {
      return;
    }

    const html = `
      <div id="lightbox" class="lightbox" role="dialog" aria-modal="true" aria-label="Image viewer" hidden>
        <div class="lightbox-backdrop" aria-hidden="true"></div>
        <div class="lightbox-toolbar" role="toolbar" aria-label="Image zoom controls">
          <button type="button" class="lightbox-btn" id="lightbox-zoom-in" aria-label="Zoom in" title="Zoom in (+)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          <button type="button" class="lightbox-btn" id="lightbox-zoom-out" aria-label="Zoom out" title="Zoom out (-)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          <button type="button" class="lightbox-btn" id="lightbox-reset" aria-label="Reset zoom" title="Reset zoom (0)">
            <span class="lightbox-scale-indicator" id="lightbox-scale-text">100%</span>
          </button>
          <button type="button" class="lightbox-btn lightbox-btn-close" id="lightbox-close" aria-label="Close image viewer" title="Close (Escape)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="lightbox-stage" id="lightbox-stage">
          <img id="lightbox-img" class="lightbox-img" src="" alt="" draggable="false" />
        </div>
        <div class="lightbox-caption" id="lightbox-caption" aria-live="polite"></div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);

    lightboxEl = document.getElementById('lightbox');
    backdropEl = lightboxEl.querySelector('.lightbox-backdrop');
    stageEl = document.getElementById('lightbox-stage');
    imgEl = document.getElementById('lightbox-img');
    captionEl = document.getElementById('lightbox-caption');
    zoomInBtn = document.getElementById('lightbox-zoom-in');
    zoomOutBtn = document.getElementById('lightbox-zoom-out');
    resetBtn = document.getElementById('lightbox-reset');
    scaleTextEl = document.getElementById('lightbox-scale-text');
    closeBtn = document.getElementById('lightbox-close');

    bindEvents();
  }

  function clampTranslation(scale) {
    if (scale <= 1 || !imgEl) {
      translateX = 0;
      translateY = 0;
      return;
    }

    const stageRect = stageEl.getBoundingClientRect();
    const naturalW = imgEl.offsetWidth || stageRect.width * 0.9;
    const naturalH = imgEl.offsetHeight || stageRect.height * 0.85;

    const scaledW = naturalW * scale;
    const scaledH = naturalH * scale;

    const maxPanX = Math.max(0, (scaledW - stageRect.width) / 2 + 40);
    const maxPanY = Math.max(0, (scaledH - stageRect.height) / 2 + 40);

    translateX = Math.max(-maxPanX, Math.min(maxPanX, translateX));
    translateY = Math.max(-maxPanY, Math.min(maxPanY, translateY));
  }

  function updateTransform(skipTransition = false) {
    if (!imgEl) return;

    if (skipTransition) {
      imgEl.style.transition = 'none';
    } else {
      imgEl.style.transition = 'transform 0.15s ease-out';
    }

    imgEl.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${currentScale})`;

    if (currentScale > 1) {
      imgEl.classList.add('is-zoomed');
    } else {
      imgEl.classList.remove('is-zoomed');
    }

    if (scaleTextEl) {
      scaleTextEl.textContent = `${Math.round(currentScale * 100)}%`;
    }

    if (zoomOutBtn) {
      zoomOutBtn.disabled = currentScale <= MIN_SCALE;
      zoomOutBtn.style.opacity = currentScale <= MIN_SCALE ? '0.5' : '1';
    }
    if (zoomInBtn) {
      zoomInBtn.disabled = currentScale >= MAX_SCALE;
      zoomInBtn.style.opacity = currentScale >= MAX_SCALE ? '0.5' : '1';
    }
  }

  function setScale(newScale, focalX, focalY, smooth = true) {
    const clampedScale = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
    if (clampedScale === currentScale) return;

    if (clampedScale === 1) {
      currentScale = 1;
      translateX = 0;
      translateY = 0;
    } else {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const fx = typeof focalX === 'number' ? focalX - centerX : 0;
      const fy = typeof focalY === 'number' ? focalY - centerY : 0;

      const factor = clampedScale / currentScale;
      translateX = fx - factor * (fx - translateX);
      translateY = fy - factor * (fy - translateY);

      currentScale = clampedScale;
      clampTranslation(currentScale);
    }

    updateTransform(!smooth);
  }

  function toggleZoom(focalX, focalY) {
    if (currentScale > 1.2) {
      setScale(1, focalX, focalY, true);
    } else {
      setScale(DOUBLE_TAP_SCALE, focalX, focalY, true);
    }
  }

  function openLightbox(sourceImg) {
    if (!lightboxEl) createLightboxMarkup();

    lastFocusedEl = document.activeElement;

    const fullSrc = sourceImg.currentSrc || sourceImg.src;
    const altText = sourceImg.alt || '';

    imgEl.src = fullSrc;
    imgEl.alt = altText;
    captionEl.textContent = altText;

    currentScale = 1;
    translateX = 0;
    translateY = 0;
    updateTransform(true);

    lightboxEl.hidden = false;
    // Trigger reflow for transition
    void lightboxEl.offsetHeight;
    lightboxEl.classList.add('is-open');

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    closeBtn.focus();
  }

  function closeLightbox() {
    if (!lightboxEl || lightboxEl.hidden) return;

    lightboxEl.classList.remove('is-open');

    setTimeout(() => {
      lightboxEl.hidden = true;
      imgEl.src = '';
      imgEl.alt = '';
      captionEl.textContent = '';
      currentScale = 1;
      translateX = 0;
      translateY = 0;
      updateTransform(true);

      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';

      if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
        lastFocusedEl.focus();
      }
    }, 200);
  }

  function bindEvents() {
    // Zoom control buttons
    zoomInBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setScale(currentScale * 1.3, window.innerWidth / 2, window.innerHeight / 2);
    });

    zoomOutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setScale(currentScale / 1.3, window.innerWidth / 2, window.innerHeight / 2);
    });

    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setScale(1, window.innerWidth / 2, window.innerHeight / 2);
    });

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeLightbox();
    });

    // Close via dark backdrop click
    backdropEl.addEventListener('click', () => {
      closeLightbox();
    });

    // Mouse wheel zoom towards cursor
    stageEl.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.87;
        setScale(currentScale * factor, e.clientX, e.clientY, false);
      },
      { passive: false }
    );

    // Double-click toggle zoom on image
    imgEl.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleZoom(e.clientX, e.clientY);
    });

    // Pointer events for panning and backdrop detection
    stageEl.addEventListener('pointerdown', (e) => {
      // Ignore clicks on controls
      if (e.target.closest('.lightbox-toolbar')) return;

      pointerDownPos = { x: e.clientX, y: e.clientY };
      hasMovedSignificantly = false;

      if (currentScale > 1) {
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        initialTranslateX = translateX;
        initialTranslateY = translateY;
        stageEl.classList.add('is-dragging');
        stageEl.setPointerCapture(e.pointerId);
      }
    });

    stageEl.addEventListener('pointermove', (e) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) {
        hasMovedSignificantly = true;
      }

      if (isDragging && currentScale > 1) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        translateX = initialTranslateX + dx;
        translateY = initialTranslateY + dy;
        clampTranslation(currentScale);
        updateTransform(true);
      }
    });

    const endDrag = (e) => {
      if (isDragging) {
        isDragging = false;
        stageEl.classList.remove('is-dragging');
        try {
          stageEl.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }

      // If user clicked the empty area outside the image without dragging, close
      if (!hasMovedSignificantly && e.target === stageEl) {
        closeLightbox();
      }
    };

    stageEl.addEventListener('pointerup', endDrag);
    stageEl.addEventListener('pointercancel', endDrag);

    // Mobile touch pinch-to-zoom
    stageEl.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 2) {
          isPinching = true;
          pinchStartDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          pinchStartScale = currentScale;
        } else if (e.touches.length === 1 && e.target === imgEl) {
          const now = Date.now();
          if (now - lastTapTime < 300) {
            e.preventDefault();
            toggleZoom(e.touches[0].clientX, e.touches[0].clientY);
          }
          lastTapTime = now;
        }
      },
      { passive: false }
    );

    stageEl.addEventListener(
      'touchmove',
      (e) => {
        if (isPinching && e.touches.length === 2) {
          e.preventDefault();
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          const newScale = pinchStartScale * (dist / pinchStartDist);
          setScale(newScale, midX, midY, false);
        }
      },
      { passive: false }
    );

    stageEl.addEventListener('touchend', (e) => {
      if (e.touches.length < 2 && isPinching) {
        isPinching = false;
        if (currentScale < 1) {
          setScale(1, window.innerWidth / 2, window.innerHeight / 2);
        }
      }
    });

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (!lightboxEl || lightboxEl.hidden) return;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          closeLightbox();
          break;
        case '+':
        case '=':
          e.preventDefault();
          setScale(currentScale * 1.3, window.innerWidth / 2, window.innerHeight / 2);
          break;
        case '-':
        case '_':
          e.preventDefault();
          setScale(currentScale / 1.3, window.innerWidth / 2, window.innerHeight / 2);
          break;
        case '0':
          e.preventDefault();
          setScale(1, window.innerWidth / 2, window.innerHeight / 2);
          break;
        case 'ArrowUp':
          if (currentScale > 1) {
            e.preventDefault();
            translateY += 40;
            clampTranslation(currentScale);
            updateTransform();
          }
          break;
        case 'ArrowDown':
          if (currentScale > 1) {
            e.preventDefault();
            translateY -= 40;
            clampTranslation(currentScale);
            updateTransform();
          }
          break;
        case 'ArrowLeft':
          if (currentScale > 1) {
            e.preventDefault();
            translateX += 40;
            clampTranslation(currentScale);
            updateTransform();
          }
          break;
        case 'ArrowRight':
          if (currentScale > 1) {
            e.preventDefault();
            translateX -= 40;
            clampTranslation(currentScale);
            updateTransform();
          }
          break;
      }
    });
  }

  // Global delegation: Any image clicked on the site opens the lightbox
  document.addEventListener('click', (e) => {
    // Skip if clicking inside the lightbox itself or on interactive controls
    if (e.target.closest('#lightbox')) return;

    const img = e.target.closest('img');
    if (!img) return;

    // Check if image is opt-out
    if (img.hasAttribute('data-no-lightbox')) return;

    // If image is inside a link, prevent navigating away so user can view full image
    if (img.closest('a')) {
      e.preventDefault();
    }

    openLightbox(img);
  });

  // Initialize markup when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createLightboxMarkup);
  } else {
    createLightboxMarkup();
  }
})();
