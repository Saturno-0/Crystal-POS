import type Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearDbDePrueba } from '../test/testDb.js';
import * as usuarios from './usuarios.service.js';

let db: Database.Database;

beforeEach(() => {
  db = crearDbDePrueba();
});

function crearAdmin(nombre = 'Daniela Ochoa') {
  return usuarios.crear(db, { nombre, nip: '1234', rol: 'admin' });
}

function crearVendedor(nombre = 'Marisol Rivas', tasaComision = 6) {
  return usuarios.crear(db, { nombre, nip: '1234', rol: 'vendedor', tasaComision });
}

describe('crear (HU-1.4)', () => {
  it('autogenera el usuario como nombre.inicial cuando se deja vacío', () => {
    const u = crearAdmin();
    expect(u.usuario).toBe('daniela.o');
  });

  it('rechaza NIP que no tenga exactamente 4 dígitos', () => {
    expect(() => usuarios.crear(db, { nombre: 'X', nip: '123', rol: 'vendedor' })).toThrow(
      'El NIP debe tener 4 dígitos',
    );
    expect(() => usuarios.crear(db, { nombre: 'X', nip: 'abcd', rol: 'vendedor' })).toThrow(
      'El NIP debe tener 4 dígitos',
    );
  });

  it('rechaza nombre vacío', () => {
    expect(() => usuarios.crear(db, { nombre: '   ', nip: '1234', rol: 'vendedor' })).toThrow(
      'El nombre es obligatorio',
    );
  });

  it('no permite usuarios de acceso duplicados', () => {
    crearVendedor('Marisol Rivas');
    expect(() =>
      usuarios.crear(db, { nombre: 'Otra Persona', usuario: 'marisol.r', nip: '1234', rol: 'vendedor' }),
    ).toThrow('Ese usuario ya existe');
  });

  it('desambigua el usuario autogenerado si ya existe', () => {
    crearVendedor('Marisol Rivas');
    const segunda = usuarios.crear(db, { nombre: 'Marisol Rivas', nip: '1234', rol: 'vendedor' });
    expect(segunda.usuario).toBe('marisol.r2');
  });

  it('nunca guarda el NIP en texto plano', () => {
    crearAdmin();
    const row = db.prepare('SELECT nip_hash FROM usuarios').get() as { nip_hash: string };
    expect(row.nip_hash).not.toBe('1234');
    expect(row.nip_hash.length).toBeGreaterThan(20);
  });
});

describe('login (HU-1.1)', () => {
  it('inicia sesión con NIP correcto', () => {
    const creado = crearAdmin();
    const sesion = usuarios.login(db, creado.id, '1234');
    expect(sesion.id).toBe(creado.id);
  });

  it('rechaza NIP incorrecto con el mensaje literal esperado', () => {
    const creado = crearAdmin();
    expect(() => usuarios.login(db, creado.id, '9999')).toThrow('NIP incorrecto para Daniela Ochoa');
  });

  it('no permite login de un usuario dado de baja', () => {
    const admin = crearAdmin();
    const vendedor = crearVendedor();
    usuarios.darDeBaja(db, vendedor.id, admin.id);
    expect(() => usuarios.login(db, vendedor.id, '1234')).toThrow('Usuario no encontrado');
  });
});

describe('actualizarPerfil (editar nombre/usuario en Personal)', () => {
  it('actualiza el nombre', () => {
    const admin = crearAdmin();
    const vendedor = crearVendedor();
    const actualizado = usuarios.actualizarPerfil(db, vendedor.id, { nombre: 'Marisol R. Ibáñez' }, admin.id);
    expect(actualizado.nombre).toBe('Marisol R. Ibáñez');
  });

  it('actualiza el usuario de acceso si sigue siendo único', () => {
    const admin = crearAdmin();
    const vendedor = crearVendedor();
    const actualizado = usuarios.actualizarPerfil(db, vendedor.id, { usuario: 'marisol.rivas' }, admin.id);
    expect(actualizado.usuario).toBe('marisol.rivas');
  });

  it('rechaza un usuario de acceso ya tomado por otra persona', () => {
    const admin = crearAdmin();
    const vendedor = crearVendedor();
    expect(() =>
      usuarios.actualizarPerfil(db, vendedor.id, { usuario: admin.usuario }, admin.id),
    ).toThrow('Ese usuario ya existe');
  });

  it('rechaza nombre vacío', () => {
    const admin = crearAdmin();
    const vendedor = crearVendedor();
    expect(() => usuarios.actualizarPerfil(db, vendedor.id, { nombre: '   ' }, admin.id)).toThrow(
      'El nombre es obligatorio',
    );
  });
});

