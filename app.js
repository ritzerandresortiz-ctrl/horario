const $id = (id) => document.getElementById(id);

const safeArray = (value) => (Array.isArray(value) ? value : []);
const safeString = (value, fallback = '') => (value == null ? fallback : String(value));
const normalizeText = (value) => safeString(value).trim().toLowerCase();
const toPositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const DEFAULT_MAX_ESTUDIANTES_POR_GRUPO = 35;
const TURNO_CONFIG_STORAGE_KEY = 'schedule.turnoConfig.v1';

const tabs = document.querySelectorAll('.tab');
const principalView = $id('principal-view');
const configView = $id('config-view');
const body = document.body;

const coordinaciones = {
  Arquitectura: ['Arquitectura', 'Diseño Gráfico'],
};

const turnosDisponibles = ['Diurno', 'Sabatino', 'Nocturno', 'Dominical'];

const diasPorTurno = {
  Diurno: 'Lunes,Martes,Miércoles,Jueves,Viernes',
  Sabatino: 'Sábado',
  Nocturno: 'Lunes,Martes,Miércoles,Jueves,Viernes',
  Dominical: 'Domingo',
};

const getDefaultTurnoConfig = (turno) => ({
  horaInicio: turno === 'Nocturno' ? '18:00' : '08:00',
  duracion: 45,
  creditos: 1,
  maxTurnos: 4,
  dias: diasPorTurno[turno] || diasPorTurno.Diurno,
  prioridadDias: safeString(diasPorTurno[turno] || diasPorTurno.Diurno).split(',').map((dia) => dia.trim()).filter(Boolean),
  aula: '',
  recesoInicio: '',
  recesoFin: '',
  almuerzoInicio: '',
  almuerzoFin: '',
});

const state = {
  clases: [
    { coordinacion: 'Arquitectura', carrera: 'Arquitectura', clase: 'Taller de Diseño', aula: 'A-101', caracteristicas: ['diurno', 'taller'], docente: 'Ing. José Pérez', area: 'Tecnología' },
    { coordinacion: 'Arquitectura', carrera: 'Diseño Gráfico', clase: 'Identidad Nacional', aula: 'B-204', caracteristicas: ['diurno', 'aula'], docente: 'MSc. María López', area: 'Ciencias Básicas' },
  ],
  docentes: [
    { nombre: 'MSc. María López', area: 'Ciencias Básicas' },
    { nombre: 'Ing. José Pérez', area: 'Tecnología' },
  ],
  areas: ['Ciencias Básicas', 'Tecnología'],
  turnoConfig: {
    Diurno: getDefaultTurnoConfig('Diurno'),
    Sabatino: getDefaultTurnoConfig('Sabatino'),
    Nocturno: getDefaultTurnoConfig('Nocturno'),
    Dominical: getDefaultTurnoConfig('Dominical'),
  },
  matricula: {},
  maxEstudiantesPorGrupo: DEFAULT_MAX_ESTUDIANTES_POR_GRUPO,
  seleccionActual: { coordinacion: 'Arquitectura', carrera: 'Arquitectura', turno: 'Diurno', grupo: 'G1' },
  schedules: {},
  activeSlotSelection: null,
};

const normalizeDiasInput = (diasValue) => safeString(diasValue)
  .split(',')
  .map((dia) => dia.trim())
  .filter(Boolean);

const normalizeTurno = (turno = '') => safeString(turno).trim().toLowerCase();

const resolveTurnoName = (turno) => {
  const found = turnosDisponibles.find((item) => normalizeTurno(item) === normalizeTurno(turno));
  return found || 'Diurno';
};

