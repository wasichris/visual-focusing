/* ===========================================
   Visual Focusing — Website JavaScript
   =========================================== */

(function () {
  'use strict';

  // ========== i18n ==========
  const i18nCache = {};
  let currentLang = 'en';

  async function loadLang(lang) {
    if (i18nCache[lang]) return i18nCache[lang];
    try {
      const res = await fetch(`i18n/${lang}.json`);
      const data = await res.json();
      i18nCache[lang] = data;
      return data;
    } catch (e) {
      console.warn(`Failed to load i18n/${lang}.json`, e);
      return null;
    }
  }

  function applyI18n(translations) {
    if (!translations) return;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (translations[key] !== undefined) {
        el.textContent = translations[key];
      }
    });
  }

  async function setLang(lang) {
    const translations = await loadLang(lang);
    if (!translations) return;
    currentLang = lang;
    document.documentElement.setAttribute('data-lang', lang);
    document.documentElement.setAttribute('lang', lang === 'zh-TW' ? 'zh-Hant-TW' : 'en');
    applyI18n(translations);
    localStorage.setItem('vf-lang', lang);
  }

  function detectLang() {
    const saved = localStorage.getItem('vf-lang');
    if (saved) return saved;
    const browserLang = navigator.language || navigator.userLanguage || '';
    if (browserLang.startsWith('zh')) return 'zh-TW';
    return 'en';
  }

  // ========== Navigation ==========
  function initNav() {
    const nav = document.getElementById('nav');
    const menuToggle = document.getElementById('menuToggle');

    window.addEventListener('scroll', () => {
      nav.classList.toggle('nav--scrolled', window.scrollY > 40);
    }, { passive: true });

    menuToggle.addEventListener('click', () => {
      nav.classList.toggle('nav--open');
    });

    // Close mobile menu on link click
    document.querySelectorAll('.nav__links a').forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('nav--open');
      });
    });
  }

  // ========== Scroll Reveal ==========
  function initReveal() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, idx) => {
        if (entry.isIntersecting) {
          // Stagger siblings
          const parent = entry.target.parentElement;
          const siblings = Array.from(parent.querySelectorAll(':scope > .reveal'));
          const sibIdx = siblings.indexOf(entry.target);
          const delay = sibIdx >= 0 ? sibIdx * 80 : 0;
          setTimeout(() => {
            entry.target.classList.add('visible');
          }, delay);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }

  // ========== Hero Keys Animation ==========
  function initHeroKeys() {
    const keys = ['up', 'right', 'down', 'left'];
    let idx = 0;
    const heroKeys = document.getElementById('heroKeys');
    if (!heroKeys) return;

    function pulse() {
      // Clear all
      heroKeys.querySelectorAll('.hero-key').forEach(k => k.classList.remove('hero-key--active'));
      const dir = keys[idx];
      const key = heroKeys.querySelector(`[data-hk="${dir}"]`);
      if (key) key.classList.add('hero-key--active');
      idx = (idx + 1) % keys.length;
    }

    pulse();
    setInterval(pulse, 1500);
  }

  // ========== Interactive Demo ==========
  function initDemo() {
    const demoEl = document.getElementById('interactiveDemo');
    const desktop = document.getElementById('demoDesktop');
    const keystrokeEl = document.getElementById('demoKeystroke');
    const keystrokeDirEl = document.getElementById('keystrokeDir');
    const focusBadge = document.getElementById('focusBadge');
    if (!demoEl || !desktop) return;

    // Navigation map
    const navMap = {
      vscode:  { up: 'slack',  right: 'browser', down: null,    left: null },
      browser: { left: 'vscode', up: null,       down: null,    right: null },
      slack:   { down: 'vscode', right: 'browser', up: null,    left: null }
    };

    const dirSymbols = { up: '↑', down: '↓', left: '←', right: '→' };
    let activeWindow = 'vscode';
    let autoplayTimer = null;
    let autoplayIdx = 0;
    let keystrokeTimeout = null;
    let isInView = false;

    const autoplaySequence = [
      { from: 'vscode', dir: 'right', to: 'browser' },
      { from: 'browser', dir: 'left', to: 'vscode' },
      { from: 'vscode', dir: 'up', to: 'slack' },
      { from: 'slack', dir: 'down', to: 'vscode' }
    ];

    function setActiveWindow(winId, direction) {
      if (winId === activeWindow) return;

      // Update window classes
      desktop.querySelectorAll('.demo__win').forEach(w => {
        w.classList.remove('demo__win--active');
      });
      const targetWin = document.getElementById(`win-${winId}`);
      if (targetWin) {
        targetWin.classList.add('demo__win--active');
      }

      // Show keystroke
      if (direction && keystrokeDirEl) {
        keystrokeDirEl.textContent = dirSymbols[direction] || '';
        keystrokeEl.classList.add('visible');
        clearTimeout(keystrokeTimeout);
        keystrokeTimeout = setTimeout(() => {
          keystrokeEl.classList.remove('visible');
        }, 1800);
      }

      // Highlight direction arrow
      demoEl.querySelectorAll('.demo__arrow').forEach(a => a.classList.remove('demo__arrow--active'));
      if (direction) {
        const arrow = demoEl.querySelector(`[data-direction="${direction}"]`);
        if (arrow) {
          arrow.classList.add('demo__arrow--active');
          setTimeout(() => arrow.classList.remove('demo__arrow--active'), 600);
        }
      }

      // Position focus badge above the active window
      if (focusBadge && targetWin) {
        const deskRect = desktop.getBoundingClientRect();
        const winRect = targetWin.getBoundingClientRect();
        focusBadge.style.left = (winRect.left - deskRect.left + winRect.width / 2) + 'px';
        focusBadge.style.top = (winRect.top - deskRect.top - 18) + 'px';
        focusBadge.style.transform = 'translateX(-50%)';
        focusBadge.classList.add('visible');
      }

      activeWindow = winId;
    }

    function navigate(direction) {
      const targets = navMap[activeWindow];
      if (!targets) return;
      const target = targets[direction];
      if (!target) {
        // Flash the arrow red briefly to indicate no target
        const arrow = demoEl.querySelector(`[data-direction="${direction}"]`);
        if (arrow) {
          arrow.style.borderColor = 'var(--c-red)';
          arrow.style.color = 'var(--c-red)';
          setTimeout(() => {
            arrow.style.borderColor = '';
            arrow.style.color = '';
          }, 400);
        }
        return;
      }
      setActiveWindow(target, direction);
    }

    // Direction arrow click handlers
    demoEl.querySelectorAll('.demo__arrow').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = btn.getAttribute('data-direction');
        navigate(dir);
        resetAutoplay();
      });
    });

    // Keyboard handlers
    const keyDirMap = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right'
    };

    function onKeydown(e) {
      if (!isInView) return;
      const dir = keyDirMap[e.key];
      if (!dir) return;
      e.preventDefault();
      navigate(dir);
      resetAutoplay();
    }
    document.addEventListener('keydown', onKeydown);

    // Autoplay
    function autoplayStep() {
      const step = autoplaySequence[autoplayIdx];
      if (activeWindow !== step.from) {
        // Resync
        setActiveWindow(step.from, null);
        setTimeout(() => {
          setActiveWindow(step.to, step.dir);
        }, 500);
      } else {
        setActiveWindow(step.to, step.dir);
      }
      autoplayIdx = (autoplayIdx + 1) % autoplaySequence.length;
    }

    function startAutoplay() {
      stopAutoplay();
      autoplayTimer = setInterval(autoplayStep, 2800);
    }

    function stopAutoplay() {
      if (autoplayTimer) {
        clearInterval(autoplayTimer);
        autoplayTimer = null;
      }
    }

    function resetAutoplay() {
      stopAutoplay();
      // Restart after 6s of inactivity
      setTimeout(() => {
        if (isInView) startAutoplay();
      }, 6000);
    }

    // Observe visibility
    const demoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        isInView = entry.isIntersecting;
        if (isInView) {
          startAutoplay();
          // Position focus badge on initial active window
          const win = document.getElementById(`win-${activeWindow}`);
          if (win && focusBadge) {
            const deskRect = desktop.getBoundingClientRect();
            const winRect = win.getBoundingClientRect();
            focusBadge.style.left = (winRect.left - deskRect.left + winRect.width / 2) + 'px';
            focusBadge.style.top = (winRect.top - deskRect.top - 18) + 'px';
            focusBadge.style.transform = 'translateX(-50%)';
            focusBadge.classList.add('visible');
          }
        } else {
          stopAutoplay();
          if (focusBadge) focusBadge.classList.remove('visible');
        }
      });
    }, { threshold: 0.3 });

    demoObserver.observe(demoEl);
  }

  // ========== Init ==========
  async function init() {
    initNav();
    initReveal();
    initHeroKeys();
    initDemo();

    // Language
    const langToggle = document.getElementById('langToggle');
    const initialLang = detectLang();
    await setLang(initialLang);

    langToggle.addEventListener('click', async () => {
      const next = currentLang === 'en' ? 'zh-TW' : 'en';
      await setLang(next);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
