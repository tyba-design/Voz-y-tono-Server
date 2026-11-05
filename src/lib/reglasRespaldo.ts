/**
 * Motor local de revisión por reglas para «Voz y tono de tyba».
 * Se ejecuta en el cliente cuando el servidor o la cuota no están disponibles.
 */

export interface ResultadoRevision {
  lectura: string;
  diagnostico: string;
  opciones: Array<{ texto: string; nota: string }>;
  dos: string[];
  donts: string[];
  esRespaldo: boolean;
  cambiosAplicados?: string[];
  alertasDetectadas?: string[];
}

// Emojis regex para removerlos en el respaldo
const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

// Banco de ejemplos de la guía oficial de tyba
const EJEMPLOS_GUIA = [
  {
    keywords: ['empezar', 'abrir', 'inicio', 'no entiendo', 'dónde empiezo', 'nuevo'],
    opcion: 'Vamos a resolverlo juntos. Empecemos por definir tu horizonte de inversión y tu perfil de riesgo. ¡Buen momento para empezar!',
    nota: 'Inicio guiado',
  },
  {
    keywords: ['aporte', 'automático', 'débito', 'mensual', 'modificar', 'cambiar valor'],
    opcion: 'Lo vemos juntos. Puedes cambiar el valor ahora; se aplica al próximo débito programado. ¡Buena decisión ajustar tus aportes!',
    nota: 'Ajuste de aporte',
  },
  {
    keywords: ['disponible', 'recomendarías', 'millones', 'qué hago', 'capital', 'sugerir'],
    opcion: 'Queremos acompañarte bien en esto. Antes de sugerir algo, cuéntanos tu horizonte de tiempo y tu perfil de riesgo. ¡Hay varias opciones interesantes!',
    nota: 'Perfilación previa',
  },
  {
    keywords: ['saldo', 'parado', 'inactivo', 'sin invertir', 'meses'],
    opcion: 'Queremos que ese dinero también trabaje para ti. Notamos que tienes saldo disponible sin invertir. ¡Puede ser un buen momento para ponerlo a trabajar!',
    nota: 'Activación de saldo',
  },
  {
    keywords: ['retirar', 'retiro', 'todo mi dinero', 'cancelar cuenta', 'sacar plata', 'cash out'],
    opcion: 'Aquí estamos para lo que necesites. Podemos iniciar el retiro total cuando quieras. ¡Listo! Si hay algo que podamos resolver antes, cuéntanos.',
    nota: 'Retiro respetuoso',
  },
  {
    keywords: ['bienvenida', 'hola', 'bienvenido', 'bienvenida a tyba', 'tasas'],
    opcion: 'Te damos la bienvenida a tyba. Estamos aquí para acompañarte desde tu primer paso. ¡Qué bueno tenerte aquí!',
    nota: 'Bienvenida cálida',
  },
  {
    keywords: ['aporte exitoso', 'confirmar', 'gracias', 'recibido'],
    opcion: 'Recibimos tu aporte, gracias por confiar en nosotros. Puedes ver el detalle en tu portafolio cuando quieras. ¡Buena decisión seguir avanzando hacia tus metas!',
    nota: 'Confirmación positiva',
  },
  {
    keywords: ['error', 'falló', 'falla', 'intenta', 'sistema', 'problema'],
    opcion: 'Algo no salió como esperábamos. Ya lo estamos revisando; vuelve a intentarlo en unos minutos. Gracias por tu paciencia.',
    nota: 'Error empático',
  },
];

