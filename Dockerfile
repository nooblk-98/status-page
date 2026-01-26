# Simple static site container
FROM nginx:1.25-alpine

# Remove default content
RUN rm -rf /usr/share/nginx/html/*

# Copy site assets
COPY ./ /usr/share/nginx/html/

# Expose default http port
EXPOSE 80
