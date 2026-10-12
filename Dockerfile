FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8766
COPY --chown=node:node server.mjs index.html styles.css script.js night.js voice-session.js voice.js music.js nature-sound.js ./
COPY --chown=node:node assets/ ./assets/
USER node
EXPOSE 8766
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:8766/api/config').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.mjs"]
