import { CCFConfig, configLoader } from '@cloud-carbon-footprint/common'
import { Logger } from '@cloud-carbon-footprint/common'

const logger = new Logger('mergeConfig')

export const mergeConfig = (ccfConfig: Partial<CCFConfig>) => {
  let _config = configLoader()
  logger.info('Merging config with: ' + JSON.stringify(ccfConfig))
  logger.info('Current config: ' + JSON.stringify(_config))
  _config = {
    ..._config,
    ...ccfConfig,
    AWS: {
      ..._config.AWS,
      ...ccfConfig.AWS,
      authentication: {
        mode: 'AWS',
        options: {
          targetRoleName: 'ccf-app',
        },
      },
    },
    GCP: {
      ..._config.GCP,
      ...ccfConfig.GCP,
    },
    AZURE: {
      ..._config.AZURE,
      ...ccfConfig.AZURE,
      USE_BILLING_DATA: true
    },
    ALI: {
      ..._config.ALI,
      ...ccfConfig.ALI,
    },
  }
  return _config
}

