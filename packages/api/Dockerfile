FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Install dependencies and pip
RUN apk add --no-cache bash curl python3 py3-pip

# Install AWS CLI via pip
RUN pip install --no-cache-dir --break-system-packages awscli

# Verify AWS CLI installation
RUN aws --version

# Create directory for SSL certificate and AWS credentials
RUN mkdir -p certs ~/.aws

# Accept environment variables as build arguments
ARG DOCUMENTDB_URI
ARG DOCUMENTDB_USERNAME
ARG DOCUMENTDB_PASSWORD
ARG DOCUMENTDB_SSL_CA_FILE
ARG CACHE_MODE
ARG TENANT_DB
ARG AWS_AUTH_MODE
ARG AWS_TARGET_ACCOUNT_ROLE_NAME
ARG AWS_ACCESS_KEY_ID
ARG AWS_SECRET_ACCESS_KEY
ARG AWS_DEFAULT_REGION

# Verify build args are passed (will fail build if not set)
RUN test -n "$TENANT_DB" || (echo "TENANT_DB build arg not set" && false)

# Export environment variables
ENV DOCUMENTDB_URI=$DOCUMENTDB_URI
ENV DOCUMENTDB_USERNAME=$DOCUMENTDB_USERNAME
ENV DOCUMENTDB_PASSWORD=$DOCUMENTDB_PASSWORD
ENV DOCUMENTDB_SSL_CA_FILE=$DOCUMENTDB_SSL_CA_FILE
ENV CACHE_MODE=$CACHE_MODE
ENV TENANT_DB=$TENANT_DB
ENV AWS_AUTH_MODE=$AWS_AUTH_MODE
ENV AWS_TARGET_ACCOUNT_ROLE_NAME=$AWS_TARGET_ACCOUNT_ROLE_NAME
ENV AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
ENV AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
ENV AWS_DEFAULT_REGION=$AWS_DEFAULT_REGION

# Configure AWS credentials and region
RUN echo "[default]" > ~/.aws/config && \
    echo "region = ${AWS_DEFAULT_REGION}" >> ~/.aws/config && \
    echo "[default]" > ~/.aws/credentials && \
    echo "aws_access_key_id = ${AWS_ACCESS_KEY_ID}" >> ~/.aws/credentials && \
    echo "aws_secret_access_key = ${AWS_SECRET_ACCESS_KEY}" >> ~/.aws/credentials && \
    chmod 600 ~/.aws/credentials ~/.aws/config

# Copy SSL certificate to certs directory
COPY global-bundle.pem ./certs/global-bundle.pem

# Copy built application
COPY ./dist ./dist

# Copy package files
COPY package.json ./

# Install production dependencies only
RUN yarn install --production --frozen-lockfile

# Validate AWS CLI installation and credentials
RUN aws --version && aws sts get-caller-identity || echo "AWS credentials not fully configured"

# Start the application
CMD [ "yarn", "start:webprod" ]