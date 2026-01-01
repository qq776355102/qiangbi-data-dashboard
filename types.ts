
export interface AddressEntry {
  aAddress: string;
  derivedAddress: string;
  remark: string;
  log: string;
  split?: string;
}

export interface StakingData {
  totalStaking: string;
  mintStaking: string;
  bondStaking: string;
  spiderWebReward: string;
  turbineBalance: string;
  derivedLgns: string;
  derivedSlgns: string;
  lastUpdated?: number;
}

export type AddressData = AddressEntry & StakingData;

export interface TokenConfig {
  address: string;
  symbol: string;
  decimals: number;
}
