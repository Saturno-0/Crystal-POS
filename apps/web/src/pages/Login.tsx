import { useEffect, useRef, useState } from 'react';
import { useToast } from '../components/feedback/ToastProvider';
import { useAuth } from '../features/auth/AuthContext';
import * as authApi from '../features/auth/api';
import { AccesoQr } from '../features/acceso/AccesoQr';
import type { UsuarioSesion } from '../features/auth/types';
import { RecuperarNip } from './RecuperarNip';

export function Login() {
  const { iniciarSesion } = useAuth();
  const { mostrar } = useToast();
  const [usuarios, setUsuarios] = useState<UsuarioSesion[]>([]);
  const [loginSel, setLoginSel] = useState<number | null>(null);
  const [nip, setNip] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mostrarRecuperar, setMostrarRecuperar] = useState(false);
  const nipInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    authApi
      .listarUsuarios()
      .then((lista) => setUsuarios(lista.slice(0, 4)))
      .catch(() => setError('No se pudo cargar la lista de personal.'));
  }, []);

  // Foco automático en el input real de NIP al elegir usuario, para que se
  // pueda escribir de inmediato con el teclado físico del dispositivo.
  useEffect(() => {
    if (loginSel !== null) nipInputRef.current?.focus();
  }, [loginSel]);

  function seleccionar(id: number) {
    setLoginSel(id);
    setNip('');
    setError('');
  }

  function cambiarNip(valor: string) {
    setError('');
    setNip(valor.replace(/\D/g, '').slice(0, 4));
  }

  async function entrar() {
    if (loginSel === null || nip.length !== 4 || enviando) return;
    setEnviando(true);
    try {
      const usuario = await iniciarSesion(loginSel, nip);
      mostrar(`Bienvenida, ${usuario.nombre}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.');
      setNip('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'grid',
        placeItems: 'center',
        padding: 30,
        background: 'var(--surface2)',
        minHeight: '100vh',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, maxWidth: '100%' }}>
        <div
          style={{
            width: 400,
            maxWidth: '100%',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            boxShadow: 'var(--shadow)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 11,
                  background: 'var(--primary)',
                  color: 'var(--pfg)',
                  display: 'grid',
                  placeItems: 'center',
                  font: '700 16px/1 var(--font-ui)',
                }}
              >
                C
              </div>
              <div>
                <div style={{ font: '700 18px/1.2 var(--font-ui)' }}>Iniciar sesión</div>
                <div style={{ font: '400 11.5px/1.3 var(--font-mono)', color: 'var(--muted)' }}>
                  Crystal POS · sucursal Centro
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {usuarios.map((u) => {
              const seleccionado = u.id === loginSel;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => seleccionar(u.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 9,
                    border: seleccionado ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    background: seleccionado ? 'var(--psoft)' : 'var(--surface)',
                    cursor: 'pointer',
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
                      font: '600 11px/1 var(--font-ui)',
                      flex: 'none',
                    }}
                  >
                    {u.ini}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '600 13px/1.3 var(--font-ui)' }}>{u.nombre}</div>
                    <div style={{ font: '400 10.5px/1.3 var(--font-mono)', color: 'var(--faint)' }}>
                      {u.usuario} · {u.rol === 'admin' ? 'Admin' : 'Vendedor'}
                    </div>
                  </span>
                  {seleccionado && (
                    <span style={{ font: '600 10.5px/1 var(--font-mono)', color: 'var(--ptext)' }}>
                      ● activo
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Casillas visuales de NIP, sobre un input real que captura el
            teclado físico del dispositivo (numérico, sin teclado en pantalla). */}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 46,
                    borderRadius: 9,
                    border: `1px solid var(${nip.length === i ? '--primary' : '--border2'})`,
                    background: 'var(--surface2)',
                    display: 'grid',
                    placeItems: 'center',
                    font: '700 23px/1 var(--font-mono)',
                  }}
                >
                  {nip[i] ? '•' : ''}
                </div>
              ))}
            </div>
            <input
              ref={nipInputRef}
              value={nip}
              onChange={(e) => cambiarNip(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') entrar();
              }}
              disabled={loginSel === null}
              inputMode="numeric"
              autoComplete="off"
              aria-label="NIP"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: loginSel === null ? 'not-allowed' : 'text',
              }}
            />
          </div>

          {error && (
            <div
              style={{
                background: 'var(--badsoft)',
                border: '1px solid var(--bad)',
                color: 'var(--badtext)',
                borderRadius: 8,
                padding: '8px 10px',
                font: '500 11.5px/1.4 var(--font-ui)',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={nip.length !== 4 || loginSel === null || enviando}
            onClick={entrar}
            style={{
              height: 48,
              border: 'none',
              borderRadius: 9,
              background: nip.length === 4 ? 'var(--primary)' : 'var(--chip)',
              color: nip.length === 4 ? 'var(--pfg)' : 'var(--faint)',
              font: '600 16.5px/1 var(--font-ui)',
              cursor: nip.length === 4 ? 'pointer' : 'not-allowed',
            }}
          >
            Entrar
          </button>

          <button
            type="button"
            onClick={() => mostrar('Solo el Admin registra personal · pide a un Admin que inicie sesión')}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--muted)',
              font: '500 12px/1.3 var(--font-ui)',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            Registrar nuevo personal
          </button>

          {mostrarRecuperar ? (
            <RecuperarNip onCerrar={() => setMostrarRecuperar(false)} />
          ) : (
            <button
              type="button"
              onClick={() => setMostrarRecuperar(true)}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--faint)',
                font: '500 11.5px/1.3 var(--font-ui)',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              ¿Olvidaste tu NIP?
            </button>
          )}
        </div>
        <AccesoQr />
      </div>
    </div>
  );
}
