# Evalboard

A small, responsive AI evaluation directory built with Next.js, TypeScript, and MongoDB. Browse, search, and filter evaluation cards; open a card for its report context; submit a result to MongoDB; or describe a workflow to get a model recommendation.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set `MONGODB_URI` to your MongoDB connection string. For local MongoDB, the example URI is ready to use.
3. Start the development server with `npm run dev` and open [http://localhost:3000](http://localhost:3000).

The app reports an actionable connection message when MongoDB is unavailable. Evaluation documents are stored in the `evaluations` collection in the database named in your URI.

## Model finder

Use **Find my model** to describe a task in plain language. Add `GEMINI_API_KEY` to `.env.local` to enable Gemini recommendations through Google's `generateContent` API. The user's description is sent to Gemini only when this key is configured. Without a key, the finder matches task keywords against the available evaluation categories and ranks models from their stored scores. Demo records are identified as such in the results; replace them with verified evaluation data before relying on recommendations.

The default Gemini model is `gemini-3.6-flash`; override it with `GEMINI_MODEL` if needed. Restart the development server after changing `.env.local`.
