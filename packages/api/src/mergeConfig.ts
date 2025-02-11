import { CCFConfig, configLoader } from '@cloud-carbon-footprint/common'

export const mergeConfig = (ccfConfig: Partial<CCFConfig>) => {
  let _config = configLoader()
  _config = {
    ..._config,
    ...ccfConfig,
    AWS: {
      ..._config.AWS,
      ...ccfConfig.AWS,
    },
    GCP: {
      ..._config.GCP,
      ...ccfConfig.GCP,
    },
    AZURE: {
      ..._config.AZURE,
      ...ccfConfig.AZURE,
    },
    ALI: {
      ..._config.ALI,
      ...ccfConfig.ALI,
    },
  }
  return _config
}