const sanitizeTurnoConfigForStorage = (turno, rawConfig = {}) => {
  const turnoName = resolveTurnoName(turno);
  const defaults = getDefaultTurnoConfig(turnoName);
  const diasList = normalizeDiasInput(rawConfig.dias || defaults.dias);
  const diasString = diasList.join(',') || defaults.dias;
  const prioridadBase = Array.isArray(rawConfig.prioridadDias)
    ? rawConfig.prioridadDias
    : normalizeDiasInput(rawConfig.prioridadDias);

  const prioridadDias = prioridadBase
    .map((dia) => safeString(dia).trim())
    .filter((dia, index, arr) => dia && arr.findIndex((item) => normalizeText(item) === normalizeText(dia)) === index);

  const prioridadFinal = prioridadDias.length ? prioridadDias : normalizeDiasInput(diasString);

  return {
    turno: turnoName,
    dias: diasString,
    duracion: toPositiveNumber(rawConfig.duracion, defaults.duracion),
    maxTurnos: toPositiveNumber(rawConfig.maxTurnos, defaults.maxTurnos),
    prioridadDias: prioridadFinal,
  };
};

const saveTurnoConfigToLocalStorage = () => {
  const payload = turnosDisponibles.reduce((acc, turno) => {
    acc[turno] = sanitizeTurnoConfigForStorage(turno, state.turnoConfig[turno]);
    return acc;
  }, {});

  try {
    window.localStorage.setItem(TURNO_CONFIG_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('No se pudo guardar la configuración de turno en localStorage.', error);
  }
};

const loadTurnoConfigFromLocalStorage = () => {
  try {
    const raw = window.localStorage.getItem(TURNO_CONFIG_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;

    turnosDisponibles.forEach((turno) => {
      if (!parsed[turno]) return;
      const saved = sanitizeTurnoConfigForStorage(turno, parsed[turno]);
      state.turnoConfig[turno] = {
        ...getDefaultTurnoConfig(turno),
        ...(state.turnoConfig[turno] || {}),
        dias: saved.dias,
        duracion: saved.duracion,
        maxTurnos: saved.maxTurnos,
        prioridadDias: saved.prioridadDias,
      };
    });
  } catch (error) {
    console.warn('No se pudo cargar la configuración de turno desde localStorage.', error);
  }
};

const getTurnoConfig = (turno) => {
  const turnoName = resolveTurnoName(turno);
  const defaults = getDefaultTurnoConfig(turnoName);
  return { ...defaults, ...(state.turnoConfig[turnoName] || {}) };
};

const getCarrerasByCoordinacion = (coordinacion) => safeArray(coordinaciones[coordinacion]);
const getAllCarreras = () => Object.values(coordinaciones).flat();

const setHint = (id, message, ok = true) => {
  const hint = $id(id);
  if (!hint) return;
  hint.textContent = message;
  hint.style.color = ok ? '#3257ff' : '#b00020';
};

const getSelectValue = (id, fallback = '') => {
  const node = $id(id);
  return node?.value || fallback;
};

const fillSelect = (select, options, selectedValue) => {
  if (!select) return;
  const safeOptions = safeArray(options).filter(Boolean);
  select.innerHTML = '';
  safeOptions.forEach((optionValue) => {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue;
    if (optionValue === selectedValue) option.selected = true;
    select.appendChild(option);
  });
};

const syncSelectValue = (selector, value) => {
  document.querySelectorAll(selector).forEach((select) => {
    if ([...select.options].some((option) => option.value === value)) select.value = value;
  });
};

const switchView = (tabName) => {
  const showConfig = tabName === 'config';
  principalView?.classList.toggle('active', !showConfig);
  configView?.classList.toggle('active', showConfig);
};

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((item) => item.classList.remove('active'));
    tab.classList.add('active');
    switchView(tab.dataset?.tab);
  });
});

const getCoordinacionFromContext = (select) => {
  const panel = select?.closest('section') || select?.closest('.view') || document;
  const coordinacionSelect = panel.querySelector('.js-coordinacion');
  return coordinacionSelect?.value || state.seleccionActual.coordinacion || Object.keys(coordinaciones)[0] || 'Arquitectura';
};

