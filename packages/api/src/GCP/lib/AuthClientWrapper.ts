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

  constructor(private authClient: GoogleAuthClient) {
    super()
  }

  private async getIMDSv2Token(): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = http.request({
        hostname: '169.254.169.254',
        path: '/latest/api/token',
        method: 'PUT',
        timeout: 5000,
        headers: {
          'X-aws-ec2-metadata-token-ttl-seconds': '21600'
        }
      }, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Token request failed with status: ${response.statusCode}`))
          return
        }

        let data = ''
        response.on('data', (chunk) => data += chunk)
        response.on('end', () => resolve(data))
      })

      request.on('error', reject)
      request.on('timeout', () => {
        request.destroy()
        reject(new Error('Token request timed out'))
      })

      request.end()
    })
  }

  private async httpGet(path: string): Promise<string> {
    const token = await this.getIMDSv2Token()
    
    return new Promise((resolve, reject) => {
      const request = http.get({
        hostname: '169.254.169.254',
        path: path,
        timeout: 5000,
        headers: {
          'X-aws-ec2-metadata-token': token
        }
      }, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Request failed with status: ${response.statusCode}`))
          return
        }

        let data = ''
        response.on('data', (chunk) => data += chunk)
        response.on('end', () => resolve(data))
      })

      request.on('error', reject)
      request.on('timeout', () => {
        request.destroy()
        reject(new Error('Request timed out'))
      })
    })
  }

  async getAwsRegion(): Promise<string> {
    if (!this.awsRegion) {
      const availabilityZone = await this.httpGet('/latest/meta-data/placement/availability-zone')
      this.awsRegion = availabilityZone.slice(0, -1) // Remove the last character to get region
    }
    return this.awsRegion
  }

  async getAwsRoleName(): Promise<string> {
    if (!this.awsRoleName) {
      this.awsRoleName = await this.httpGet('/latest/meta-data/iam/security-credentials')
    }
    return this.awsRoleName
  }

  async getAwsCredentials(): Promise<any> {
    if (!this.awsCredentials) {
      const roleName = await this.getAwsRoleName()
      const credentialsStr = await this.httpGet(`/latest/meta-data/iam/security-credentials/${roleName}`)
      this.awsCredentials = JSON.parse(credentialsStr)
    }
    return this.awsCredentials
  }

  async getRequestHeaders(): Promise<Record<string, string>> {
    try {
      // First get AWS credentials
      const credentials = await this.getAwsCredentials()
      
      // Then get the GCP token from the wrapped client
      const gcpHeaders = await this.authClient.getRequestHeaders()
      
      // Combine the headers
      return {
        ...gcpHeaders,
        'x-goog-cloud-target-resource': `//iam.googleapis.com/projects/-/serviceAccounts/${credentials.AccessKeyId}@${await this.getAwsRegion()}.iam.gserviceaccount.com`,
        'x-goog-cloud-target-resource-type': 'iam.googleapis.com/ServiceAccount',
      }
    } catch (error) {
      console.error('Error getting request headers:', error)
      throw error
    }
  }

  async getAccessToken(): Promise<GetAccessTokenResponse> {
    const headers = await this.getRequestHeaders()
    const token = headers.Authorization.replace('Bearer ', '')
    return {
      token,
      res: null,
    }
  }

  async getRequestMetadata(url?: string): Promise<Record<string, string>> {
    return this.getRequestHeaders()
  }
} 