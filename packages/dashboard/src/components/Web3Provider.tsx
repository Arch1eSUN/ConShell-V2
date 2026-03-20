/**
 * Web3Provider — Lazy-loaded Web3 wrapper
 *
 * Round 19.7: This component is loaded only when the Wallet tab is active.
 * Keeps wagmi/RainbowKit/viem out of the critical path.
 */
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { wagmiConfig } from '../web3/config';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

function Web3ProviderWrapper({ children }: Props) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <RainbowKitProvider
        theme={lightTheme({
          accentColor: '#16A34A',
          accentColorForeground: '#FFFFFF',
          borderRadius: 'small',
        })}
      >
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}

export default Web3ProviderWrapper;
