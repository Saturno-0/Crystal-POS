import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface ToastContextValue {
  mostrar: (mensaje: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTOCIERRE_MS = 2800;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const mostrar = useCallback((texto: string) => {
    clearTimeout(timeoutRef.current);
    setMensaje(texto);
    timeoutRef.current = setTimeout(() => setMensaje(null), AUTOCIERRE_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ mostrar }}>
      {children}
      {mensaje && (
        <div
          role="status"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 24,
            transform: 'translateX(-50%)',
            background: 'var(--text)',
            color: 'var(--surface)',
            borderRadius: 10,
            padding: '10px 16px',
            font: "500 13px/1.3 var(--font-ui)",
            boxShadow: 'var(--shadow)',
            zIndex: 1000,
            maxWidth: 'min(90vw, 420px)',
            textAlign: 'center',
          }}
        >
          {mensaje}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}
