require('dotenv').config();
if (process.env.OPENAI_API_KEY) {
  console.log("OPENAI_API_KEY is present");
} else {
  console.log("OPENAI_API_KEY is missing");
}

