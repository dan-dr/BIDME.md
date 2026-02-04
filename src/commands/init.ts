export interface InitOptions {
  target: string;
  useDefaults: boolean;
}

export async function runInit(options: InitOptions): Promise<void> {
  console.log(`Initializing BidMe in ${options.target}...`);
  console.log("Init command implementation coming in next phase.");
}