const syncCoordinacionSelects = (selected = 'Arquitectura') => {
  const values = Object.keys(coordinaciones);
  document.querySelectorAll('.js-coordinacion').forEach((select) => {
    const keepValue = values.includes(select.value) ? select.value : selected;
    fillSelect(select, values, keepValue);
  });
};

const syncCarreraSelects = () => {
  const fallback = getAllCarreras();
  document.querySelectorAll('.js-carrera').forEach((select) => {
    const coord = getCoordinacionFromContext(select);
    const values = getCarrerasByCoordinacion(coord);
    const options = values.length ? values : fallback;
    const keepValue = options.includes(select.value) ? select.value : options[0];
    fillSelect(select, options, keepValue);
  });
};

const syncTurnoSelects = (selected = 'Diurno') => {
  document.querySelectorAll('.js-turno').forEach((select) => {
    const keepValue = turnosDisponibles.includes(select.value) ? select.value : selected;
    fillSelect(select, turnosDisponibles, keepValue);
  });
};

const updateSeleccionActual = () => {
  const defaultCarrera = getAllCarreras()[0] || 'Arquitectura';
  const coordinacion = getSelectValue('carga-coordinacion', state.seleccionActual.coordinacion || 'Arquitectura');
  const carrera = getSelectValue('carga-carrera', state.seleccionActual.carrera || defaultCarrera);
  const turno = getSelectValue('carga-turno', state.seleccionActual.turno || 'Diurno');
  state.seleccionActual = { ...state.seleccionActual, coordinacion, carrera, turno: resolveTurnoName(turno) };
};

const getDiasPorTurno = (turno) => getTurnoConfig(turno).dias || diasPorTurno[resolveTurnoName(turno)] || diasPorTurno.Diurno;

const getSelectionKey = ({ coordinacion, carrera, turno, grupo }) => `${safeString(coordinacion)}::${safeString(carrera)}::${resolveTurnoName(turno)}::${safeString(grupo || 'G1')}`;

const parseTimeToMinutes = (time = '08:00') => {
  const match = safeString(time).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 8 * 60;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 8 * 60;
  return (hours * 60) + minutes;
};

