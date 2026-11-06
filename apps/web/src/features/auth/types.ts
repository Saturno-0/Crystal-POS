import type { Rol } from '@crystal/shared';

export interface UsuarioSesion {
  id: number;
  nombre: string;
  usuario: string;
  ini: string;
  rol: Rol;
  tasaComision: number;
  activo: boolean;
  preguntaSeguridad: string | null;
}
