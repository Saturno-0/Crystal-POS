import { useEffect, useState } from 'react';
import { useToast } from '../components/feedback/ToastProvider';
import { useAuth } from '../features/auth/AuthContext';
import * as authApi from '../features/auth/api';
import { NipPrompt } from '../features/auth/NipPrompt';
import type { UsuarioSesion } from '../features/auth/types';

export function CambioUsuario() {
  const { usuario, cambiarUsuarioActivo, cerrarSesion } = useAuth();
  const { mostrar } = useToast();
  const [usuarios, setUsuarios] = useState<UsuarioSesion[]>([]);
  const [pendiente, setPendiente] = useState<UsuarioSesion | null>(null);

  useEffect(() => {
    authApi.listarUsuarios().then(setUsuarios).catch(() => undefined);
  }, []);

  async function seleccionar(u: UsuarioSesion) {
    if (u.id === usuario?.id) return;
    // Cambiar hacia un Admin exige su NIP; hacia un Vendedor no.
    if (u.rol === 'admin') {
      setPendiente(u);
      return;
    }
    const nuevo = await cambiarUsuarioActivo(u.id);
    mostrar(`Ahora operas como ${nuevo.nombre}`);
  }

  async function confirmarConNip(nip: string) {
    if (!pendiente) return;
    const nuevo = await cambiarUsuarioActivo(pendiente.id, nip);
    mostrar(`Ahora operas como ${nuevo.nombre}`);
    setPendiente(null);
  }

  return (
    <div
      style={{
        maxWidth: 460,
        margin: '0 auto',
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <h1 style={{ font: "700 18px/1.2 var(--font-ui)", margin: 0 }}>Cambiar de usuario</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {usuarios.map((u) => {
          const activo = u.id === usuario?.id;
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => seleccionar(u)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 9,
                border: activo ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                background: activo ? 'var(--psoft)' : 'var(--surface)',
                cursor: activo ? 'default' : 'pointer',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--chip)',
                  display: 'grid',
                  placeItems: 'center',
                  font: "600 11px/1 var(--font-ui)",
                  flex: 'none',
                }}
              >
                {u.ini}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 13px/1.3 var(--font-ui)" }}>{u.nombre}</div>
                <div style={{ font: "400 10.5px/1.3 var(--font-mono)", color: 'var(--faint)' }}>
                  {u.usuario} · {u.rol === 'admin' ? 'Admin' : 'Vendedor'}
                </div>
              </span>
              {activo && (
                <span style={{ font: "600 10.5px/1 var(--font-mono)", color: 'var(--ptext)' }}>
                  ● sesión activa
                </span>
              )}
            </button>
          );
        })}
      </div>

      {pendiente && (
        <NipPrompt
          nombre={pendiente.nombre}
          onConfirmar={confirmarConNip}
          onCancelar={() => setPendiente(null)}
        />
      )}

      <button
        type="button"
        onClick={cerrarSesion}
        style={{
          height: 46,
          border: '1px solid var(--border2)',
          borderRadius: 9,
          background: 'var(--surface)',
          color: 'var(--text)',
          font: "600 13.5px/1 var(--font-ui)",
          cursor: 'pointer',
        }}
      >
        Cerrar sesión y volver al inicio
      </button>
    </div>
  );
}
