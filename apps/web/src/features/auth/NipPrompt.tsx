import { useEffect, useRef, useState } from 'react';

/**
 * Pide el NIP de una cuenta puntual — usado al cambiar de sesión hacia un
 * Admin (ver prepararCambioSesion en el backend): un Vendedor no puede
 * "entrar como" Admin sin conocer su NIP.
 */
export function NipPrompt({
  nombre,
  onConfirmar,
  onCancelar,
}: {
  nombre: string;
  onConfirmar: (nip: string) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nip, setNip] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function confirmar() {
    if (nip.length !== 4 || enviando) return;
    setEnviando(true);
    try {
      await onConfirmar(nip);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo verificar el NIP.');
      setNip('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 14,
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--surface2)',
      }}
    >
      <span style={{ font: "600 13px/1.3 var(--font-ui)" }}>NIP de {nombre}</span>

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 9,
                border: `1px solid var(${nip.length === i ? '--primary' : '--border2'})`,
                background: 'var(--surface)',
                display: 'grid',
                placeItems: 'center',
                font: "700 20px/1 var(--font-mono)",
              }}
            >
              {nip[i] ? '•' : ''}
            </div>
          ))}
        </div>
        <input
          ref={inputRef}
          value={nip}
          onChange={(e) => {
            setError('');
            setNip(e.target.value.replace(/\D/g, '').slice(0, 4));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirmar();
          }}
          inputMode="numeric"
          autoComplete="off"
          aria-label={`NIP de ${nombre}`}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0 }}
        />
      </div>

      {error && (
        <div
          style={{
            background: 'var(--badsoft)',
            border: '1px solid var(--bad)',
            color: 'var(--badtext)',
            borderRadius: 8,
            padding: '6px 8px',
            font: "500 11px/1.4 var(--font-ui)",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={confirmar}
          disabled={nip.length !== 4 || enviando}
          style={{
            flex: 1,
            height: 38,
            border: 'none',
            borderRadius: 8,
            background: nip.length === 4 ? 'var(--primary)' : 'var(--chip)',
            color: nip.length === 4 ? 'var(--pfg)' : 'var(--faint)',
            font: "600 12.5px/1 var(--font-ui)",
            cursor: nip.length === 4 ? 'pointer' : 'not-allowed',
          }}
        >
          Confirmar
        </button>
        <button
          type="button"
          onClick={onCancelar}
          style={{
            height: 38,
            padding: '0 12px',
            border: '1px solid var(--border2)',
            borderRadius: 8,
            background: 'transparent',
            color: 'var(--muted)',
            font: "500 12.5px/1 var(--font-ui)",
            cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