const formatTimeFromMinutes = (minutes) => {
  const normalized = ((Number(minutes) || 0) % (24 * 60) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

const rangesOverlap = (startA, endA, startB, endB) => startA < endB && startB < endA;

const getBloqueRestriction = (start, end, cfg) => {
  const recesoInicio = parseTimeToMinutes(cfg.recesoInicio || '');
  const recesoFin = parseTimeToMinutes(cfg.recesoFin || '');
  const almuerzoInicio = parseTimeToMinutes(cfg.almuerzoInicio || '');
  const almuerzoFin = parseTimeToMinutes(cfg.almuerzoFin || '');

  const hasReceso = Boolean(cfg.recesoInicio && cfg.recesoFin) && recesoInicio < recesoFin;
  if (hasReceso && rangesOverlap(start, end, recesoInicio, recesoFin)) return 'RECESO';

  const hasAlmuerzo = Boolean(cfg.almuerzoInicio && cfg.almuerzoFin) && almuerzoInicio < almuerzoFin;
  if (hasAlmuerzo && rangesOverlap(start, end, almuerzoInicio, almuerzoFin)) return 'ALMUERZO';

  return '';
};

const getBloquesVista = (turno) => {
  const cfg = getTurnoConfig(turno);
  const totalBloques = Math.max(toPositiveNumber(cfg.maxTurnos, 4), 1);
  const duracion = Math.max(toPositiveNumber(cfg.duracion, 45), 1);
  const inicio = parseTimeToMinutes(cfg.horaInicio || '08:00');

  return Array.from({ length: totalBloques }, (_, index) => {
    const start = inicio + (index * duracion);
    const end = start + duracion;
    return {
      codigo: String(index + 1).padStart(2, '0'),
      hora: `${formatTimeFromMinutes(start)}-${formatTimeFromMinutes(end)}`,
      restriccion: getBloqueRestriction(start, end, cfg),
    };
  });
};

const getDiasArray = (turno) => safeString(getDiasPorTurno(turno), 'Día')
  .split(',')
  .map((dia) => dia.trim())
  .filter(Boolean);

const createSlotsForTurno = (turno) => {
  const bloques = getBloquesVista(turno);
  const dias = getDiasArray(turno);
  const diasCount = Math.max(dias.length, 1);
  return bloques.flatMap((bloque) => Array.from({ length: diasCount }, () => ({
    clase: bloque.restriccion || '-',
    aula: '-',
    docente: '',
    restriccion: bloque.restriccion || '',
  })));
};

const getOrCreateSchedule = (selection) => {
  const key = getSelectionKey(selection);
  if (!state.schedules[key]) state.schedules[key] = createSlotsForTurno(selection.turno);
  return state.schedules[key];
};

const getCurrentVistaSelection = () => ({
  coordinacion: ($id('vista')?.querySelector('.js-coordinacion')?.value) || state.seleccionActual.coordinacion,
  carrera: ($id('vista')?.querySelector('.js-carrera')?.value) || state.seleccionActual.carrera,
  turno: resolveTurnoName(getSelectValue('vista-turno', state.seleccionActual.turno)),
  grupo: state.seleccionActual.grupo || 'G1',
});

const renderVistaTable = (turno) => {
  const thead = $id('vista-thead');
  const tbody = $id('vista-tbody');
  if (!thead || !tbody) return;

  const bloquesVista = getBloquesVista(turno);
  const dias = getDiasArray(turno);
  const safeDias = dias.length ? dias : ['Día'];

  let headerHtml = '<tr><th>Bloque</th>';
  safeDias.forEach((dia) => {
    headerHtml += `<th class="vista-dia-header">${dia}</th><th class="vista-aula-header">Aula</th>`;
  });
  headerHtml += '</tr>';
  thead.innerHTML = headerHtml;

  tbody.innerHTML = bloquesVista.map((bloque, bloqueIndex) => {
    let cells = `<td>${bloque.codigo}<br><small>${bloque.hora}</small></td>`;
    safeDias.forEach((_, diaIndex) => {
      const slot = (bloqueIndex * safeDias.length) + diaIndex;
      cells += `<td class="vista-clase" data-slot="${slot}" data-restriccion="${bloque.restriccion}">-</td><td class="vista-aula" data-slot="${slot}" data-restriccion="${bloque.restriccion}">-</td>`;
    });
    return `<tr>${cells}</tr>`;
  }).join('');
};

const applyDiasByTurnoToView = (turno) => renderVistaTable(turno);

const renderCatalogoTabla = () => {
  const tbody = $id('clases-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  safeArray(state.clases).forEach((item) => {
    const tr = document.createElement('tr');
    const tags = safeArray(item.caracteristicas);
    tr.innerHTML = `<td>${item.coordinacion || ''}</td><td>${item.carrera || ''}</td><td>${item.clase || ''}</td><td>${item.aula || ''}</td><td>${tags.map((tag) => `<span class="tag">${tag}</span>`).join(' ')}</td><td>${item.docente || ''}</td><td>${item.area || ''}</td>`;
    tbody.appendChild(tr);
  });
};

const renderDocentes = () => {
  const tbody = $id('docentes-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  safeArray(state.docentes).forEach((docente) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${docente.nombre || ''}</td><td>${docente.area || ''}</td>`;
    tbody.appendChild(tr);
  });
};

const getVistaCells = () => {
  const claseCells = [...document.querySelectorAll('#vista-tbody .vista-clase')];
  const aulaCells = [...document.querySelectorAll('#vista-tbody .vista-aula')];
  return { claseCells, aulaCells };
};

const paintClaseCell = (cell, value) => {
  if (cell) cell.textContent = value || '-';
};

const paintAulaCell = (cell, value) => {
  if (cell) cell.textContent = value || '-';
};

