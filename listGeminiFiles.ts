import { GoogleGenAI } from "@google/genai";

// Replace with your actual API key
const genAI = new GoogleGenAI("YOUR_API_KEY_HERE");

async function listFiles() {
    try {
        const fileManager = genAI.getGenerativeModel({ model: "models/gemini-1.5-pro" }).fileManager();

        const files = await fileManager.listFiles();
        if (!files.length) {
            console.log("No files found.");
            return;
        }

        console.log("🗂️ Uploaded Gemini Files:");
        for (const file of files) {
            console.log(`- ID: ${file.name}`);
            console.log(`  MIME: ${file.mimeType}`);
            console.log(`  Size: ${file.sizeBytes} bytes\n`);
        }
    } catch (err) {
        console.error("❌ Error listing files:", err);
    }
}

listFiles();