export function ejecutarRevisionPorReglas(textoEntrada: string): ResultadoRevision {
  let textoAjustado = textoEntrada;
  const cambiosAplicados: string[] = [];
  const alertasDetectadas: string[] = [];
  const dos: string[] = [];
  const donts: string[] = [];

  // 1. Quitar emojis
  if (EMOJI_REGEX.test(textoAjustado)) {
    textoAjustado = textoAjustado.replace(EMOJI_REGEX, '').trim();
    cambiosAplicados.push('Se removieron emojis para cumplir con el estándar de tyba');
  }

  // 2. Correcciones léxicas automáticas sin duplicaciones
  // «bienvenido/a a tyba»
  if (/\bbienvenidos?\s+a\s+tyba\b/i.test(textoAjustado)) {
    textoAjustado = textoAjustado.replace(/\bbienvenidos?\s+a\s+tyba\b/gi, 'Te damos la bienvenida a tyba');
    cambiosAplicados.push('«bienvenido a tyba» → «Te damos la bienvenida a tyba»');
  } else if (/(?<!la\s+)\bbienvenid[oa]s?\b/i.test(textoAjustado)) {
    textoAjustado = textoAjustado.replace(/(?<!la\s+)\bbienvenid[oa]s?\b/gi, 'te damos la bienvenida');
    cambiosAplicados.push('«bienvenido/a» → «te damos la bienvenida»');
  }

  // «tranquilo/a»
  if (/\btranquil[oa]s?\b/i.test(textoAjustado)) {
    textoAjustado = textoAjustado.replace(/\btranquil[oa]s?\b/gi, 'no te preocupes');
    cambiosAplicados.push('«tranquilo/a» → «no te preocupes»');
  }

  // «colocar dinero»
  if (/\bcolocar\s+dinero\b/i.test(textoAjustado)) {
    textoAjustado = textoAjustado.replace(/\bcolocar\s+dinero\b/gi, 'invertir');
    cambiosAplicados.push('«colocar dinero» → «invertir»');
  }

  // Verbos de "yo" a "nosotros"
  const verbosYoANosotros: Array<{ regex: RegExp; repl: string; label: string }> = [
    { regex: /\bte\s+ayudo\b/gi, repl: 'te ayudamos', label: '«te ayudo» → «te ayudamos»' },
    { regex: /\bte\s+explico\b/gi, repl: 'te explicamos', label: '«te explico» → «te explicamos»' },
    { regex: /\bte\s+cuento\b/gi, repl: 'te contamos', label: '«te cuento» → «te contamos»' },
    { regex: /\bme\s+gustar[ií]a\b/gi, repl: 'nos gustaría', label: '«me gustaría» → «nos gustaría»' },
    { regex: /\bpuedo\b/gi, repl: 'podemos', label: '«puedo» → «podemos»' },
    { regex: /\bquiero\b/gi, repl: 'queremos', label: '«quiero» → «queremos»' },
    { regex: /\bestoy\b/gi, repl: 'estamos', label: '«estoy» → «estamos»' },
    { regex: /\bsoy\b/gi, repl: 'somos', label: '«soy» → «somos»' },
    { regex: /\btengo\b/gi, repl: 'tenemos', label: '«tengo» → «tenemos»' },
    { regex: /\bcreo\b/gi, repl: 'creemos', label: '«creo» → «creemos»' },
  ];

  for (const v of verbosYoANosotros) {
    if (v.regex.test(textoAjustado)) {
      textoAjustado = textoAjustado.replace(v.regex, v.repl);
      cambiosAplicados.push(v.label);
    }
  }

  // Corrección directa de superlativos y promesas en el texto ajustado
  if (/\b(las?\s+mejores?\s+tasas?(\s+del\s+mercado)?)\b/i.test(textoAjustado)) {
    textoAjustado = textoAjustado.replace(/\b(las?\s+mejores?\s+tasas?(\s+del\s+mercado)?)\b/gi, 'opciones pensadas para tus metas');
    cambiosAplicados.push('Se eliminó el superlativo de «mejores tasas»');
  }

  // Capitalización de inicio de frases
  textoAjustado = textoAjustado.replace(/(?:^|[.!?]\s+)([a-z])/g, (m) => m.toUpperCase());

  // Comillas angulares en vez de rectas
  if (textoAjustado.includes('"')) {
    textoAjustado = textoAjustado.replace(/"([^"]*)"/g, '«$1»');
  }

  // 3. Inspección y marcado de infracciones específicas
  // Alerta 1: «bienvenido/a» o «tranquilo/a» (adjetivos con género)
  if (/\b(bienvenid[oa]s?|tranquil[oa]s?|cansad[oa]s?|list[oa]s?)\b/i.test(textoEntrada)) {
    alertasDetectadas.push('Adjetivos con género dirigidos a la persona');
    donts.push('No uses adjetivos con género dirigidos a la persona («bienvenido/a», «tranquilo/a»).');
    dos.push('Usa fórmulas neutras: «Te damos la bienvenida» y «No te preocupes».');
  }

  // Alerta 2: Superlativos
  if (/\b(las?\s+mejores?|el\s+mejor|los\s+mejores|m[aá]s\s+alta|m[aá]s\s+baja|el\s+m[aá]s|la\s+m[aá]s)\b/i.test(textoEntrada)) {
    alertasDetectadas.push('Superlativos («las mejores tasas», «la mejor opción»)');
    donts.push('Evita superlativos: nada de «la mejor», «las mejores tasas», «la comisión más baja».');
    dos.push('Presenta opciones reales y alternativas claras sin comparaciones absolutas.');
  }

  // Alerta 3: Promesas de rentabilidad o "seguro" o "tasas del mercado"
  if (/\b(segur[oa]s?|garantizad[oa]s?|rentabilidad\s+asegurada|sin\s+riesgo|ganancias?\s+aseguradas?|tasas?(\s+del\s+mercado)?)\b/i.test(textoEntrada)) {
    alertasDetectadas.push('Promesas de rentabilidad o mención de tasas del mercado');
    donts.push('Nunca prometas rentabilidad ni digas que una inversión es «segura».');
    dos.push('Habla con transparencia de rendimientos históricos y riesgos con claridad.');
  }

  // Alerta 4: «Usted»
  if (/\b(usted|ustedes|su\s+cuenta|sus\s+fondos|le\s+invitamos)\b/i.test(textoEntrada)) {
    alertasDetectadas.push('Uso de «usted»');
    donts.push('Nunca uses «usted»; en tyba tuteamos siempre a la persona.');
    dos.push('Tutea siempre («tú») manteniendo un registro respetuoso y cercano.');
  }

  // Alerta 5: «invierte en tyba»
  if (/\binvierte\s+en\s+tyba\b/i.test(textoEntrada)) {
    alertasDetectadas.push('Frase directa «invierte en tyba»');
    donts.push('Nunca digas «invierte en tyba» de forma directa.');
    dos.push('Invita a conocer cómo empezar a invertir o a explorar la app.');
  }

  // Alerta 6: Asesoría cerrada
  if (/\b(te\s+recomiendo|lo\s+mejor\s+es|debes\s+invertir\s+en)\b/i.test(textoEntrada)) {
    alertasDetectadas.push('Asesoría cerrada');
    donts.push('No asesores de forma cerrada ni recetes un único producto.');
    dos.push('Indaga primero horizonte de tiempo y perfil de riesgo antes de sugerir.');
  }

  // Alerta 7: Retiro total
  if (/\b(retirar\s+todo|retiro\s+total|sacar\s+todo|cancelar\s+cuenta)\b/i.test(textoEntrada)) {
    alertasDetectadas.push('Solicitud de retiro total');
    donts.push('Ante un retiro total, nunca dificultes ni disuadas con culpa.');
    dos.push('Reconoce la solicitud con agilidad y ofrece ayuda una sola vez.');
  }

  // Completar hasta 3 o 4 do's y dont's
  const dosGenerales = [
    'Habla en primera persona del plural («nosotros»), nunca en «yo».',
    'Abre con calidez, informa en registro neutro y cierra con impulso moderado.',
    'Conserva la terminología consistente: «invertir», «portafolio», «rendimiento».',
  ];
  const dontsGenerales = [
    'Nunca hables en primera persona del singular («yo») en el mensaje.',
    'Evita tecnicismos innecesarios o lenguaje frío y despersonalizado.',
    'No uses más de 2 signos de exclamación en todo el mensaje.',
  ];

  for (const d of dosGenerales) {
    if (dos.length < 3 && !dos.includes(d)) dos.push(d);
  }
  for (const d of dontsGenerales) {
    if (donts.length < 3 && !donts.includes(d)) donts.push(d);
  }

  // Buscar ejemplos afines en la guía oficial
  const textoLower = textoEntrada.toLowerCase();
  const ejemplosAfines = EJEMPLOS_GUIA.filter((ej) =>
    ej.keywords.some((kw) => textoLower.includes(kw))
  );

  // Generar exactamente 3 opciones
  const opciones: Array<{ texto: string; nota: string }> = [];

  // Opción 1: Texto ajustado automáticamente
  opciones.push({
    texto: textoAjustado.trim() || 'Estamos aquí para acompañarte en tus decisiones de inversión.',
    nota: 'Ajuste directo',
  });

  // Opción 2: Ejemplo canónico más afín
  if (ejemplosAfines.length > 0) {
    opciones.push({
      texto: ejemplosAfines[0].opcion,
      nota: ejemplosAfines[0].nota,
    });
  } else {
    opciones.push({
      texto: 'Queremos acompañarte desde el primer paso para encontrar opciones alineadas con tus metas.',
      nota: 'Más cercana',
    });
  }

  // Opción 3: Versión breve / alternativa
  if (ejemplosAfines.length > 1) {
    opciones.push({
      texto: ejemplosAfines[1].opcion,
      nota: ejemplosAfines[1].nota,
    });
  } else {
    opciones.push({
      texto: 'Explora opciones de inversión pensadas para tu perfil y horizonte en la app de tyba.',
      nota: 'Más explicativa',
    });
  }

  let diagnostico = '';
  if (alertasDetectadas.length > 0) {
    diagnostico = `Revisión por reglas: se detectaron desalineamientos con la guía (${alertasDetectadas.join(', ')}). Se ajustó el texto eliminando marcas de género, superlativos y promesas de rentabilidad.`;
  } else {
    diagnostico = 'El texto parece alineado con las reglas básicas de voz y tono de tyba. Se generaron opciones consistentes con la guía.';
  }

  return {
    lectura: '',
    diagnostico,
    opciones: opciones.slice(0, 3),
    dos: dos.slice(0, 4),
    donts: donts.slice(0, 4),
    esRespaldo: true,
    cambiosAplicados,
    alertasDetectadas,
  };
}