const pintarClasesEnVista = (slots = []) => {
  const { claseCells, aulaCells } = getVistaCells();
  const maxLength = Math.max(claseCells.length, aulaCells.length);

  for (let index = 0; index < maxLength; index += 1) {
    const claseCell = claseCells[index];
    const aulaCell = aulaCells[index];
    const slot = slots[index] || { clase: '-', aula: '-' };
    paintClaseCell(claseCell, slot.clase);
    paintAulaCell(aulaCell, slot.aula);
  }
};

const renderCurrentSelectionSchedule = () => {
  const selection = getCurrentVistaSelection();
  const slots = getOrCreateSchedule(selection);
  pintarClasesEnVista(slots);
};

const filtrarClasesPorSeleccion = ({ coordinacion, carrera, turno }) => safeArray(state.clases).filter((item) => {
  const matchCoord = normalizeText(item.coordinacion) === normalizeText(coordinacion);
  const matchCarrera = normalizeText(item.carrera) === normalizeText(carrera);
  const matchTurno = resolveTurnoName(item.turno || 'Diurno') === resolveTurnoName(turno);
  return matchCoord && matchCarrera && matchTurno;
});

const parseCsvRows = (text) => {
  const lines = safeString(text).trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return { ok: false, message: 'El CSV no contiene datos válidos.' };

  const headers = lines[0].split(',').map((item) => item.trim().toLowerCase());
  const required = ['clase', 'creditos', 'compartida', 'anio', 'categoria', 'tipo', 'aula', 'docente'];
  const allowed = [...required, 'prioridad_dia', 'prioridad_dias'];
  const missing = required.filter((field) => !headers.includes(field));
  if (missing.length) return { ok: false, message: `Faltan columnas: ${missing.join(', ')}` };

  const invalidColumns = headers.filter((field) => !allowed.includes(field));
  if (invalidColumns.length) return { ok: false, message: `Columnas incorrectas detectadas: ${invalidColumns.join(', ')}` };

  return { ok: true, headers, rows: lines.slice(1) };
};

const createClassFromCsvRow = (row, headers, context) => {
  const cols = safeString(row).split(',').map((item) => item.trim());
  const claseIdx = headers.indexOf('clase');
  const tipoIdx = headers.indexOf('tipo');
  const aulaIdx = headers.indexOf('aula');
  const docenteIdx = headers.indexOf('docente');
  const creditosIdx = headers.indexOf('creditos');

  const aula = safeString(cols[aulaIdx]).trim();
  const docente = safeString(cols[docenteIdx]).trim();

  if (!aula || !docente) return { ok: false, reason: 'Aula y docente son obligatorios.' };

  const tipoClase = safeString(cols[tipoIdx]).trim() || 'aula';
  const creditosRaw = Number(cols[creditosIdx]);

  if (!Number.isFinite(creditosRaw) || creditosRaw < 1) return { ok: false, reason: 'Créditos inválidos.' };

  return {
    ok: true,
    item: {
      coordinacion: context.coordinacion,
      carrera: context.carrera,
      turno: context.turno,
      clase: cols[claseIdx] || 'Clase sin nombre',
      creditos: Math.max(Math.ceil(creditosRaw), 1),
      tipoClase,
      caracteristicas: ['csv', tipoClase],
      docente,
      area: 'Por asignar',
      aula,
    },
  };
};

const processCsvImport = (file, context) => {
  const reader = new FileReader();
  reader.onload = () => {
    const parsed = parseCsvRows(reader.result);
    if (!parsed.ok) {
      setHint('carga-hint', parsed.message, false);
      return;
    }

    const parsedRows = parsed.rows
      .map((line, index) => ({ ...createClassFromCsvRow(line, parsed.headers, context), rowNumber: index + 2 }));

    const importedValid = parsedRows.filter((item) => item.ok).map((item) => item.item);
    if (!importedValid.length) {
      setHint('carga-hint', 'No se importó ninguna clase. Verifica que cada fila tenga aula y docente.', false);
      return;
    }

    state.clases.push(...importedValid);
    updateSeleccionActual();
    renderCatalogoTabla();
    setHint('carga-hint', `CSV importado. Nuevas: ${importedValid.length}.`);
  };

  reader.readAsText(file);
};