describe('cambiarRol y darDeBaja (HU-1.5)', () => {
  it('no permite eliminar la sesión activa', () => {
    const admin = crearAdmin();
    expect(() => usuarios.darDeBaja(db, admin.id, admin.id)).toThrow(
      'No puedes eliminar la sesión activa',
    );
  });

  it('impide quedarse sin ningún Admin activo al degradar el último admin', () => {
    const admin = crearAdmin();
    const vendedor = crearVendedor();
    expect(() => usuarios.cambiarRol(db, admin.id, 'vendedor', vendedor.id)).toThrow(
      'Debe existir al menos un Admin activo',
    );
  });

  it('impide dar de baja al último admin activo', () => {
    const admin = crearAdmin();
    const vendedor = crearVendedor();
    expect(() => usuarios.darDeBaja(db, admin.id, vendedor.id)).toThrow(
      'Debe existir al menos un Admin activo',
    );
  });

  it('sí permite degradar a un admin si hay otro admin activo', () => {
    const admin1 = crearAdmin('Daniela Ochoa');
    const admin2 = crearAdmin('Renata Solís');
    const actualizado = usuarios.cambiarRol(db, admin1.id, 'vendedor', admin2.id);
    expect(actualizado.rol).toBe('vendedor');
  });
});

describe('prepararCambioSesion (HU-1.3 · cambio de usuario)', () => {
  it('permite cambiar a un vendedor sin pedir NIP', () => {
    const vendedor = crearVendedor();
    const usuario = usuarios.prepararCambioSesion(db, vendedor.id);
    expect(usuario.id).toBe(vendedor.id);
  });

  it('exige NIP para cambiar a una cuenta Admin', () => {
    const admin = crearAdmin();
    expect(() => usuarios.prepararCambioSesion(db, admin.id)).toThrow(
      `Ingresa el NIP de ${admin.nombre} para continuar`,
    );
  });

  it('rechaza el NIP incorrecto al cambiar a una cuenta Admin', () => {
    const admin = crearAdmin();
    expect(() => usuarios.prepararCambioSesion(db, admin.id, '0000')).toThrow(
      `NIP incorrecto para ${admin.nombre}`,
    );
  });

  it('permite cambiar a una cuenta Admin con el NIP correcto', () => {
    const admin = crearAdmin();
    const usuario = usuarios.prepararCambioSesion(db, admin.id, '1234');
    expect(usuario.id).toBe(admin.id);
  });
});

describe('resetNipConPregunta (recuperación de NIP)', () => {
  it('resetea el NIP cuando la respuesta de seguridad coincide', () => {
    const admin = usuarios.crear(db, {
      nombre: 'Daniela Ochoa',
      nip: '1234',
      rol: 'admin',
      preguntaSeguridad: '¿Nombre de tu primera mascota?',
      respuestaSeguridad: 'Firulais',
    });
    usuarios.resetNipConPregunta(db, admin.usuario, 'firulais', '5678');
    const sesion = usuarios.login(db, admin.id, '5678');
    expect(sesion.id).toBe(admin.id);
  });

  it('rechaza una respuesta de seguridad incorrecta', () => {
    const admin = usuarios.crear(db, {
      nombre: 'Daniela Ochoa',
      nip: '1234',
      rol: 'admin',
      preguntaSeguridad: '¿Nombre de tu primera mascota?',
      respuestaSeguridad: 'Firulais',
    });
    expect(() => usuarios.resetNipConPregunta(db, admin.usuario, 'otra-cosa', '5678')).toThrow(
      'Respuesta incorrecta',
    );
  });
});
