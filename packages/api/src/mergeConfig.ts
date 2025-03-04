import { CCFConfig, configLoader } from '@cloud-carbon-footprint/common'

export const mergeConfig = (ccfConfig: Partial<CCFConfig>) => {
  let _config = configLoader()
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
      USE_BILLING_DATA: true,
    },
    ALI: {
      ..._config.ALI,
      ...ccfConfig.ALI,
    },
  }
  return _config
}