const generarPlanHorario = ({ turno, clases = [] }) => {
  const slots = createSlotsForTurno(turno);
  const dias = getDiasArray(turno);
  const diasCount = Math.max(dias.length, 1);

  safeArray(clases).forEach((clase, index) => {
    const slotIndex = slots.findIndex((slot) => !slot.restriccion && slot.clase === '-');
    if (slotIndex === -1) return;

    slots[slotIndex] = {
      clase: safeString(clase.clase).trim() || `Clase ${index + 1}`,
      aula: safeString(clase.aula).trim() || '-',
      docente: safeString(clase.docente).trim(),
      restriccion: '',
    };

    const mirrorIndex = slotIndex + diasCount;
    if (mirrorIndex < slots.length && slots[mirrorIndex].clase === '-' && !slots[mirrorIndex].restriccion) {
      slots[mirrorIndex] = { ...slots[slotIndex] };
    }
  });

  return {
    slots,
    clasesAsignadas: safeArray(slots).filter((slot) => slot.clase !== '-' && !slot.restriccion).length,
    bloquesRestringidos: safeArray(slots).filter((slot) => Boolean(slot.restriccion)).length,
    clasesEnConflicto: [],
    clasesNoAsignadas: [],
  };
};

const renderPlanGenerado = (plan, selection) => {
  const slots = safeArray(plan?.slots);
  if (selection) {
    const key = getSelectionKey(selection);
    state.schedules[key] = slots.map((slot) => ({ ...slot, docente: slot.docente || '' }));
  }
  pintarClasesEnVista(slots);
};

const syncAppFromSeleccionActual = () => {
  syncCoordinacionSelects(state.seleccionActual.coordinacion);
  syncTurnoSelects(state.seleccionActual.turno);
  syncCarreraSelects();
  syncSelectValue('.js-coordinacion', state.seleccionActual.coordinacion);
  syncSelectValue('.js-turno', state.seleccionActual.turno);
  syncSelectValue('.js-carrera', state.seleccionActual.carrera);
  applyDiasByTurnoToView(state.seleccionActual.turno);
  renderCurrentSelectionSchedule();
};

const getGenerationSelection = () => {
  const generacionPanel = $id('generacion');
  const coordinacion = generacionPanel?.querySelector('.js-coordinacion')?.value
    || getSelectValue('carga-coordinacion', state.seleccionActual.coordinacion);
  const carrera = getSelectValue('generacion-carrera', state.seleccionActual.carrera);
  const turno = resolveTurnoName(getSelectValue('generacion-turno', state.seleccionActual.turno || 'Diurno'));
  return { coordinacion, carrera, turno, grupo: state.seleccionActual.grupo || 'G1' };
};

const generarHorarioAutomatico = () => {
  const consola = $id('generacion-console');
  const seleccion = getGenerationSelection();
  const clasesSeleccion = filtrarClasesPorSeleccion(seleccion);

  if (!clasesSeleccion.length) {
    if (consola) consola.textContent = 'No hay clases para la configuración seleccionada. Carga CSV o agrega clases manualmente.';
    return;
  }

  applyDiasByTurnoToView(seleccion.turno);
  const plan = generarPlanHorario({ turno: seleccion.turno, clases: clasesSeleccion });
  renderPlanGenerado(plan, seleccion);

  if (consola) {
    consola.textContent = `Horario generado para ${seleccion.coordinacion} / ${seleccion.carrera} / ${seleccion.turno}.\nBloques asignados: ${plan.clasesAsignadas}.\nBloques restringidos: ${plan.bloquesRestringidos}.`;
  }
};

