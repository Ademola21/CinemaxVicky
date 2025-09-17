import { Movie, SiteConfig } from "./types";
import { getAnalyticsSummary } from "./analyticsService";
import { getSession } from "./storageService";

const modelName = 'gemini-2.5-flash';

/**
 * A secure proxy function to communicate with our backend, which then calls the Gemini API.
 * This prevents the API key from ever being exposed on the frontend.
 * @param endpoint The specific Gemini model method to call (e.g., 'generateContent').
 * @param params The parameters for the Gemini API call.
 * @returns The JSON response from the Gemini API.
 */
async function callGeminiProxy(endpoint: string, params: any): Promise<any> {
  try {
    const session = getSession(); // Get the current user session for authentication

    const response = await fetch('/api/azure-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint, params, session }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'The AI service is currently unavailable.' }));
      const errorMessage = response.status === 429 
        ? `You're sending requests too quickly. Please wait a moment.`
        : errorData.error || `HTTP error! status: ${response.status}`;
      throw new Error(errorMessage);
    }
    return response.json();
  } catch (error) {
    console.error(`[AI Proxy Error]`, error);
    // Re-throw a user-friendly error message
    throw new Error((error as Error).message || "I'm having a bit of trouble connecting right now. Please try asking me again in a moment.");
  }
}

const getSystemInstruction = (movies: Movie[], siteConfig: SiteConfig, isAdmin: boolean) => {
    const movieContext = movies.map(movie => {
        return `ID: ${movie.id}, Title: ${movie.title}, Genre: ${movie.genre}, Category: ${movie.category}, Description: ${movie.description}`;
    }).join('\n');

    let instruction = `You are a smart and helpful AI assistant for "${siteConfig.name}", a Yoruba movie streaming website. Your primary goal is to help users.

- The website's URL structure for a movie is /#/movie/{id}. When a user asks for a movie that is available, you MUST provide them with the direct link. For example, a link to Jagun Jagun (ID: jagun-jagun) would be /#/movie/jagun-jagun.
- The Live TV page is currently ${siteConfig.liveTvEnabled ? 'online. You can direct users to /#/live-tv.' : 'offline. Inform users it is not available right now.'}
- For questions about movies available on our platform, answer them using the provided list. When you mention one of these movies, clearly state that it is available on ${siteConfig.name}.
- When asked for recommendations or a list of movies (e.g., "list all action movies"), suggest movies from the provided list.
- For any other questions about movies, actors, or cinema knowledge, use your extensive internal knowledge. If you do not have up-to-date information (e.g., about very recent events), state that your knowledge may not be current.
- If the user asks for a movie that is NOT on the platform list, state that it's not in our library and then ask "Would you like me to open a request form to send to the admin?" If the user says yes, respond with: "I can help you request it. Please fill out the form below." followed immediately by the special command [SHOW_MOVIE_REQUEST_FORM].
- If a user submits a movie request form with details (e.g., starting with "User has submitted a movie request form..."), your ONLY job is to respond with a confirmation message and a pre-filled email link for them to send. The email link MUST be a markdown mailto link. The recipient is ${siteConfig.contact.email}. The subject should be "New Movie Request: [Movie Title]". The body should contain all the details provided by the user. Example response: "Thanks! I've prepared the request. Please click the link to send it to our team: [Send Movie Request](mailto:${siteConfig.contact.email}?subject=New%20Movie%20Request&body=...)"
- Always be friendly and conversational. Do not output JSON.`;

    if (isAdmin) {
        const analytics = getAnalyticsSummary(1);
        instruction += `\n
---
**ADMINISTRATOR MODE ENABLED**
You are also an admin assistant. If asked about site performance or analytics, use the following real-time data to answer. Be concise and clear.

**Live Analytics Data (Last 24 hours):**
- Total Site Visits: ${analytics.dailyVisitors}
- New User Sign-ups: ${analytics.todaysSignups}
- Most Popular Movies (by page views):
  ${analytics.mostClicked.map((m, i) => `${i + 1}. ${m.title} (${m.clicks} views)`).join('\n') || 'No movie pages were viewed.'}
---`;
    } else {
        instruction += `\n
- **IMPORTANT RULE:** You are speaking to a regular user, NOT an admin. You MUST politely refuse any requests for site analytics, visitor counts, or performance metrics. Do not reveal any numbers or statistics.`;
    }

    instruction += `\nHere is the list of movies currently available on Yoruba Cinemax:
---
${movieContext}
---`;

    return instruction;
}


export interface AiChatResponse {
  text: string;
  movie?: Movie;
  sources?: { uri: string; title: string; }[];
}

