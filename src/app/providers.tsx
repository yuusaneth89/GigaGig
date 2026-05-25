'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
} from '@rainbow-me/rainbowkit';
import { arcTestnet } from 'viem/chains';

import '@rainbow-me/rainbowkit/styles.css';

const config = getDefaultConfig({
  appName: 'GigaGig Platform',
  projectId: '8dbb69bbbf4947cb9311a5133e69f584', // Valid 32-character hex ID
  chains: [arcTestnet],
  transports: {
    [arcTestnet.id]: http('https://rpc.testnet.arc.network'),
  },
  ssr: false,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({
          accentColor: '#10B981', // Emerald green theme for GigaGig (USDC)
          accentColorForeground: 'black',
          borderRadius: 'medium',
          overlayBlur: 'small',
        })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
