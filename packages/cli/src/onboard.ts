/**
 * Onboarding 向导 — 占位文件
 * 完整实现将在 Wave 6 (Task 21) 中从V1移植
 */

export interface OnboardOptions {
  defaults?: boolean;
  installDaemon?: boolean;
  conshellDir?: string;
}

export async function runOnboard(_options: OnboardOptions = {}): Promise<void> {
  console.log('🐢 Onboarding wizard — 实现中 (Wave 6)');
}
