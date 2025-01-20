/*
 * © 2021 Thoughtworks, Inc.
 */

import getConfig, { CCFConfig } from './Config'

let _config: CCFConfig = getConfig()

export const setConfig = (ccfConfig: CCFConfig = getConfig()) => {
  return (_config = ccfConfig)
}

export const mergeConfig = (ccfConfig: Partial<CCFConfig>) => {
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
    ON_PREMISE: {
      ..._config.ON_PREMISE,
      ...ccfConfig.ON_PREMISE,
    },
  }
  return _config
}

export default function config(): CCFConfig {
  return _config
}
