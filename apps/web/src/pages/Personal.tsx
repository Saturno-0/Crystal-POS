import { useEffect, useState } from 'react';
import { ApiError } from '../lib/apiClient';
import { useToast } from '../components/feedback/ToastProvider';
import { useAuth } from '../features/auth/AuthContext';
import * as authApi from '../features/auth/api';
import { NipPrompt } from '../features/auth/NipPrompt';
import type { UsuarioSesion } from '../features/auth/types';
import styles from './Personal.module.css';

const FORM_INICIAL = {
  nombre: '',
  usuario: '',
  nip: '',
  tasaComision: '6',
  rol: 'vendedor' as 'admin' | 'vendedor',
  preguntaSeguridad: '',
  respuestaSeguridad: '',
};

export function Personal() {
  const { usuario: sesionActiva, cambiarUsuarioActivo } = useAuth();
  const { mostrar } = useToast();
  const [usuarios, setUsuarios] = useState<UsuarioSesion[]>([]);
  const [form, setForm] = useState(FORM_INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [pendienteEntrarComo, setPendienteEntrarComo] = useState<UsuarioSesion | null>(null);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [edicion, setEdicion] = useState({ nombre: '', usuario: '', tasaComision: '' });
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  async function recargar() {
    setUsuarios(await authApi.listarUsuarios());
  }

  useEffect(() => {
    recargar().catch(() => undefined);
  }, []);

  function actualizarCampo<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((actual) => ({ ...actual, [campo]: valor }));
  }

  async function entrarComo(u: UsuarioSesion) {
    if (u.id === sesionActiva?.id) return;
    // Cambiar hacia un Admin exige su NIP; hacia un Vendedor no.
    if (u.rol === 'admin') {
      setPendienteEntrarComo(u);
      return;
    }
    const nuevo = await cambiarUsuarioActivo(u.id);
    mostrar(`Ahora operas como ${nuevo.nombre}`);
  }

  async function confirmarEntrarComoConNip(nip: string) {
    if (!pendienteEntrarComo) return;
    const nuevo = await cambiarUsuarioActivo(pendienteEntrarComo.id, nip);
    mostrar(`Ahora operas como ${nuevo.nombre}`);
    setPendienteEntrarComo(null);
  }

  async function cambiarRol(u: UsuarioSesion) {
    const nuevoRol = u.rol === 'admin' ? 'vendedor' : 'admin';
    try {
      await authApi.cambiarRol(u.id, nuevoRol);
      await recargar();
      mostrar(`${u.nombre} ahora es ${nuevoRol === 'admin' ? 'Admin' : 'Vendedor'}`);
    } catch (err) {
      mostrar(err instanceof ApiError ? err.message : 'No se pudo cambiar el rol');
    }
  }

  function iniciarEdicion(u: UsuarioSesion) {
    setEditandoId(u.id);
    setEdicion({ nombre: u.nombre, usuario: u.usuario, tasaComision: String(u.tasaComision) });
  }

  async function guardarEdicion(u: UsuarioSesion) {
    if (guardandoEdicion) return;
    setGuardandoEdicion(true);
    try {
      if (edicion.nombre !== u.nombre || edicion.usuario !== u.usuario) {
        await authApi.actualizarPerfil(u.id, { nombre: edicion.nombre, usuario: edicion.usuario });
      }
      const nuevaComision = Number(edicion.tasaComision);
      if (nuevaComision !== u.tasaComision) {
        await authApi.cambiarComision(u.id, nuevaComision);
      }
      await recargar();
      setEditandoId(null);
      mostrar('Datos actualizados');
    } catch (err) {
      mostrar(err instanceof ApiError ? err.message : 'No se pudieron guardar los cambios');
    } finally {
      setGuardandoEdicion(false);
    }
  }

  async function eliminar(u: UsuarioSesion) {
    try {
      await authApi.darDeBaja(u.id);
      await recargar();
    } catch (err) {
      mostrar(err instanceof ApiError ? err.message : 'No se pudo eliminar el usuario');
    }
  }

  async function registrar() {
    if (enviando) return;
    setEnviando(true);
    try {
      const creado = await authApi.crearUsuario({
        nombre: form.nombre,
        usuario: form.usuario.trim() || undefined,
        nip: form.nip,
        tasaComision: Number(form.tasaComision) || 0,
        rol: form.rol,
        preguntaSeguridad: form.preguntaSeguridad.trim() || undefined,
        respuestaSeguridad: form.respuestaSeguridad.trim() || undefined,
      });
      await recargar();
      setForm(FORM_INICIAL);
      mostrar(`Usuario registrado: ${creado.usuario}`);
    } catch (err) {
      mostrar(err instanceof ApiError ? err.message : 'No se pudo registrar el usuario');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={styles.layout}>
      <div className={styles.panel}>
        <h2 style={{ font: "700 15px/1.2 var(--font-ui)", margin: 0 }}>
          Usuarios registrados · {usuarios.length}
        </h2>
        {usuarios.map((u) => {
          const esSesionActiva = u.id === sesionActiva?.id;

          if (editandoId === u.id) {
            return (
              <div key={u.id} className={styles.fila} style={{ flexWrap: 'wrap', gap: 8 }}>
                <span className={styles.avatar}>{u.ini}</span>
                <input
                  className={styles.input}
                  style={{ flex: 1, minWidth: 140, height: 34 }}
                  value={edicion.nombre}
                  onChange={(e) => setEdicion((v) => ({ ...v, nombre: e.target.value }))}
                  placeholder="Nombre completo"
                />
                <input
                  className={styles.input}
                  style={{ width: 120, height: 34 }}
                  value={edicion.usuario}
                  onChange={(e) => setEdicion((v) => ({ ...v, usuario: e.target.value }))}
                  placeholder="Usuario"
                />
                <input
                  className={styles.input}
                  style={{ width: 70, height: 34 }}
                  value={edicion.tasaComision}
                  onChange={(e) =>
                    setEdicion((v) => ({ ...v, tasaComision: e.target.value.replace(/[^0-9.]/g, '') }))
                  }
                  inputMode="decimal"
                  placeholder="%"
                />
                <span className={styles.acciones}>
                  <button
                    type="button"
                    className={styles.btnAccion}
                    disabled={guardandoEdicion}
                    onClick={() => guardarEdicion(u)}
                  >
                    Guardar
                  </button>
                  <button type="button" className={styles.btnAccion} onClick={() => setEditandoId(null)}>
                    Cancelar
                  </button>
                </span>
              </div>
            );
          }

          return (
            <div key={u.id} className={styles.fila}>
              <span className={styles.avatar}>{u.ini}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: "600 13px/1.3 var(--font-ui)" }}>{u.nombre}</div>
                <div style={{ font: "400 11px/1.3 var(--font-mono)", color: 'var(--faint)' }}>
                  {u.usuario} · comisión {u.tasaComision}%
                </div>
              </span>
              <span className={u.rol === 'admin' ? styles.badgeAdmin : styles.badgeVendedor}>
                {u.rol === 'admin' ? 'ADMIN' : 'VENDEDOR'}
              </span>
              <span className={styles.acciones}>
                <button
                  type="button"
                  className={styles.btnAccion}
                  disabled={esSesionActiva}
                  onClick={() => entrarComo(u)}
                >
                  {esSesionActiva ? 'Sesión activa' : 'Entrar como'}
                </button>
                <button type="button" className={styles.btnAccion} onClick={() => iniciarEdicion(u)}>
                  Editar
                </button>
                <button type="button" className={styles.btnAccion} onClick={() => cambiarRol(u)}>
                  Cambiar rol
                </button>
                <button
                  type="button"
                  className={styles.btnPeligro}
                  disabled={esSesionActiva}
                  onClick={() => eliminar(u)}
                >
                  Eliminar
                </button>
              </span>
            </div>
          );
        })}

        {pendienteEntrarComo && (
          <NipPrompt
            nombre={pendienteEntrarComo.nombre}
            onConfirmar={confirmarEntrarComoConNip}
            onCancelar={() => setPendienteEntrarComo(null)}
          />
        )}
      </div>

      <div className={styles.panel}>
        <h2 style={{ font: "700 15px/1.2 var(--font-ui)", margin: 0 }}>Registrar nuevo personal</h2>

        <div className={styles.campo}>
          <label>Nombre completo</label>
          <input
            className={styles.input}
            value={form.nombre}
            onChange={(e) => actualizarCampo('nombre', e.target.value)}
            placeholder="Nombre y apellido"
          />
        </div>

        <div className={styles.campo}>
          <label>Usuario de acceso</label>
          <input
            className={styles.input}
            value={form.usuario}
            onChange={(e) => actualizarCampo('usuario', e.target.value)}
            placeholder="Autogenerado si se deja vacío"
          />
        </div>

        <div className={styles.campo}>
          <label>NIP (4 dígitos)</label>
          <input
            className={styles.input}
            value={form.nip}
            onChange={(e) => actualizarCampo('nip', e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            placeholder="0000"
          />
        </div>

        <div className={styles.campo}>
          <label>Comisión %</label>
          <input
            className={styles.input}
            value={form.tasaComision}
            onChange={(e) => actualizarCampo('tasaComision', e.target.value.replace(/[^0-9.]/g, ''))}
            inputMode="decimal"
          />
        </div>

        <div className={styles.campo}>
          <label>Rol</label>
          <div className={styles.segmented}>
            <button
              type="button"
              className={form.rol === 'admin' ? styles.segmentedBtnActivo : styles.segmentedBtn}
              onClick={() => actualizarCampo('rol', 'admin')}
            >
              Admin
            </button>
            <button
              type="button"
              className={form.rol === 'vendedor' ? styles.segmentedBtnActivo : styles.segmentedBtn}
              onClick={() => actualizarCampo('rol', 'vendedor')}
            >
              Vendedor
            </button>
          </div>
          <span className={styles.ayuda}>
            {form.rol === 'admin'
              ? 'Acceso completo: ventas, alta, apartados, reportes y personal.'
              : 'Acceso a ventas, alta y apartados. Sin reportes ni personal.'}
          </span>
        </div>

        <div className={styles.campo}>
          <label>Pregunta de seguridad (opcional)</label>
          <input
            className={styles.input}
            value={form.preguntaSeguridad}
            onChange={(e) => actualizarCampo('preguntaSeguridad', e.target.value)}
            placeholder="Para recuperar el NIP si se olvida"
          />
        </div>

        {form.preguntaSeguridad && (
          <div className={styles.campo}>
            <label>Respuesta</label>
            <input
              className={styles.input}
              value={form.respuestaSeguridad}
              onChange={(e) => actualizarCampo('respuestaSeguridad', e.target.value)}
            />
          </div>
        )}

        <button type="button" className={styles.btnSubmit} onClick={registrar} disabled={enviando}>
          Registrar usuario
        </button>
      </div>
    </div>
  );
}
