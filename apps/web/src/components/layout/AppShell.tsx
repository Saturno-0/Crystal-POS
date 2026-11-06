import type { ReactNode } from 'react';
import styles from './AppShell.module.css';

export interface NavItem {
  key: string;
  label: string;
}

export interface AppShellProps {
  navItems: NavItem[];
  activeKey: string;
  onNavigate: (key: string) => void;
  userInitials: string;
  onAvatarClick?: () => void;
  children: ReactNode;
}

/**
 * Cascarón de la app autenticada: rail de navegación en escritorio,
 * barra inferior en móvil (breakpoint 768px). Ambas listas de navegación
 * se generan a partir del mismo `navItems`, que el llamador arma según
 * el rol de la sesión activa (aún no implementado — épica de auth).
 */
export function AppShell({
  navItems,
  activeKey,
  onNavigate,
  userInitials,
  onAvatarClick,
  children,
}: AppShellProps) {
  return (
    <div className={styles.shell}>
      <nav className={styles.rail} aria-label="Navegación principal">
        <div className={styles.brand}>C</div>
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`${styles.navBtn} ${item.key === activeKey ? styles.active : ''}`}
            aria-current={item.key === activeKey}
            onClick={() => onNavigate(item.key)}
          >
            {item.label}
          </button>
        ))}
        <div className={styles.spacer} />
        <button
          type="button"
          className={styles.avatar}
          onClick={onAvatarClick}
          aria-label="Cambiar de usuario"
        >
          {userInitials}
        </button>
      </nav>

      <div className={styles.main}>
        <div className={styles.content}>{children}</div>

        <nav className={styles.bottomBar} aria-label="Navegación principal">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`${styles.bottomNavBtn} ${item.key === activeKey ? styles.active : ''}`}
              aria-current={item.key === activeKey}
              onClick={() => onNavigate(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
