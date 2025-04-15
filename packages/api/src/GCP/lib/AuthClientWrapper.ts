import { GoogleAuthClient } from '@cloud-carbon-footprint/common'
import { JWT } from 'google-auth-library'
import http from 'http'

interface GetAccessTokenResponse {
  token: string
  res: any
}

export class AuthClientWrapper extends JWT {
  private awsRegion: string | null = null
  private awsRoleName: string | null = null
  private awsCredentials: any = null
  private imdsv2Token: string | null = null

  constructor(private authClient: GoogleAuthClient) {
    super()
  }

  private async getIMDSv2Token(): Promise<string> {
    if (this.imdsv2Token) {
      return this.imdsv2Token
    }

    return new Promise((resolve, reject) => {
      const options = {
        hostname: '169.254.169.254',
        port: 80,
        path: '/latest/api/token',
        method: 'PUT',
        headers: {
          'X-aws-ec2-metadata-token-ttl-seconds': '21600',
        },
        timeout: 5000,
      }

      const req = http.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          this.imdsv2Token = data
          resolve(data)
        })
      })

      req.on('error', (error) => {
        reject(error)
      })

      req.on('timeout', () => {
        req.destroy()
        reject(new Error('IMDSv2 token request timed out'))
      })

      req.end()
    })
  }

  private async httpGet(path: string): Promise<string> {
    const token = await this.getIMDSv2Token()

    return new Promise((resolve, reject) => {
      const options = {
        hostname: '169.254.169.254',
        port: 80,
        path: path,
        method: 'GET',
        headers: {
          'X-aws-ec2-metadata-token': token,
        },
        timeout: 5000,
      }

      const req = http.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          resolve(data)
        })
      })

      req.on('error', (error) => {
        reject(error)
      })

      req.on('timeout', () => {
        req.destroy()
        reject(new Error(`Request to ${path} timed out`))
      })

      req.end()
    })
  }

  async getAwsRegion(): Promise<string> {
    if (this.awsRegion) {
      return this.awsRegion
    }

    try {
      this.awsRegion = await this.httpGet('/latest/meta-data/placement/region')
      return this.awsRegion
    } catch (error) {
      throw new Error(`Failed to get AWS region: ${error.message}`)
    }
  }

  async getAwsRoleName(): Promise<string> {
    if (this.awsRoleName) {
      return this.awsRoleName
    }

    try {
      this.awsRoleName = await this.httpGet(
        '/latest/meta-data/iam/security-credentials/',
      )
      return this.awsRoleName
    } catch (error) {
      throw new Error(`Failed to get AWS role name: ${error.message}`)
    }
  }

  async getAwsCredentials(): Promise<any> {
    if (this.awsCredentials) {
      return this.awsCredentials
    }

    try {
      const roleName = await this.getAwsRoleName()
      const credentials = await this.httpGet(
        `/latest/meta-data/iam/security-credentials/${roleName}`,
      )
      this.awsCredentials = JSON.parse(credentials)
      return this.awsCredentials
    } catch (error) {
      throw new Error(`Failed to get AWS credentials: ${error.message}`)
    }
  }

  async getRequestHeaders(): Promise<Record<string, string>> {
    const awsCredentials = await this.getAwsCredentials()
    const gcpHeaders = await this.authClient.getRequestHeaders()

    return {
      ...gcpHeaders,
      'x-goog-cloud-target-resource': awsCredentials.AccessKeyId,
      'x-goog-cloud-target-resource-type': 'aws',
    }
  }

  async getAccessToken(): Promise<GetAccessTokenResponse> {
    const headers = await this.getRequestHeaders()
    const token = headers.Authorization?.replace('Bearer ', '') || ''
    return {
      token,
      res: null,
    }
  }

  async getRequestMetadata(url?: string): Promise<Record<string, string>> {
    return this.getRequestHeaders()
  }
}
