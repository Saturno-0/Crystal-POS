import { DESCUENTOS_VESTIDO, TALLAS_POR_TIPO, type Categoria, type Producto, type TipoDescuento } from '@crystal/shared';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '../components/feedback/ToastProvider';
import { useAuth } from '../features/auth/AuthContext';
import * as productosApi from '../features/productos/api';
import { ApiError } from '../lib/apiClient';
import styles from './Alta.module.css';
import { GestionCategorias } from './GestionCategorias';
import { ModalLotePorTallas } from './ModalLotePorTallas';
import { SelectorColor } from './SelectorColor';

const PRESETS_LOTE = [5, 10, 20];

function tallaPorDefecto(categoria: Categoria | undefined): string {
  if (!categoria) return '';
  const opciones = TALLAS_POR_TIPO[categoria.tipoTalla];
  if (!opciones) return ''; // sin_talla (vestidos)
  return categoria.tipoTalla === 'numerica_pantalon' ? opciones[0] : 'M';
}

function prefijoSku(texto: string, largo: number): string {
  const limpio = texto.replace(/[^a-zA-Z]/g, '').toUpperCase();
  return (limpio.slice(0, largo) || 'X'.repeat(largo)).padEnd(largo, 'X');
}

export function Alta({
  productoEnEdicion,
  onTerminarEdicion,
}: {
  productoEnEdicion?: Producto | null;
  onTerminarEdicion?: () => void;
} = {}) {
  const { mostrar } = useToast();
  const { usuario } = useAuth();
  const editando = !!productoEnEdicion;
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [modo, setModo] = useState<'unica' | 'lote'>('unica');
  const [nombre, setNombre] = useState('');
  const [marca, setMarca] = useState('');
  const [precio, setPrecio] = useState('');
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [talla, setTalla] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [descuentoVestido, setDescuentoVestido] = useState<{ tipo: TipoDescuento; valor: number } | null>(
    null,
  );
  const [cantidad, setCantidad] = useState(5);
  const [stockEditado, setStockEditado] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [modalTallasAbierto, setModalTallasAbierto] = useState(false);

  const cargarCategorias = useCallback(
    (mantenerSeleccion: boolean) => {
      productosApi
        .listarCategorias()
        .then((lista) => {
          setCategorias(lista);
          setCategoriaId((actualId) => {
            if (mantenerSeleccion && lista.some((c) => c.id === actualId)) return actualId;
            const primera = lista[0];
            setTalla(tallaPorDefecto(primera));
            return primera?.id ?? null;
          });
        })
        .catch((err) => mostrar(err instanceof ApiError ? err.message : 'No se pudieron cargar las categorías'));
    },
    [mostrar],
  );

  useEffect(() => {
    // En edición, mantenerSeleccion evita que la carga de categorías
    // sobrescriba la categoría/talla ya precargadas del producto.
    cargarCategorias(!!productoEnEdicion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargarCategorias]);

  // Precarga el formulario al entrar en modo edición (HU-2.5, desde Reportes).
  // La categoría solo se puede mover a otra con el mismo tipo de talla (ver
  // productos.service.ts): así la talla ya guardada sigue siendo válida sin
  // tener que volver a elegirla.
  useEffect(() => {
    if (!productoEnEdicion) return;
    setModo('unica');
    setNombre(productoEnEdicion.nombre);
    setMarca(productoEnEdicion.marca);
    setPrecio(String(productoEnEdicion.precio));
    setStockEditado(String(productoEnEdicion.stock));
    setCategoriaId(productoEnEdicion.categoriaId);
    setTalla(productoEnEdicion.talla ?? '');
    setColor(productoEnEdicion.color);
    setDescuentoVestido(
      productoEnEdicion.descuentoTipo && productoEnEdicion.descuentoValor
        ? { tipo: productoEnEdicion.descuentoTipo, valor: productoEnEdicion.descuentoValor }
        : null,
    );
  }, [productoEnEdicion]);

  const categoria = categorias.find((c) => c.id === categoriaId);
  const opcionesTalla = categoria ? TALLAS_POR_TIPO[categoria.tipoTalla] : null;
  const esVestido = categoria?.tipoTalla === 'sin_talla';
  const porColor = !!categoria?.porColor;

  // En edición, solo se puede mover el producto a una categoría con el
  // mismo tipo de talla (y que también maneje o no color) que la original (nunca la que trae el producto en
  // sí, que puede cambiar mientras se edita) — así la talla actual siempre
  // sigue siendo válida sin tener que volver a elegirla.
  const categoriaOriginal = editando
    ? categorias.find((c) => c.id === productoEnEdicion?.categoriaId)
    : undefined;
  const categoriasElegibles = categoriaOriginal
    ? categorias.filter(
        (c) => c.tipoTalla === categoriaOriginal.tipoTalla && c.porColor === categoriaOriginal.porColor,
      )
    : categorias;

  function elegirCategoria(c: Categoria) {
    setCategoriaId(c.id);
    if (editando) return; // mismo tipo de talla por construcción: talla/descuento se quedan igual
    setTalla(tallaPorDefecto(c));
    setDescuentoVestido(null);
    if (!c.porColor) setColor(null);
  }

  function limpiar() {
    setNombre('');
    setMarca('');
    setPrecio('');
    setCantidad(5);
    setDescuentoVestido(null);
    setColor(null);
    if (categorias.length > 0) {
      setCategoriaId(categorias[0].id);
      setTalla(tallaPorDefecto(categorias[0]));
    }
  }

  async function enviar() {
    if (enviando) return;
    if (!nombre.trim()) return mostrar('Captura el nombre del producto');
    const precioNumero = Number(precio);
    if (!precio || !Number.isFinite(precioNumero) || precioNumero <= 0) {
      return mostrar('Captura un precio válido');
    }
    if (!categoriaId) return mostrar('Selecciona una categoría');
    if (porColor && !color) return mostrar('Elige el color del producto');
    const stockNumero = Number(stockEditado);
    if (editando && (!stockEditado || !Number.isInteger(stockNumero) || stockNumero < 0)) {
      return mostrar('Captura una cantidad de inventario válida');
    }

    setEnviando(true);
    try {
      if (editando && productoEnEdicion) {
        await productosApi.editarProducto(productoEnEdicion.id, {
          nombre: nombre.trim(),
          marca: marca.trim(),
          precio: precioNumero,
          stock: stockNumero,
          talla: esVestido ? undefined : talla,
          color: porColor && color ? color : undefined,
          categoriaId: categoriaId ?? undefined,
          descuentoTipo: descuentoVestido?.tipo ?? null,
          descuentoValor: descuentoVestido?.valor ?? null,
        });
        mostrar(`${nombre.trim()} actualizado`);
        onTerminarEdicion?.();
        return;
      }

      const creado = await productosApi.crearProducto({
        nombre: nombre.trim(),
        marca: marca.trim(),
        categoriaId,
        talla: esVestido ? undefined : talla,
        color: porColor && color ? color : undefined,
        precio: precioNumero,
        cantidad: modo === 'lote' ? cantidad : 1,
        descuentoTipo: descuentoVestido?.tipo,
        descuentoValor: descuentoVestido?.valor,
      });
      mostrar(
        modo === 'lote'
          ? `${cantidad} unidades dadas de alta · SKU ${creado.sku}`
          : `Pieza única dada de alta · SKU ${creado.sku}`,
      );
      limpiar();
    } catch (err) {
      mostrar(err instanceof ApiError ? err.message : 'No se pudo guardar el producto');
    } finally {
      setEnviando(false);
    }
  }

  const skuPreview = `${prefijoSku(marca, 3)}-${prefijoSku(categoria?.nombre ?? '', 2)}-•••••`;

  function abrirModalTallas() {
    if (!nombre.trim()) return mostrar('Captura el nombre del producto');
    const precioNumero = Number(precio);
    if (!precio || !Number.isFinite(precioNumero) || precioNumero <= 0) {
      return mostrar('Captura un precio válido');
    }
    if (!categoriaId) return mostrar('Selecciona una categoría');
    setModalTallasAbierto(true);
  }

  async function enviarLotePorTallas(
    distribucion: { cantidades: Record<string, number> } | { porColor: productosApi.FilaColor[] },
  ) {
    if (enviando || !categoriaId) return;
    const precioNumero = Number(precio);
    setEnviando(true);
    try {
      const creados = await productosApi.crearLotePorTallas({
        nombre: nombre.trim(),
        marca: marca.trim(),
        categoriaId,
        precio: precioNumero,
        ...distribucion,
        descuentoTipo: descuentoVestido?.tipo,
        descuentoValor: descuentoVestido?.valor,
      });
      const totalPiezas = creados.reduce((acc, p) => acc + p.stock, 0);
      mostrar(
        'porColor' in distribucion
          ? `${totalPiezas} piezas dadas de alta en ${creados.length} combinaciones de color y talla`
          : `${totalPiezas} piezas dadas de alta en ${creados.length} tallas`,
      );
      setModalTallasAbierto(false);
      limpiar();
    } catch (err) {
      mostrar(err instanceof ApiError ? err.message : 'No se pudo guardar el lote por tallas');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className={styles.contenedor}>
      <div className={styles.form}>
        {editando ? (
          <div className={styles.aviso}>
            Editando <strong>{productoEnEdicion?.sku}</strong> · la categoría solo se puede mover a otra
            con el mismo tipo de talla.
          </div>
        ) : (
          <div className={styles.segmented}>
            <button
              type="button"
              className={modo === 'unica' ? styles.segmentedBtnActivo : styles.segmentedBtn}
              onClick={() => setModo('unica')}
            >
              Pieza única
            </button>
            <button
              type="button"
              className={modo === 'lote' ? styles.segmentedBtnActivo : styles.segmentedBtn}
              onClick={() => setModo('lote')}
            >
              Por lote
            </button>
          </div>
        )}

        <div className={styles.campo}>
          <label className={styles.label}>Nombre del producto</label>
          <input
            className={styles.input}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Jean recto tiro alto"
          />
        </div>

        <div className={styles.fila}>
          <div className={styles.campo} style={{ flex: 1 }}>
            <label className={styles.label}>Marca</label>
            <input
              className={styles.inputSecundario}
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              placeholder="Marca"
            />
          </div>
          <div className={styles.campo}>
            <label className={styles.label}>Precio</label>
            <input
              className={styles.inputPrecio}
              value={precio}
              onChange={(e) => setPrecio(e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              placeholder="$0.00"
            />
          </div>
          {editando && (
            <div className={styles.campo}>
              <label className={styles.label}>Cantidad en inventario</label>
              <input
                aria-label="Cantidad en inventario"
                className={styles.inputPrecio}
                value={stockEditado}
                onChange={(e) => setStockEditado(e.target.value.replace(/[^0-9]/g, ''))}
                inputMode="numeric"
                placeholder="0"
              />
            </div>
          )}
        </div>

        <div className={styles.campo}>
          <label className={styles.label}>Categoría</label>
          <div className={styles.chips}>
            {categoriasElegibles.map((c) => (
              <button
                key={c.id}
                type="button"
                className={c.id === categoriaId ? styles.chipCategoriaActiva : styles.chipCategoria}
                onClick={() => elegirCategoria(c)}
              >
                {c.nombre}
              </button>
            ))}
          </div>
        </div>

        {usuario?.rol === 'admin' && !editando && (
          <GestionCategorias categorias={categorias} onCambio={() => cargarCategorias(true)} />
        )}

        <div className={styles.campo}>
          <label className={styles.label}>Talla</label>
          {esVestido ? (
            <div className={styles.aviso}>
              Los vestidos no manejan tallas: cada pieza es única.
            </div>
          ) : (
            <div className={styles.chips}>
              {opcionesTalla?.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={t === talla ? styles.chipTallaActiva : styles.chipTalla}
                  onClick={() => setTalla(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        {porColor && (
          <div className={styles.campo}>
            <label className={styles.label}>Color{color ? `: ${color}` : ''}</label>
            <SelectorColor seleccionado={color} textoBoton="Usar" onElegir={setColor} />
          </div>
        )}

        {/* Pieza única = 1 pieza, 1 talla: el alta por tallas solo tiene sentido en "Por lote". */}
        {!editando && !esVestido && modo === 'lote' && (
          <button type="button" className={styles.btnLotePorTallas} onClick={abrirModalTallas}>
            {porColor
              ? 'Alta por color y talla (varias cantidades a la vez)'
              : 'Alta por tallas (varias cantidades a la vez)'}
          </button>
        )}

        {esVestido && (
          <div className={styles.campo}>
            <label className={styles.label}>Descuento del vestido (opcional)</label>
            <div className={styles.chips}>
              <button
                type="button"
                className={!descuentoVestido ? styles.chipCategoriaActiva : styles.chipCategoria}
                onClick={() => setDescuentoVestido(null)}
              >
                Sin descuento
              </button>
              {DESCUENTOS_VESTIDO.map((d) => (
                <button
                  key={`${d.tipo}-${d.valor}`}
                  type="button"
                  className={
                    descuentoVestido?.tipo === d.tipo && descuentoVestido?.valor === d.valor
                      ? styles.chipCategoriaActiva
                      : styles.chipCategoria
                  }
                  onClick={() => setDescuentoVestido(d)}
                >
                  {d.tipo === 'pct' ? `${d.valor}%` : `$${d.valor}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {!editando &&
          (modo === 'lote' ? (
            <div className={styles.cajaLote}>
              <div className={styles.stepperFila}>
                <button
                  type="button"
                  className={styles.stepperBtn}
                  onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                >
                  −
                </button>
                <div className={styles.stepperValor}>{cantidad}</div>
                <button type="button" className={styles.stepperBtn} onClick={() => setCantidad((c) => c + 1)}>
                  +
                </button>
              </div>
              <div className={styles.presets}>
                {PRESETS_LOTE.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={styles.presetBtn}
                    onClick={() => setCantidad((c) => c + n)}
                  >
                    +{n}
                  </button>
                ))}
              </div>
              <div className={styles.notaLote}>
                {porColor
                  ? `Las ${cantidad} unidades comparten un solo SKU (mismo color y talla). Para varios colores usa "Alta por color y talla".`
                  : `Las variantes de color no se registran: las ${cantidad} unidades comparten un solo SKU.`}
              </div>
            </div>
          ) : (
            <div className={styles.cajaSku}>
              SKU de vista previa: <span className={styles.skuValor}>{skuPreview}</span>
            </div>
          ))}

        <button type="button" className={styles.btnSubmit} disabled={enviando} onClick={enviar}>
          {editando ? 'Guardar cambios' : modo === 'lote' ? `Dar de alta ${cantidad} unidades` : 'Dar de alta 1 pieza'}
        </button>
        <button
          type="button"
          className={styles.btnLimpiar}
          onClick={editando ? onTerminarEdicion : limpiar}
        >
          {editando ? 'Cancelar edición' : 'Limpiar formulario'}
        </button>
      </div>

      {modalTallasAbierto && opcionesTalla && (
        <ModalLotePorTallas
          tallas={opcionesTalla}
          porColor={porColor}
          enviando={enviando}
          onCerrar={() => setModalTallasAbierto(false)}
          onConfirmar={(cantidades) => enviarLotePorTallas({ cantidades })}
          onConfirmarPorColor={(filas) => enviarLotePorTallas({ porColor: filas })}
        />
      )}
    </div>
  );
}
