/**
 * wagmi + RainbowKit 配置
 *
 * 支持链: Base + Ethereum
 * 支持钱包: MetaMask, Coinbase Wallet, Rainbow, WalletConnect
 */
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, mainnet } from 'viem/chains';

export const wagmiConfig = getDefaultConfig({
  appName: 'ConShell Agent',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'conshell-agent-v2',
  chains: [base, mainnet],
  ssr: false,
});