const loadTurno = () => {
  const turno = resolveTurnoName(getSelectValue('turno-config-select', 'Diurno'));
  const cfg = getTurnoConfig(turno);

  const horaInicioInput = $id('turno-hora-inicio');
  const duracionInput = $id('turno-duracion');
  const creditosInput = $id('turno-creditos');
  const maxTurnosInput = $id('turno-max-turnos');
  const diasInput = $id('turno-dias');
  const aulaInput = $id('turno-aula');
  const recesoInicioInput = $id('turno-receso-inicio');
  const recesoFinInput = $id('turno-receso-fin');
  const almuerzoInicioInput = $id('turno-almuerzo-inicio');
  const almuerzoFinInput = $id('turno-almuerzo-fin');

  if (horaInicioInput) horaInicioInput.value = cfg.horaInicio;
  if (duracionInput) duracionInput.value = cfg.duracion;
  if (creditosInput) creditosInput.value = cfg.creditos;
  if (maxTurnosInput) maxTurnosInput.value = cfg.maxTurnos;
  if (diasInput) diasInput.value = cfg.dias;
  if (aulaInput) aulaInput.value = cfg.aula;
  if (recesoInicioInput) recesoInicioInput.value = cfg.recesoInicio;
  if (recesoFinInput) recesoFinInput.value = cfg.recesoFin;
  if (almuerzoInicioInput) almuerzoInicioInput.value = cfg.almuerzoInicio;
  if (almuerzoFinInput) almuerzoFinInput.value = cfg.almuerzoFin;
};

const saveTurnoConfig = () => {
  const turno = resolveTurnoName(getSelectValue('turno-config-select', 'Diurno'));
  if (!turno) return;

  const horaInicioInput = $id('turno-hora-inicio');
  const duracionInput = $id('turno-duracion');
  const creditosInput = $id('turno-creditos');
  const maxTurnosInput = $id('turno-max-turnos');
  const aulaInput = $id('turno-aula');
  const recesoInicioInput = $id('turno-receso-inicio');
  const recesoFinInput = $id('turno-receso-fin');
  const almuerzoInicioInput = $id('turno-almuerzo-inicio');
  const almuerzoFinInput = $id('turno-almuerzo-fin');

  const aula = safeString(aulaInput?.value).trim();
  if (!aula) {
    setHint('turno-hint', 'Debes escribir el aula antes de guardar.', false);
    return;
  }

  const diasCalculados = getDiasPorTurno(turno);

  state.turnoConfig[turno] = {
    ...getDefaultTurnoConfig(turno),
    horaInicio: horaInicioInput?.value || getDefaultTurnoConfig(turno).horaInicio,
    duracion: toPositiveNumber(duracionInput?.value, 45),
    creditos: toPositiveNumber(creditosInput?.value, 1),
    maxTurnos: toPositiveNumber(maxTurnosInput?.value, 4),
    dias: diasCalculados,
    prioridadDias: normalizeDiasInput(diasCalculados),
    aula,
    recesoInicio: recesoInicioInput?.value || '',
    recesoFin: recesoFinInput?.value || '',
    almuerzoInicio: almuerzoInicioInput?.value || '',
    almuerzoFin: almuerzoFinInput?.value || '',
  };

  saveTurnoConfigToLocalStorage();
  renderCatalogoTabla();
  applyDiasByTurnoToView(state.seleccionActual.turno);
  setHint('turno-hint', `Configuración de ${turno} guardada.`);
};

const resetTurnoConfig = () => {
  const turno = resolveTurnoName(getSelectValue('turno-config-select', 'Diurno'));
  if (!turno) return;

  state.turnoConfig[turno] = getDefaultTurnoConfig(turno);
  saveTurnoConfigToLocalStorage();
  loadTurno();
  applyDiasByTurnoToView(state.seleccionActual.turno);
  setHint('turno-hint', 'Valores restablecidos por defecto.');
};

