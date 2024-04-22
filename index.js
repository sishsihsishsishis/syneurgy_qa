import express from "express";
import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import fetch from "node-fetch";

const app = express();
const port = 3000;
const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.json());

async function isMeetingProcessed(meetingId) {
  // First, check if the meeting_id already exists
  const existingMeeting = await prisma.tbl_chat_response.findFirst({
    where: {
      meeting_id: meetingId.toString(),
    },
  });

  // If the meeting already exists, do nothing
  if (existingMeeting) {
    console.log(`Meeting ID ${meetingId} already processed.`);
    return true;
  }

  return false;
}

async function processMeetingData(meetingId, meetingData) {
  for (const [category, questions] of Object.entries(meetingData)) {
    for (const [questionId, questionData] of Object.entries(questions)) {
      await prisma.tbl_chat_response.create({
        data: {
          category: category,
          question_id: questionId,
          question: questionData.question,
          answer: questionData.answer,
          meeting_id: meetingId,
        },
      });
    }
  }
}

app.get("/", (req, res) => {
  res.send("<h1>Test API</h1> <h4>Message: Success</h4> <p>Version 1.2</p>");
});

app.post("/fetch-analysis/", async (req, res) => {
  // fix cors error
  res.setHeader("Access-Control-Allow-Origin", "*");

  const meeting_id = req.body.meeting_id;

  // Trigger the email that processing a meeting is finished
  // Created the record in notification
  // Define the API URL
const apiUrl = 'http://18.117.7.255:8080/api/notifications';

// Data to be sent in the request body
const requestData = {
    type: 0,
    objId: meeting_id    
};

await fetch(apiUrl, {
  method: 'POST',
  headers: {
      'Content-Type': 'application/json' // Specify the content type as JSON
  },
  body: JSON.stringify(requestData) // Convert data to JSON format
})
  .then(response => {
      if (!response.ok) {
          throw new Error('Network response was not ok');
      }
      return response.json(); // Parse the response body as JSON
  })
  .then(data => {
      console.log('Response data:', data); // Process the response data
  })
  .catch(error => {
      console.error('Error:', error); // Handle any errors
  });

  if (await isMeetingProcessed(meeting_id)) {
    return res.status(400).send("Meeting ID not found.");
  }

  const fetchTranscript = await fetch(
    `http://18.144.11.243:8080/nlp/${meeting_id}`
  ).then((res) => res.json());

  if (!fetchTranscript.data || !fetchTranscript.data.length) {
    return res.status(404).send("Meeting ID not found.");
  }

  const text = fetchTranscript.data
    .map(
      (item) =>
        `${item.speaker} ${item.starts} ${item.ends} ${item.sentence} ${item.emotion} ${item.dialogue}`
    )
    .join("\n");

  // Set Content-Type to 'text/plain' and send the response
  res.setHeader("Content-Type", "text/plain");

  if (!meeting_id) {
    return res.status(400).send("Meeting ID is required.");
  }

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `you are a meeting analysis assistant only returning the following json structure
          add an answer of maximum 150 characters and a minimum of 100 characters for each question in the answer key, try to answer in a feedback manner
          {
            "CollaborativeWork": {
              "Question0": {
                "question": "Who was the user with most collaborative work?",
                "answer": ""
              },
              "Question1": {
                "question": "How did the team react to collaborative work?",
                "answer": ""
              },
              "Question2": {
                "question": "What was the specific situation or task related to collaborative work?",
                "answer": ""
              },
              "Question3": {
                "question": "How did the team react to the situation related to collaborative work?",
                "answer": ""
              }
            },
            "Leadership": {
              "Question0": {
                "question": "Who was the user in a leadership role?",
                "answer": ""
              },
              "Question1": {
                "question": "How did the team react to the leadership?",
                "answer": ""
              },
              "Question2": {
                "question": "What was the specific challenge or task realted to leadership?",
                "answer": ""
              },
              "Question3": {
                "question": "How did the team react to the leadership's handling of the situation?",
                "answer": ""
              }
            },
            "Brainstorming": {
              "Question0": {
                "question": "Who was the user initiating the brainstorming?",
                "answer": ""
              },
              "Question1": {
                "question": "How did the team react to the brainstorming session?",
                "answer": ""
              },
              "Question2": {
                "question": "What was the specific idea or problem addressed in the brainstorming?",
                "answer": ""
              },
              "Question3": {
                "question": "How did the team react to the outcomes of the brainstorming?",
                "answer": ""
              }
            }
          }`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      model: "gpt-4-1106-preview",
      response_format: { type: "json_object" },
    });

    const response = JSON.parse(completion.choices[0].message.content);
    await processMeetingData(meeting_id, response);
    res.json(response);
  } catch (error) {
    console.error("Error occurred:", error);
    res
      .status(500)
      .send("An error occurred while processing your request.\n" + error);
  }
});

async function isMeetingProcessedForMatch(meetingId) {
  const existingMeeting = await prisma.match_entity.findFirst({
    where: {
      meeting_id: meetingId,
    },
  });

  // If the meeting already exists, do nothing
  if (existingMeeting) {
    console.log(`Meeting ID ${meetingId} already processed.`);
    return true;
  }

  return false;
}

app.get("/get-analysis/:meetingId", async (req, res) => {
  // fix cors error
  res.setHeader("Access-Control-Allow-Origin", "*");

  const meetingId = req.params.meetingId;

  try {
    // Fetch data from the database
    const chatResponses = await prisma.tbl_chat_response.findMany({
      where: {
        meeting_id: meetingId,
      },
    });

    if (!chatResponses.length) {
      return res.status(404).send("Meeting ID not found.");
    }

    // Transform the data into the required JSON structure
    const responseJson = chatResponses.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = {};
      }
      acc[item.category][item.question_id] = {
        question: item.question,
        answer: item.answer,
      };
      return acc;
    }, {});

    // Send the response
    res.json(responseJson);
  } catch (error) {
    console.error("Error occurred:", error);
    res
      .status(500)
      .send("An error occurred while fetching the data.\n" + error);
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server is running at http://localhost:${port}`);
});

export default app;
