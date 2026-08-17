import bcrypt from 'bcryptjs';

// 口令哈希与校验（bcryptjs 为纯 JS，Worker 与 Node 均可运行，无需 native 依赖）。
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