const bindEvents = () => {
  $id('btn-menu')?.addEventListener('click', () => body.classList.toggle('sidebar-hidden'));

  $id('btn-importar-csv')?.addEventListener('click', () => {
    const file = $id('csv-input')?.files?.[0];
    if (!file) {
      setHint('carga-hint', 'Selecciona un archivo CSV antes de importar.', false);
      return;
    }

    const context = {
      coordinacion: getSelectValue('carga-coordinacion', 'Arquitectura'),
      carrera: getSelectValue('carga-carrera', getAllCarreras()[0] || 'Arquitectura'),
      turno: resolveTurnoName(getSelectValue('carga-turno', 'Diurno')),
    };

    processCsvImport(file, context);
  });

  $id('btn-agregar-manual')?.addEventListener('click', () => {
    const clase = window.prompt('Nombre de la clase a agregar:');
    if (!clase) return;

    const aula = window.prompt('Aula donde se impartirá la clase:');
    const docente = window.prompt('Docente de la clase:');
    const creditosInput = window.prompt('Créditos de la clase:', '1');
    const tipoClase = safeString(window.prompt('Tipo de clase (ejemplo: aula, laboratorio, taller):', 'aula')).trim() || 'aula';

    state.clases.push({
      coordinacion: getSelectValue('asignacion-coordinacion', 'Arquitectura'),
      carrera: getSelectValue('carga-carrera', getAllCarreras()[0] || 'Arquitectura'),
      turno: resolveTurnoName(getSelectValue('asignacion-turno', 'Diurno')),
      clase: clase.trim(),
      creditos: toPositiveNumber(creditosInput, 1),
      tipoClase,
      caracteristicas: ['manual', tipoClase],
      docente: safeString(docente).trim(),
      area: 'Por asignar',
      aula: safeString(aula).trim(),
    });

    updateSeleccionActual();
    renderCatalogoTabla();
    setHint('asignacion-hint', `Clase "${clase}" agregada correctamente.`);
  });

  $id('btn-cambiar-clase')?.addEventListener('click', () => {
    const nombre = window.prompt('Clase que quieres renombrar:');
    if (!nombre) return;

    const found = safeArray(state.clases).find((item) => safeString(item.clase).toLowerCase() === safeString(nombre).toLowerCase());
    if (!found) {
      setHint('asignacion-hint', 'No se encontró la clase indicada.', false);
      return;
    }

    const nuevoNombre = window.prompt('Nuevo nombre:', found.clase);
    if (!nuevoNombre) return;

    found.clase = nuevoNombre;
    renderCatalogoTabla();
    setHint('asignacion-hint', 'Clase actualizada correctamente.');
  });

  $id('btn-generar-auto')?.addEventListener('click', generarHorarioAutomatico);
  $id('btn-reiniciar-demo')?.addEventListener('click', () => {
    state.schedules = {};
    state.seleccionActual.grupo = 'G1';
    renderCurrentSelectionSchedule();
    const consola = $id('generacion-console');
    if (consola) consola.textContent = 'Demo reiniciada. Puedes generar nuevamente.';
  });

  $id('turno-config-select')?.addEventListener('change', loadTurno);
  $id('btn-guardar-turno')?.addEventListener('click', saveTurnoConfig);
  $id('btn-restablecer-turno')?.addEventListener('click', resetTurnoConfig);

  const connectSelect = (id, key) => {
    $id(id)?.addEventListener('change', (event) => {
      state.seleccionActual[key] = key === 'turno' ? resolveTurnoName(event.target.value) : event.target.value;
      syncAppFromSeleccionActual();
    });
  };

  connectSelect('carga-coordinacion', 'coordinacion');
  connectSelect('carga-carrera', 'carrera');
  connectSelect('carga-turno', 'turno');
  connectSelect('vista-turno', 'turno');
};

const init = () => {
  loadTurnoConfigFromLocalStorage();
  syncCoordinacionSelects();
  syncCarreraSelects();
  syncTurnoSelects();
  updateSeleccionActual();
  syncAppFromSeleccionActual();
  renderCatalogoTabla();
  renderDocentes();
  loadTurno();
  bindEvents();
};

init();
