import type {
  AwsArch,
  GoArch,
  QueueOwnership,
  ServerlessStage,
  ServiceType,
  StageConfigurationName,
} from './types.js';

export const PLUGIN_PACKAGE_NAME = '@org/nx-serverless';

export const SERVICE_TYPES: readonly ServiceType[] = [
  'http',
  'sqs',
  'scheduled',
];

export const QUEUE_OWNERSHIPS: readonly QueueOwnership[] = [
  'external',
  'owned',
];

export const ALLOWED_STAGES: readonly ServerlessStage[] = [
  'local',
  'dev',
  'homolog',
  'prod',
];

export const PROTECTED_STAGE: ServerlessStage = 'prod';

export const STAGE_CONFIGURATION_NAMES: readonly StageConfigurationName[] = [
  'floci',
  'dev',
  'homolog',
  'prod',
];

export const GO_RUNTIME = 'provided.al2023';

export const NODE_RUNTIME_PREFIX = 'nodejs';

export const JAVA_RUNTIMES: readonly string[] = ['java21', 'provided.al2023'];

export const GRADLE_BUILD_FILES: readonly string[] = [
  'build.gradle.kts',
  'build.gradle',
];

export const QUARKUS_PLUGIN_ID = 'io.quarkus';

// WHY: no Gradle, o Quarkus 3.40 recusa gerar nativo e JAR juntos
// ("Outputting both native and JAR packages is not currently supported").
export const QUARKUS_NATIVE_FLAGS =
  '-Dquarkus.native.enabled=true -Dquarkus.native.container-build=true -Dquarkus.package.jar.enabled=false';

export const GO_ARCHITECTURES: readonly GoArch[] = ['arm64', 'amd64'];

export const GO_TO_AWS_ARCH: Readonly<Record<GoArch, AwsArch>> = {
  arm64: 'arm64',
  amd64: 'x86_64',
};

export const AWS_TO_GO_ARCH: Readonly<Record<AwsArch, GoArch>> = {
  arm64: 'arm64',
  x86_64: 'amd64',
};

export const LAMBDA_OUTPUT_DIR = '.bin';

export const LAMBDA_BINARY_NAME = 'bootstrap';

export const LAMBDA_ARTIFACT_PATH = `${LAMBDA_OUTPUT_DIR}/${LAMBDA_BINARY_NAME}.zip`;

export const SERVERLESS_VERSION = '4.46.0';

export const SERVERLESS_LOCALSTACK_VERSION = '1.4.0';

export const AWS_LAMBDA_TYPES_VERSION = '^8.10.164';

export const AWS_LAMBDA_GO_VERSION = 'v1.55.1';

export const AWS_LAMBDA_GO_API_PROXY_VERSION = 'v0.16.2';

export const DEFAULT_SERVICES_DIRECTORY = 'apps/services';

export const SSM_PREFIX = '/playground';
