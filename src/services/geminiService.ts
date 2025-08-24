import { GoogleGenerativeAI } from "@google/generative-ai";
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

export const generateQuizFromText = async (contextText: string) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const prompt = `
  You are an expert NEET educator. From the following content, generate a complete quiz with:
  
  REQUIRED FIELDS:
  - quizTitle (string)
  - quizDescription (string)
  - topic (string)
  - subject (must be one of: physics, chemistry, biology)
  - difficulty (must be one of: easy, medium, hard)
  - questions (array of exactly 5 questions with):
    - questionText (string)
    - options (array of 4 options with text and isCorrect boolean)
    - explanation (string explaining why the correct answer is right)
    - subject (same as quiz subject)
    - difficulty (same as quiz difficulty)
    - isPreviousYear (false)
  
  IMPORTANT:
  - All fields are required
  - Return ONLY valid JSON (no markdown, no backticks)
  - Ensure all question objects are complete
  - Include detailed explanations for each question
  
  Content to analyze:
  ${contextText}
  `;

  try {
    const result = await model.generateContent(prompt);
    let rawText = result.response.text();
    
    // Clean the response
    rawText = rawText.replace(/```json|```/g, "").trim();
    
    const quizData = JSON.parse(rawText);
    
    // Validate required fields
    if (!quizData.quizTitle || !quizData.subject || !quizData.questions) {
      throw new Error("Gemini response missing required fields");
    }
    console.log("quiz data;",quizData);
    
    // Ensure questions have all required fields
    quizData.questions = quizData.questions.map((q: any) => ({
      questionText: q.questionText || "Question text missing",
      options: q.options || [],
      explanation: q.explanation || "Explanation not available",
      subject: q.subject || quizData.subject,
      difficulty: q.difficulty || quizData.difficulty,
      isPreviousYear: false,
      embedding: []
    }));
    
    return {
      quizTitle: quizData.quizTitle,
      quizDescription: quizData.quizDescription || "Quiz generated from images",
      topic: quizData.topic || "General",
      subject: quizData.subject,
      difficulty: quizData.difficulty || "medium",
      questions: quizData.questions
    };
  } catch (err) {
    console.error("Failed to generate quiz:", err);
    // Return a fallback quiz if Gemini fails
    return {
      quizTitle: "Generated Quiz",
      quizDescription: "Quiz generated from images",
      topic: "General",
      subject: "biology",
      difficulty: "medium",
      questions: Array(5).fill({
        questionText: "Sample question",
        options: [
          { text: "Option 1", isCorrect: true },
          { text: "Option 2", isCorrect: false },
          { text: "Option 3", isCorrect: false },
          { text: "Option 4", isCorrect: false }
        ],
        explanation: "This is a sample explanation for the correct answer",
        subject: "biology",
        difficulty: "medium",
        isPreviousYear: false,
        embedding: []
      })
    };
  }
};




export const generateDailyChallengeContext = async (subject: string): Promise<{ title: string; context: string }> => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    const prompt = `
      You are an expert NEET educator. Generate a comprehensive NEET ${subject} context for a daily challenge.
      
      REQUIREMENTS:
      - Return ONLY valid JSON (no markdown, no backticks)
      - JSON format: { "title": "Specific Topic Title", "context": "Full educational content..." }
      - Title must be a specific topic name (e.g., "Thermodynamics", "Citrus Canker", "Chemical Bonding", "Human Respiratory System")
      - Context should be 300-500 words of detailed educational content
      - Focus on important NEET topics for ${subject}
      - Content should be suitable for generating 5-10 multiple choice questions
      - Ensure content is accurate and educational
      
      Example of good output:
      {
        "title": "Human Respiratory System",
        "context": "The human respiratory system is a biological system consisting of specific organs and structures used for gas exchange in animals and plants. In humans, the respiratory system includes the airways, lungs, and the respiratory muscles..."
      }
    `;

    const result = await model.generateContent(prompt);
    let rawText = result.response.text();
    
    // Clean the response
    rawText = rawText.replace(/```json|```/g, "").trim();
    
    try {
      const responseData = JSON.parse(rawText);
      
      // Validate required fields
      if (!responseData.title || !responseData.context) {
        throw new Error("AI response missing title or context fields");
      }
      
      return {
        title: responseData.title,
        context: responseData.context
      };
    } catch (parseError) {
      console.error("JSON parsing failed:", parseError);
      
      // If JSON parsing fails, let's ask the AI to fix its response
      const fixPrompt = `
        Your previous response was not valid JSON. Please provide ONLY valid JSON in this exact format:
        {
          "title": "Specific Topic Title",
          "context": "Detailed educational content here..."
        }
        
        Requirements:
        - Title must be specific (e.g., "Thermodynamics", "Citrus Canker")
        - Context must be detailed educational content
        - No additional text outside the JSON
      `;
      
      const fixResult = await model.generateContent(fixPrompt);
      let fixedText = fixResult.response.text().replace(/```json|```/g, "").trim();
      
      try {
        const fixedData = JSON.parse(fixedText);
        return {
          title: fixedData.title,
          context: fixedData.context
        };
      } catch (fixError) {
        console.error("Second attempt also failed:", fixError);
        throw new Error("AI failed to generate valid JSON response");
      }
    }
  } catch (error) {
    console.error('Error generating daily challenge context:', error);
    // Return a meaningful fallback that still has an AI-style title
    const fallbackTitles = {
      physics: "Laws of Motion",
      chemistry: "Chemical Bonding", 
      biology: "Human Digestive System"
    };
    
    return {
      title: fallbackTitles[subject as keyof typeof fallbackTitles] || `${subject} Daily Challenge`,
      context: `This ${subject} daily challenge focuses on important NEET concepts. Study this material thoroughly as it covers key topics that are frequently tested in the examination.`
    };
  }
};