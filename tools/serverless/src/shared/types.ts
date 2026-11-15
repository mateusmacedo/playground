export type Stack = 'typescript' | 'go' | 'java';

export type ServiceType = 'http' | 'sqs' | 'scheduled';

export type QueueOwnership = 'external' | 'owned';

export type GoArch = 'arm64' | 'amd64';

export type AwsArch = 'arm64' | 'x86_64';

export type ServerlessStage = 'local' | 'dev' | 'homolog' | 'prod';

export type StageConfigurationName = 'floci' | 'dev' | 'homolog' | 'prod';

export type ServerlessOperation =
  | 'deploy'
  | 'package'
  | 'remove'
  | 'invoke-local';

export type ExecutorResult = { success: boolean };
