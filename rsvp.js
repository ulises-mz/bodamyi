/* ============================================================
   rsvp.js — Asistente de confirmación por pasos
   Misma lógica y misma tabla (boda_marcel_ines_rsvps) que la
   invitación original: las dos versiones confirman en un solo lugar.
   ============================================================ */
(() => {
  'use strict';

  const RSVP_DEADLINE = new Date('2026-09-15T23:59:59-06:00');

  const rsvpForm = document.getElementById('rsvp-form');
  if (!rsvpForm || typeof RSVP_API === 'undefined') return;

  const attendanceDetailsWrap = document.getElementById('attendance-details-wrap');
  const rsvpThanks = document.getElementById('rsvp-thanks');
  const rsvpSummary = document.getElementById('rsvp-summary');
  const rsvpEditButton = document.getElementById('rsvp-edit-btn');
  const rsvpStatus = document.getElementById('rsvp-status');
  const rsvpDeadlineNote = document.getElementById('rsvp-deadline-note');
  const attendInputs = Array.from(document.querySelectorAll('input[name="attend"]'));
  const rsvpSubmitButton = rsvpForm.querySelector('button[type="submit"]');
  const fullNameInput = rsvpForm.querySelector('input[name="fullName"]');
  const emailInput = rsvpForm.querySelector('input[name="email"]');
  const peopleCountInput = rsvpForm.querySelector('input[name="peopleCount"]');
  const attendeeNamesList = document.getElementById('attendee-names-list');
  const peopleMinusButton = document.getElementById('people-minus');
  const peoplePlusButton = document.getElementById('people-plus');

  let existingRsvpRecord = null;
  let latestSavedRecord = null;
  let lookupRequestVersion = 0;

  function normalizeName(value) {
    return value.toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function splitAttendeeNames(value) {
    return value.toString().split(/[\n,|]+/).map((item) => item.trim()).filter(Boolean);
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function normalizeStoredRecord(record) {
    const fullName = (record?.fullName || '').toString().trim();
    const email = (record?.email || '').toString().trim().toLowerCase();
    const attend = record?.attend === 'no' ? 'no' : 'yes';
    let attendeeNames = Array.isArray(record?.attendeeNames)
      ? record.attendeeNames.map((name) => name.toString().trim()).filter(Boolean)
      : splitAttendeeNames(record?.attendeeNames || '');
    let peopleCount = Number(record?.peopleCount || 0);
    if (!Number.isFinite(peopleCount)) peopleCount = 0;
    if (attend === 'yes') {
      if (!attendeeNames.length && fullName) attendeeNames = [fullName];
      if (peopleCount < 1) peopleCount = attendeeNames.length || 1;
    } else {
      peopleCount = 0;
      attendeeNames = [];
    }
    const groupName = (record?.groupName || '').toString().trim() || fullName || 'Sin grupo definido';
    return {
      id: (record?.id || '').toString().trim() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: (record?.createdAt || '').toString().trim() || new Date().toISOString(),
      updatedAt: (record?.updatedAt || '').toString().trim() || new Date().toISOString(),
      fullName,
      normalizedFullName: normalizeName(fullName),
      email,
      attend,
      groupName,
      normalizedGroupName: normalizeName(groupName),
      peopleCount,
      attendeeNames,
      song: (record?.song || '').toString().trim(),
      message: (record?.message || '').toString().trim(),
    };
  }

  async function lookupRsvpByName(fullName) {
    const normalizedFullName = normalizeName(fullName);
    if (!normalizedFullName) return { ok: true, found: false };
    try {
      const record = await RSVP_API.findByNormalizedName(normalizedFullName);
      return record ? { ok: true, found: true, record } : { ok: true, found: false };
    } catch (error) {
      return { ok: false, error: 'No se pudo verificar tu nombre. Revisa tu conexión a internet.' };
    }
  }

  async function upsertRsvp(payload) {
    const normalizedPayload = normalizeStoredRecord(payload);
    try {
      const existing = await RSVP_API.findByNormalizedName(normalizedPayload.normalizedFullName);
      if (existing && existing.email.toLowerCase() !== normalizedPayload.email.toLowerCase()) {
        return { ok: false, error: 'Este nombre ya confirmó con otro correo. Usa ese correo para editar.' };
      }
      if (existing) {
        const saved = await RSVP_API.update(existing.id, normalizedPayload);
        return { ok: true, mode: 'updated', record: saved || normalizedPayload };
      }
      const saved = await RSVP_API.insert(normalizedPayload);
      return { ok: true, mode: 'created', record: saved || normalizedPayload };
    } catch (error) {
      return { ok: false, error: 'No se pudo guardar tu confirmación. Revisa tu conexión e intenta de nuevo.' };
    }
  }

  const isDeadlinePassed = () => new Date() > RSVP_DEADLINE;

  function setRsvpStatus(message, type = 'info') {
    if (!rsvpStatus) return;
    if (!message) {
      rsvpStatus.hidden = true;
      rsvpStatus.textContent = '';
      delete rsvpStatus.dataset.type;
      return;
    }
    rsvpStatus.hidden = false;
    rsvpStatus.textContent = message;
    rsvpStatus.dataset.type = type;
  }

  function setRsvpSubmitMode(mode) {
    if (!rsvpSubmitButton) return;
    rsvpSubmitButton.textContent = mode === 'edit' ? 'Guardar cambios' : 'Confirmar asistencia';
  }

  function setFormDisabled(disabled) {
    Array.from(rsvpForm.elements).forEach((field) => { field.disabled = disabled; });
  }

  function getAttendeeInputValues() {
    if (!attendeeNamesList) return [];
    return Array.from(attendeeNamesList.querySelectorAll('input')).map((input) => input.value);
  }

  function renderAttendeeInputs(count, values = null) {
    if (!attendeeNamesList) return;
    const current = values || getAttendeeInputValues();
    attendeeNamesList.innerHTML = '';
    for (let i = 0; i < count; i += 1) {
      const input = document.createElement('input');
      input.type = 'text';
      input.name = 'attendeeName';
      input.className = 'rsvp__input';
      input.placeholder = i === 0 ? 'Persona 1 · tu nombre' : `Persona ${i + 1}`;
      input.autocomplete = 'off';
      let value = (current[i] || '').toString();
      if (i === 0 && !value.trim() && fullNameInput) value = fullNameInput.value.trim();
      input.value = value;
      attendeeNamesList.appendChild(input);
    }
  }

  function getPeopleCount() {
    const raw = Number(peopleCountInput ? peopleCountInput.value : 1);
    if (!Number.isFinite(raw)) return 1;
    return Math.max(1, Math.min(12, Math.round(raw)));
  }

  function setPeopleCount(next) {
    if (!peopleCountInput) return;
    const clamped = Math.max(1, Math.min(12, Math.round(next)));
    peopleCountInput.value = String(clamped);
    renderAttendeeInputs(clamped);
  }

  if (peopleMinusButton) peopleMinusButton.addEventListener('click', () => setPeopleCount(getPeopleCount() - 1));
  if (peoplePlusButton) peoplePlusButton.addEventListener('click', () => setPeopleCount(getPeopleCount() + 1));
  if (peopleCountInput) peopleCountInput.addEventListener('change', () => setPeopleCount(getPeopleCount()));

  function syncAttendanceFields() {
    const selected = document.querySelector('input[name="attend"]:checked');
    const showDetails = selected && selected.value === 'yes';
    document.querySelectorAll('.rsvp-choice__card').forEach((card) => {
      const input = card.querySelector('input');
      card.classList.toggle('is-checked', Boolean(input && input.checked));
    });
    if (attendanceDetailsWrap) attendanceDetailsWrap.hidden = !showDetails;
    if (peopleCountInput) {
      peopleCountInput.required = Boolean(showDetails);
      if (showDetails) {
        if (Number(peopleCountInput.value || 0) < 1) peopleCountInput.value = '1';
        if (attendeeNamesList && !attendeeNamesList.children.length) renderAttendeeInputs(getPeopleCount());
      }
    }
  }

  function enforceDeadlineRules() {
    const deadlinePassed = isDeadlinePassed();
    if (rsvpDeadlineNote) rsvpDeadlineNote.hidden = !deadlinePassed;
    if (!deadlinePassed) return false;
    setFormDisabled(true);
    setRsvpStatus('El plazo para confirmar asistencia cerró el 15 de septiembre de 2026.', 'error');
    if (rsvpSubmitButton) {
      rsvpSubmitButton.disabled = true;
      rsvpSubmitButton.textContent = 'Confirmación cerrada';
    }
    if (rsvpEditButton) rsvpEditButton.hidden = true;
    return true;
  }

  attendInputs.forEach((input) => input.addEventListener('change', syncAttendanceFields));
  syncAttendanceFields();

  /* Asistente: 0 ¿asistes? → 1 quién eres → 2 acompañantes (solo si asiste) → 3 opcional + confirmar */
  const wizardSteps = Array.from(document.querySelectorAll('.rsvp-wstep'));
  const wizardBack = document.getElementById('rsvp-back');
  const wizardNext = document.getElementById('rsvp-next');
  const wizardHint = document.getElementById('rsvp-step-hint');
  const wizardDots = Array.from(document.querySelectorAll('.rsvp-progress__dot'));
  let wizardStepId = 0;

  function wizardOrder() {
    const selected = document.querySelector('input[name="attend"]:checked');
    return selected && selected.value === 'no' ? [0, 1, 3] : [0, 1, 2, 3];
  }

  function goToWizardStep(stepId) {
    if (!wizardSteps.length) return;
    wizardStepId = stepId;
    const order = wizardOrder();
    const pos = Math.max(0, order.indexOf(stepId));
    wizardSteps.forEach((step) => step.classList.toggle('is-active', Number(step.dataset.wstep) === stepId));
    wizardDots.forEach((dot) => {
      const dotId = Number(dot.dataset.dot);
      const dotPos = order.indexOf(dotId);
      dot.style.display = dotPos === -1 ? 'none' : '';
      dot.classList.toggle('is-current', dotId === stepId);
      dot.classList.toggle('is-done', dotPos > -1 && dotPos < pos);
    });
    const skippedBar = document.querySelector('.rsvp-progress__bar[data-bar="2"]');
    if (skippedBar) skippedBar.style.display = order.includes(2) ? '' : 'none';
    if (wizardHint) wizardHint.textContent = `Paso ${pos + 1} de ${order.length}`;
    const isFirst = pos === 0;
    const isLast = pos === order.length - 1;
    if (wizardBack) wizardBack.hidden = isFirst;
    if (wizardNext) wizardNext.hidden = isFirst || isLast;
    if (rsvpSubmitButton) rsvpSubmitButton.hidden = !isLast;
    setRsvpStatus('');
  }

  function validateWizardStep(stepId) {
    if (stepId === 0) {
      return document.querySelector('input[name="attend"]:checked') ? '' : 'Selecciona si asistirás o no.';
    }
    if (stepId === 1) {
      if (!fullNameInput || fullNameInput.value.trim().length < 5) return 'Escribe tu nombre completo.';
      if (!emailInput || !isValidEmail(emailInput.value.trim())) return 'Escribe un correo electrónico válido.';
      return '';
    }
    if (stepId === 2) {
      const names = getAttendeeInputValues().map((value) => value.trim());
      if (!names.length || names.some((name) => !name)) return 'Escribe el nombre de cada persona que asistirá.';
      return '';
    }
    return '';
  }

  if (wizardNext) {
    wizardNext.addEventListener('click', () => {
      const error = validateWizardStep(wizardStepId);
      if (error) { setRsvpStatus(error, 'error'); return; }
      const order = wizardOrder();
      const pos = order.indexOf(wizardStepId);
      if (pos < order.length - 1) goToWizardStep(order[pos + 1]);
    });
  }

  if (wizardBack) {
    wizardBack.addEventListener('click', () => {
      const order = wizardOrder();
      const pos = order.indexOf(wizardStepId);
      if (pos > 0) goToWizardStep(order[pos - 1]);
    });
  }

  attendInputs.forEach((input) => {
    input.addEventListener('change', () => {
      if (wizardStepId === 0) setTimeout(() => goToWizardStep(1), 280);
    });
  });

  goToWizardStep(0);

  function parseRsvpPayload(formData) {
    const fullName = (formData.get('fullName') || '').toString().trim();
    const email = (formData.get('email') || '').toString().trim().toLowerCase();
    const groupName = fullName;
    const attend = (formData.get('attend') || '').toString();
    const rawPeopleCount = Number(formData.get('peopleCount') || 0);
    const peopleCount = Number.isFinite(rawPeopleCount) ? Math.round(rawPeopleCount) : 0;
    const attendeeNames = formData.getAll('attendeeName').map((value) => value.toString().trim()).filter(Boolean);
    return {
      fullName,
      normalizedFullName: normalizeName(fullName),
      email,
      groupName,
      normalizedGroupName: normalizeName(groupName),
      attend,
      peopleCount: attend === 'yes' ? peopleCount : 0,
      attendeeNames: attend === 'yes' ? attendeeNames : [],
      song: (formData.get('song') || '').toString().trim(),
      message: (formData.get('message') || '').toString().trim(),
    };
  }

  function validateRsvpPayload(payload) {
    if (payload.fullName.length < 5) return 'Escribe tu nombre completo para validar tu confirmación.';
    if (!isValidEmail(payload.email)) return 'Escribe un correo electrónico válido para guardar tu confirmación.';
    if (payload.attend !== 'yes' && payload.attend !== 'no') return 'Selecciona si asistirás o no.';
    if (payload.attend === 'yes') {
      if (payload.peopleCount < 1) return 'Indica el número total de personas que asistirán.';
      if (!payload.attendeeNames.length) return 'Escribe el nombre de cada persona que asistirá.';
      if (payload.attendeeNames.length !== payload.peopleCount) {
        const missing = payload.peopleCount - payload.attendeeNames.length;
        return missing > 0
          ? `Falta escribir el nombre de ${missing} ${missing === 1 ? 'persona' : 'personas'}.`
          : 'Hay más nombres que personas: revisa el número de personas.';
      }
    }
    return '';
  }

  function buildSummaryText(record, saveMessage) {
    const lines = [saveMessage, `Nombre: ${record.fullName}`, `Correo: ${record.email}`];
    if (record.attend === 'yes') {
      lines.push('Asistencia confirmada');
      lines.push(`Personas: ${record.peopleCount}`);
      lines.push(`Nombres: ${record.attendeeNames.join(', ')}`);
    } else {
      lines.push('No podrá asistir');
    }
    if (record.song) lines.push(`Canción: ${record.song}`);
    if (record.message) lines.push(`Mensaje: ${record.message}`);
    return lines.join('\n');
  }

  function normalizeServerRecord(record, fallbackPayload) {
    return normalizeStoredRecord({
      id: (record?.id || fallbackPayload.recordId || '').toString(),
      createdAt: record?.createdAt,
      updatedAt: record?.updatedAt,
      fullName: record?.fullName || fallbackPayload.fullName,
      email: record?.email || fallbackPayload.email,
      attend: record?.attend || fallbackPayload.attend,
      groupName: record?.groupName || fallbackPayload.groupName,
      peopleCount: Number(record?.peopleCount ?? fallbackPayload.peopleCount ?? 0),
      attendeeNames: record?.attendeeNames || fallbackPayload.attendeeNames,
      song: record?.song || fallbackPayload.song,
      message: record?.message || fallbackPayload.message,
    });
  }

  function fillRsvpForm(record) {
    if (fullNameInput) fullNameInput.value = record.fullName || '';
    if (emailInput) emailInput.value = record.email || '';
    attendInputs.forEach((input) => { input.checked = input.value === record.attend; });
    const recordNames = record.attendeeNames || [];
    const recordCount = Math.max(1, record.peopleCount || recordNames.length || 1);
    if (peopleCountInput) peopleCountInput.value = String(recordCount);
    renderAttendeeInputs(recordCount, recordNames);
    const songInput = rsvpForm.querySelector('input[name="song"]');
    if (songInput) songInput.value = record.song || '';
    const messageInput = rsvpForm.querySelector('textarea[name="message"]');
    if (messageInput) messageInput.value = record.message || '';
    syncAttendanceFields();
  }

  function isSameEmailAsExisting(typedEmail) {
    if (!existingRsvpRecord || !existingRsvpRecord.email) return true;
    return existingRsvpRecord.email.toLowerCase() === typedEmail.toLowerCase();
  }

  function setSavingState(isSaving, modeWhenIdle) {
    if (!rsvpSubmitButton) return;
    if (isSaving) {
      rsvpSubmitButton.disabled = true;
      rsvpSubmitButton.textContent = 'Guardando…';
      return;
    }
    if (isDeadlinePassed()) { enforceDeadlineRules(); return; }
    rsvpSubmitButton.disabled = false;
    setRsvpSubmitMode(modeWhenIdle);
  }

  async function checkNameDuplicate() {
    if (!fullNameInput) return;
    lookupRequestVersion += 1;
    const requestVersion = lookupRequestVersion;
    const fullName = fullNameInput.value.trim();
    existingRsvpRecord = null;
    setRsvpSubmitMode('create');
    if (fullName.length < 5 || isDeadlinePassed()) return;

    setRsvpStatus('Verificando si este nombre ya confirmó…', 'info');
    const lookupResult = await lookupRsvpByName(fullName);
    if (requestVersion !== lookupRequestVersion) return;
    if (!lookupResult.ok) { setRsvpStatus(''); return; }
    if (!lookupResult.found) { setRsvpStatus(''); setRsvpSubmitMode('create'); return; }

    existingRsvpRecord = normalizeServerRecord(lookupResult.record || {}, {
      fullName, email: '', attend: 'yes', peopleCount: 1, attendeeNames: [], song: '', message: '', recordId: '',
    });
    latestSavedRecord = existingRsvpRecord;
    setRsvpSubmitMode('edit');

    const typedEmail = emailInput ? emailInput.value.trim().toLowerCase() : '';
    const recordEmail = (existingRsvpRecord.email || '').toLowerCase();
    if (typedEmail && recordEmail && typedEmail === recordEmail) {
      fillRsvpForm(existingRsvpRecord);
      setRsvpStatus('Ya tenías una confirmación guardada: la cargamos para que puedas editarla.', 'warning');
      return;
    }
    if (typedEmail && recordEmail && typedEmail !== recordEmail) {
      setRsvpStatus('Este nombre ya confirmó con otro correo. Usa ese correo para editar la respuesta.', 'error');
      return;
    }
    setRsvpStatus('Este nombre ya tiene una confirmación. Escribe el mismo correo para actualizarla.', 'warning');
  }

  if (fullNameInput) {
    fullNameInput.addEventListener('blur', checkNameDuplicate);
    fullNameInput.addEventListener('input', () => {
      lookupRequestVersion += 1;
      existingRsvpRecord = null;
      setRsvpSubmitMode('create');
    });
  }

  if (emailInput) {
    emailInput.addEventListener('blur', () => {
      if (!existingRsvpRecord || !existingRsvpRecord.email) return;
      const typedEmail = emailInput.value.trim().toLowerCase();
      if (!typedEmail) return;
      if (!isSameEmailAsExisting(typedEmail)) {
        setRsvpStatus('El nombre ya existe y el correo no coincide. Usa el correo original para editar.', 'error');
        return;
      }
      fillRsvpForm(existingRsvpRecord);
      setRsvpStatus('Correo validado. Ya puedes editar esta confirmación.', 'warning');
      setRsvpSubmitMode('edit');
    });
  }

  enforceDeadlineRules();

  if (rsvpEditButton) {
    rsvpEditButton.addEventListener('click', () => {
      if (isDeadlinePassed()) { enforceDeadlineRules(); return; }
      if (latestSavedRecord) fillRsvpForm(latestSavedRecord);
      if (rsvpThanks) rsvpThanks.hidden = true;
      rsvpForm.hidden = false;
      goToWizardStep(0);
      setRsvpSubmitMode('edit');
      setRsvpStatus('Puedes editar tu confirmación y volver a guardarla.', 'info');
    });
  }

  rsvpForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (enforceDeadlineRules()) return;

    const payload = parseRsvpPayload(new FormData(rsvpForm));
    const validationMessage = validateRsvpPayload(payload);
    if (validationMessage) { setRsvpStatus(validationMessage, 'error'); return; }
    if (existingRsvpRecord && !isSameEmailAsExisting(payload.email)) {
      setRsvpStatus('Este nombre ya tiene una confirmación con otro correo y no se puede duplicar.', 'error');
      return;
    }

    setSavingState(true, existingRsvpRecord ? 'edit' : 'create');
    setRsvpStatus('');
    const upsertPayload = { ...payload, recordId: existingRsvpRecord ? existingRsvpRecord.id : '' };
    const saveResult = await upsertRsvp(upsertPayload);

    if (!saveResult.ok) {
      setSavingState(false, existingRsvpRecord ? 'edit' : 'create');
      setRsvpStatus(saveResult.error || 'No se pudo guardar la confirmación.', 'error');
      return;
    }

    const savedRecord = normalizeServerRecord(saveResult.record || {}, upsertPayload);
    existingRsvpRecord = savedRecord;
    latestSavedRecord = savedRecord;

    rsvpForm.hidden = true;
    if (rsvpThanks) rsvpThanks.hidden = false;
    if (rsvpSummary) {
      rsvpSummary.textContent = buildSummaryText(
        savedRecord,
        saveResult.mode === 'updated' ? 'Tu confirmación fue actualizada.' : 'Tu confirmación quedó guardada.'
      );
    }
    if (rsvpEditButton) rsvpEditButton.hidden = false;
    setSavingState(false, 'edit');
    if (rsvpThanks) rsvpThanks.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
})();
