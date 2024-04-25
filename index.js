const express = require("express");
const multer = require("multer");
const PDFParser = require("pdf-parse");
const fs = require("fs");
const path = require("path");
const morgan = require("morgan");
const cors = require("cors"); // Import cors middleware

const app = express();
const PORT = process.env.PORT || 5000;

// Set up Multer for handling file uploads
const upload = multer({ dest: "uploads/" });

// Use morgan for logging HTTP requests
app.use(morgan("dev"));

// Enable CORS
app.use(cors());

// Serve HTML file for uploading PDF
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "upload.html"));
});

// Handle PDF file upload and parsing
app.post("/upload", upload.single("pdfFile"), (req, res) => {
  const pdfPath = req.file.path;

  console.log("Received PDF file:", pdfPath);

  // Function to parse PDF file and extract text content
  function parsePDF(pdfPath) {
    return new Promise((resolve, reject) => {
      fs.readFile(pdfPath, (err, data) => {
        if (err) {
          console.error("Error reading PDF file:", err);
          reject(err);
          return;
        }
        PDFParser(data)
          .then((parsedData) => {
            resolve(parsedData.text);
          })
          .catch((error) => {
            console.error("Error parsing PDF:", error);
            reject(error);
          });
      });
    });
  }

  // Parse PDF and send the extracted sections as JSON object
  parsePDF(pdfPath)
    .then((content) => {
      // Remove the uploaded file after parsing
      fs.unlinkSync(pdfPath);

      // Extract education, skills, and experience using regular expressions
      const educationRegex = /E D U C A T I O N\n([\s\S]+?)(?=\n\n\d{4}|$)/;
      const skillsRegex = /S K I L L S\n([\s\S]+?)(?=\n\n[A-Z]|$)/;
      const experienceRegex =
        /E X P E R I E N C E\n([\s\S]+?)(?=\n\nS K I L L S|$)/;

      const educationMatch = content.match(educationRegex);
      const skillsMatch = content.match(skillsRegex);
      const experienceMatch = content.match(experienceRegex);

      // Function to extract years and headings from experience section
      function extractExperience(experience) {
        if (!experience) return [];
        const experiences = experience.match(/\d{4}([^•]+•)/g);
        return experiences
          ? experiences.map((exp) => exp.trim().replace(/•$/, ""))
          : [];
      }

      // Function to split skills into separate items
      function splitSkills(skills) {
        if (!skills) return "";
        return skills
          .split("\n")
          .filter((skill) => skill.trim() !== "")
          .join(", ");
      }

      // Construct JSON object with extracted sections
      const resumeData = {
        education: educationMatch ? educationMatch[1].trim() : "",
        skills: skillsMatch ? splitSkills(skillsMatch[1].trim()) : "",
        experience: experienceMatch
          ? extractExperience(experienceMatch[1].trim())
          : [],
      };

      res.json(resumeData);
    })
    .catch((error) => {
      console.error("Error parsing PDF:", error);
      res.status(500).send("Error parsing PDF");
    });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
