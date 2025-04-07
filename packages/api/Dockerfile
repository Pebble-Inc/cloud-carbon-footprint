FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

# Install dependencies and pip
RUN apk add --no-cache bash curl python3 py3-pip

# Install AWS CLI via pip
RUN pip install --no-cache-dir --break-system-packages awscli

# Verify AWS CLI installation
RUN aws --version

# Create directory for SSL certificate
RUN mkdir -p certs

# Accept environment variables as build arguments
ARG DOCUMENTDB_URI
ARG DOCUMENTDB_USERNAME
ARG DOCUMENTDB_PASSWORD
ARG DOCUMENTDB_SSL_CA_FILE
ARG CACHE_MODE
ARG TENANT_DB
ARG AWS_AUTH_MODE
ARG AWS_TARGET_ACCOUNT_ROLE_NAME
ARG ENV
ARG CCF_ROLE
ARG DB_HOST
ARG DB_PORT
ARG DB_USER
ARG DB_PASS
ARG DB_NAME


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
ENV TENANT_ROLE_NAME=$TENANT_ROLE_NAME
ENV ECS_ROLE_NAME=$ECS_ROLE_NAME
ENV AWS_REGION=$AWS_REGION
ENV AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
ENV AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
ENV ENV=$ENV
ENV CCF_ROLE=$CCF_ROLE
ENV DB_HOST=$DB_HOST
ENV DB_PORT=$DB_PORT
ENV DB_USER=$DB_USER
ENV DB_PASS=$DB_PASS
ENV DB_NAME=$DB_NAME
# Copy SSL certificate to certs directory
COPY global-bundle.pem ./certs/global-bundle.pem

# Copy built application
COPY ./dist ./dist

# Copy package files
COPY package.json ./

# Install production dependencies only
RUN yarn install --production --frozen-lockfile

# Start the application
CMD [ "yarn", "start:webprod" ]