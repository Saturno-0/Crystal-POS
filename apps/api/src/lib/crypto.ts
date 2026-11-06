import bcrypt from 'bcryptjs';

const ROUNDS = 10;

export function hashSecreto(valor: string): string {
  return bcrypt.hashSync(valor, ROUNDS);
}

export function verificarSecreto(valor: string, hash: string): boolean {
  return bcrypt.compareSync(valor, hash);
}
