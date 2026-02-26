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
const PERIODOS_STORAGE_KEY = 'schedule.periodos.v1';
const APP_DATA_STORAGE_KEY = 'schedule.appData.v1';
const ANIOS_CARRERA = [1, 2, 3, 4, 5];

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
  horaInicio: turno === 'Nocturno' ? '18:00' : '07:00',
  duracion: turno === 'Diurno' ? 60 : 45,
  creditos: 1,
  maxTurnos: turno === 'Diurno' ? 9 : 4,
  dias: diasPorTurno[turno] || diasPorTurno.Diurno,
  prioridadDias: safeString(diasPorTurno[turno] || diasPorTurno.Diurno).split(',').map((dia, index) => ({ dia: dia.trim(), prioridad: index + 1 })).filter((item) => item.dia),
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
  periodosPorTurno: {
    Diurno: ['2026-I'],
    Sabatino: ['2026-I'],
    Nocturno: ['2026-I'],
    Dominical: ['2026-I'],
  },
  maxEstudiantesPorGrupo: DEFAULT_MAX_ESTUDIANTES_POR_GRUPO,
  seleccionActual: { coordinacion: 'Arquitectura', carrera: 'Arquitectura', turno: 'Diurno', grupo: 'G1' },
  schedules: {},
  activeSlotSelection: null,
  anioTrabajo: 1,
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
    .map((entry, index) => {
      if (entry && typeof entry === 'object') {
        return { dia: safeString(entry.dia).trim(), prioridad: toPositiveNumber(entry.prioridad, index + 1) };
      }
      return { dia: safeString(entry).trim(), prioridad: index + 1 };
    })
    .filter((item, index, arr) => item.dia && arr.findIndex((v) => normalizeText(v.dia) === normalizeText(item.dia)) === index);

  const prioridadFinal = prioridadDias.length
    ? prioridadDias
    : normalizeDiasInput(diasString).map((dia, index) => ({ dia, prioridad: index + 1 }));

  return {
    turno: turnoName,
    horaInicio: safeString(rawConfig.horaInicio || defaults.horaInicio),
    dias: diasString,
    duracion: toPositiveNumber(rawConfig.duracion, defaults.duracion),
    creditos: toPositiveNumber(rawConfig.creditos, defaults.creditos),
    maxTurnos: toPositiveNumber(rawConfig.maxTurnos, defaults.maxTurnos),
    prioridadDias: prioridadFinal,
    aula: safeString(rawConfig.aula || ''),
    recesoInicio: safeString(rawConfig.recesoInicio || ''),
    recesoFin: safeString(rawConfig.recesoFin || ''),
    almuerzoInicio: safeString(rawConfig.almuerzoInicio || ''),
    almuerzoFin: safeString(rawConfig.almuerzoFin || ''),
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
        horaInicio: saved.horaInicio,
        dias: saved.dias,
        duracion: saved.duracion,
        creditos: saved.creditos,
        maxTurnos: saved.maxTurnos,
        prioridadDias: saved.prioridadDias,
        aula: saved.aula,
        recesoInicio: saved.recesoInicio,
        recesoFin: saved.recesoFin,
        almuerzoInicio: saved.almuerzoInicio,
        almuerzoFin: saved.almuerzoFin,
      };
    });
  } catch (error) {
    console.warn('No se pudo cargar la configuración de turno desde localStorage.', error);
  }
};

const savePeriodosToLocalStorage = () => {
  try {
    window.localStorage.setItem(PERIODOS_STORAGE_KEY, JSON.stringify(state.periodosPorTurno));
  } catch (error) {
    console.warn('No se pudieron guardar los periodos.', error);
  }
};

const loadPeriodosFromLocalStorage = () => {
  try {
    const raw = window.localStorage.getItem(PERIODOS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    turnosDisponibles.forEach((turno) => {
      const values = safeArray(parsed[turno]).map((item) => safeString(item).trim()).filter(Boolean);
      if (values.length) state.periodosPorTurno[turno] = [...new Set(values)];
    });
  } catch (error) {
    console.warn('No se pudieron cargar los periodos.', error);
  }
};

const sanitizeCoordinaciones = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value)
    .map(([coordinacion, carreras]) => [safeString(coordinacion).trim(), safeArray(carreras).map((carrera) => safeString(carrera).trim()).filter(Boolean)])
    .filter(([coordinacion]) => Boolean(coordinacion));

  if (!entries.length) return null;
  return entries.reduce((acc, [coordinacion, carreras]) => {
    acc[coordinacion] = [...new Set(carreras)];
    return acc;
  }, {});
};

