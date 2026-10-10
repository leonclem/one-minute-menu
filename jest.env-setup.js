// Studio image calls read these URLs from the environment. Unit tests use fixed
// stand-ins so a developer's .env.local cannot change request assertions.
process.env.STUDIO_STD_MODEL_URL = 'https://models.test/v1beta/models/gemini-3.1-flash-image:generateContent'
process.env.STUDIO_PRO_MODEL_URL = 'https://models.test/v1beta/models/gemini-3-pro-image:generateContent'