export const runChat = async (prompt: string, movies: Movie[], siteConfig: SiteConfig, isAdmin: boolean = false): Promise<AiChatResponse> => {
   if (!movies || movies.length === 0) {
    return { text: "I'm still loading our movie catalog. Please ask me again in a moment!" };
  }

  try {
    const systemInstruction = getSystemInstruction(movies, siteConfig, isAdmin);
    
    const response = await callGeminiProxy('generateContent', {
        model: modelName,
        contents: prompt,
        config: { systemInstruction },
    });

    const aiText = response.text;
    let foundMovie: Movie | undefined = undefined;
    for (const movie of movies) {
      const movieTitleRegex = new RegExp(`\\b${movie.title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (movieTitleRegex.test(aiText)) {
        foundMovie = movie;
        break;
      }
    }

    return { text: aiText, movie: foundMovie, sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks };

  } catch (error) {
    return { text: (error as Error).message };
  }
};

export const findMovieByDescription = async (query: string, movies: Movie[]): Promise<Movie | null> => {
    try {
        const movieContext = movies.map(m => `ID: ${m.id}, Title: ${m.title}, Description: ${m.description}, Stars: ${m.stars.join(', ')}`).join('\n');
        const systemInstruction = `You are an expert movie finder. Your task is to find the single best movie match from the provided list based on the user's description.
Respond ONLY with a valid JSON object matching the schema. If no clear match is found, the ID should be null.

Movie List:
---
${movieContext}
---`;
        const userPrompt = `User's query: "${query}"`;
        
        const response = await callGeminiProxy('generateContent', {
            model: modelName,
            contents: userPrompt,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'OBJECT',
                    properties: {
                        movieId: { type: 'STRING', nullable: true },
                    },
                },
            },
        });
        
        const jsonString = response.text.trim();
        if (jsonString) {
            const parsed = JSON.parse(jsonString);
            if (parsed.movieId) {
                return movies.find(m => m.id === parsed.movieId) || null;
            }
        }
        return null;

    } catch (error) {
        console.error("[findMovieByDescription Error]", error);
        return null;
    }
};

export const getAiRecommendations = async (currentMovie: Movie, movies: Movie[]): Promise<{ movieId: string, reason: string }[] | null> => {
    try {
        const otherMoviesContext = movies
            .filter(m => m.id !== currentMovie.id)
            .map(m => `ID: ${m.id}, Title: ${m.title}, Genre: ${m.genre}, Category: ${m.category}, Description: ${m.description}`)
            .join('\n');

        const systemInstruction = `You are a movie recommendation expert for Yoruba Cinemax. Based on the movie the user is currently viewing, recommend 3 other relevant movies from the provided list. For each recommendation, provide a short, compelling reason (max 20 words).
Respond ONLY with a valid JSON object matching the schema.

Current Movie:
Title: ${currentMovie.title}
Description: ${currentMovie.description}

Available Movies for Recommendation:
---
${otherMoviesContext}
---`;
        const userPrompt = `Please give me 3 recommendations based on ${currentMovie.title}.`;

        const response = await callGeminiProxy('generateContent', {
            model: modelName,
            contents: userPrompt,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'OBJECT',
                    properties: {
                        recommendations: {
                            type: 'ARRAY',
                            items: {
                                type: 'OBJECT',
                                properties: {
                                    movieId: { type: 'STRING' },
                                    reason: { type: 'STRING' },
                                },
                                required: ["movieId", "reason"],
                            }
                        }
                    }
                }
            }
        });

        const jsonString = response.text.trim();
        if (jsonString) {
            const parsed = JSON.parse(jsonString);
            return parsed.recommendations || null;
        }
        return null;

    } catch (error) {
        console.error("[getAiRecommendations Error]", error);
        return null;
    }
};

export const getAiPersonalizedRecommendations = async (viewingHistory: {movieId: string, viewedAt: string}[], movies: Movie[]): Promise<{ movieId: string }[] | null> => {
    if (viewingHistory.length === 0) return null;
    try {
        const historyMovies = viewingHistory.map(h => movies.find(m => m.id === h.movieId)).filter(Boolean);
        if (historyMovies.length === 0) return null;

        const historyContext = historyMovies.map(m => `Title: ${m!.title}, Genre: ${m!.genre}, Description: ${m!.description}`).join('\n');
        const availableMoviesContext = movies
            .filter(m => !viewingHistory.some(h => h.movieId === m.id))
            .map(m => `ID: ${m.id}, Title: ${m.title}, Genre: ${m.genre}, Category: ${m.category}`)
            .join('\n');
        
        if (!availableMoviesContext) return null;

        const systemInstruction = `You are a personalized movie recommendation engine. Based on the user's viewing history, recommend 5 movies from the "Available Movies" list that they would likely enjoy.
Respond ONLY with a valid JSON object matching the schema.

User's Viewing History:
---
${historyContext}
---

Available Movies for Recommendation:
---
${availableMoviesContext}
---`;
        const userPrompt = `Give me 5 personalized recommendations.`;

        const response = await callGeminiProxy('generateContent', {
            model: modelName,
            contents: userPrompt,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: {
                    type: 'OBJECT',
                    properties: {
                        recommendations: {
                            type: 'ARRAY',
                            items: {
                                type: 'OBJECT',
                                properties: {
                                    movieId: { type: 'STRING' }
                                },
                                required: ["movieId"],
                            }
                        }
                    }
                }
            }
        });

        const jsonString = response.text.trim();
        if (jsonString) {
            const parsed = JSON.parse(jsonString);
            return parsed.recommendations || null;
        }
        return null;
        
    } catch (error) {
        console.error("[getAiPersonalizedRecommendations Error]", error);
        return null;
    }
};