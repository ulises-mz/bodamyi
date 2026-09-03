/* ============================================================
   velada.js — Inés & Marcel · La Velada
   La coreografía: la première del trailer, el medallón, las hojas,
   el mini-film del lugar, el carrete, los revelados y los detalles.
   Reglas de rendimiento: solo transform/opacity, IntersectionObserver
   para todo lo que depende del scroll, rAF acotado y nada corriendo
   cuando no se ve.
   ============================================================ */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function safePlay(media) {
    if (!media) return;
    const attempt = media.play();
    if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
  }

  /* iOS ignora volume (siempre 1): el fundido simplemente no se nota
     ahí, pero play/pause siguen funcionando. */
  function fadeAudio(audio, to, ms, done) {
    if (!audio) return;
    cancelAnimationFrame(audio.__fade || 0);
    const from = audio.volume;
    const start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / ms);
      try { audio.volume = from + (to - from) * k; } catch (error) { /* iOS */ }
      if (k < 1) audio.__fade = requestAnimationFrame(step);
      else if (done) done();
    };
    audio.__fade = requestAnimationFrame(step);
  }

  /* ── 0. Arranque: la première empieza cuando las tipografías están (máx. 1.2 s) ── */
  const ready = () => document.body.classList.add('is-ready');
  if (document.fonts && document.fonts.ready) {
    Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]).then(ready);
  } else {
    setTimeout(ready, 200);
  }

  /* ── 1. Personalización por enlace: ?invitado=Nombre&n=12 ── */
  const params = new URLSearchParams(window.location.search);
  const guestName = (params.get('invitado') || params.get('para') || '').trim().slice(0, 60);
  const guestNumber = (params.get('n') || '').trim().replace(/\D/g, '').slice(0, 4);
  const guestEl = $('#invitado');
  const reservadoK = $('#reservado-k');
  if (guestName && guestEl) {
    guestEl.textContent = guestName;
    guestEl.classList.add('is-personal');
    document.title = `Inés & Marcel — ${guestName}`;
  }
  if (guestNumber && reservadoK) {
    reservadoK.textContent = `Invitación N.º ${guestNumber.padStart(3, '0')} · Reservado para`;
  }

  /* ── 2. Hojas de olivo que caen por la portada ── */
  const hojas = $('#hojas');
  if (hojas && !reduceMotion) {
    for (let i = 0; i < 6; i += 1) {
      const hoja = document.createElement('span');
      hoja.className = 'hoja';
      hoja.style.left = `${8 + Math.random() * 84}%`;
      hoja.style.width = `${10 + Math.random() * 4}px`;
      hoja.style.setProperty('--dur', `${11 + Math.random() * 7}s`);
      hoja.style.setProperty('--del', `${i * 2.3}s`);
      hoja.style.setProperty('--mec', `${2.2 + Math.random() * 1.2}s`);
      hoja.innerHTML = '<svg viewBox="0 0 14 26" aria-hidden="true"><use href="#hoja"></use></svg>';
      hojas.appendChild(hoja);
    }
  }

  /* ── 3. El trailer: première con sonido, medallón al bajar ── */
  const hero = $('#inicio');
  const arco = $('#arco');
  const arcoWrap = $('#arco-wrap');
  const trailer = $('#trailer');
  const velo = arco ? arco.querySelector('.arco__velo') : null;
  const playButton = $('#play');
  const soundButton = $('#sonido');
  const medallon = $('#medallon');
  const hueco = $('#medallon-hueco');
  const cancion = $('#cancion');

  let soundUnlocked = false;
  let trailerStarted = false;
  let docked = false;

  if (trailer && playButton) {
    playButton.addEventListener('click', () => {
      trailerStarted = true;
      arco.classList.add('is-playing');
      try { trailer.currentTime = 0; } catch (error) { /* sin metadata todavía */ }
      // Gesto directo sobre la página: el play con sonido está permitido.
      trailer.muted = false;
      try { trailer.volume = 1; } catch (error) { /* iOS */ }
      const attempt = trailer.play();
      if (attempt && typeof attempt.then === 'function') {
        attempt.then(() => {
          soundUnlocked = true;
          if (soundButton) soundButton.hidden = true;
        }).catch(() => {
          // La imagen nunca se arriesga: en silencio y con el botón de sonido.
          trailer.muted = true;
          safePlay(trailer);
          if (soundButton) soundButton.hidden = false;
        });
      } else {
        soundUnlocked = true;
      }
    });
  }

  if (soundButton) {
    soundButton.addEventListener('click', () => {
      trailer.muted = false;
      try { trailer.volume = 1; } catch (error) { /* iOS */ }
      safePlay(trailer);
      soundUnlocked = true;
      soundButton.hidden = true;
    });
  }

  // Vigilante: los navegadores pausan por su cuenta un vídeo mudo "no visible".
  if (trailer) {
    setInterval(() => {
      if (document.hidden || trailer.ended) return;
      if (!trailer.paused) return;
      if (!soundUnlocked) trailer.muted = true;
      safePlay(trailer);
    }, 1000);
  }

  function dock() {
    if (docked || !trailer || !medallon || !hueco) return;
    docked = true;
    medallon.hidden = false;
    medallon.classList.remove('is-off');
    medallon.classList.add('is-on');
    trailer.muted = true;
    hueco.appendChild(trailer);
    safePlay(trailer);
    // La canción entra cuando el invitado ya dio el gesto del trailer.
    if (trailerStarted && cancion) {
      try { cancion.volume = 0; } catch (error) { /* iOS */ }
      safePlay(cancion);
      fadeAudio(cancion, 0.85, 1600);
    }
  }

  function undock() {
    if (!docked || !trailer || !arco) return;
    docked = false;
    medallon.classList.remove('is-on');
    medallon.classList.add('is-off');
    setTimeout(() => { if (!docked) medallon.hidden = true; }, 380);
    arco.insertBefore(trailer, velo);
    if (soundUnlocked) trailer.muted = false;
    safePlay(trailer);
    if (cancion && !cancion.paused) {
      fadeAudio(cancion, 0, 900, () => cancion.pause());
    }
  }

  if (hero) {
    const heroObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        hero.classList.toggle('is-visible', entry.isIntersecting);
        if (entry.intersectionRatio < 0.12) dock();
        else if (entry.intersectionRatio > 0.35) undock();
      });
    }, { threshold: [0, 0.12, 0.35, 0.6] });
    heroObserver.observe(hero);
  }

  if (medallon) {
    medallon.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' });
    });
  }

  // Al bajar, el arco se encoge y se aleja antes de acoplarse (rAF acotado).
  if (arcoWrap && hero && !reduceMotion) {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const limit = Math.max(1, hero.offsetHeight * 0.55);
        const t = Math.min(1, Math.max(0, window.scrollY / limit));
        arcoWrap.style.transform = `scale(${1 - t * 0.12}) translateY(${(-20 * t).toFixed(1)}px)`;
        arcoWrap.style.opacity = String(1 - t * 0.35);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (cancion && !cancion.paused) cancion.pause();
    } else {
      safePlay(trailer);
      if (docked && trailerStarted && cancion) safePlay(cancion);
    }
  });

  /* ── 4. Revelados: cada sección entra una vez, sus hijos .r escalonados ── */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      revealObserver.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
  $$('.reveal').forEach((el) => revealObserver.observe(el));

  /* ── 5. Mini-film del lugar: solo se mueve cuando se ve ── */
  const minifilm = $('#minifilm');
  if (minifilm) {
    new IntersectionObserver((entries) => {
      entries.forEach((entry) => minifilm.classList.toggle('is-on', entry.isIntersecting));
    }, { threshold: 0.2 }).observe(minifilm);
  }

  /* ── 6. El precio se cuenta hacia arriba al llegar al menú ── */
  const monto = $('#monto');
  const menuSection = $('#menu');
  const formatColones = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (monto && menuSection && !reduceMotion) {
    let counted = false;
    new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting || counted) return;
        counted = true;
        const start = performance.now();
        const duration = 1400;
        monto.textContent = '0';
        const step = (now) => {
          const k = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - k, 3);
          monto.textContent = formatColones(40000 * eased);
          if (k < 1) requestAnimationFrame(step);
          else monto.textContent = '40.000';
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.3 }).observe(menuSection);
  }

  /* ── 7. Sinpe: un toque copia el número ── */
  const sinpeButton = $('#copiar-sinpe');
  const sinpeOk = $('#sinpe-ok');
  if (sinpeButton) {
    sinpeButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText('60720983');
        if (sinpeOk) {
          sinpeOk.hidden = false;
          setTimeout(() => { sinpeOk.hidden = true; }, 1600);
        }
      } catch (error) {
        window.prompt('Sinpe Móvil de Marcel', '6072-0983');
      }
    });
  }

  /* ── 8. El carrete: se desliza solo cuando nadie lo toca; un toque lleva el trailer a ese segundo ── */
  const carrete = $('#carrete');
  const pista = $('#pista');
  if (carrete && pista) {
    let visible = false;
    let idle = true;
    let idleTimer = 0;
    let programmatic = false;
    let direction = 1;

    const touched = () => {
      if (programmatic) return;
      idle = false;
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { idle = true; }, 5000);
    };
    pista.addEventListener('scroll', touched, { passive: true });
    pista.addEventListener('pointerdown', touched, { passive: true });
    pista.addEventListener('touchstart', touched, { passive: true });

    new IntersectionObserver((entries) => {
      entries.forEach((entry) => { visible = entry.isIntersecting; });
    }, { threshold: 0.3 }).observe(carrete);

    if (!reduceMotion) {
      let last = performance.now();
      const glide = (now) => {
        const dt = Math.min(48, now - last);
        last = now;
        if (visible && idle && !document.hidden) {
          const max = pista.scrollWidth - pista.clientWidth;
          if (max > 0) {
            programmatic = true;
            pista.scrollLeft += direction * dt * 0.018;
            if (pista.scrollLeft >= max - 1) direction = -1;
            if (pista.scrollLeft <= 1) direction = 1;
            requestAnimationFrame(() => { programmatic = false; });
          }
        }
        requestAnimationFrame(glide);
      };
      requestAnimationFrame(glide);
    }

    $$('.fotograma[data-tc]', pista).forEach((frame) => {
      frame.addEventListener('click', () => {
        const tc = Number(frame.dataset.tc);
        if (!Number.isFinite(tc) || !trailer) return;
        trailerStarted = true;
        if (arco) arco.classList.add('is-playing');
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' });
        // Cuando el arco vuelve a estar en pantalla, el trailer salta a ese segundo.
        setTimeout(() => {
          try { trailer.currentTime = tc; } catch (error) { /* sin metadata */ }
          if (soundUnlocked) trailer.muted = false;
          safePlay(trailer);
        }, docked ? 700 : 80);
      });
    });
  }
})();
