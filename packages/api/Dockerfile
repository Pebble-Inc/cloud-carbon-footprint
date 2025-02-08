FROM node:18-alpine

# Set working directory
WORKDIR /usr/src/app

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

# Verify build args are passed (will fail build if not set)
RUN test -n "$TENANT_DB" || (echo "TENANT_DB build arg not set" && false)

# Export them as environment variables at runtime
ENV DOCUMENTDB_URI=$DOCUMENTDB_URI
ENV DOCUMENTDB_USERNAME=$DOCUMENTDB_USERNAME
ENV DOCUMENTDB_PASSWORD=$DOCUMENTDB_PASSWORD
ENV DOCUMENTDB_SSL_CA_FILE=/usr/src/app/certs/global-bundle.pem
ENV CACHE_MODE=$CACHE_MODE
ENV TENANT_DB=$TENANT_DB
ENV AWS_AUTH_MODE=$AWS_AUTH_MODE
ENV AWS_TARGET_ACCOUNT_ROLE_NAME=$AWS_TARGET_ACCOUNT_ROLE_NAME

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
