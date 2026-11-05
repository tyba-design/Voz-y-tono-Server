/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  X,
  Copy,
  Paperclip,
  RotateCcw,
  Sun,
  Moon,
  AlertCircle,
  RefreshCw,
  Info,
  Terminal,
  Code2,
  Bot,
  ExternalLink,
} from 'lucide-react';
import { ejecutarRevisionPorReglas, ResultadoRevision } from './lib/reglasRespaldo';

interface Opcion {
  texto: string;
  nota: string;
}

interface AjusteResponse {
  lectura?: string;
  diagnostico: string;
  opciones: Opcion[];
  dos: string[];
  donts: string[];
  esRespaldo?: boolean;
}

export default function App() {
  const [tab, setTab] = useState<'ajustar' | 'ejemplos' | 'claude'>('ajustar');
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tyba_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Editor states
  const [texto, setTexto] = useState('');
  const [imagen, setImagen] = useState<{
    file: File;
    previewUrl: string;
    mimeType: string;
    base64: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<AjusteResponse | null>(null);
  const [copiadoIdx, setCopiadoIdx] = useState<number | null>(null);
  const [copiadoEjemploIdx, setCopiadoEjemploIdx] = useState<number | null>(null);
  const [copiadoSnippet, setCopiadoSnippet] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Current host for URLs
  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://ais-pre-j2wjslhsqknluhj2ilxhg3-277894434333.us-west1.run.app';

  const openApiUrl = `${baseUrl}/openapi.json`;
  const apiUrl = `${baseUrl}/api/ajustar`;
  const mcpUrl = `${baseUrl}/mcp`;

  // Sync theme with documentElement
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('tyba_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('tyba_theme', 'light');
    }
  }, [isDark]);

  // Handle URL hash navigation (#ejemplos, #claude, #ajustar)
  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#ejemplos') {
        setTab('ejemplos');
      } else if (window.location.hash === '#claude') {
        setTab('claude');
      } else if (window.location.hash === '#ajustar' || window.location.hash === '') {
        setTab('ajustar');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const changeTab = (newTab: 'ajustar' | 'ejemplos' | 'claude') => {
    setTab(newTab);
    window.location.hash = newTab;
  };

  // Handle image file selection
  const procesarImagen = (file: File) => {
    const validMimes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validMimes.includes(file.type)) {
      setError('Formato de imagen no compatible. Usa archivos PNG, JPEG o WebP.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('La captura supera el límite de 4 MB.');
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const previewUrl = URL.createObjectURL(file);
      setImagen({
        file,
        previewUrl,
        mimeType: file.type,
        base64,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      procesarImagen(e.target.files[0]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            procesarImagen(file);
            return;
          }
        }
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        procesarImagen(file);
      }
    }
  };

  const eliminarImagen = () => {
    if (imagen?.previewUrl) {
      URL.revokeObjectURL(imagen.previewUrl);
    }
    setImagen(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Main submission handler
  const ejecutarAjuste = async (previasParaExcluir?: string[]) => {
    if (!texto.trim() && !imagen) {
      setError('Pega un copy, cuéntanos qué necesitas o sube una captura de pantalla.');
      return;
    }

    if (texto.length > 4000) {
      setError('El texto excede el límite de 4.000 caracteres.');
      return;
    }

    setError(null);
    setLoading(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const payload: {
        texto?: string;
        imagen?: { mimeType: string; base64: string };
        previas?: string[];
      } = {};

      if (texto.trim()) payload.texto = texto.trim();
      if (imagen) {
        payload.imagen = {
          mimeType: imagen.mimeType,
          base64: imagen.base64,
        };
      }
      if (previasParaExcluir && previasParaExcluir.length > 0) {
        payload.previas = previasParaExcluir;
      }

      const response = await fetch('/api/ajustar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Error en el servidor (${response.status})`);
      }

      const data: AjusteResponse = await response.json();
      setResultado(data);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return;
      }

      if (texto.trim()) {
        const revisionLocal: ResultadoRevision = ejecutarRevisionPorReglas(texto.trim());
        setResultado(revisionLocal);
      } else {
        setError('No se pudo procesar la captura en el servidor. La revisión por reglas local requiere texto.');
      }
    } finally {
      setLoading(false);
    }
  };

  const cancelarAjuste = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  };

  const pedirOtrasOpciones = () => {
    if (!resultado) return;
    const previas = resultado.opciones.map((o) => o.texto);
    ejecutarAjuste(previas);
  };

  const copiarAlPortapapeles = (textoACopiar: string, idx: number, esEjemplo: boolean = false) => {
    navigator.clipboard.writeText(textoACopiar);
    if (esEjemplo) {
      setCopiadoEjemploIdx(idx);
      setTimeout(() => setCopiadoEjemploIdx(null), 2000);
    } else {
      setCopiadoIdx(idx);
      setTimeout(() => setCopiadoIdx(null), 2000);
    }
  };

  const copiarTextoGenerico = (textoACopiar: string, id: string) => {
    navigator.clipboard.writeText(textoACopiar);
    setCopiadoSnippet(id);
    setTimeout(() => setCopiadoSnippet(null), 2000);
  };

  const cargarEjemploPrincipal = () => {
    setTexto('Bienvenido a tyba. Tranquilo, invierte con nosotros y obtén las mejores tasas del mercado.');
    setError(null);
  };

  const cargarPreset = (tipo: 'push' | 'whatsapp' | 'microcopy' | 'modal') => {
    setError(null);
    switch (tipo) {
      case 'push':
        setTexto('Sebas, tu inversión fue exitosa. Revisa los detalles en la app.');
        break;
      case 'whatsapp':
        setTexto('Hola Carlos, queremos acompañarte a resolver tus dudas sobre tu portafolio.');
        break;
      case 'microcopy':
        setTexto('No pudimos guardar tu inversión. Intenta de nuevo en unos minutos.');
        break;
      case 'modal':
        setTexto('¿Estás seguro de que deseas abandonar el proceso de inversión?');
        break;
    }
  };

  // Claude tool definition format
  const claudeToolDefinition = {
    name: 'ajustar_copy_tyba',
    description:
      'Ajusta cualquier texto, copy o requerimiento a las reglas de voz y tono de tyba (tuteo, «nosotros», sin superlativos ni promesas de rentabilidad, sin adjetivos con marca de género en la persona, estructura apertura+núcleo+cierre). Devuelve 3 opciones, diagnóstico, do\'s y dont\'s.',
    input_schema: {
      type: 'object',
      properties: {
        texto: {
          type: 'string',
          description: 'El copy o texto a ajustar a la voz y tono de tyba.',
        },
        previas: {
          type: 'array',
          items: { type: 'string' },
          description: 'Opciones anteriormente mostradas para generar alternativas frescas.',
        },
      },
      required: ['texto'],
    },
  };

  const claudeDesktopMcpConfig = {
    mcpServers: {
      'tyba-voz-y-tono': {
        url: mcpUrl,
      },
    },
  };

  const curlExample = `curl -X POST ${apiUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"texto": "Bienvenido a tyba. Tranquilo, invierte con nosotros y obtén las mejores tasas del mercado."}'`;

  return (
    <div className="min-h-screen bg-[#F7FAFF] dark:bg-[#0B1220] text-[#0B1220] dark:text-[#F7FAFF] transition-colors duration-200">
      {/* Encabezado fijo y minimalista */}
      <header className="border-b border-[#C8DBFF]/40 dark:border-[#C8DBFF]/15 bg-[#F7FAFF]/95 dark:bg-[#0B1220]/95 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-[680px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="#ajustar"
              onClick={() => changeTab('ajustar')}
              className="text-[#0069E9] text-2xl font-bold tracking-tight hover:opacity-90 transition-opacity"
            >
              tyba
            </a>
          </div>

          <div className="flex items-center gap-5">
            <nav className="flex items-center gap-5 text-[14px] md:text-[15px] font-medium">
              <button
                onClick={() => changeTab('ajustar')}
                className={`py-5 transition-colors relative whitespace-nowrap ${
                  tab === 'ajustar'
                    ? 'text-[#0069E9] font-semibold'
                    : 'text-[#0B1220]/70 dark:text-[#F7FAFF]/70 hover:text-[#0069E9] dark:hover:text-[#0069E9]'
                }`}
              >
                Ajustar copy
                {tab === 'ajustar' && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0069E9]" />
                )}
              </button>

              <button
                onClick={() => changeTab('ejemplos')}
                className={`py-5 transition-colors relative whitespace-nowrap ${
                  tab === 'ejemplos'
                    ? 'text-[#0069E9] font-semibold'
                    : 'text-[#0B1220]/70 dark:text-[#F7FAFF]/70 hover:text-[#0069E9] dark:hover:text-[#0069E9]'
                }`}
              >
                Cómo hablamos
                {tab === 'ejemplos' && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0069E9]" />
                )}
              </button>

              <button
                onClick={() => changeTab('claude')}
                className={`py-5 transition-colors relative flex items-center gap-1.5 whitespace-nowrap ${
                  tab === 'claude'
                    ? 'text-[#0069E9] font-semibold'
                    : 'text-[#0B1220]/70 dark:text-[#F7FAFF]/70 hover:text-[#0069E9] dark:hover:text-[#0069E9]'
                }`}
              >
                <Bot className="w-4 h-4 text-[#0069E9]" />
                <span>API para Claude</span>
                {tab === 'claude' && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0069E9]" />
                )}
              </button>
            </nav>

            {/* Alternador de tema */}
            <button
              onClick={() => setIsDark(!isDark)}
              aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="p-2 rounded-lg text-[#0B1220]/60 dark:text-[#F7FAFF]/60 hover:text-[#0069E9] dark:hover:text-[#0069E9] hover:bg-[#C8DBFF]/20 transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Contenedor principal de 680 px centrado con aire */}
      <main className="max-w-[680px] mx-auto px-4 py-10 md:py-14">
        {tab === 'ajustar' && (
          <div className="space-y-8">
            {/* Título y subtítulo */}
            <div className="space-y-2">
              <h1 className="text-3xl md:text-[34px] font-bold tracking-tight text-[#0B1220] dark:text-[#F7FAFF]">
                Haz que tu copy suene a tyba.
              </h1>
              <p className="text-[16px] leading-relaxed text-[#0B1220]/75 dark:text-[#F7FAFF]/75">
                Pega un texto o sube una captura de pantalla para ajustarlo a las reglas oficiales de voz y tono de la fintech de Credicorp Capital.
              </p>
            </div>

            {/* Cuadro de escritura grande protagonista */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="relative rounded-2xl border border-[#C8DBFF] dark:border-[#C8DBFF]/20 bg-white dark:bg-[#0B1220]/60 shadow-[0_4px_24px_rgba(0,105,233,0.05)] p-4 focus-within:border-[#0069E9] focus-within:ring-2 focus-within:ring-[#0069E9]/20 transition-all"
            >
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onPaste={handlePaste}
                rows={5}
                placeholder="Pega un copy, cuéntanos qué necesitas o sube una captura de pantalla"
                className="w-full bg-transparent text-[17px] leading-relaxed resize-y border-none focus:outline-none placeholder-[#0B1220]/40 dark:placeholder-[#F7FAFF]/40 text-[#0B1220] dark:text-[#F7FAFF]"
              />

              {/* Vista previa de miniatura adjunta */}
              {imagen && (
                <div className="mt-3 pt-3 border-t border-[#C8DBFF]/40 dark:border-[#C8DBFF]/15 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={imagen.previewUrl}
                      alt="Captura adjunta"
                      className="w-14 h-14 object-cover rounded-lg border border-[#C8DBFF] dark:border-[#C8DBFF]/30"
                    />
                    <div className="text-xs">
                      <p className="font-medium text-[#0B1220] dark:text-[#F7FAFF] truncate max-w-[260px]">
                        {imagen.file.name}
                      </p>
                      <p className="text-[#0B1220]/60 dark:text-[#F7FAFF]/60">
                        {(imagen.file.size / (1024 * 1024)).toFixed(2)} MB · {imagen.mimeType.replace('image/', '').toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={eliminarImagen}
                    className="p-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors"
                  >
                    Quitar captura
                  </button>
                </div>
              )}

              {/* Barra inferior de herramientas del editor */}
              <div className="mt-4 pt-3 border-t border-[#C8DBFF]/30 dark:border-[#C8DBFF]/10 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                    id="capture-upload"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0069E9] hover:text-[#0A3699] py-1.5 px-2.5 rounded-md hover:bg-[#C8DBFF]/20 transition-colors"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    {imagen ? 'Cambiar captura' : 'Adjuntar captura'}
                  </button>

                  <span className="text-xs text-[#0B1220]/40 dark:text-[#F7FAFF]/40">
                    {texto.length}/4.000
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[#0069E9] animate-pulse">
                        Revisando con la guía de voz y tono...
                      </span>
                      <button
                        onClick={cancelarAjuste}
                        className="text-xs text-[#0B1220]/60 dark:text-[#F7FAFF]/60 hover:text-red-600 py-1 px-2 rounded border border-neutral-300 dark:border-neutral-700 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => ejecutarAjuste()}
                      disabled={loading || (!texto.trim() && !imagen)}
                      className="px-5 py-2.5 bg-[#0069E9] hover:bg-[#0A3699] disabled:opacity-40 disabled:hover:bg-[#0069E9] text-white font-medium text-sm rounded-xl transition-all shadow-sm active:scale-[0.99]"
                    >
                      Ajustar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Enlaces de ejemplos rápidos */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#0B1220]/70 dark:text-[#F7FAFF]/70">
              <button
                onClick={cargarEjemploPrincipal}
                className="text-[#0069E9] hover:underline font-medium text-left"
              >
                Probar con un ejemplo (superlativos y promesas)
              </button>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#0B1220]/50 dark:text-[#F7FAFF]/50">Atajos:</span>
                <button
                  onClick={() => cargarPreset('push')}
                  className="hover:text-[#0069E9] transition-colors underline"
                >
                  Push
                </button>
                <span>·</span>
                <button
                  onClick={() => cargarPreset('whatsapp')}
                  className="hover:text-[#0069E9] transition-colors underline"
                >
                  WhatsApp
                </button>
                <span>·</span>
                <button
                  onClick={() => cargarPreset('microcopy')}
                  className="hover:text-[#0069E9] transition-colors underline"
                >
                  Microcopy
                </button>
                <span>·</span>
                <button
                  onClick={() => cargarPreset('modal')}
                  className="hover:text-[#0069E9] transition-colors underline"
                >
                  Modal
                </button>
              </div>
            </div>

            {/* Mensajes de error */}
            {error && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 flex items-start justify-between gap-3 text-sm">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                  <p>{error}</p>
                </div>
                <button
                  onClick={() => ejecutarAjuste()}
                  className="text-xs font-medium underline shrink-0 hover:text-red-900 dark:hover:text-red-100"
                >
                  Intentar de nuevo
                </button>
              </div>
            )}

            {/* Banner de respaldo local por reglas si aplica */}
            {resultado?.esRespaldo && (
              <div className="p-3.5 rounded-xl bg-[#C8DBFF]/25 dark:bg-[#C8DBFF]/10 border border-[#0069E9]/30 text-xs text-[#0B1220] dark:text-[#F7FAFF] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#0069E9] shrink-0" />
                  <span>
                    <strong>Revisión por reglas local (sin IA).</strong> Se aplicaron correcciones gramaticales y léxicas sin procesar capturas.
                  </span>
                </div>
                <button
                  onClick={() => ejecutarAjuste()}
                  className="inline-flex items-center gap-1 font-medium text-[#0069E9] hover:underline"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reintentar con IA
                </button>
              </div>
            )}

            {/* Bloque de resultados */}
            {resultado && (
              <div className="space-y-8 pt-6 border-t border-[#C8DBFF]/40 dark:border-[#C8DBFF]/15">
                {/* Línea con lo leído en la captura si existe */}
                {resultado.lectura && resultado.lectura.trim() && (
                  <p className="text-xs font-medium text-[#0069E9] dark:text-[#C8DBFF]">
                    Lectura de captura: {resultado.lectura}
                  </p>
                )}

                {/* Diagnóstico */}
                {resultado.diagnostico && (
                  <p className="text-[16px] leading-relaxed text-[#0B1220]/85 dark:text-[#F7FAFF]/85">
                    {resultado.diagnostico}
                  </p>
                )}

                {/* 3 Opciones de copy */}
                <div className="space-y-6">
                  {resultado.opciones.map((opcion, idx) => (
                    <div
                      key={idx}
                      className="group p-5 rounded-2xl bg-white dark:bg-[#0B1220]/40 border border-[#C8DBFF]/60 dark:border-[#C8DBFF]/20 shadow-xs hover:border-[#0069E9]/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4 mb-3">
                        <span className="text-xs font-medium text-[#0069E9] dark:text-[#C8DBFF]">
                          {opcion.nota}
                        </span>
                        <button
                          onClick={() => copiarAlPortapapeles(opcion.texto, idx)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0B1220]/60 dark:text-[#F7FAFF]/60 hover:text-[#0069E9] dark:hover:text-[#0069E9] transition-colors"
                        >
                          {copiadoIdx === idx ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-600 font-semibold">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Texto de opción en 19 px */}
                      <p className="text-[19px] leading-relaxed text-[#0B1220] dark:text-[#F7FAFF] whitespace-pre-line font-normal">
                        {opcion.texto}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Enlace para pedir otras opciones */}
                <div className="flex justify-end">
                  <button
                    onClick={pedirOtrasOpciones}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0069E9] hover:text-[#0A3699] transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Pedir otras opciones
                  </button>
                </div>

                {/* Dos columnas: Sí hacer y No hacer */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#C8DBFF]/30 dark:border-[#C8DBFF]/10">
                  {/* Sí hacer */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-[#0069E9]">
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Sí hacer</span>
                    </div>
                    <ul className="space-y-2 text-[14px] leading-relaxed text-[#0B1220]/80 dark:text-[#F7FAFF]/80">
                      {resultado.dos.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-[#0069E9] mt-1 shrink-0">·</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* No hacer */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-[#DC2626]">
                      <X className="w-4 h-4 stroke-[2.5]" />
                      <span>No hacer</span>
                    </div>
                    <ul className="space-y-2 text-[14px] leading-relaxed text-[#0B1220]/80 dark:text-[#F7FAFF]/80">
                      {resultado.donts.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-[#DC2626] mt-1 shrink-0">·</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'ejemplos' && (
          /* Pestaña: Cómo hablamos */
          <div className="space-y-10">
            {/* Título y subtítulo */}
            <div className="space-y-2">
              <h1 className="text-3xl md:text-[34px] font-bold tracking-tight text-[#0B1220] dark:text-[#F7FAFF]">
                Así hablamos en tyba.
              </h1>
              <p className="text-[16px] leading-relaxed text-[#0B1220]/75 dark:text-[#F7FAFF]/75">
                Cada mensaje abre con calidez, informa con claridad y cierra con un impulso moderado. Siempre en «tú», siempre en «nosotros».
              </p>
            </div>

            {/* Los 5 ejemplos canónicos de tyba */}
            <div className="space-y-8">
              {[
                {
                  contexto: 'Alguien acaba de abrir su cuenta y pregunta «No entiendo muy bien esto. ¿Por dónde empiezo?»',
                  mensaje: 'Vamos a resolverlo juntos. Empecemos por definir tu horizonte de inversión y tu perfil de riesgo. ¡Buen momento para empezar!',
                  evitamos: 'Tranquilo, que empezar es lo más fácil.',
                  razon: 'Evitamos adjetivos con género y minimizar las dudas del usuario.',
                },
                {
                  contexto: 'Una persona quiere cambiar el valor de su inversión automática mensual',
                  mensaje: 'Lo vemos juntos. Puedes cambiar el valor ahora; se aplica al próximo débito programado. ¡Buena decisión ajustar tus aportes!',
                  evitamos: 'Usted puede modificar el monto cuando desee.',
                  razon: 'Tuteamos siempre y cerramos con impulso positivo.',
                },
                {
                  contexto: 'Una persona pregunta «Tengo 20 millones disponibles. ¿Qué me recomendarías?»',
                  mensaje: 'Queremos acompañarte bien en esto. Antes de sugerir algo, cuéntanos tu horizonte de tiempo y tu perfil de riesgo. ¡Hay varias opciones interesantes!',
                  evitamos: 'Te recomiendo invertir todo en la mejor opción del mercado.',
                  razon: 'Nunca asesoramos de forma cerrada ni usamos superlativos.',
                },
                {
                  contexto: 'Notamos saldo disponible sin invertir desde hace meses y escribimos primero',
                  mensaje: 'Queremos que ese dinero también trabaje para ti. Notamos que tienes saldo disponible sin invertir. ¡Puede ser un buen momento para ponerlo a trabajar!',
                  evitamos: 'Tu dinero está parado. Invierte en tyba y gana más.',
                  razon: 'Sin culpabilizar, sin invierte en tyba directo, sin promesas.',
                },
                {
                  contexto: 'Una persona quiere retirar todo su dinero',
                  mensaje: 'Aquí estamos para lo que necesites. Podemos iniciar el retiro total cuando quieras. ¡Listo! Si hay algo que podamos resolver antes, cuéntanos.',
                  evitamos: '¿Seguro que quieres retirar todo? Vas a perder rendimientos.',
                  razon: 'No dificultamos ni disuadimos con culpa ante un retiro.',
                },
              ].map((ej, idx) => (
                <div
                  key={idx}
                  className="space-y-3 pb-8 border-b border-[#C8DBFF]/40 dark:border-[#C8DBFF]/15 last:border-b-0"
                >
                  <p className="text-xs text-[#0B1220]/60 dark:text-[#F7FAFF]/60 font-medium">
                    {ej.contexto}
                  </p>

                  <div className="flex items-start justify-between gap-4">
                    <p className="text-[20px] leading-relaxed text-[#0B1220] dark:text-[#F7FAFF] font-normal">
                      «{ej.mensaje}»
                    </p>
                    <button
                      onClick={() => copiarAlPortapapeles(ej.mensaje, idx, true)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0069E9] hover:text-[#0A3699] shrink-0 pt-1"
                    >
                      {copiadoEjemploIdx === idx ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600 font-semibold">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="text-xs text-[#0B1220]/70 dark:text-[#F7FAFF]/70">
                    <span className="font-semibold text-red-600 dark:text-red-400">Evitamos: </span>
                    <span className="line-through decoration-red-500/80">{ej.evitamos}</span>
                    <span className="ml-2 text-[#0B1220]/50 dark:text-[#F7FAFF]/50">({ej.razon})</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Sección Otros momentos */}
            <div className="pt-8 border-t border-[#C8DBFF]/40 dark:border-[#C8DBFF]/15 space-y-6">
              <h2 className="text-xl font-bold tracking-tight text-[#0B1220] dark:text-[#F7FAFF]">
                Otros momentos
              </h2>

              <div className="space-y-6">
                {[
                  {
                    titulo: 'Bienvenida',
                    mensaje: 'Te damos la bienvenida a tyba. Estamos aquí para acompañarte desde tu primer paso. ¡Qué bueno tenerte aquí!',
                    evitamos: 'Bienvenido a tyba, la mejor plataforma para invertir.',
                  },
                  {
                    titulo: 'Confirmación de un aporte',
                    mensaje: 'Recibimos tu aporte, gracias por confiar en nosotros. Puedes ver el detalle en tu portafolio cuando quieras. ¡Buena decisión seguir avanzando hacia tus metas!',
                    evitamos: 'Aporte exitoso. Tus ganancias están aseguradas.',
                  },
                  {
                    titulo: 'Algo falla en la app',
                    mensaje: 'Algo no salió como esperábamos. Ya lo estamos revisando; vuelve a intentarlo en unos minutos. Gracias por tu paciencia.',
                    evitamos: 'Error 500. Usted debe reintentar.',
                  },
                ].map((momento, idx) => (
                  <div
                    key={idx}
                    className="space-y-2 p-5 rounded-2xl bg-white dark:bg-[#0B1220]/40 border border-[#C8DBFF]/50 dark:border-[#C8DBFF]/20"
                  >
                    <span className="text-xs font-semibold text-[#0069E9]">{momento.titulo}</span>
                    <p className="text-[18px] leading-relaxed text-[#0B1220] dark:text-[#F7FAFF]">
                      «{momento.mensaje}»
                    </p>
                    <div className="text-xs text-[#0B1220]/70 dark:text-[#F7FAFF]/70">
                      <span className="font-semibold text-red-600 dark:text-red-400">Evitamos: </span>
                      <span className="line-through decoration-red-500/80">{momento.evitamos}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pautas de UX Writing y Modales */}
            <div className="pt-8 border-t border-[#C8DBFF]/40 dark:border-[#C8DBFF]/15 space-y-4 text-sm text-[#0B1220]/80 dark:text-[#F7FAFF]/80">
              <h2 className="text-xl font-bold tracking-tight text-[#0B1220] dark:text-[#F7FAFF]">
                Pautas de UX Writing y microcopy
              </h2>

              <div className="space-y-3">
                <p>
                  <strong>Alineación en Modales / Dialogs:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs">
                  <li>Inferior a 3 líneas (menos de 20 palabras): texto centrado.</li>
                  <li>Superior a 3 líneas (más de 20 palabras): alineado a la izquierda.</li>
                  <li>
                    Acción destructiva (no reversible): Ícono Alert, confirmación explícita, consecuencias claras y CTA alineado al título.
                  </li>
                  <li>
                    Abandono de procesos: Ícono Alert amarillo, invitar a continuar en el botón principal, y botón secundario minimal en rojo.
                  </li>
                </ul>

                <p className="pt-2">
                  <strong>CTAs y botones:</strong>
                </p>
                <p className="text-xs">
                  Siempre empezar con verbos de acción directos: «Invertir ahora», «Ver portafolio», «Conocer riesgos». Evitar adjetivos con género dirigidos a la persona.
                </p>
              </div>
            </div>
          </div>
        )}

        {tab === 'claude' && (
          /* Pestaña: API para Claude */
          <div className="space-y-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[#0069E9]">
                <Bot className="w-6 h-6" />
                <span className="text-xs font-semibold tracking-wider uppercase">Integración Claude & MCP</span>
              </div>
              <h1 className="text-3xl md:text-[34px] font-bold tracking-tight text-[#0B1220] dark:text-[#F7FAFF]">
                Disponibiliza la API para Claude
              </h1>
              <p className="text-[16px] leading-relaxed text-[#0B1220]/75 dark:text-[#F7FAFF]/75">
                Conecta la voz y tono oficial de tyba directamente con Claude Projects, Claude Desktop (MCP) o la API de Anthropic para que Claude audite y redacte siempre con la personalidad de tyba.
              </p>
            </div>

            {/* Opción 1: Claude Projects / Custom Tools (OpenAPI) */}
            <div className="space-y-3 p-6 rounded-2xl bg-white dark:bg-[#0B1220]/40 border border-[#C8DBFF]/60 dark:border-[#C8DBFF]/20 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-[#0069E9]" />
                  <h3 className="text-base font-semibold text-[#0B1220] dark:text-[#F7FAFF]">
                    1. Claude Projects (OpenAPI)
                  </h3>
                </div>
                <button
                  onClick={() => copiarTextoGenerico(openApiUrl, 'openapi')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0069E9] hover:underline"
                >
                  {copiadoSnippet === 'openapi' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-semibold">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar URL OpenAPI</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-[#0B1220]/70 dark:text-[#F7FAFF]/70">
                En Claude.ai ve a <strong>Projects → Tu Proyecto → Set up Project → Custom Tools</strong> e importa directamente esta URL:
              </p>

              <div className="p-3 rounded-lg bg-neutral-100 dark:bg-neutral-900 font-mono text-xs text-[#0069E9] break-all select-all flex items-center justify-between gap-2">
                <span>{openApiUrl}</span>
                <a
                  href={openApiUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-neutral-500 hover:text-[#0069E9]"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              </div>
            </div>

            {/* Opción 2: Claude Desktop (MCP - Model Context Protocol) */}
            <div className="space-y-3 p-6 rounded-2xl bg-white dark:bg-[#0B1220]/40 border border-[#C8DBFF]/60 dark:border-[#C8DBFF]/20 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-[#0069E9]" />
                  <h3 className="text-base font-semibold text-[#0B1220] dark:text-[#F7FAFF]">
                    2. Claude Desktop (Configuración MCP)
                  </h3>
                </div>
                <button
                  onClick={() =>
                    copiarTextoGenerico(JSON.stringify(claudeDesktopMcpConfig, null, 2), 'mcp')
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0069E9] hover:underline"
                >
                  {copiadoSnippet === 'mcp' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-semibold">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar JSON MCP</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-[#0B1220]/70 dark:text-[#F7FAFF]/70">
                Añade este bloque a tu archivo <code className="bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">claude_desktop_config.json</code> para que Claude Desktop use la herramienta en cualquier chat:
              </p>

              <pre className="p-3.5 rounded-lg bg-neutral-900 text-neutral-100 font-mono text-xs overflow-x-auto leading-relaxed">
                {JSON.stringify(claudeDesktopMcpConfig, null, 2)}
              </pre>
            </div>

            {/* Opción 3: Definición de Tool JSON (Claude API / Anthropic SDK) */}
            <div className="space-y-3 p-6 rounded-2xl bg-white dark:bg-[#0B1220]/40 border border-[#C8DBFF]/60 dark:border-[#C8DBFF]/20 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bot className="w-5 h-5 text-[#0069E9]" />
                  <h3 className="text-base font-semibold text-[#0B1220] dark:text-[#F7FAFF]">
                    3. Tool Definition (Claude API / Anthropic SDK)
                  </h3>
                </div>
                <button
                  onClick={() =>
                    copiarTextoGenerico(JSON.stringify(claudeToolDefinition, null, 2), 'tool')
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0069E9] hover:underline"
                >
                  {copiadoSnippet === 'tool' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-semibold">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Schema</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-[#0B1220]/70 dark:text-[#F7FAFF]/70">
                Pega este objeto dentro del array <code className="bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">tools: [...]</code> en tus llamadas a la API de Claude:
              </p>

              <pre className="p-3.5 rounded-lg bg-neutral-900 text-neutral-100 font-mono text-xs overflow-x-auto leading-relaxed">
                {JSON.stringify(claudeToolDefinition, null, 2)}
              </pre>
            </div>

            {/* Opción 4: cURL directo */}
            <div className="space-y-3 p-6 rounded-2xl bg-white dark:bg-[#0B1220]/40 border border-[#C8DBFF]/60 dark:border-[#C8DBFF]/20 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-[#0069E9]" />
                  <h3 className="text-base font-semibold text-[#0B1220] dark:text-[#F7FAFF]">
                    4. Llamada HTTP directa (cURL)
                  </h3>
                </div>
                <button
                  onClick={() => copiarTextoGenerico(curlExample, 'curl')}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0069E9] hover:underline"
                >
                  {copiadoSnippet === 'curl' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-semibold">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar cURL</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-3.5 rounded-lg bg-neutral-900 text-neutral-100 font-mono text-xs overflow-x-auto leading-relaxed">
                {curlExample}
              </pre>
            </div>
          </div>
        )}
      </main>

      {/* Pie de página discreto */}
      <footer className="border-t border-[#C8DBFF]/30 dark:border-[#C8DBFF]/15 py-8 mt-12 text-center text-xs text-[#0B1220]/50 dark:text-[#F7FAFF]/50">
        <p>tyba · Credicorp Capital · Colombia, Perú y Chile</p>
        <p className="mt-1">
          Guía editorial y de diseño de voz y tono ·{' '}
          <a
            href="#claude"
            onClick={() => changeTab('claude')}
            className="text-[#0069E9] hover:underline"
          >
            API para Claude & MCP
          </a>
        </p>
      </footer>
    </div>
  );
}