const saveAppDataToLocalStorage = () => {
  const payload = {
    clases: safeArray(state.clases),
    docentes: safeArray(state.docentes),
    areas: safeArray(state.areas),
    matricula: state.matricula && typeof state.matricula === 'object' ? state.matricula : {},
    schedules: state.schedules && typeof state.schedules === 'object' ? state.schedules : {},
    seleccionActual: state.seleccionActual,
    anioTrabajo: Number(state.anioTrabajo || 1),
    maxEstudiantesPorGrupo: toPositiveNumber(state.maxEstudiantesPorGrupo, DEFAULT_MAX_ESTUDIANTES_POR_GRUPO),
    coordinaciones,
  };

  try {
    window.localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('No se pudieron guardar los datos generales.', error);
  }
};

const loadAppDataFromLocalStorage = () => {
  try {
    const raw = window.localStorage.getItem(APP_DATA_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;

    const loadedCoordinaciones = sanitizeCoordinaciones(parsed.coordinaciones);
    if (loadedCoordinaciones) {
      Object.keys(coordinaciones).forEach((key) => delete coordinaciones[key]);
      Object.assign(coordinaciones, loadedCoordinaciones);
    }

    if (Array.isArray(parsed.clases)) state.clases = parsed.clases;
    if (Array.isArray(parsed.docentes)) state.docentes = parsed.docentes;
    if (Array.isArray(parsed.areas)) state.areas = [...new Set(parsed.areas.map((item) => safeString(item).trim()).filter(Boolean))];
    if (parsed.matricula && typeof parsed.matricula === 'object') state.matricula = parsed.matricula;
    if (parsed.schedules && typeof parsed.schedules === 'object') state.schedules = parsed.schedules;
    if (parsed.seleccionActual && typeof parsed.seleccionActual === 'object') {
      state.seleccionActual = {
        ...state.seleccionActual,
        ...parsed.seleccionActual,
        turno: resolveTurnoName(parsed.seleccionActual.turno || state.seleccionActual.turno),
      };
    }

    if (Number.isFinite(Number(parsed.anioTrabajo))) state.anioTrabajo = Number(parsed.anioTrabajo);
    state.maxEstudiantesPorGrupo = toPositiveNumber(parsed.maxEstudiantesPorGrupo, DEFAULT_MAX_ESTUDIANTES_POR_GRUPO);
  } catch (error) {
    console.warn('No se pudieron cargar los datos generales.', error);
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

const getSelectionKey = ({ coordinacion, carrera, turno, anio, grupo }) => `${safeString(coordinacion)}::${safeString(carrera)}::${resolveTurnoName(turno)}::A${safeString(anio || 1)}::${safeString(grupo || 'G1')}`;

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

const parsePrioridadDias = (value, diasFallback) => {
  const base = safeString(value).trim();
  if (!base) return diasFallback.map((dia, index) => ({ dia, prioridad: index + 1 }));

  const parsed = base.split(',').map((item) => item.trim()).filter(Boolean).map((entry, index) => {
    const [diaRaw, prioridadRaw] = entry.split(':').map((part) => safeString(part).trim());
    const prioridad = Number(prioridadRaw);
    return {
      dia: diaRaw,
      prioridad: Number.isFinite(prioridad) && prioridad > 0 ? prioridad : (index + 1),
    };
  }).filter((item) => item.dia);

  return parsed.length ? parsed : diasFallback.map((dia, index) => ({ dia, prioridad: index + 1 }));
};

const formatPrioridadDias = (prioridades = [], diasFallback = []) => {
  const base = safeArray(prioridades).length ? safeArray(prioridades) : diasFallback.map((dia, index) => ({ dia, prioridad: index + 1 }));
  return base.map((item) => `${item.dia}:${item.prioridad}`).join(',');
};

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

const getBloquesNecesariosParaClases = (turno, clases = []) => {
  const cfg = getTurnoConfig(turno);
  const creditosBasePorBloque = Math.max(toPositiveNumber(cfg.creditos, 1), 1);
  const total = safeArray(clases).reduce((acc, clase) => {
    const creditosClase = Math.max(toPositiveNumber(clase?.creditos, 1), 1);
    return acc + Math.max(Math.ceil(creditosClase / creditosBasePorBloque), 1);
  }, 0);
  return Math.max(total, 1);
};

const getBloquesVista = (turno, totalBloquesOverride) => {
  const cfg = getTurnoConfig(turno);
  const inicio = parseTimeToMinutes(cfg.horaInicio || getDefaultTurnoConfig(turno).horaInicio);
  const duracion = Math.max(toPositiveNumber(cfg.duracion, getDefaultTurnoConfig(turno).duracion), 1);
  const maxTurnosConfigurados = Math.max(Math.floor(toPositiveNumber(cfg.maxTurnos, getDefaultTurnoConfig(turno).maxTurnos)), 1);
  const totalBloques = Math.max(Math.floor(toPositiveNumber(totalBloquesOverride, maxTurnosConfigurados)), maxTurnosConfigurados, 1);

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

const getBloquesRequeridosPorSeleccion = (selection) => {
  const maxTurnosConfigurados = Math.max(
    toPositiveNumber(getTurnoConfig(selection.turno).maxTurnos, getDefaultTurnoConfig(selection.turno).maxTurnos),
    1,
  );
  return maxTurnosConfigurados;
};

const createSlotsForTurno = (selection) => {
  const totalBloques = getBloquesRequeridosPorSeleccion(selection);
  const bloques = getBloquesVista(selection.turno, totalBloques);
  const dias = getDiasArray(selection.turno);
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
  const diasCount = Math.max(getDiasArray(selection.turno).length, 1);
  const totalBloques = getBloquesRequeridosPorSeleccion(selection);
  const bloques = getBloquesVista(selection.turno, totalBloques);
  const expectedSlots = bloques.length * diasCount;

  if (!state.schedules[key]) {
    state.schedules[key] = createSlotsForTurno(selection);
    return state.schedules[key];
  }

  const schedule = safeArray(state.schedules[key]);
  if (schedule.length === expectedSlots) return schedule;

  const resized = bloques.flatMap((bloque, bloqueIndex) => Array.from({ length: diasCount }, (_, diaIndex) => {
    const oldIndex = (bloqueIndex * diasCount) + diaIndex;
    const oldSlot = schedule[oldIndex] || {};
    return {
      clase: oldSlot.clase || bloque.restriccion || '-',
      aula: oldSlot.aula || '-',
      docente: oldSlot.docente || '',
      restriccion: bloque.restriccion || '',
      ocupado: Boolean(oldSlot.ocupado),
      esContinuacion: Boolean(oldSlot.esContinuacion),
      diaIndex,
    };
  }));

  state.schedules[key] = resized;
  return state.schedules[key];
};

const getCurrentVistaSelection = () => ({
  coordinacion: ($id('vista')?.querySelector('.js-coordinacion')?.value) || state.seleccionActual.coordinacion,
  carrera: ($id('vista')?.querySelector('.js-carrera')?.value) || state.seleccionActual.carrera,
  turno: resolveTurnoName(getSelectValue('vista-turno', state.seleccionActual.turno)),
  grupo: state.seleccionActual.grupo || 'G1',
  anio: Number(state.anioTrabajo || 1),
});

const getAniosConDatos = ({ coordinacion, carrera, turno }) => {
  const aniosCsv = safeArray(state.clases)
    .filter((item) => normalizeText(item.coordinacion) === normalizeText(coordinacion)
      && normalizeText(item.carrera) === normalizeText(carrera)
      && resolveTurnoName(item.turno || 'Diurno') === resolveTurnoName(turno))
    .map((item) => Number(item.anio))
    .filter((anio) => ANIOS_CARRERA.includes(anio));

  return [...new Set([...ANIOS_CARRERA, ...aniosCsv])].sort((a, b) => a - b);
};

const renderVistaTablesByYear = (selection) => {
  const container = $id('vista-years');
  if (!container) return;
  const dias = getDiasArray(selection.turno);
  const safeDias = dias.length ? dias : ['Día'];
  const bloquesVista = getBloquesVista(selection.turno, getBloquesRequeridosPorSeleccion(selection));
  const anio = Number(selection.anio || state.anioTrabajo || 1);

  container.innerHTML = [anio].map((anio) => {
    const header = safeDias.map((dia) => `<th class="vista-dia-header">${dia}</th><th class="vista-aula-header">Aula</th>`).join('');
    const rows = bloquesVista.map((bloque, bloqueIndex) => {
      let cells = `<td>${bloque.codigo}<br><small>${bloque.hora}</small></td>`;
      safeDias.forEach((_, diaIndex) => {
        const slot = (bloqueIndex * safeDias.length) + diaIndex;
        cells += `<td class="vista-clase" data-anio="${anio}" data-slot="${slot}" data-restriccion="${bloque.restriccion}">-</td><td class="vista-aula" data-anio="${anio}" data-slot="${slot}" data-restriccion="${bloque.restriccion}">-</td>`;
      });
      return `<tr>${cells}</tr>`;
    }).join('');

    return `<h4>Año ${anio}</h4><table class="vista-table-year"><thead><tr><th>Bloque</th>${header}</tr></thead><tbody>${rows}</tbody></table>`;
  }).join('');
};

const applyDiasByTurnoToView = (turno) => {
  const selection = getCurrentVistaSelection();
  renderVistaTablesByYear({ ...selection, turno });
};

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

const paintSchedulesForAllYears = (selection) => {
  const anio = Number(selection.anio || state.anioTrabajo || 1);
  const yearSelection = { ...selection, anio };
  const slots = getOrCreateSchedule(yearSelection);
  const claseCells = [...document.querySelectorAll(`#vista-years .vista-clase[data-anio="${anio}"]`)];
  const aulaCells = [...document.querySelectorAll(`#vista-years .vista-aula[data-anio="${anio}"]`)];
  const maxLength = Math.max(claseCells.length, aulaCells.length);

  for (let index = 0; index < maxLength; index += 1) {
    if (claseCells[index]) {
      claseCells[index].textContent = slots[index]?.clase || '-';
      claseCells[index].style.display = '';
      claseCells[index].classList.toggle('is-continuacion', Boolean(slots[index]?.esContinuacion));
    }
    if (aulaCells[index]) {
      aulaCells[index].textContent = slots[index]?.aula || '-';
      aulaCells[index].style.display = '';
      aulaCells[index].classList.toggle('is-continuacion', Boolean(slots[index]?.esContinuacion));
    }
  }
};

const renderCurrentSelectionSchedule = () => {
  const selection = getCurrentVistaSelection();
  renderVistaTablesByYear(selection);
  paintSchedulesForAllYears(selection);
};

const filtrarClasesPorSeleccion = ({ coordinacion, carrera, turno, anio }) => safeArray(state.clases).filter((item) => {
  const matchCoord = normalizeText(item.coordinacion) === normalizeText(coordinacion);
  const matchCarrera = normalizeText(item.carrera) === normalizeText(carrera);
  const matchTurno = resolveTurnoName(item.turno || 'Diurno') === resolveTurnoName(turno);
  const matchAnio = Number(item.anio || 1) === Number(anio || 1);
  return matchCoord && matchCarrera && matchTurno && matchAnio;
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
      anio: Math.min(Math.max(Number(cols[headers.indexOf('anio')] || 1) || 1, 1), 5),
      aula,
    },
  };
};

const clearImportedCsvData = () => {
  const clasesCsv = new Set(
    safeArray(state.clases)
      .filter((item) => safeArray(item?.caracteristicas).map((tag) => normalizeText(tag)).includes('csv'))
      .map((item) => normalizeText(item?.clase)),
  );

  const before = safeArray(state.clases).length;
  state.clases = safeArray(state.clases).filter((item) => {
    const tags = safeArray(item?.caracteristicas).map((tag) => normalizeText(tag));
    return !tags.includes('csv');
  });

  Object.keys(state.schedules || {}).forEach((key) => {
    state.schedules[key] = safeArray(state.schedules[key]).map((slot) => {
      if (!clasesCsv.has(normalizeText(slot?.clase))) return slot;
      return {
        ...slot,
        clase: '-',
        aula: '-',
        docente: '',
        ocupado: false,
        esContinuacion: false,
      };
    });
  });

  const removed = Math.max(before - state.clases.length, 0);
  saveAppDataToLocalStorage();
  updateSeleccionActual();
  renderCatalogoTabla();

  const input = $id('csv-input');
  if (input) input.value = '';

  if (!removed) {
    setHint('carga-hint', 'No había datos importados por CSV para borrar.');
    return;
  }

  setHint('carga-hint', `Datos CSV borrados: ${removed} clase(s).`);
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
    saveAppDataToLocalStorage();
    updateSeleccionActual();
    renderCatalogoTabla();
    setHint('carga-hint', `CSV importado. Nuevas: ${importedValid.length}.`);
  };

  reader.readAsText(file);
};

const generarPlanHorario = ({ turno, clases = [] }) => {
  const selection = {
    coordinacion: state.seleccionActual.coordinacion,
    carrera: state.seleccionActual.carrera,
    turno,
    anio: Number(state.anioTrabajo || 1),
  };
  const slots = createSlotsForTurno(selection);
  const dias = getDiasArray(turno);
  const diasCount = Math.max(dias.length, 1);
  const cfg = getTurnoConfig(turno);
  const creditosBasePorBloque = Math.max(toPositiveNumber(cfg.creditos, 1), 1);

  const getBloquesNecesarios = (clase) => {
    const creditosClase = Math.max(toPositiveNumber(clase?.creditos, 1), 1);
    return Math.max(Math.ceil(creditosClase / creditosBasePorBloque), 1);
  };

  const slotDisponibleParaClase = (slot) => !slot.restriccion && slot.clase === '-' && !slot.ocupado;

  const puedeUbicarEnDia = (startIdx, bloquesNecesarios, diaIndex) => {
    for (let paso = 0; paso < bloquesNecesarios; paso += 1) {
      const idx = startIdx + (paso * diasCount);
      if (!slots[idx] || (idx % diasCount) !== diaIndex || !slotDisponibleParaClase(slots[idx])) return false;
    }
    return true;
  };

  safeArray(clases).forEach((clase, index) => {
    const claseNombre = safeString(clase.clase).trim() || `Clase ${index + 1}`;
    const bloquesNecesarios = getBloquesNecesarios(clase);

    const slotIndex = slots.findIndex((slot, idx) => {
      if (!slotDisponibleParaClase(slot)) return false;
      const diaIndex = idx % diasCount;
      const claseRepetidaEnDia = slots.some((item, pos) => (pos % diasCount) === diaIndex && normalizeText(item.clase) === normalizeText(claseNombre));
      if (claseRepetidaEnDia) return false;
      return puedeUbicarEnDia(idx, bloquesNecesarios, diaIndex);
    });
    if (slotIndex === -1) return;

    const diaIndex = slotIndex % diasCount;
    for (let paso = 0; paso < bloquesNecesarios; paso += 1) {
      const idx = slotIndex + (paso * diasCount);
      const isPrincipal = paso === 0;
      slots[idx] = {
        clase: isPrincipal ? claseNombre : '↳ Continuación',
        aula: safeString(clase.aula).trim() || '-',
        docente: safeString(clase.docente).trim(),
        restriccion: '',
        ocupado: true,
        esContinuacion: !isPrincipal,
        diaIndex,
      };
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
    saveAppDataToLocalStorage();
  }
  renderCurrentSelectionSchedule();
};

const syncAppFromSeleccionActual = () => {
  syncCoordinacionSelects(state.seleccionActual.coordinacion);
  syncTurnoSelects(state.seleccionActual.turno);
  syncCarreraSelects();
  syncSelectValue('.js-coordinacion', state.seleccionActual.coordinacion);
  syncSelectValue('.js-turno', state.seleccionActual.turno);
  syncSelectValue('.js-carrera', state.seleccionActual.carrera);
  applyDiasByTurnoToView(state.seleccionActual.turno);
  if ($id('config-anio-trabajo')) $id('config-anio-trabajo').value = String(state.anioTrabajo || 1);
  renderPeriodosUI();
  renderCurrentSelectionSchedule();
};

const getPeriodosByTurno = (turno) => {
  const turnoName = resolveTurnoName(turno);
  const current = safeArray(state.periodosPorTurno[turnoName]).map((item) => safeString(item).trim()).filter(Boolean);
  return current.length ? current : ['2026-I'];
};

const renderPeriodosUI = () => {
  const turno = resolveTurnoName(getSelectValue('periodo-turno', state.seleccionActual.turno || 'Diurno'));
  const periodos = getPeriodosByTurno(turno);
  state.periodosPorTurno[turno] = periodos;

  const periodoSelect = $id('generacion-periodo');
  if (periodoSelect) fillSelect(periodoSelect, periodos, periodos[0]);

  const list = $id('periodos-lista');
  if (list) {
    list.innerHTML = periodos.map((periodo) => `<li>${periodo} <button type="button" data-periodo="${periodo}" class="btn-outline btn-eliminar-periodo">Eliminar</button></li>`).join('');
  }
};

const getGenerationSelection = () => ({
  coordinacion: state.seleccionActual.coordinacion,
  carrera: state.seleccionActual.carrera,
  turno: resolveTurnoName(state.seleccionActual.turno || 'Diurno'),
  periodo: getSelectValue('generacion-periodo', ''),
  grupo: state.seleccionActual.grupo || 'G1',
  anio: Number(state.anioTrabajo || 1),
});

const generarHorarioAutomatico = () => {
  const consola = $id('generacion-console');
  const seleccion = getGenerationSelection();
  const anio = Number(state.anioTrabajo || 1);
  const clasesSeleccion = filtrarClasesPorSeleccion({ ...seleccion, anio });
  const plan = generarPlanHorario({ turno: seleccion.turno, clases: clasesSeleccion });
  renderPlanGenerado(plan, { ...seleccion, anio });
  const totalAsignadas = plan.clasesAsignadas;

  renderCurrentSelectionSchedule();
  if (consola) {
    consola.textContent = `Horario generado para ${seleccion.coordinacion} / ${seleccion.carrera} / ${seleccion.turno} (${seleccion.periodo || 'sin periodo'}).
Bloques asignados: ${totalAsignadas}.`;
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
  const prioridadInput = $id('turno-prioridad');
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
  if (prioridadInput) prioridadInput.value = formatPrioridadDias(cfg.prioridadDias, normalizeDiasInput(cfg.dias));
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

  const diasInput = $id('turno-dias');
  const prioridadInput = $id('turno-prioridad');
  const aula = safeString(aulaInput?.value).trim();
  const diasCalculados = normalizeDiasInput(diasInput?.value || '').join(',') || getDefaultTurnoConfig(turno).dias;
  const prioridadDias = parsePrioridadDias(prioridadInput?.value || '', normalizeDiasInput(diasCalculados));

  state.turnoConfig[turno] = {
    ...getDefaultTurnoConfig(turno),
    horaInicio: horaInicioInput?.value || getDefaultTurnoConfig(turno).horaInicio,
    duracion: toPositiveNumber(duracionInput?.value, 45),
    creditos: toPositiveNumber(creditosInput?.value, 1),
    maxTurnos: toPositiveNumber(maxTurnosInput?.value, 4),
    dias: diasCalculados,
    prioridadDias,
    aula,
    recesoInicio: recesoInicioInput?.value || '',
    recesoFin: recesoFinInput?.value || '',
    almuerzoInicio: almuerzoInicioInput?.value || '',
    almuerzoFin: almuerzoFinInput?.value || '',
  };

  saveTurnoConfigToLocalStorage();
  saveAppDataToLocalStorage();
  renderCatalogoTabla();
  applyDiasByTurnoToView(state.seleccionActual.turno);
  setHint('turno-hint', `Configuración de ${turno} guardada.`);
};

const resetTurnoConfig = () => {
  const turno = resolveTurnoName(getSelectValue('turno-config-select', 'Diurno'));
  if (!turno) return;

  state.turnoConfig[turno] = getDefaultTurnoConfig(turno);
  saveTurnoConfigToLocalStorage();
  saveAppDataToLocalStorage();
  loadTurno();
  applyDiasByTurnoToView(state.seleccionActual.turno);
  setHint('turno-hint', 'Valores restablecidos por defecto.');
};


const exportVisibleYearToExcel = () => {
  const table = document.querySelector('#vista-years table');
  if (!table) return;
  const rows = [...table.querySelectorAll('tr')].map((tr) => [...tr.querySelectorAll('th,td')].map((c) => safeString(c.textContent).replace(/\n+/g, ' ').trim()));
  const tsv = rows.map((r) => r.join('\t')).join('\n');
  const blob = new Blob([tsv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const anio = Number(state.anioTrabajo || 1);
  const nombre = `horario_${safeString(state.seleccionActual.carrera || 'carrera').replace(/\s+/g, '_')}_anio_${anio}.xls`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = nombre;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};

const bindEvents = () => {
  $id('btn-menu')?.addEventListener('click', () => body.classList.toggle('sidebar-hidden'));

  $id('btn-borrar-csv')?.addEventListener('click', () => {
    const totalCsv = safeArray(state.clases).filter((item) => {
      const tags = safeArray(item?.caracteristicas).map((tag) => normalizeText(tag));
      return tags.includes('csv');
    }).length;

    if (!totalCsv) {
      clearImportedCsvData();
      return;
    }

    const ok = window.confirm(`Se borrarán ${totalCsv} clase(s) importadas por CSV. ¿Deseas continuar?`);
    if (!ok) return;

    clearImportedCsvData();
  });

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
    if (!safeString(state.seleccionActual.carrera).trim()) {
      setHint('asignacion-hint', 'Selecciona la carrera en la parte superior antes de agregar clase manual.', false);
      return;
    }

    const clase = window.prompt('Nombre de la clase a agregar:');
    if (!clase) return;

    const aula = window.prompt('Aula donde se impartirá la clase:');
    const docente = window.prompt('Docente de la clase:');
    const creditosInput = window.prompt('Créditos de la clase:', '1');
    const tipoClase = safeString(window.prompt('Tipo de clase (ejemplo: aula, laboratorio, taller):', 'aula')).trim() || 'aula';

    const anio = Number(getSelectValue('asignacion-anio', '1')) || 1;
    state.clases.push({
      coordinacion: state.seleccionActual.coordinacion,
      carrera: state.seleccionActual.carrera,
      turno: resolveTurnoName(state.seleccionActual.turno || 'Diurno'),
      anio,
      clase: clase.trim(),
      creditos: toPositiveNumber(creditosInput, 1),
      tipoClase,
      caracteristicas: ['manual', tipoClase],
      docente: safeString(docente).trim(),
      area: 'Por asignar',
      aula: safeString(aula).trim(),
    });

    const slotPrompt = safeString(window.prompt('Slot a ocupar (formato día,bloque. Ej: 1,2). Opcional:')).trim();
    if (slotPrompt) {
      const [diaRaw, bloqueRaw] = slotPrompt.split(',').map((v) => Number(v.trim()));
      const diasCount = Math.max(getDiasArray(state.seleccionActual.turno).length, 1);
      const slotIndex = ((bloqueRaw - 1) * diasCount) + (diaRaw - 1);
      if (slotIndex >= 0) {
        const sel = { ...state.seleccionActual, anio };
        const schedule = getOrCreateSchedule(sel);
        if (schedule[slotIndex] && !schedule[slotIndex].restriccion && schedule[slotIndex].clase !== '-') {
          const ok = window.confirm(`Se perderá la clase actual en esa hora para ${anio}° año de ${state.seleccionActual.carrera}. ¿Deseas continuar?`);
          if (!ok) {
            updateSeleccionActual();
            renderCatalogoTabla();
            setHint('asignacion-hint', 'Clase agregada al catálogo, sin sobrescribir slot.');
            return;
          }
        }

        if (schedule[slotIndex] && !schedule[slotIndex].restriccion) {
          schedule[slotIndex] = { clase: clase.trim(), aula: safeString(aula).trim() || '-', docente: safeString(docente).trim(), restriccion: '' };
        }
      }
    }

    updateSeleccionActual();
    renderCatalogoTabla();
    renderCurrentSelectionSchedule();
    setHint('asignacion-hint', `Clase "${clase}" agregada correctamente.`);
    saveAppDataToLocalStorage();
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
    saveAppDataToLocalStorage();
  });

  $id('btn-generar-auto')?.addEventListener('click', generarHorarioAutomatico);
  $id('btn-reiniciar-demo')?.addEventListener('click', () => {
    state.schedules = {};
    state.seleccionActual.grupo = 'G1';
    saveAppDataToLocalStorage();
    renderCurrentSelectionSchedule();
    const consola = $id('generacion-console');
    if (consola) consola.textContent = 'Demo reiniciada. Puedes generar nuevamente.';
  });

  $id('turno-config-select')?.addEventListener('change', loadTurno);
  $id('periodo-turno')?.addEventListener('change', renderPeriodosUI);
  $id('btn-guardar-turno')?.addEventListener('click', saveTurnoConfig);
  $id('config-anio-trabajo')?.addEventListener('change', (event) => {
    state.anioTrabajo = Number(event.target.value) || 1;
    renderCurrentSelectionSchedule();
  });
  $id('btn-exportar-excel')?.addEventListener('click', exportVisibleYearToExcel);
  $id('btn-restablecer-turno')?.addEventListener('click', resetTurnoConfig);

  $id('btn-nueva-area')?.addEventListener('click', () => {
    const area = safeString(window.prompt('Nombre de la nueva área:')).trim();
    if (!area) return;

    const existe = safeArray(state.areas).some((item) => normalizeText(item) === normalizeText(area));
    if (existe) {
      setHint('docentes-hint', `El área "${area}" ya existe.`, false);
      return;
    }

    state.areas.push(area);
    setHint('docentes-hint', `Área "${area}" agregada correctamente.`);
    saveAppDataToLocalStorage();
  });

  $id('btn-nuevo-docente')?.addEventListener('click', () => {
    const nombre = safeString(window.prompt('Nombre del docente:')).trim();
    if (!nombre) return;

    const area = safeString(window.prompt('Área del docente:', state.areas[0] || 'General')).trim() || 'General';
    const existe = safeArray(state.docentes).some((docente) => normalizeText(docente.nombre) === normalizeText(nombre));
    if (existe) {
      setHint('docentes-hint', `El docente "${nombre}" ya existe.`, false);
      return;
    }

    if (!safeArray(state.areas).some((item) => normalizeText(item) === normalizeText(area))) {
      state.areas.push(area);
    }

    state.docentes.push({ nombre, area });
    renderDocentes();
    renderCatalogoTabla();
    setHint('docentes-hint', `Docente "${nombre}" agregado correctamente.`);
    saveAppDataToLocalStorage();
  });

  $id('btn-asignar-docente')?.addEventListener('click', () => {
    const claseNombre = safeString(window.prompt('Clase a la que deseas asignar docente:')).trim();
    if (!claseNombre) return;

    const clase = safeArray(state.clases).find((item) => normalizeText(item.clase) === normalizeText(claseNombre));
    if (!clase) {
      setHint('docentes-hint', 'No se encontró la clase indicada.', false);
      return;
    }

    const docenteNombre = safeString(window.prompt('Nombre del docente:')).trim();
    if (!docenteNombre) return;

    const docente = safeArray(state.docentes).find((item) => normalizeText(item.nombre) === normalizeText(docenteNombre));
    if (!docente) {
      setHint('docentes-hint', `El docente "${docenteNombre}" no existe en el catálogo.`, false);
      return;
    }

    clase.docente = docente.nombre;
    clase.area = docente.area;
    renderCatalogoTabla();
    setHint('docentes-hint', `Docente "${docente.nombre}" asignado a "${clase.clase}".`);
    saveAppDataToLocalStorage();
  });

  $id('btn-agregar-coordinacion')?.addEventListener('click', () => {
    const nuevaCoordinacion = safeString($id('nueva-coordinacion')?.value).trim();
    if (!nuevaCoordinacion) {
      setHint('catalogo-hint', 'Escribe el nombre de la coordinación.', false);
      return;
    }

    if (coordinaciones[nuevaCoordinacion]) {
      setHint('catalogo-hint', 'La coordinación ya existe.', false);
      return;
    }

    coordinaciones[nuevaCoordinacion] = [];
    if ($id('nueva-coordinacion')) $id('nueva-coordinacion').value = '';
    syncCoordinacionSelects(nuevaCoordinacion);
    syncCarreraSelects();
    syncSelectValue('.js-coordinacion', nuevaCoordinacion);
    state.seleccionActual.coordinacion = nuevaCoordinacion;
    setHint('catalogo-hint', `Coordinación "${nuevaCoordinacion}" agregada.`);
    saveAppDataToLocalStorage();
  });

  $id('btn-agregar-carrera')?.addEventListener('click', () => {
    const coordinacion = getSelectValue('coordinacion-config', 'Arquitectura');
    const nuevaCarrera = safeString($id('nueva-carrera')?.value).trim();

    if (!nuevaCarrera) {
      setHint('catalogo-hint', 'Escribe el nombre de la carrera.', false);
      return;
    }

    if (!coordinaciones[coordinacion]) coordinaciones[coordinacion] = [];

    const existe = coordinaciones[coordinacion].some((item) => normalizeText(item) === normalizeText(nuevaCarrera));
    if (existe) {
      setHint('catalogo-hint', 'La carrera ya existe en esa coordinación.', false);
      return;
    }

    coordinaciones[coordinacion].push(nuevaCarrera);
    if ($id('nueva-carrera')) $id('nueva-carrera').value = '';
    syncCarreraSelects();
    syncSelectValue('.js-coordinacion', coordinacion);
    syncSelectValue('.js-carrera', nuevaCarrera);
    state.seleccionActual.coordinacion = coordinacion;
    state.seleccionActual.carrera = nuevaCarrera;
    setHint('catalogo-hint', `Carrera "${nuevaCarrera}" agregada a ${coordinacion}.`);
    saveAppDataToLocalStorage();
  });

  $id('btn-guardar-matricula')?.addEventListener('click', () => {
    const carrera = getSelectValue('matricula-carrera', state.seleccionActual.carrera);
    const estudiantes = Math.max(Number($id('matricula-estudiantes')?.value) || 0, 0);
    state.matricula[carrera] = estudiantes;
    setHint('matricula-hint', `Matrícula guardada: ${carrera} (${estudiantes} estudiantes).`);
    saveAppDataToLocalStorage();
  });

  $id('btn-agregar-periodo')?.addEventListener('click', () => {
    const turno = resolveTurnoName(getSelectValue('periodo-turno', state.seleccionActual.turno || 'Diurno'));
    const periodo = safeString($id('nuevo-periodo')?.value).trim();
    if (!periodo) return;
    const current = getPeriodosByTurno(turno);
    if (!current.some((item) => normalizeText(item) === normalizeText(periodo))) current.push(periodo);
    state.periodosPorTurno[turno] = current;
    if ($id('nuevo-periodo')) $id('nuevo-periodo').value = '';
    savePeriodosToLocalStorage();
    saveAppDataToLocalStorage();
    renderPeriodosUI();
  });

  $id('periodos-lista')?.addEventListener('click', (event) => {
    const button = event.target.closest('.btn-eliminar-periodo');
    if (!button) return;
    const periodo = button.dataset?.periodo;
    const turno = resolveTurnoName(getSelectValue('periodo-turno', state.seleccionActual.turno || 'Diurno'));
    state.periodosPorTurno[turno] = getPeriodosByTurno(turno).filter((item) => item !== periodo);
    savePeriodosToLocalStorage();
    saveAppDataToLocalStorage();
    renderPeriodosUI();
  });

  const connectSelect = (id, key) => {
    $id(id)?.addEventListener('change', (event) => {
      state.seleccionActual[key] = key === 'turno' ? resolveTurnoName(event.target.value) : event.target.value;
      syncAppFromSeleccionActual();
      saveAppDataToLocalStorage();
    });
  };

  connectSelect('carga-coordinacion', 'coordinacion');
  connectSelect('carga-carrera', 'carrera');
  connectSelect('carga-turno', 'turno');
  connectSelect('vista-turno', 'turno');
  $id('vista')?.querySelector('.js-coordinacion')?.addEventListener('change', renderCurrentSelectionSchedule);
  $id('vista')?.querySelector('.js-carrera')?.addEventListener('change', renderCurrentSelectionSchedule);
};

const init = () => {
  loadAppDataFromLocalStorage();
  loadTurnoConfigFromLocalStorage();
  loadPeriodosFromLocalStorage();
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
