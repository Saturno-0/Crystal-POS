import { COLOR_MAX_CARACTERES, COLORES_COMUNES, normalizarColor } from '@crystal/shared';
import { useState } from 'react';
import styles from './Alta.module.css';

/**
 * Colores para categorías por color (sacos, pantalones de vestir): botones con
 * los colores comunes + un campo para escribir uno que no esté en la lista.
 * Se usa en el alta individual (elige un color) y en el modal color × talla
 * (agrega filas de color; `excluir` oculta los que ya están agregados).
 */
export function SelectorColor({
  seleccionado,
  excluir = [],
  textoBoton,
  onElegir,
}: {
  seleccionado?: string | null;
  excluir?: readonly string[];
  textoBoton: string;
  onElegir: (color: string) => void;
}) {
  const [otro, setOtro] = useState('');
  const visibles = COLORES_COMUNES.filter((c) => !excluir.includes(c));
  // Un color escrito a mano que ya está elegido también se ve como chip activo.
  const personalizado = seleccionado && !COLORES_COMUNES.includes(seleccionado) ? seleccionado : null;

  function usarOtro() {
    const color = normalizarColor(otro);
    if (!color) return;
    onElegir(color);
    setOtro('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className={styles.chips}>
        {visibles.map((c) => (
          <button
            key={c}
            type="button"
            className={c === seleccionado ? styles.chipTallaActiva : styles.chipTalla}
            onClick={() => onElegir(c)}
          >
            {c}
          </button>
        ))}
        {personalizado && (
          <button type="button" className={styles.chipTallaActiva}>
            {personalizado}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className={styles.inputSecundario}
          style={{ flex: 1, minWidth: 0 }}
          value={otro}
          maxLength={COLOR_MAX_CARACTERES}
          onChange={(e) => setOtro(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') usarOtro();
          }}
          placeholder="Otro color"
          aria-label="Otro color"
        />
        <button
          type="button"
          onClick={usarOtro}
          disabled={!normalizarColor(otro)}
          className={styles.chipTalla}
          style={{ flex: 'none' }}
        >
          {textoBoton}
        </button>
      </div>
    </div>
  );
}
