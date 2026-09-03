/* ============================================================
   velada.js — Inés & Marcel · La Velada
   La coreografía completa: la portada que se abre con el sello, el
   trailer a pantalla completa que se recoge en el arco al deslizar,
   el medallón, las hojas, el mini-film del lugar, el carrete, los
   revelados y los detalles.
   Reglas de rendimiento: solo transform/opacity/clip-path, un único
   rAF acotado para el scroll, IntersectionObserver para lo demás y
   nada corriendo cuando no se ve.
   ============================================================ */
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp01 = (n) => Math.min(1, Math.max(0, n));
  const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

  function safePlay(media) {
    if (!media) return;
    const attempt = media.play();
    if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
  }

  /* iOS ignora volume (siempre 1): el fundido no se nota ahí, pero
     play/pause siguen funcionando. */
  function fadeAudio(audio, to, ms, done) {
    if (!audio) return;
    cancelAnimationFrame(audio.__fade || 0);
    const from = audio.volume;
    const start = performance.now();
    const step = (now) => {
      const k = clamp01((now - start) / ms);
      try { audio.volume = from + (to - from) * k; } catch (error) { /* iOS */ }
      if (k < 1) audio.__fade = requestAnimationFrame(step);
      else if (done) done();
    };
    audio.__fade = requestAnimationFrame(step);
  }

  /* ── 0. Personalización por enlace: ?invitado=Nombre&n=12 ── */
  const params = new URLSearchParams(window.location.search);
  const guestName = (params.get('invitado') || params.get('para') || '').trim().slice(0, 60);
  const guestNumber = (params.get('n') || '').trim().replace(/\D/g, '').slice(0, 4);
  const numberLabel = guestNumber ? `Invitación N.º ${guestNumber.padStart(3, '0')} · Reservado para` : '';
  const sobreNombre = $('#sobre-nombre');
  if (guestName && sobreNombre) sobreNombre.textContent = guestName;
  [['#invitado', '#reservado-k'], ['#portada-invitado', '#portada-k']].forEach(([nameSel, labelSel]) => {
    const nameEl = $(nameSel);
    const labelEl = $(labelSel);
    if (guestName && nameEl) {
      nameEl.textContent = guestName;
      nameEl.classList.add('is-personal');
    }
    if (numberLabel && labelEl) labelEl.textContent = numberLabel;
  });
  if (guestName) document.title = `Inés & Marcel — ${guestName}`;

  /* ── 1. Hojas de olivo (portada y portada de la première) ── */
  function sembrarHojas(container, count) {
    if (!container || reduceMotion) return;
    for (let i = 0; i < count; i += 1) {
      const hoja = document.createElement('span');
      hoja.className = 'hoja';
      hoja.style.left = `${6 + Math.random() * 88}%`;
      hoja.style.width = `${10 + Math.random() * 4}px`;
      hoja.style.setProperty('--dur', `${11 + Math.random() * 7}s`);
      hoja.style.setProperty('--del', `${i * 2.1}s`);
      hoja.style.setProperty('--mec', `${2.2 + Math.random() * 1.2}s`);
      hoja.innerHTML = '<svg viewBox="0 0 14 26" aria-hidden="true"><use href="#hoja"></use></svg>';
      container.appendChild(hoja);
    }
  }
  sembrarHojas($('#hojas'), 6);
  sembrarHojas($('#portada-hojas'), 7);

  /* ── 2. Elementos de la première ── */
  const portada = $('#portada');
  const abrirButton = $('#abrir');
  const hero = $('#inicio');
  const vista = $('#hero-vista');
  const pantalla = $('#pantalla');
  const pantallaVelo = pantalla ? pantalla.querySelector('.pantalla__velo') : null;
  const arco = $('#arco');
  const trailer = $('#trailer');
  const soundButton = $('#sonido');
  const soundText = $('#sonido-txt');
  const tocaButton = $('#toca');
  const medallon = $('#medallon');
  const hueco = $('#medallon-hueco');
  const cancion = $('#cancion');

  let soundUnlocked = false;
  let trailerStarted = false;
  let docked = false;
  let opened = false;
  let armado = false;

  document.documentElement.classList.add('is-locked');
  document.body.classList.add('is-locked');

  function reflejarSonido() {
    if (!soundText || !trailer) return;
    soundText.textContent = trailer.muted ? 'Activar sonido' : 'Sonido';
  }

  function vigilarArranque() {
    [1800, 3600].forEach((ms) => {
      setTimeout(() => {
        if (tocaButton && trailer) tocaButton.hidden = !trailer.paused;
      }, ms);
    });
  }

  function arrancarConSonido() {
    if (!trailer) return;
    trailerStarted = true;
    try { trailer.currentTime = 0; } catch (error) { /* sin metadata todavía */ }
    // Gesto directo en la página: el play con sonido está permitido.
    trailer.muted = false;
    try { trailer.volume = 1; } catch (error) { /* iOS */ }
    const attempt = trailer.play();
    if (attempt && typeof attempt.then === 'function') {
      attempt.then(() => { soundUnlocked = true; reflejarSonido(); }).catch(() => {
        // La imagen nunca se arriesga: en silencio y con el botón de sonido a la vista.
        trailer.muted = true;
        safePlay(trailer);
        reflejarSonido();
      });
    } else {
      soundUnlocked = true;
      reflejarSonido();
    }
    vigilarArranque();
  }

  /* ── 2b. En escritorio, un reflejo desenfocado del trailer llena la pantalla ── */
  const ambiente = $('#ambiente');
  const esEscritorio = window.matchMedia('(min-width: 900px)');
  function sincronizarAmbiente() {
    if (!ambiente || !trailer || !esEscritorio.matches) return;
    if (Math.abs(ambiente.currentTime - trailer.currentTime) > 0.5) {
      try { ambiente.currentTime = trailer.currentTime; } catch (error) { /* buffering */ }
    }
    if (trailer.paused) ambiente.pause(); else safePlay(ambiente);
  }
  if (ambiente && trailer) {
    ambiente.muted = true;
    setInterval(sincronizarAmbiente, 3000);
    trailer.addEventListener('play', sincronizarAmbiente);
    trailer.addEventListener('pause', () => ambiente.pause());
    trailer.addEventListener('seeked', sincronizarAmbiente);
  }

  /* ── 3. La portada: el sello abre la invitación ── */
  function abrir() {
    if (opened) return;
    opened = true;
    document.body.classList.add('is-open');
    if (portada) portada.classList.add('is-opening');
    arrancarConSonido();
    if (ambiente && esEscritorio.matches) { ambiente.preload = 'auto'; safePlay(ambiente); }
    setTimeout(() => {
      if (portada) portada.hidden = true;
      document.documentElement.classList.remove('is-locked');
      document.body.classList.remove('is-locked');
      window.scrollTo(0, 0);
      frame();
    }, reduceMotion ? 50 : 5950);
  }
  if (abrirButton) abrirButton.addEventListener('click', abrir);
  if (!portada) {
    // Sin portada (no debería pasar): la página queda libre.
    document.documentElement.classList.remove('is-locked');
    document.body.classList.remove('is-locked');
  }

  if (soundButton && trailer) {
    soundButton.addEventListener('click', () => {
      trailer.muted = !trailer.muted;
      if (!trailer.muted) {
        try { trailer.volume = 1; } catch (error) { /* iOS */ }
        soundUnlocked = true;
      }
      safePlay(trailer);
      reflejarSonido();
    });
  }

  if (tocaButton && trailer) {
    tocaButton.addEventListener('click', () => {
      trailer.muted = false;
      const attempt = trailer.play();
      if (attempt && typeof attempt.catch === 'function') {
        attempt.catch(() => { trailer.muted = true; safePlay(trailer); });
      }
      soundUnlocked = true;
      tocaButton.hidden = true;
      reflejarSonido();
    });
    trailer.addEventListener('playing', () => { tocaButton.hidden = true; });
  }

  // Vigilante: los navegadores pausan por su cuenta un vídeo mudo "no visible".
  if (trailer) {
    let fallos = 0;
    setInterval(() => {
      if (document.hidden || trailer.ended) return;
      if (!trailer.paused) { fallos = 0; return; }
      fallos += 1;
      if (!soundUnlocked) trailer.muted = true;
      safePlay(trailer);
      if (fallos >= 3 && opened && tocaButton) tocaButton.hidden = false;
    }, 1000);
  }

  /* ── 4. El medallón: el trailer se acopla cuando la première queda atrás ── */
  function dock() {
    if (docked || !trailer || !medallon || !hueco) return;
    docked = true;
    medallon.hidden = false;
    medallon.classList.remove('is-off');
    medallon.classList.add('is-on');
    trailer.muted = true;
    hueco.appendChild(trailer);
    safePlay(trailer);
    if (trailerStarted && cancion) {
      try { cancion.volume = 0; } catch (error) { /* iOS */ }
      safePlay(cancion);
      fadeAudio(cancion, 0.85, 1600);
    }
  }

  function undock() {
    if (!docked || !trailer || !pantalla) return;
    docked = false;
    medallon.classList.remove('is-on');
    medallon.classList.add('is-off');
    setTimeout(() => { if (!docked) medallon.hidden = true; }, 380);
    pantalla.insertBefore(trailer, pantallaVelo);
    if (soundUnlocked) trailer.muted = false;
    reflejarSonido();
    safePlay(trailer);
    if (cancion && !cancion.paused) fadeAudio(cancion, 0, 900, () => cancion.pause());
  }

  if (medallon) {
    medallon.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' });
    });
  }

  /* ── 5. La coreografía del scroll: pantalla completa → arco → medallón ── */
  let ticking = false;
  function frame() {
    ticking = false;
    if (!hero || !vista || !pantalla || !arco) return;
    const vh = vista.clientHeight || window.innerHeight;
    const track = Math.max(1, hero.offsetHeight - vh);
    const t = clamp01(window.scrollY / track);
    const e = reduceMotion ? (t > 0.5 ? 1 : 0) : easeInOut(t);

    // El recorte cierra desde la pantalla completa hasta el rectángulo exacto del arco.
    const a = arco.getBoundingClientRect();
    const v = vista.getBoundingClientRect();
    const top = a.top - v.top;
    const left = a.left - v.left;
    const right = v.width - (left + a.width);
    const bottom = v.height - (top + a.height);
    const rArco = a.width / 2;
    pantalla.style.clipPath = `inset(${(top * e).toFixed(1)}px ${(right * e).toFixed(1)}px ${(bottom * e).toFixed(1)}px ${(left * e).toFixed(1)}px round ${(rArco * e).toFixed(1)}px ${(rArco * e).toFixed(1)}px ${(16 * e).toFixed(1)}px ${(16 * e).toFixed(1)}px)`;

    // Lo que rodea al arco aparece en la segunda mitad del recorrido.
    hero.style.setProperty('--tc', clamp01((t - 0.45) / 0.55).toFixed(3));
    pantalla.classList.toggle('is-en-arco', t > 0.97);
    if (t > 0.85 && !armado) {
      armado = true;
      hero.classList.add('is-armado');
    }

    // Más allá de la première, el trailer se acopla como medallón.
    const heroBottom = hero.getBoundingClientRect().bottom;
    if (heroBottom < 60) dock();
    else if (heroBottom > vh * 0.45) undock();

    hero.classList.toggle('is-visible', heroBottom > 0);
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(frame);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  window.addEventListener('load', frame);
  frame();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (cancion && !cancion.paused) cancion.pause();
    } else {
      safePlay(trailer);
      if (docked && trailerStarted && cancion) safePlay(cancion);
    }
  });

  /* ── 6. Revelados: cada sección entra una vez, sus hijos .r escalonados ── */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      revealObserver.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
  $$('.reveal').forEach((el) => revealObserver.observe(el));

  /* ── 7. Mini-film del lugar: solo se mueve cuando se ve ── */
  const minifilm = $('#minifilm');
  if (minifilm) {
    new IntersectionObserver((entries) => {
      entries.forEach((entry) => minifilm.classList.toggle('is-on', entry.isIntersecting));
    }, { threshold: 0.2 }).observe(minifilm);
  }

  /* ── 8. El precio se cuenta hacia arriba al llegar al menú ── */
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
          const k = clamp01((now - start) / duration);
          const eased = 1 - Math.pow(1 - k, 3);
          monto.textContent = formatColones(40000 * eased);
          if (k < 1) requestAnimationFrame(step);
          else monto.textContent = '40.000';
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.3 }).observe(menuSection);
  }

  /* ── 9. Sinpe: un toque copia el número ── */
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

  /* ── 10. El carrete: se desliza solo; un toque lleva el trailer a ese segundo ── */
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

    $$('.fotograma[data-tc]', pista).forEach((frameEl) => {
      frameEl.addEventListener('click', () => {
        const tc = Number(frameEl.dataset.tc);
        if (!Number.isFinite(tc) || !trailer) return;
        trailerStarted = true;
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' });
        setTimeout(() => {
          try { trailer.currentTime = tc; } catch (error) { /* sin metadata */ }
          if (soundUnlocked) trailer.muted = false;
          reflejarSonido();
          safePlay(trailer);
        }, docked ? 700 : 80);
      });
    });
  }
})();
