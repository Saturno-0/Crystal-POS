import type { Producto } from '@crystal/shared';
import { useMemo, useState } from 'react';
import { AppShell, type NavItem } from './components/layout/AppShell';
import { useAuth } from './features/auth/AuthContext';
import { Alta } from './pages/Alta';
import { Apartados } from './pages/Apartados';
import { CambioUsuario } from './pages/CambioUsuario';
import { Cambios } from './pages/Cambios';
import { Login } from './pages/Login';
import { Personal } from './pages/Personal';
import { Reportes, type PosicionInventario } from './pages/Reportes';
import { Venta } from './pages/Venta';

type Vista = 'pos' | 'inv' | 'apa' | 'cmb' | 'ana' | 'per' | 'cambio';

const VISTAS_SOLO_ADMIN: Vista[] = ['ana', 'per'];

function navPorRol(esAdmin: boolean): NavItem[] {
  const base: NavItem[] = [
    { key: 'pos', label: 'Venta' },
    { key: 'inv', label: 'Alta' },
    { key: 'apa', label: 'Apartados' },
    { key: 'cmb', label: 'Cambios' },
  ];
  return base.concat(
    esAdmin
      ? [
          { key: 'ana', label: 'Reportes' },
          { key: 'per', label: 'Personal' },
        ]
      : [{ key: 'cambio', label: 'Usuario' }],
  );
}

export function App() {
  const { usuario } = useAuth();
  const [vista, setVista] = useState<Vista>('pos');
  const [productoEditando, setProductoEditando] = useState<Producto | null>(null);
  const [posicionInventario, setPosicionInventario] = useState<PosicionInventario | null>(null);
  const [productoParaVender, setProductoParaVender] = useState<Producto | null>(null);

  const esAdmin = usuario?.rol === 'admin';
  const navItems = useMemo(() => navPorRol(esAdmin), [esAdmin]);

  if (!usuario) {
    return <Login />;
  }

  // HU-1.6: un vendedor no puede llegar a Reportes/Personal aunque el
  // estado quedara apuntando ahí de una sesión anterior con otro rol.
  const vistaSegura = !esAdmin && VISTAS_SOLO_ADMIN.includes(vista) ? 'pos' : vista;

  function irAEditarProducto(producto: Producto, posicion: PosicionInventario) {
    setProductoEditando(producto);
    setPosicionInventario(posicion);
    setVista('inv');
  }

  function terminarEdicion() {
    setProductoEditando(null);
    setVista('ana');
  }

  function venderAhora(producto: Producto) {
    setProductoParaVender(producto);
    setVista('pos');
  }

  function navegar(key: string) {
    // Volver a Reportes a media edición regresa a la misma altura del
    // inventario; ir a cualquier otra sección la olvida.
    if (!(key === 'ana' && productoEditando)) setPosicionInventario(null);
    if (key !== 'inv') setProductoEditando(null);
    setVista(key as Vista);
  }

  return (
    <AppShell
      navItems={navItems}
      activeKey={vistaSegura}
      onNavigate={navegar}
      userInitials={usuario.ini}
      onAvatarClick={() => setVista('cambio')}
    >
      {vistaSegura === 'pos' && (
        <Venta
          productoParaVender={productoParaVender}
          onProductoAgregado={() => setProductoParaVender(null)}
          onCambiarUsuario={() => setVista('cambio')}
        />
      )}
      {vistaSegura === 'inv' && (
        <Alta
          productoEnEdicion={productoEditando}
          onTerminarEdicion={terminarEdicion}
          onVenderAhora={venderAhora}
        />
      )}
      {vistaSegura === 'apa' && <Apartados />}
      {vistaSegura === 'cmb' && <Cambios />}
      {vistaSegura === 'ana' && (
        <Reportes posicionInicial={posicionInventario} onEditarProducto={irAEditarProducto} />
      )}
      {vistaSegura === 'per' && <Personal />}
      {vistaSegura === 'cambio' && <CambioUsuario />}
    </AppShell>
  );
}
