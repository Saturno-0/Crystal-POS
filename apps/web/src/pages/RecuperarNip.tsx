import { useState } from 'react';
import { useToast } from '../components/feedback/ToastProvider';
import * as authApi from '../features/auth/api';

const inputStyle = {
  height: 42,
  borderRadius: 8,
  border: '1px solid var(--border2)',
  background: 'var(--surface)',
  color: 'var(--text)',
  padding: '0 12px',
  font: "400 13.5px/1 var(--font-ui)",
  outline: 'none',
} as const;

/**
 * Recuperación de NIP vía pregunta de seguridad — pensada para el caso en
 * que el único Admin olvide su NIP y quede sin forma de entrar a Personal.
 */
export function RecuperarNip({ onCerrar }: { onCerrar: () => void }) {
  const { mostrar } = useToast();
  const [usuario, setUsuario] = useState('');
  const [respuesta, setRespuesta] = useState('');
  const [nuevoNip, setNuevoNip] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setError('');
    if (!usuario.trim() || !respuesta.trim() || nuevoNip.length !== 4) {
      setError('Completa usuario, respuesta y un NIP de 4 dígitos.');
      return;
    }
    setEnviando(true);
    try {
      await authApi.recuperarNip(usuario.trim(), respuesta.trim(), nuevoNip);
      mostrar('NIP actualizado · ya puedes iniciar sesión');
      onCerrar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el NIP.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 12,
        borderRadius: 9,
        border: '1px solid var(--border)',
        background: 'var(--surface2)',
      }}
    >
      <span style={{ font: "600 12px/1.3 var(--font-ui)" }}>Recuperar acceso</span>
      <input
        style={inputStyle}
        placeholder="Usuario de acceso"
        value={usuario}
        onChange={(e) => setUsuario(e.target.value)}
      />
      <input
        style={inputStyle}
        placeholder="Respuesta a tu pregunta de seguridad"
        value={respuesta}
        onChange={(e) => setRespuesta(e.target.value)}
      />
      <input
        style={inputStyle}
        placeholder="Nuevo NIP (4 dígitos)"
        inputMode="numeric"
        value={nuevoNip}
        onChange={(e) => setNuevoNip(e.target.value.replace(/\D/g, '').slice(0, 4))}
      />
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
          onClick={enviar}
          disabled={enviando}
          style={{
            flex: 1,
            height: 38,
            border: 'none',
            borderRadius: 8,
            background: 'var(--primary)',
            color: 'var(--pfg)',
            font: "600 12.5px/1 var(--font-ui)",
            cursor: 'pointer',
          }}
        >
          Actualizar NIP
        </button>
        <button
          type="button"
          onClick={onCerrar}
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
