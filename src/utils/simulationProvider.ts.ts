import { providers, utils, BigNumber } from 'ethers';

type StateOverride = {
  storage?: Record<string, string>;
  balance?: string;
};

type StateDiff = {
  [address: string]: {
    storage?: Record<string, string>;
    balance?: string;
  };
};

export class SimulationProvider extends providers.JsonRpcProvider {
  private stateOverrides: Record<string, StateOverride> = {};
  private bypassPermissions: boolean = false;

  constructor(url: string, network?: providers.Networkish) {
    super(url, network);
  }

  async send(method: string, params: Array<any>): Promise<any> {
    if (this.bypassPermissions && method === "eth_call") {
      const [callObject, blockTag] = params;
      if (callObject.data.startsWith("0x09e69ede")) { // Function selector for 'execute'
        return this.simulateExecuteWithoutCheck(callObject, blockTag);
      }
    }
    return super.send(method, params);
  }

  private async simulateExecuteWithoutCheck(callObject: any, blockTag: string): Promise<string> {
    console.log("Simulating execute function without permission check");
    const result = await this.simulateTransaction(callObject, blockTag);
    // Process the result as needed
    return result;
  }

  setBypassPermissions(bypass: boolean): void {
    this.bypassPermissions = bypass;
  }

  async simulateTransaction(
    tx: providers.TransactionRequest, 
    blockTag: string = 'latest',
    saveState: boolean = true
  ): Promise<any> {
    const result = await this.send("tenderly_simulateTransaction", [tx, blockTag, { state_objects: this.stateOverrides }]);
    
    if (saveState && result.stateDiff) {
      this.updateStateOverrides(result.stateDiff);
    }

    return result;
  }

  async simulateBundle(
    txs: providers.TransactionRequest[], 
    blockTag: string = 'latest',
    saveState: boolean = true
  ): Promise<any> {
    const result = await this.send("tenderly_simulateBundle", [txs, blockTag, { state_objects: this.stateOverrides }]);
    
    if (saveState && result.stateDiff) {
      this.updateStateOverrides(result.stateDiff);
    }

    return result;
  }

  private updateStateOverrides(stateDiff: StateDiff) {
    for (const [address, diff] of Object.entries(stateDiff)) {
      if (!this.stateOverrides[address]) {
        this.stateOverrides[address] = {};
      }
      if (diff.storage) {
        this.stateOverrides[address].storage = {
          ...this.stateOverrides[address].storage,
          ...diff.storage
        };
      }
      if (diff.balance) {
        this.stateOverrides[address].balance = diff.balance;
      }
    }
  }

  setStateOverrides(overrides: Record<string, StateOverride>) {
    this.stateOverrides = overrides;
  }

  getStateOverrides(): Record<string, StateOverride> {
    return this.stateOverrides;
  }

  clearStateOverrides() {
    this.stateOverrides = {};
  }

  static calculateStorageSlot(address: string, slot: number): string {
    return utils.keccak256(
      utils.defaultAbiCoder.encode(
        ['address', 'uint256'],
        [address, slot]
      )
    );
  }

  static calculateMappingSlot(mappingSlot: string, key: string): string {
    return utils.keccak256(
      utils.defaultAbiCoder.encode(
        ['bytes32', 'uint256'],
        [key, mappingSlot]
      )
    );
  }
}

export const vPolygon = {
  id: 137,
  name: "Virtual Polygon",
  nativeCurrency: { name: "VMATIC", symbol: "vMATIC", decimals: 18 },
  rpcUrls: {
    default: { http: ['https://virtual.polygon.rpc.tenderly.co/16aa99a8-f1fb-4c7c-878a-ff59903070a2'] },
  },
  blockExplorers: {
    default: {
      name: "Tenderly Explorer",
      url: `https://dashboard.tenderly.co/16aa99a8-f1fb-4c7c-878a-ff59903070a2/project/fork/polygon`,
    },
  },
};

export const simulationProvider = new SimulationProvider(vPolygon.rpcUrls.default.http[0]);